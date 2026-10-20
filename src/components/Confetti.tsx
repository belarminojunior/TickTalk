import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const COLORS = ['#F7C51E', '#2BB3E6', '#F5F1EA', '#E23B3B', '#2E9E4F', '#EE7FA8', '#F28C28'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
}

/** Confetes em canvas, sem biblioteca. Desligados com movimento reduzido. */
export function Confetti({ durationMs = 5000 }: { durationMs?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || /jsdom/i.test(navigator.userAgent)) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    const W = () => canvas.width / dpr;
    const pieces: Piece[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * W(),
      y: -20 - Math.random() * window.innerHeight * 0.8,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 2 + Math.random() * 3.5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      w: 8 + Math.random() * 8,
      h: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const elapsed = now - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W(), canvas.height / dpr);
      const fade = elapsed > durationMs - 800 ? Math.max(0, (durationMs - elapsed) / 800) : 1;
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.rot += p.vr;
        if (p.y > canvas.height / dpr + 20 && elapsed < durationMs - 1500) {
          p.y = -20;
          p.vy = 2 + Math.random() * 3;
        }
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < durationMs) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W(), canvas.height / dpr);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [reduced, durationMs]);

  if (reduced) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60 }}
    />
  );
}
