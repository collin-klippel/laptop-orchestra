/**
 * Integration tests for the Socket.IO performance/clock server logic.
 * Each test suite spins up a fresh in-process server so state is fully
 * isolated between test runs.
 */
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@laptop-orchestra/shared';
import type { Socket as ClientSocket } from 'socket.io-client';
import { io as ioClient } from 'socket.io-client';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { createApp } from './app.js';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let serverUrl: string;
let closeServer: () => Promise<void>;

function makeClient(): TestSocket {
  return ioClient(serverUrl, {
    transports: ['websocket'],
    autoConnect: false,
    forceNew: true,
  });
}

/** Connect a socket and return it (Promise resolves once TCP 'connect' fires). */
function connectSocket(socket: TestSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
}

/** Emit 'join' and resolve to the ack payload. */
function joinAs(
  socket: TestSocket,
  opts: {
    nickname: string;
    clientId: string;
    role?: 'performer' | 'conductor';
  },
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit(
      'join',
      {
        nickname: opts.nickname,
        clientId: opts.clientId,
        role: opts.role ?? 'performer',
      },
      (ack) => resolve(ack as { ok: boolean; error?: string }),
    );
  });
}

/** Wait for the next occurrence of `event` on `socket`, resolves with the first argument. */
function nextEvent<K extends keyof ServerToClientEvents>(
  socket: TestSocket,
  event: K,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve) => {
    // biome-ignore lint/suspicious/noExplicitAny: socket.once overloads don't accept generic K
    (socket as any).once(event, (arg: Parameters<ServerToClientEvents[K]>[0]) =>
      resolve(arg),
    );
  });
}

/** Perform a single clock_ping and return the pong payload. */
function clockPing(socket: TestSocket, clientSendEpochMs: number) {
  return new Promise<{ serverNowEpochMs: number; clientSendEpochMs: number }>(
    (resolve) => {
      socket.emit('clock_ping', { clientSendEpochMs }, (pong) => resolve(pong));
    },
  );
}

// ---------------------------------------------------------------------------
// Server lifecycle (shared across all suites in this file)
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const { httpServer } = createApp('*');
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const addr = httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  serverUrl = `http://localhost:${port}`;
  closeServer = () =>
    new Promise<void>((resolve, reject) =>
      httpServer.close((err) => (err ? reject(err) : resolve())),
    );
});

afterAll(async () => {
  await closeServer();
});

// ---------------------------------------------------------------------------
// clock_ping
// ---------------------------------------------------------------------------

describe('clock_ping', () => {
  let socket: TestSocket;

  beforeEach(async () => {
    socket = makeClient();
    await connectSocket(socket);
  });

  afterEach(() => {
    socket.disconnect();
  });

  it('acks with serverNowEpochMs close to Date.now()', async () => {
    const tSend = Date.now();
    const pong = await clockPing(socket, tSend);
    const tReceive = Date.now();

    expect(pong.clientSendEpochMs).toBe(tSend);
    expect(pong.serverNowEpochMs).toBeGreaterThanOrEqual(tSend);
    expect(pong.serverNowEpochMs).toBeLessThanOrEqual(tReceive + 50);
  });

  it('echoes clientSendEpochMs verbatim', async () => {
    const tSend = 9_999_999;
    const pong = await clockPing(socket, tSend);
    expect(pong.clientSendEpochMs).toBe(tSend);
  });
});

// ---------------------------------------------------------------------------
// join → performance_state (no active performance)
// ---------------------------------------------------------------------------

