import type {
  ClientToServerEvents,
  ClockPongPayload,
  ServerToClientEvents,
} from '@laptop-orchestra/shared';
import type { Socket } from 'socket.io-client';

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
export function trimmedMedian(samples: number[]): number {
  let use = [...samples].sort((a, b) => a - b);
  if (use.length >= 4) {
    use = use.slice(1, -1);
  }
  return Math.round(median(use));
}

export const CLOCK_PROBE_TIMEOUT_MS = Number(
  import.meta.env.VITE_CLOCK_PROBE_TIMEOUT_MS ?? 3500,
);

export function probeClockOffsetOnce(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  timeoutMs = CLOCK_PROBE_TIMEOUT_MS,
): Promise<number | null> {
  return new Promise((resolve) => {
    const deadline = window.setTimeout(() => {
      resolve(null);
    }, timeoutMs);

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

export async function measureServerClockOffset(
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
