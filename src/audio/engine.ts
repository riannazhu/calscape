import type { ElementId, ElementState } from '../elements';

const FADE = 0.06;
const STOP_FADE = 0.12;
/** One isolated Campanile strike; the synthesised bell is used if it fails to load. */
const BELL_SAMPLE_URL = `${import.meta.env.BASE_URL}sounds/campanile.mp3`;
/** The tower tolls the hour with strikes about 4 s apart. */
const STRIKE_SPACING = 4;

/** Keeps the default mix modest: rain and breeze as beds, the rest as accents. */
const BASE_LEVEL: Record<ElementId, number> = {
  rain: 0.55,
  bird: 0.22,
  bell: 0.4,
  squirrel: 0.22,
  sprinkler: 0.28,
  guitar: 0.2,
  dove: 0.28,
  wind: 0.45,
  crickets: 0.12,
  owl: 0.32,
  frogs: 0.16,
};
/** Each sound comes from roughly where its sprite sits. */
const PAN: Record<ElementId, number> = {
  rain: 0,
  bird: -0.55,
  bell: -0.35,
  squirrel: -0.45,
  sprinkler: 0.3,
  guitar: -0.3,
  dove: 0.25,
  wind: 0,
  crickets: 0.4,
  owl: -0.6,
  frogs: 0.5,
};
const REVERB_SEND: Record<ElementId, number> = {
  rain: 0,
  bird: 0.12,
  bell: 0.25,
  squirrel: 0.06,
  sprinkler: 0.05,
  guitar: 0.2,
  dove: 0.25,
  wind: 0,
  crickets: 0.1,
  owl: 0.35,
  frogs: 0.15,
};
/** Elements that play a steady loop rather than scheduled events. */
const LOOPED = new Set<ElementId>(['rain', 'crickets', 'wind', 'sprinkler', 'frogs', 'guitar']);
/** Animals that call now and then: seconds between calls, shortest to longest. */
const CALL_GAP_S: Partial<Record<ElementId, [number, number]>> = {
  bird: [6, 18],
  squirrel: [14, 40],
  dove: [20, 45],
  owl: [25, 60],
};

type Source = AudioScheduledSourceNode;

interface Channel {
  gain: GainNode;
  stop(): void;
}

function rampTo(param: AudioParam, value: number, ctx: AudioContext, tau = FADE) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.setTargetAtTime(value, now, tau);
}

/**
 * Builds a noise loop whose end flows into its start. A one-pole lowpass is
 * run over the same white noise twice and only the second pass is kept, so
 * the filter state at the loop point matches on both sides.
 */
function seamlessNoise(ctx: AudioContext, seconds: number, smooth: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const white = new Float32Array(len);
    for (let i = 0; i < len; i++) white[i] = Math.random() * 2 - 1;
    const out = buf.getChannelData(ch);
    let y = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < len; i++) {
        y += smooth * (white[i] - y);
        if (pass === 1) out[i] = y;
      }
    }
    normalize(out);
  }
  return buf;
}

/** Soft droplet ticks scattered through a loop, wrapping around its end. */
function dropletLoop(ctx: AudioContext, seconds: number, perSecond: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch);
    const count = Math.floor(seconds * perSecond);
    for (let n = 0; n < count; n++) {
      const start = Math.floor(Math.random() * len);
      const amp = 0.15 + Math.random() * 0.5;
      const freq = 1800 + Math.random() * 3200;
      const decay = sr * (0.004 + Math.random() * 0.01);
      const dur = Math.floor(decay * 5);
      for (let i = 0; i < dur; i++) {
        const env = Math.exp(-i / decay);
        const s = Math.sin((2 * Math.PI * freq * i) / sr) * 0.6 + (Math.random() * 2 - 1) * 0.4;
        out[(start + i) % len] += amp * env * s;
      }
    }
    normalize(out);
  }
  return buf;
}

/**
 * A small chorus of field crickets. Each voice chirps in bursts of short
 * pulses at its own pitch and rhythm; periods divide the loop evenly so it
 * wraps without a hiccup, and a few chirps are skipped so it never sounds metric.
 */
