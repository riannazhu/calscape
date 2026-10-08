import type { ElementId } from '../elements';
import { DAY, NIGHT, type Palette } from './palette';
import { DOE, H, LAMP, STARS, W, drawFar, drawNear, mulberry32 } from './backdrop';
import {
  BIRD_IDLE,
  BIRD_SING,
  CAMPANILE,
  RAIN_CLOUD,
  SKY_CLOUDS,
  drawSprite,
  opaque,
  type Sprite,
} from './sprites';

function flipX(s: Sprite): Sprite {
  const px = s.px.slice();
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) px[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)];
  }
  return { ...s, px };
}

const BIRD_FRAMES = {
  idle: [BIRD_IDLE, flipX(BIRD_IDLE)],
  sing: [BIRD_SING, flipX(BIRD_SING)],
};

const BASE: Record<ElementId, { x: number; y: number; sprite: Sprite }> = {
  bell: { x: 76, y: DOE.roof + 4 - CAMPANILE.h, sprite: CAMPANILE },
  rain: { x: 138, y: 14, sprite: RAIN_CLOUD },
  bird: { x: LAMP.x - 5, y: LAMP.capY - BIRD_IDLE.h, sprite: BIRD_IDLE },
};

const RAIN_GROUND = 138;

interface Placed {
  id: ElementId;
  sprite: Sprite;
  x: number;
  y: number;
}

interface Leaf {
  x: number;
  y: number;
  born: number;
  restY: number;
  sway: number;
}

