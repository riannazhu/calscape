import { ELEMENTS, type ElementId } from '../elements';
import { PALETTES, type Palette, type TimeOfDay } from './palette';
import { hex, mulberry32 } from './pixels';
import { H, PERCH, STARS, W, drawFar, drawFg, drawMid, lawnTop, skyColor } from './backdrop';
import { SPIKEBALL } from './people';
import {
  BIRD_IDLE,
  BIRD_SING,
  CAMPANILE,
  CRICKET,
  DEER_GRAZE,
  DEER_WALK,
  DOVE,
  OWL,
  RAIN_CLOUDS,
  SQUIRREL,
  SUNSET_WISPS,
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
const OWL_POS = { x: PERCH.x + 2, y: PERCH.feetY - OWL.open.h + 1 };
const SQUIRREL_POS = { x: 55, y: 30 };
/** The dove shares the songbird's and owl's perch. */
const DOVE_POS = { x: PERCH.x, y: PERCH.feetY - DOVE[0].h + 1 };
const CRICKET_POS = { x: 200, y: 150 };
/** The breeze is the left tree itself: everything in the canopy layer left of this column. */
const TREE_RIGHT = 100;

/** Elements that sit behind Doe, the hedges or the canopies and are hidden where those overlap. */
const OCCLUDED = new Set<ElementId>(['rain', 'bell']);
/** Large targets need no extra margin around their silhouette. */
const UNPADDED = new Set<ElementId>(['rain', 'bell', 'wind']);

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
  /** Carried sideways by the breeze, px/s. */
  drift: number;
}

interface Deer {
  x: number;
  /** Row the hooves stand on. */
  y: number;
  min: number;
  max: number;
  dir: 1 | -1;
  walking: boolean;
  since: number;
  until: number;
  /** Grazing starts this long into a pause; Infinity keeps the deer standing. */
  grazeAfter: number;
  /** Offsets the walk cycle so no two deer step in time. */
  phase: number;
}

