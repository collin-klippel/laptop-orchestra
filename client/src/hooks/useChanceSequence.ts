import type { SynthesisScheduler } from 'aleatoric';
import { SeededRng } from 'aleatoric';
import { useContext, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { PerformanceContext } from '../App';
import type { ChanceSequenceConfig } from '../lib/chanceSequenceConfig';
import {
  buildChanceTimeline,
  createChanceScheduler,
  createMarimbaSynthesisAdapter,
  mixSeed,
  type ScheduledMarimbaNoteEvent,
} from '../lib/chanceSequencePlayback';
import { keySettingToScale } from '../lib/conductorScale';
import { getNextBeatOneContextSeconds } from '../lib/transportFirstBeat';
import type { MarimbaRig } from './useMarimba';
import { getOrCreateClientId } from './useSocket';

interface MarimbaAccess {
  ensureMarimbaRig: () => Promise<MarimbaRig>;
  getRig: () => MarimbaRig | null;
}

interface UseChanceSequenceOptions {
  onScheduledNote?: (e: ScheduledMarimbaNoteEvent) => void;
}

function hashClientId(seed: number): number {
  const s = getOrCreateClientId();
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- stable client salt
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  }
  return h ^ 1;
}

/**
 * Local aleatoric sequence when `launchGeneration` is incremented by the performer
 * while the conductor has started the performance. Shares the marimba rig with manual play.
 */
export function useChanceSequence(
  launchGeneration: number,
  marimba: MarimbaAccess,
  chanceConfig: ChanceSequenceConfig,
  options?: UseChanceSequenceOptions,
) {
  const { performanceState, conductorBpm, conductorKey } =
    useContext(PerformanceContext);
  const schedulerRef = useRef<SynthesisScheduler | null>(null);
  const { ensureMarimbaRig, getRig } = marimba;
  const onScheduledNote = options?.onScheduledNote;

  // biome-ignore lint/correctness/useExhaustiveDependencies: conductorKey?.root / conductorKey?.scaleType are intentional granular deps; the full object reference is irrelevant
  useEffect(() => {
    if (launchGeneration === 0 || !performanceState.active) {
      schedulerRef.current?.stop();
      schedulerRef.current = null;
      return;
    }

    let cancelled = false;
    let transportEventId: number | undefined;

    async function start() {
      await Tone.start();
      if (cancelled) return;
      await ensureMarimbaRig();
      if (cancelled) return;

      schedulerRef.current?.stop();
      schedulerRef.current = null;

      const bpm = conductorBpm ?? 100;
      const scale = keySettingToScale(conductorKey);
      const sessionStart = performanceState.startAt ?? 0;
      const generatedAt = Date.now();
      const rng = new SeededRng(
        mixSeed([
          sessionStart,
          generatedAt,
          launchGeneration,
          hashClientId(generatedAt),
        ]),
      );
      const timeline = buildChanceTimeline(scale, rng, chanceConfig);
      const adapter = createMarimbaSynthesisAdapter(
        () => getRig(),
        onScheduledNote,
      );
      const sched = createChanceScheduler(adapter, timeline, bpm);
      schedulerRef.current = sched;

      const transport = Tone.getTransport();
      if (transport.state !== 'started') {
        sched.play();
        return;
      }

      const ticksPerMeasure = transport.toTicks('1m') as number;
      const pos = transport.getTicksAtTime(transport.now()) as number;
      if (pos % ticksPerMeasure === 0) {
        sched.play();
        return;
      }

      const targetSec = getNextBeatOneContextSeconds(transport);
      const delaySec = Math.max(0.01, targetSec - transport.now());

      transportEventId = transport.scheduleOnce(() => {
        if (cancelled) return;
        sched.play();
      }, `+${delaySec}`);
    }

    void start();

    return () => {
      cancelled = true;
      const transport = Tone.getTransport();
      if (transportEventId !== undefined) {
        transport.clear(transportEventId);
      }
      schedulerRef.current?.stop();
      schedulerRef.current = null;
    };
  }, [
    chanceConfig,
    conductorBpm,
    conductorKey?.root,
    conductorKey?.scaleType,
    launchGeneration,
    ensureMarimbaRig,
    getRig,
    performanceState.active,
    performanceState.startAt,
    onScheduledNote,
  ]);

  useEffect(() => {
    const s = schedulerRef.current;
    if (!s || launchGeneration === 0 || !performanceState.active) return;
    s.setTempo(conductorBpm ?? 100);
  }, [conductorBpm, launchGeneration, performanceState.active]);
}
