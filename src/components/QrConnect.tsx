import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useT } from '../i18n';
import styles from './QrConnect.module.css';

export type ServerStatus = 'connecting' | 'online' | 'offline';

/** QR code gerado localmente + endereço + estado da ligação do telemóvel. */
export function QrConnect({ url, connected, server, compact }: { url: string | null; connected: number; server: ServerStatus; compact?: boolean }) {
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
        <h3 className={styles.title}>{t.connectPhone}</h3>
        {server === 'offline' ? (
          <p className={styles.warn}>{t.serverMissing}</p>
        ) : (
          <p className={styles.help}>
            {t.connectPhoneHelpBefore}
            <strong className={styles.url}>{url ?? '…'}</strong>
            {t.connectPhoneHelpAfter}
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
