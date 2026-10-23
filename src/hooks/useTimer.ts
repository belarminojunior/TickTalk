import { useEffect, useRef, useState } from 'react';

/** Calls `onTick` at regular intervals while `active` (the host clock). */
export function useInterval(onTick: () => void, ms: number, active: boolean): void {
  const ref = useRef(onTick);
  ref.current = onTick;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

/**
 * Smooth countdown: from `remainingMs`, valid at instant `anchor` (local clock),
 * returns the remaining time, updated ~10 times a second while `running`.
 */
export function useCountdown(remainingMs: number, running: boolean, anchor: number, now: () => number): number {
  const compute = () => (running ? Math.max(0, remainingMs - (now() - anchor)) : remainingMs);
  const [value, setValue] = useState(compute);
  const computeRef = useRef(compute);
  computeRef.current = compute;
  useEffect(() => {
    setValue(computeRef.current());
    if (!running) return;
    const id = setInterval(() => setValue(computeRef.current()), 100);
    return () => clearInterval(id);
  }, [remainingMs, running, anchor]);
  return value;
}

/** Waits `ms` and calls `fn`; cancelled on unmount or when the dependencies change. */
export function useTimeout(fn: () => void, ms: number | null, deps: unknown[]): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setTimeout(() => ref.current(), ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}
