import { DescriberApp } from './DescriberApp';
import { loadSetup } from './game/storage';
import type { Language } from './game/types';
import { HostApp } from './HostApp';
import { I18nProvider } from './i18n';
import { HomeScreen } from './screens/HomeScreen';

const normalize = (pathname: string) => pathname.replace(/\/+$/, '').toLowerCase();

export function isDescriberPath(pathname: string): boolean {
  return normalize(pathname) === '/explicar';
}

export function isTablePath(pathname: string): boolean {
  return normalize(pathname) === '/mesa';
}

function homeLanguage(): Language {
  const saved = loadSetup()?.settings.uiLanguage;
  if (saved) return saved;
  return typeof navigator !== 'undefined' && /^en/i.test(navigator.language) ? 'en' : 'pt';
}

/**
 * Minimal router: "/" is the home page (create or join a room), "/mesa" is the table
 * (setup + game, it opens the room), "/explicar?sala=CODE" is a phone in a room.
 */
export function App() {
  const { pathname } = window.location;
  if (isDescriberPath(pathname)) return <DescriberApp />;
  if (isTablePath(pathname)) return <HostApp />;
  return (
    <I18nProvider language={homeLanguage()}>
      <HomeScreen
        onCreate={() => window.location.assign('/mesa')}
        onJoin={(code) => window.location.assign(`/explicar?sala=${code}`)}
      />
    </I18nProvider>
  );
}
