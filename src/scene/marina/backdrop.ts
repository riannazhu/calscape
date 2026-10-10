import { person, stamp, type Figure } from '../figures';
import type { Palette, TimeOfDay } from '../palette';
import { Painter, hash, mulberry32, noise, rgb, type RGB } from '../pixels';
import { clamp01, glowAt, steppedSky, type Glow, type Sky } from '../sky';
import { H, W } from '../stage';
import type { MarinaKey } from './palette';

type P = Painter<MarinaKey>;
type Pal = Palette<MarinaKey>;

export const HORIZON = 93;

/** Facing west: the afternoon sun high to the south, setting between the bridge towers. */
const SUN: Record<'day' | 'sunset', { x: number; y: number; r: number }> = {
  day: { x: 64, y: 22, r: 6 },
  sunset: { x: 222, y: 83, r: 7 },
};
export const MOON = { x: 84, y: 26 };

/** The Golden Gate's south and north towers. */
const TOWERS = [204, 240];
const TOWER_TOP = 70;
const DECK = 88;

/** Where the water meets the land: the low grassy bank on the left, rocks along the right. */
export const shoreY = (x: number) =>
  x < 80 ? Math.round(132 + x * 0.1) : Math.round(141 + 2 * Math.sin(x * 0.06) + 2 * noise(x, 0, 9, 4));
/** Where the grass starts, behind the rocks on the right. */
const grassTop = (x: number) => (x < 80 ? shoreY(x) : shoreY(x) + 8 + Math.round(2 * noise(x, 1, 7, 5)));

/** The Berkeley Pier runs from the left bank out toward the bridge. */
export const PIER = { x0: 0, y0: 121, x1: 194, y1: 99 };
export const deckY = (x: number) => Math.round(PIER.y0 + ((PIER.y1 - PIER.y0) * (x - PIER.x0)) / (PIER.x1 - PIER.x0));
const near = (x: number) => 1 - x / PIER.x1;

const SKY_KEYS: MarinaKey[] = ['sky0', 'sky1', 'sky2', 'sky3', 'sky4', 'sky5'];
const SKY_RAMP: Record<TimeOfDay, MarinaKey[]> = { day: SKY_KEYS, sunset: [...SKY_KEYS, 'glow', 'sun'], night: SKY_KEYS };
const SKY_LEVELS: Record<TimeOfDay, number> = { day: 22, sunset: 34, night: 16 };

function skyField(time: TimeOfDay, x: number, y: number) {
  const v = clamp01(y / HORIZON);
  if (time === 'night') return v;
  const sun = SUN[time];
  if (time === 'day') return clamp01(0.85 * v + 0.15 * (1 - Math.hypot(x - sun.x, y - sun.y) / 360));
  return clamp01(0.4 * v + 0.6 * (1 - Math.hypot(x - sun.x, (y - sun.y) * 1.6) / 300));
}

const SKY_GLOWS: Record<TimeOfDay, Glow[]> = {
  night: [
    { x: MOON.x, y: MOON.y, r: 40, a: 0.35, steps: 4 },
    { x: MOON.x, y: MOON.y, r: 14, a: 0.45, steps: 2 },
  ],
  day: [{ x: SUN.day.x, y: SUN.day.y, r: 16, a: 0.4, steps: 3 }],
  sunset: [{ x: SUN.sunset.x, y: SUN.sunset.y, r: 22, a: 0.5, steps: 3 }],
};

const skies = new Map<TimeOfDay, Sky>();

export function skyColor(time: TimeOfDay, pal: Pal, x: number, y: number): RGB {
  let sky = skies.get(time);
  if (!sky) {
    sky = {
      ramp: SKY_RAMP[time].map((k) => rgb(pal[k])),
      levels: SKY_LEVELS[time],
      field: (fx, fy) => skyField(time, fx, fy),
      glows: SKY_GLOWS[time],
      glow: rgb(pal.glow),
    };
    skies.set(time, sky);
  }
  return steppedSky(sky, x, y);
}

const starRng = mulberry32(19);
/** Stars clear of the moon. */
export const STARS = Array.from({ length: 70 }, () => ({
  x: Math.floor(starRng() * W),
  y: Math.floor(starRng() * 78),
})).filter((s) => Math.hypot(s.x - MOON.x, s.y - MOON.y) > 10);

