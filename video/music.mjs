// Procedural music bed for a post video: a minor-key pad, a plucked
// arpeggio through a ping-pong delay, a sub bass and a soft four-on-the-floor,
// all seeded by the post slug so every video gets its own (stable) track.
// Pure JS, no samples. Returns stereo Float32Arrays at `rate`.

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PROGRESSIONS = [
  [0, 5, 2, 6], // i VI III VII
  [0, 3, 5, 4], // i iv VI v
  [5, 6, 0, 0], // VI VII i i
  [0, 6, 5, 6], // i VII VI VII
  [0, 2, 5, 3], // i III VI iv
];
const ROOTS = [45, 46, 48, 50, 52, 53]; // A2 .. F3

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const scaleNote = (root, degree) => root + MINOR[degree % 7] + 12 * Math.floor(degree / 7);

export function synthMusic({ seconds, seed, rate = 44100 }) {
  const rnd = mulberry(seed);
  const bpm = 88 + Math.floor(rnd() * 16);
  const beat = 60 / bpm;
  const prog = PROGRESSIONS[Math.floor(rnd() * PROGRESSIONS.length)];
  const root = ROOTS[Math.floor(rnd() * ROOTS.length)];
  const arpShape = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 1, 2, 1], [3, 2, 1, 0]][Math.floor(rnd() * 4)];
  const n = Math.ceil(seconds * rate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const chordBeats = 8;
  const chordAt = (b) => prog[Math.floor(b / chordBeats) % prog.length];
  const chordNotes = (deg) => [0, 2, 4, 6].map((k) => scaleNote(root + 12, deg + k));
  const fadeIn = Math.min(2.5, seconds * 0.1);
  const fadeOut = Math.min(3, seconds * 0.12);
  const master = (t) => Math.min(1, t / fadeIn) * Math.min(1, (seconds - t) / fadeOut);
  const introBeats = 8; // pad alone for the first two bars

  // Pad: 3 detuned saws per chord tone, crossfaded at chord changes, through
  // two one-pole lowpasses with a slow cutoff sweep.
  const phases = new Float64Array(64);
  let lp1L = 0, lp2L = 0, lp1R = 0, lp2R = 0;
  // Pluck arpeggio, written dry then fed through a ping-pong delay.
  const dryArp = new Float32Array(n);
  // Kick (also drives the pump on the pad) and hats.
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const b = t / beat;
    const chordIdx = Math.floor(b / chordBeats);
    const inChord = b - chordIdx * chordBeats;
    const cur = chordNotes(chordAt(b));
    const prev = chordNotes(chordAt(Math.max(0, b - chordBeats)));
    const xf = chordIdx === 0 ? 1 : Math.min(1, inChord / 1.5);
    let padL = 0, padR = 0;
    const voices = [[cur, xf], [prev, 1 - xf]];
    let pi = 0;
    for (const [notes, gain] of voices) {
      for (let k = 0; k < notes.length; k++) {
        for (let d = -1; d <= 1; d++) {
          const hz = midiHz(notes[k]) * Math.pow(2, (d * 7) / 1200);
          phases[pi] = (phases[pi] + hz / rate) % 1;
          const s = (2 * phases[pi] - 1) * gain * (k === 3 ? 0.5 : 1);
          if (d <= 0) padL += s;
          if (d >= 0) padR += s;
          pi++;
        }
      }
    }
    const cutoff = 700 + 900 * (0.5 + 0.5 * Math.sin(t * 0.13 + seed));
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
    lp1L += a * (padL - lp1L); lp2L += a * (lp1L - lp2L);
    lp1R += a * (padR - lp1R); lp2R += a * (lp1R - lp2R);

    const beatPhase = b - Math.floor(b);
    const drums = b >= introBeats && t < seconds - fadeOut * 0.6;
    const pump = drums ? 0.55 + 0.45 * Math.min(1, beatPhase * 2.2) : 1;
    let l = lp2L * 0.05 * pump;
    let r = lp2R * 0.05 * pump;

    // Sub bass on the chord root, eighth-note pulses.
    if (b >= introBeats / 2) {
      const e = (b * 2) % 1;
      const env = Math.exp(-e * 3) * 0.9 + 0.1;
      const sub = Math.sin(2 * Math.PI * midiHz(cur[0] - 24) * t) * env * 0.16 * pump;
      l += sub; r += sub;
    }
    if (drums) {
      const kt = beatPhase * beat;
      const kick = Math.sin(2 * Math.PI * (45 * kt + (75 / 30) * (1 - Math.exp(-30 * kt)))) * Math.exp(-kt * 9) * 0.28;
      l += kick; r += kick;
      const off = (b + 0.5) % 1;
      if (off < 0.12) {
        const hat = (rnd() * 2 - 1) * Math.exp(-off * beat * 70) * 0.035;
        l += hat * 0.8; r += hat;
      }
    }
    // Arpeggio: sixteenths over the chord an octave up, plucked (exp decay).
    if (b >= introBeats / 2) {
      const step = Math.floor(b * 4);
      const st = (b * 4 - step) * (beat / 4);
      const note = cur[arpShape[step % 4]] + 12 * (Math.floor(step / 4) % 2);
      const hz = midiHz(note);
      const ph = 2 * Math.PI * hz * st;
      const tone = Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph);
      dryArp[i] = tone * Math.exp(-st * 14) * 0.07;
    }
    L[i] = l;
    R[i] = r;
  }
  // Ping-pong delay at a dotted eighth.
  const dl = Math.round(beat * 0.75 * rate);
  const bufL = new Float32Array(n), bufR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const inL = dryArp[i] + (i >= dl ? bufR[i - dl] * 0.42 : 0);
    const inR = i >= dl ? bufL[i - dl] * 0.42 : 0;
    bufL[i] = inL;
    bufR[i] = inR;
    const m = master(i / rate);
    L[i] = (L[i] + dryArp[i] * 0.8 + bufL[i] * 0.35 + bufR[i] * 0.15) * m;
    R[i] = (R[i] + dryArp[i] * 0.8 + bufR[i] * 0.35 + bufL[i] * 0.15) * m;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? 0.7 / peak : 1;
  for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  return { L, R, rate, bpm };
}

export function wavBytes(channels, rate) {
  const n = channels[0].length;
  const ch = channels.length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * ch * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(channels[c][i] * 32767))), o);
      o += 2;
    }
  }
  return buf;
}

// 16-bit PCM mono/stereo WAV -> Float32Array per channel (what tts.py writes).
export function readWav(bytes) {
  let o = 12, fmt = null, data = null;
  while (o + 8 <= bytes.length) {
    const id = bytes.toString("ascii", o, o + 4);
    const size = bytes.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { format: bytes.readUInt16LE(o + 8), ch: bytes.readUInt16LE(o + 10), rate: bytes.readUInt32LE(o + 12), bits: bytes.readUInt16LE(o + 22) };
    if (id === "data") data = bytes.subarray(o + 8, o + 8 + size);
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error("expected a 16-bit PCM wav");
  const frames = data.length / (2 * fmt.ch);
  const out = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < fmt.ch; c++) out[c][i] = data.readInt16LE((i * fmt.ch + c) * 2) / 32768;
  return { channels: out, rate: fmt.rate };
}
