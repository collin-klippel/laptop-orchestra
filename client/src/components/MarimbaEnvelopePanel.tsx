import { type CSSProperties, useId } from 'react';
import type { MarimbaEnvelope, MarimbaVoicePatch } from '../hooks/useMarimba';
import {
  attackTimeToSliderStep,
  drTimeToSliderStep,
  sliderStepToAttackTime,
  sliderStepToDrTime,
  VOICE_ATTACK_TIME_MAX,
  VOICE_ATTACK_TIME_MIN,
  VOICE_DR_TIME_MAX,
  VOICE_DR_TIME_MIN,
  VOICE_TIME_SLIDER_STEPS,
} from '../lib/marimbaVoiceUi';
import { fontSize, radius, spacing } from '../theme';
import { VoiceEnvelopeGraphic } from './VoiceEnvelopeGraphic';

interface MarimbaEnvelopePanelProps {
  envelope: MarimbaEnvelope;
  onPatch: (patch: MarimbaVoicePatch) => void;
}

const styles: Record<string, CSSProperties> = {
  outer: {
    gridColumn: '1 / -1',
    minWidth: 0,
  },
  panel: {
    marginTop: spacing.sm,
    padding: `${spacing.xl} ${spacing['5xl']}`,
    borderRadius: radius.md,
    border: '1px solid var(--border)',
    background: 'rgba(17,26,46,0.35)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    margin: 0,
    fontSize: fontSize['2xl'],
    fontWeight: 600,
    color: 'var(--text)',
  },
  hint: {
    margin: 0,
    fontSize: fontSize.xs,
    color: 'var(--muted)',
    lineHeight: 1.35,
  },
  graphicWrap: {
    width: '100%',
    marginBottom: spacing.lg,
    color: 'var(--accent)',
  },
  sliderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
    gap: `${spacing['6xl']} ${spacing['7xl']}`,
    alignItems: 'start',
  },
  param: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    minWidth: 0,
  },
  paramHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  paramName: {
    fontSize: fontSize.xs,
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
  },
  paramValue: {
    fontSize: fontSize.xs,
    fontWeight: 600,
    color: 'var(--muted)',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  paramRangeHint: {
    margin: 0,
    fontSize: '0.62rem',
    color: 'var(--muted)',
    opacity: 0.9,
    lineHeight: 1.3,
  },
  range: {
    width: '100%',
    accentColor: 'var(--accent)',
  },
};

function formatAttackHint(): string {
  return `1 ms–${VOICE_ATTACK_TIME_MAX} s · log scale`;
}

function formatDrHint(): string {
  return `10 ms–${VOICE_DR_TIME_MAX} s · log scale`;
}

export function MarimbaEnvelopePanel({
  envelope,
  onPatch,
}: MarimbaEnvelopePanelProps) {
  const uid = useId();
  const attackId = `${uid}-attack`;
  const decayId = `${uid}-decay`;
  const sustainId = `${uid}-sustain`;
  const releaseId = `${uid}-release`;

  const attackHintId = `${uid}-attack-hint`;
  const decayHintId = `${uid}-decay-hint`;
  const sustainHintId = `${uid}-sustain-hint`;
  const releaseHintId = `${uid}-release-hint`;

  return (
    <div style={styles.outer}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <p style={styles.title}>Envelope</p>
          <p style={styles.hint}>
            Shapes overall loudness over time. Attack, decay, and release use a
            logarithmic slider for easier tweaking of short values.
          </p>
        </div>
        <div style={styles.graphicWrap}>
          <VoiceEnvelopeGraphic envelope={envelope} />
        </div>
        <div style={styles.sliderGrid}>
          <div style={styles.param}>
            <div style={styles.paramHeader}>
              <label style={styles.paramName} htmlFor={attackId}>
                Attack
              </label>
              <span style={styles.paramValue}>
                {envelope.attack.toFixed(3)} s
              </span>
            </div>
            <p id={attackHintId} style={styles.paramRangeHint}>
              {formatAttackHint()}
            </p>
            <input
              id={attackId}
              style={styles.range}
              type="range"
              min={0}
              max={VOICE_TIME_SLIDER_STEPS}
              step={1}
              value={attackTimeToSliderStep(envelope.attack)}
              aria-label={`Attack time, logarithmic slider, ${VOICE_ATTACK_TIME_MIN} to ${VOICE_ATTACK_TIME_MAX} seconds`}
              aria-describedby={attackHintId}
              onChange={(e) =>
                onPatch({
                  envelope: {
                    attack: sliderStepToAttackTime(Number(e.target.value)),
                  },
                })
              }
            />
          </div>
          <div style={styles.param}>
            <div style={styles.paramHeader}>
              <label style={styles.paramName} htmlFor={decayId}>
                Decay
              </label>
              <span style={styles.paramValue}>
                {envelope.decay.toFixed(2)} s
              </span>
            </div>
            <p id={decayHintId} style={styles.paramRangeHint}>
              {formatDrHint()}
            </p>
            <input
              id={decayId}
              style={styles.range}
              type="range"
              min={0}
              max={VOICE_TIME_SLIDER_STEPS}
              step={1}
              value={drTimeToSliderStep(envelope.decay)}
              aria-label={`Decay time, logarithmic slider, ${VOICE_DR_TIME_MIN} to ${VOICE_DR_TIME_MAX} seconds`}
              aria-describedby={decayHintId}
              onChange={(e) =>
                onPatch({
                  envelope: {
                    decay: sliderStepToDrTime(Number(e.target.value)),
                  },
                })
              }
            />
          </div>
          <div style={styles.param}>
            <div style={styles.paramHeader}>
              <label style={styles.paramName} htmlFor={sustainId}>
                Sustain
              </label>
              <span style={styles.paramValue}>
                {Math.round(envelope.sustain * 100)}%
              </span>
            </div>
            <p id={sustainHintId} style={styles.paramRangeHint}>
              0–100% level held after decay
            </p>
            <input
              id={sustainId}
              style={styles.range}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={envelope.sustain}
              aria-label="Sustain level, 0 to 100 percent"
              aria-describedby={sustainHintId}
              onChange={(e) =>
                onPatch({
                  envelope: { sustain: Number(e.target.value) },
                })
              }
            />
          </div>
          <div style={styles.param}>
            <div style={styles.paramHeader}>
              <label style={styles.paramName} htmlFor={releaseId}>
                Release
              </label>
              <span style={styles.paramValue}>
                {envelope.release.toFixed(2)} s
              </span>
            </div>
            <p id={releaseHintId} style={styles.paramRangeHint}>
              {formatDrHint()}
            </p>
            <input
              id={releaseId}
              style={styles.range}
              type="range"
              min={0}
              max={VOICE_TIME_SLIDER_STEPS}
              step={1}
              value={drTimeToSliderStep(envelope.release)}
              aria-label={`Release time, logarithmic slider, ${VOICE_DR_TIME_MIN} to ${VOICE_DR_TIME_MAX} seconds`}
              aria-describedby={releaseHintId}
              onChange={(e) =>
                onPatch({
                  envelope: {
                    release: sliderStepToDrTime(Number(e.target.value)),
                  },
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
