import type { PhoneIssue } from '../game/selectors';
import { PEER_TIMEOUT_MS } from './hub';
import { parseClientMessage, parseServerNotice, type DescriberCommand, type PlayerInfo } from './protocol';
import { SERVER_ID } from './transport';

/** Someone who joined from their own phone. */
export interface RosterPlayer {
  key: string;
  name: string;
  /** Team id ("t1"…) or null while they haven't chosen. */
  team: string | null;
  /** Their phone is connected right now. */
  online: boolean;
}

export type PlayerHubEvent =
  /** Send this phone its view. */
  | { type: 'sync'; id: string }
  | { type: 'command'; id: string; player: { name: string; team: string | null }; command: DescriberCommand }
  /** A phone left; `player` is who it was (if anyone). */
  | { type: 'left'; id: string; player: { name: string; team: string | null } | null }
  | { type: 'peers-changed'; count: number }
  | { type: 'roster-changed' };

interface Peer {
  lastSeen: number;
  key: string | null;
  issue: PhoneIssue | null;
}

interface Player {
  name: string;
  team: string | null;
  /** Join order: the order in which a team's players take turns describing. */
  order: number;
  peerId: string | null;
}

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * Host side of "one phone per person". Each phone has a stable key; the person writes their
 * name and picks a team on it. Names are unique among connected phones; a phone that
 * comes back (reload, new connection) gets its player back from its key, or, if the table
 * forgot it (reload of the table), from the name and team it remembers.
 * The table may also shuffle players, move or remove them.
 */
export class PlayerHub {
  private peers = new Map<string, Peer>();
  private players = new Map<string, Player>();
  /** Players the table removed: their phone must ask for a name again. */
  private removed = new Set<string>();
  private nextOrder = 1;

  constructor(private timeoutMs = PEER_TIMEOUT_MS) {}

  get connectedCount(): number {
    return this.peers.size;
  }

  peerIds(): string[] {
    return [...this.peers.keys()];
  }