function makeLayer(draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  return c;
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

  private layers = new Map<boolean, { far: HTMLCanvasElement; near: HTMLCanvasElement }>();
  private nearMask: Uint8Array;
  private birdSingUntil = 0;
  private birdFacing = 0;
  private birdHopUntil = 0;
  private nextBirdMove = 0;
  private leaves: Leaf[] = [];
  private nextLeaf = 0;
  private rng = mulberry32(Date.now() & 0xffff);
  private rainDrops = Array.from({ length: 28 }, (_, i) => ({
    dx: 4 + ((i * 13) % 36),
    speed: 50 + ((i * 7) % 5) * 6,
    phase: (i * 37) % 97,
    ground: RAIN_GROUND + ((i * 5) % 7),
  }));
  private placedCache: Placed[] = [];

  constructor() {
    const near = this.getLayers(false).near;
    const data = near.getContext('2d')!.getImageData(0, 0, W, H).data;
    this.nearMask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) this.nearMask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  }

  get palette(): Palette {
    return this.night ? NIGHT : DAY;
  }

  private getLayers(night: boolean) {
    let l = this.layers.get(night);
    if (!l) {
      const pal = night ? NIGHT : DAY;
      l = {
        far: makeLayer((ctx) => drawFar(ctx, pal, night)),
        near: makeLayer((ctx) => drawNear(ctx, pal)),
      };
      this.layers.set(night, l);
    }
    return l;
  }

  birdSing(ms: number) {
    this.birdSingUntil = Math.max(this.birdSingUntil, performance.now() + ms);
  }

  /** Fixed resting bounds, used to place keyboard focus targets. */
  bounds(id: ElementId) {
    const b = BASE[id];
    return { x: b.x, y: b.y, w: b.sprite.w, h: b.sprite.h };
  }

  private place(now: number): Placed[] {
    const t = this.reducedMotion ? 0 : now / 1000;
    const out: Placed[] = [];
    if (this.present.bell) out.push({ id: 'bell', ...BASE.bell });
    if (this.present.rain) {
      const b = BASE.rain;
      out.push({
        id: 'rain',
        sprite: b.sprite,
        x: b.x + Math.round(Math.sin((t * 2 * Math.PI) / 48) * 2),
        y: b.y + Math.round(Math.sin((t * 2 * Math.PI) / 17)),
      });
    }
    if (this.present.bird) {
      const b = BASE.bird;
      const singing = now < this.birdSingUntil && Math.floor(now / 140) % 2 === 0;
      const frames = singing ? BIRD_FRAMES.sing : BIRD_FRAMES.idle;
      out.push({
        id: 'bird',
        sprite: frames[this.birdFacing],
        x: b.x,
        y: b.y - (now < this.birdHopUntil ? 1 : 0),
      });
    }
    return out;
  }

  private mask(p: Placed, x: number, y: number): boolean {
    if (!opaque(p.sprite, x - p.x, y - p.y)) return false;
    if (p.id === 'bell') {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      return this.nearMask[y * W + x] === 0;
    }
    return true;
  }

  hitTest(lx: number, ly: number): ElementId | null {
    const x = Math.floor(lx);
    const y = Math.floor(ly);
    for (let i = this.placedCache.length - 1; i >= 0; i--) {
      const p = this.placedCache[i];
      const pad = p.id === 'bird' ? 1 : 0;
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
        const left = this.rng() < 0.6;
        this.leaves.push({
          x: left ? 10 + this.rng() * 34 : 294 + this.rng() * 20,
          y: left ? 84 + this.rng() * 12 : 88 + this.rng() * 10,
          born: now,
          restY: 120 + this.rng() * 18,
          sway: this.rng() * Math.PI * 2,
        });
      }
      this.nextLeaf = now + 14000 + this.rng() * 26000;
    }
    this.leaves = this.leaves.filter((l) => now - l.born < 16000);
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    this.updateAmbient(now);
    const pal = this.palette;
    const t = this.reducedMotion ? 0 : now / 1000;
    const { far, near } = this.getLayers(this.night);
    const placed = this.place(now);
    this.placedCache = placed;

    ctx.drawImage(far, 0, 0);

    if (this.night && !this.reducedMotion) {
      STARS.forEach((s, i) => {
        if (Math.sin(t * 0.6 + i * 1.7) > 0.985) {
          ctx.fillStyle = s.y < 34 ? pal.sky1 : s.y < 64 ? pal.sky2 : pal.sky3;
          ctx.fillRect(s.x, s.y, 1, 1);
        }
      });
    }

    const skyCloudRows = [
      { y: 8, x0: 20, speed: 1 / 5 },
      { y: 40, x0: 190, speed: 1 / 7 },
      { y: 56, x0: 90, speed: 1 / 9 },
    ];
    skyCloudRows.forEach((row, i) => {
      const s = SKY_CLOUDS[i];
      const span = W + s.w + 40;
      const x = Math.floor(((row.x0 + t * row.speed) % span) - s.w);
      drawSprite(ctx, s, x, row.y, pal);
    });

    const bell = placed.find((p) => p.id === 'bell');
    if (bell) drawSprite(ctx, bell.sprite, bell.x, bell.y, pal);

    ctx.drawImage(near, 0, 0);

    ctx.fillStyle = pal.treeLight;
    for (const l of this.leaves) {
      const age = (now - l.born) / 1000;
      const y = Math.min(l.restY, l.y + age * 5);
      const x = l.x + Math.sin(age * 1.4 + l.sway) * 3;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }

    const rain = placed.find((p) => p.id === 'rain');
    if (rain) {
      const top = rain.y + rain.sprite.h - 1;
      ctx.fillStyle = pal.rain;
      for (const d of this.rainDrops) {
        const len = d.ground - top;
        const y = top + ((d.phase + t * d.speed) % len);
        const x = rain.x + d.dx;
        if (y > d.ground - 2) {
          ctx.fillRect(x - 1, d.ground, 1, 1);
          ctx.fillRect(x + 1, d.ground, 1, 1);
        } else {
          ctx.fillRect(x, Math.floor(y), 1, 2);
        }
      }
      drawSprite(ctx, rain.sprite, rain.x, rain.y, pal);
    }

    const bird = placed.find((p) => p.id === 'bird');
    if (bird) drawSprite(ctx, bird.sprite, bird.x, bird.y, pal);

    const hl = placed.find((p) => p.id === this.highlight);
    if (hl) this.drawOutline(ctx, hl, pal.outline);
  }

  private drawOutline(ctx: CanvasRenderingContext2D, p: Placed, color: string) {
    ctx.fillStyle = color;
    for (let y = p.y - 1; y <= p.y + p.sprite.h; y++) {
      for (let x = p.x - 1; x <= p.x + p.sprite.w; x++) {
        if (this.mask(p, x, y)) continue;
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++) {
          for (let dx = -1; dx <= 1 && !edge; dx++) {
            if ((dx || dy) && this.mask(p, x + dx, y + dy)) edge = true;
          }
        }
        if (edge) ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
