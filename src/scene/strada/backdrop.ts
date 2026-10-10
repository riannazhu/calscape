import { blob, branch } from '../foliage';
import type { Palette, TimeOfDay } from '../palette';
import { Painter, hash, mulberry32, noise, rgb, type RGB } from '../pixels';
import { clamp01, glowAt, overcastSky, steppedSky, type Glow, type Sky } from '../sky';
import { fromRows } from '../sprites';
import { H, W } from '../stage';
import { stamp } from '../figures';
import type { StradaKey } from './palette';
import { LOOKS, chair, cup, facing, laptop, seated } from './people';
import { CHATTER_SEATS, CHATTER_TABLE, TYPISTS } from './sprites';

type P = Painter<StradaKey>;
type Pal = Palette<StradaKey>;

/** The campus path beyond the patio, where cyclists pass. */
export const PATH = { top: 101, bottom: 108 };
/** Where the patio's paving begins. */
const PATIO = 108;
const SUN = { x: 112, y: 58, r: 5 };

const SKY_KEYS: StradaKey[] = ['sky0', 'sky1', 'sky2', 'sky3', 'sky4', 'sky5'];
const SKY_LEVELS: Record<TimeOfDay, number> = { day: 20, sunset: 30, night: 14 };

function skyField(time: TimeOfDay, x: number, y: number) {
  const v = clamp01(y / 96);
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
  return overcastSky(deck, skyColor(time, pal, x, y), OVERCAST_SKY_SHOW[time], 96, x, y);
}

const starRng = mulberry32(11);
/** Stars anywhere in the sky; the canopy in front hides those behind leaves. */
export const STARS = Array.from({ length: 50 }, () => ({
  x: Math.floor(starRng() * W),
  y: 8 + Math.floor(starRng() * 50),
}));

const LIT_SHARE: Record<TimeOfDay, number> = { day: 0.1, sunset: 0.35, night: 0.65 };
const lit = (seed: number, time: TimeOfDay) => hash(seed, 5, 91) < LIT_SHARE[time];

/** A row of round tree crowns, lit on their upper left. */
function crowns(p: P, seed: number, x0: number, x1: number, top: number, spread: number, keys: [StradaKey, StradaKey, StradaKey], skip?: (x: number) => boolean) {
  const rng = mulberry32(seed);
  for (let cx = x0; cx < x1; ) {
    const r = 6 + rng() * 6;
    const cy = top + r + rng() * spread;
    if (!skip?.(cx)) {
      for (let y = Math.floor(cy - r); y < PATIO; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if (y < cy && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
          const v = (-(x - cx) * 0.5 - (y - cy) * 0.8) / r + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.5;
          p.set(x, y, v > 0.45 ? keys[0] : v > -0.1 ? keys[1] : keys[2]);
        }
      }
    }
    cx += r * 1.25;
  }
}

/** Campus beyond the patio: layers of trees, a pink stone hall, the lawn and the path. */
function campus(p: P, time: TimeOfDay) {
  crowns(p, 17, -6, W + 10, 44, 10, ['farTreeLight', 'farTreeLight', 'farTree']);
  const hall = { x0: 112, x1: 176, roof: 56 };
  for (let y = hall.roof; y < hall.roof + 4; y++) {
    const inset = hall.roof + 3 - y;
    for (let x = hall.x0 + inset; x <= hall.x1 - inset; x++) p.set(x, y, (y - hall.roof) % 2 ? 'hallRoofDark' : 'hallRoof');
  }
  for (let y = hall.roof + 4; y < PATH.top; y++) {
    for (let x = hall.x0; x <= hall.x1; x++) p.set(x, y, x >= hall.x1 - 1 || (x - hall.x0) % 16 === 0 ? 'hallShade' : 'hall');
  }
  for (let wy = hall.roof + 7; wy + 4 < PATH.top - 4; wy += 9) {
    for (let wx = hall.x0 + 4; wx + 3 < hall.x1 - 1; wx += 6) {
      const on = lit(wx * 3 + wy, time);
      p.rect(wx, wy, 3, 5, on ? 'winLit' : 'winDark');
      if (on) p.rect(wx, wy + 3, 3, 2, 'winLit2');
    }
  }
  crowns(p, 23, -8, W + 10, 64, 12, ['farTree', 'farTreeDark', 'farTreeDark'], (x) => x > 116 && x < 172);
  for (let y = 97; y < PATH.top; y++) for (let x = 0; x < W; x++) p.set(x, y, hash(x, y, 8) < 0.4 ? 'lawnDark' : 'lawn');
  for (let y = PATH.top; y < PATIO; y++) p.rect(0, y, W, 1, y === PATH.top ? 'mortar' : 'path');
}

