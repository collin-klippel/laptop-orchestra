import type { PerformanceState } from '@laptop-orchestra/shared';
import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { transportScheduleFromStartAt } from '../lib/transportStartAt';

/**
 * Drives Tone.js Transport from server `performanceState`. When `startAt` is
 * set, the Transport is scheduled so all clients share the same phase (beat
 * counter) once running; when it is missing, starts immediately as a fallback.
 * BPM while running is updated by a separate effect below.
 * `serverClockOffsetMs` adjusts wall time toward the server's epoch timeline
 * (estimated via Cristian pings); read from a ref inside the Tone.start path
 * so offset updates mid-performance do **not** restart Transport.
 */
export function usePerformanceTransport(
  performanceState: PerformanceState,
  conductorBpm: number | null,
  serverClockOffsetMs = 0,
) {
  const clockOffsetMsRef = useRef(serverClockOffsetMs);
  clockOffsetMsRef.current = serverClockOffsetMs;

  // biome-ignore lint/correctness/useExhaustiveDependencies: BPM after start is handled by the effect below; including conductorBpm would restart transport on every tempo change
  useEffect(() => {
    const transport = Tone.getTransport();
    let cancelled = false;

    if (!performanceState.active) {
      transport.stop();
      return;
    }

    const startAt = performanceState.startAt;

    void Tone.start().then(() => {
      if (cancelled) return;
      if (conductorBpm != null) {
        transport.bpm.value = conductorBpm;
      }
      if (startAt == null) {
        transport.start();
        return;
      }
      const ctx = Tone.getContext();
      const nowMs = Date.now() + clockOffsetMsRef.current;
      const schedule = transportScheduleFromStartAt(
        startAt,
        nowMs,
        ctx.currentTime,
      );
      if (schedule.kind === 'immediate') {
        transport.start(Tone.now(), schedule.offsetSeconds);
      } else {
        transport.start(schedule.contextStartTime, schedule.offsetSeconds);
      }
    });

    return () => {
      cancelled = true;
      transport.stop();
    };
  }, [performanceState.active, performanceState.startAt]);

  useEffect(() => {
    if (performanceState.active && conductorBpm != null) {
      Tone.getTransport().bpm.value = conductorBpm;
    }
  }, [conductorBpm, performanceState.active]);
}
