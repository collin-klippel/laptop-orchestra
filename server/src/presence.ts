import type { User } from '@laptop-orchestra/shared';

/**
 * In-memory presence registry. Single source of truth for who is online
 * during the lifetime of this server process.
 *
 * Replace with a Redis-backed implementation when we need to scale beyond
 * one node or survive restarts.
 */
export class Presence {
  private readonly users = new Map<string, User>();

  add(socketId: string, user: User): void {
    this.users.set(socketId, user);
  }

  remove(id: string): User | undefined {
    const existing = this.users.get(id);
    this.users.delete(id);
    return existing;
  }

  list(): User[] {
    return Array.from(this.users.values()).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    );
  }

  size(): number {
    return this.users.size;
  }
}
