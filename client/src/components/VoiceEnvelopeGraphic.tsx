import type { MarimbaEnvelope } from '../hooks/useMarimba';

const VIEW_W = 220;
const VIEW_H = 80;
const PAD_X = 10;
const PAD_Y = 10;

interface VoiceEnvelopeGraphicProps {
  envelope: MarimbaEnvelope;
}

/** Read-only SVG preview of ADSR (time-scaled). Sustain plateau width is illustrative. */
export function VoiceEnvelopeGraphic({ envelope }: VoiceEnvelopeGraphicProps) {
  const { attack, decay, sustain, release } = envelope;
  const sustainPad = Math.max(0.06, 0.28 * (attack + decay + release));
  const total = Math.max(1e-6, attack + decay + sustainPad + release);

  const gw = VIEW_W - PAD_X * 2;
  const gh = VIEW_H - PAD_Y * 2;

  const sx = (time: number) => PAD_X + (time / total) * gw;
  const sy = (amp: number) => PAD_Y + gh - amp * gh;

  const x0 = sx(0);
  const xA = sx(attack);
  const xD = sx(attack + decay);
  const xS = sx(attack + decay + sustainPad);
  const xR = sx(total);

  const y0 = sy(0);
  const y1 = sy(1);
  const yS = sy(sustain);
  const yHalf = sy(0.5);

  const pathD = [
    `M ${x0} ${y0}`,
    `L ${xA} ${y1}`,
    `L ${xD} ${yS}`,
    `L ${xS} ${yS}`,
    `L ${xR} ${y0}`,
    'Z',
  ].join(' ');

  const strokePath = [
    `M ${x0} ${y0}`,
    `L ${xA} ${y1}`,
    `L ${xD} ${yS}`,
    `L ${xS} ${yS}`,
    `L ${xR} ${y0}`,
  ].join(' ');

  const midSustainX = (xD + xS) / 2;
  const midReleaseX = (xS + xR) / 2;
  const midReleaseY = (yS + y0) / 2;

  const markerStyle = {
    fontSize: 7,
    fontFamily: 'inherit',
    fontWeight: 600,
    fill: 'currentColor',
    opacity: 0.72,
  } as const;

  return (
    <figure style={{ margin: 0, width: '100%', maxWidth: 420 }}>
      <svg
        width="100%"
        height={VIEW_H}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="Amplitude envelope: attack up to peak, decay to sustain level, hold, then release to silence. Sustain width in this drawing is not note length; only the sustain level matches the slider."
        style={{ display: 'block' }}
      >
        <title>ADSR envelope preview</title>
        <line
          x1={PAD_X}
          y1={y0}
          x2={PAD_X + gw}
          y2={y0}
          stroke="currentColor"
          strokeWidth={0.75}
          opacity={0.22}
        />
        <line
          x1={PAD_X}
          y1={yHalf}
          x2={PAD_X + gw}
          y2={yHalf}
          stroke="currentColor"
          strokeWidth={0.5}
          opacity={0.1}
        />
        <path d={pathD} fill="currentColor" opacity={0.12} stroke="none" />
        <path
          d={strokePath}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
        <text x={xA} y={y1 - 2} textAnchor="middle" style={markerStyle}>
          A
        </text>
        <text
          x={(xA + xD) / 2}
          y={(y1 + yS) / 2 + 3}
          textAnchor="middle"
          style={markerStyle}
        >
          D
        </text>
        <text
          x={midSustainX}
          y={Math.min(yS, y1) - 3}
          textAnchor="middle"
          style={markerStyle}
        >
          S
        </text>
        <text
          x={midReleaseX}
          y={midReleaseY + 10}
          textAnchor="middle"
          style={markerStyle}
        >
          R
        </text>
      </svg>
      <figcaption
        style={{
          margin: '0.35rem 0 0',
          fontSize: '0.68rem',
          lineHeight: 1.4,
          color: 'var(--muted)',
        }}
      >
        Sustain plateau length is illustrative; only its height matches sustain
        level. Note length depends on performance, not this width.
      </figcaption>
    </figure>
  );
}
