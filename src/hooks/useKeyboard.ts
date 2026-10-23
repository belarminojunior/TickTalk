import { useEffect, useRef } from 'react';

export type KeyMap = Record<string, (event: KeyboardEvent) => void>;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Normalises the key: " " → "Space", letters in lower case. */
export function keyName(event: KeyboardEvent): string {
  if (event.key === ' ' || event.code === 'Space') return 'Space';
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

/** Global shortcuts. Ignores keys while typing in a field. */
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
      // Space and Enter on a focused button already activate it; do not double up.
      if ((event.key === ' ' || event.key === 'Enter') && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
