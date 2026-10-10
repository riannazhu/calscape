import type { ElementId } from '../../elements';
import type { Palette, TimeOfDay } from '../palette';
import { mulberry32 } from '../pixels';
import { drawDrifters, drawSprite, flipX, type Sprite } from '../sprites';
import { H, Stage, W, alphaMask, type Part, type Placed } from '../stage';
import {
  CODES,
  FRONT_RAIL,
  LAMP,
  LEAF_EDGES,
  PATH,
  STARS,
  drawFar,
  drawBulbs,
  drawGlow,
  drawLaptopGlow,
  drawLeaves,
  drawMid,
} from './backdrop';
import { PALETTES, artKey, type StradaKey } from './palette';
import {
  BANNER,
  BIKERS,
  CHATTER,
  CRICKET,
  CROW,
  RAIN_CLOUDS,
  SPARROW,
  TYPIST,
  WISPS,
  type HeadPose,
} from './sprites';

/** The typist's hand poses in the order they come up while he types: reach, press, lift, rest. */
const KEYSTROKES = [1, 2, 3, 1, 0, 2, 3, 2, 1, 3, 0, 1];

/** A few sparrows hop between spots along the front railing's top rail, never two on one spot. */
const SPARROW_SPOTS = [250, 266, 282, 298, 311];
const sparrowY = () => FRONT_RAIL - SPARROW.idle.h;
/** One crow keeps watch from the cap of the bannered street lamp, another from a plum limb against the sky. */
const CROW_PERCHES = [
  { x: LAMP.x - 5, y: LAMP.cap - CROW.idle.h, flip: false },
  { x: 197, y: 28 - CROW.idle.h, flip: true },
];
/** A cricket sings from the shrub at the end of the front railing. */
const CRICKET_POS = { x: 204, y: 161 - CRICKET[0].h };
const BIKE_SPEED = 16;

/** Rain clouds gather behind the trees, loggia and lamp, which hide them where they overlap. */
const OCCLUDED = new Set<ElementId>(['rain']);

interface Layers {
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  leaves: HTMLCanvasElement;
  /** The string-light bulbs, laid back over leaves a gust has shoved across them. */
  bulbs: HTMLCanvasElement;
  /** Lamp and bulb halos, laid over everything after dark. */
  glow: HTMLCanvasElement | null;
  /** The typist's screen light, laid over him while he is there after dark. */
  laptopGlow: HTMLCanvasElement | null;
}

/** A head pose for a patron: how far the head moves, how long it is held and how often it is picked. */
interface PatronPose {
  shift: readonly [number, number];
  hold: readonly [number, number];
  chance: number;
}

const STILL = [0, 0] as const;
const DOWN = [0, 1] as const;

/**
 * The patrons drawn into the picture, by the box around each head. Their heads
 * move a pixel at a time: the woman at the left table reads, looking down
 * for long stretches and up now and then; the man in teal talks with nods and
 * leans; the pair beyond the trunk nod and glance about.
 */
const PATRONS: { box: readonly [number, number, number, number]; poses: PatronPose[] }[] = [
  {
    box: [40, 99, 54, 115],
    poses: [
      { shift: DOWN, hold: [3000, 8000], chance: 0.55 },
      { shift: STILL, hold: [1500, 4000], chance: 0.35 },
      { shift: [-1, 0], hold: [900, 2000], chance: 0.1 },
    ],
  },
  {
    box: [104, 98, 119, 111],
    poses: [
      { shift: STILL, hold: [800, 3000], chance: 0.45 },
      { shift: DOWN, hold: [250, 450], chance: 0.35 },
      { shift: [1, 0], hold: [1200, 3000], chance: 0.2 },
    ],
  },
  {
    box: [184, 101, 199, 113],
    poses: [
      { shift: STILL, hold: [1500, 5000], chance: 0.55 },
      { shift: DOWN, hold: [300, 500], chance: 0.25 },
      { shift: [-1, 0], hold: [1000, 2500], chance: 0.2 },
    ],
  },
  {
    box: [223, 100, 237, 112],
    poses: [
      { shift: STILL, hold: [1200, 4500], chance: 0.6 },
      { shift: DOWN, hold: [300, 500], chance: 0.25 },
      { shift: [1, 0], hold: [1000, 2200], chance: 0.15 },
    ],
  },
];

/** A puff of wind stirring one patch of a crown as it drifts, then dying away. */
interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  strength: number;
  /** Overlapping circles giving the patch an uneven outline: [dx, dy, r]. */
  lobes: [number, number, number][];
}

