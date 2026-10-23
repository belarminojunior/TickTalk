import { DescriberApp } from './DescriberApp';
import { HostApp } from './HostApp';

export function isDescriberPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '').toLowerCase() === '/explicar';
}

/** Minimal router: "/" is the table (setup + game), "/explicar" is the describer screen. */
export function App() {
  return isDescriberPath(window.location.pathname) ? <DescriberApp /> : <HostApp />;
}
