import { stamp, type Figure } from '../figures';
import { blob, branch } from '../foliage';
import type { Palette, TimeOfDay } from '../palette';
import { Painter, hash, mulberry32, noise, rgb, type RGB } from '../pixels';
import { clamp01, glowAt, overcastSky, steppedSky, type Glow, type Sky } from '../sky';
import { fromRows } from '../sprites';
import { H, W } from '../stage';
import type { StradaKey } from './palette';
import {
  CHATTER_POS,
  CHATTER_SEAT,
  CHATTER_TABLE,
  CUP,
  HANDS,
  LOOKS,
  TYPING_POS,
  TYPING_SEAT,
  TYPING_TABLE,
  friend,
  friendLongHair,
  smallPatron,
} from './sprites';

type P = Painter<StradaKey>;
type Pal = Palette<StradaKey>;

/** The campus path beyond the railing, where cyclists pass. */
export const PATH = { top: 96, bottom: 104 };
/** Where the patio's brick paving begins. */
const PATIO = 120;
const SUN = { x: 128, y: 52, r: 5 };

const SKY_KEYS: StradaKey[] = ['sky0', 'sky1', 'sky2', 'sky3', 'sky4', 'sky5'];
const SKY_LEVELS: Record<TimeOfDay, number> = { day: 20, sunset: 30, night: 14 };

function skyField(time: TimeOfDay, x: number, y: number) {
  const v = clamp01(y / 92);
  if (time !== 'sunset') return v;
  return clamp01(0.35 * v + 0.65 * (1 - Math.hypot(x - SUN.x, (y - SUN.y) * 1.4) / 240));
}

const SKY_GLOWS: Record<TimeOfDay, Glow[]> = {
  day: [],
  sunset: [{ ...SUN, r: 18, a: 0.45, steps: 3 }],
  night: [],
};

const skies = new Map<TimeOfDay, Sky>();

export function skyColor(time: TimeOfDay, pal: Pal, x: number, y: number): RGB {
  let sky = skies.get(time);
  if (!sky) {
    sky = {
      ramp: (time === 'sunset' ? [...SKY_KEYS, 'glow' as const] : SKY_KEYS).map((k) => rgb(pal[k])),
      levels: SKY_LEVELS[time],
      field: (fx, fy) => skyField(time, fx, fy),
      glows: SKY_GLOWS[time],
      glow: rgb(pal.glow),
    };
    skies.set(time, sky);
  }
  return steppedSky(sky, x, y);
}

const OVERCAST_SKY_SHOW: Record<TimeOfDay, number> = { day: 0.12, sunset: 0.35, night: 0.3 };

function overcastColor(time: TimeOfDay, pal: Pal, x: number, y: number): RGB {
  const deck = (['cloudDark', 'cloudShade', 'cloudMid'] as const).map((k) => rgb(pal[k]));
  return overcastSky(deck, skyColor(time, pal, x, y), OVERCAST_SKY_SHOW[time], 92, x, y);
}

/**
 * The lower edge of the plum canopy: low over the café and the left tree,
 * lifting over the middle of the patio to leave open sky, sweeping down again
 * on the right.
 */
function canopyEdge(x: number) {
  const n = 8 * noise(x, 0, 14, 3);
  if (x < 96) return 26 + n + 6 * Math.sin(x * 0.09);
  if (x < 226) return 12 + n;
  return 16 + (x - 226) * 0.6 + n;
}

const starRng = mulberry32(11);
export const STARS = Array.from({ length: 40 }, () => ({
  x: 60 + Math.floor(starRng() * (W - 60)),
  y: 14 + Math.floor(starRng() * 50),
})).filter((s) => s.y > canopyEdge(s.x) + 6);

const LIT_SHARE: Record<TimeOfDay, number> = { day: 0.1, sunset: 0.3, night: 0.6 };
const lit = (seed: number, time: TimeOfDay) => hash(seed, 5, 91) < LIT_SHARE[time];