const DEER_FRAMES = {
  walk: [DEER_WALK, DEER_WALK.map(flipX)],
  graze: [DEER_GRAZE, flipX(DEER_GRAZE)],
};
/** One star in this many twinkles, now and then. */
const TWINKLE_EVERY = 2;
const DEER_SPEED = 2.5;
/** Sunset streaks drift this many times faster than day and night clouds. */
const SUNSET_DRIFT = 3;

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
  present = Object.fromEntries(ELEMENTS.map((e) => [e.id, false])) as Record<ElementId, boolean>;
  time: TimeOfDay = 'day';
  reducedMotion = false;
  highlight: ElementId | null = null;

  private layers = new Map<string, Layers>();
  private midMask: Uint8Array;
  private fgMask: Uint8Array;
  private callUntil: Partial<Record<ElementId, number>> = {};
  private nextBlink = 0;
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
  /** Deer wander the Glade at night, each within its own stretch of lawn. */
  private deer: Deer[] = [
    { x: 40, y: 147, min: 12, max: 150, dir: 1, walking: false, since: 0, until: 0, grazeAfter: Infinity, phase: 0 },
    { x: 130, y: 153, min: 60, max: 210, dir: -1, walking: false, since: 0, until: 0, grazeAfter: Infinity, phase: 0 },
    { x: 268, y: 149, min: 180, max: 300, dir: -1, walking: false, since: 0, until: 0, grazeAfter: Infinity, phase: 0 },
  ];
  private lastDeer = 0;

  private tree: Sprite;

  constructor() {
    const l = this.getLayers('day');
    this.midMask = alphaMask(l.mid);
    this.fgMask = alphaMask(l.fg);
    const px: Sprite['px'] = new Array(TREE_RIGHT * H).fill(null);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < TREE_RIGHT; x++) if (this.fgMask[y * W + x]) px[y * TREE_RIGHT + x] = 'leaf';
    }
    this.tree = { w: TREE_RIGHT, h: H, px };
  }

  get palette(): Palette {
    return PALETTES[this.time];
  }

  private getLayers(time: TimeOfDay, overcast = false): Layers {
    const key = `${time}${overcast ? ':rain' : ''}`;
    let l = this.layers.get(key);
    if (!l) {
      const pal = PALETTES[time];
      const clear = overcast ? this.getLayers(time) : null;
      l = clear
        ? { ...clear, far: drawFar(pal, time, true) }
        : { far: drawFar(pal, time), mid: drawMid(pal, time), fg: drawFg(pal) };
      this.layers.set(key, l);
    }
    return l;
  }

  /** An element is calling for the next `ms`: the bird sings, the owl hoots, and so on. */
  call(id: ElementId, ms: number) {
    this.callUntil[id] = Math.max(this.callUntil[id] ?? 0, performance.now() + ms);
  }

  private calling(id: ElementId, now: number) {
    return now < (this.callUntil[id] ?? 0);
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
      case 'owl':
        return [{ sprite: OWL.open, ...OWL_POS }];
      case 'squirrel':
        return [{ sprite: SQUIRREL[0], ...SQUIRREL_POS }];
      case 'dove':
        return [{ sprite: DOVE[0], ...DOVE_POS }];
      case 'crickets':
        return [{ sprite: CRICKET[0], ...CRICKET_POS }];
      case 'wind':
        return [{ sprite: this.tree, x: 0, y: 0 }];
    }
  }

  /** Canopies (and the bird on its branch) rock a pixel either way in the breeze. */
  private sway(t: number) {
    return this.present.wind ? Math.round(Math.sin(t * 0.9) * 0.8) : 0;
  }

  private place(now: number): Placed[] {
    const t = this.reducedMotion ? 0 : now / 1000;
    const still = this.reducedMotion;
    const blip = (ms: number) => !still && Math.floor(now / ms) % 2 === 0;
    const out: Placed[] = [];
    const at = (id: ElementId, sprite: Sprite, pos: { x: number; y: number }, dx = 0, dy = 0) =>
      out.push({ id, parts: [{ sprite, x: pos.x + dx, y: pos.y + dy }] });

    for (const id of Object.keys(this.present) as ElementId[]) {
      if (!this.present[id]) continue;
      switch (id) {
        case 'bell':
          out.push({ id, parts: this.restingParts(id) });
          break;
        case 'wind':
          at(id, this.tree, { x: 0, y: 0 }, this.sway(t));
          break;
        case 'rain':
          out.push({
            id,
            parts: RAIN_CLOUDS.map((c, i) => ({
              sprite: c.sprite,
              x: c.x + Math.round(Math.sin((t * 2 * Math.PI) / (50 + i * 9) + i) * 2),
              y: c.y + Math.round(Math.sin((t * 2 * Math.PI) / (17 + i * 4) + i * 2)),
            })),
          });
          break;
        case 'bird': {
          const frames = this.calling(id, now) && blip(140) ? BIRD_FRAMES.sing : BIRD_FRAMES.idle;
          at(id, frames[this.birdFacing], BIRD_POS, this.sway(t), now < this.birdHopUntil ? -1 : 0);
          break;
        }
        case 'owl': {
          const hooting = this.calling(id, now);
          const blinking = !hooting && now < this.nextBlink && this.nextBlink - now < 160;
          at(id, hooting ? OWL.hoot : blinking ? OWL.blink : OWL.open, OWL_POS, 0, hooting && blip(300) ? 1 : 0);
          break;
        }
        case 'squirrel': {
          const flick = this.calling(id, now) ? blip(110) : !still && t % 7 < 0.35;
          at(id, SQUIRREL[flick ? 1 : 0], SQUIRREL_POS);
          break;
        }
        case 'dove':
          at(id, DOVE[this.calling(id, now) ? 1 : 0], DOVE_POS);
          break;
        case 'crickets':
          at(id, CRICKET[!still && t % 2.4 < 0.35 && blip(90) ? 1 : 0], CRICKET_POS);
          break;
      }
    }
    return out;
  }

  private occluded(id: ElementId, x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    const i = y * W + x;
    if (!OCCLUDED.has(id)) return false;
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
      const pad = UNPADDED.has(p.id) ? 0 : 2;
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
    if (this.present.owl && now > this.nextBlink) this.nextBlink = now + 3000 + this.rng() * 6000;
    const windy = this.present.wind;
    if (now > this.nextLeaf) {
      if (this.nextLeaf > 0 && this.leaves.length < (windy ? 5 : 2)) {
        const left = this.rng() < 0.65;
        this.leaves.push({
          x: left ? 6 + this.rng() * 70 : 280 + this.rng() * 34,
          y: left ? 24 + this.rng() * 18 : 18 + this.rng() * 14,
          born: now,
          restY: 142 + this.rng() * 30,
          sway: this.rng() * Math.PI * 2,
          drift: windy ? 3 + this.rng() * 4 : 0,
        });
      }
      this.nextLeaf = now + (windy ? 2500 + this.rng() * 5000 : 12000 + this.rng() * 22000);
    }
    this.leaves = this.leaves.filter((l) => now - l.born < 40000);
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    this.updateAmbient(now);
    const pal = this.palette;
    const t = this.reducedMotion ? 0 : now / 1000;
    const night = this.time === 'night';
    const { far, mid, fg } = this.getLayers(this.time, this.present.rain);
    const placed = this.place(now);
    this.placedCache = placed;
    const get = (id: ElementId) => placed.find((p) => p.id === id);

    ctx.drawImage(far, 0, 0);

    if (night && !this.present.rain && !this.reducedMotion) {
      STARS.forEach((s, i) => {
        if (i % TWINKLE_EVERY === 0 && Math.sin(t * 0.35 + i * 1.7) > 0.98) {
          ctx.fillStyle = hex(skyColor('night', pal, s.x, s.y));
          ctx.fillRect(s.x, s.y, 1, 1);
        }
      });
    }

    const sunset = this.time === 'sunset';
    const wisps = sunset ? [...WISPS, ...SUNSET_WISPS] : night ? WISPS : [];
    for (const w of wisps) {
      const span = W + w.sprite.w + 40;
      const x = Math.floor(((w.x0 + t * w.speed * (sunset ? SUNSET_DRIFT : 1)) % span) - w.sprite.w);
      drawSprite(ctx, w.sprite, x, w.y, pal);
    }

    const rain = get('rain');
    if (rain) for (const s of rain.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);


    const bell = get('bell');
    if (bell) for (const s of bell.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);

    ctx.drawImage(mid, 0, 0);
    if (night) this.drawDeer(ctx, pal, now);
    else if (this.time === 'day') this.drawBall(ctx, pal, t);
    const crickets = get('crickets');
    if (crickets) for (const s of crickets.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    if (rain) this.drawDrops(ctx, pal, t, rain.parts);
    ctx.drawImage(fg, this.sway(t), 0);

    ctx.fillStyle = pal.leafLight;
    for (const l of this.leaves) {
      const age = (now - l.born) / 1000;
      const y = Math.min(l.restY, l.y + age * 5);
      const x = l.x + Math.sin(age * 1.3 + l.sway) * 3 + Math.min(age, (l.restY - l.y) / 5) * l.drift;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
    }

    if (rain) {
      ctx.fillStyle = pal.rainTint;
      ctx.fillRect(0, 0, W, H);
    }

    for (const id of ['bird', 'owl', 'dove', 'squirrel'] as const) {
      const p = get(id);
      if (p) for (const s of p.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    }

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

  /** Deer amble a few steps, then stand a while; some pauses end in grazing. */
  private drawDeer(ctx: CanvasRenderingContext2D, pal: Palette, now: number) {
    const dt = this.lastDeer ? Math.min(0.1, (now - this.lastDeer) / 1000) : 0;
    this.lastDeer = now;
    for (const d of this.deer) {
      if (d.until === 0) {
        // Each deer starts partway through its own grazing spell.
        d.until = now + 2000 + this.rng() * 20000;
        d.phase = this.rng() * 1000;
      }
      if (!this.reducedMotion) {
        if (now > d.until) {
          d.walking = !d.walking;
          d.since = now;
          d.until = now + (d.walking ? 2000 + this.rng() * 3500 : 12000 + this.rng() * 26000);
          d.grazeAfter = this.rng() < 0.35 ? 4000 + this.rng() * 8000 : Infinity;
          if (d.walking && this.rng() < 0.4) d.dir = d.dir === 1 ? -1 : 1;
        }
        if (d.walking) {
          d.x += d.dir * DEER_SPEED * dt;
          if (d.x < d.min || d.x > d.max) {
            d.x = Math.min(d.max, Math.max(d.min, d.x));
            d.dir = d.dir === 1 ? -1 : 1;
          }
        }
      }
      const facing = d.dir === 1 ? 0 : 1;
      const walk = DEER_FRAMES.walk[facing];
      let sprite = walk[0];
      if (d.walking && !this.reducedMotion) sprite = walk[Math.floor((now + d.phase) / 280) % 2];
      else if (now - d.since > d.grazeAfter) sprite = DEER_FRAMES.graze[facing];
      drawSprite(ctx, sprite, Math.round(d.x - sprite.w / 2), d.y - sprite.h + 1, pal);
    }
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
