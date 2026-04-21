type TransportStartSchedule =
  | {
      kind: 'atContextTime';
      contextStartTime: number;
      offsetSeconds: number;
    }
  | { kind: 'immediate'; offsetSeconds: number };

/**
 * Maps server `startAt` (epoch ms) to Tone.Transport.start arguments.
 * Pass `nowMs ≈ Date.now() + serverClockOffsetMs` so `"now"` aligns with the
 * server's epoch clock used when minting `startAt` (`clock_ping` handshake).
 *
 * When `startAt` is already at or before the aligned `now`, returns `immediate`
 * so `Transport.start(Tone.now(), offset)` runs — avoids a short future start
 * where `transport.state` stays `stopped` until that wall clock instant (which
 * breaks UI that polls `state === "started"`).
 */
export function transportScheduleFromStartAt(
  startAtMs: number,
  nowMs: number,
  contextCurrentTime: number,
): TransportStartSchedule {
  const untilStartSec = (startAtMs - nowMs) / 1000;
  if (untilStartSec > 0) {
    return {
      kind: 'atContextTime',
      contextStartTime: contextCurrentTime + untilStartSec,
      offsetSeconds: 0,
    };
  }
  return {
    kind: 'immediate',
    offsetSeconds: Math.max(0, (nowMs - startAtMs) / 1000),
  };
}
