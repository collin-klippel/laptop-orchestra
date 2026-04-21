/**
 * Theme constants for the Laptop Orchestra application.
 *
 * This file defines reusable design tokens for spacing, sizing, border radius,
 * typography, and shadows to maintain consistency across components and reduce
 * duplication in style objects.
 */

/** Spacing scale - use for margin, padding, and gaps */
export const spacing = {
  xs: '0.2rem',
  sm: '0.25rem',
  md: '0.35rem',
  lg: '0.5rem',
  xl: '0.65rem',
  xxl: '0.75rem',
  '3xl': '0.85rem',
  '4xl': '1rem',
  '5xl': '1.25rem',
  '6xl': '1.5rem',
  '7xl': '1.75rem',
  '8xl': '2rem',
  '10xl': '2.5rem',
} as const;

/** Border radius scale */
export const radius = {
  sm: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
  '2xl': '16px',
  full: '50%',
} as const;

/** Font size scale */
export const fontSize = {
  xs: '0.65rem',
  sm: '0.7rem',
  md: '0.75rem',
  lg: '0.78rem',
  xl: '0.8rem',
  '2xl': '0.85rem',
  '3xl': '0.9rem',
  '4xl': '1rem',
  '5xl': '1.4rem',
  '6xl': '2.25rem',
} as const;

/** Shadow definitions */
export const shadows = {
  /** Small elevation shadow */
  sm: '0 2px 8px rgba(0, 0, 0, 0.15)',
  /** Medium elevation shadow */
  md: '0 8px 24px rgba(0, 0, 0, 0.35)',
  /** Large elevation shadow */
  lg: '0 8px 32px rgba(0, 0, 0, 0.35)',
  /** Extra large shadow for prominent elements */
  xl: '0 8px 28px rgba(0, 0, 0, 0.4)',
} as const;

/** Line height values for typography */
export const lineHeight = {
  tight: 1,
  normal: 1.2,
  relaxed: 1.4,
  loose: 1.5,
  veryLoose: 1.8,
} as const;

/** Letter spacing values */
export const letterSpacing = {
  tight: '-0.02em',
  normal: '0em',
  wide: '0.04em',
  wider: '0.06em',
  widest: '0.1em',
  extraWide: '0.14em',
} as const;

/** Z-index stack for layering */
export const zIndex = {
  base: 0,
  sticky: 5,
  overlay: 100,
  modal: 200,
} as const;

/** Responsive sizing utilities */
export const responsive = {
  textClamp: {
    title: 'clamp(1.35rem, 4vw, 1.85rem)',
    heading: 'clamp(1.25rem, 3.5vw, 1.75rem)',
    large: 'clamp(2.25rem, 6vw, 3.25rem)',
  },
  padding: {
    sm: 'clamp(0.85rem, 2.5vw, 1.35rem)',
    md: 'clamp(1rem, 4vw, 2.5rem)',
  },
} as const;
