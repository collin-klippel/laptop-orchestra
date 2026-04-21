import { useEffect, useState } from 'react';
import * as Tone from 'tone';

/**
 * Returns the current 1-based beat within the bar (1–4) while the Tone.js
 * Transport is running, or null when it is stopped.
 *
 * Polls every 50 ms instead of relying on Tone.js's scheduleRepeat/start
 * events. This approach works correctly regardless of whether the transport
 * starts immediately or at a future scheduled AudioContext time (as is the
 * case with the 2-second sync lead used for multi-client synchronization).
 * Transport.state already incorporates the 0.1 s lookahead, so 'started'
 * becomes visible up to ~100 ms before the first audio sample — acceptable
 * for a visual display.
 */
export function useTransportPosition() {
  const [beat, setBeat] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const transport = Tone.getTransport();
      if (transport.state !== 'started') {
        setBeat(null);
        return;
      }
      const [, beatsStr] = transport.position.toString().split(':');
      const beatIndex = Number.parseInt(beatsStr ?? '0', 10);
      setBeat((beatIndex % 4) + 1);
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  return { beat };
}
