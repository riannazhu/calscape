import type { ElementId } from '../../elements';
import type { Palette, TimeOfDay } from '../palette';
import { hex, mulberry32 } from '../pixels';
import { drawDrifters, drawSprite, flipX, type Sprite } from '../sprites';
import { H, Stage, W, alphaMask, type Part, type Placed } from '../stage';
import { LAMP, PATH, STARS, TREE_WELL, drawFar, drawFg, drawGlow, drawMid, skyColor } from './backdrop';
import { PALETTES, type StradaKey } from './palette';
import {
  BIKERS,
  CHATTER,
  CHATTER_POS,
  CRICKET,
  CROW,
  RAIN_CLOUDS,
  SPARROW,
  TYPING,
  TYPING_POS,
  WISPS,
} from './sprites';

/** The sparrow hops along the front railing's top rail. */
const SPARROW_SPOTS = [224, 290, 306];
const SPARROW_Y = 132 - SPARROW.idle.h;
/** The crow keeps watch from the top of the bannered street lamp. */
const CROW_POS = { x: LAMP.x - 3, y: LAMP.head - 4 - CROW.idle.h };
/** A cricket sings from the rim of the big plum's tree well. */
const CRICKET_POS = { x: TREE_WELL.x0 + 4, y: TREE_WELL.top - 3 };
const BIKE_SPEED = 16;

/** Elements behind the hedge, railings, trees or canopy are hidden where those overlap. */
const OCCLUDED = new Set<ElementId>(['rain']);

interface Layers {
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  fg: HTMLCanvasElement;
  /** Lamp and bulb halos, laid over everything after dark. */
  glow: HTMLCanvasElement | null;
}

interface Rider {
  frames: Sprite<StradaKey>[];
  x: number;
  dir: 1 | -1;
  /** Riders in the far lane sit a row higher. */
  y: number;
}

/** Caffè Strada's patio at College and Bancroft, under the plum trees. */
export class Strada extends Stage<StradaKey> {
  private layers = new Map<string, Layers>();
  private midMask: Uint8Array;
  private fgMask: Uint8Array;
  private sparrowSpot = 0;
  private sparrowFacing = 0;
  private nextSparrowHop = 0;
  private nextChat = 0;
  private chat: keyof typeof CHATTER = 'idle';
  private drops = RAIN_CLOUDS.flatMap((c, cloud) => {
    const r = mulberry32(80 + cloud);
    return Array.from({ length: Math.round(c.sprite.w / 2) }, () => ({
      cloud,
      dx: 3 + r() * (c.sprite.w - 6),
      speed: 80 + r() * 30,
      phase: r() * 10,
      len: r() < 0.5 ? 2 : 3,
      land: r(),
    }));
  });
  private riders: Rider[] = [];
  private nextRider = 0;
  private last = 0;

  constructor(elements: ElementId[]) {
    super(elements);
    this.unpadded = new Set(['rain']);
    const l = this.getLayers('day');
    this.midMask = alphaMask(l.mid);
    this.fgMask = alphaMask(l.fg);
  }

