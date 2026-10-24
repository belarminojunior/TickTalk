import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useT } from '../i18n';
import styles from './QrConnect.module.css';

export type ServerStatus = 'connecting' | 'online' | 'offline';

/** QR code generated locally + address + phone connection status. */
export function QrConnect({
  url,
  connected,
  server,
  compact,
  teamPhones = false,
}: {
  url: string | null;
  connected: number;
  server: ServerStatus;
  compact?: boolean;
  /** One phone per team: every team opens the same address. */
  teamPhones?: boolean;
}) {
  const t = useT();
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
        <h3 className={styles.title}>{teamPhones ? t.connectTeamPhones : t.connectPhone}</h3>
        {server === 'offline' ? (
          <p className={styles.warn}>{t.serverMissing}</p>
        ) : (
          <p className={styles.help}>
            {teamPhones ? t.connectTeamPhonesHelpBefore : t.connectPhoneHelpBefore}
            <strong className={styles.url}>{url ?? '…'}</strong>
            {teamPhones ? t.connectTeamPhonesHelpAfter : t.connectPhoneHelpAfter}
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
