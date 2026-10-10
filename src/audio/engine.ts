import type { ElementId, ElementState } from '../elements';
import campanileUrl from './sounds/campanile.mp3';
import chatterUrl from './sounds/chatter.mp3';
import crowUrl from './sounds/crow.mp3';
import doveUrl from './sounds/dove.mp3';
import foghornUrl from './sounds/foghorn.mp3';
import geeseUrl from './sounds/geese.mp3';
import gullUrl from './sounds/gull.mp3';
import heronUrl from './sounds/heron.mp3';
import owlUrl from './sounds/owl.mp3';
import sealionsUrl from './sounds/sealions.mp3';
import sparrowUrl from './sounds/sparrow.mp3';
import typingUrl from './sounds/typing.mp3';
import wavesUrl from './sounds/waves.mp3';

const FADE = 0.06;
const STOP_FADE = 0.12;
/** The tower tolls the hour with strikes about 4 s apart. */
const STRIKE_SPACING = 4;
/** Recorded loops carry this much of their own end before the start and start after the end. */
const LOOP_PAD_S = 0.5;
/** A recorded loop fades in when it starts, which may be after its file finishes loading. */
const LOOP_FADE_IN_S = 0.8;

/**
 * Gain at full volume. Elements start at half, so these are twice the level
 * each sound is heard at when first added. Everything is background: rain
 * and breeze sit low as beds, and the animals call over them now and then.
 */
const BASE_LEVEL: Record<ElementId, number> = {
  rain: 0.3,
  bird: 0.14,
  bell: 0.795,
  squirrel: 0.12,
  dove: 0.32,
  wind: 0.477,
  crickets: 0.14,
  owl: 0.32,
  chatter: 0.48,
  typing: 0.37,
  sparrow: 0.2,
  crow: 0.24,
  waves: 0.6,
  foghorn: 0.39,
  gull: 0.36,
  geese: 0.55,
  heron: 0.8,
  sealions: 0.45,
};
/** Each sound comes from roughly where its sprite sits. */
const PAN: Record<ElementId, number> = {
  rain: 0,
  bird: 0,
  bell: -0.35,
  squirrel: -0.45,
  dove: -0.55,
  wind: 0,
  crickets: 0,
  owl: -0.55,
  chatter: 0.5,
  typing: -0.1,
  sparrow: 0.6,
  crow: 0.15,
  waves: 0.1,
  foghorn: 0.6,
  gull: -0.2,
  geese: 0.35,
  heron: -0.2,
  sealions: 0.55,
};
const REVERB_SEND: Record<ElementId, number> = {
  rain: 0,
  bird: 0.3,
  bell: 0.25,
  squirrel: 0.06,
  dove: 0.12,
  wind: 0,
  crickets: 0.15,
  owl: 0.18,
  chatter: 0.05,
  typing: 0,
  sparrow: 0.06,
  crow: 0.15,
  waves: 0.05,
  foghorn: 0.35,
  gull: 0.12,
  geese: 0.15,
  heron: 0.15,
  sealions: 0.12,
};
/** Elements that play a steady loop rather than scheduled events. */
const LOOPED = new Set<ElementId>(['rain', 'crickets', 'wind', 'chatter', 'typing', 'waves']);
/** Loops that play a recording; they stay silent if it can't load. */
const RECORDED_LOOPS = new Set<ElementId>(['chatter', 'waves']);
/** Callers with a synthesised stand-in for when their recording can't load. */
const SYNTH_CALLS = new Set<ElementId>(['bird', 'squirrel', 'dove', 'owl']);
/** Animals that call now and then: seconds between calls, shortest to longest. */
const CALL_GAP_S: Partial<Record<ElementId, [number, number]>> = {
  bird: [20, 40],
  squirrel: [20, 50],
  dove: [25, 60],
  owl: [30, 75],
  sparrow: [8, 20],
  crow: [20, 45],
  gull: [8, 22],
  geese: [30, 70],
  heron: [35, 80],
  sealions: [15, 40],
  foghorn: [60, 120],
};
/**
 * Callers heard as a group rather than one animal: how many individuals, how
 * far apart they sit in the stereo field, how many calls each burst holds,
 * and the seconds between calls within a burst.
 */