/** Campus beyond the patio: a lush tree line, a tile-roofed hall, a lawn and the path. */
function campus(p: P, time: TimeOfDay) {
  const hall = (x0: number, x1: number, roof: number) => {
    for (let y = roof; y < roof + 4; y++) {
      const inset = roof + 3 - y;
      for (let x = x0 + inset; x <= x1 - inset; x++) p.set(x, y, (y - roof) % 2 ? 'hallRoofDark' : 'hallRoof');
    }
    for (let y = roof + 4; y < 92; y++) for (let x = x0; x <= x1; x++) p.set(x, y, x >= x1 - 1 ? 'hallShade' : 'hall');
    for (let wy = roof + 6; wy + 3 < 92; wy += 6) {
      for (let wx = x0 + 3; wx + 2 < x1 - 1; wx += 5) {
        const on = lit(wx * 3 + wy, time);
        p.rect(wx, wy, 2, 3, on ? 'winLit' : 'winDark');
        if (on) p.set(wx, wy + 2, 'winLit2');
      }
    }
  };
  hall(238, 292, 72);
  // Rounded crowns of the trees along the far side of the lawn.
  const crowns = mulberry32(17);
  for (let cx = -4; cx < W + 8; ) {
    const r = 7 + crowns() * 6;
    const cy = 74 + crowns() * 6 - (cx > 230 && cx < 300 ? -6 : 0);
    for (let y = Math.floor(cy - r); y < 94; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const above = y < cy && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r;
        if (above || x < 0 || x >= W) continue;
        const dx = x - cx;
        const dy = y - cy;
        const lightSide = -dx * 0.5 - dy * 0.8 > r * 0.35;
        p.set(x, y, lightSide && hash(x >> 1, y >> 1, 5) > 0.2 ? 'farTree' : 'farTreeDark');
      }
    }
    cx += r * 1.3;
  }
  for (let y = 90; y < PATH.top; y++) {
    for (let x = 0; x < W; x++) p.set(x, y, y < 92 && hash(x, y, 8) < 0.5 ? 'lawnDark' : y === PATH.top - 1 ? 'lawnDark' : 'lawn');
  }
  for (let y = PATH.top; y < PATH.bottom; y++) p.rect(0, y, W, 1, y === PATH.top ? 'mortar' : 'path');
  // Low planting just beyond the patio railing.
  for (let x = 0; x < W; x++) {
    const top = PATH.bottom + Math.round(2 * noise(x, 0, 4, 31));
    for (let y = top; y < PATIO; y++) p.set(x, y, y < top + 2 && hash(x, y, 4) < 0.6 ? 'leafMid' : 'leafDark');
  }
}

/** Sky and campus: everything the cyclists pass in front of. */
export function drawFar(pal: Pal, time: TimeOfDay, overcast = false) {
  const p = new Painter<StradaKey>(W, H, pal);
  const sky = overcast ? overcastColor : skyColor;
  for (let y = 0; y < 96; y++) for (let x = 0; x < W; x++) p.setRGB(x, y, sky(time, pal, x, y));
  if (!overcast && time === 'night') for (const s of STARS) p.set(s.x, s.y, 'star');
  if (!overcast && time === 'sunset') {
    for (let y = SUN.y - SUN.r; y <= SUN.y + SUN.r; y++) {
      for (let x = SUN.x - SUN.r; x <= SUN.x + SUN.r; x++) {
        if (Math.hypot(x + 0.5 - SUN.x, y + 0.5 - SUN.y) < SUN.r) p.set(x, y, 'glow');
      }
    }
  }
  campus(p, time);
  return p.toCanvas();
}

/** The café's cream stucco front with a tall arched doorway full of warm light. */
const CAFE = { x1: 46, top: 18 };

