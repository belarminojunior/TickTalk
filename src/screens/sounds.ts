import { useEffect, useRef } from 'react';
import { play } from '../audio/sfx';

/** Tique-taque nos últimos 5 segundos. */
export function useTickSounds(remainingMs: number, active: boolean): void {
  const lastSecond = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      lastSecond.current = null;
      return;
    }
    const sec = Math.ceil(remainingMs / 1000);
    if (lastSecond.current !== null && sec !== lastSecond.current && sec <= 5 && sec > 0) {
      play(sec % 2 === 0 ? 'tick' : 'tock');
    }
    lastSecond.current = sec;
  }, [remainingMs, active]);
}
