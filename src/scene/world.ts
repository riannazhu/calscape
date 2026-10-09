import type { ElementId } from '../elements';
import { DAY, NIGHT, type Palette } from './palette';
import { mulberry32 } from './pixels';
import { H, PERCH, STARS, W, drawFar, drawFg, drawMid, lawnTop, skyKey } from './backdrop';
import { SPIKEBALL } from './people';
import {
  BIRD_IDLE,
  BIRD_SING,
  CAMPANILE,
  RAIN_CLOUDS,
  WISPS,
  drawSprite,
  flipX,
  opaque,
  type Sprite,
} from './sprites';

const BIRD_FRAMES = {
  idle: [BIRD_IDLE, flipX(BIRD_IDLE)],
  sing: [BIRD_SING, flipX(BIRD_SING)],
};

const BIRD_POS = { x: PERCH.x, y: PERCH.feetY - BIRD_IDLE.h + 1 };
const BELL_POS = { x: 98, y: 20 };

/** One rally of the spikeball: hand to net, net to the next player's hands. */
const RALLY = [0, 1, 3, 2, 0, 3, 1];
const HIT_S = 0.45;
const RALLY_PAUSE_S = 4;

interface Part {
  sprite: Sprite;
  x: number;
  y: number;
}

interface Placed {
  id: ElementId;
  parts: Part[];
}

interface Leaf {
  x: number;
  y: number;
  born: number;
  restY: number;
  sway: number;
}

interface Layers {
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  fg: HTMLCanvasElement;
}

function alphaMask(c: HTMLCanvasElement) {
  const data = c.getContext('2d')!.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) m[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  return m;
}

/**
 * Owns everything drawn on the 320x180 scene canvas, plus the silhouette masks
 * used for outlines and hit-testing. Lives outside React render state.
 */
export class World {
  present: Record<ElementId, boolean> = { rain: false, bird: false, bell: false };
  night = false;
  reducedMotion = false;
  highlight: ElementId | null = null;

  private layers = new Map<boolean, Layers>();
  private midMask: Uint8Array;
  private fgMask: Uint8Array;
  private birdSingUntil = 0;
  private birdFacing = 0;
  private birdHopUntil = 0;
  private nextBirdMove = 0;
  private leaves: Leaf[] = [];
  private nextLeaf = 0;
  private rng = mulberry32(Date.now() & 0xffff);
  /** Each drop belongs to a cloud and falls from its base. */
  private drops = RAIN_CLOUDS.flatMap((c, cloud) => {
    const r = mulberry32(50 + cloud);
    return Array.from({ length: Math.round(c.sprite.w / 2) }, () => ({
      cloud,
      dx: 3 + r() * (c.sprite.w - 6),
      speed: 80 + r() * 30,
      phase: r() * 10,
      len: r() < 0.5 ? 2 : 3,
      land: r(),
    }));
  });
  private placedCache: Placed[] = [];

  constructor() {
    const l = this.getLayers(false);
    this.midMask = alphaMask(l.mid);
    this.fgMask = alphaMask(l.fg);
  }

  get palette(): Palette {
    return this.night ? NIGHT : DAY;
  }

  private getLayers(night: boolean): Layers {
    let l = this.layers.get(night);
    if (!l) {
      const pal = night ? NIGHT : DAY;
      l = { far: drawFar(pal, night), mid: drawMid(pal, night), fg: drawFg(pal) };
      this.layers.set(night, l);
    }
    return l;
  }

  birdSing(ms: number) {
    this.birdSingUntil = Math.max(this.birdSingUntil, performance.now() + ms);
  }