interface Flock {
  voices: number;
  spread: number;
  calls: [number, number];
  gap: [number, number];
}
const FLOCKS: Partial<Record<ElementId, Flock>> = {
  gull: { voices: 5, spread: 0.7, calls: [2, 4], gap: [0.8, 3.5] },
  geese: { voices: 5, spread: 0.45, calls: [2, 5], gap: [0.4, 1.8] },
  sealions: { voices: 6, spread: 0.45, calls: [3, 6], gap: [0.2, 1.2] },
  sparrow: { voices: 3, spread: 0.5, calls: [1, 3], gap: [0.8, 3] },
  crow: { voices: 3, spread: 0.6, calls: [1, 3], gap: [1, 3] },
};
/**
 * One of the Glade's songbirds: where it sits, how high it sings, which song,
 * how loud, and how far off (the highest frequency that reaches you).
 */
interface Songbird {
  pan: number;
  pitch: number;
  song: 'whistle' | 'trill' | 'warble';
  level: number;
  muffle: number;
}
/** The first is the perched bird; the rest sing from the trees around the Glade. */
const SONGBIRDS: Songbird[] = [
  { pan: -0.55, pitch: 3000, song: 'warble', level: 0.8, muffle: 9000 },
  { pan: -0.85, pitch: 3700, song: 'trill', level: 0.45, muffle: 4500 },
  { pan: 0.75, pitch: 2600, song: 'whistle', level: 0.5, muffle: 5000 },
  { pan: 0.3, pitch: 3300, song: 'warble', level: 0.35, muffle: 3800 },
  { pan: -0.25, pitch: 4100, song: 'trill', level: 0.3, muffle: 3500 },
  { pan: 0.95, pitch: 2900, song: 'warble', level: 0.4, muffle: 4200 },
];
/**
 * Someone typing: bursts of a few seconds cut from the recording, then a
 * pause. `stop` is the chance a pause is a long one, to think or read.
 */
interface Typist extends Voice {
  burst: [number, number];
  stop: number;
  /** Lowpass cutoff in Hz: further keyboards lose their click. */
  muffle: number;
}
/**
 * The man at the centre table, and keyboards at tables all around the patio,
 * each its own pitch, distance and rhythm, so together they make a steady
 * bed of typing rather than one person.
 */
const TYPISTS: Typist[] = [
  { pan: -0.1, rate: 1, level: 1, burst: [1.2, 6], stop: 0.15, muffle: 16000 },
  { pan: 0.55, rate: 0.93, level: 0.5, burst: [1.5, 5], stop: 0.25, muffle: 7000 },
  { pan: -0.65, rate: 1.06, level: 0.45, burst: [1, 4.5], stop: 0.3, muffle: 6000 },
  { pan: 0.25, rate: 0.97, level: 0.35, burst: [2, 7], stop: 0.2, muffle: 4500 },
  { pan: -0.35, rate: 0.9, level: 0.3, burst: [1, 4], stop: 0.35, muffle: 3800 },
  { pan: 0.85, rate: 1.1, level: 0.25, burst: [1.5, 5], stop: 0.3, muffle: 3200 },
];
/** One animal in a flock: where it sits, how high its voice is, how loud. */
interface Voice {
  pan: number;
  rate: number;
  level: number;
}

/** The individuals in a flock, spaced evenly across its spread; a lone animal has one plain voice. */
function flockVoices(id: ElementId): Voice[] {
  const flock = FLOCKS[id];
  if (!flock) return [{ pan: 0, rate: 1, level: 1 }];
  return Array.from({ length: flock.voices }, (_, i) => ({
    pan: flock.spread * ((i / (flock.voices - 1)) * 2 - 1),
    rate: 0.88 + Math.random() * 0.24,
    level: 0.5 + Math.random() * 0.4,
  }));
}
/**
 * Recordings in ./sounds. If one fails to load, a Glade element falls back to
 * its synthesised sound and any other stays silent.
 */