function cafe(p: P) {
  const { x1, top } = CAFE;
  for (let y = top; y < PATIO + 2; y++) {
    for (let x = 0; x <= x1; x++) {
      const key: StradaKey = x >= x1 - 2 ? 'stuccoShade' : x <= 3 || (x >= x1 - 6 && x < x1 - 2) ? 'stuccoShade' : 'stucco';
      p.set(x, y, key);
    }
  }
  p.rect(0, top, x1 + 2, 3, 'stuccoShade');
  p.rect(0, top + 3, x1 + 2, 1, 'stuccoDark');
  const cx = 21;
  const r = 14;
  const archTop = 44;
  const bottom = 108;
  for (let y = archTop - r - 2; y < bottom; y++) {
    for (let x = cx - r - 2; x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - archTop);
      if (y < archTop && d > r + 2) continue;
      // A moulded frame round the opening.
      if ((y < archTop && d > r) || x < cx - r || x > cx + r - 1) {
        p.set(x, y, x > cx || (y < archTop && x + 0.5 > cx) ? 'stuccoDark' : 'stuccoShade');
        continue;
      }
      let key: StradaKey = y > 84 ? 'archLit2' : 'archLit';
      if (x === cx || x === cx - 1 || y === 74 || y === 75 || (y < archTop && Math.abs(d - r * 0.55) < 0.7)) key = 'stuccoDark';
      p.set(x, y, key);
    }
  }
  // Pendant lamp, menu board and counter glimpsed inside.
  p.rect(cx - 9, 50, 1, 6, 'stuccoDark');
  p.rect(cx - 11, 56, 5, 2, 'bulb');
  p.rect(cx + 4, 82, 8, 8, 'woodDark');
  p.rect(cx + 5, 83, 6, 6, 'wood');
  p.rect(cx - r, 96, r * 2, 2, 'woodDark');
  p.rect(cx - r, 98, r * 2, 10, 'wood');
  p.rect(cx - r, 98, r * 2, 1, 'woodLight');
  // Step and wainscot.
  p.rect(0, bottom, x1 + 1, PATIO + 2 - bottom, 'stuccoDark');
  p.rect(0, bottom, x1 + 1, 1, 'stuccoShade');
}

/** A street lamp beyond the railing flying a blue-and-gold Cal banner. */
const BANNER = fromRows(
  [
    'LLLLLLLLLLLLL',
    '.BBBBBBBBBBB.',
    '.BBBBBBBBBBB.',
    '.BGGBBBBBBBB.',
    '.GBBBGGBGBBB.',
    '.GBBGBGBGBBB.',
    '.GBBGBGBGBBB.',
    '.BGGBGGBGGGB.',
    '.BBBBBBBBBBB.',
    '.GGGGGGGGGGG.',
    '.BBBBBBBBBBB.',
    '.BBBB...BBBB.',
  ],
  { L: 'lampPost', B: 'banner', G: 'bannerGold' } as Record<string, StradaKey>,
);

export const LAMP = { x: 160, head: 44 };

function lamp(p: P) {
  const { x, head } = LAMP;
  p.rect(x - 3, head - 2, 8, 2, 'lampPost');
  p.rect(x - 1, head - 4, 4, 2, 'lampPost');
  p.rect(x - 2, head, 6, 6, 'lampGlass');
  p.rect(x - 2, head, 1, 6, 'lampPost');
  p.rect(x + 3, head, 1, 6, 'lampPost');
  p.rect(x - 3, head + 6, 8, 2, 'lampPost');
  p.rect(x, head + 8, 2, PATH.bottom + 2 - head - 8, 'lampPost');
  p.rect(x - 2, PATH.bottom, 6, 3, 'lampPost');
  stamp(p, { sprite: BANNER, x: x + 2, y: head + 14 });
}

/** Box hedge along the café side of the patio. */
function hedge(p: P) {
  const rng = mulberry32(23);
  for (let x = 46; x < 140; ) {
    const r = 5 + rng() * 3;
    blob(p, x, 98 - r * 0.2, r, 140 + x, -0.15);
    x += r * 1.1 + rng() * 2;
  }
  for (let x = 42; x < 142; x++) for (let y = 98; y < PATIO; y++) if (!p.filled(x, y)) p.set(x, y, 'leafDark');
}

/**
 * Brick paving in running bond, the joints converging on a vanishing point
 * so the courses grow toward the viewer.
 */
function patio(p: P) {
  const vx = 160;
  const vy = 50;
  const course = 9;
  let row = 0;
  for (let y0 = PATIO; y0 < H; row++) {
    const h = Math.max(3, Math.round((y0 - vy) / 11));
    for (let y = y0; y < Math.min(H, y0 + h); y++) {
      const scale = 60 / (y - vy);
      for (let x = 0; x < W; x++) {
        if (y === y0 + h - 1) {
          p.set(x, y, 'mortar');
          continue;
        }
        const u = (x + 0.5 - vx) * scale + (row % 2) * (course / 2);
        const prev = (x - 0.5 - vx) * scale + (row % 2) * (course / 2);
        if (Math.floor(u / course) !== Math.floor(prev / course)) {
          p.set(x, y, 'mortar');
          continue;
        }
        const tone = hash(Math.floor(u / course), row, 13);
        let key: StradaKey = tone < 0.25 ? 'brickDark' : tone < 0.8 ? 'brick' : 'brickLight';
        if (y === y0 && key === 'brick') key = 'brickLight';
        else if (y === y0 + h - 2 && key !== 'brickDark') key = 'brick';
        if (hash(x, y, 77) < 0.04) key = 'brickDark';
        p.set(x, y, key);
      }
    }
    y0 += h;
  }
}

