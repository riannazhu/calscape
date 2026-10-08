import type { ElementId, ElementState } from '../elements';

const FADE = 0.06;
const STOP_FADE = 0.12;
const BERKELEY_TZ = 'America/Los_Angeles';

/** Keeps the default mix modest: rain as a bed, bird and bell as accents. */
const BASE_LEVEL: Record<ElementId, number> = { rain: 0.55, bird: 0.22, bell: 0.32 };
const PAN: Record<ElementId, number> = { rain: 0, bird: 0.45, bell: -0.45 };

interface Channel {
  gain: GainNode;
  stop(): void;
}

type ChirpListener = (ms: number) => void;

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
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    for (let i = 0; i < len; i++) out[i] /= peak || 1;
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
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    for (let i = 0; i < len; i++) out[i] /= peak || 1;
  }
  return buf;
}

function berkeleyHour12(date: Date): number {
  const h = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: BERKELEY_TZ })
      .formatToParts(date)
      .find((p) => p.type === 'hour')?.value ?? 0,
  );
  return h % 12 === 0 ? 12 : h % 12;
}

/** Milliseconds until the next top of the hour in Berkeley time. */
function msUntilNextHour(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    minute: 'numeric',
    second: 'numeric',
    timeZone: BERKELEY_TZ,
  }).formatToParts(now);
  const min = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const sec = Number(parts.find((p) => p.type === 'second')?.value ?? 0);
  return ((59 - min) * 60 + (60 - sec)) * 1000 - now.getMilliseconds();
}

/**
 * Owns the AudioContext and one channel per present element. `sync` is
 * idempotent, so React rerenders can never start a second loop.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterLevel = 1;
  private channels = new Map<ElementId, Channel>();
  private buffers: { hiss: AudioBuffer; drops: AudioBuffer } | null = null;
  onChirp: ChirpListener | null = null;

  /** Must be called from a user gesture before audio can play. */
  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'playback' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.masterLevel;
      this.master.connect(ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMaster(level: number) {
    this.masterLevel = level;
    if (this.ctx && this.master) rampTo(this.master.gain, level, this.ctx);
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
        continue;
      }
      if (ch) {
        const target = s.muted ? 0 : s.volume * BASE_LEVEL[id];
        const tau = id === 'rain' && ch.gain.gain.value === 0 && !s.muted ? 0.4 : FADE;
        rampTo(ch.gain.gain, target, ctx, tau);
      }
    }
  }

  private output(id: ElementId, ctx: AudioContext) {
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = PAN[id];
    gain.connect(pan).connect(this.master!);
    const release = (cleanup: () => void) => {
      rampTo(gain.gain, 0, ctx, STOP_FADE / 3);
      window.setTimeout(() => {
        cleanup();
        gain.disconnect();
        pan.disconnect();
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

  private createRain(ctx: AudioContext): Channel {
    this.buffers ??= {
      hiss: seamlessNoise(ctx, 9.7, 0.35),
      drops: dropletLoop(ctx, 6.3, 70),
    };
    const { gain, release } = this.output('rain', ctx);

    const hiss = ctx.createBufferSource();
    hiss.buffer = this.buffers.hiss;
    hiss.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 180;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.7;
    hiss.connect(lp).connect(hp).connect(hissGain).connect(gain);

    const drops = ctx.createBufferSource();
    drops.buffer = this.buffers.drops;
    drops.loop = true;
    const dropHp = ctx.createBiquadFilter();
    dropHp.type = 'highpass';
    dropHp.frequency.value = 900;
    const dropGain = ctx.createGain();
    dropGain.gain.value = 0.22;
    drops.connect(dropHp).connect(dropGain).connect(gain);

    hiss.start();
    drops.start(ctx.currentTime, Math.random() * 6);

    return {
      gain,
      stop: () =>
        release(() => {
          hiss.stop();
          drops.stop();
          hiss.disconnect();
          drops.disconnect();
        }),
    };
  }

  private createBird(ctx: AudioContext): Channel {
    const { gain, release } = this.output('bird', ctx);
    const live = new Set<OscillatorNode>();
    let timer = 0;

    const chirp = (at: number, f0: number, f1: number, dur: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.exponentialRampToValueAtTime(f1, at + dur);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(1, at + 0.012);
      env.gain.setTargetAtTime(0, at + dur * 0.55, dur * 0.25);
      osc.connect(env).connect(gain);
      osc.start(at);
      osc.stop(at + dur + 0.12);
      live.add(osc);
      osc.onended = () => {
        live.delete(osc);
        env.disconnect();
      };
    };

    const phrase = () => {
      const notes = 2 + Math.floor(Math.random() * 3);
      const base = 2600 + Math.random() * 900;
      let at = ctx.currentTime + 0.05;
      for (let i = 0; i < notes; i++) {
        const dur = 0.07 + Math.random() * 0.06;
        const up = Math.random() < 0.6;
        const f0 = base * (up ? 1 : 1.35) * (1 + (Math.random() - 0.5) * 0.1);
        const f1 = base * (up ? 1.4 : 0.95);
        chirp(at, f0, f1, dur);
        at += dur + 0.06 + Math.random() * 0.09;
      }
      this.onChirp?.((at - ctx.currentTime) * 1000);
    };

    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        phrase();
        schedule(6000 + Math.random() * 12000);
      }, delay);
    };
    schedule(900 + Math.random() * 1500);

    return {
      gain,
      stop: () => {
        window.clearTimeout(timer);
        release(() => {
          for (const o of live) o.stop();
          live.clear();
        });
      },
    };
  }

  private createBell(ctx: AudioContext): Channel {
    const { gain, release } = this.output('bell', ctx);
    const live = new Set<OscillatorNode>();
    let timer = 0;

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    tone.connect(gain);

    // Partials of a large tuned bell: hum, prime, tierce, quint, nominal and upper.
    const partials: [ratio: number, amp: number, decay: number][] = [
      [0.5, 0.35, 5.5],
      [1, 0.5, 3.6],
      [1.19, 0.22, 2.6],
      [1.5, 0.16, 2.2],
      [2, 0.28, 1.8],
      [2.52, 0.08, 1.1],
      [3.01, 0.06, 0.8],
    ];
    const strike = (at: number) => {
      const f = 233;
      for (const [ratio, amp, decay] of partials) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.frequency.value = f * ratio;
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(amp, at + 0.008);
        env.gain.setTargetAtTime(0, at + 0.01, decay / 3);
        osc.connect(env).connect(tone);
        osc.start(at);
        osc.stop(at + decay * 2.2);
        live.add(osc);
        osc.onended = () => {
          live.delete(osc);
          env.disconnect();
        };
      }
    };

    const scheduleHour = () => {
      // Look 2 s ahead so a timer that fires slightly early cannot ring the same hour twice.
      const wait = msUntilNextHour(new Date(Date.now() + 2000)) + 2000;
      const due = Date.now() + wait;
      timer = window.setTimeout(() => {
        // Skip a ring that was delayed far past the hour, e.g. after sleep.
        if (Date.now() - due < 60_000) {
          const n = berkeleyHour12(new Date(due + 30_000));
          for (let i = 0; i < n; i++) strike(ctx.currentTime + 0.05 + i * 3.2);
        }
        scheduleHour();
      }, wait);
    };

    strike(ctx.currentTime + 0.15);
    scheduleHour();

    return {
      gain,
      stop: () => {
        window.clearTimeout(timer);
        release(() => {
          for (const o of live) o.stop();
          live.clear();
          tone.disconnect();
        });
      },
    };
  }
}