function disc(p: P, cx: number, cy: number, r: number, key: MarinaKey) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r) p.set(x, y, key);
  }
}

/** Marin's hills behind the bridge, Mount Tamalpais highest; the city's low headland to the left. */
function hills(p: P) {
  for (let x = 150; x < W; x++) {
    const tam = 22 * Math.exp(-(((x - 292) / 26) ** 2));
    const ridge = x < 196 ? 0 : Math.min(1, (x - 196) / 30) * (8 + 6 * noise(x, 0, 18, 7));
    const far = Math.round(Math.max(ridge * 0.7, tam + 4 * noise(x, 2, 11, 8)));
    for (let y = HORIZON - far; y < HORIZON; y++) p.set(x, y, y === HORIZON - far ? 'hillFar' : 'hillFarDark');
    const headland = x < 196 ? 0 : Math.round(ridge * (x < 250 ? 1 : 0.8));
    for (let y = HORIZON - headland; y < HORIZON; y++) p.set(x, y, y < HORIZON - headland + 2 ? 'hill' : 'hillDark');
  }
  // The Presidio's low shore under the south tower, Yerba Buena far to the left, Alcatraz mid-bay.
  for (let x = 150; x < 206; x++) {
    const h = Math.round(2 + 2 * noise(x, 3, 8, 9));
    for (let y = HORIZON - h; y < HORIZON; y++) p.set(x, y, 'hill');
  }
  for (let x = 30; x < 74; x++) {
    const h = Math.round(4 * Math.sin(((x - 30) / 44) * Math.PI) + noise(x, 4, 6, 10));
    for (let y = HORIZON - h; y < HORIZON; y++) p.set(x, y, 'hillFarDark');
  }
  for (let x = 176; x < 186; x++) p.rect(x, HORIZON - (x > 178 && x < 184 ? 3 : 2), 1, 3, 'cityShade');
  p.set(181, HORIZON - 4, 'city');
}

/** San Francisco's skyline, small and hazy across the bay, the Transamerica pyramid and Salesforce Tower above it. */
function skyline(p: P, time: TimeOfDay) {
  const rng = mulberry32(31);
  for (let x = 98; x < 160; ) {
    const w = 2 + Math.floor(rng() * 4);
    const h = 3 + Math.floor(rng() * 8 * Math.sin(((x - 98) / 62) * Math.PI));
    for (let i = 0; i < w; i++) {
      for (let y = HORIZON - h; y < HORIZON - 1; y++) {
        const lit = time !== 'day' && hash(x + i, y, 33) < (time === 'night' ? 0.35 : 0.12) && (y - HORIZON) % 2 === 0;
        p.set(x + i, y, lit ? 'cityLit' : i === w - 1 ? 'cityShade' : 'city');
      }
    }
    x += w + (rng() < 0.3 ? 1 : 0);
  }
  for (let y = HORIZON - 16; y < HORIZON - 1; y++) {
    const half = Math.floor((y - (HORIZON - 16)) / 6);
    p.rect(128 - half, y, half * 2 + 1, 1, 'city');
  }
  p.rect(139, HORIZON - 17, 3, 16, 'city');
  p.set(140, HORIZON - 18, 'city');
  p.rect(141, HORIZON - 17, 1, 16, 'cityShade');
}