/**
 * White balustrade: top and bottom rails with vase-shaped balusters lit from
 * the left, and ball-topped posts.
 */
function balustrade(p: P, x0: number, x1: number, top: number, base: number, spacing: number, bw: number, posts: number[]) {
  const rail = Math.max(2, Math.round(bw * 0.7));
  for (let x = x0; x <= x1; x++) {
    for (let i = 0; i < rail; i++) p.set(x, top + i, i === 0 ? 'railLight' : i === rail - 1 ? 'railShade' : 'rail');
    for (let i = 0; i < rail; i++) p.set(x, base - rail + 1 + i, i === 0 ? 'railLight' : i === rail - 1 ? 'railShade' : 'rail');
  }
  const y0 = top + rail;
  const y1 = base - rail;
  for (let bx = x0 + spacing / 2; bx < x1; bx += spacing) {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      // Neck, bulging belly, then a short foot.
      const w = t < 0.12 ? bw : t < 0.25 ? bw * 0.55 : t > 0.9 ? bw : bw * (0.6 + 0.45 * Math.sin(((t - 0.25) / 0.65) * Math.PI));
      const half = Math.max(1, Math.round(w / 2));
      for (let x = Math.round(bx) - half; x < Math.round(bx) + half; x++) {
        const rel = (x - (Math.round(bx) - half)) / (half * 2);
        p.set(x, y, rel < 0.3 ? 'railLight' : rel > 0.7 ? 'railShade' : 'rail');
      }
    }
  }
  for (const px of posts) {
    const pw = Math.round(bw * 1.6);
    const ballR = bw * 0.9;
    for (let y = top - 2; y <= base; y++) {
      for (let i = 0; i < pw; i++) p.set(px + i, y, i < pw * 0.3 ? 'railLight' : i >= pw * 0.75 ? 'railShade' : 'rail');
    }
    p.rect(px - 1, top - 3, pw + 2, 2, 'railShade');
    p.rect(px - 1, top - 3, pw + 2, 1, 'rail');
    const bcx = px + pw / 2;
    const bcy = top - 3 - ballR;
    for (let y = Math.floor(bcy - ballR); y < top - 3; y++) {
      for (let x = Math.floor(bcx - ballR); x <= bcx + ballR; x++) {
        const d = Math.hypot(x + 0.5 - bcx, y + 0.5 - bcy);
        if (d >= ballR) continue;
        const lit = x + 0.5 - bcx + (y + 0.5 - bcy) < -ballR * 0.4;
        p.set(x, y, lit ? 'railLight' : x + 0.5 - bcx > ballR * 0.35 ? 'railShade' : 'rail');
      }
    }
  }
}

