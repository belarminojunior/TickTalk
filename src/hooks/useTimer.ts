import { useEffect, useRef, useState } from 'react';

/** Dispara `onTick` a intervalos regulares enquanto `active` (o relógio do anfitrião). */
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
 * Contagem suave: a partir de `remainingMs` válido no instante `anchor` (relógio local),
 * devolve o tempo restante, atualizado ~10 vezes por segundo enquanto `running`.
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

/** Espera `ms` (escalado) e chama `fn`; cancela ao desmontar ou quando as dependências mudam. */
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