  /** Resting bounds of an element, used to place keyboard focus targets. */
  bounds(id: ElementId) {
    const parts = this.restingParts(id);
    const x0 = Math.max(0, Math.min(...parts.map((p) => p.x)));
    const y0 = Math.max(0, Math.min(...parts.map((p) => p.y)));
    const x1 = Math.min(W, Math.max(...parts.map((p) => p.x + p.sprite.w)));
    const y1 = Math.min(H, Math.max(...parts.map((p) => p.y + p.sprite.h)));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private restingParts(id: ElementId): Part[] {
    switch (id) {
      case 'bell':
        return [{ sprite: CAMPANILE, ...BELL_POS }];
      case 'rain':
        return RAIN_CLOUDS.map((c) => ({ ...c }));
      case 'bird':
        return [{ sprite: BIRD_IDLE, ...BIRD_POS }];
    }
  }

  private place(now: number): Placed[] {
    const t = this.reducedMotion ? 0 : now / 1000;
    const out: Placed[] = [];
    if (this.present.bell) out.push({ id: 'bell', parts: this.restingParts('bell') });
    if (this.present.rain) {
      out.push({
        id: 'rain',
        parts: RAIN_CLOUDS.map((c, i) => ({
          sprite: c.sprite,
          x: c.x + Math.round(Math.sin((t * 2 * Math.PI) / (50 + i * 9) + i) * 2),
          y: c.y + Math.round(Math.sin((t * 2 * Math.PI) / (17 + i * 4) + i * 2)),
        })),
      });
    }
    if (this.present.bird) {
      const singing = now < this.birdSingUntil && Math.floor(now / 140) % 2 === 0;
      const frames = singing ? BIRD_FRAMES.sing : BIRD_FRAMES.idle;
      out.push({
        id: 'bird',
        parts: [
          {
            sprite: frames[this.birdFacing],
            x: BIRD_POS.x,
            y: BIRD_POS.y - (now < this.birdHopUntil ? 1 : 0),
          },
        ],
      });
    }
    return out;
  }

  private occluded(id: ElementId, x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    const i = y * W + x;
    if (id === 'bird') return false;
    if (this.midMask[i] === 1 || this.fgMask[i] === 1) return true;
    return id === 'rain' && this.present.bell && opaque(CAMPANILE, x - BELL_POS.x, y - BELL_POS.y);
  }

  private mask(p: Placed, x: number, y: number): boolean {
    if (!p.parts.some((s) => opaque(s.sprite, x - s.x, y - s.y))) return false;
    return !this.occluded(p.id, x, y);
  }

  hitTest(lx: number, ly: number): ElementId | null {
    const x = Math.floor(lx);
    const y = Math.floor(ly);
    for (let i = this.placedCache.length - 1; i >= 0; i--) {
      const p = this.placedCache[i];
      const pad = p.id === 'bird' ? 2 : 0;
      for (let dy = -pad; dy <= pad; dy++) {
        for (let dx = -pad; dx <= pad; dx++) {
          if (this.mask(p, x + dx, y + dy)) return p.id;
        }
      }
    }
    return null;
  }

  private updateAmbient(now: number) {
    if (this.reducedMotion) {
      this.leaves = [];
      return;
    }
    if (this.present.bird && now > this.nextBirdMove) {
      if (this.nextBirdMove > 0) {
        if (this.rng() < 0.5) this.birdFacing = 1 - this.birdFacing;
        else this.birdHopUntil = now + 180;
      }
      this.nextBirdMove = now + 9000 + this.rng() * 16000;
    }
    if (now > this.nextLeaf) {
      if (this.nextLeaf > 0 && this.leaves.length < 2) {
        const left = this.rng() < 0.65;
        this.leaves.push({
          x: left ? 6 + this.rng() * 70 : 280 + this.rng() * 34,
          y: left ? 24 + this.rng() * 18 : 18 + this.rng() * 14,
          born: now,
          restY: 142 + this.rng() * 30,
          sway: this.rng() * Math.PI * 2,
        });
      }
      this.nextLeaf = now + 12000 + this.rng() * 22000;
    }
    this.leaves = this.leaves.filter((l) => now - l.born < 40000);
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    this.updateAmbient(now);
    const pal = this.palette;
    const t = this.reducedMotion ? 0 : now / 1000;
    const { far, mid, fg } = this.getLayers(this.night);
    const placed = this.place(now);
    this.placedCache = placed;
    const get = (id: ElementId) => placed.find((p) => p.id === id);

    ctx.drawImage(far, 0, 0);

    if (this.night && !this.reducedMotion) {
      STARS.forEach((s, i) => {
        if (Math.sin(t * 0.6 + i * 1.7) > 0.985) {
          ctx.fillStyle = pal[skyKey(s.x, s.y)];
          ctx.fillRect(s.x, s.y, 1, 1);
        }
      });
    }

    for (const w of WISPS) {
      const span = W + w.sprite.w + 40;
      const x = Math.floor(((w.x0 + t * w.speed) % span) - w.sprite.w);
      drawSprite(ctx, w.sprite, x, w.y, pal);
    }

    const rain = get('rain');
    if (rain) for (const s of rain.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);

    const bell = get('bell');
    if (bell) for (const s of bell.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);

    ctx.drawImage(mid, 0, 0);
    this.drawBall(ctx, pal, t);
    if (rain) this.drawDrops(ctx, pal, t, rain.parts);
    ctx.drawImage(fg, 0, 0);

    ctx.fillStyle = pal.leafLight;
    for (const l of this.leaves) {
      const age = (now - l.born) / 1000;
      const y = Math.min(l.restY, l.y + age * 5);
      const x = l.x + Math.sin(age * 1.3 + l.sway) * 3;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
    }

    if (rain) {
      ctx.fillStyle = pal.rainTint;
      ctx.fillRect(0, 0, W, H);
    }

    const bird = get('bird');
    if (bird) for (const s of bird.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);

    const hl = placed.find((p) => p.id === this.highlight);
    if (hl) this.drawOutline(ctx, hl, pal);
  }

  /** The spikeball bouncing hand to net to hand, with a rest between rallies. */
  private drawBall(ctx: CanvasRenderingContext2D, pal: Palette, t: number) {
    const { net, hands } = SPIKEBALL;
    const rally = (RALLY.length - 1) * 2 * HIT_S;
    const phase = t % (rally + RALLY_PAUSE_S);
    let x = hands[RALLY[0]].x;
    let y = hands[RALLY[0]].y - 1;
    if (phase < rally) {
      const leg = Math.floor(phase / HIT_S);
      const s = (phase % HIT_S) / HIT_S;
      const hit = Math.floor(leg / 2);
      const toNet = leg % 2 === 0;
      const a = toNet ? hands[RALLY[hit]] : { x: net.x, y: net.y - 2 };
      const b = toNet ? { x: net.x, y: net.y - 2 } : hands[RALLY[hit + 1]];
      const lift = toNet ? 3 : 9;
      x = a.x + (b.x - a.x) * s;
      y = a.y + (b.y - a.y) * s - lift * 4 * s * (1 - s);
    }
    ctx.fillStyle = pal.ball;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  private drawDrops(ctx: CanvasRenderingContext2D, pal: Palette, t: number, clouds: Part[]) {
    ctx.fillStyle = pal.rain;
    ctx.globalAlpha = 0.6;
    for (const d of this.drops) {
      const c = clouds[d.cloud];
      const x0 = c.x + d.dx;
      const y0 = c.y + c.sprite.h - 1;
      const ground = Math.max(y0 + 8, lawnTop(Math.round(x0)) + 2 + d.land * (H - 4 - lawnTop(Math.round(x0))));
      const fall = ground - y0;
      const y = y0 + ((t * d.speed + d.phase * fall) % fall);
      const x = Math.floor(x0 + (y - y0) / 8);
      if (y > ground - 2) {
        ctx.fillRect(x - 1, Math.floor(ground), 1, 1);
        ctx.fillRect(x + 1, Math.floor(ground), 1, 1);
      } else {
        ctx.fillRect(x, Math.floor(y), 1, d.len);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** A crisp ice-blue edge with a soft blue glow ring just outside it. */
  private drawOutline(ctx: CanvasRenderingContext2D, p: Placed, pal: Palette) {
    const x0 = Math.min(...p.parts.map((s) => s.x)) - 3;
    const y0 = Math.min(...p.parts.map((s) => s.y)) - 3;
    const x1 = Math.max(...p.parts.map((s) => s.x + s.sprite.w)) + 3;
    const y1 = Math.max(...p.parts.map((s) => s.y + s.sprite.h)) + 3;
    const bw = x1 - x0;
    const bh = y1 - y0;
    const inside = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) inside[y * bw + x] = this.mask(p, x + x0, y + y0) ? 1 : 0;
    }
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= bw || y >= bh ? 0 : inside[y * bw + x]);
    const ring = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) ring[y * bw + x] = 1;
        else if (at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)) {
          ring[y * bw + x] = 2;
        }
      }
    }
    ctx.fillStyle = pal.outlineGlow;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (at(x, y) || ring[y * bw + x] === 1) continue;
        const r = (xx: number, yy: number) =>
          xx >= 0 && yy >= 0 && xx < bw && yy < bh && ring[yy * bw + xx] === 1;
        if (ring[y * bw + x] === 2 || r(x - 1, y) || r(x + 1, y) || r(x, y - 1) || r(x, y + 1)) {
          ctx.fillRect(x + x0, y + y0, 1, 1);
        }
      }
    }
    ctx.fillStyle = pal.outline;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) if (ring[y * bw + x] === 1) ctx.fillRect(x + x0, y + y0, 1, 1);
    }
  }
}