/** A patio heater: a dish-shaped reflector on a tall post above a cylindrical tank housing. */
function heater(p: P, x: number, capY: number, baseY: number, cap: number, time: TimeOfDay) {
  const half = cap / 2;
  const dish = Math.max(3, Math.round(cap / 6));
  p.rect(x - 1, capY - dish - 2, 2, 2, 'heaterDark');
  for (let i = 0; i < dish; i++) {
    const w = Math.round(half * (0.3 + (0.7 * (i + 1)) / dish));
    p.rect(x - w, capY - dish + i, w * 2, 1, i === 0 ? 'heaterLight' : i === dish - 1 ? 'heaterDark' : 'heater');
    p.rect(x - w, capY - dish + i, Math.max(1, Math.round(w * 0.6)), 1, 'heaterLight');
  }
  const bw = Math.max(2, Math.round(cap / 10));
  const bh = Math.max(3, Math.round(cap / 6));
  p.rect(x - bw, capY, bw * 2, bh, 'heaterDark');
  if (time !== 'day') p.rect(x - bw + 1, capY + 1, bw * 2 - 2, bh - 2, 'flame');
  else p.rect(x - bw, capY, 1, bh, 'heater');
  const pole = Math.max(2, Math.round(cap / 14));
  const hw = Math.round(cap * 0.16);
  const hh = Math.round((baseY - capY) * 0.3);
  const poleTop = capY + bh;
  p.rect(x - pole / 2, poleTop, pole, baseY - hh - poleTop, 'heater');
  p.rect(x - pole / 2, poleTop, 1, baseY - hh - poleTop, 'heaterLight');
  p.rect(x - hw - 1, baseY - hh - 2, hw * 2 + 2, 2, 'heaterDark');
  for (let y = baseY - hh; y < baseY - 1; y++) {
    for (let i = -hw; i < hw; i++) {
      const rel = (i + hw) / (hw * 2);
      p.set(x + i, y, rel < 0.25 ? 'heaterLight' : rel > 0.75 ? 'heaterDark' : 'heater');
    }
  }
  p.rect(x - hw - 2, baseY - 2, hw * 2 + 4, 3, 'heaterDark');
}

/** A folding bistro chair seen side on: its back post on `x`, the seat reaching toward the table. */
function chair(p: P, x: number, seat: number, floor: number, dir: 1 | -1, size = 1) {
  const depth = Math.round(8 * size);
  const back = Math.round(12 * size);
  const legW = size > 1.2 ? 2 : 1;
  for (let y = seat - back; y <= floor; y++) for (let i = 0; i < legW; i++) p.set(x + dir * i, y, 'chairDark');
  p.rect(Math.min(x, x + dir * 3), seat - back, 4, 1, 'chair');
  p.rect(Math.min(x, x + dir * 3), seat - back + 3, 4, 1, 'chair');
  for (let i = 0; i <= depth; i++) {
    p.set(x + dir * i, seat, 'chair');
    p.set(x + dir * i, seat + 1, 'chairDark');
  }
  for (let y = seat + 2; y <= floor; y++) {
    const u = (y - seat - 2) / Math.max(1, floor - seat - 2);
    p.set(x + dir * Math.round(depth - u * 1), y, 'chairDark');
    p.set(x + dir * Math.round(u * depth), y, 'chairDark');
  }
}

/** A round bistro table in three-quarter view: an oval top, its rim, a pedestal and a foot. */
function table(p: P, cx: number, top: number, floor: number, rx: number) {
  const ry = Math.max(2, Math.round(rx * 0.22));
  for (let y = top - ry; y <= top + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - top) / (ry + 0.5)) ** 2 > 1) continue;
      p.set(x, y, y < top - ry / 2 ? 'woodLight' : 'wood');
    }
  }
  const rim = Math.max(1, Math.round(rx / 8));
  for (let y = top + ry + 1; y <= top + ry + rim; y++) p.rect(Math.round(cx - rx + 2), y, Math.round(rx * 2 - 3), 1, 'woodDark');
  const leg = Math.max(2, Math.round(rx / 7));
  p.rect(Math.round(cx - leg / 2), top + ry + rim + 1, leg, floor - top - ry - rim - 1, 'woodDark');
  p.rect(Math.round(cx - rx * 0.5), floor - 1, Math.round(rx), 2, 'woodDark');
}

/** Patrons at the tables beyond the back railing, drawn into the scenery. */
function backPatrons(p: P, time: TimeOfDay) {
  const floor = 112;
  const people: Figure<StradaKey>[] = [];
  people.push({ sprite: smallPatron(LOOKS.white), x: 70, y: floor - 14 });
  people.push({ sprite: CUP, x: 82, y: floor - 8 });
  table(p, 84, floor - 5, floor, 6);
  if (time !== 'night') {
    people.push({ sprite: smallPatron(LOOKS.green, true), x: 92, y: floor - 14 });
    people.push({ sprite: smallPatron(LOOKS.yellow), x: 168, y: floor - 14 });
    table(p, 182, floor - 5, floor, 6);
    people.push({ sprite: CUP, x: 181, y: floor - 8 });
  }
  for (const f of people) stamp(p, f);
}

/** Two friends at a table behind the front-right railing. */
const PAIR = { cx: 268, floor: 144 };

