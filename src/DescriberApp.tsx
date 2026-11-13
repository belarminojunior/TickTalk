import { useEffect, useState } from 'react';
import { useConfig } from './config';
import type { Language } from './game/types';
import { useDescriberClient } from './hooks/useTransport';
import { useWakeLock } from './hooks/useWakeLock';
import { I18nProvider } from './i18n';
import { stableClientId, type Transport } from './net/transport';
import { WebSocketTransport } from './net/websocket';
import { DescriberScreen } from './screens/DescriberScreen';

function guessLanguage(): Language {
  return typeof navigator !== 'undefined' && /^en/i.test(navigator.language) ? 'en' : 'pt';
}

/** /explicar: the phone screen (describer, or a team's phone), connected to the table over WebSocket. */
export function DescriberApp() {
  const config = useConfig();
  const [transport, setTransport] = useState<Transport | null>(null);

  useEffect(() => {
    const t = new WebSocketTransport('describer', stableClientId());
    setTransport(t);
    return () => t.close();
  }, []);

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
  useWakeLock(client.view !== null && client.view.phase !== 'setup');

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
        mode={client.view?.mode ?? 'phone'}
        now={config.now}
        onCommand={client.send}
        onTakeOver={client.takeOver}
        onJoinTeam={client.joinTeam}
        onPlayer={client.setPlayer}
      />
    </I18nProvider>
  );
}
