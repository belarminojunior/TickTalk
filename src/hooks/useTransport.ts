import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import type { GameAction } from '../game/reducer';
import { describerView, type DescriberView } from '../game/selectors';
import type { GameState, Language, ScreenMode } from '../game/types';
import { BroadcastChannelTransport } from '../net/broadcast';
import { DescriberHub, type HubEvent } from '../net/hub';
import { LocalBus, LocalTransport } from '../net/local';
import { msg, parseHostMessage, parseServerNotice, type DescriberCommand } from '../net/protocol';
import { HOST_ID, SERVER_ID, type LinkStatus, type Transport } from '../net/transport';
import { WebSocketTransport } from '../net/websocket';

export type ServerStatus = 'connecting' | 'online' | 'offline';

export const LOCAL_DESCRIBER_ID = 'local-describer';

export interface HostLink {
  /** Connected describer screens (phones or windows). */
  connected: number;
  /** An active describer is connected. */
  describerOnline: boolean;
  serverStatus: ServerStatus;
  /** In "one screen" mode: the describer end, in the same window. */
  localClient: Transport | null;
  /** Another window opened the table and took over the server connection. */
  replaced: boolean;
  /** Takes the connection back (the other window becomes "replaced"). */
  takeOver: () => void;
}

function takeOverTransport(transport: Transport | null | undefined): void {
  if (transport instanceof WebSocketTransport) transport.takeOver();
}

function createHostTransports(mode: ScreenMode): { host: Transport; local: Transport | null } {
  if (mode === 'phone') return { host: new WebSocketTransport('host', HOST_ID), local: null };
  if (mode === 'windows' && BroadcastChannelTransport.isSupported()) {
    return { host: new BroadcastChannelTransport(HOST_ID), local: null };
  }
  const bus = new LocalBus();
  return { host: new LocalTransport(bus, HOST_ID), local: new LocalTransport(bus, LOCAL_DESCRIBER_ID) };
}

/** Turns a describer command into a reducer action. */
export function commandToAction(command: DescriberCommand, now: number): GameAction {
  switch (command.type) {
    case 'READY':
      return { type: 'READY' };
    case 'START':
      return { type: 'START_TURN', now };
    case 'TOGGLE_WORD':
      return { type: 'TOGGLE_WORD', index: command.index, now };
    case 'UNDO_HIT':
      return { type: 'UNDO_HIT', now };
    case 'PAUSE':
      return { type: 'PAUSE', now };
    case 'RESUME':
      return { type: 'RESUME', now };
    case 'END_EARLY':
      return { type: 'END_EARLY', now };
    case 'NEXT_TEAM':
      return { type: 'NEXT_TEAM' };
  }
}

/**
 * Host side: opens the transport for the chosen mode, accepts one describer at a time,
 * sends it its view (with the words) and turns its commands into actions.
 */
export function useHostLink(
  mode: ScreenMode,
  state: GameState,
  dispatch: Dispatch<GameAction>,
  now: () => number,
): HostLink {
  const [link, setLink] = useState<{ host: Transport; local: Transport | null } | null>(null);
  const [connected, setConnected] = useState(0);
  const [describerOnline, setDescriberOnline] = useState(false);
  const [transportStatus, setTransportStatus] = useState<LinkStatus>('connecting');
  const [slowConnect, setSlowConnect] = useState(false);
  const hubRef = useRef<DescriberHub | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    const transports = createHostTransports(mode);
    const hub = new DescriberHub();
    hubRef.current = hub;
    setConnected(0);
    setDescriberOnline(false);
    setLink(transports);
    const { host } = transports;

    const handle = (events: HubEvent[]) => {
      for (const e of events) {
        const t = nowRef.current();
        switch (e.type) {
          case 'accepted':
            host.send(e.id, msg.state(describerView(stateRef.current, t)));
            break;
          case 'rejected':
            host.send(e.id, msg.busy(stateRef.current.settings.uiLanguage));
            break;
          case 'command':
            dispatch(commandToAction(e.command, t));
            break;
          case 'describer-lost':
            dispatch({ type: 'DESCRIBER_DISCONNECTED', now: t });
            break;
          case 'peers-changed':
            setConnected(e.count);
            break;
        }
      }
      setDescriberOnline(hub.activeId !== null);
    };

    const offMessage = host.onMessage((from, body) => handle(hub.receive(from, body, nowRef.current())));
    const offStatus = host.onStatus(setTransportStatus);
    const sweep = setInterval(() => handle(hub.sweep(nowRef.current())), 1000);
    const bye = () => {
      if (hub.activeId) host.send(hub.activeId, msg.hostBye());
    };
    window.addEventListener('pagehide', bye);

    return () => {
      bye();
      window.removeEventListener('pagehide', bye);
      clearInterval(sweep);
      offMessage();
      offStatus();
      host.close();
      transports.local?.close();
      hubRef.current = null;
    };
  }, [mode, dispatch]);

  // Every state change (timer included) goes to the active describer.
  useEffect(() => {
    const hub = hubRef.current;
    if (!link || !hub?.activeId) return;
    link.host.send(hub.activeId, msg.state(describerView(state, now())));
  }, [state, link, now]);

  useEffect(() => {
    if (transportStatus === 'open') {
      setSlowConnect(false);
      return;
    }
    const id = setTimeout(() => setSlowConnect(true), 2500);
    return () => clearTimeout(id);
  }, [transportStatus]);

  const serverStatus: ServerStatus = transportStatus === 'open' ? 'online' : slowConnect ? 'offline' : 'connecting';

  const host = link?.host;
  const takeOver = useCallback(() => takeOverTransport(host), [host]);

  return {
    connected,
    describerOnline,
    serverStatus,
    localClient: link?.local ?? null,
    replaced: transportStatus === 'replaced',
    takeOver,
  };
}