function pair(p: P, time: TimeOfDay) {
  const { cx, floor } = PAIR;
  const y = floor - 32;
  const top = y + HANDS + 1;
  chair(p, cx - 29, y + 26, floor, 1);
  chair(p, cx + 31, y + 26, floor, -1);
  if (time !== 'night') {
    stamp(p, { sprite: friend(LOOKS.green), x: cx - 31, y });
    stamp(p, { sprite: friendLongHair(LOOKS.white, true), x: cx + 13, y });
  }
  table(p, cx, top + 2, floor, 14);
  if (time !== 'night') {
    stamp(p, { sprite: CUP, x: cx - 9, y: top - 3 });
    stamp(p, { sprite: CUP, x: cx + 5, y: top - 3 });
  }
}

/** The tables where the chatting friends and the student sit; they stay when the people leave. */
function nearTables(p: P) {
  const c = CHATTER_TABLE;
  const cSeat = CHATTER_POS.y + CHATTER_SEAT;
  chair(p, CHATTER_POS.x + 2, cSeat, c.floor, 1);
  chair(p, CHATTER_POS.x + 73, cSeat, c.floor, -1);
  table(p, c.cx, CHATTER_POS.y + HANDS + 1, c.floor, c.rx);
  const t = TYPING_TABLE;
  chair(p, TYPING_POS.x + 2, TYPING_POS.y + TYPING_SEAT, t.floor, 1, 1.4);
  table(p, t.cx, TYPING_POS.y + HANDS + 1, t.floor, t.rx);
}

/** The plum trees' trunks: one beside the café, a big twisted one mid-patio, one at the far right. */
function trunks(p: P) {
  branch(p, [[60, 122], [61, 100], [57, 76], [50, 52], [40, 30], [30, 8]], 8, 4);
  branch(p, [[57, 78], [72, 60], [88, 44], [104, 30]], 4, 3);
  branch(p, [[50, 54], [62, 38], [68, 18]], 4, 3);
  branch(p, [[312, 124], [310, 92], [304, 62], [296, 36]], 7, 4);
}

export const TREE_WELL = { x0: 182, x1: 214, top: 164 };

function bigTree(p: P) {
  const { x0, x1, top } = TREE_WELL;
  for (let y = top; y < top + 8; y++) {
    for (let x = x0; x <= x1; x++) {
      const edge = y === top || x === x0 || x === x1;
      p.set(x, y, edge ? (y === top ? 'brickLight' : 'brickDark') : y === top + 1 ? 'mortar' : 'soil');
    }
  }
  branch(p, [[198, 166], [197, 140], [193, 116], [197, 96], [191, 74], [178, 54], [162, 36], [150, 16]], 12, 5);
  branch(p, [[197, 98], [214, 82], [236, 68], [262, 54], [292, 40], [318, 30]], 8, 4);
  branch(p, [[191, 76], [205, 58], [212, 40], [214, 20]], 6, 3);
  branch(p, [[236, 68], [244, 50], [250, 30]], 4, 3);
  branch(p, [[178, 56], [170, 40], [172, 22]], 4, 3);
  // Bark ridges down the trunk.
  for (let y = 100; y < 164; y++) if (hash(1, y >> 2, 9) < 0.5) p.set(193 + Math.round(2 * Math.sin(y * 0.1)), y, 'trunkDark');
  const rng = mulberry32(41);
  for (let x = x0 + 3; x < x1 - 2; ) {
    const r = 2.5 + rng() * 1.5;
    if (Math.abs(x - 198) > 7) blob(p, x, top + 1, r, 700 + x, -0.05);
    x += r * 1.6;
  }
}

/** Everything on and around the patio behind the front railing. */
export function drawMid(pal: Pal, time: TimeOfDay) {
  const p = new Painter<StradaKey>(W, H, pal);
  lamp(p);
  trunks(p);
  hedge(p);
  cafe(p);
  backPatrons(p, time);
  balustrade(p, 44, 214, 104, 119, 6, 3, [44, 98, 152, 210]);
  patio(p);
  heater(p, 234, 72, 126, 20, time);
  pair(p, time);
  nearTables(p);
  heater(p, 78, 50, 166, 36, time);
  bigTree(p);
  return p.toCanvas();
}