/** Sky and campus: everything the cyclists pass in front of. */
export function drawFar(pal: Pal, time: TimeOfDay, overcast = false) {
  const p = new Painter<StradaKey>(W, H, pal);
  const sky = overcast ? overcastColor : skyColor;
  for (let y = 0; y < 100; y++) for (let x = 0; x < W; x++) p.setRGB(x, y, sky(time, pal, x, y));
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

/**
 * Paving in running bond, the joints converging on a vanishing point so the
 * courses grow toward the viewer.
 */
function patio(p: P) {
  const vx = 160;
  const vy = 40;
  const course = 8;
  let row = 0;
  for (let y0 = PATIO; y0 < H; row++) {
    const h = Math.max(3, Math.round((y0 - vy) / 12));
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
        let key: StradaKey = tone < 0.3 ? 'brickDark' : tone < 0.85 ? 'brick' : 'brickLight';
        if (y === y0 && key === 'brick') key = 'brickLight';
        if (hash(x, y, 77) < 0.03) key = 'brickDark';
        p.set(x, y, key);
      }
    }
    y0 += h;
  }
}

/** The café's arcaded front: a slate roof over two tall arches full of warm light. */
function loggia(p: P) {
  const x1 = 82;
  for (let y = 14; y < 27; y++) {
    const right = 68 + (y - 14);
    for (let x = 0; x <= Math.min(right, x1 + 2); x++) p.set(x, y, (y - 14) % 3 === 2 ? 'slateDark' : x >= right - 1 ? 'slateDark' : 'slate');
  }
  p.rect(0, 27, x1 + 3, 2, 'stuccoShade');
  p.rect(0, 29, x1 + 3, 1, 'stuccoDark');
  for (let y = 30; y < PATIO; y++) for (let x = 0; x <= x1; x++) p.set(x, y, x >= x1 - 1 ? 'stuccoShade' : 'stucco');
  const spring = 50;
  for (const cx of [20, 60]) {
    const r = 14;
    for (let y = spring - r - 3; y < 102; y++) {
      for (let x = cx - r - 3; x <= cx + r + 2; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - spring);
        if (y < spring && d > r + 3) continue;
        const inside = y < spring ? d <= r : x >= cx - r && x <= cx + r - 1;
        if (!inside) {
          p.set(x, y, x + 0.5 > cx ? 'stuccoShade' : 'stucco');
          if (y < spring ? d > r + 2 : x === cx - r - 3 || x === cx + r + 2) p.set(x, y, 'stuccoDark');
          continue;
        }
        let key: StradaKey = y > 78 ? 'archLit2' : 'archLit';
        if (x - (cx - r) < 2 || y < spring - r * 0.55) key = 'archLit2';
        if (Math.abs(x + 0.5 - cx) < 1 && y > spring - 4 && y < 76) key = 'stuccoDark';
        if (y === 76) key = 'stuccoDark';
        p.set(x, y, key);
      }
    }
  }
  // Pier capitals, a pendant lamp in each arch, and a counter inside.
  p.rect(36, spring - 2, 9, 2, 'stuccoDark');
  p.rect(37, spring, 7, 52, 'stucco');
  p.rect(42, spring, 2, 52, 'stuccoShade');
  for (const cx of [20, 60]) {
    p.rect(cx - 6, 40, 1, 8, 'stuccoDark');
    p.rect(cx - 8, 48, 5, 2, 'bulb');
    p.rect(cx - 12, 88, 24, 2, 'woodDark');
    p.rect(cx - 12, 90, 24, 12, 'wood');
  }
  p.rect(0, 100, x1 + 1, PATIO - 100, 'stuccoDark');
}

/** Rounded hedge along the café front. */
function hedge(p: P) {
  const rng = mulberry32(23);
  for (let x = -4; x < 112; ) {
    const r = 9 + rng() * 5;
    blob(p, x, 92 + rng() * 6 - r * 0.2, r, 140 + Math.round(x), 0.1);
    x += r * 1.1;
  }
  for (let x = 0; x < 110; x++) for (let y = 96; y < 122; y++) if (!p.filled(x, y) || y > 112) p.set(x, y, y > 117 ? 'leafDeep' : 'leafDark');
  for (let x = 0; x < 110; x += 2) for (let y = 104; y < 118; y += 2) if (hash(x, y, 9) < 0.25) p.rect(x, y, 2, 2, 'leafMid');
}

