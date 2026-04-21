import type { MarimbaVoice } from '../hooks/useMarimba';

export function cloneMarimbaVoice(v: MarimbaVoice): MarimbaVoice {
  return {
    envelope: { ...v.envelope },
  };
}

/** Range inputs use 0…1000 for smooth log mapping. */
export const VOICE_TIME_SLIDER_STEPS = 1000;

/** Min attack time (seconds); UI hint: 1 ms. */
export const VOICE_ATTACK_TIME_MIN = 0.001;
/** Max attack time (seconds). */
export const VOICE_ATTACK_TIME_MAX = 2;
/** Min decay/release time (seconds); UI hint: 10 ms. */
export const VOICE_DR_TIME_MIN = 0.01;
/** Max decay/release time (seconds). */
export const VOICE_DR_TIME_MAX = 4;

export function attackTimeToSliderStep(t: number): number {
  const clamped = Math.min(
    VOICE_ATTACK_TIME_MAX,
    Math.max(VOICE_ATTACK_TIME_MIN, t),
  );
  const u =
    Math.log(clamped / VOICE_ATTACK_TIME_MIN) /
    Math.log(VOICE_ATTACK_TIME_MAX / VOICE_ATTACK_TIME_MIN);
  return Math.round(Math.min(1, Math.max(0, u)) * VOICE_TIME_SLIDER_STEPS);
}

export function sliderStepToAttackTime(step: number): number {
  const u = Math.min(1, Math.max(0, step / VOICE_TIME_SLIDER_STEPS));
  const v =
    VOICE_ATTACK_TIME_MIN *
    (VOICE_ATTACK_TIME_MAX / VOICE_ATTACK_TIME_MIN) ** u;
  return Math.round(v * 1000) / 1000;
}

export function drTimeToSliderStep(t: number): number {
  const clamped = Math.min(VOICE_DR_TIME_MAX, Math.max(VOICE_DR_TIME_MIN, t));
  const u =
    Math.log(clamped / VOICE_DR_TIME_MIN) /
    Math.log(VOICE_DR_TIME_MAX / VOICE_DR_TIME_MIN);
  return Math.round(Math.min(1, Math.max(0, u)) * VOICE_TIME_SLIDER_STEPS);
}

export function sliderStepToDrTime(step: number): number {
  const u = Math.min(1, Math.max(0, step / VOICE_TIME_SLIDER_STEPS));
  const v = VOICE_DR_TIME_MIN * (VOICE_DR_TIME_MAX / VOICE_DR_TIME_MIN) ** u;
  return Math.round(v * 100) / 100;
}