/** The Golden Gate Bridge: two towers, main cables sagging to the deck, suspenders between. */
function bridge(p: P, time: TimeOfDay) {
  const [south, north] = TOWERS;
  const cable = (x: number) => {
    if (x <= south) return DECK - ((DECK - TOWER_TOP - 1) * (x - (south - 18))) / 18;
    if (x >= north) return DECK - ((DECK - TOWER_TOP - 1) * (north + 16 - x)) / 16;
    const u = (x - south) / (north - south);
    return TOWER_TOP + 1 + (DECK - 2 - TOWER_TOP - 1) * 4 * u * (1 - u);
  };
  for (let x = south - 18; x <= north + 16; x++) {
    const cy = Math.round(cable(x));
    p.set(x, cy, 'bridge');
    if (x % 2 === 0) for (let y = cy + 1; y < DECK; y++) p.set(x, y, 'bridgeDark');
  }
  for (let x = south - 26; x <= north + 20; x++) {
    p.set(x, DECK, 'bridge');
    p.set(x, DECK + 1, 'bridgeDark');
    if (time !== 'day' && x % 4 === 0) p.set(x, DECK - 1, 'bridgeLamp');
  }
  for (const tx of TOWERS) {
    for (let y = TOWER_TOP; y < HORIZON; y++) {
      p.set(tx - 1, y, 'bridge');
      p.set(tx, y, [TOWER_TOP, TOWER_TOP + 5, TOWER_TOP + 10].includes(y) ? 'bridge' : 'bridgeDark');
      p.set(tx + 1, y, 'bridgeDark');
    }
    if (time !== 'day') p.set(tx, TOWER_TOP - 1, 'beacon');
  }
}

/** The bay: stepped bands, lighter toward the horizon, scattered with wavelets and a path of light. */
function water(p: P, time: TimeOfDay) {
  const bands: [number, MarinaKey][] = [
    [HORIZON, 'water0'],
    [97, 'water1'],
    [102, 'water2'],
    [110, 'water3'],
    [124, 'water4'],
  ];
  const light = time === 'night' ? MOON : SUN[time];
  for (let y = HORIZON; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let band = 0;
      for (let i = 0; i < bands.length; i++) if (y >= bands[i][0] + Math.round((hash(x >> 2, y, 51) - 0.5) * 2)) band = i;
      p.set(x, y, bands[band][1]);
    }
    const depth = (y - HORIZON) / (H - HORIZON);
    for (let x = 0; x < W; ) {
      const len = 2 + Math.floor(hash(x, y, 52) * (2 + depth * 5));
      if (hash(x, y, 53) < 0.05 + depth * 0.08) p.rect(x, y, len, 1, 'waveLight');
      x += len + 1;
    }
    const spread = 3 + (y - HORIZON) * (time === 'sunset' ? 0.45 : 0.25);
    const strength = time === 'day' ? 0.25 : 0.55;
    for (let x = Math.floor(light.x - spread); x <= light.x + spread; x++) {
      if (hash(x >> 1, y, 54) < strength * (1 - Math.abs(x - light.x) / (spread + 1))) p.set(x, y, 'glitter');
    }
  }
}

/** Sky, hills, city, bridge and the open bay: everything the boats and fog pass in front of. */
export function drawFar(pal: Pal, time: TimeOfDay) {
  const p = new Painter<MarinaKey>(W, H, pal);
  for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) p.setRGB(x, y, skyColor(time, pal, x, y));
  if (time === 'night') {
    for (const s of STARS) p.set(s.x, s.y, 'star');
    disc(p, MOON.x, MOON.y, 5, 'moon');
    p.set(MOON.x + 1, MOON.y - 1, 'moonShade');
    p.set(MOON.x - 2, MOON.y + 1, 'moonShade');
  } else {
    const s = SUN[time];
    disc(p, s.x, s.y, s.r, 'sun');
  }
  hills(p);
  skyline(p, time);
  water(p, time);
  bridge(p, time);
  return p.toCanvas();
}

/** The pier: a long deck on pilings, its rail and lamps getting smaller with distance. */
function pier(p: P, time: TimeOfDay) {
  const glow = rgb(p.pal.lampGlow);
  for (let x = PIER.x0; x <= PIER.x1; x++) {
    const y = deckY(x);
    const n = near(x);
    const thick = Math.max(1, Math.round(1 + n * 2));
    const spacing = Math.max(3, Math.round(3 + n * 5));
    if (x % spacing === 0) {
      const len = Math.round(2 + n * 9);
      for (let j = thick; j < thick + len; j++) p.set(x, y + j, j > thick + len / 2 ? 'pilingDark' : 'piling');
    }
    for (let j = 0; j < thick; j++) p.set(x, y + j, j === 0 ? 'pier' : 'pierDark');
    const rail = Math.max(1, Math.round(1 + n * 3));
    p.set(x, y - rail, 'pierDark');
    if (x % spacing === 0) for (let j = 1; j < rail; j++) p.set(x, y - j, 'pierDark');
  }
  for (const lx of [44, 104, 150]) {
    const y = deckY(lx);
    const h = Math.round(4 + near(lx) * 8);
    if (time !== 'day') {
      const r = Math.round(3 + near(lx) * 6);
      for (let gy = y - h - r; gy <= y - h + r; gy++) {
        for (let gx = lx - r; gx <= lx + r; gx++) {
          p.blend(gx, gy, glow, 0.7 * glowAt(Math.hypot(gx - lx, gy - (y - h)) / (r + 1), 3));
        }
      }
    }
    p.rect(lx, y - h, 1, h, 'lampPost');
    p.set(lx, y - h - 1, 'lampGlass');
  }
}