/** A street lamp beyond the railing flying a blue-and-gold Cal banner. */
const BANNER = fromRows(
  [
    'LLLLLLLLLLLLL',
    '.BBBBBBBBBBB.',
    '.BBBBBBBBBBB.',
    '.BBGGGGBBBBB.',
    '.BGGBBBBBBBB.',
    '.BGBBBBBBGBB.',
    '.BGBBBGGBGBB.',
    '.BGBBGBGBGBB.',
    '.BGGBGBGBGBB.',
    '.BBGGGGGBGGB.',
    '.BBBBBBBBBBB.',
    '.BBBBBBBBBBB.',
    '.BBBBBBBBBBB.',
    '.BBBB...BBBB.',
  ],
  { L: 'lampPost', B: 'banner', G: 'bannerGold' } as Record<string, StradaKey>,
);

export const LAMP = { x: 128, head: 48 };

function lamp(p: P) {
  const { x, head } = LAMP;
  p.rect(x - 3, head - 2, 8, 2, 'lampPost');
  p.rect(x - 1, head - 4, 4, 2, 'lampPost');
  p.rect(x - 2, head, 6, 7, 'lampGlass');
  p.rect(x - 2, head, 1, 7, 'lampPost');
  p.rect(x + 3, head, 1, 7, 'lampPost');
  p.rect(x - 3, head + 7, 8, 2, 'lampPost');
  p.rect(x, head + 9, 2, 114 - head - 9, 'lampPost');
  stamp(p, { sprite: BANNER, x: x + 2, y: head + 13 });
}

/**
 * White balustrade: top and bottom rails with vase-shaped balusters lit from
 * the left, and ball-topped posts.
 */
function balustrade(p: P, x0: number, x1: number, top: number, base: number, spacing: number, bw: number, posts: number[]) {
  const rail = Math.max(2, Math.round(bw * 0.8));
  for (let x = x0; x <= x1; x++) {
    for (let i = 0; i < rail; i++) p.set(x, top + i, i === 0 ? 'railLight' : i === rail - 1 ? 'railShade' : 'rail');
    for (let i = 0; i < rail; i++) p.set(x, base - rail + 1 + i, i === 0 ? 'railLight' : i === rail - 1 ? 'railShade' : 'rail');
  }
  const y0 = top + rail;
  const y1 = base - rail;
  for (let bx = x0 + spacing / 2; bx < x1; bx += spacing) {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const w = t < 0.1 ? bw : t < 0.22 ? bw * 0.55 : t > 0.9 ? bw : bw * (0.6 + 0.45 * Math.sin(((t - 0.22) / 0.68) * Math.PI));
      const half = Math.max(1, Math.round(w / 2));
      for (let x = Math.round(bx) - half; x < Math.round(bx) + half; x++) {
        const rel = (x - (Math.round(bx) - half)) / (half * 2);
        p.set(x, y, rel < 0.3 ? 'railLight' : rel > 0.7 ? 'railShade' : 'rail');
      }
    }
  }
  for (const px of posts) {
    const pw = Math.round(bw * 1.7);
    const ballR = bw * 0.95;
    for (let y = top - 2; y <= base; y++) {
      for (let i = 0; i < pw; i++) p.set(px + i, y, i < pw * 0.3 ? 'railLight' : i >= pw * 0.75 ? 'railShade' : 'rail');
    }
    p.rect(px - 1, top - 4, pw + 2, 2, 'railShade');
    p.rect(px - 1, top - 4, pw + 2, 1, 'rail');
    p.rect(px + 1, top - 5, pw - 2, 1, 'railShade');
    const bcx = px + pw / 2;
    const bcy = top - 5 - ballR;
    for (let y = Math.floor(bcy - ballR); y < top - 5; y++) {
      for (let x = Math.floor(bcx - ballR); x <= bcx + ballR; x++) {
        const d = Math.hypot(x + 0.5 - bcx, y + 0.5 - bcy);
        if (d >= ballR) continue;
        const litSide = x + 0.5 - bcx + (y + 0.5 - bcy) < -ballR * 0.4;
        p.set(x, y, litSide ? 'railLight' : x + 0.5 - bcx > ballR * 0.35 ? 'railShade' : 'rail');
      }
    }
  }
}

