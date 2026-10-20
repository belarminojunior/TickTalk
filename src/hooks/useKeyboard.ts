import { useEffect, useRef } from 'react';

export type KeyMap = Record<string, (event: KeyboardEvent) => void>;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Normaliza a tecla: " " → "Space", letras em minúsculas. */
export function keyName(event: KeyboardEvent): string {
  if (event.key === ' ' || event.code === 'Space') return 'Space';
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

/** Atalhos globais. Ignora teclas quando se escreve num campo. */
export function useKeyboard(map: KeyMap, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (isTyping(event.target)) return;
      const handler = ref.current[keyName(event)];
      if (!handler) return;
      // Espaço e Enter sobre um botão focado já o ativam; não duplicar.
      if ((event.key === ' ' || event.key === 'Enter') && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
