import type { ElementId } from '../../elements';
import type { Palette, TimeOfDay } from '../palette';
import { hex } from '../pixels';
import { drawDrifters, drawSprite, type Sprite } from '../sprites';
import { Stage, W, alphaMask, type Part, type Placed } from '../stage';
import { FISHERS, FISHER_COUNT, FLOAT, POST, STARS, deckY, drawFar, drawFg, drawMid, skyColor } from './backdrop';
import { PALETTES, type MarinaKey } from './palette';
import { BOATS, FOAM, FOAM_POS, FOG, FOG_POS, GEESE, GULL, HERON, SEALIONS, WISPS } from './sprites';

const GULL_POS = { x: POST.x - 4, y: POST.top - GULL.idle.h };
const HERON_POS = { x: POST.x - 3, y: POST.top - HERON.idle.h };
const SEALION_POS = { x: FLOAT.x0, y: FLOAT.y - SEALIONS.idle.h + 1 };
const GEESE_POS = { x: 196, y: 158 };

/** The foam is hidden where rocks and the bank cover it. */
const OCCLUDED = new Set<ElementId>(['waves']);

interface Layers {
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  fg: HTMLCanvasElement;
}

/** The Berkeley Marina shore at the foot of the pier, looking west to the Golden Gate. */
export class Marina extends Stage<MarinaKey> {
  private layers = new Map<string, Layers>();
  private midMask: Uint8Array;
  private nextGeese = 0;
  private geese: keyof typeof GEESE = 'idle';
  private twitch = FISHERS.map(() => 0);
  private nextTwitch = 0;

  constructor(elements: ElementId[]) {
    super(elements);
    this.unpadded = new Set(['foghorn']);
    this.midMask = alphaMask(this.getLayers('day').mid);
  }

  protected get palette(): Palette<MarinaKey> {
    return PALETTES[this.time];
  }

  private getLayers(time: TimeOfDay): Layers {
    let l = this.layers.get(time);
    if (!l) {
      const pal = PALETTES[time];
      l = { far: drawFar(pal, time), mid: drawMid(pal, time), fg: drawFg(pal) };
      this.layers.set(time, l);
    }
    return l;
  }

  protected restingParts(id: ElementId): Part<MarinaKey>[] {
    switch (id) {
      case 'waves':
        return [{ sprite: FOAM[0], ...FOAM_POS }];
      case 'foghorn':
        return [{ sprite: FOG, ...FOG_POS }];
      case 'gull':
        return [{ sprite: GULL.idle, ...GULL_POS }];
      case 'geese':
        return [{ sprite: GEESE.idle, ...GEESE_POS }];
      case 'heron':
        return [{ sprite: HERON.idle, ...HERON_POS }];
      case 'sealions':
        return [{ sprite: SEALIONS.idle, ...SEALION_POS }];
      default:
        return [];
    }
  }

  protected occluded(id: ElementId, x: number, y: number) {
    if (super.occluded(id, x, y)) return true;
    return OCCLUDED.has(id) && this.midMask[y * W + x] === 1;
  }

  private place(now: number): Placed<MarinaKey>[] {
    const t = this.reducedMotion ? 0 : now / 1000;
    const still = this.reducedMotion;
    const blip = (ms: number) => !still && Math.floor(now / ms) % 2 === 0;
    const out: Placed<MarinaKey>[] = [];
    const at = (id: ElementId, sprite: Sprite<MarinaKey>, pos: { x: number; y: number }, dx = 0) =>
      out.push({ id, parts: [{ sprite, x: pos.x + dx, y: pos.y }] });

    for (const id of Object.keys(this.present) as ElementId[]) {
      if (!this.present[id]) continue;
      switch (id) {
        case 'waves':
          at(id, FOAM[Math.floor(t * 1.6) % FOAM.length], FOAM_POS);
          break;
        case 'foghorn':
          at(id, FOG, FOG_POS, Math.round(Math.sin((t * 2 * Math.PI) / 90) * 4));
          break;
        case 'gull':
          at(id, this.calling(id, now) && blip(200) ? GULL.call : GULL.idle, GULL_POS);
          break;
        case 'heron':
          at(id, this.calling(id, now) ? HERON.call : HERON.idle, HERON_POS);
          break;
        case 'geese':
          at(id, this.calling(id, now) ? (blip(400) ? GEESE.honk : GEESE.answer) : GEESE[this.geese], GEESE_POS);
          break;
        case 'sealions':
          at(id, this.calling(id, now) && blip(350) ? SEALIONS.bark : SEALIONS.idle, SEALION_POS);
          break;
      }
    }
    return out;
  }

