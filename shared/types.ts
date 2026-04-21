/**
 * Wire types shared by client and server.
 *
 * Keep this file framework-agnostic: it must compile under both the
 * server's Node TS config and the client's Vite TS config.
 */

export const MAX_NICKNAME_LENGTH = 32;

export type Role = 'performer' | 'conductor';

export interface User {
  /** Stable per-connection id; we use the socket id. */
  id: string;
  /** Display name chosen by the user at sign-in. */
  nickname: string;
  /** Server-side timestamp (ms since epoch) when the user joined. */
  joinedAt: number;
  /** Whether this user is conducting or performing. */
  role: Role;
}

export interface JoinPayload {
  nickname: string;
  clientId: string;
  role: Role;
}

/** A root note + scale type that applies to all pitched instrument parts. */
export interface KeySetting {
  /** Root pitch class, e.g. "C", "F#", "Bb". */
  root: string;
  /** Scale type accepted by the aleatoric library, e.g. "major", "minor", "pentatonic". */
  scaleType: string;
}

/** Client emits when measuring round-trip skew (Cristian-style clock estimate). */
export interface ClockPingPayload {
  /** Client `Date.now()` when the ping is sent. */
  clientSendEpochMs: number;
}

/**
 * Server ack for clock_ping. Estimated offset ms (server − client midpoint):
 * `clientSendEpochMs` is echoed; derive `offsetMs ≈ serverNowEpochMs - (clientSend + receive)/2`.
 */
export interface ClockPongPayload {
  serverNowEpochMs: number;
  clientSendEpochMs: number;
}

/** Saved conductor settings for recall (client localStorage). */
export interface PerformancePreset {
  id: string;
  name: string;
  bpm: number;
  key: KeySetting;
  metronomeEnabled: boolean;
  countInBeats: number;
  createdAt: number;
}

export interface PerformanceState {
  /** Whether the conductor has started the performance. */
  active: boolean;
  /**
   * Epoch ms at which all clients should start their Tone.js Transport.
   * Only present while active.
   */
  startAt?: number;
  /** Currently selected key; absent until the conductor sets one. */
  key?: KeySetting;
  /** Shared tempo when set by the conductor. */
  bpm?: number;
  metronomeEnabled?: boolean;
  countInBeats?: number;
  lockMode?: boolean;
  performerStates?: Record<
    string,
    {
      muted?: boolean;
      solo?: boolean;
    }
  >;
}

export interface ServerToClientEvents {
  /** Full roster, broadcast on every membership change. */
  users: (users: User[]) => void;
  /** The connected client's own User record, sent once after join. */
  welcome: (self: User) => void;
  /** Conductor changed the shared BPM. */
  tempo_change: (bpm: number) => void;
  /**
   * Conductor started the performance. All clients should start their
   * Transport at the given epoch-ms timestamp.
   */
  performance_start: (startAt: number) => void;
  /** Conductor stopped the performance. All clients should stop playback. */
  performance_stop: () => void;
  /**
   * Sent only to a newly-joined socket so late arrivals know the current
   * performance status without waiting for the next broadcast.
   */
  performance_state: (state: PerformanceState) => void;
  /** Conductor changed the shared key/scale. */
  key_change: (key: KeySetting) => void;
  metronome_change: (enabled: boolean) => void;
  count_in_change: (beats: number) => void;
  performer_mute_change: (performerId: string, muted: boolean) => void;
  performer_solo_change: (performerId: string, solo: boolean) => void;
  lock_mode_change: (locked: boolean) => void;
}

export interface ClientToServerEvents {
  join: (
    payload: JoinPayload,
    ack?: (result: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  /** Conductor sets a new BPM for all performers. */
  set_tempo: (bpm: number) => void;
  /** Conductor starts the performance. */
  start_performance: () => void;
  /** Conductor stops the performance. */
  stop_performance: () => void;
  /** Conductor sets the key/scale for all performers. */
  set_key: (key: KeySetting) => void;
  set_metronome: (enabled: boolean) => void;
  set_count_in: (beats: number) => void;
  set_performer_mute: (performerId: string, muted: boolean) => void;
  set_performer_solo: (performerId: string, solo: boolean) => void;
  set_lock_mode: (locked: boolean) => void;
  /** Measure wall-clock skew vs server for aligning transport `startAt` (epoch ms). */
  clock_ping: (
    payload: ClockPingPayload,
    ack: (response: ClockPongPayload) => void,
  ) => void;
}

// biome-ignore lint/complexity/noBannedTypes: socket.io requires {} for empty inter-server events
export type InterServerEvents = {};

export interface SocketData {
  user?: User;
}
