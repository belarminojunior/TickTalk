import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import type { GameAction } from '../game/reducer';
import {
  describerView,
  mayCommand,
  mayPlayerCommand,
  phoneView,
  playerPhoneView,
  type DescriberView,
  type Lobby,
} from '../game/selectors';
import type { GameState, Language, PawnColor, ScreenMode } from '../game/types';
import { DescriberHub, type HubEvent } from '../net/hub';
import { PlayerHub, type PlayerHubEvent, type RosterPlayer } from '../net/playerHub';
import {
  VALIDATION_COMMANDS,
  msg,
  parseHostMessage,
  parseServerNotice,
  type DescriberCommand,
  type PlayerInfo,
} from '../net/protocol';
import { TeamHub, type TeamHubEvent } from '../net/teamHub';
import { HOST_ID, SERVER_ID, type LinkStatus, type Transport } from '../net/transport';
import { WebSocketTransport } from '../net/websocket';

export type ServerStatus = 'connecting' | 'online' | 'offline';

export interface HostLink {
  /** Connected describer screens (phones or windows). */
  connected: number;
  /** An active describer is connected. */
  describerOnline: boolean;
  serverStatus: ServerStatus;
  /** Another window opened the table and took over the server connection. */
  replaced: boolean;
  /** Takes the connection back (the other window becomes "replaced"). */
  takeOver: () => void;
  /** A phone per team or per person: ids of the teams that have a phone connected. */
  teamsWithPhone: string[];
  /** One phone per person: everyone who joined, in join order. */
  roster: RosterPlayer[];
  /** One phone per person: deal players into teams (team id → keys, in describing order). */
  assignPlayers: (teams: Record<string, string[]>) => void;
  /** One phone per person: take someone off the list. */
  removePlayer: (key: string) => void;
  /** One phone per person: a setup row was deleted (its players lose their team). */
  removeTeamAt: (index: number) => void;
}

/** One phone per person, before the game: the setup rows and the table's language. */
export interface LobbySetup {
  /** The setup rows, with the name to show (a placeholder if still empty). */
  teams: { name: string; color: PawnColor }[];
  language: Language;
}

const NO_LOBBY: LobbySetup = { teams: [], language: 'pt' };

function takeOverTransport(transport: Transport | null | undefined): void {
  if (transport instanceof WebSocketTransport) transport.takeOver();
}