function cricketLoop(ctx: AudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);
  const voices = [
    { freq: 4300, period: 1.9, amp: 1, pan: -0.3 },
    { freq: 4650, period: 3.3, amp: 0.6, pan: 0.5 },
  ];
  const pulse = Math.floor(sr * 0.016);
  const gap = Math.floor(sr * 0.012);
  for (const v of voices) {
    const count = Math.round(seconds / v.period);
    const step = len / count;
    const offset = Math.random() * step;
    for (let k = 0; k < count; k++) {
      if (Math.random() < 0.3) continue;
      const start = Math.floor(offset + k * step + (Math.random() - 0.5) * sr * 0.02);
      const pulses = 3 + Math.floor(Math.random() * 2);
      const amp = v.amp * (0.7 + Math.random() * 0.3);
      for (let n = 0; n < pulses; n++) {
        for (let i = 0; i < pulse; i++) {
          const env = Math.sin((Math.PI * i) / pulse) ** 2;
          const sample = amp * env * Math.sin((2 * Math.PI * v.freq * i) / sr);
          const at = (((start + n * (pulse + gap) + i) % len) + len) % len;
          left[at] += sample * (1 - v.pan) * 0.5;
          right[at] += sample * (1 + v.pan) * 0.5;
        }
      }
    }
  }
  normalize(left, 0.9);
  normalize(right, 0.9);
  return buf;
}

const addPanned = (left: Float32Array, right: Float32Array, at: number, v: number, pan: number) => {
  const i = ((at % left.length) + left.length) % left.length;
  left[i] += v * (1 - pan) * 0.5;
  right[i] += v * (1 + pan) * 0.5;
};

/**
 * Pacific chorus frogs: each frog calls "rib-bit" in bouts of a few calls,
 * then rests, so the chorus swells and thins rather than droning.
 */
function frogLoop(ctx: AudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);
  const frogs = [
    { freq: 2100, pan: -0.4, amp: 1 },
    { freq: 2350, pan: 0.3, amp: 0.7 },
    { freq: 1900, pan: 0.7, amp: 0.5 },
  ];
  // offset s, length s, pitch ratio, level: the second syllable rises.
  const syllables = [
    [0, 0.09, 1, 1],
    [0.15, 0.12, 1.08, 0.85],
  ];
  for (const f of frogs) {
    let at = Math.random() * 4;
    while (at < seconds) {
      const calls = 3 + Math.floor(Math.random() * 5);
      for (let c = 0; c < calls && at < seconds; c++) {
        for (const [offset, dur, ratio, level] of syllables) {
          const n = Math.floor(dur * sr);
          const start = Math.floor((at + offset) * sr);
          let phase = 0;
          for (let i = 0; i < n; i++) {
            const u = i / n;
            phase += (2 * Math.PI * f.freq * ratio * (1 + 0.05 * u)) / sr;
            const pulse = (0.5 + 0.5 * Math.sin((2 * Math.PI * 95 * i) / sr)) ** 2;
            const env = Math.sin(Math.PI * u) ** 0.6 * pulse;
            const v = f.amp * level * env * (Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase));
            addPanned(left, right, start + i, v, f.pan);
          }
        }
        at += 0.55 + Math.random() * 0.35;
      }
      at += 4 + Math.random() * 7;
    }
  }
  normalize(left, 0.9);
  normalize(right, 0.9);
  return buf;
}

/**
 * An impact sprinkler: a tick and a puff of spray at each step across its arc,
 * then a quick ratchet back. Matches the scene's sprinkler cycle.
 */
function sprinklerLoop(ctx: AudioContext, sweep: number, back: number, tick: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * (sweep + back));
  const buf = ctx.createBuffer(2, len, sr);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);
  const hit = (at: number, amp: number, spray: number, pan: number) => {
    const start = Math.floor(at * sr);
    const click = Math.floor(0.004 * sr);
    for (let i = 0; i < click; i++) {
      addPanned(left, right, start + i, amp * (Math.random() * 2 - 1) * Math.exp(-i / (0.0012 * sr)), pan);
    }
    let y = 0;
    const n = Math.floor(0.2 * sr);
    for (let i = 0; i < n; i++) {
      y += 0.25 * (Math.random() * 2 - 1 - y);
      addPanned(left, right, start + i, spray * y * Math.exp(-i / (0.05 * sr)), pan);
    }
  };
  const steps = Math.floor(sweep / tick);
  for (let k = 0; k < steps; k++) hit(k * tick, 0.7, 0.9, -0.6 + (1.2 * k) / steps);
  const ratchet = Math.floor(back / 0.05);
  for (let k = 0; k < ratchet; k++) hit(sweep + k * 0.05, 0.25, 0, 0.6 - (1.2 * k) / ratchet);
  normalize(left, 0.9);
  normalize(right, 0.9);
  return buf;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/**
 * Someone in the guitar circle fingerpicking slowly through Cmaj7, Am7, Fmaj7
 * and G6. Each string is a Karplus-Strong pluck; timing is loosely human.
 */