export type DescriberStatus = 'connecting' | 'ready' | 'busy' | 'waitingHost' | 'reconnecting' | 'replaced';

export interface DescriberClient {
  view: DescriberView | null;
  /** Local instant the view arrived (for the smooth countdown). */
  anchor: number;
  status: DescriberStatus;
  /** The table's language, even before there is a view (e.g. when busy). */
  language: Language | null;
  send: (command: DescriberCommand) => void;
  /** After "replaced": reconnects this page. */
  takeOver: () => void;
}

const HOST_SILENCE_MS = 5000;

/** Describer side: says hello, sends heartbeats, receives its view and sends commands. */
export function useDescriberClient(transport: Transport | null, now: () => number): DescriberClient {
  const [view, setView] = useState<DescriberView | null>(null);
  const [anchor, setAnchor] = useState(0);
  const [status, setStatus] = useState<DescriberStatus>('connecting');
  const [language, setLanguage] = useState<Language | null>(null);
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    if (!transport) return;
    let lastHost = nowRef.current();
    let everConnected = false;

    const offStatus = transport.onStatus((s) => {
      if (s === 'open') {
        everConnected = true;
        transport.send(HOST_ID, msg.hello());
      } else if (s === 'connecting') {
        setStatus(everConnected ? 'reconnecting' : 'connecting');
      } else if (s === 'replaced') {
        setStatus('replaced');
      }
    });

    const offMessage = transport.onMessage((from, body) => {
      if (from === SERVER_ID) {
        const notice = parseServerNotice(body);
        if (notice?.kind === 'host-status') {
          if (notice.online) transport.send(HOST_ID, msg.hello());
          else setStatus('waitingHost');
        }
        return;
      }
      if (from !== HOST_ID) return;
      const m = parseHostMessage(body);
      if (!m) return;
      lastHost = nowRef.current();
      if (m.kind === 'state') {
        setView(m.view);
        setLanguage(m.view.language);
        setAnchor(nowRef.current());
        setStatus('ready');
      } else if (m.kind === 'busy') {
        if (m.language) setLanguage(m.language);
        setStatus('busy');
      } else {
        setStatus('waitingHost');
      }
    });

    const ping = setInterval(() => {
      if (transport.status !== 'open') return;
      transport.send(HOST_ID, msg.ping());
      if (nowRef.current() - lastHost > HOST_SILENCE_MS) {
        setStatus((s) => (s === 'busy' ? s : 'waitingHost'));
      }
    }, 2000);

    const bye = () => transport.send(HOST_ID, msg.bye());
    window.addEventListener('pagehide', bye);

    return () => {
      window.removeEventListener('pagehide', bye);
      clearInterval(ping);
      offStatus();
      offMessage();
      bye();
    };
  }, [transport]);

  const send = useCallback(
    (command: DescriberCommand) => {
      transport?.send(HOST_ID, msg.command(command));
    },
    [transport],
  );

  const takeOver = useCallback(() => takeOverTransport(transport), [transport]);

  return { view, anchor, status, language, send, takeOver };
}
