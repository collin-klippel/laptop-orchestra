import type React from 'react';
import { useContext } from 'react';
import { PerformanceContext } from '../App';
import { useTransportPosition } from '../hooks/useTransportPosition';
import {
  fontSize,
  letterSpacing,
  lineHeight,
  responsive,
  shadows,
  spacing,
} from '../theme';

const BEATS_PER_BAR = 4;

export function TransportDisplay() {
  const { performanceState } = useContext(PerformanceContext);
  const { beat } = useTransportPosition();

  const isActive = performanceState.active && beat !== null;
  const isPreparing = performanceState.active && beat === null;

  return (
    <div
      style={{
        ...styles.bar,
        ...(isActive ? styles.barActive : {}),
        ...(isPreparing ? styles.barPreparing : {}),
      }}
    >
      <div style={styles.inner}>
        <span style={styles.label}>Beat</span>
        <div style={styles.display}>
          {isActive ? (
            <>
              <span
                style={{ ...styles.beatNumber, ...styles.beatNumberActive }}
              >
                {beat}
              </span>
              <span style={styles.separator}>/</span>
              <span style={styles.total}>{BEATS_PER_BAR}</span>
            </>
          ) : isPreparing ? (
            <span style={styles.preparing}>Starting&hellip;</span>
          ) : (
            <span style={styles.idle}>— / {BEATS_PER_BAR}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0,
    padding: `${responsive.padding.sm} ${responsive.padding.md}`,
    background:
      'linear-gradient(180deg, rgba(17, 26, 46, 0.98) 0%, rgba(11, 18, 32, 0.96) 100%)',
    borderBottom: '1px solid var(--border)',
    boxShadow: shadows.md,
    backdropFilter: 'blur(8px)',
  },
  barActive: {
    borderBottomColor: 'rgba(34, 211, 238, 0.35)',
    boxShadow: `${shadows.xl}, 0 0 0 1px rgba(34, 211, 238, 0.12) inset`,
  },
  barPreparing: {
    borderBottomColor: 'rgba(251, 191, 36, 0.35)',
    boxShadow: `${shadows.xl}, 0 0 0 1px rgba(251, 191, 36, 0.08) inset`,
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.md,
    textAlign: 'center',
  },
  label: {
    fontSize: fontSize.md,
    letterSpacing: letterSpacing.extraWide,
    textTransform: 'uppercase',
    color: 'var(--muted)',
    fontWeight: 700,
  },
  display: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.md,
    fontVariantNumeric: 'tabular-nums',
  },
  beatNumber: {
    fontSize: responsive.textClamp.large,
    lineHeight: lineHeight.tight,
    fontWeight: 800,
    minWidth: '1.5ch',
    textAlign: 'center',
    letterSpacing: letterSpacing.tight,
  },
  beatNumberActive: {
    color: 'var(--accent)',
    textShadow: '0 0 28px rgba(34, 211, 238, 0.45)',
  },
  separator: {
    fontSize: responsive.textClamp.heading,
    color: 'var(--muted)',
    fontWeight: 500,
  },
  total: {
    fontSize: responsive.textClamp.heading,
    color: 'var(--muted)',
    fontWeight: 600,
  },
  idle: {
    fontSize: responsive.textClamp.heading,
    color: 'var(--muted)',
    opacity: 0.55,
  },
  preparing: {
    fontSize: responsive.textClamp.heading,
    color: 'rgba(251, 191, 36, 0.8)',
    fontWeight: 600,
    letterSpacing: letterSpacing.wide,
  },
};
