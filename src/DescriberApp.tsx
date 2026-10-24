import { useEffect, useState } from 'react';
import { useConfig } from './config';
import type { Language, ScreenMode } from './game/types';
import { useDescriberClient } from './hooks/useTransport';
import { useWakeLock } from './hooks/useWakeLock';
import { I18nProvider } from './i18n';
import { BroadcastChannelTransport } from './net/broadcast';
import { stableClientId, type Transport } from './net/transport';
import { WebSocketTransport } from './net/websocket';
import { DescriberScreen } from './screens/DescriberScreen';

function guessLanguage(): Language {
  return typeof navigator !== 'undefined' && /^en/i.test(navigator.language) ? 'en' : 'pt';
}

/** /explicar: the describer screen, on a phone (WebSocket) or in a second window (BroadcastChannel). */
export function DescriberApp() {
  const config = useConfig();
  const [mode] = useState<ScreenMode>(() =>
    new URLSearchParams(window.location.search).get('via') === 'window' ? 'windows' : 'phone',
  );
  const [transport, setTransport] = useState<Transport | null>(null);

  useEffect(() => {
    const id = stableClientId();
    const t: Transport =
      mode === 'windows' && BroadcastChannelTransport.isSupported()
        ? new BroadcastChannelTransport(id)
        : new WebSocketTransport('describer', id);
    setTransport(t);
    return () => t.close();
  }, [mode]);

  // When the phone comes back from the lock screen, reconnect straight away.
  useEffect(() => {
    if (!(transport instanceof WebSocketTransport)) return;
    const onVisible = () => document.visibilityState === 'visible' && transport.reconnectNow();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [transport]);

  const client = useDescriberClient(transport, config.now);
  useWakeLock(mode === 'phone' && client.view !== null && client.view.phase !== 'setup');

  useEffect(() => {
    document.title = 'Tick Talk · explicar';
  }, []);

  const language = client.view?.language ?? client.language ?? guessLanguage();
  return (
    <I18nProvider language={language}>
      <DescriberScreen
        view={client.view}
        anchor={client.anchor}
        status={client.status}
        mode={mode}
        now={config.now}
        onCommand={client.send}
        onTakeOver={client.takeOver}
        onJoinTeam={client.joinTeam}
      />
    </I18nProvider>
  );
}
