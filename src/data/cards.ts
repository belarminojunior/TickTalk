import type { Card, Language } from '../game/types';
import pt from './cards.pt.json';
import en from './cards.en.json';

export const CARDS: Record<Language, Card[]> = {
  pt: pt as Card[],
  en: en as Card[],
};