  protected get palette(): Palette<StradaKey> {
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
        : { far: drawFar(pal, time), mid: drawMid(pal, time), fg: drawFg(pal), glow: drawGlow(pal, time) };
      this.layers.set(key, l);
    }
    return l;
  }

  protected restingParts(id: ElementId): Part<StradaKey>[] {
    switch (id) {
      case 'rain':
        return RAIN_CLOUDS.map((c) => ({ ...c }));
      case 'chatter':
        return [{ sprite: CHATTER.idle, ...CHATTER_POS }];
      case 'typing':
        return [{ sprite: TYPING[0], ...TYPING_POS }];
      case 'sparrow':
        return [{ sprite: SPARROW.idle, x: SPARROW_SPOTS[this.sparrowSpot], y: SPARROW_Y }];
      case 'crow':
        return [{ sprite: CROW.idle, ...CROW_POS }];
      case 'crickets':
        return [{ sprite: CRICKET[0], ...CRICKET_POS }];
      default:
        return [];
    }
  }

  protected occluded(id: ElementId, x: number, y: number) {
    if (super.occluded(id, x, y)) return true;
    if (!OCCLUDED.has(id)) return false;
    const i = y * W + x;
    return this.midMask[i] === 1 || this.fgMask[i] === 1;
  }

  private place(now: number): Placed<StradaKey>[] {
    const t = this.reducedMotion ? 0 : now / 1000;
    const still = this.reducedMotion;
    const blip = (ms: number) => !still && Math.floor(now / ms) % 2 === 0;
    const out: Placed<StradaKey>[] = [];
    const at = (id: ElementId, sprite: Sprite<StradaKey>, x: number, y: number) =>
      out.push({ id, parts: [{ sprite, x, y }] });

    for (const id of Object.keys(this.present) as ElementId[]) {
      if (!this.present[id]) continue;
      switch (id) {
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
        case 'chatter':
          at(id, CHATTER[still ? 'idle' : this.chat], CHATTER_POS.x, CHATTER_POS.y);
          break;
        case 'typing':
          at(id, TYPING[blip(130) && t % 9 < 6 ? 1 : 0], TYPING_POS.x, TYPING_POS.y);
          break;
        case 'sparrow': {
          const s = this.calling(id, now) && blip(120) ? SPARROW.chirp : SPARROW.idle;
          at(id, this.sparrowFacing ? flipX(s) : s, SPARROW_SPOTS[this.sparrowSpot], SPARROW_Y);
          break;
        }
        case 'crow':
          at(id, this.calling(id, now) && blip(260) ? CROW.caw : CROW.idle, CROW_POS.x, CROW_POS.y);
          break;
        case 'crickets':
          at(id, CRICKET[!still && t % 2.4 < 0.35 && blip(90) ? 1 : 0], CRICKET_POS.x, CRICKET_POS.y);
          break;
      }
    }
    return out;
  }

  private updateAmbient(now: number) {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.reducedMotion) return;
    if (this.present.sparrow && now > this.nextSparrowHop) {
      if (this.nextSparrowHop > 0) {
        if (this.rng() < 0.5) this.sparrowFacing = 1 - this.sparrowFacing;
        else this.sparrowSpot = Math.floor(this.rng() * SPARROW_SPOTS.length);
      }
      this.nextSparrowHop = now + 6000 + this.rng() * 12000;
    }
    if (now > this.nextChat) {
      const r = this.rng();
      this.chat = this.chat !== 'idle' ? 'idle' : r < 0.45 ? 'talk' : r < 0.75 ? 'sip' : 'nod';
      this.nextChat = now + (this.chat === 'idle' ? 1500 + this.rng() * 3500 : 900 + this.rng() * 1600);
    }
    this.updateRiders(now, dt);
  }

  /** Cyclists ride past along the campus path in both directions now and then. */
  private updateRiders(now: number, dt: number) {
    if (now > this.nextRider) {
      if (this.nextRider > 0 && this.riders.length < 2) {
        const dir = this.rng() < 0.5 ? 1 : -1;
        const look = BIKERS[Math.floor(this.rng() * BIKERS.length)];
        this.riders.push({
          frames: dir === 1 ? look : look.map(flipX),
          x: dir === 1 ? -12 : W + 2,
          dir,
          y: dir === 1 ? PATH.bottom - 9 : PATH.bottom - 11,
        });
      }
      this.nextRider = now + 18000 + this.rng() * 40000;
    }
    for (const r of this.riders) r.x += r.dir * BIKE_SPEED * dt;
    this.riders = this.riders.filter((r) => r.x > -14 && r.x < W + 4);
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    this.updateAmbient(now);
    const pal = PALETTES[this.time];
    const t = this.reducedMotion ? 0 : now / 1000;
    const night = this.time === 'night';
    const { far, mid, fg, glow } = this.getLayers(this.time, !!this.present.rain);
    const placed = this.place(now);
    this.placedCache = placed;
    const get = (id: ElementId) => placed.find((p) => p.id === id);

    ctx.drawImage(far, 0, 0);
    if (night && !this.present.rain && !this.reducedMotion) {
      STARS.forEach((s, i) => {
        if (i % 2 === 0 && Math.sin(t * 0.35 + i * 1.7) > 0.98) {
          ctx.fillStyle = hex(skyColor('night', pal, s.x, s.y));
          ctx.fillRect(s.x, s.y, 1, 1);
        }
      });
    }
    if (this.time !== 'night') drawDrifters(ctx, WISPS, t, pal, W, this.time === 'sunset' ? 3 : 1);

    const rain = get('rain');
    if (rain) for (const s of rain.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);

    this.drawRiders(ctx, pal);
    ctx.drawImage(mid, 0, 0);
    for (const id of ['chatter', 'typing'] as const) {
      const p = get(id);
      if (p) for (const s of p.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    }
    if (rain) this.drawDrops(ctx, pal, t, rain.parts);
    ctx.drawImage(fg, 0, 0);
    if (rain) {
      ctx.fillStyle = pal.rainTint;
      ctx.fillRect(0, 0, W, H);
    }
    if (glow) ctx.drawImage(glow, 0, 0);
    for (const id of ['crickets', 'sparrow', 'crow'] as const) {
      const p = get(id);
      if (p) for (const s of p.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    }
    this.drawHighlight(ctx);
  }

  private drawRiders(ctx: CanvasRenderingContext2D, pal: Palette<StradaKey>) {
    for (const r of this.riders) {
      const frame = r.frames[Math.floor(Math.abs(r.x) / 3) % 2];
      drawSprite(ctx, frame, Math.round(r.x), r.y, pal);
    }
  }

  private drawDrops(ctx: CanvasRenderingContext2D, pal: Palette<StradaKey>, t: number, clouds: Part<StradaKey>[]) {
    ctx.fillStyle = pal.rain;
    ctx.globalAlpha = 0.6;
    for (const d of this.drops) {
      const c = clouds[d.cloud];
      const x0 = c.x + d.dx;
      const y0 = c.y + c.sprite.h - 1;
      const ground = 122 + d.land * (H - 126);
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
}
