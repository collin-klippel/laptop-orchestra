import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type {
  ClientToServerEvents,
  InterServerEvents,
  KeySetting,
  PerformanceState,
  Role,
  ServerToClientEvents,
  SocketData,
  User,
} from '@laptop-orchestra/shared';
import { MAX_NICKNAME_LENGTH } from '@laptop-orchestra/shared';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { Presence } from './presence.js';

interface AppInstance {
  httpServer: ReturnType<typeof createServer>;
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
}

export function createApp(
  clientOrigin = 'http://localhost:5173',
  startLeadMs = 2000,
): AppInstance {
  const app = express();
  app.use(cors({ origin: clientOrigin }));

  const presence = new Presence();

  let performanceState: PerformanceState = { active: false };
  let currentKey: KeySetting | null = null;
  let currentBpm: number | null = null;
  let metronomeEnabled = false;
  let countInBeats = 0;
  let lockMode = false;
  let performerStates: Record<
    string,
    {
      muted?: boolean;
      solo?: boolean;
    }
  > = {};

  interface Session {
    nickname: string;
    joinedAt: number;
  }
  const sessions = new Map<string, Session>(); // clientId → Session

  function sanitizeNickname(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().slice(0, MAX_NICKNAME_LENGTH);
    return trimmed.length > 0 ? trimmed : null;
  }

  function hasConductor(): boolean {
    return presence.list().some((u) => u.role === 'conductor');
  }

  function resetPerformance() {
    performanceState = { active: false };
    currentKey = null;
    currentBpm = null;
    metronomeEnabled = false;
    countInBeats = 0;
    lockMode = false;
    performerStates = {};
    io.emit('performance_stop');
  }

  const httpServer = createServer(
    app as unknown as (req: IncomingMessage, res: ServerResponse) => void,
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, online: presence.size() });
  });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: clientOrigin },
  });

  io.on('connection', (socket) => {
    socket.on('clock_ping', (payload, ack) => {
      if (!ack) return;
      const clientSend =
        typeof payload?.clientSendEpochMs === 'number'
          ? payload.clientSendEpochMs
          : Date.now();
      ack({
        serverNowEpochMs: Date.now(),
        clientSendEpochMs: clientSend,
      });
    });

    socket.on('join', (payload, ack) => {
      const nickname = sanitizeNickname(payload?.nickname);
      const { clientId } = payload ?? {};
      let role: Role =
        payload?.role === 'conductor' ? 'conductor' : 'performer';

      if (!nickname || typeof clientId !== 'string' || clientId.trim() === '') {
        ack?.({ ok: false, error: 'Nickname must be a non-empty string.' });
        return;
      }

      // Enforce at most one conductor at a time — auto-downgrade if one exists.
      if (role === 'conductor' && hasConductor()) {
        role = 'performer';
      }

      const existing = sessions.get(clientId);
      const joinedAt = existing?.joinedAt ?? Date.now();
      sessions.set(clientId, { nickname, joinedAt });

      const user: User = { id: clientId, nickname, joinedAt, role };
      socket.data.user = user;
      presence.add(socket.id, user);

      ack?.({ ok: true });
      socket.emit('welcome', user);
      // Send current performance state (including key and BPM) so late joiners are in sync.
      const stateForJoiner: PerformanceState = {
        ...performanceState,
        ...(currentKey ? { key: currentKey } : {}),
        ...(currentBpm != null ? { bpm: currentBpm } : {}),
        ...(metronomeEnabled ? { metronomeEnabled } : {}),
        ...(countInBeats > 0 ? { countInBeats } : {}),
        ...(lockMode ? { lockMode } : {}),
        ...(Object.keys(performerStates).length > 0 ? { performerStates } : {}),
      };
      socket.emit('performance_state', stateForJoiner);
      io.emit('users', presence.list());
    });

    socket.on('set_tempo', (bpm) => {
      if (socket.data.user?.role !== 'conductor') return;
      if (lockMode) return;
      if (typeof bpm !== 'number' || bpm < 20 || bpm > 300) return;
      currentBpm = bpm;
      io.emit('tempo_change', bpm);
    });

    socket.on('start_performance', () => {
      if (socket.data.user?.role !== 'conductor') return;
      const startAt = Date.now() + startLeadMs;
      performanceState = { active: true, startAt };
      io.emit('performance_start', startAt);
    });

    socket.on('stop_performance', () => {
      if (socket.data.user?.role !== 'conductor') return;
      performanceState = { active: false };
      currentBpm = null;
      io.emit('performance_stop');
    });

    socket.on('set_key', (key) => {
      if (socket.data.user?.role !== 'conductor') return;
      if (lockMode) return;
      if (typeof key?.root !== 'string' || typeof key?.scaleType !== 'string')
        return;
      currentKey = key;
      io.emit('key_change', key);
    });

    socket.on('set_metronome', (enabled) => {
      if (socket.data.user?.role !== 'conductor') return;
      if (lockMode) return;
      if (typeof enabled !== 'boolean') return;
      metronomeEnabled = enabled;
      io.emit('metronome_change', enabled);
    });

    socket.on('set_count_in', (beats) => {
      if (socket.data.user?.role !== 'conductor') return;
      if (lockMode) return;
      if (typeof beats !== 'number' || beats < 0 || !Number.isInteger(beats))
        return;
      countInBeats = beats;
      io.emit('count_in_change', beats);
    });

    socket.on('set_performer_mute', (performerId, muted) => {
      if (socket.data.user?.role !== 'conductor') return;
      if (typeof performerId !== 'string' || typeof muted !== 'boolean') return;
      if (!performerStates[performerId]) {
        performerStates[performerId] = {};
      }
      performerStates[performerId].muted = muted;
      io.emit('performer_mute_change', performerId, muted);
    });

    socket.on('set_performer_solo', (performerId, solo) => {
      if (socket.data.user?.role !== 'conductor') return;
      if (typeof performerId !== 'string' || typeof solo !== 'boolean') return;
      if (!performerStates[performerId]) {
        performerStates[performerId] = {};
      }
      performerStates[performerId].solo = solo;
      io.emit('performer_solo_change', performerId, solo);
    });

    socket.on('set_lock_mode', (locked) => {
      if (socket.data.user?.role !== 'conductor') return;
      if (typeof locked !== 'boolean') return;
      lockMode = locked;
      io.emit('lock_mode_change', locked);
    });

    socket.on('disconnect', (_reason) => {
      const removed = presence.remove(socket.id);
      if (removed) {
        sessions.delete(removed.id);

        if (removed.role === 'conductor' && performanceState.active) {
          resetPerformance();
        }

        io.emit('users', presence.list());
      }
    });
  });

  return { httpServer, io };
}
