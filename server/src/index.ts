import { createServer } from 'node:http';
import {
  type ClientToServerEvents,
  type InterServerEvents,
  type KeySetting,
  MAX_NICKNAME_LENGTH,
  type PerformanceState,
  type Role,
  type ServerToClientEvents,
  type SocketData,
  type User,
} from '@laptop-orchestra/shared';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { Presence } from './presence.js';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, online: presence.size() });
});

const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

const presence = new Presence();

let performanceState: PerformanceState = { active: false };
let currentKey: KeySetting | null = null;

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
  io.emit('performance_stop');
}

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
    let role: Role = payload?.role === 'conductor' ? 'conductor' : 'performer';

    if (!nickname || typeof clientId !== 'string' || clientId.trim() === '') {
      ack?.({ ok: false, error: 'Nickname must be a non-empty string.' });
      return;
    }

    // Enforce at most one conductor at a time — auto-downgrade if one exists.
    if (role === 'conductor' && hasConductor()) {
      role = 'performer';
      console.log(
        `[join] ${nickname} wanted conductor but one exists — downgraded to performer`,
      );
    }

    const existing = sessions.get(clientId);
    const joinedAt = existing?.joinedAt ?? Date.now();
    sessions.set(clientId, { nickname, joinedAt });

    const user: User = { id: clientId, nickname, joinedAt, role };
    socket.data.user = user;
    presence.add(socket.id, user);

    ack?.({ ok: true });
    socket.emit('welcome', user);
    // Send current performance state (including key) so late joiners are in sync.
    const stateForJoiner: PerformanceState = {
      ...performanceState,
      ...(currentKey ? { key: currentKey } : {}),
    };
    socket.emit('performance_state', stateForJoiner);
    io.emit('users', presence.list());
    console.log(
      `[join] ${user.nickname} (${user.id}) as ${role} — ${presence.size()} online`,
    );
  });

  socket.on('set_tempo', (bpm) => {
    if (socket.data.user?.role !== 'conductor') return;
    if (typeof bpm !== 'number' || bpm < 20 || bpm > 300) return;
    io.emit('tempo_change', bpm);
    console.log(`[tempo] conductor set BPM to ${bpm}`);
  });

  socket.on('start_performance', () => {
    if (socket.data.user?.role !== 'conductor') return;
    /**
     * Mint a future timestamp so every client can schedule their Tone transport
     * at the same AudioContext time before the beat fires. 2 s is generous enough
     * to cover round-trip delivery + AudioContext unlock on any performer device.
     * Late joiners still sync via the `immediate + offsetSeconds` fallback in
     * `transportScheduleFromStartAt`.
     */
    const START_LEAD_MS = 2000;
    const startAt = Date.now() + START_LEAD_MS;
    performanceState = { active: true, startAt };
    io.emit('performance_start', startAt);
    console.log(
      `[performance] started — startAt ${new Date(startAt).toISOString()}`,
    );
  });

  socket.on('stop_performance', () => {
    if (socket.data.user?.role !== 'conductor') return;
    performanceState = { active: false };
    io.emit('performance_stop');
    console.log('[performance] stopped by conductor');
  });

  socket.on('set_key', (key) => {
    if (socket.data.user?.role !== 'conductor') return;
    if (typeof key?.root !== 'string' || typeof key?.scaleType !== 'string')
      return;
    currentKey = key;
    io.emit('key_change', key);
    console.log(`[key] conductor set key to ${key.root} ${key.scaleType}`);
  });

  socket.on('disconnect', (reason) => {
    const removed = presence.remove(socket.id);
    if (removed) {
      sessions.delete(removed.id);

      // If the conductor left, stop the performance for everyone.
      if (removed.role === 'conductor' && performanceState.active) {
        resetPerformance();
        console.log(
          '[performance] conductor disconnected — performance stopped',
        );
      }

      io.emit('users', presence.list());
      console.log(
        `[leave] ${removed.nickname} (${removed.id}) — ${reason} — ${presence.size()} online`,
      );
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`laptop-orchestra server listening on http://localhost:${PORT}`);
  console.log(`accepting client connections from ${CLIENT_ORIGIN}`);
});