function createHostTransport(factory?: () => Transport): Transport {
  return factory ? factory() : new WebSocketTransport('host', HOST_ID);
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
    case 'SET_VALIDATION':
      return { type: 'SET_VALIDATION', side: command.side, index: command.index, annulled: command.annulled };
    case 'CONFIRM_VALIDATION':
      return { type: 'CONFIRM_VALIDATION' };
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
  transportFactory?: () => Transport,
  lobby: LobbySetup = NO_LOBBY,
): HostLink {
  const [link, setLink] = useState<{ host: Transport } | null>(null);
  const factoryRef = useRef(transportFactory);
  factoryRef.current = transportFactory;
  const [connected, setConnected] = useState(0);
  const [describerOnline, setDescriberOnline] = useState(false);
  const [transportStatus, setTransportStatus] = useState<LinkStatus>('connecting');
  const [slowConnect, setSlowConnect] = useState(false);
  const [teamsWithPhone, setTeamsWithPhone] = useState<string[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const hubRef = useRef<DescriberHub | null>(null);
  const teamHubRef = useRef<TeamHub | null>(null);
  const playerHubRef = useRef<PlayerHub | null>(null);
  const lobbyRef = useRef(lobby);
  lobbyRef.current = lobby;
  const stateRef = useRef(state);
  stateRef.current = state;
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    const host = createHostTransport(factoryRef.current);
    setConnected(0);
    setDescriberOnline(false);
    setTeamsWithPhone([]);
    setRoster([]);
    setLink({ host });

    if (mode === 'playerPhones') {
      // One phone per person: each phone is someone; commands are checked per person.
      const playerHub = new PlayerHub();
      playerHubRef.current = playerHub;
      const teamIds = () =>
        stateRef.current.phase === 'setup' ? lobbyRef.current.teams.map((_, i) => `t${i + 1}`) : stateRef.current.teams.map((t) => t.id);

      const handlePlayers = (events: PlayerHubEvent[]) => {
        const synced: string[] = [];
        let rosterChanged = false;
        for (const e of events) {
          const t = nowRef.current();
          switch (e.type) {
            case 'sync':
              synced.push(e.id);
              break;
            case 'command':
              if (mayPlayerCommand(stateRef.current, e.player, e.command)) dispatch(commandToAction(e.command, t));
              break;
            case 'left': {
              const { turn, teams } = stateRef.current;
              const describing = turn && e.player && teams[turn.teamIndex]?.id === e.player.team && turn.describer === e.player.name;
              if (describing) dispatch({ type: 'DESCRIBER_DISCONNECTED', now: t });
              break;
            }
            case 'peers-changed':
              setConnected(e.count);
              break;
            case 'roster-changed':
              rosterChanged = true;
              break;
          }
        }
        if (rosterChanged) {
          setRoster(playerHub.roster());
          sendPlayerViews(host, playerHub, stateRef.current, nowRef.current(), lobbyRef.current);
        } else if (synced.length > 0) {
          sendPlayerViews(host, playerHub, stateRef.current, nowRef.current(), lobbyRef.current, synced);
        }
      };

      const offMessage = host.onMessage((from, body) => handlePlayers(playerHub.receive(from, body, nowRef.current(), teamIds())));
      const offStatus = host.onStatus(setTransportStatus);
      const sweep = setInterval(() => handlePlayers(playerHub.sweep(nowRef.current())), 1000);
      const bye = () => {
        for (const id of playerHub.peerIds()) host.send(id, msg.hostBye());
      };
      window.addEventListener('pagehide', bye);
      return () => {
        bye();
        window.removeEventListener('pagehide', bye);
        clearInterval(sweep);
        offMessage();
        offStatus();
        host.close();
        playerHubRef.current = null;
      };
    }

    if (mode === 'teamPhones') {
      // One phone per team: every phone gets its own view; commands are checked per team.
      const teamHub = new TeamHub();
      teamHubRef.current = teamHub;
      const teamIds = () => stateRef.current.teams.map((t) => t.id);

      const handleTeams = (events: TeamHubEvent[]) => {
        let resync = false;
        for (const e of events) {
          const t = nowRef.current();
          switch (e.type) {
            case 'sync':
              resync = true;
              break;
            case 'command':
              if (mayCommand(stateRef.current, e.team, e.command)) dispatch(commandToAction(e.command, t));
              break;
            case 'left': {
              const { turn, teams } = stateRef.current;
              if (turn && e.team && teams[turn.teamIndex]?.id === e.team) dispatch({ type: 'DESCRIBER_DISCONNECTED', now: t });
              resync = true;
              break;
            }
            case 'peers-changed':
              setConnected(e.count);
              break;
          }
        }
        if (resync) sendTeamViews(host, teamHub, stateRef.current, nowRef.current());
        setTeamsWithPhone(teamHub.takenTeams());
      };

      const offMessage = host.onMessage((from, body) => handleTeams(teamHub.receive(from, body, nowRef.current(), teamIds())));
      const offStatus = host.onStatus(setTransportStatus);
      const sweep = setInterval(() => handleTeams(teamHub.sweep(nowRef.current())), 1000);
      const bye = () => {
        for (const id of teamHub.peerIds()) host.send(id, msg.hostBye());
      };
      window.addEventListener('pagehide', bye);
      return () => {
        bye();
        window.removeEventListener('pagehide', bye);
        clearInterval(sweep);
        offMessage();
        offStatus();
        host.close();
        teamHubRef.current = null;
      };
    }

    const hub = new DescriberHub();
    hubRef.current = hub;

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
            // The describer never validates its own turn.
            if (!VALIDATION_COMMANDS.includes(e.command.type)) dispatch(commandToAction(e.command, t));
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
      hubRef.current = null;
    };
  }, [mode, dispatch]);

  // Every state change (timer included) goes to the active describer — or, with a phone
  // per team or per person, to every phone (each with its own view).
  useEffect(() => {
    if (!link) return;
    const playerHub = playerHubRef.current;
    if (playerHub) {
      const ids = state.phase === 'setup' ? lobby.teams.map((_, i) => `t${i + 1}`) : state.teams.map((t) => t.id);
      if (playerHub.pruneTeams(ids)) setRoster(playerHub.roster());
      sendPlayerViews(link.host, playerHub, state, now(), lobby);
      return;
    }
    const teamHub = teamHubRef.current;
    if (teamHub) {
      teamHub.pruneTeams(state.teams.map((t) => t.id));
      sendTeamViews(link.host, teamHub, state, now());
      setTeamsWithPhone(teamHub.takenTeams());
      return;
    }
    const hub = hubRef.current;
    if (!hub?.activeId) return;
    link.host.send(hub.activeId, msg.state(describerView(state, now())));
  }, [state, link, now, lobby]);

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

  // The table changed the roster: update its list and every phone.
  const afterRosterChange = useCallback(() => {
    const playerHub = playerHubRef.current;
    if (!playerHub || !host) return;
    setRoster(playerHub.roster());
    sendPlayerViews(host, playerHub, stateRef.current, nowRef.current(), lobbyRef.current);
  }, [host]);
  const assignPlayers = useCallback(
    (teams: Record<string, string[]>) => {
      playerHubRef.current?.assign(teams);
      afterRosterChange();
    },
    [afterRosterChange],
  );
  const removePlayer = useCallback(
    (key: string) => {
      playerHubRef.current?.kick(key);
      afterRosterChange();
    },
    [afterRosterChange],
  );
  const removeTeamAt = useCallback(
    (index: number) => {
      playerHubRef.current?.removeTeamAt(index);
      afterRosterChange();
    },
    [afterRosterChange],
  );

  const playing = state.turn ? state.teams[state.turn.teamIndex] : undefined;
  const playerTeams = [...new Set(roster.filter((p) => p.online && p.team).map((p) => p.team!))];
  return {
    connected,
    describerOnline:
      mode === 'playerPhones'
        ? !!playing && roster.some((p) => p.online && p.team === playing.id && p.name === state.turn?.describer)
        : mode === 'teamPhones'
          ? !!playing && teamsWithPhone.includes(playing.id)
          : describerOnline,
    teamsWithPhone: mode === 'playerPhones' ? playerTeams : teamsWithPhone,
    roster,
    assignPlayers,
    removePlayer,
    removeTeamAt,
    serverStatus,
    replaced: transportStatus === 'replaced',
    takeOver,
  };
}