/** A patio heater: a wide reflector dish on a tall post above a cylindrical tank housing. */
function heater(p: P, x: number, capY: number, baseY: number, cap: number, time: TimeOfDay) {
  const half = cap / 2;
  const dish = Math.max(3, Math.round(cap / 7));
  p.rect(x - 1, capY - dish - 2, 2, 2, 'heaterDark');
  for (let i = 0; i < dish; i++) {
    const w = Math.round(half * (0.25 + (0.75 * (i + 1)) / dish));
    p.rect(x - w, capY - dish + i, w * 2, 1, i === dish - 1 ? 'heaterDark' : 'heater');
    p.rect(x - w, capY - dish + i, Math.max(1, Math.round(w * 0.7)), 1, 'heaterLight');
  }
  const bw = Math.max(2, Math.round(cap / 12));
  const bh = Math.max(4, Math.round(cap / 4));
  for (let y = capY; y < capY + bh; y++) {
    for (let i = -bw; i < bw; i++) {
      const glowing = time !== 'day' && i > -bw && i < bw - 1 && y > capY;
      p.set(x + i, y, glowing ? 'flame' : (y - capY) % 2 ? 'heaterDark' : 'heater');
    }
  }
  const pole = Math.max(2, Math.round(cap / 16));
  const hw = Math.round(cap * 0.15);
  const hh = Math.round((baseY - capY) * 0.3);
  const poleTop = capY + bh;
  p.rect(Math.round(x - pole / 2), poleTop, pole, baseY - hh - poleTop, 'heater');
  p.rect(Math.round(x - pole / 2), poleTop, 1, baseY - hh - poleTop, 'heaterLight');
  p.rect(x - hw - 1, baseY - hh - 2, hw * 2 + 2, 2, 'heaterDark');
  for (let y = baseY - hh; y < baseY - 1; y++) {
    for (let i = -hw; i < hw; i++) {
      const rel = (i + hw) / (hw * 2);
      p.set(x + i, y, rel < 0.25 ? 'heaterLight' : rel > 0.7 ? 'heaterDark' : 'heater');
    }
  }
  p.rect(x - hw - 2, baseY - 2, hw * 2 + 4, 3, 'heaterDark');
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

/** Patrons at the tables beyond the middle railing, part of the scenery. */
function backTables(p: P, time: TimeOfDay) {
  const floor = 134;
  chair(p, 82, floor, 40, 1);
  table(p, 104, 118, floor, 12);
  facing(p, 106, 118, 40, LOOKS.green);
  seated(p, 82, floor, 40, LOOKS.white, 1, 'rest', 118);
  cup(p, 101, 118, 0.8);
  chair(p, 166, floor, 40, 1);
  table(p, 190, 118, floor, 12);
  laptop(p, 180, 118, 1, 0.8);
  seated(p, 166, floor, 40, LOOKS.yellow, 1, 'type', 118);
  if (time !== 'night') {
    chair(p, 212, floor, 40, -1);
    seated(p, 212, floor, 40, LOOKS.red, -1, 'rest', 118);
    cup(p, 196, 118, 0.8);
  }
}

/** The near tables: the typists' and the chatting friends', which stay when the people leave, and one left for later. */
function nearTables(p: P) {
  for (const t of TYPISTS) {
    chair(p, t.x, t.floor, t.h, t.dir);
    table(p, t.table.cx, t.table.top + 1, t.floor, t.table.rx);
  }
  const c = CHATTER_TABLE;
  for (const s of CHATTER_SEATS) chair(p, s.x, c.floor, s.h, s.dir);
  table(p, c.cx, c.top + 1, c.floor, c.rx);
  // An empty table in the middle, chairs pulled out, cups left behind.
  chair(p, 96, 164, 52, 1);
  table(p, 118, 136, 164, 16);
  cup(p, 112, 135);
  // Folding chairs at the front left.
  chair(p, 12, 172, 58, 1);
}

/** The trunk of the plum beside the café, behind the hedge. */
function leftTrunk(p: P) {
  branch(p, [[30, 122], [27, 98], [33, 74], [25, 52], [35, 30], [50, 10], [58, -4]], 8, 4);
}

/** The big plum's twisting trunk rising from the paving. */
function bigTrunk(p: P) {
  for (let x = 186; x < 216; x++) {
    const y = 164 + Math.round(2 * Math.sin((x - 186) * 0.25));
    p.rect(x, y - 2, 1, 3, 'trunkDark');
  }
  branch(p, [[200, 166], [198, 140], [204, 116], [198, 94], [205, 74], [199, 60]], 22, 13);
  for (let y = 66; y < 162; y++) {
    if (hash(1, y >> 2, 9) < 0.55) p.set(196 + Math.round(3 * Math.sin(y * 0.09)), y, 'trunkDark');
    if (hash(2, y >> 2, 9) < 0.4) p.set(203 + Math.round(2 * Math.sin(y * 0.12 + 1)), y, 'trunkDark');
  }
}

/** Everything on and around the patio behind the front-right railings. */
export function drawMid(pal: Pal, time: TimeOfDay) {
  const p = new Painter<StradaKey>(W, H, pal);
  patio(p);
  loggia(p);
  leftTrunk(p);
  hedge(p);
  lamp(p);
  heater(p, 150, 72, 114, 24, time);
  backTables(p, time);
  balustrade(p, 74, 226, 112, 142, 6, 3, [74, 150, 220]);
  nearTables(p);
  heater(p, 86, 48, 162, 44, time);
  bigTrunk(p);
  return p.toCanvas();
}

/** The plums' limbs reaching out over the patio. */
const LIMBS: [pts: [number, number][], from: number, to: number][] = [
  [[[199, 62], [186, 46], [170, 30], [160, 10], [156, -6]], 11, 5],
  [[[203, 62], [212, 42], [216, 18], [214, -6]], 10, 5],
  [[[204, 72], [228, 58], [256, 46], [290, 34], [326, 28]], 9, 4],
  [[[186, 46], [168, 44], [148, 46], [128, 38]], 5, 3],
  [[[228, 58], [238, 72], [246, 82]], 4, 3],
  [[[35, 30], [60, 24], [90, 20], [120, 12]], 5, 3],
  [[[25, 52], [10, 42], [-4, 38]], 4, 2],
];

/** String lights from the café roof to the big plum and on across the patio. */
/** Each strand: from, to, how far it sags, and where its first bulb hangs. */
const STRANDS: [x0: number, y0: number, x1: number, y1: number, sag: number, seed: number][] = [
  [80, 28, 196, 54, 14, 0],
  [196, 54, 320, 32, 12, 3],
  [30, 20, 80, 28, 4, 5],
];

function strand([x0, y0, x1, y1, sag, seed]: (typeof STRANDS)[number]) {
  const wire: [number, number][] = [];
  const bulbs: [number, number][] = [];
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    wire.push([x, y]);
    if ((x - x0 + seed) % 10 === 4) bulbs.push([x, y + 1]);
  }
  return { wire, bulbs };
}

