import * as Tone from 'tone';

type TransportInstance = ReturnType<typeof Tone.getTransport>;

/**
 * Returns the Tone AudioContext clock time (`transport.now()` / context seconds)
 * for the **next occurrence of beat 1** of the bar — i.e. the next downbeat.
 *
 * Uses the same `"1m"` grid as cymbal/percussion loops. If Transport is already
 * on a measure boundary, returns `transport.now()` (this downbeat).
 *
 * Call only when Transport `state` is `"started"`; callers should handle
 * `"stopped"` / `"paused"` separately.
 */
export function getNextBeatOneContextSeconds(
  transport: TransportInstance,
): number {
  const now = transport.now();
  const ticksPerMeasure = transport.toTicks('1m') as number;
  const transportPos = transport.getTicksAtTime(now) as number;
  const remainder = transportPos % ticksPerMeasure;

  // On beat 1 exactly: Tone's nextSubdivision("1m") skips forward a full measure;
  // we want playback to start now.
  if (remainder === 0) {
    return now;
  }

  return transport.nextSubdivision('1m');
}
