/** Room codes: 4 letters, without I or O (same rules as server/rooms.ts). */
const CODE_PATTERN = /^[A-HJ-NP-Z]{4}$/;

/** "kq tr" → "KQTR"; null if it can't be a room code. */
export function normalizeRoomCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.replace(/[\s-]/g, '').toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** The room in the phone page's address (/explicar?sala=KQTR). */
export function roomFromLocation(search: string): string | null {
  return normalizeRoomCode(new URLSearchParams(search).get('sala'));
}
