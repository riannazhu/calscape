import type { ElementId, ElementState } from '../elements';

const FADE = 0.06;
const STOP_FADE = 0.12;
/** One isolated Campanile strike; the synthesised bell is used if it fails to load. */
const BELL_SAMPLE_URL = `${import.meta.env.BASE_URL}sounds/campanile.mp3`;
/** The tower tolls the hour with strikes about 4 s apart. */
const STRIKE_SPACING = 4;

/** Keeps the default mix modest: rain as a bed, bird and bell as accents. */
const BASE_LEVEL: Record<ElementId, number> = { rain: 0.55, bird: 0.22, bell: 0.4 };
const PAN: Record<ElementId, number> = { rain: 0, bird: -0.55, bell: -0.35 };
const REVERB_SEND: Record<ElementId, number> = { rain: 0, bird: 0.12, bell: 0.25 };

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
  private bellSample: AudioBuffer | null = null;
  onChirp: ((ms: number) => void) | null = null;

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
        const tau = id === 'rain' && ch.gain.gain.value === 0 && !s.muted ? 0.4 : FADE;
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
    // An unmuted rain loop already plays at the new level.
    if (id === 'rain' && !muted) return;
    this.previews.get(id)?.();

    const { gain, release } = this.output(id, ctx);
    gain.gain.value = volume * BASE_LEVEL[id];
    const sources = new SourceSet();
    let duration: number;
    if (id === 'bird') {
      duration = this.chirpPhrase(ctx, gain, sources);
    } else if (id === 'bell') {
      duration = this.strike(ctx, gain, ctx.currentTime + 0.02, sources);
    } else {
      duration = 1.8;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
      env.gain.setTargetAtTime(0, ctx.currentTime + 1.3, 0.15);
      env.connect(gain);
      this.rainSources(ctx, env, sources);
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
    switch (id) {
      case 'rain':
        return this.createRain(ctx);
      case 'bird':
        return this.createBird(ctx);
      case 'bell':
        return this.createBell(ctx);
    }
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

  private createRain(ctx: AudioContext): Channel {
    const { gain, release } = this.output('rain', ctx);
    const sources = new SourceSet();
    this.rainSources(ctx, gain, sources);
    return { gain, stop: () => release(() => sources.stopAll()) };
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
    const length = at - start + 0.2;
    this.onChirp?.(length * 1000);
    return length;
  }

  private createBird(ctx: AudioContext): Channel {
    const { gain, release } = this.output('bird', ctx);
    const sources = new SourceSet();
    let timer = 0;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        this.chirpPhrase(ctx, gain, sources);
        schedule(6000 + Math.random() * 12000);
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