/** String lights strung from the café to the big plum and on across the patio. */
/** Each strand: from, to, how far it sags, and where its first bulb hangs. */
const STRANDS: [x0: number, y0: number, x1: number, y1: number, sag: number, seed: number][] = [
  [46, 34, 194, 70, 18, 0],
  [194, 70, 320, 50, 12, 3],
  [104, 30, 194, 70, 6, 6],
];

function strand([x0, y0, x1, y1, sag, seed]: (typeof STRANDS)[number]) {
  const wire: [number, number][] = [];
  const bulbs: [number, number][] = [];
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    wire.push([x, y]);
    if ((x - x0 + seed) % 9 === 4) bulbs.push([x, y + 1]);
  }
  return { wire, bulbs };
}

function stringLights(p: P) {
  for (const s of STRANDS) {
    const { wire, bulbs } = strand(s);
    for (const [x, y] of wire) p.set(x, y, 'wire');
    for (const [bx, by] of bulbs) p.rect(bx, by, 2, 2, 'bulb');
  }
}

/** Heater burners: centre x, the burner's top row, and the reflector width. */
const HEATERS: [x: number, capY: number, cap: number][] = [
  [78, 50, 36],
  [234, 72, 20],
];

/**
 * Halos around the street lamp, string-light bulbs and heater burners after
 * dark, in stepped rings on a see-through layer laid over the whole scene.
 */
export function drawGlow(pal: Pal, time: TimeOfDay): HTMLCanvasElement | null {
  if (time === 'day') return null;
  const img = new ImageData(W, H);
  const put = (x: number, y: number, c: RGB, a: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4;
    if (a * 255 <= img.data[i + 3]) return;
    img.data.set([c[0], c[1], c[2], Math.round(a * 255)], i);
  };
  const night = time === 'night';
  const lampC = rgb(pal.lampGlow);
  const lr = night ? 16 : 10;
  const ly = LAMP.head + 3;
  for (let y = ly - lr; y <= ly + lr; y++) {
    for (let gx = LAMP.x + 1 - lr; gx <= LAMP.x + 1 + lr; gx++) {
      put(gx, y, lampC, (night ? 0.8 : 0.5) * glowAt(Math.hypot((gx | 1) - (LAMP.x + 1), (y | 1) - ly) / lr, 4));
    }
  }
  const heat = rgb(pal.heaterGlow);
  for (const [hx, capY, cap] of HEATERS) {
    const r = cap * 0.4;
    const cy = capY + cap / 12;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(hx - r); x <= hx + r; x++) {
        put(x, y, heat, (night ? 0.7 : 0.5) * glowAt(Math.hypot((x | 1) - hx, (y | 1) - cy) / r, 3));
      }
    }
  }
  const bulb = rgb(pal.bulbGlow);
  for (const s of STRANDS) {
    for (const [bx, by] of strand(s).bulbs) {
      for (let y = by - 3; y <= by + 5; y++) {
        for (let x = bx - 3; x <= bx + 4; x++) put(x, y, bulb, 0.6 * glowAt(Math.hypot(x - bx - 0.5, y - by - 0.5) / 4.5, 2));
      }
    }
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** The plum canopy, string lights and front-right balustrade that frame the scene. */
export function drawFg(pal: Pal) {
  const p = new Painter<StradaKey>(W, H, pal);
  stringLights(p);
  const rng = mulberry32(5);
  const clumps: [number, number, number][] = [];
  for (let y = -4, row = 0; y < 80; y += 7, row++) {
    for (let x = -6 + (row % 2) * 5; x < W + 8; x += 10) {
      const cx = x + (rng() - 0.5) * 5;
      const cy = y + (rng() - 0.5) * 4;
      if (cy > canopyEdge(cx) - 4) continue;
      clumps.push([cx, cy, 7 + rng() * 3]);
    }
  }
  clumps.forEach(([x, y, r], i) => blob(p, x + 2, y + 3, r + 1, 500 + i, -0.4));
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < canopyEdge(x) - 6; y++) if (!p.filled(x, y)) p.set(x, y, 'leafDeep');
  }
  clumps.forEach(([x, y, r], i) => blob(p, x, y, r, 600 + i));
  balustrade(p, 212, W + 4, 132, 175, 10, 6, [212, 300]);
  return p.toCanvas();
}
