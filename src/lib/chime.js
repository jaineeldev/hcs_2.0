/* =========================
   Notification chime
   Synthesised alert — no audio file to host or load.
   A 3-note ascending ring, repeated 5 times over ~5 seconds, so it
   keeps going long enough to actually be noticed on a busy counter
   instead of a single soft ping that's easy to miss.
========================= */
export function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const REPEATS = 5;
    const RING_INTERVAL = 1.0; // seconds between each ring
    const NOTES = [740, 988, 1245]; // F#5, B5, D#6 — bright ascending trill
    const NOTE_GAP = 0.13;
    const PEAK_GAIN = 0.55; // louder than before, kept under 1.0 to avoid clipping with overlap

    for (let ring = 0; ring < REPEATS; ring++) {
      const ringStart = now + ring * RING_INTERVAL;
      NOTES.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle"; // brighter and more audible on small speakers than a pure sine
        osc.frequency.value = freq;
        const start = ringStart + i * NOTE_GAP;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    }

    setTimeout(() => ctx.close(), (REPEATS * RING_INTERVAL + 0.5) * 1000);
  } catch {
    // Web Audio unavailable
  }
}