/** Heater burners: centre x, the burner's top row, and the reflector width. */
const HEATERS: [x: number, capY: number, cap: number][] = [
  [86, 48, 44],
  [150, 72, 24],
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
    const r = cap * 0.45;
    const cy = capY + cap / 8;
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

/** Leaf clusters: a band across the top, heavier masses at either side, and tufts along the limbs. */
function canopy(p: P) {
  const rng = mulberry32(5);
  const clumps: [number, number, number][] = [];
  for (let x = -6; x < W + 8; x += 8) clumps.push([x + rng() * 4, -2 + rng() * 7, 6 + rng() * 3]);
  for (let y = 4; y < 60; y += 7) {
    for (let x = -6; x < W + 8; x += 8) {
      const edge = x < 100 ? 40 - x * 0.22 + 6 * noise(x, y, 9, 2) : x > 226 ? 26 + (x - 226) * 0.5 : 10;
      if (y < edge && rng() < 0.85) clumps.push([x + (rng() - 0.5) * 6, y + (rng() - 0.5) * 4, 4.5 + rng() * 3]);
    }
  }
  for (const [pts] of LIMBS) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      for (let s = 0; s < len; s += 7) {
        if (rng() < 0.35) continue;
        const u = s / len;
        clumps.push([ax + (bx - ax) * u + (rng() - 0.5) * 8, ay + (by - ay) * u - 2 + (rng() - 0.5) * 8, 3.5 + rng() * 2.5]);
      }
    }
  }
  clumps.forEach(([x, y, r], i) => blob(p, x + 2, y + 2, r, 500 + i, -0.45));
  clumps.forEach(([x, y, r], i) => {
    if (i % 4 !== 3) blob(p, x, y, r * 0.85, 600 + i, -0.1);
  });
}

/** The canopy, string lights and the two railings in the front right that frame the scene. */
export function drawFg(pal: Pal) {
  const p = new Painter<StradaKey>(W, H, pal);
  for (const [pts, from, to] of LIMBS) branch(p, pts, from, to);
  canopy(p);
  for (const s of STRANDS) {
    const { wire, bulbs } = strand(s);
    for (const [x, y] of wire) p.set(x, y, 'wire');
    for (const [bx, by] of bulbs) {
      p.rect(bx, by, 2, 2, 'bulb');
      p.set(bx, by - 1, 'wire');
    }
  }
  balustrade(p, 220, W + 4, 124, 153, 9, 5, [220, 300]);
  balustrade(p, 214, W + 4, 150, H + 4, 13, 7, [210]);
  return p.toCanvas();
}
