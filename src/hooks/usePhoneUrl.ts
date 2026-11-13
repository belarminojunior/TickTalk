/** The phone page for a room: /explicar?sala=KQTR */
export function phonePath(room: string | null): string {
  return room ? `/explicar?sala=${encodeURIComponent(room)}` : '/explicar';
}

/** Address the phones open: this same site, at the room's phone page. */
export function usePhoneUrl(enabled: boolean, room: string | null = null): string | null {
  if (!enabled || typeof window === 'undefined') return null;
  return window.location.origin + phonePath(room);
}