/** People fishing from the pier's rail, and where each one's line meets the water. */
export const FISHERS: { x: number; left: boolean; look: { hair: MarinaKey; skin: MarinaKey; top: MarinaKey } }[] = [
  { x: 26, left: false, look: { hair: 'hairDark', skin: 'skin2', top: 'shirtRed' } },
  { x: 62, left: true, look: { hair: 'hairBrown', skin: 'skin1', top: 'shirtBlue' } },
  { x: 96, left: false, look: { hair: 'hairGold', skin: 'skin3', top: 'shirtYellow' } },
];
/** How many people fish at each time of day; some stay on after dark. */
export const FISHER_COUNT: Record<TimeOfDay, number> = { day: 3, sunset: 2, night: 1 };

function fishers(p: P, time: TimeOfDay) {
  for (const f of FISHERS.slice(0, FISHER_COUNT[time])) {
    const sprite = person('stand', f.look, f.left);
    stamp(p, { sprite, x: f.x, y: deckY(f.x + 2) - sprite.h });
  }
}

/** Old pilings standing in the shallows; the gull and heron use the tallest. */
export const POST = { x: 126, top: 112 };

function pilings(p: P) {
  for (const [x, top, w] of [[POST.x, POST.top, 4], [136, 124, 3], [118, 127, 3]] as const) {
    for (let y = top; y < 150; y++) {
      for (let i = 0; i < w; i++) p.set(x + i, y, y === top ? 'pilingTop' : i === w - 1 ? 'pilingDark' : 'piling');
    }
    for (let y = top + 6; y < 150; y += 7) p.rect(x, y, w, 1, 'pilingDark');
  }
}

/** A low floating dock where the sea lions haul out. */
export const FLOAT = { x0: 238, x1: 270, y: 127 };

function float(p: P) {
  const { x0, x1, y } = FLOAT;
  p.rect(x0, y, x1 - x0 + 1, 1, 'float');
  p.rect(x0, y + 1, x1 - x0 + 1, 2, 'floatDark');
  p.rect(x0 + 1, y + 3, x1 - x0 - 1, 1, 'water4');
}

/** Riprap along the shore: chunky boulders lit from the upper left. */
function rocks(p: P) {
  const rng = mulberry32(61);
  for (let x = 76; x < W + 6; ) {
    const r = 4 + rng() * 3;
    const cy = shoreY(x) + 2 + rng() * 5;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let rx = Math.floor(x - r * 1.3); rx <= x + r * 1.3; rx++) {
        const dx = (rx + 0.5 - x) / 1.3;
        const dy = y + 0.5 - cy;
        if (Math.hypot(dx, dy) > r) continue;
        const v = (-dx - dy) / r + (hash(rx >> 1, y >> 1, 62) - 0.5) * 0.5;
        p.set(rx, y, v > 0.55 ? 'rockLight' : v > -0.45 ? 'rock' : 'rockDark');
      }
    }
    x += r * 1.6 + rng() * 2;
  }
}

/** Where the path runs: curving in from the bottom edge to the bank on the left. */
const pathX = (y: number) => 12 + (H - y) * -0.2 + ((y - 140) / 40) ** 2 * 60;