/** A leaf torn off by a puff, carried along with it and then drifting down. */
interface FlyingLeaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  sway: number;
  key: StradaKey;
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
  private sparrows = [
    { spot: 0, facing: 0 },
    { spot: 2, facing: 1 },
    { spot: 4, facing: 0 },
  ];
  private nextSparrowHop = 0;
  /** Who is talking, and each head's pose until its time is up. */
  private talker: 'her' | 'him' = 'her';
  private nextTurn = 0;
  private heads = { her: { pose: 'still' as HeadPose, until: 0 }, him: { pose: 'still' as HeadPose, until: 0 } };
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
  private patrons = PATRONS.map(() => ({ shift: [0, 0] as readonly [number, number], until: 0 }));
  private puffs: Puff[] = [];
  private nextGust = 0;
  private gustUntil = 0;
  private bannerWind = 0;
  private bannerPhase = 0;
  private bannerLast = 0;
  private flying: FlyingLeaf[] = [];
  private last = 0;

  constructor(elements: ElementId[]) {
    super(elements);
    this.unpadded = new Set(['rain']);
    this.midMask = alphaMask(this.getLayers('day').mid);
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
        : {
            far: drawFar(pal, time),
            mid: drawMid(pal),
            leaves: drawLeaves(pal),
            bulbs: drawBulbs(pal),
            glow: drawGlow(pal, time),
            laptopGlow: drawLaptopGlow(pal, time),
          };
      this.layers.set(key, l);
    }
    return l;
  }

  protected restingParts(id: ElementId): Part<StradaKey>[] {
    switch (id) {
      case 'rain':
        return RAIN_CLOUDS.map((c) => ({ ...c }));
      case 'chatter':
        return [{ ...CHATTER.idle }];
      case 'typing':
        return [{ sprite: TYPIST.frames[0], ...TYPIST.pos }];
      case 'sparrow':
        return this.sparrows.map((b) => ({ sprite: SPARROW.idle, x: SPARROW_SPOTS[b.spot], y: sparrowY() }));
      case 'crow':
        return CROW_PERCHES.map((c) => ({ sprite: c.flip ? flipX(CROW.idle) : CROW.idle, x: c.x, y: c.y }));
      case 'crickets':
        return [{ sprite: CRICKET[0], ...CRICKET_POS }];
      default:
        return [];
    }
  }

  protected occluded(id: ElementId, x: number, y: number) {
    if (super.occluded(id, x, y)) return true;
    return OCCLUDED.has(id) && this.midMask[y * W + x] === 1;
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
          out.push({ id, parts: [{ ...(still ? CHATTER.idle : CHATTER.pose(this.heads.her.pose, this.heads.him.pose)) }] });
          break;
        case 'typing': {
          // Keys come at an uneven pace while he types; between bursts his hand rests.
          const k = Math.floor(now / 85);
          const stroke = (k * 7 + ((k * 2654435761) >>> 28)) % KEYSTROKES.length;
          const frame = !still && this.calling(id, now) ? KEYSTROKES[stroke] : 0;
          at(id, TYPIST.frames[frame], TYPIST.pos.x, TYPIST.pos.y);
          break;
        }
        case 'sparrow': {
          const turn = Math.floor(now / 400) % this.sparrows.length;
          out.push({
            id,
            parts: this.sparrows.map((b, i) => {
              const s = this.calling(id, now) && turn === i && blip(120) ? SPARROW.chirp : SPARROW.idle;
              return { sprite: b.facing ? flipX(s) : s, x: SPARROW_SPOTS[b.spot], y: sparrowY() };
            }),
          });
          break;
        }
        case 'crow': {
          const turn = Math.floor(now / 900) % CROW_PERCHES.length;
          out.push({
            id,
            parts: CROW_PERCHES.map((c, i) => {
              const s = this.calling(id, now) && turn === i && blip(260) ? CROW.caw : CROW.idle;
              return { sprite: c.flip ? flipX(s) : s, x: c.x, y: c.y };
            }),
          });
          break;
        }
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
        const b = this.sparrows[Math.floor(this.rng() * this.sparrows.length)];
        const free = SPARROW_SPOTS.map((_, i) => i).filter((i) => !this.sparrows.some((o) => o.spot === i));
        if (this.rng() < 0.5) b.facing = 1 - b.facing;
        else b.spot = free[Math.floor(this.rng() * free.length)];
      }
      this.nextSparrowHop = now + 3000 + this.rng() * 7000;
    }
    this.updateConversation(now);
    this.updateGusts(now, dt);
    this.updateRiders(now, dt);
    this.updatePatrons(now);
  }

  /** Each patron holds a head pose for a while, then picks another of their own. */
  private updatePatrons(now: number) {
    PATRONS.forEach((p, i) => {
      const s = this.patrons[i];
      if (now < s.until) return;
      const r = this.rng();
      let acc = 0;
      const pick = p.poses.find((pose) => (acc += pose.chance) > r) ?? p.poses[0];
      s.shift = pick.shift;
      s.until = now + pick.hold[0] + this.rng() * (pick.hold[1] - pick.hold[0]);
    });
  }

  /**
   * The couple take turns: the talker's head bobs with her or his words and
   * now and then leans in; the listener mostly keeps still, nodding along or
   * leaning in once in a while.
   */
  private updateConversation(now: number) {
    if (now > this.nextTurn) {
      if (this.nextTurn > 0 && this.rng() < 0.75) this.talker = this.talker === 'her' ? 'him' : 'her';
      this.nextTurn = now + 2500 + this.rng() * 6500;
    }
    for (const who of ['her', 'him'] as const) {
      const h = this.heads[who];
      if (now < h.until) continue;
      const r = this.rng();
      if (who === this.talker) {
        h.pose = h.pose !== 'still' ? 'still' : r < 0.8 ? 'bob' : 'lean';
        h.until = now + (h.pose === 'lean' ? 900 + this.rng() * 900 : 180 + this.rng() * 340);
      } else if (h.pose !== 'still') {
        h.pose = 'still';
        h.until = now + 1500 + this.rng() * 3500;
      } else {
        h.pose = r < 0.6 ? 'bob' : r < 0.8 ? 'lean' : 'still';
        h.until = now + (h.pose === 'bob' ? 300 + this.rng() * 150 : 1200 + this.rng() * 1500);
      }
    }
  }

  /** How strongly a puff is blowing: it rises, peaks and dies away over its life. */
  private puffEnvelope(p: Puff, now: number) {
    const a = (now - p.born) / p.life;
    return a < 0 || a > 1 ? 0 : Math.sin(a * Math.PI) * p.strength;
  }

  private spawnPuff(now: number) {
    const anchor = LEAF_EDGES[Math.floor(this.rng() * LEAF_EDGES.length)];
    if (!anchor) return;
    // Mostly from the top left toward the bottom right, but loosely.
    const angle = Math.PI / 4 + (this.rng() - 0.5) * Math.PI * 0.9;
    const speed = 8 + this.rng() * 18;
    const r = 11 + this.rng() * 12;
    const lobes: [number, number, number][] = Array.from({ length: 2 + Math.floor(this.rng() * 3) }, () => [
      (this.rng() - 0.5) * r * 1.2,
      (this.rng() - 0.5) * r * 0.9,
      r * (0.45 + this.rng() * 0.4),
    ]);
    this.puffs.push({
      x: anchor.x + (this.rng() - 0.5) * 10,
      y: anchor.y + (this.rng() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      born: now,
      life: 1400 + this.rng() * 2200,
      strength: 0.5 + this.rng() * 0.5,
      lobes,
    });
  }

  /**
   * Every so often a gust breaks over the crowns as a scatter of puffs, each
   * stirring its own patch of leaves at a random spot, drifting loosely down
   * and to the right, and dying away; single puffs stir a branch now and then
   * in between. Strong puffs tear off a leaf that drifts down with them.
   */
  private updateGusts(now: number, dt: number) {
    if (now > this.nextGust) {
      if (this.nextGust > 0) this.gustUntil = now + 1500 + this.rng() * 2500;
      this.nextGust = now + (this.present.rain ? 4000 : 7000) + this.rng() * 9000;
    }
    const rate = now < this.gustUntil ? 2.8 : 0.12;
    if (this.puffs.length < 7 && this.rng() < dt * rate) this.spawnPuff(now);
    for (const p of this.puffs) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const s = this.puffEnvelope(p, now);
      if (s > 0.5 && this.flying.length < 10 && this.rng() < dt * 1.2 * s) {
        const near = LEAF_EDGES.filter((e) => !e.leaf && Math.abs(e.x - p.x) < 8 && Math.abs(e.y - p.y) < 8);
        const e = near[Math.floor(this.rng() * near.length)];
        if (e) {
          this.flying.push({
            x: e.x,
            y: e.y,
            vx: p.vx * (1.4 + this.rng()),
            vy: p.vy * (0.6 + this.rng() * 0.6),
            born: now,
            sway: this.rng() * Math.PI * 2,
            key: artKey(CODES[e.y * W + e.x]),
          });
        }
      }
    }
    this.puffs = this.puffs.filter((p) => now - p.born < p.life);
    for (const l of this.flying) {
      const age = (now - l.born) / 1000;
      const drag = 1 - Math.min(1, dt * 0.6);
      l.vx *= drag;
      l.vy *= drag;
      l.x += l.vx * dt;
      l.y += (l.vy + 6 + Math.sin(age * 5 + l.sway) * 10) * dt;
    }
    this.flying = this.flying.filter((l) => l.x > -4 && l.x < W + 4 && l.y < 150 && now - l.born < 9000);
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
    const { far, mid, leaves, bulbs, glow, laptopGlow } = this.getLayers(this.time, !!this.present.rain);
    const placed = this.place(now);
    this.placedCache = placed;
    const get = (id: ElementId) => placed.find((p) => p.id === id);

    ctx.drawImage(far, 0, 0);
    if (night && !this.present.rain && !this.reducedMotion) {
      STARS.forEach((s, i) => {
        if (i % 2 === 0 && Math.sin(t * 0.35 + i * 1.7) > 0.98) {
          ctx.drawImage(this.getLayers('night').far, s.x, s.y, 1, 1, s.x, s.y, 1, 1);
        }
      });
    }
    if (!this.present.rain) drawDrifters(ctx, WISPS, t, pal, W);

    const rain = get('rain');
    if (rain) for (const s of rain.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);

    this.drawRiders(ctx, pal);
    ctx.drawImage(mid, 0, 0);
    this.drawPatrons(ctx, mid);
    this.drawWind(ctx, pal, leaves, bulbs, now);
    this.drawBanner(ctx, pal, now);
    for (const id of ['chatter', 'typing'] as const) {
      const p = get(id);
      if (p) for (const s of p.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    }
    if (rain) this.drawDrops(ctx, pal, t, rain.parts);
    if (rain) {
      ctx.fillStyle = pal.rainTint;
      ctx.fillRect(0, 0, W, H);
    }
    if (glow) ctx.drawImage(glow, 0, 0);
    if (laptopGlow && get('typing')) ctx.drawImage(laptopGlow, 0, 0);
    for (const id of ['crickets', 'sparrow', 'crow'] as const) {
      const p = get(id);
      if (p) for (const s of p.parts) drawSprite(ctx, s.sprite, s.x, s.y, pal);
    }
    this.drawHighlight(ctx);
  }

  /**
   * Each puff: inside its uneven patch the leaves are shoved a pixel the way
   * it blows and flicker back, and the crown's edges toss against the sky;
   * torn-off leaves drift along with it.
   */
  private drawWind(
    ctx: CanvasRenderingContext2D,
    pal: Palette<StradaKey>,
    leaves: HTMLCanvasElement,
    bulbs: HTMLCanvasElement,
    now: number,
  ) {
    if (this.reducedMotion) return;
    const t = now / 1000;
    for (const p of this.puffs) {
      const s = this.puffEnvelope(p, now);
      if (s < 0.15) continue;
      const seed = p.born % 97;
      const shove = Math.sin(t * (7 + (seed % 5)) + seed) > 0.3 - s * 0.9;
      if (shove) {
        const len = Math.hypot(p.vx, p.vy) || 1;
        ctx.save();
        ctx.beginPath();
        for (const [dx, dy, r] of p.lobes) {
          ctx.moveTo(Math.round(p.x + dx + r), Math.round(p.y + dy));
          ctx.arc(Math.round(p.x + dx), Math.round(p.y + dy), Math.round(r), 0, Math.PI * 2);
        }
        ctx.clip();
        ctx.drawImage(leaves, Math.round(p.vx / len), Math.round(p.vy / len));
        ctx.restore();
      }
      const reach = Math.max(...p.lobes.map(([dx, dy, r]) => Math.hypot(dx, dy) + r));
      for (const e of LEAF_EDGES) {
        if (Math.abs(e.x - p.x) > reach || Math.abs(e.y - p.y) > reach) continue;
        const inside = p.lobes.some(([dx, dy, r]) => Math.hypot(e.x - p.x - dx, e.y - p.y - dy) < r);
        if (inside && Math.sin(t * 11 + e.x * 1.7 + e.y * 2.3) > 1 - s * 1.4) {
          ctx.fillStyle = pal[artKey(e.code)];
          ctx.fillRect(e.x, e.y, 1, 1);
        }
      }
    }
    if (this.puffs.length) ctx.drawImage(bulbs, 0, 0);
    for (const l of this.flying) {
      ctx.fillStyle = pal[l.key];
      const tumble = Math.floor((now - l.born) / 140) % 2;
      ctx.fillRect(Math.round(l.x), Math.round(l.y), tumble ? 2 : 1, tumble ? 1 : 2);
    }
  }

  /**
   * Moves each patron's head by redrawing its box shifted, then fills the strip
   * it uncovers with the strip of the patio just beyond the box.
   */
  private drawPatrons(ctx: CanvasRenderingContext2D, mid: HTMLCanvasElement) {
    if (this.reducedMotion) return;
    PATRONS.forEach(({ box: [x0, y0, x1, y1] }, i) => {
      const [dx, dy] = this.patrons[i].shift;
      if (!dx && !dy) return;
      const w = x1 - x0;
      const h = y1 - y0;
      ctx.drawImage(mid, x0, y0, w, h, x0 + dx, y0 + dy, w, h);
      if (dy > 0) ctx.drawImage(mid, x0, y0 - dy, w, dy, x0, y0, w, dy);
      if (dx > 0) ctx.drawImage(mid, x0 - dx, y0, dx, h, x0, y0, dx, h);
      if (dx < 0) ctx.drawImage(mid, x1, y0, -dx, h, x1 + dx, y0, -dx, h);
    });
  }

  /**
   * The banner is held top and bottom by its brackets, so it sways by bellying
   * out with the wind: the middle of the cloth bows downwind while the rows at
   * the brackets stay put, a flutter runs down it in a gust, and it settles
   * back as the gust dies. A light breeze nudges it a pixel now and then
   * between gusts. In a gust soft folds also run across the cloth, a lit crest
   * then a shaded trough.
   */
  private drawBanner(ctx: CanvasRenderingContext2D, pal: Palette<StradaKey>, now: number) {
    const { sprite, x, y, fabric } = BANNER;
    if (this.reducedMotion) {
      drawSprite(ctx, sprite, x, y, pal);
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - this.bannerLast) / 1000));
    this.bannerLast = now;
    const target = now < this.gustUntil ? 1 : 0;
    this.bannerWind += (target - this.bannerWind) * Math.min(1, dt * (target ? 2.5 : 0.7));
    this.bannerPhase += dt * (3 + 5 * this.bannerWind);
    const wind = this.bannerWind;
    const t = now / 1000;
    const h = fabric.y1 - fabric.y0;
    const breeze = 0.6 * (0.5 + 0.5 * Math.sin(t * 0.5));
    const billow = breeze + wind * (1 + 0.4 * Math.sin(t * 1.3));
    const bows: number[] = [];
    const shifts: number[] = [];
    for (let r = 0; r < sprite.h; r++) {
      const inside = r >= fabric.y0 && r < fabric.y1;
      const bow = inside ? Math.sin(((r - fabric.y0 + 0.5) / h) * Math.PI) : 0;
      bows[r] = bow;
      shifts[r] = Math.max(0, Math.round(bow * (billow + wind * 0.4 * Math.sin(t * 4.1 - r * 0.5))));
      for (let c = 0; c < sprite.w; c++) {
        const key = sprite.px[r * sprite.w + c];
        if (!key) continue;
        ctx.fillStyle = pal[key];
        ctx.fillRect(x + c + (c >= fabric.x0 ? shifts[r] : 0), y + r, 1, 1);
      }
    }
    if (wind < 0.1) return;
    const gap = 9;
    const depth = wind > 0.55 ? 2 : 1;
    for (let r = fabric.y0; r < fabric.y1; r++) {
      const bow = bows[r];
      if (bow < 0.3) continue;
      for (let c = fabric.x0; c < fabric.x1; c++) {
        const phase = (((c - fabric.x0 - this.bannerPhase - bow * 1.5) % gap) + gap) % gap;
        const lit = phase < 1 && wind > 0.55;
        const shaded = phase >= 1 && phase < 1 + depth;
        if (!lit && !shaded) continue;
        const key = sprite.px[r * sprite.w + c];
        let k: StradaKey | null = null;
        if (key === 'bannerNavy' || key === 'bannerNavyLight') k = lit ? 'bannerNavyLight' : 'bannerNavyDark';
        else if (key === 'bannerGold' && shaded) k = 'bannerGoldDark';
        if (!k) continue;
        ctx.fillStyle = pal[k];
        ctx.fillRect(x + c + shifts[r], y + r, 1, 1);
      }
    }
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