  private updateAmbient(now: number) {
    if (this.reducedMotion) return;
    if (now > this.nextGeese) {
      this.geese = this.geese === 'idle' && this.rng() < 0.3 ? 'answer' : 'idle';
      this.nextGeese = now + 4000 + this.rng() * 8000;
    }
    if (now > this.nextTwitch) {
      const i = Math.floor(this.rng() * FISHERS.length);
      this.twitch[i] = now + 600;
      this.nextTwitch = now + 5000 + this.rng() * 9000;
    }
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    this.updateAmbient(now);
    const pal = PALETTES[this.time];
    const t = this.reducedMotion ? 0 : now / 1000;
    const { far, mid, fg } = this.getLayers(this.time);
    const placed = this.place(now);
    this.placedCache = placed;
    const get = (id: ElementId) => placed.find((p) => p.id === id);

    ctx.drawImage(far, 0, 0);
    if (this.time === 'night' && !this.reducedMotion) {
      STARS.forEach((s, i) => {
        if (i % 2 === 0 && Math.sin(t * 0.35 + i * 1.7) > 0.98) {
          ctx.fillStyle = hex(skyColor('night', pal, s.x, s.y));
          ctx.fillRect(s.x, s.y, 1, 1);
        }
      });
    }
    if (this.time !== 'night') {
      drawDrifters(ctx, WISPS, t, pal, W, this.time === 'sunset' ? 3 : 1);
      drawDrifters(ctx, BOATS, t, pal, W);
    }
    for (const id of ['foghorn', 'waves'] as const) {
      const p = get(id);
      if (p) for (const s of p.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    }
    ctx.drawImage(mid, 0, 0);
    this.drawLines(ctx, pal, now);
    for (const id of ['sealions', 'geese'] as const) {
      const p = get(id);
      if (p) for (const s of p.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    }
    ctx.drawImage(fg, 0, 0);
    for (const id of ['gull', 'heron'] as const) {
      const p = get(id);
      if (p) for (const s of p.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    }
    this.drawHighlight(ctx);
  }

  /** Each fisher's rod out over the rail and the line down to the water; now and then a rod twitches. */
  private drawLines(ctx: CanvasRenderingContext2D, pal: Palette<MarinaKey>, now: number) {
    FISHERS.slice(0, FISHER_COUNT[this.time]).forEach((f, i) => {
      const s = f.left ? -1 : 1;
      const top = deckY(f.x + 2) - 9;
      const hand = { x: f.x + (f.left ? 0 : 4), y: top + 5 };
      const lift = now < this.twitch[i] ? 1 : 0;
      const tip = { x: hand.x + s * 7, y: hand.y - 6 - lift };
      ctx.fillStyle = pal.rod;
      for (let j = 0; j <= 7; j++) ctx.fillRect(hand.x + s * j, Math.round(hand.y - (j * (6 + lift)) / 7), 1, 1);
      ctx.fillStyle = pal.line;
      const water = deckY(tip.x) + 10;
      for (let y = tip.y + 1; y <= water; y++) {
        const u = (y - tip.y) / (water - tip.y);
        ctx.fillRect(Math.round(tip.x + s * 2 * u * u), y, 1, 1);
      }
    });
  }
}
