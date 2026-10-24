import { PEER_TIMEOUT_MS } from './hub';
import { parseClientMessage, parseServerNotice, type DescriberCommand } from './protocol';
import { SERVER_ID } from './transport';

export type TeamHubEvent =
  /** Send this phone its view (it said hello, pinged, or changed team). */
  | { type: 'sync'; id: string }
  | { type: 'command'; id: string; team: string; command: DescriberCommand }
  /** A phone left; `team` is the team it was playing for (if any). */
  | { type: 'left'; id: string; team: string | null }
  | { type: 'peers-changed'; count: number };

interface Peer {
  lastSeen: number;
  /** Team this phone plays for, once the host accepted the claim. */
  team: string | null;
  /** The team it asked for was already taken by another phone. */
  refused: string | null;
}

/**
 * Host side of "one phone per team": every connected phone may claim one team, and each
 * team has at most one phone (first come, first served). Commands are tagged with the
 * sender's team so the host can decide who may do what.
 */
export class TeamHub {
  private peers = new Map<string, Peer>();

  constructor(private timeoutMs = PEER_TIMEOUT_MS) {}

  get connectedCount(): number {
    return this.peers.size;
  }

  teamOf(id: string): string | null {
    return this.peers.get(id)?.team ?? null;
  }

  /** The claim this phone made that was refused (team already had a phone). */
  refusedOf(id: string): string | null {
    return this.peers.get(id)?.refused ?? null;
  }

  /** Teams that have a phone right now. */
  takenTeams(): string[] {
    return [...this.peers.values()].map((p) => p.team).filter((t): t is string => t !== null);
  }

  peerIds(): string[] {
    return [...this.peers.keys()];
  }

  /**
   * @param teams ids of the teams in the current game; claims for other ids are dropped
   *              (for example a phone remembering a team from a previous game).
   */
  receive(from: string, raw: unknown, now: number, teams: readonly string[]): TeamHubEvent[] {
    if (from === SERVER_ID) {
      const notice = parseServerNotice(raw);
      return notice?.kind === 'peer-left' ? this.remove(notice.id) : [];
    }
    const message = parseClientMessage(raw);
    if (!message) return [];
    if (message.kind === 'bye') return this.remove(from);

    const events: TeamHubEvent[] = [];
    let peer = this.peers.get(from);
    if (!peer) {
      peer = { lastSeen: now, team: null, refused: null };
      this.peers.set(from, peer);
      events.push({ type: 'peers-changed', count: this.peers.size });
    }
    peer.lastSeen = now;

    if (message.kind === 'command') {
      if (peer.team) events.push({ type: 'command', id: from, team: peer.team, command: message.command });
      return events;
    }

    // hello / ping carry the team the phone remembers; join is an explicit choice.
    const wanted = message.team;
    if (wanted !== undefined) this.claim(from, peer, wanted, teams);
    events.push({ type: 'sync', id: from });
    return events;
  }

  private claim(id: string, peer: Peer, team: string | null, teams: readonly string[]): void {
    if (team === null || !teams.includes(team)) {
      peer.team = null;
      peer.refused = null;
      return;
    }
    if (peer.team === team) return;
    const holder = [...this.peers.entries()].find(([otherId, p]) => otherId !== id && p.team === team);
    if (holder) {
      peer.team = null;
      peer.refused = team;
      return;
    }
    peer.team = team;
    peer.refused = null;
  }

  /** The game changed (new teams): forget claims for teams that no longer exist. */
  pruneTeams(teams: readonly string[]): void {
    for (const peer of this.peers.values()) {
      if (peer.team && !teams.includes(peer.team)) peer.team = null;
    }
  }

  remove(id: string): TeamHubEvent[] {
    const peer = this.peers.get(id);
    if (!peer) return [];
    this.peers.delete(id);
    return [
      { type: 'left', id, team: peer.team },
      { type: 'peers-changed', count: this.peers.size },
    ];
  }

  sweep(now: number): TeamHubEvent[] {
    const events: TeamHubEvent[] = [];
    for (const [id, peer] of [...this.peers]) {
      if (now - peer.lastSeen > this.timeoutMs) events.push(...this.remove(id));
    }
    return events;
  }
}
