import type React from 'react';
import { useEffect, useRef } from 'react';
import * as Tone from 'tone';

interface OscilloscopeViewProps {
  waveform: Tone.Waveform | null;
  /** Default true. Turn off when a parent supplies the section heading. */
  showHeading?: boolean;
}

/** Visual-only boost so quieter signals read clearly; clamped before mapping to canvas. */
const WAVEFORM_VERTICAL_GAIN = 10;

function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function OscilloscopeView({
  waveform,
  showHeading = true,
}: OscilloscopeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || waveform) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasBg = readCssVar(
      '--oscilloscope-canvas-bg',
      'rgba(11, 18, 32, 0.96)',
    );
    const gridMuted = readCssVar(
      '--oscilloscope-grid',
      'rgba(148, 163, 184, 0.3)',
    );

    let isRunning = true;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      const w = width * dpr;
      const h = height * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paintIdle = () => {
      if (!isRunning) return;
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const centerY = height / 2;
      ctx.fillStyle = canvasBg;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = gridMuted;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    updateCanvasSize();
    paintIdle();
    const onResize = () => {
      updateCanvasSize();
      paintIdle();
    };
    window.addEventListener('resize', onResize);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', onResize);
    };
  }, [waveform]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !waveform) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const signalColor = readCssVar('--signal-live', '#22d3ee');
    const canvasBg = readCssVar(
      '--oscilloscope-canvas-bg',
      'rgba(11, 18, 32, 0.96)',
    );
    const gridMuted = readCssVar(
      '--oscilloscope-grid',
      'rgba(148, 163, 184, 0.3)',
    );

    let isRunning = true;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      const w = width * dpr;
      const h = height * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    const draw = () => {
      if (!isRunning) return;

      const waveformData = waveform.getValue();

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.fillStyle = canvasBg;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = signalColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const centerY = height / 2;
      const pixelsPerSample = width / waveformData.length;
      const halfAmp = height / 2;

      for (let i = 0; i < waveformData.length; i++) {
        const boosted = waveformData[i] * WAVEFORM_VERTICAL_GAIN;
        const sample = Math.max(-1, Math.min(1, boosted));
        const x = i * pixelsPerSample;
        const y = centerY - sample * halfAmp;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      ctx.strokeStyle = gridMuted;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [waveform]);

  return (
    <div ref={containerRef} style={styles.container}>
      {showHeading ? (
        <div style={styles.header}>
          <h3 style={styles.title}>Oscilloscope</h3>
        </div>
      ) : null}
      <canvas ref={canvasRef} style={styles.canvas} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
    overflow: 'hidden',
    width: '100%',
    padding: '0rem',
    gap: '0.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexShrink: 0,
    paddingLeft: '0.5rem',
  },
  title: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  canvas: {
    width: '100%',
    height: '100%',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--oscilloscope-canvas-bg)',
    flex: 1,
    minHeight: 0,
    display: 'block',
  },
};
