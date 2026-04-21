import type { Scale } from 'aleatoric';
import {
  applyConstraints,
  generateChanceOps,
  RangeConstraint,
  ScaleConstraint,
  type ScheduledSynthesisNote,
  SeededRng,
  type SynthesisAdapter,
  SynthesisScheduler,
  Timeline,
} from 'aleatoric';
import * as Tone from 'tone';
import type { MarimbaRig } from '../hooks/useMarimba';
import {
  type ChanceSequenceConfig,
  DEFAULT_CHANCE_SEQUENCE_CONFIG,
  sanitizeChanceSequenceConfig,
} from './chanceSequenceConfig';

/** Build a seeded timeline of aleatoric events, constrained for the instrument. */
export function buildChanceTimeline(
  scale: Scale,
  rng: SeededRng,
  config?: ChanceSequenceConfig,
): Timeline {
  const c = sanitizeChanceSequenceConfig(
    config ?? DEFAULT_CHANCE_SEQUENCE_CONFIG,
  );

  const raw = generateChanceOps({
    count: c.eventCount,
    method: c.method,
    mapping: {
      pitchRange: [c.rangeMidi[0], c.rangeMidi[1]],
      durationRange: [c.durationRangeBeats[0], c.durationRangeBeats[1]],
      velocityRange: [c.velocityRange[0], c.velocityRange[1]],
      restProbability: c.restProbability,
    },
    rng,
  });

  const constrained = applyConstraints(raw, [
    new ScaleConstraint(scale),
    new RangeConstraint(c.rangeMidi[0], c.rangeMidi[1]),
  ]);

  return new Timeline(constrained).quantize(c.quantizeGridBeats);
}

/** XOR-mix seeds into a non-negative integer for {@link SeededRng}. */
export function mixSeed(parts: readonly number[]): number {
  let h = 0;
  for (const n of parts) {
    // eslint-disable-next-line no-bitwise -- deterministic mixing
    h = (Math.imul(31, h) + (n >>> 0)) >>> 0;
  }
  return h === 0 ? 1 : h;
}

export interface ScheduledMarimbaNoteEvent {
  midi: number;
  startTimeSec: number;
  durationSec: number;
}

export function createMarimbaSynthesisAdapter(
  getRig: () => MarimbaRig | null,
  onScheduledNote?: (e: ScheduledMarimbaNoteEvent) => void,
): SynthesisAdapter {
  return {
    schedule(note: ScheduledSynthesisNote) {
      const rig = getRig();
      if (!rig) return;
      const midi = Math.round(note.midi);
      if (midi < 0 || midi > 127) return;
      const name = Tone.Midi(midi).toNote();
      onScheduledNote?.({
        midi,
        startTimeSec: note.startTimeSec,
        durationSec: note.durationSec,
      });
      rig.synth.triggerAttackRelease(
        name,
        note.durationSec,
        note.startTimeSec,
        note.velocity / 127,
      );
    },

    cancelAll(atTimeSec: number) {
      const rig = getRig();
      if (!rig) return;
      rig.synth.triggerRelease(atTimeSec);
    },
  };
}

export function createChanceScheduler(
  adapter: SynthesisAdapter,
  timeline: Timeline,
  bpm: number,
): SynthesisScheduler {
  return new SynthesisScheduler(adapter, timeline, {
    bpm,
    loop: true,
    getAudioTime: () => Tone.now(),
  });
}
