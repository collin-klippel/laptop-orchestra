import type {
  ClientToServerEvents,
  ClockPongPayload,
  KeySetting,
  PerformanceState,
  ServerToClientEvents,
  User,
} from '@laptop-orchestra/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { joinRoleFromSearch } from '../lib/joinRole';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    const v = sorted[mid];
    return typeof v === 'number' ? v : 0;
  }
  const low = sorted[mid - 1];
  const high = sorted[mid];
  return typeof low === 'number' && typeof high === 'number'
    ? (low + high) / 2
    : 0;
}

/** Drops one min and max when enough samples remain (cheap RTT outlier rejection). */
function trimmedMedian(samples: number[]): number {
  let use = [...samples].sort((a, b) => a - b);
  if (use.length >= 4) {
    use = use.slice(1, -1);
  }
  return Math.round(median(use));
}

const CLOCK_PROBE_TIMEOUT_MS = 3500;

function probeClockOffsetOnce(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
): Promise<number | null> {
  return new Promise((resolve) => {
    const deadline = window.setTimeout(() => {
      resolve(null);
    }, CLOCK_PROBE_TIMEOUT_MS);

    const tSend = Date.now();
    socket.emit(
      'clock_ping',
      { clientSendEpochMs: tSend },
      (pong?: ClockPongPayload) => {
        window.clearTimeout(deadline);
        const tReceive = Date.now();
        if (
          !pong ||
          typeof pong.serverNowEpochMs !== 'number' ||
          typeof pong.clientSendEpochMs !== 'number'
        ) {
          resolve(null);
          return;
        }
        // Cristian: server vs client midpoint offset (ms toward server timeline).
        const offsetMs = pong.serverNowEpochMs - (tSend + tReceive) / 2;
        resolve(offsetMs);
      },
    );
  });
}

async function measureServerClockOffset(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  probeCount = 5,
): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < probeCount; i++) {
    const sample = await probeClockOffsetOnce(socket);
    if (sample !== null) samples.push(sample);
  }
  if (samples.length === 0) return 0;
  return trimmedMedian(samples);
}

const SERVER_CLOCK_REFRESH_MS = 45_000;

const SERVER_URL = (() => {
  const url = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
  if (import.meta.env.DEV && !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `[dev] VITE_SERVER_URL is set to a non-local URL ("${url}"). ` +
        'Remove it from your local .env to avoid connecting to production.',
    );
  }
  return url;
})();

export const NICKNAME_STORAGE_KEY = 'laptop-orchestra:nickname';
const LEGACY_ROLE_STORAGE_KEY = 'laptop-orchestra:role';
const CLIENT_ID_KEY = 'laptop-orchestra:clientId';

/** Stable anon id used for sequencing seed salt (same browser profile). */
export function getOrCreateClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface UseSocketResult {
  status: ConnectionStatus;
  error: string | null;
  self: User | null;
  users: User[];
  conductorBpm: number | null;
  conductorKey: KeySetting | null;
  performanceState: PerformanceState;
  /**
   * `Date.now()` + offset ≈ server epoch ms (`startAt` baseline). Estimated via
   * `clock_ping` after join & refreshed periodically while connected.
   */
  serverClockOffsetMs: number;
  connect: (nickname: string) => void;
  disconnect: () => void;
  setTempo: (bpm: number) => void;
  setKey: (key: KeySetting) => void;
  startPerformance: () => void;
  stopPerformance: () => void;
}

/**
 * Owns the singleton Socket.IO client and exposes the live presence state
 * as plain React values. The socket is lazily created and only opened when
 * `connect(nickname)` is called.
 */
