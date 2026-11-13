import { useEffect, useState } from 'react';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

/** The phone page for a room: /explicar?sala=KQTR */
export function phonePath(room: string | null): string {
  return room ? `/explicar?sala=${encodeURIComponent(room)}` : '/explicar';
}

/**
 * Address the phone should open. Deployed: this site's own address. On the PC
 * (localhost): http://<PC's LAN IP>:<port>, so phones on the same Wi-Fi can reach it.
 */
export function usePhoneUrl(enabled: boolean, room: string | null = null): string | null {
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const { hostname, host, port, protocol } = window.location;
    if (!LOCAL_HOSTS.includes(hostname)) {
      setBase(`${protocol}//${host}`);
      return;
    }
    let cancelled = false;
    fetch('/api/info')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((info: { addresses?: string[] }) => {
        if (cancelled) return;
        const ip = info.addresses?.[0];
        setBase(ip ? `${protocol}//${ip}${port ? `:${port}` : ''}` : `${protocol}//${host}`);
      })
      .catch(() => !cancelled && setBase(`${protocol}//${host}`));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return base ? base + phonePath(room) : null;
}