function land(p: P) {
  for (let x = 0; x < W; x++) {
    for (let y = grassTop(x); y < H; y++) {
      const top = grassTop(x);
      let key: MarinaKey = y - top < 2 ? 'grassLight' : y > 168 ? 'grassMid' : 'grass';
      const h = hash(x >> 1, y >> 1, 71);
      if (h < 0.06) key = 'grassDark';
      else if (h < 0.075 && y > top + 3) key = hash(x, y, 72) < 0.5 ? 'flowerYellow' : 'flowerWhite';
      p.set(x, y, key);
    }
  }
  for (let y = 140; y < H; y++) {
    const cx = pathX(y);
    const hw = 3 + (y - 140) * 0.22;
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      if (y < grassTop(x)) continue;
      let key: MarinaKey = 'path';
      if (x <= cx - hw + 1) key = 'pathLight';
      else if (x >= cx + hw - 1) key = 'pathDark';
      else if (hash(x >> 1, y >> 1, 73) < 0.1) key = 'pathDark';
      p.set(x, y, key);
    }
  }
}

/** Clumps of golden grass and reeds along the shore and the front edge. */
function reeds(p: P, fromY: number, toY: number, seed: number, density: number) {
  for (let x = 0; x < W; x++) {
    if (hash(x, seed, 81) > density) continue;
    const base = Math.max(grassTop(x) + 2, Math.round(fromY + hash(x, seed, 82) * (toY - fromY)));
    if (Math.abs(x - pathX(base)) < 4 + (base - 140) * 0.22) continue;
    const h = 3 + Math.floor(hash(x, seed, 83) * 6);
    const lean = hash(x, seed, 84) < 0.5 ? -1 : 1;
    for (let j = 0; j < h; j++) p.set(x + (j > h * 0.6 ? lean : 0), base - j, j < 2 ? 'reedDark' : 'reed');
  }
}

/** A lamp beside the path, glowing after dark. */
const LAMP = { x: 58, top: 120, base: 150 };

function lamp(p: P, time: TimeOfDay) {
  const { x, top, base } = LAMP;
  if (time !== 'day') {
    const glow = rgb(p.pal.lampGlow);
    const r = time === 'night' ? 15 : 10;
    for (let y = top + 2 - r; y <= top + 2 + r; y++) {
      for (let gx = x + 1 - r; gx <= x + 1 + r; gx++) {
        p.blend(gx, y, glow, 0.85 * glowAt(Math.hypot((gx | 1) - (x + 1), (y | 1) - (top + 2)) / r, 4));
      }
    }
  }
  p.rect(x, top + 5, 2, base - top - 5, 'lampPost');
  p.rect(x - 1, base - 1, 4, 1, 'lampPost');
  p.rect(x - 1, top, 4, 1, 'lampPost');
  p.rect(x - 1, top + 1, 4, 3, 'lampGlass');
  p.rect(x - 1, top + 4, 4, 1, 'lampPost');
}

/** Someone on the bank at sunset, and a walker on the path by day. */
function strollers(p: P, time: TimeOfDay) {
  const people: Figure<MarinaKey>[] = [];
  if (time === 'sunset') {
    people.push({ sprite: person('sit', { hair: 'hairDark', skin: 'skin1', top: 'shirtWhite' }), x: 92, y: 151 });
    people.push({ sprite: person('sit', { hair: 'hairBrown', skin: 'skin3', top: 'shirtGreen' }), x: 100, y: 152 });
  }
  if (time === 'day') people.push({ sprite: person('stand', { hair: 'hairGold', skin: 'skin1', top: 'shirtGreen' }, true), x: 30, y: 152 });
  for (const f of people) stamp(p, f);
}

/** Pier, pilings, dock, rocks, grass, path and people: in front of the water. */
export function drawMid(pal: Pal, time: TimeOfDay) {
  const p = new Painter<MarinaKey>(W, H, pal);
  pier(p, time);
  fishers(p, time);
  pilings(p);
  float(p);
  rocks(p);
  land(p);
  reeds(p, 146, 158, 1, 0.22);
  lamp(p, time);
  strollers(p, time);
  return p.toCanvas();
}

/** Tall grass along the front edge. */
export function drawFg(pal: Pal) {
  const p = new Painter<MarinaKey>(W, H, pal);
  reeds(p, 170, 182, 2, 0.35);
  return p.toCanvas();
}
