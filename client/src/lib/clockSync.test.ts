import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOCK_PROBE_TIMEOUT_MS,
  measureServerClockOffset,
  probeClockOffsetOnce,
  trimmedMedian,
} from './clockSync';

// ---------------------------------------------------------------------------
// trimmedMedian
// ---------------------------------------------------------------------------

describe('trimmedMedian', () => {
  it('returns 0 for an empty array', () => {
    expect(trimmedMedian([])).toBe(0);
  });

  it('returns the single value for a one-element array', () => {
    expect(trimmedMedian([42])).toBe(42);
  });

  it('returns median of two elements', () => {
    expect(trimmedMedian([10, 20])).toBe(15);
  });

  it('returns median of three elements (no trimming)', () => {
    // [1, 5, 9] → median = 5, no trim because length < 4
    expect(trimmedMedian([9, 1, 5])).toBe(5);
  });

  it('trims one min and one max when length >= 4 before computing median', () => {
    // [1, 10, 10, 100] → trim outer → [10, 10] → median = 10
    expect(trimmedMedian([100, 10, 1, 10])).toBe(10);
  });

  it('rejects outliers in a 5-sample array', () => {
    // [1, 10, 10, 10, 999] → trim → [10, 10, 10] → median = 10
    expect(trimmedMedian([10, 10, 999, 1, 10])).toBe(10);
  });

  it('rounds the result to the nearest integer', () => {
    // [2, 3] → median = 2.5 → rounds to 3 (Math.round)
    expect(trimmedMedian([2, 3])).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// probeClockOffsetOnce
// ---------------------------------------------------------------------------

type MockEmitFn = ReturnType<typeof vi.fn>;

function makeMockSocket(emitImpl?: MockEmitFn) {
  return { emit: emitImpl ?? vi.fn() } as unknown as Parameters<
    typeof probeClockOffsetOnce
  >[0];
}

describe('probeClockOffsetOnce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes the Cristian offset on a well-formed pong', async () => {
    // tSend = 1000, server receives at 1010, tReceive = 1020
    // offset = 1010 - (1000 + 1020)/2 = 1010 - 1010 = 0
    const tSend = 1000;
    const serverNow = 1010;
    const tReceive = 1020;

    vi.setSystemTime(tSend);

    const socket = makeMockSocket(
      vi.fn((_event, _payload, ack) => {
        // Simulate server responding; advance time to tReceive
        vi.setSystemTime(tReceive);
        ack({ serverNowEpochMs: serverNow, clientSendEpochMs: tSend });
      }),
    );

    const result = await probeClockOffsetOnce(socket);
    expect(result).toBe(0);
  });

  it('returns a positive offset when server clock is ahead of client', async () => {
    // tSend=1000, serverNow=1100, tReceive=1010
    // offset = 1100 - (1000 + 1010)/2 = 1100 - 1005 = 95
    const tSend = 1000;
    const serverNow = 1100;
    const tReceive = 1010;

    vi.setSystemTime(tSend);

    const socket = makeMockSocket(
      vi.fn((_event, _payload, ack) => {
        vi.setSystemTime(tReceive);
        ack({ serverNowEpochMs: serverNow, clientSendEpochMs: tSend });
      }),
    );

    const result = await probeClockOffsetOnce(socket);
    expect(result).toBe(95);
  });

  it('returns null when the ack times out', async () => {
    const socket = makeMockSocket(vi.fn()); // emit does nothing (no ack)

    const promise = probeClockOffsetOnce(socket);
    await vi.advanceTimersByTimeAsync(CLOCK_PROBE_TIMEOUT_MS + 1);
    expect(await promise).toBeNull();
  });

  it('returns null when pong is missing serverNowEpochMs', async () => {
    vi.setSystemTime(1000);

    const socket = makeMockSocket(
      vi.fn((_event, _payload, ack) => {
        ack({ clientSendEpochMs: 1000 } as never);
      }),
    );

    const result = await probeClockOffsetOnce(socket);
    expect(result).toBeNull();
  });

  it('returns null when pong is missing clientSendEpochMs', async () => {
    vi.setSystemTime(1000);

    const socket = makeMockSocket(
      vi.fn((_event, _payload, ack) => {
        ack({ serverNowEpochMs: 1010 } as never);
      }),
    );

    const result = await probeClockOffsetOnce(socket);
    expect(result).toBeNull();
  });

  it('returns null when pong is undefined', async () => {
    vi.setSystemTime(1000);

    const socket = makeMockSocket(
      vi.fn((_event, _payload, ack) => {
        ack(undefined as never);
      }),
    );

    const result = await probeClockOffsetOnce(socket);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// measureServerClockOffset
// ---------------------------------------------------------------------------

describe('measureServerClockOffset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 when all probes time out', async () => {
    const socket = makeMockSocket(vi.fn()); // no ack ever fires

    const promise = measureServerClockOffset(socket, 3);
    // Advance past all probe timeouts
    await vi.advanceTimersByTimeAsync((CLOCK_PROBE_TIMEOUT_MS + 10) * 3);
    expect(await promise).toBe(0);
  });

  it('ignores null samples and computes median from valid ones', async () => {
    // Fix the fake clock so tSend is deterministic
    vi.setSystemTime(1000);
    let callCount = 0;

    const socket = makeMockSocket(
      vi.fn((_event, _payload: { clientSendEpochMs: number }, ack) => {
        callCount++;
        if (callCount === 1) {
          // tSend is from the payload; serverNow = tSend + 20 → offset = 20
          ack({
            serverNowEpochMs: _payload.clientSendEpochMs + 20,
            clientSendEpochMs: _payload.clientSendEpochMs,
          });
        } else if (callCount === 2) {
          // Probe 2: times out (no ack)
        } else {
          // Probe 3: same offset = 20 regardless of when it runs
          ack({
            serverNowEpochMs: _payload.clientSendEpochMs + 20,
            clientSendEpochMs: _payload.clientSendEpochMs,
          });
        }
      }),
    );

    // Run probe 1 (succeeds immediately), probe 2 (needs timeout), probe 3
    const promise = measureServerClockOffset(socket, 3);
    await vi.advanceTimersByTimeAsync(CLOCK_PROBE_TIMEOUT_MS + 10);
    expect(await promise).toBe(20);
  });

  it('uses trimmedMedian across multiple successful probes', async () => {
    // Five probes with offsets: 10, 10, 10, 10, 999 → trimmed → [10,10,10] → 10
    const offsets = [10, 10, 10, 10, 999];
    let idx = 0;

    vi.setSystemTime(1000);

    const socket = makeMockSocket(
      vi.fn((_event, _payload: { clientSendEpochMs: number }, ack) => {
        const off = offsets[idx++] ?? 0;
        // Use payload tSend so the offset formula yields `off` regardless of fake time
        ack({
          serverNowEpochMs: _payload.clientSendEpochMs + off,
          clientSendEpochMs: _payload.clientSendEpochMs,
        });
      }),
    );

    const result = await measureServerClockOffset(socket, 5);
    expect(result).toBe(10);
  });
});