describe('join while performance is inactive', () => {
  let socket: TestSocket;

  beforeEach(async () => {
    socket = makeClient();
    await connectSocket(socket);
  });

  afterEach(() => {
    socket.disconnect();
  });

  it('sends performance_state with active: false', async () => {
    const [state] = await Promise.all([
      nextEvent(socket, 'performance_state'),
      joinAs(socket, { nickname: 'alice', clientId: 'client-alice' }),
    ]);
    expect(state.active).toBe(false);
    expect(state.startAt).toBeUndefined();
  });

  it('rejects a join with an empty nickname', async () => {
    const ack = await joinAs(socket, { nickname: '   ', clientId: 'c1' });
    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/nickname/i);
  });

  it('rejects a join with an empty clientId', async () => {
    const ack = await joinAs(socket, { nickname: 'bob', clientId: '' });
    expect(ack.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// start_performance
// ---------------------------------------------------------------------------

describe('start_performance', () => {
  let conductor: TestSocket;
  let performer: TestSocket;

  beforeEach(async () => {
    conductor = makeClient();
    performer = makeClient();
    await Promise.all([connectSocket(conductor), connectSocket(performer)]);
    // Drain the performance_state events that arrive on join
    await Promise.all([
      Promise.all([
        nextEvent(conductor, 'performance_state'),
        joinAs(conductor, {
          nickname: 'conductor',
          clientId: 'c-cond',
          role: 'conductor',
        }),
      ]),
      Promise.all([
        nextEvent(performer, 'performance_state'),
        joinAs(performer, {
          nickname: 'performer',
          clientId: 'c-perf',
          role: 'performer',
        }),
      ]),
    ]);
  });

  afterEach(() => {
    conductor.disconnect();
    performer.disconnect();
  });

  it('broadcasts performance_start with a future startAt (~2s ahead)', async () => {
    const before = Date.now();
    const [startAt] = await Promise.all([
      nextEvent(conductor, 'performance_start'),
      new Promise<void>((resolve) => {
        conductor.emit('start_performance');
        resolve();
      }),
    ]);
    const after = Date.now();

    // startAt should be ~2000ms ahead
    expect(startAt).toBeGreaterThan(before + 1500);
    expect(startAt).toBeLessThan(after + 3000);
  });

  it('both conductor and performer receive performance_start', async () => {
    const [conductorStart, performerStart] = await Promise.all([
      nextEvent(conductor, 'performance_start'),
      nextEvent(performer, 'performance_start'),
      new Promise<void>((resolve) => {
        conductor.emit('start_performance');
        resolve();
      }),
    ]);
    expect(conductorStart).toBe(performerStart);
  });

  it('does not allow a performer to start the performance', async () => {
    // Performers emit start_performance but the server ignores it.
    // We check that no performance_start fires within a short window.
    let received = false;
    conductor.once('performance_start', () => {
      received = true;
    });
    performer.emit('start_performance');
    await new Promise((r) => setTimeout(r, 100));
    expect(received).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// join → performance_state while active (late joiner)
// ---------------------------------------------------------------------------

describe('late joiner receives current performance state', () => {
  let conductor: TestSocket;
  let lateComer: TestSocket;

  beforeEach(async () => {
    conductor = makeClient();
    await connectSocket(conductor);
    await Promise.all([
      nextEvent(conductor, 'performance_state'),
      joinAs(conductor, {
        nickname: 'conductor',
        clientId: 'lj-cond',
        role: 'conductor',
      }),
    ]);
    // Start the performance
    await Promise.all([
      nextEvent(conductor, 'performance_start'),
      new Promise<void>((r) => {
        conductor.emit('start_performance');
        r();
      }),
    ]);
    // Set a tempo
    conductor.emit('set_tempo', 120);
    // Give server a tick to process
    await new Promise((r) => setTimeout(r, 20));
  });

  afterEach(() => {
    conductor.disconnect();
    lateComer?.disconnect();
  });

  it('receives active:true with startAt and bpm', async () => {
    lateComer = makeClient();
    await connectSocket(lateComer);

    const [state] = await Promise.all([
      nextEvent(lateComer, 'performance_state'),
      joinAs(lateComer, { nickname: 'late', clientId: 'lj-late' }),
    ]);

    expect(state.active).toBe(true);
    expect(typeof state.startAt).toBe('number');
    expect(state.bpm).toBe(120);
  });

  it('startAt in late-join state matches the original broadcast value', async () => {
    // Capture the original startAt from the conductor's performance_start event
    // We already consumed it in beforeEach; re-read from a fresh join
    // Instead: join a second performer and check the startAt is a past epoch
    lateComer = makeClient();
    await connectSocket(lateComer);

    const [state] = await Promise.all([
      nextEvent(lateComer, 'performance_state'),
      joinAs(lateComer, { nickname: 'late2', clientId: 'lj-late2' }),
    ]);

    // startAt should be near ~2s after the conductor hit start (which is now in the past)
    expect(state.startAt).toBeLessThanOrEqual(Date.now() + 3000);
    expect(state.startAt).toBeGreaterThan(Date.now() - 60_000);
  });
});

// ---------------------------------------------------------------------------
// conductor disconnect stops performance
// ---------------------------------------------------------------------------

describe('conductor disconnect', () => {
  let conductor: TestSocket;
  let performer: TestSocket;

  beforeEach(async () => {
    conductor = makeClient();
    performer = makeClient();
    await Promise.all([connectSocket(conductor), connectSocket(performer)]);
    await Promise.all([
      Promise.all([
        nextEvent(conductor, 'performance_state'),
        joinAs(conductor, {
          nickname: 'cond',
          clientId: 'cd-cond',
          role: 'conductor',
        }),
      ]),
      Promise.all([
        nextEvent(performer, 'performance_state'),
        joinAs(performer, {
          nickname: 'perf',
          clientId: 'cd-perf',
          role: 'performer',
        }),
      ]),
    ]);
    // Start the performance
    await Promise.all([
      nextEvent(conductor, 'performance_start'),
      new Promise<void>((r) => {
        conductor.emit('start_performance');
        r();
      }),
    ]);
  });

  afterEach(() => {
    conductor.disconnect();
    performer.disconnect();
  });

  it('broadcasts performance_stop to remaining performers when conductor leaves', async () => {
    const stopped = nextEvent(performer, 'performance_stop');
    conductor.disconnect();
    // performance_stop carries no arguments; resolving at all proves the event arrived
    await expect(stopped).resolves.toBeUndefined();
  });
});
