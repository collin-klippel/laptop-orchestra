import type { ChanceMethod, MidiNumber } from 'aleatoric';

/** User-tunable knobs for aleatoric `generateChanceOps` plus post-constraints / quantize. */
export interface ChanceSequenceConfig {
  method: ChanceMethod;
  /** `generateChanceOps` count */
  eventCount: number;
  /** MIDI window for random pitches (same bounds used for generation and post-clamp). */
  rangeMidi: [MidiNumber, MidiNumber];
  /** Beats — passed to Aleatoric duration range */
  durationRangeBeats: [number, number];
  velocityRange: [number, number];
  restProbability: number;
  /** Nearest-grid quantize duration in beats (e.g. 0.125 = ⅛ beat) */
  quantizeGridBeats: number;
}

/** Matches pre-config behavior in `chanceSequencePlayback` before user options. */
export const DEFAULT_CHANCE_SEQUENCE_CONFIG: ChanceSequenceConfig = {
  method: 'iching',
  eventCount: 48,
  rangeMidi: [56, 76],
  durationRangeBeats: [0.25, 1.5],
  velocityRange: [48, 110],
  restProbability: 0.22,
  quantizeGridBeats: 0.125,
};

function clampMidi(n: number): MidiNumber {
  return Math.max(0, Math.min(127, Math.round(n))) as MidiNumber;
}

/** Ensure ascending pair with sane separation. */
function orderedPair(lo: MidiNumber, hi: MidiNumber): [MidiNumber, MidiNumber] {
  let a = clampMidi(lo);
  let b = clampMidi(hi);
  if (a === b) {
    if (b < 127) b = (b + 1) as MidiNumber;
    else a = (a - 1) as MidiNumber;
  }
  return a < b ? [a, b] : [b, a];
}

/** Intersection of two ascending MIDI spans (saved configs may have mismatched nested ranges). */
function intersectMidiSpans(
  r: [MidiNumber, MidiNumber],
  p: [MidiNumber, MidiNumber],
): [MidiNumber, MidiNumber] {
  const [r0, r1] = orderedPair(...r);
  const [p0, p1] = orderedPair(...p);
  return orderedPair(Math.max(r0, p0), Math.min(r1, p1));
}

/**
 * Old saves had both `rangeMidi` and `pitchRangeMidi`. Collapse into a single `rangeMidi`
 * (~ previous intersection).
 */
function migrateLegacyStoredChance(
  raw: Record<string, unknown>,
): Partial<ChanceSequenceConfig> {
  const { pitchRangeMidi: _drop, ...rest } = raw;
  if (!Array.isArray(raw.pitchRangeMidi) || raw.pitchRangeMidi.length < 2) {
    return rest as Partial<ChanceSequenceConfig>;
  }
  const pr = raw.pitchRangeMidi as unknown[];
  const pLo = Number(pr[0]);
  const pHi = Number(pr[1]);
  if (!Number.isFinite(pLo) || !Number.isFinite(pHi)) {
    return rest as Partial<ChanceSequenceConfig>;
  }
  if (Array.isArray(raw.rangeMidi) && raw.rangeMidi.length >= 2) {
    const rg = raw.rangeMidi as unknown[];
    const rng = intersectMidiSpans(
      [rg[0] as number, rg[1] as number],
      [pLo, pHi],
    );
    return { ...(rest as Partial<ChanceSequenceConfig>), rangeMidi: rng };
  }
  /* Legacy: only melody stored — adopt as the single range */
  return {
    ...(rest as Partial<ChanceSequenceConfig>),
    rangeMidi: orderedPair(pLo as MidiNumber, pHi as MidiNumber),
  };
}

/**
 * Clamp and coerce config so generators never see invalid payloads.
 */
export function sanitizeChanceSequenceConfig(
  partial: Partial<ChanceSequenceConfig> | null | undefined,
): ChanceSequenceConfig {
  const base = { ...DEFAULT_CHANCE_SEQUENCE_CONFIG, ...partial };

  let method = base.method;
  if (method !== 'coin' && method !== 'iching' && method !== 'random') {
    method = DEFAULT_CHANCE_SEQUENCE_CONFIG.method;
  }

  let eventCount = Math.round(base.eventCount);
  eventCount = Math.max(8, Math.min(96, eventCount));
  eventCount = Math.round(eventCount / 4) * 4;

  let rangeMidi = orderedPair(...base.rangeMidi);

  /** Narrow spans make every roll land on almost the same pitch; widen to ≥12 centered in 0..127. */
  const MELODY_MIN_SPAN_SEMITONES = 12;
  const span = rangeMidi[1] - rangeMidi[0];
  if (span < MELODY_MIN_SPAN_SEMITONES) {
    const mid = Math.round((rangeMidi[0] + rangeMidi[1]) / 2);
    let lo = mid - Math.floor(MELODY_MIN_SPAN_SEMITONES / 2);
    let hi = lo + MELODY_MIN_SPAN_SEMITONES;
    if (lo < 0) {
      lo = 0;
      hi = MELODY_MIN_SPAN_SEMITONES;
    }
    if (hi > 127) {
      hi = 127;
      lo = Math.max(0, hi - MELODY_MIN_SPAN_SEMITONES);
    }
    rangeMidi = orderedPair(lo, hi);
  }

  const durLow = Math.max(0.0625, Math.min(8, base.durationRangeBeats[0]));
  const durHi = Math.max(0.0625, Math.min(8, base.durationRangeBeats[1]));
  const durationRangeBeats =
    durLow < durHi
      ? ([durLow, durHi] as [number, number])
      : ([durHi, durLow] as [number, number]);

  const velLow = clampMidi(base.velocityRange[0]);
  const velHi = clampMidi(base.velocityRange[1]);
  const velocityRange =
    velLow <= velHi
      ? ([velLow, velHi] as [number, number])
      : ([velHi, velLow] as [number, number]);

  const restProbability = Math.max(0, Math.min(0.6, base.restProbability));

  const allowedGrids = [1 / 4, 1 / 8, 1 / 16, 1 / 32] as const;
  let qb = Number(base.quantizeGridBeats);
  if (!Number.isFinite(qb))
    qb = DEFAULT_CHANCE_SEQUENCE_CONFIG.quantizeGridBeats;
  const nearest = allowedGrids.reduce(
    (a, g) => (Math.abs(g - qb) < Math.abs(a - qb) ? g : a),
    allowedGrids[1],
  );

  return {
    method,
    eventCount,
    rangeMidi,
    durationRangeBeats,
    velocityRange,
    restProbability,
    quantizeGridBeats: nearest,
  };
}

export const CHANCE_SEQUENCE_STORAGE_KEY = 'laptop-orchestra:chanceSeq';

/** Load from `localStorage` JSON or defaults. */
export function parseStoredChanceSequenceConfig(
  raw: string | null,
): ChanceSequenceConfig {
  if (!raw) return sanitizeChanceSequenceConfig({});
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null)
      return sanitizeChanceSequenceConfig({});
    const migrated = migrateLegacyStoredChance(
      parsed as Record<string, unknown>,
    );
    return sanitizeChanceSequenceConfig(migrated);
  } catch {
    return sanitizeChanceSequenceConfig({});
  }
}
