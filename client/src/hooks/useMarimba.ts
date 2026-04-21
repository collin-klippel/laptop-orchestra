import { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';

/** Mono {@link Tone.FMSynth} or multi-voice wrapper for overlapping notes. */
type MarimbaSynth = Tone.FMSynth | Tone.PolySynth<Tone.FMSynth>;

export interface MarimbaRig {
  synth: MarimbaSynth;
  /** Pass-through analyzer; after delay + reverb, before destination. */
  waveform: Tone.Waveform;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
}

/** Subdivision of a quarter note for synced delay (follows Transport BPM). */
export type MarimbaDelayTime = '4n' | '8n' | '16n';

export interface MarimbaEffects {
  delayTime: MarimbaDelayTime;
  delayFeedback: number;
  delayWet: number;
  reverbDecay: number;
  reverbWet: number;
}

export interface MarimbaEnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface MarimbaVoice {
  envelope: MarimbaEnvelope;
}

/** Partial update for UI controls (one ADSR field at a time). */
export type MarimbaVoicePatch = {
  envelope?: Partial<MarimbaEnvelope>;
};

/** FM modulation depth over time; fixed in the synth, not exposed in the UI. */
const MARIMBA_SYNTH_MODULATION_ENVELOPE: MarimbaEnvelope = {
  attack: 0.002,
  decay: 0.2,
  sustain: 0,
  release: 0.1,
};

/** Max simultaneous notes in poly mode (voice stealing when exceeded). */
export const MARIMBA_MAX_POLYPHONY = 16;

export const MARIMBA_EFFECTS_DEFAULTS: MarimbaEffects = {
  delayTime: '8n',
  delayFeedback: 0.28,
  delayWet: 0.2,
  reverbDecay: 0.8,
  reverbWet: 0.2,
};

export const MARIMBA_VOICE_DEFAULTS: MarimbaVoice = {
  envelope: { attack: 0.001, decay: 0.4, sustain: 0.05, release: 0.3 },
};

function fmVoiceOptions(voice: MarimbaVoice) {
  return {
    harmonicity: 1,
    modulationIndex: 2,
    oscillator: { type: 'sine' as const },
    envelope: { ...voice.envelope },
    modulation: { type: 'triangle' as const },
    modulationEnvelope: { ...MARIMBA_SYNTH_MODULATION_ENVELOPE },
    volume: -8,
  };
}

function createMarimbaSynth(
  polyphonic: boolean,
  voice: MarimbaVoice,
): MarimbaSynth {
  const opts = fmVoiceOptions(voice);
  if (!polyphonic) {
    return new Tone.FMSynth(opts);
  }
  return new Tone.PolySynth({
    maxPolyphony: MARIMBA_MAX_POLYPHONY,
    voice: Tone.FMSynth,
    options: opts,
  });
}

function buildRig(
  d: MarimbaEffects,
  voice: MarimbaVoice,
  polyphonic: boolean,
): MarimbaRig {
  const synth = createMarimbaSynth(polyphonic, voice);
  const delay = new Tone.FeedbackDelay({
    delayTime: d.delayTime,
    feedback: d.delayFeedback,
    wet: d.delayWet,
  });
  const reverb = new Tone.Reverb({ decay: d.reverbDecay, wet: d.reverbWet });
  const waveform = new Tone.Waveform(1024);
  synth.chain(delay, reverb, waveform, Tone.getDestination());
  return { synth, waveform, delay, reverb };
}

function disposeRig(rig: MarimbaRig) {
  rig.synth.dispose();
  rig.waveform.dispose();
  rig.delay.dispose();
  rig.reverb.dispose();
}

function applyEffectsToRig(
  rig: MarimbaRig,
  e: MarimbaEffects,
  lastReverbDecayRef: { current: number | null },
) {
  rig.delay.set({
    delayTime: e.delayTime,
    feedback: e.delayFeedback,
    wet: e.delayWet,
  });
  rig.reverb.set({
    decay: e.reverbDecay,
    wet: e.reverbWet,
  });
  const prev = lastReverbDecayRef.current;
  const decayChanged = prev !== null && prev !== e.reverbDecay;
  lastReverbDecayRef.current = e.reverbDecay;
  if (decayChanged) {
    void rig.reverb.generate();
  }
}

function applyVoiceToRig(rig: MarimbaRig, voice: MarimbaVoice) {
  rig.synth.set({
    envelope: { ...voice.envelope },
  });
}

export function useMarimba(polyphonic: boolean) {
  const rigRef = useRef<MarimbaRig | null>(null);
  const pendingEffectsRef = useRef<MarimbaEffects | null>(null);
  const pendingVoiceRef = useRef<MarimbaVoice | null>(null);
  const lastReverbDecayRef = useRef<number | null>(null);

  useEffect(() => {
    if (rigRef.current) {
      disposeRig(rigRef.current);
      rigRef.current = null;
      lastReverbDecayRef.current = null;
    }
  }, []);

  const applyMarimbaEffects = useCallback((effects: MarimbaEffects) => {
    if (!rigRef.current) {
      pendingEffectsRef.current = effects;
      return;
    }
    applyEffectsToRig(rigRef.current, effects, lastReverbDecayRef);
  }, []);

  const applyMarimbaVoice = useCallback((voice: MarimbaVoice) => {
    if (!rigRef.current) {
      pendingVoiceRef.current = voice;
      return;
    }
    applyVoiceToRig(rigRef.current, voice);
  }, []);

  const ensureRig = useCallback(async () => {
    await Tone.start();
    if (!rigRef.current) {
      rigRef.current = buildRig(
        MARIMBA_EFFECTS_DEFAULTS,
        MARIMBA_VOICE_DEFAULTS,
        polyphonic,
      );
      await rigRef.current.reverb.generate();
      lastReverbDecayRef.current = MARIMBA_EFFECTS_DEFAULTS.reverbDecay;
      const pendingFx = pendingEffectsRef.current;
      if (pendingFx) {
        applyEffectsToRig(rigRef.current, pendingFx, lastReverbDecayRef);
        pendingEffectsRef.current = null;
      }
      const pendingV = pendingVoiceRef.current;
      if (pendingV) {
        applyVoiceToRig(rigRef.current, pendingV);
        pendingVoiceRef.current = null;
      }
    }
    return rigRef.current;
  }, [polyphonic]);

  const triggerNote = useCallback(
    async (note: string, duration: Tone.Unit.Time | number = '8n') => {
      const rig = await ensureRig();
      rig.synth.triggerAttackRelease(note, duration);
    },
    [ensureRig],
  );

  const ensureMarimbaRig = useCallback(async () => ensureRig(), [ensureRig]);

  const getRig = useCallback(() => rigRef.current, []);

  useEffect(() => {
    return () => {
      if (rigRef.current) {
        disposeRig(rigRef.current);
        rigRef.current = null;
      }
      lastReverbDecayRef.current = null;
      pendingEffectsRef.current = null;
      pendingVoiceRef.current = null;
    };
  }, []);

  return {
    triggerNote,
    ensureMarimbaRig,
    getRig,
    applyMarimbaEffects,
    applyMarimbaVoice,
  };
}
