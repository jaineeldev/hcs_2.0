/* =========================
   Notification chime
   Synthesised alert — no audio file to host or load.
   A 3-note ascending ring, repeated 5 times over ~5 seconds, so it
   keeps going long enough to actually be noticed on a busy counter
   instead of a single soft ping that's easy to miss.

   Tablets (iPad Safari, Android Chrome) keep web audio muted until the page
   gets a tap. So one shared AudioContext is created and resumed by the first
   tap (primeChime), and the staff board shows a "tap to turn on sound"
   warning until chimeReady() is true — otherwise new orders would arrive
   silently on a board that was reopened without anyone touching it.
========================= */
let ctx = null;

function getContext() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  return ctx;
}

export function chimeReady() {
  return Boolean(ctx && ctx.state === "running");
}

// Call from a tap/click handler. Resolves true once sound is allowed.
export async function primeChime() {
  const c = getContext();
  if (!c) return false;
  try {
    if (c.state !== "running") await c.resume();
    // A silent blip — iOS only fully unlocks after something actually plays.
    const osc = c.createOscillator();
    const gain = c.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.01);
  } catch {
    // ignore — chimeReady() stays false and the warning stays up
  }
  return chimeReady();
}

export function playChime() {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state !== "running") c.resume().catch(() => {});
    const now = c.currentTime;

    const REPEATS = 5;
    const RING_INTERVAL = 1.0; // seconds between each ring
    const NOTES = [740, 988, 1245]; // F#5, B5, D#6 — bright ascending trill
    const NOTE_GAP = 0.13;
    const PEAK_GAIN = 0.55; // kept under 1.0 to avoid clipping with overlap

    for (let ring = 0; ring < REPEATS; ring++) {
      const ringStart = now + ring * RING_INTERVAL;
      NOTES.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "triangle"; // brighter and more audible on small speakers than a pure sine
        osc.frequency.value = freq;
        const start = ringStart + i * NOTE_GAP;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    }
  } catch {
    // Web Audio unavailable
  }
}
