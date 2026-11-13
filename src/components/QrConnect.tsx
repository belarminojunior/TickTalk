import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { ScreenMode } from '../game/types';
import { useT } from '../i18n';
import styles from './QrConnect.module.css';

export type ServerStatus = 'connecting' | 'online' | 'offline';

/** Opened on the PC itself (npm run play), as opposed to a deployed site. */
function isLocalPage(): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

/** QR code generated locally + address + phone connection status. */
export function QrConnect({
  url,
  connected,
  server,
  compact,
  mode = 'phone',
  room = null,
}: {
  url: string | null;
  connected: number;
  server: ServerStatus;
  compact?: boolean;
  /** With a phone per team or per person, everyone opens the same address. */
  mode?: ScreenMode;
  /** The room code, for typing it on a phone instead of scanning. */
  room?: string | null;
}) {
  const t = useT();
  const text = {
    phone: [t.connectPhone, t.connectPhoneHelpBefore, t.connectPhoneHelpAfter],
    teamPhones: [t.connectTeamPhones, t.connectTeamPhonesHelpBefore, t.connectTeamPhonesHelpAfter],
    playerPhones: [t.connectEveryone, t.connectEveryoneHelpBefore, t.connectEveryoneHelpAfter],
  }[mode];
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 280, color: { dark: '#141414', light: '#F5F1EA' } })
      .then((d) => !cancelled && setDataUrl(d))
      .catch(() => !cancelled && setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className={`${styles.qr} ${compact ? styles.compact : ''}`}>
      <div className={styles.code}>
        {dataUrl && url ? <img src={dataUrl} alt={t.qrAlt(url)} /> : <span className={styles.placeholder} aria-hidden="true" />}
      </div>
      <div className={styles.text}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{text[0]}</h3>
          {room && (
            <p className={styles.room} aria-label={`${t.roomLabel} ${room}`}>
              <span>{t.roomLabel}</span>
              <strong data-testid="room-code">{room}</strong>
            </p>
          )}
        </div>
        {server === 'offline' ? (
          <p className={styles.warn}>{isLocalPage() ? t.serverMissing : t.serverUnreachable}</p>
        ) : (
          <p className={styles.help}>
            {text[1]}
            <strong className={styles.url}>{url ?? '…'}</strong>
            {text[2]}
          </p>
        )}
        {server !== 'offline' && (
          <p className={styles.status} data-tone={server === 'online' && connected > 0 ? 'ok' : 'off'} role="status">
            <span className={styles.dot} aria-hidden="true" />
            {server === 'connecting' ? t.serverConnecting : t.phonesConnected(connected)}
          </p>
        )}
      </div>
    </div>
  );
}