const SAMPLE_URLS: Partial<Record<ElementId, string>> = {
  bell: campanileUrl,
  owl: owlUrl,
  dove: doveUrl,
  chatter: chatterUrl,
  typing: typingUrl,
  waves: wavesUrl,
  sparrow: sparrowUrl,
  crow: crowUrl,
  gull: gullUrl,
  geese: geeseUrl,
  heron: heronUrl,
  sealions: sealionsUrl,
  foghorn: foghornUrl,
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

const addPanned = (left: Float32Array, right: Float32Array, at: number, v: number, pan: number) => {
  const i = ((at % left.length) + left.length) % left.length;
  left[i] += v * (1 - pan) * 0.5;
  right[i] += v * (1 + pan) * 0.5;
};

/**
 * A night field of crickets. A few nearby field crickets each chirp on a
 * steady beat, three or four quick pulses near 4–5 kHz every half-second to
 * a second, sometimes pausing for a few beats. Behind them, fainter distant
 * crickets keep their own steady beats, over a hush of tree-cricket trill.
 * Every beat repeats a whole number of times per loop so it wraps without a
 * seam.
 */
function cricketLoop(ctx: AudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  const chirper = (freq: number, period: number, pulses: number, amp: number, pan: number, rests: boolean) => {
    const count = Math.round(seconds / period);
    const step = len / count;
    const offset = Math.random() * step;
    const pulse = Math.floor(sr * 0.016);
    const gap = Math.floor(sr * 0.016);
    const restFrom = rests ? Math.floor(Math.random() * count) : -1;
    const restBeats = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < count; k++) {
      if (restFrom >= 0 && (k - restFrom + count) % count < restBeats) continue;
      const start = Math.floor(offset + k * step + (Math.random() - 0.5) * sr * 0.006);
      for (let n = 0; n < pulses; n++) {
        const level = amp * (n === 0 ? 0.75 : 1);
        for (let i = 0; i < pulse; i++) {
          const env = Math.sin((Math.PI * i) / pulse) ** 2;
          const f = freq * (1 - 0.02 * (i / pulse));
          addPanned(left, right, start + n * (pulse + gap) + i, level * env * Math.sin((2 * Math.PI * f * i) / sr), pan);
        }
      }
    }
  };

  chirper(4500, 0.62, 3, 0.55, -0.35, false);
  chirper(4300, 0.85, 4, 0.4, 0.45, true);
  chirper(4750, 1.05, 3, 0.3, 0.1, true);
  for (let v = 0; v < 8; v++) {
    chirper(3900 + Math.random() * 1200, 0.5 + Math.random() * 0.6, 3, 0.07 + Math.random() * 0.07, Math.random() * 1.6 - 0.8, false);
  }

  for (const [hz, rate, pan] of [
    [2900, 38, -0.5],
    [3150, 44, 0.6],
  ]) {
    const f = Math.round(hz * seconds) / seconds;
    const r = Math.round(rate * seconds) / seconds;
    const swellCycles = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const pulse = (0.5 + 0.5 * Math.sin(2 * Math.PI * r * t)) ** 4;
      const swell = 0.6 + 0.4 * Math.sin((2 * Math.PI * swellCycles * i) / len);
      addPanned(left, right, i, 0.04 * pulse * swell * Math.sin(2 * Math.PI * f * t), pan);
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
function strikesFor(hour24: number): number {
  return hour24 % 12 === 0 ? 12 : hour24 % 12;
}

/** Tracks scheduled sources so a channel can stop everything it started. */
class SourceSet {
  private live = new Set<Source>();
  stopped = false;
  add(s: Source) {
    this.live.add(s);
    s.addEventListener('ended', () => this.live.delete(s));
  }
  stopAll() {
    this.stopped = true;
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
  private samples: Partial<Record<ElementId, AudioBuffer>> = {};
  /** Settles once a recording has loaded or failed. */
  private loading: Partial<Record<ElementId, Promise<void>>> = {};
  /** Lets the scene animate an animal while it calls. */
  onCall: ((id: ElementId, ms: number, voice?: number, delayMs?: number) => void) | null = null;

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
      for (const [id, url] of Object.entries(SAMPLE_URLS)) this.loading[id as ElementId] = this.loadSample(ctx, id as ElementId, url);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private async loadSample(ctx: AudioContext, id: ElementId, url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.headers.get('content-type')?.startsWith('audio')) return;
      this.samples[id] = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      // No recording available; keep the synthesised sound.
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
      duration = this.phrase(id, ctx, gain, sources, flockVoices(id));
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
    if (id === 'chatter') this.clinks(ctx, dest, sources);
    if (RECORDED_LOOPS.has(id)) return this.recordedLoop(id, ctx, dest, sources);
    switch (id) {
      case 'typing':
        return this.typingSources(ctx, dest, sources);
      case 'crickets':
        return this.cricketSources(ctx, dest, sources);
      case 'wind':
        return this.windSources(ctx, dest, sources);
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

  /** Loops a padded recording between its pad points, from a random place, once it has loaded. */
  private recordedLoop(id: ElementId, ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    const start = (buffer: AudioBuffer, voice: Voice) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = LOOP_PAD_S;
      src.loopEnd = buffer.duration - LOOP_PAD_S;
      src.playbackRate.value = voice.rate;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.setTargetAtTime(voice.level, ctx.currentTime, LOOP_FADE_IN_S / 3);
      const pan = ctx.createStereoPanner();
      pan.pan.value = voice.pan;
      src.connect(env).connect(pan).connect(dest);
      src.addEventListener('ended', () => pan.disconnect());
      src.start(ctx.currentTime, LOOP_PAD_S + Math.random() * (buffer.duration - 2 * LOOP_PAD_S));
      sources.add(src);
    };
    void this.whenLoaded(id).then(() => {
      const buffer = this.samples[id];
      if (!buffer || sources.stopped) return;
      start(buffer, { pan: 0, rate: 1, level: 1 });
    });
  }

  /**
   * Typing as someone actually types: bursts cut from the recording, with
   * short pauses between phrases and now and then a long one. The centre
   * table's typist tells the scene when his hands are on the keys.
   */
  private typingSources(ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    void this.whenLoaded('typing').then(() => {
      const buffer = this.samples.typing;
      if (!buffer || sources.stopped) return;
      TYPISTS.forEach((t, i) => this.typingVoice(buffer, t, i === 0, ctx, dest, sources, i === 0 ? 0 : 0.3 + Math.random() * 5));
    });
  }

  private typingVoice(
    buffer: AudioBuffer,
    t: Typist,
    seen: boolean,
    ctx: AudioContext,
    dest: AudioNode,
    sources: SourceSet,
    delay: number,
  ) {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const burst = () => {
      if (sources.stopped) return;
      const dur = rand(...t.burst);
      const offset = LOOP_PAD_S + Math.random() * Math.max(0, buffer.duration - 2 * LOOP_PAD_S - dur);
      const rate = t.rate * rand(0.97, 1.03);
      const len = dur / rate;
      const level = t.level * rand(0.7, 1.1);
      const at = ctx.currentTime + 0.02;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(level, at + 0.03);
      env.gain.setValueAtTime(level, at + len - 0.08);
      env.gain.linearRampToValueAtTime(0, at + len);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = t.muffle;
      const pan = ctx.createStereoPanner();
      pan.pan.value = t.pan;
      src.connect(lp).connect(env).connect(pan).connect(dest);
      src.addEventListener('ended', () => pan.disconnect());
      src.start(at, offset, dur);
      sources.add(src);
      if (seen) this.onCall?.('typing', len * 1000);
      const r = Math.random();
      const pause = r < t.stop ? rand(6, 14) : r < 0.5 ? rand(1.5, 4) : rand(0.25, 1);
      window.setTimeout(burst, (len + pause) * 1000);
    };
    window.setTimeout(burst, delay * 1000);
  }

  /**
   * Cups and spoons around the café, over the chatter: a spoon tapping a cup
   * rim, a quick stir, or a cup set down on its saucer, each a few ringing
   * porcelain partials over a tiny strike, from somewhere across the patio.
   */
  private clinks(ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const ring = (out: AudioNode, at: number, f: number, partials: [number, number, number][], level: number) => {
      for (const [ratio, amp, decay] of partials) {
        const osc = ctx.createOscillator();
        osc.frequency.value = f * ratio * rand(0.995, 1.005);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(level * amp, at + 0.002);
        env.gain.setTargetAtTime(0, at + 0.002, decay);
        osc.connect(env).connect(out);
        osc.start(at);
        osc.stop(at + 0.002 + decay * 6);
        osc.addEventListener('ended', () => env.disconnect());
        sources.add(osc);
      }
      const tick = ctx.createBufferSource();
      tick.buffer = this.rain(ctx).hiss;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const env = ctx.createGain();
      env.gain.setValueAtTime(level * 0.25, at);
      env.gain.setTargetAtTime(0, at, 0.003);
      tick.connect(hp).connect(env).connect(out);
      tick.start(at, Math.random() * 8, 0.03);
      sources.add(tick);
    };
    const RIM: [number, number, number][] = [
      [1, 1, 0.22],
      [2.32, 0.55, 0.11],
      [4.1, 0.3, 0.06],
      [6.3, 0.15, 0.035],
    ];
    const SAUCER: [number, number, number][] = [
      [1, 1, 0.09],
      [2.08, 0.5, 0.05],
      [3.45, 0.25, 0.03],
    ];
    const event = () => {
      if (sources.stopped) return;
      // Mostly from tables further off: muffled and low, sunk into the murmur.
      const near = Math.random() ** 2;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200 + near * 3800;
      const pan = ctx.createStereoPanner();
      pan.pan.value = rand(-0.7, 0.8);
      lp.connect(pan).connect(dest);
      const level = 0.04 + near * 0.12;
      const at = ctx.currentTime + 0.05;
      const kind = Math.random();
      let len = 1.5;
      if (kind < 0.55) {
        ring(lp, at, rand(2300, 3600), RIM, level);
      } else if (kind < 0.7) {
        const f = rand(2400, 3400);
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) ring(lp, at + i * rand(0.11, 0.2), f * rand(0.98, 1.02), RIM, level * rand(0.4, 0.8));
        len += n * 0.2;
      } else {
        ring(lp, at, rand(1100, 1600), SAUCER, level * 0.9);
        if (Math.random() < 0.5) ring(lp, at + rand(0.04, 0.09), rand(1100, 1600), SAUCER, level * 0.4);
      }
      window.setTimeout(() => pan.disconnect(), len * 1000 + 500);
      window.setTimeout(event, rand(4, 13) * 1000);
    };
    window.setTimeout(event, rand(0.5, 2.5) * 1000);
  }

  private whenLoaded(id: ElementId) {
    return this.loading[id] ?? Promise.resolve();
  }

  private createLoop(id: ElementId, ctx: AudioContext): Channel {
    const { gain, release } = this.output(id, ctx);
    const sources = new SourceSet();
    this.loopSources(id, ctx, gain, sources);
    return { gain, stop: () => release(() => sources.stopAll()) };
  }

  private cricketSources(ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    this.cricketBuffer ??= cricketLoop(ctx, 13.2);
    this.bufferLoop(this.cricketBuffer, 'highpass', 2200, ctx, dest, sources);
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
    lp.frequency.value = 480;
    lp.Q.value = 0.5;
    const gust = ctx.createGain();
    gust.gain.value = 0.6;
    air.connect(lp).connect(gust).connect(dest);

    const rustle = ctx.createBufferSource();
    rustle.buffer = this.rain(ctx).hiss;
    rustle.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const rustleGain = ctx.createGain();
    rustleGain.gain.value = 0.025;
    rustle.connect(hp).connect(rustleGain).connect(dest);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const depth = ctx.createGain();
    depth.gain.value = 0.15;
    lfo.connect(depth).connect(gust.gain);
    const rustleDepth = ctx.createGain();
    rustleDepth.gain.value = 0.015;
    lfo.connect(rustleDepth).connect(rustleGain.gain);

    const tone = ctx.createOscillator();
    tone.frequency.value = 0.053;
    const sweep = ctx.createGain();
    sweep.gain.value = 140;
    tone.connect(sweep).connect(lp.frequency);

    const at = ctx.currentTime;
    air.start(at, Math.random() * 11);
    rustle.start(at, Math.random() * 9);
    lfo.start(at);
    tone.start(at);
    for (const s of [air, rustle, lfo, tone]) sources.add(s);
  }

  /** The rain's noise buffers, built once; the hiss also serves rustles and breath. */
  private rain(ctx: AudioContext) {
    return (this.rainBuffers ??= { hiss: seamlessNoise(ctx, 9.7, 0.35), drops: dropletLoop(ctx, 6.3, 70) });
  }

  private rainSources(ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.rain(ctx).hiss;
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
    drops.buffer = this.rain(ctx).drops;
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


  /** One whistled syllable gliding through `[fraction, Hz]` points. */
  private chirp(ctx: AudioContext, dest: AudioNode, sources: SourceSet, at: number, dur: number, curve: [number, number][]) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(curve[0][1], at);
    for (const [u, f] of curve.slice(1)) osc.frequency.exponentialRampToValueAtTime(f, at + u * dur);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(1, at + Math.min(0.012, dur / 4));
    env.gain.setValueAtTime(1, at + dur * 0.6);
    env.gain.setTargetAtTime(0, at + dur * 0.6, dur * 0.15);
    osc.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.1);
    osc.addEventListener('ended', () => env.disconnect());
    sources.add(osc);
  }

  /** One song from one songbird starting at `start`; returns its length in seconds. */
  private song(bird: Songbird, ctx: AudioContext, dest: AudioNode, sources: SourceSet, start: number): number {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const f = bird.pitch * rand(0.97, 1.03);
    let at = 0;
    const note = (dur: number, curve: [number, number][], gap: number) => {
      this.chirp(ctx, dest, sources, start + at, dur, curve);
      at += dur + gap;
    };
    switch (bird.song) {
      case 'whistle': {
        // Clear slurred notes, "fee-bee-bee": a high one, then a few lower.
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const p = i === 0 ? 1.25 : 0.95 - i * 0.03;
          note(rand(0.26, 0.4), [[0, f * p * 1.04], [0.3, f * p], [1, f * p * 0.88]], rand(0.1, 0.22));
        }
        break;
      }
      case 'trill': {
        // Quick even notes on one pitch that sinks a little, like a junco.
        const n = 10 + Math.floor(Math.random() * 9);
        const step = rand(0.055, 0.07);
        for (let i = 0; i < n; i++) {
          const g = f * (1.1 - (i / n) * 0.18);
          note(step * 0.7, [[0, g * 1.18], [1, g * 0.85]], step * 0.3);
        }
        break;
      }
      case 'warble': {
        // Quick varied syllables wandering up and down, ending in a down-slur, like a house finch.
        const n = 7 + Math.floor(Math.random() * 7);
        let p = 1;
        for (let i = 0; i < n; i++) {
          p = Math.min(1.45, Math.max(0.75, p * rand(0.8, 1.25)));
          const curve: [number, number][] =
            Math.random() < 0.5 ? [[0, f * p * 0.9], [1, f * p * 1.15]] : [[0, f * p * 1.15], [1, f * p * 0.88]];
          note(rand(0.06, 0.14), curve, rand(0.025, 0.075));
        }
        note(0.24, [[0, f * 1.3], [1, f * 0.78]], 0);
        break;
      }
    }
    return at;
  }

  /**
   * Many songbirds singing around the Glade, mostly at a distance: songs
   * overlap loosely, each bird rarely twice in a row, and the perched bird
   * sings once somewhere in the chorus. Tells the scene when the perched bird
   * sings. Returns the chorus length in seconds.
   */
  private chorus(ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const start = ctx.currentTime + 0.05;
    const count = 6 + Math.floor(Math.random() * 6);
    const perched = Math.floor(Math.random() * Math.min(3, count));
    let at = 0;
    let end = 0;
    let last = -1;
    for (let i = 0; i < count; i++) {
      let v = i === perched ? 0 : 1 + Math.floor(Math.random() * (SONGBIRDS.length - 1));
      if (v === last && v !== 0) v = 1 + (v % (SONGBIRDS.length - 1));
      last = v;
      const bird = SONGBIRDS[v];
      const out = ctx.createGain();
      out.gain.value = bird.level * (0.8 + Math.random() * 0.3);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = bird.muffle;
      const pan = ctx.createStereoPanner();
      pan.pan.value = bird.pan;
      out.connect(lp).connect(pan).connect(dest);
      const len = this.song(bird, ctx, out, sources, start + at);
      const delay = start + at - ctx.currentTime;
      window.setTimeout(() => {
        out.disconnect();
        lp.disconnect();
        pan.disconnect();
      }, (delay + len) * 1000 + 500);
      if (v === 0) this.onCall?.('bird', len * 1000, 0, delay * 1000);
      end = Math.max(end, at + len);
      at += Math.max(0.3, len * (0.3 + Math.random() * 0.9) + Math.random() * 0.6);
    }
    return end + 0.2;
  }

  /** One call from an animal, or a burst from a flock; returns its length in seconds. */
  private phrase(id: ElementId, ctx: AudioContext, dest: AudioNode, sources: SourceSet, voices: Voice[]): number {
    const sample = this.samples[id];
    if (!sample && !SYNTH_CALLS.has(id)) return 0;
    const flock = FLOCKS[id];
    const length = sample
      ? flock
        ? this.flockBurst(flock, voices, sample, ctx, dest, sources)
        : this.playSample(sample, ctx, dest, sources)
      : id === 'squirrel'
        ? this.chitter(ctx, dest, sources)
        : id === 'dove'
          ? this.coo(ctx, dest, sources)
          : id === 'owl'
            ? this.hoot(ctx, dest, sources)
            : this.chorus(ctx, dest, sources);
    this.onCall?.(id, length * 1000);
    return length;
  }

  /**
   * A few calls from different members of a flock, spread out and sometimes
   * overlapping. Each is a stretch of the recording, pitched and placed for
   * the animal calling.
   */
  private flockBurst(flock: Flock, voices: Voice[], buffer: AudioBuffer, ctx: AudioContext, dest: AudioNode, sources: SourceSet) {
    const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a);
    const count = Math.round(rand([flock.calls[0] - 0.49, flock.calls[1] + 0.49]));
    let at = 0;
    let end = 0;
    let last = -1;
    for (let i = 0; i < count; i++) {
      let v = Math.floor(Math.random() * voices.length);
      if (v === last) v = (v + 1) % voices.length;
      last = v;
      const { pan, rate, level } = voices[v];
      const long = buffer.duration > 2;
      const offset = long ? Math.random() * buffer.duration * 0.5 : 0;
      const dur = long ? Math.min(buffer.duration - offset, 1.2 + Math.random() * 2) : buffer.duration;
      const when = ctx.currentTime + 0.05 + at;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(level, when + 0.03);
      env.gain.setValueAtTime(level, when + dur / rate - 0.15);
      env.gain.linearRampToValueAtTime(0, when + dur / rate);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      src.connect(env).connect(panner).connect(dest);
      src.start(when, offset, dur);
      src.addEventListener('ended', () => {
        env.disconnect();
        panner.disconnect();
      });
      sources.add(src);
      end = Math.max(end, at + dur / rate);
      at += rand(flock.gap);
    }
    return end;
  }

  private playSample(buffer: AudioBuffer, ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);
    src.start(ctx.currentTime + 0.05);
    sources.add(src);
    return buffer.duration;
  }

  /**
   * One steady, nearly pure note gliding through `[fraction, Hz]` points, as
   * doves and owls call: a quick onset, an even hold and a short release, with
   * no vibrato. `overtone` is the level of the second harmonic; `breath` adds
   * a trace of air at the fundamental.
   */
  private note(
    ctx: AudioContext,
    dest: AudioNode,
    sources: SourceSet,
    at: number,
    dur: number,
    curve: [number, number][],
    overtone: number,
    breath: number,
  ) {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(3), new Float32Array([0, 1, overtone])));
    osc.frequency.setValueAtTime(curve[0][1], at);
    for (const [u, f] of curve.slice(1)) osc.frequency.linearRampToValueAtTime(f, at + u * dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(1, at + 0.045);
    env.gain.linearRampToValueAtTime(0.85, at + dur - 0.09);
    env.gain.linearRampToValueAtTime(0, at + dur);
    osc.connect(env);

    if (breath > 0) {
      const air = ctx.createBufferSource();
      air.buffer = this.rain(ctx).hiss;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = curve[0][1];
      band.Q.value = 6;
      const airGain = ctx.createGain();
      airGain.gain.value = breath;
      air.connect(band).connect(airGain).connect(env);
      air.start(at, Math.random() * 8);
      air.stop(at + dur);
      sources.add(air);
    }

    env.connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.02);
    osc.addEventListener('ended', () => env.disconnect());
    sources.add(osc);
  }

  /**
   * The mourning dove's perch-coo, "oo-WOO-oo, oo, oo": an introductory note
   * that starts low, sweeps up past the main pitch and settles back, then three
   * steady notes on one pitch near 525 Hz, each with a short glide in and out.
   * Measured songs span about 470 to 740 Hz, loudest near 527 Hz.
   */
  private coo(ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const start = ctx.currentTime + 0.05;
    const f = 525 * (1 + (Math.random() - 0.5) * 0.05);
    const steady: [number, number][] = [
      [0, f * 0.9],
      [0.12, f],
      [0.85, f * 0.99],
      [1, f * 0.92],
    ];
    this.note(ctx, dest, sources, start, 0.8, [[0, f * 0.9], [0.15, f * 0.95], [0.45, f * 1.38], [0.7, f * 1.2], [1, f * 0.98]], 0.04, 0);
    let at = start + 1.2;
    for (const dur of [0.55, 0.55, 0.6]) {
      this.note(ctx, dest, sources, at, dur, steady, 0.04, 0);
      at += dur + 0.3;
    }
    return at - start;
  }

  /**
   * A great horned owl's territorial hoot, "hoo, hoo-hoo, hoo, hoo": low,
   * narrow-band notes near 310 Hz, the second and third short and quick.
   */
  private hoot(ctx: AudioContext, dest: AudioNode, sources: SourceSet): number {
    const start = ctx.currentTime + 0.05;
    const f = 300 + Math.random() * 25;
    const notes: [number, number][] = [
      [0, 0.3],
      [0.52, 0.12],
      [0.68, 0.13],
      [1.08, 0.36],
      [1.66, 0.32],
    ];
    for (const [t, dur] of notes) {
      this.note(ctx, dest, sources, start + t, dur, [[0, f * 0.94], [0.2, f], [0.75, f], [1, f * 0.9]], 0.15, 0.08);
    }
    return 2.1;
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
    const rustle = ctx.createBufferSource();
    rustle.buffer = this.rain(ctx).hiss;
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

  /** An animal that calls as soon as it appears, then every so often. */
  private createCaller(id: ElementId, ctx: AudioContext): Channel {
    const { gain, release } = this.output(id, ctx);
    const sources = new SourceSet();
    const [min, max] = CALL_GAP_S[id] ?? [10, 30];
    const voices = flockVoices(id);
    let timer = 0;
    let stopped = false;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        this.phrase(id, ctx, gain, sources, voices);
        schedule((min + Math.random() * (max - min)) * 1000);
      }, delay);
    };
    void this.whenLoaded(id).then(() => {
      if (!stopped) schedule(60);
    });
    return {
      gain,
      stop: () => {
        stopped = true;
        window.clearTimeout(timer);
        release(() => sources.stopAll());
      },
    };
  }

  /** One bell strike at `at`; returns how long it rings, in seconds. */
  private strike(ctx: AudioContext, dest: AudioNode, at: number, sources: SourceSet): number {
    const sample = this.samples.bell;
    if (sample) {
      const src = ctx.createBufferSource();
      src.buffer = sample;
      src.connect(dest);
      src.start(at);
      sources.add(src);
      return sample.duration;
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

// Fast Refresh keeps the running engine (and its loaded recordings) in App's
// ref, so an edit here only takes effect after a full reload.
import.meta.hot?.accept(() => location.reload());