function guitarLoop(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const eighth = 0.42;
  const chords = [
    [48, 55, 59, 64],
    [45, 52, 55, 60],
    [41, 48, 52, 57],
    [43, 50, 55, 59],
  ];
  const patterns = [
    [0, 1, 2, 3, 2, 1, 3, 2],
    [0, 2, 1, 3, 1, 2, 3, 1],
  ];
  const seconds = patterns.length * chords.length * patterns[0].length * eighth;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);
  const pluck = (at: number, freq: number, amp: number, pan: number) => {
    const period = Math.max(2, Math.round(sr / freq));
    const line = new Float32Array(period);
    let y = 0;
    for (let i = 0; i < period; i++) {
      y += 0.5 * (Math.random() * 2 - 1 - y);
      line[i] = y;
    }
    const start = Math.floor(at * sr);
    const n = Math.floor(2.8 * sr);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const cur = line[idx];
      line[idx] = 0.998 * 0.5 * (cur + line[(idx + 1) % period]);
      idx = (idx + 1) % period;
      addPanned(left, right, start + i, cur * amp, pan);
    }
  };
  let at = 0;
  for (const pattern of patterns) {
    for (const chord of chords) {
      pattern.forEach((string) => {
        const t = Math.max(0, at + (Math.random() - 0.5) * 0.025);
        pluck(t, midiHz(chord[string]), (string === 0 ? 0.9 : 0.55) * (0.8 + Math.random() * 0.2), -0.3 + string * 0.2);
        at += eighth;
      });
    }
  }
  normalize(left, 0.9);
  normalize(right, 0.9);
  return buf;
}

/** Outdoor-ish space: decaying stereo noise, darker as it fades. */
function reverbImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const smooth = 0.6 * Math.exp(-t * 1.5) + 0.05;
      y += smooth * (Math.random() * 2 - 1 - y);
      out[i] = t < 0.02 ? 0 : y * Math.exp(-t * 2.2);
    }
    normalize(out, 0.5);
  }
  return buf;
}

function normalize(out: Float32Array, to = 1) {
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * to;
}

/** The next top of the hour on the user's clock, strictly after `after` (ms). */
function nextHour(after: number): Date {
  const d = new Date(after);
  d.setMinutes(60, 0, 0);
  return d;
}

/** Strikes for an hour on a 12-hour clock: 1 pm rings once, midnight and noon twelve times. */
export function strikesFor(hour24: number): number {
  return hour24 % 12 === 0 ? 12 : hour24 % 12;
}

/** Tracks scheduled sources so a channel can stop everything it started. */
class SourceSet {
  private live = new Set<Source>();
  add(s: Source) {
    this.live.add(s);
    s.addEventListener('ended', () => this.live.delete(s));
  }
  stopAll() {
    for (const s of this.live) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    }
    this.live.clear();
  }
}

