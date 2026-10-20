import { DescriberApp } from './DescriberApp';
import { HostApp } from './HostApp';

export function isDescriberPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '').toLowerCase() === '/explicar';
}

/** Router mínimo: "/" é a mesa (configuração + jogo), "/explicar" é a tela de quem explica. */
export function App() {
  return isDescriberPath(window.location.pathname) ? <DescriberApp /> : <HostApp />;
}
