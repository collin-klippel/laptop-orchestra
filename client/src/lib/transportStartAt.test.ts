import { describe, expect, it } from 'vitest';
import { transportScheduleFromStartAt } from './transportStartAt';

describe('transportScheduleFromStartAt', () => {
  it('schedules a future start with zero offset', () => {
    const nowMs = 1_000_000;
    const startAtMs = nowMs + 2000;
    const ctxT = 12.5;
    expect(transportScheduleFromStartAt(startAtMs, nowMs, ctxT)).toEqual({
      kind: 'atContextTime',
      contextStartTime: ctxT + 2,
      offsetSeconds: 0,
    });
  });

  it('uses immediate start and positive offset when startAt is in the past', () => {
    const startAtMs = 1_000_000;
    const nowMs = startAtMs + 5000;
    const ctxT = 8;
    expect(transportScheduleFromStartAt(startAtMs, nowMs, ctxT)).toEqual({
      kind: 'immediate',
      offsetSeconds: 5,
    });
  });

  it('treats startAt === now as immediate with zero offset', () => {
    const t = 99;
    expect(transportScheduleFromStartAt(t, t, 3)).toEqual({
      kind: 'immediate',
      offsetSeconds: 0,
    });
  });

  it('treats injected nowMs as server-aligned clock (skew correction upstream)', () => {
    const ctxT = 2;
    const startAtMs = 10_000;
    // Simulates Date.now()+offset where skew makes effective now trail wall clock
    const nowMsAlignedToServerTimeline = startAtMs - 3000;
    expect(
      transportScheduleFromStartAt(
        startAtMs,
        nowMsAlignedToServerTimeline,
        ctxT,
      ),
    ).toEqual({
      kind: 'atContextTime',
      contextStartTime: ctxT + 3,
      offsetSeconds: 0,
    });
  });
});