/**
 * Owns the AudioContext and one channel per present element. `sync` is
 * idempotent, so React rerenders can never start a second loop.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: GainNode | null = null;
  private masterLevel = 1;
  private masterMuted = false;
  private channels = new Map<ElementId, Channel>();
  private previews = new Map<ElementId, () => void>();
  private rainBuffers: { hiss: AudioBuffer; drops: AudioBuffer } | null = null;
  private cricketBuffer: AudioBuffer | null = null;
  private windBuffer: AudioBuffer | null = null;
  private frogBuffer: AudioBuffer | null = null;
  private sprinklerBuffer: AudioBuffer | null = null;
  private guitarBuffer: AudioBuffer | null = null;
  private bellSample: AudioBuffer | null = null;
  /** Lets the scene animate an animal while it calls. */
  onCall: ((id: ElementId, ms: number) => void) | null = null;

  /** Must be called from a user gesture before audio can play. */
  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'playback' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.masterGain();
      this.master.connect(ctx.destination);
      const convolver = ctx.createConvolver();
      convolver.buffer = reverbImpulse(ctx, 3.2);
      this.reverb = ctx.createGain();
      this.reverb.connect(convolver).connect(this.master);
      void this.loadBellSample(ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private async loadBellSample(ctx: AudioContext) {
    try {
      const res = await fetch(BELL_SAMPLE_URL);
      if (!res.ok || !res.headers.get('content-type')?.startsWith('audio')) return;
      this.bellSample = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      // No recording available; keep the synthesised bell.
    }
  }

  private masterGain() {
    return this.masterMuted ? 0 : this.masterLevel;
  }

  setMaster(level: number, muted: boolean) {
    this.masterLevel = level;
    this.masterMuted = muted;
    if (this.ctx && this.master) rampTo(this.master.gain, this.masterGain(), this.ctx);
  }

  sync(elements: Record<ElementId, ElementState>) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const id of Object.keys(elements) as ElementId[]) {
      const s = elements[id];
      let ch = this.channels.get(id);
      if (s.present && !ch) {
        ch = this.create(id, ctx);
        this.channels.set(id, ch);
        ch.gain.gain.value = 0;
      } else if (!s.present && ch) {
        this.channels.delete(id);
        ch.stop();
        this.previews.get(id)?.();
        continue;
      }
      if (ch) {
        const target = s.muted ? 0 : s.volume * BASE_LEVEL[id];
        const tau = LOOPED.has(id) && ch.gain.gain.value === 0 && !s.muted ? 0.4 : FADE;
        rampTo(ch.gain.gain, target, ctx, tau);
      }
    }
  }

  /**
   * Plays a short sample of an element at `volume` so the level can be judged
   * while adjusting it. Bypasses the element's mute but respects the master.
   */
  preview(id: ElementId, volume: number, muted: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    // An unmuted loop already plays at the new level.
    if (LOOPED.has(id) && !muted) return;
    this.previews.get(id)?.();

    const { gain, release } = this.output(id, ctx);
    gain.gain.value = volume * BASE_LEVEL[id];
    const sources = new SourceSet();
    let duration: number;
    if (CALL_GAP_S[id]) {
      duration = this.phrase(id, ctx, gain, sources);
    } else if (id === 'bell') {
      duration = this.strike(ctx, gain, ctx.currentTime + 0.02, sources);
    } else {
      duration = 1.8;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
      env.gain.setTargetAtTime(0, ctx.currentTime + 1.3, 0.15);
      env.connect(gain);
      this.loopSources(id, ctx, env, sources);
    }

    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (this.previews.get(id) === stop) this.previews.delete(id);
      release(() => sources.stopAll());
    };
    const timer = window.setTimeout(stop, duration * 1000);
    this.previews.set(id, stop);
  }

  private output(id: ElementId, ctx: AudioContext) {
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = PAN[id];
    gain.connect(pan).connect(this.master!);
    let send: GainNode | null = null;
    if (REVERB_SEND[id] > 0) {
      send = ctx.createGain();
      send.gain.value = REVERB_SEND[id];
      pan.connect(send).connect(this.reverb!);
    }
    const release = (cleanup: () => void) => {
      rampTo(gain.gain, 0, ctx, STOP_FADE / 3);
      window.setTimeout(() => {
        cleanup();
        gain.disconnect();
        pan.disconnect();
        send?.disconnect();
      }, STOP_FADE * 1000 * 3);
    };
    return { gain, release };
  }

  private create(id: ElementId, ctx: AudioContext): Channel {
    if (id === 'bell') return this.createBell(ctx);
    if (LOOPED.has(id)) return this.createLoop(id, ctx);
    return this.createCaller(id, ctx);
  }

  private loopSources(id: ElementId, ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    switch (id) {
      case 'crickets':
        return this.cricketSources(ctx, dest, sources);
      case 'wind':
        return this.windSources(ctx, dest, sources);
      case 'frogs':
        this.frogBuffer ??= frogLoop(ctx, 17.3);
        return this.bufferLoop(this.frogBuffer, 'highpass', 900, ctx, dest, sources);
      case 'guitar':
        this.guitarBuffer ??= guitarLoop(ctx);
        return this.bufferLoop(this.guitarBuffer, 'lowpass', 3200, ctx, dest, sources);
      case 'sprinkler':
        this.sprinklerBuffer ??= sprinklerLoop(ctx, 5.3, 1.9, 0.24);
        return this.bufferLoop(this.sprinklerBuffer, 'highpass', 300, ctx, dest, sources);
      default:
        return this.rainSources(ctx, dest, sources);
    }
  }

  /** A looping buffer through one filter, starting at a random point so it never sounds restarted. */
  private bufferLoop(
    buffer: AudioBuffer,
    type: BiquadFilterType,
    freq: number,
    ctx: AudioContext,
    dest: AudioNode,
    sources: SourceSet,
  ) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    src.connect(filter).connect(dest);
    src.start(ctx.currentTime, Math.random() * buffer.duration);
    sources.add(src);
  }

  private createLoop(id: ElementId, ctx: AudioContext): Channel {
    const { gain, release } = this.output(id, ctx);
    const sources = new SourceSet();
    this.loopSources(id, ctx, gain, sources);
    return { gain, stop: () => release(() => sources.stopAll()) };
  }

  private cricketSources(ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    this.cricketBuffer ??= cricketLoop(ctx, 13.2);
    this.bufferLoop(this.cricketBuffer, 'highpass', 2500, ctx, dest, sources);
  }

  /**
   * Low wind with slow gusts: dark noise whose level and brightness drift on
   * two unrelated slow LFOs, plus a faint leaf rustle that rises with each gust.
   */
  private windSources(ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    this.windBuffer ??= seamlessNoise(ctx, 11.3, 0.05);
    const air = ctx.createBufferSource();
    air.buffer = this.windBuffer;
    air.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.6;
    const gust = ctx.createGain();
    gust.gain.value = 0.6;
    air.connect(lp).connect(gust).connect(dest);

    const rustle = ctx.createBufferSource();
    this.rainBuffers ??= { hiss: seamlessNoise(ctx, 9.7, 0.35), drops: dropletLoop(ctx, 6.3, 70) };
    rustle.buffer = this.rainBuffers.hiss;
    rustle.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const rustleGain = ctx.createGain();
    rustleGain.gain.value = 0.05;
    rustle.connect(hp).connect(rustleGain).connect(dest);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const depth = ctx.createGain();
    depth.gain.value = 0.35;
    lfo.connect(depth).connect(gust.gain);
    const rustleDepth = ctx.createGain();
    rustleDepth.gain.value = 0.04;
    lfo.connect(rustleDepth).connect(rustleGain.gain);

    const tone = ctx.createOscillator();
    tone.frequency.value = 0.053;
    const sweep = ctx.createGain();
    sweep.gain.value = 300;
    tone.connect(sweep).connect(lp.frequency);

    const at = ctx.currentTime;
    air.start(at, Math.random() * 11);
    rustle.start(at, Math.random() * 9);
    lfo.start(at);
    tone.start(at);
    for (const s of [air, rustle, lfo, tone]) sources.add(s);
  }

  private rainSources(ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    this.rainBuffers ??= {
      hiss: seamlessNoise(ctx, 9.7, 0.35),
      drops: dropletLoop(ctx, 6.3, 70),
    };
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.rainBuffers.hiss;
    hiss.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 180;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.7;
    hiss.connect(lp).connect(hp).connect(hissGain).connect(dest);

    const drops = ctx.createBufferSource();
    drops.buffer = this.rainBuffers.drops;
    drops.loop = true;
    const dropHp = ctx.createBiquadFilter();
    dropHp.type = 'highpass';
    dropHp.frequency.value = 900;
    const dropGain = ctx.createGain();
    dropGain.gain.value = 0.22;
    drops.connect(dropHp).connect(dropGain).connect(dest);

    hiss.start();
    drops.start(ctx.currentTime, Math.random() * 6);
    sources.add(hiss);
    sources.add(drops);
  }


  /** Schedules one phrase of 2-4 chirps; returns its length in seconds. */
  private chirpPhrase(ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const chirp = (at: number, f0: number, f1: number, dur: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.exponentialRampToValueAtTime(f1, at + dur);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(1, at + 0.012);
      env.gain.setTargetAtTime(0, at + dur * 0.55, dur * 0.25);
      osc.connect(env).connect(dest);
      osc.start(at);
      osc.stop(at + dur + 0.12);
      osc.addEventListener('ended', () => env.disconnect());
      sources.add(osc);
    };

    const start = ctx.currentTime + 0.05;
    const notes = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 900;
    let at = start;
    for (let i = 0; i < notes; i++) {
      const dur = 0.07 + Math.random() * 0.06;
      const up = Math.random() < 0.6;
      const f0 = base * (up ? 1 : 1.35) * (1 + (Math.random() - 0.5) * 0.1);
      const f1 = base * (up ? 1.4 : 0.95);
      chirp(at, f0, f1, dur);
      at += dur + 0.06 + Math.random() * 0.09;
    }
    return at - start + 0.2;
  }

  /** One call from an animal; returns its length in seconds. */
  private phrase(id: ElementId, ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const length =
      id === 'squirrel'
        ? this.chitter(ctx, dest, sources)
        : id === 'dove'
          ? this.coo(ctx, dest, sources)
          : id === 'owl'
            ? this.hoot(ctx, dest, sources)
            : this.chirpPhrase(ctx, dest, sources);
    this.onCall?.(id, length * 1000);
    return length;
  }

  /** A soft, rounded tone gliding through `[time, Hz]` points, for doves and owls. */
  private voice(
    ctx: AudioContext,
    dest: AudioNode,
    sources: SourceSet,
    at: number,
    dur: number,
    curve: [number, number][],
    cutoff: number,
  ) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(curve[0][1], at);
    for (const [t, f] of curve.slice(1)) osc.frequency.linearRampToValueAtTime(f, at + t * dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(1, at + Math.min(0.08, dur * 0.25));
    env.gain.setTargetAtTime(0, at + dur * 0.7, dur * 0.12);
    osc.connect(lp).connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.3);
    osc.addEventListener('ended', () => env.disconnect());
    sources.add(osc);
  }

  /** The mourning dove's "coo-OO, oo, oo, oo". */
  private coo(ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const start = ctx.currentTime + 0.05;
    const k = 1 + (Math.random() - 0.5) * 0.08;
    const notes: [number, number, [number, number][]][] = [
      [0, 0.32, [[0, 470], [0.4, 540], [1, 520]]],
      [0.42, 0.75, [[0, 540], [0.3, 620], [1, 500]]],
      [1.45, 0.5, [[0, 490], [1, 460]]],
      [2.1, 0.5, [[0, 480], [1, 450]]],
      [2.75, 0.55, [[0, 470], [1, 440]]],
    ];
    for (const [t, dur, curve] of notes) {
      this.voice(ctx, dest, sources, start + t, dur, curve.map(([u, f]) => [u, f * k]), 900);
    }
    return 3.4;
  }

  /** A great horned owl: "hoo, hoo-hoo, hooo, hooo". */
  private hoot(ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const start = ctx.currentTime + 0.05;
    const base = 300 + Math.random() * 30;
    const notes: [number, number][] = [
      [0, 0.35],
      [0.75, 0.16],
      [0.98, 0.16],
      [1.45, 0.5],
      [2.2, 0.5],
    ];
    for (const [t, dur] of notes) {
      this.voice(ctx, dest, sources, start + t, dur, [[0, base * 1.04], [0.3, base], [1, base * 0.95]], 700);
    }
    return 2.9;
  }

  /** A squirrel's quick "chuk-chuk-chuk" with a rustle of leaves. */
  private chitter(ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const start = ctx.currentTime + 0.05;
    const n = 4 + Math.floor(Math.random() * 5);
    let at = start;
    for (let i = 0; i < n; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(3000, at);
      osc.frequency.exponentialRampToValueAtTime(1500, at + 0.03);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.8, at + 0.004);
      env.gain.setTargetAtTime(0, at + 0.012, 0.01);
      osc.connect(env).connect(dest);
      osc.start(at);
      osc.stop(at + 0.08);
      osc.addEventListener('ended', () => env.disconnect());
      sources.add(osc);
      at += 0.08 + Math.random() * 0.03;
    }
    this.rainBuffers ??= { hiss: seamlessNoise(ctx, 9.7, 0.35), drops: dropletLoop(ctx, 6.3, 70) };
    const rustle = ctx.createBufferSource();
    rustle.buffer = this.rainBuffers.hiss;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3500;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.25, at + 0.08);
    env.gain.setTargetAtTime(0, at + 0.25, 0.1);
    rustle.connect(bp).connect(env).connect(dest);
    rustle.start(at, Math.random() * 8);
    rustle.stop(at + 0.8);
    sources.add(rustle);
    return at - start + 0.6;
  }

  /** An animal that calls once soon after it appears, then every so often. */
  private createCaller(id: ElementId, ctx: AudioContext): Channel {
    const { gain, release } = this.output(id, ctx);
    const sources = new SourceSet();
    const [min, max] = CALL_GAP_S[id] ?? [10, 30];
    let timer = 0;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        this.phrase(id, ctx, gain, sources);
        schedule((min + Math.random() * (max - min)) * 1000);
      }, delay);
    };
    schedule(900 + Math.random() * 1500);
    return {
      gain,
      stop: () => {
        window.clearTimeout(timer);
        release(() => sources.stopAll());
      },
    };
  }

  /** One bell strike at `at`; returns how long it rings, in seconds. */
  private strike(ctx: AudioContext, dest: AudioNode, at: number, sources: SourceSet): number {
    if (this.bellSample) {
      const src = ctx.createBufferSource();
      src.buffer = this.bellSample;
      src.connect(dest);
      src.start(at);
      sources.add(src);
      return this.bellSample.duration;
    }
    return this.synthStrike(ctx, dest, at, sources);
  }

  /**
   * A large tuned bell: hum, prime, tierce, quint and nominal partials, with
   * doublets that beat slowly, plus a short metallic strike transient. Pitched
   * to the Great Bear Bell, which tolls the hours in low G.
   */
  private synthStrike(ctx: AudioContext, dest: AudioNode, at: number, sources: SourceSet): number {
    const prime = 196;
    const out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(dest);

    // ratio, amplitude, seconds to fade by 60 dB, doublet detune in Hz
    const partials: [number, number, number, number][] = [
      [0.5, 0.32, 14, 0.25],
      [1.0, 0.42, 9, 0.5],
      [1.183, 0.3, 7, 0.8],
      [1.506, 0.12, 5, 0],
      [2.0, 0.36, 5.5, 1.1],
      [2.514, 0.13, 3, 0],
      [2.662, 0.11, 2.6, 0],
      [3.011, 0.09, 2.2, 0],
      [4.166, 0.06, 1.4, 0],
      [5.433, 0.035, 0.9, 0],
      [6.796, 0.025, 0.6, 0],
    ];
    let longest = 0;
    for (const [ratio, amp, t60, detune] of partials) {
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(amp, at + 0.004);
      env.gain.setTargetAtTime(0, at + 0.004, t60 / 6.9);
      env.connect(out);
      const freqs = detune ? [prime * ratio, prime * ratio + detune] : [prime * ratio];
      for (const f of freqs) {
        const osc = ctx.createOscillator();
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 1 / freqs.length;
        osc.connect(g).connect(env);
        osc.start(at);
        osc.stop(at + t60);
        sources.add(osc);
      }
      longest = Math.max(longest, t60);
    }

    const noise = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 6));
    noise.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2600;
    band.Q.value = 1.2;
    const clang = ctx.createGain();
    clang.gain.value = 0.35;
    noise.connect(band).connect(clang).connect(out);
    noise.start(at);
    sources.add(noise);

    window.setTimeout(() => out.disconnect(), (at - ctx.currentTime + longest) * 1000 + 200);
    return longest;
  }

  private createBell(ctx: AudioContext): Channel {
    const { gain, release } = this.output('bell', ctx);
    const sources = new SourceSet();
    let timer = 0;

    const scheduleHour = (after: number) => {
      const due = nextHour(after);
      timer = window.setTimeout(() => {
        // Skip a ring that was delayed far past the hour, e.g. after sleep.
        const late = Date.now() - due.getTime();
        if (late < 60_000) {
          const n = strikesFor(due.getHours());
          for (let i = 0; i < n; i++) {
            this.strike(ctx, gain, ctx.currentTime + 0.05 + i * STRIKE_SPACING, sources);
          }
        }
        // Count from the hour just handled, so a timer that fires early can't repeat it
        // and one that fires very late (after sleep) catches up to the current hour.
        scheduleHour(Math.max(due.getTime(), Date.now()));
      }, Math.max(0, due.getTime() - Date.now()));
    };

    this.strike(ctx, gain, ctx.currentTime + 0.15, sources);
    scheduleHour(Date.now());

    return {
      gain,
      stop: () => {
        window.clearTimeout(timer);
        release(() => sources.stopAll());
      },
    };
  }
}