  /** Everyone who joined, in join order. */
  roster(): RosterPlayer[] {
    return [...this.players.entries()]
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([key, p]) => ({ key, name: p.name, team: p.team, online: p.peerId !== null }));
  }

  /** Who this phone is (null: no name yet, refused, or removed). */
  playerOf(id: string): { key: string; name: string; team: string | null } | null {
    const key = this.peers.get(id)?.key;
    const player = key ? this.players.get(key) : undefined;
    return key && player && player.peerId === id ? { key, name: player.name, team: player.team } : null;
  }

  issueOf(id: string): PhoneIssue | null {
    return this.peers.get(id)?.issue ?? null;
  }

  /** Teams with at least one phone connected. */
  teamsOnline(): string[] {
    return [...new Set([...this.players.values()].filter((p) => p.peerId && p.team).map((p) => p.team!))];
  }

  isOnline(name: string, team: string): boolean {
    return [...this.players.values()].some((p) => p.peerId && p.team === team && sameName(p.name, name));
  }

  /**
   * @param teams ids of the teams players may be in right now (the setup rows, or the
   *              game's teams); anything else counts as no team.
   */
  receive(from: string, raw: unknown, now: number, teams: readonly string[]): PlayerHubEvent[] {
    if (from === SERVER_ID) {
      const notice = parseServerNotice(raw);
      return notice?.kind === 'peer-left' ? this.remove(notice.id) : [];
    }
    const message = parseClientMessage(raw);
    if (!message) return [];
    if (message.kind === 'bye') return this.remove(from);

    const events: PlayerHubEvent[] = [];
    let peer = this.peers.get(from);
    if (!peer) {
      peer = { lastSeen: now, key: null, issue: null };
      this.peers.set(from, peer);
      events.push({ type: 'peers-changed', count: this.peers.size });
    }
    peer.lastSeen = now;

    if (message.kind === 'command') {
      const player = this.playerOf(from);
      if (player) events.push({ type: 'command', id: from, player: { name: player.name, team: player.team }, command: message.command });
      return events;
    }

    if (message.kind === 'me') {
      if (this.identify(from, peer, message.player, true, teams)) events.push({ type: 'roster-changed' });
      events.push({ type: 'sync', id: from });
      return events;
    }

    // hello / ping carry who the phone remembers being.
    if ((message.kind === 'hello' || message.kind === 'ping') && message.player) {
      if (this.identify(from, peer, message.player, false, teams)) events.push({ type: 'roster-changed' });
    }
    events.push({ type: 'sync', id: from });
    return events;
  }

  /**
   * Binds a phone to a player. `explicit`: the person just typed their name or tapped a
   * team (it wins over what the table had); otherwise it is the phone's memory, which only
   * fills in what the table doesn't know. Returns true if the roster changed.
   */
  private identify(id: string, peer: Peer, info: PlayerInfo | null, explicit: boolean, teams: readonly string[]): boolean {
    if (!info) {
      // "Forget me": the person wants to start again (other name).
      const key = peer.key;
      peer.key = null;
      peer.issue = null;
      if (key && this.players.get(key)?.peerId === id) {
        this.players.delete(key);
        return true;
      }
      return false;
    }

    const { key } = info;
    const team = info.team && teams.includes(info.team) ? info.team : null;
    if (explicit) this.removed.delete(key);
    peer.key = key;
    if (this.removed.has(key)) {
      peer.issue = 'removed';
      return false;
    }

    const existing = this.players.get(key);
    const name = explicit || !existing ? info.name : existing.name;
    // Another person with this name: refused while their phone is connected; taken over
    // when it isn't (the same person on a new phone or browser).
    const other = [...this.players.entries()].find(([k, p]) => k !== key && sameName(p.name, name));
    if (other && other[1].peerId !== null && this.peers.has(other[1].peerId)) {
      // Refused: the phone keeps the player it had (if any) and asks for another name.
      peer.issue = 'nameTaken';
      return false;
    }

    let changed = false;
    if (other) {
      this.players.delete(other[0]);
      changed = true;
    }
    // A refused rename stays on screen until the person tries again (heartbeats don't clear it).
    if (explicit || existing?.peerId !== id) peer.issue = null;
    if (!existing) {
      this.players.set(key, { name, team: team ?? (other?.[1].team ?? null), order: other?.[1].order ?? this.nextOrder++, peerId: id });
      return true;
    }
    if (existing.peerId !== id) {
      // This key was on another connection: the newest one wins.
      const old = existing.peerId ? this.peers.get(existing.peerId) : undefined;
      if (old) old.key = null;
      existing.peerId = id;
      changed = true;
    }
    if (explicit) {
      if (existing.name !== name || existing.team !== team) changed = true;
      existing.name = name;
      if (existing.team !== team) existing.order = this.nextOrder++;
      existing.team = team;
    } else if (existing.team === null && team) {
      existing.team = team;
      changed = true;
    }
    return changed;
  }

  /**
   * The table deals players into teams (shuffle). Keys are listed per team, in the order
   * they will describe; anyone not listed keeps their team.
   */
  assign(teams: Record<string, string[]>): void {
    for (const [team, keys] of Object.entries(teams)) {
      for (const key of keys) {
        const player = this.players.get(key);
        if (!player) continue;
        player.team = team;
        player.order = this.nextOrder++;
      }
    }
  }

  /** The table removes someone (for example a phone left behind). */
  kick(key: string): void {
    const player = this.players.get(key);
    if (!player) return;
    this.players.delete(key);
    this.removed.add(key);
    const peer = player.peerId ? this.peers.get(player.peerId) : undefined;
    if (peer) peer.issue = 'removed';
  }

  /** A setup row was deleted: its players lose their team; the rows after it move up. */
  removeTeamAt(index: number): void {
    const removedId = `t${index + 1}`;
    for (const player of this.players.values()) {
      if (!player.team) continue;
      const n = Number(player.team.slice(1));
      if (player.team === removedId) player.team = null;
      else if (n > index + 1) player.team = `t${n - 1}`;
    }
  }

  /** Teams that no longer exist: their players have no team. */
  pruneTeams(teams: readonly string[]): boolean {
    let changed = false;
    for (const player of this.players.values()) {
      if (player.team && !teams.includes(player.team)) {
        player.team = null;
        changed = true;
      }
    }
    return changed;
  }

  remove(id: string): PlayerHubEvent[] {
    const peer = this.peers.get(id);
    if (!peer) return [];
    this.peers.delete(id);
    const player = peer.key ? this.players.get(peer.key) : undefined;
    const was = player && player.peerId === id ? { name: player.name, team: player.team } : null;
    if (player && player.peerId === id) player.peerId = null;
    return [
      { type: 'left', id, player: was },
      { type: 'peers-changed', count: this.peers.size },
      { type: 'roster-changed' },
    ];
  }

  sweep(now: number): PlayerHubEvent[] {
    const events: PlayerHubEvent[] = [];
    for (const [id, peer] of [...this.peers]) {
      if (now - peer.lastSeen > this.timeoutMs) events.push(...this.remove(id));
    }
    return events;
  }
}