/** Sends each phone (or only `only`) its own view, in "one phone per person" mode. */
function sendPlayerViews(host: Transport, hub: PlayerHub, state: GameState, now: number, lobby: LobbySetup, only?: string[]): void {
  const roster = hub.roster();
  const shared: Lobby = {
    teams: lobby.teams.map((t, i) => ({ id: `t${i + 1}`, name: t.name, color: t.color })),
    roster: roster.map((p) => ({ name: p.name, team: p.team, online: p.online })),
    language: lobby.language,
  };
  for (const id of only ?? hub.peerIds()) {
    const player = hub.playerOf(id);
    const phone = { player: player ? { name: player.name, team: player.team } : null, issue: hub.issueOf(id) };
    host.send(id, msg.state(playerPhoneView(state, now, phone, shared)));
  }
}

function sendTeamViews(host: Transport, hub: TeamHub, state: GameState, now: number): void {
  const takenTeams = hub.takenTeams();
  for (const id of hub.peerIds()) {
    host.send(id, msg.state(phoneView(state, now, { teamId: hub.teamOf(id), refusedTeam: hub.refusedOf(id), takenTeams })));
  }
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
  /** One phone per team: choose this phone's team (null = none). */
  joinTeam: (team: string | null) => void;
  /** One phone per person: who this phone is (null = forget me, to start again). */
  setPlayer: (player: { name: string; team: string | null } | null) => void;
}

/** One phone per person: what the phone remembers about its person (the table may forget). */
export interface StoredPlayer {
  key: string;
  name: string | null;
  team: string | null;
}

export interface PlayerStore {
  load(): StoredPlayer;
  save(player: StoredPlayer): void;
}

const PLAYER_KEY = 'ticktalk.player';