export function useSocket(): UseSocketResult {
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const autoConnectAttemptedRef = useRef(false);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [self, setSelf] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [conductorBpm, setConductorBpm] = useState<number | null>(null);
  const [conductorKey, setConductorKey] = useState<KeySetting | null>(null);
  const [performanceState, setPerformanceState] = useState<PerformanceState>({
    active: false,
  });
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);

  // Track if socket has ever successfully connected to avoid premature cleanup disconnect.
  const socketConnectedAtLeastOnceRef = useRef(false);

  const ensureSocket = useCallback(() => {
    if (socketRef.current) {
      return socketRef.current;
    }
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      SERVER_URL,
      {
        autoConnect: false,
        transports: ['websocket', 'polling'],
      },
    );

    socket.on('connect', () => {
      socketConnectedAtLeastOnceRef.current = true;
    });

    socket.on('connect_error', (err) => {
      setStatus('error');
      setError(err.message);
    });

    socket.on('disconnect', () => {
      setStatus('idle');
      setSelf(null);
      setUsers([]);
      setConductorBpm(null);
      setConductorKey(null);
      setPerformanceState({ active: false });
      setServerClockOffsetMs(0);
    });

    socket.on('welcome', (me) => {
      setSelf(me);
    });

    socket.on('users', (list) => {
      setUsers(list);
    });

    socket.on('tempo_change', (bpm) => {
      setConductorBpm(bpm);
    });

    socket.on('performance_start', (startAt) => {
      setPerformanceState({ active: true, startAt });
    });

    socket.on('performance_stop', () => {
      setPerformanceState({ active: false });
    });

    socket.on('performance_state', (state) => {
      setPerformanceState(state);
      if (state.key) setConductorKey(state.key);
    });

    socket.on('key_change', (key) => {
      setConductorKey(key);
    });

    socketRef.current = socket;
    return socket;
  }, []);

  const connect = useCallback(
    (nickname: string) => {
      const trimmed = nickname.trim();
      if (!trimmed) {
        setError('Please enter a nickname.');
        return;
      }
      const socket = ensureSocket();
      setError(null);
      setStatus('connecting');
      const role = joinRoleFromSearch(
        typeof window !== 'undefined' ? window.location.search : '',
      );

      const join = () => {
        socket.emit(
          'join',
          { nickname: trimmed, clientId: getOrCreateClientId(), role },
          (result) => {
            if (!result?.ok) {
              setStatus('error');
              setError(result?.error ?? 'Failed to join.');
              socket.disconnect();
              return;
            }
            void (async () => {
              try {
                const offset = await measureServerClockOffset(socket, 5);
                setServerClockOffsetMs(offset);
              } finally {
                setStatus('connected');
              }
            })();
          },
        );
      };

      if (socket.connected) {
        join();
      } else {
        socket.once('connect', join);
        socket.connect();
      }
    },
    [ensureSocket],
  );

  const setTempo = useCallback((bpm: number) => {
    socketRef.current?.emit('set_tempo', bpm);
  }, []);

  const setKey = useCallback((key: KeySetting) => {
    socketRef.current?.emit('set_key', key);
  }, []);

  const startPerformance = useCallback(() => {
    socketRef.current?.emit('start_performance');
  }, []);

  const stopPerformance = useCallback(() => {
    socketRef.current?.emit('stop_performance');
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(NICKNAME_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ROLE_STORAGE_KEY);
    setServerClockOffsetMs(0);
    socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (autoConnectAttemptedRef.current) {
      return;
    }
    const saved = localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (saved) {
      autoConnectAttemptedRef.current = true;
      connect(saved);
    }
  }, [connect]);

  useEffect(() => {
    if (status !== 'connected') return undefined;
    const sock = socketRef.current;
    if (!sock?.connected) return undefined;
    const id = window.setInterval(() => {
      void measureServerClockOffset(sock, 3).then((off) =>
        setServerClockOffsetMs(off),
      );
    }, SERVER_CLOCK_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    return () => {
      // Only disconnect if the socket has actually connected successfully.
      // In React Strict Mode, cleanup runs immediately after setup, before the
      // socket has time to connect. This flag ensures we don't disconnect prematurely.
      if (socketConnectedAtLeastOnceRef.current) {
        socketRef.current?.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return useMemo(
    () => ({
      status,
      error,
      self,
      users,
      conductorBpm,
      conductorKey,
      performanceState,
      serverClockOffsetMs,
      connect,
      disconnect,
      setTempo,
      setKey,
      startPerformance,
      stopPerformance,
    }),
    [
      status,
      error,
      self,
      users,
      conductorBpm,
      conductorKey,
      performanceState,
      serverClockOffsetMs,
      connect,
      disconnect,
      setTempo,
      setKey,
      startPerformance,
      stopPerformance,
    ],
  );
}
