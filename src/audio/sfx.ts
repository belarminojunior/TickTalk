/**
 * Sound effects synthesised with the Web Audio API (no audio files).
 * Everything fails silently if the browser has no audio.
 */
export type Sfx = 'tick' | 'tock' | 'hit' | 'unhit' | 'horn' | 'dice' | 'hop' | 'win' | 'start';

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let muted = false;
const lastPlayed = new Map<Sfx, number>();

function audio(): Ctx | null {
  if (muted) return null;
  if (ctx) return ctx;
  const AC: typeof AudioContext | undefined =
    typeof window !== 'undefined'
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a user gesture (click/tap) so the browser allows sound. */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem('ticktalk.muted', value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isMuted(): boolean {
  return muted;
}

export function loadMuted(): boolean {
  try {
    muted = window.localStorage.getItem('ticktalk.muted') === '1';
  } catch {
    muted = false;
  }
  return muted;
}

function tone(c: Ctx, opts: { freq: number; to?: number; start?: number; dur: number; type?: OscillatorType; gain?: number }) {
  const t0 = c.currentTime + (opts.start ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

function noise(c: Ctx, opts: { start?: number; dur: number; gain?: number; freq?: number }) {
  const t0 = c.currentTime + (opts.start ?? 0);
  const length = Math.max(1, Math.floor(c.sampleRate * opts.dur));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = opts.freq ?? 2500;
  const g = c.createGain();
  g.gain.value = opts.gain ?? 0.25;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
}

const SOUNDS: Record<Sfx, (c: Ctx) => void> = {
  tick: (c) => noise(c, { dur: 0.04, gain: 0.5, freq: 3800 }),
  tock: (c) => noise(c, { dur: 0.05, gain: 0.5, freq: 1800 }),
  hit: (c) => {
    tone(c, { freq: 880, dur: 0.12, type: 'triangle', gain: 0.18 });
    tone(c, { freq: 1320, start: 0.07, dur: 0.16, type: 'triangle', gain: 0.16 });
  },
  unhit: (c) => tone(c, { freq: 520, to: 360, dur: 0.12, type: 'triangle', gain: 0.12 }),
  horn: (c) => {
    tone(c, { freq: 196, dur: 0.9, type: 'sawtooth', gain: 0.12 });
    tone(c, { freq: 247, dur: 0.9, type: 'square', gain: 0.06 });
    tone(c, { freq: 98, dur: 0.9, type: 'sawtooth', gain: 0.08 });
  },
  dice: (c) => {
    for (let i = 0; i < 9; i++) noise(c, { start: i * 0.11 + Math.random() * 0.04, dur: 0.05, gain: 0.35, freq: 1200 + Math.random() * 1600 });
  },
  hop: (c) => tone(c, { freq: 660, to: 990, dur: 0.08, type: 'sine', gain: 0.1 }),
  start: (c) => {
    tone(c, { freq: 523, dur: 0.12, type: 'triangle', gain: 0.15 });
    tone(c, { freq: 784, start: 0.1, dur: 0.18, type: 'triangle', gain: 0.15 });
  },
  win: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, start: i * 0.13, dur: 0.3, type: 'triangle', gain: 0.16 }));
  },
};

export function play(sound: Sfx): void {
  const c = audio();
  if (!c) return;
  // Avoid the same sound twice in a row (e.g. table and card in the same window).
  const now = Date.now();
  if (now - (lastPlayed.get(sound) ?? 0) < 120) return;
  lastPlayed.set(sound, now);
  try {
    if (c.state === 'suspended') void c.resume().catch(() => undefined);
    SOUNDS[sound](c);
  } catch {
    /* no sound */
  }
}