function randomKey(): string {
  return `p-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Kept in localStorage, so the person is recognised when the page or the phone restarts. */
export const localPlayerStore: PlayerStore = {
  load() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(PLAYER_KEY) ?? 'null') as Partial<StoredPlayer> | null;
      if (raw && typeof raw.key === 'string') {
        return { key: raw.key, name: typeof raw.name === 'string' ? raw.name : null, team: typeof raw.team === 'string' ? raw.team : null };
      }
    } catch {
      /* ignore */
    }
    const fresh = { key: randomKey(), name: null, team: null };
    this.save(fresh);
    return fresh;
  },
  save(player) {
    try {
      window.localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
    } catch {
      /* ignore */
    }
  },
};

/** In memory (tests: several phones in one page). */
export function memoryPlayerStore(key = randomKey()): PlayerStore {
  let player: StoredPlayer = { key, name: null, team: null };
  return {
    load: () => player,
    save: (p) => {
      player = p;
    },
  };
}

function asInfo(p: StoredPlayer): PlayerInfo | null {
  return p.name ? { key: p.key, name: p.name, team: p.team } : null;
}

const TEAM_KEY = 'ticktalk.team';

function loadTeam(): string | null {
  try {
    return window.localStorage.getItem(TEAM_KEY);
  } catch {
    return null;
  }
}

function storeTeam(team: string | null): void {
  try {
    if (team) window.localStorage.setItem(TEAM_KEY, team);
    else window.localStorage.removeItem(TEAM_KEY);
  } catch {
    /* ignore */
  }
}

const HOST_SILENCE_MS = 5000;

/** Describer side: says hello, sends heartbeats, receives its view and sends commands. */
export function useDescriberClient(
  transport: Transport | null,
  now: () => number,
  playerStore: PlayerStore = localPlayerStore,
): DescriberClient {
  const [view, setView] = useState<DescriberView | null>(null);
  const [anchor, setAnchor] = useState(0);
  const [status, setStatus] = useState<DescriberStatus>('connecting');
  const [language, setLanguage] = useState<Language | null>(null);
  const nowRef = useRef(now);
  nowRef.current = now;
  // The team this phone plays for (one phone per team); remembered across reloads.
  const teamRef = useRef<string | null>(loadTeam());
  // Who this phone is (one phone per person); remembered across reloads.
  const storeRef = useRef(playerStore);
  const playerRef = useRef<StoredPlayer>(playerStore.load());

  useEffect(() => {
    if (!transport) return;
    let lastHost = nowRef.current();
    let everConnected = false;

    const offStatus = transport.onStatus((s) => {
      if (s === 'open') {
        everConnected = true;
        transport.send(HOST_ID, msg.hello(teamRef.current, asInfo(playerRef.current)));
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
          if (notice.online) transport.send(HOST_ID, msg.hello(teamRef.current, asInfo(playerRef.current)));
          else setStatus('waitingHost');
        }
        return;
      }
      if (from !== HOST_ID) return;
      const m = parseHostMessage(body);
      if (!m) return;
      lastHost = nowRef.current();
      if (m.kind === 'state') {
        // Forget a remembered team that was refused (another phone has it) or no longer exists.
        const you = m.view.you;
        const remembered = teamRef.current;
        if (
          m.view.mode === 'teamPhones' &&
          remembered &&
          (you?.refusedTeam === remembered || (m.view.teamsList.length > 0 && !m.view.teamsList.some((t) => t.id === remembered)))
        ) {
          teamRef.current = null;
          storeTeam(null);
        }
        if (m.view.mode === 'playerPhones') rememberPlayer(m.view);
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

    // Keep what the table says about this person (it may have moved them to another team).
    const rememberPlayer = (view: DescriberView) => {
      const stored = playerRef.current;
      let next = stored;
      if (view.you.issue === 'removed') next = { ...stored, name: null, team: null };
      else if (view.you.name) {
        const team = view.phase === 'setup' ? view.you.teamId : view.you.teamId ?? stored.team;
        next = { ...stored, name: view.you.name, team };
      }
      if (next.name !== stored.name || next.team !== stored.team) {
        playerRef.current = next;
        storeRef.current.save(next);
      }
    };

    const ping = setInterval(() => {
      if (transport.status !== 'open') return;
      transport.send(HOST_ID, msg.ping(teamRef.current, asInfo(playerRef.current)));
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

  const joinTeam = useCallback(
    (team: string | null) => {
      teamRef.current = team;
      storeTeam(team);
      transport?.send(HOST_ID, msg.join(team));
    },
    [transport],
  );

  const setPlayer = useCallback(
    (player: { name: string; team: string | null } | null) => {
      const stored = playerRef.current;
      if (!player) {
        playerRef.current = { ...stored, name: null, team: null };
        storeRef.current.save(playerRef.current);
      }
      // The phone only keeps the name once the table accepts it (see rememberPlayer).
      transport?.send(HOST_ID, msg.me(player ? { key: stored.key, name: player.name, team: player.team } : null));
    },
    [transport],
  );

  return { view, anchor, status, language, send, takeOver, joinTeam, setPlayer };
}
