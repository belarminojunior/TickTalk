import { useEffect, useState } from 'react';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

/** Endereço que o telemóvel deve abrir: http://<IP do PC na rede>:<porta>/explicar */
export function usePhoneUrl(enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const { hostname, host, port, protocol } = window.location;
    if (!LOCAL_HOSTS.includes(hostname)) {
      setUrl(`${protocol}//${host}/explicar`);
      return;
    }
    let cancelled = false;
    fetch('/api/info')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((info: { addresses?: string[] }) => {
        if (cancelled) return;
        const ip = info.addresses?.[0];
        setUrl(ip ? `${protocol}//${ip}${port ? `:${port}` : ''}/explicar` : `${protocol}//${host}/explicar`);
      })
      .catch(() => !cancelled && setUrl(`${protocol}//${host}/explicar`));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return url;
}
