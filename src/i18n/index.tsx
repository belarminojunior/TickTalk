import { createContext, useContext, type ReactNode } from 'react';
import type { Language } from '../game/types';
import { STRINGS, type Strings } from './strings';

const I18nContext = createContext<Strings>(STRINGS.pt);

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  return <I18nContext.Provider value={STRINGS[language] ?? STRINGS.pt}>{children}</I18nContext.Provider>;
}

export function useT(): Strings {
  return useContext(I18nContext);
}
