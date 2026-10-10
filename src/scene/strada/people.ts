import type { Brush } from '../pixels';
import { blank, type Sprite } from '../sprites';
import type { StradaKey } from './palette';

type B = Brush<StradaKey>;

export interface Look {
  hair: StradaKey;
  style: 'short' | 'long' | 'bun' | 'hood';
  skin: StradaKey;
  skinShade: StradaKey;
  top: StradaKey;
  topShade: StradaKey;
}

export const LOOKS = {
  red: { hair: 'hairDark', style: 'short', skin: 'skin3', skinShade: 'skin4', top: 'shirtRed', topShade: 'shirtRedDark' },
  blue: { hair: 'hairGold', style: 'long', skin: 'skin1', skinShade: 'skin2', top: 'shirtBlue', topShade: 'shirtBlueDark' },
  yellow: { hair: 'hairBrown', style: 'bun', skin: 'skin2', skinShade: 'skin3', top: 'shirtYellow', topShade: 'shirtYellowDark' },
  green: { hair: 'hairBrown', style: 'short', skin: 'skin1', skinShade: 'skin2', top: 'shirtGreen', topShade: 'shirtGreenDark' },
  white: { hair: 'hairDark', style: 'long', skin: 'skin2', skinShade: 'skin3', top: 'shirtWhite', topShade: 'shirtWhiteDark' },
  navy: { hair: 'hairBrown', style: 'long', skin: 'skin1', skinShade: 'skin2', top: 'shirtNavy', topShade: 'shirtNavyDark' },
  hoodie: { hair: 'hairDark', style: 'hood', skin: 'skin2', skinShade: 'skin3', top: 'shirtNavy', topShade: 'shirtNavyDark' },
  grey: { hair: 'hairDark', style: 'short', skin: 'skin3', skinShade: 'skin4', top: 'shirtWhiteDark', topShade: 'heater' },
} satisfies Record<string, Look>;

/** What the hands are doing: resting on the table, typing (two key positions), gesturing, sipping, or nodding along. */
export type Pose = 'rest' | 'type' | 'type2' | 'talk' | 'sip' | 'nod';

/** Light falls from the upper left, toward the café; this points the other way, into shadow. */
const SHADE = [0.55, 0.83];

/**
 * A rounded limb from a to b of radius r: pixels on its shadowed side take
 * `shade`. Ends are round, so limbs join cleanly at elbows and knees.
 */
function limb(b: B, ax: number, ay: number, bx: number, by: number, r: number, key: StradaKey, shade = key) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.max(ay, by) + r; y++) {
    for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.max(ax, bx) + r; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const ox = px - (ax + dx * t);
      const oy = py - (ay + dy * t);
      if (ox * ox + oy * oy > r * r) continue;
      b.set(x, y, ox * SHADE[0] + oy * SHADE[1] > r * 0.3 ? shade : key);
    }
  }
}

function disc(b: B, cx: number, cy: number, r: number, key: StradaKey, shade = key) {
  limb(b, cx, cy, cx, cy, r, key, shade);
}

/** A head: hair over the crown and back, the face toward `dir`. */
function head(b: B, cx: number, cy: number, r: number, look: Look, dir: 1 | -1) {
  const { hair, style, skin, skinShade } = look;
  if (style === 'long') limb(b, cx - dir * r * 0.55, cy, cx - dir * r * 0.75, cy + r * 2.1, r * 0.62, hair, 'hairShine');
  if (style === 'hood') limb(b, cx - dir * r * 0.8, cy + r * 0.9, cx - dir * r * 0.3, cy + r * 1.6, r * 0.7, look.top, look.topShade);
  disc(b, cx, cy, r, skin, skinShade);
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const ox = x + 0.5 - cx;
      const oy = y + 0.5 - (cy - r * 0.08);
      if (ox * ox + oy * oy > (r + 0.4) ** 2) continue;
      const face = ox * dir > -r * 0.15 && oy > -r * 0.3;
      if (!face) b.set(x, y, ox * dir < -r * 0.4 && oy < 0 && (x + y) % 3 === 0 ? 'hairShine' : hair);
    }
  }
  if (style === 'bun') disc(b, cx - dir * r * 0.75, cy - r * 0.85, r * 0.42, hair);
  b.set(Math.floor(cx + dir * r * 0.5), Math.floor(cy + r * 0.05), 'eye');
  b.set(Math.floor(cx + dir * (r + 0.5)), Math.floor(cy + r * 0.3), skin);
  if (style === 'short' || style === 'hood') b.set(Math.floor(cx - dir * r * 0.05), Math.floor(cy + r * 0.2), skinShade);
}

/** Where a seated person's parts sit, for chairs and tables drawn around them. */
export function seatOf(floor: number, h: number) {
  const u = h / 50;
  return { seat: floor - 17 * u, depth: 15 * u, back: 15 * u, hands: floor - 26 * u };
}

/**
 * A person seated side on, facing `dir`, their back at `x` and feet on
 * `floor`, `h` pixels tall from crown to floor. Hands reach to `handY` on
 * the table in front of them.
 */
export function seated(b: B, x: number, floor: number, h: number, look: Look, dir: 1 | -1, pose: Pose = 'rest', handY?: number) {
  const u = h / 50;
  const X = (f: number) => x + dir * f * u;
  const seat = floor - 17 * u;
  const lean = pose === 'type' || pose === 'type2' ? 1.5 : 0;
  const hy = handY ?? seat - 4 * u;
  // Legs: thigh along the seat, shin down to a shoe on the floor.
  limb(b, X(16), seat - 1 * u, X(16.5), floor - 2.5 * u, 2.4 * u, 'pants', 'pantsDark');
  b.rect(Math.round(Math.min(X(14), X(21))), Math.round(floor - 2.5 * u), Math.round(7 * u), Math.max(2, Math.round(2.5 * u)), 'shoe');
  limb(b, X(3.5), seat - 2 * u, X(16), seat - 1.2 * u, 3.2 * u, 'pants', 'pantsDark');
  // Torso, neck and head.
  const sx = 6 + lean;
  limb(b, X(4.5), seat - 4 * u, X(sx), seat - 18 * u, 5.2 * u, look.top, look.topShade);
  limb(b, X(sx + 1), seat - 20 * u, X(sx + 1.2), seat - 23 * u, 1.6 * u, look.skinShade);
  const nod = pose === 'nod' ? 1.2 : 0;
  head(b, X(sx + 2 + nod * 0.4), seat - 28 * u + nod * u, 5.4 * u, look, dir);
  // The near arm.
  const shoulder = [X(sx + 1), seat - 17 * u] as const;
  let elbow: [number, number] = [X(sx + 3), seat - 8 * u];
  let hand: [number, number] = [X(sx + 13), hy - 1.2 * u];
  if (pose === 'type2') hand = [X(sx + 14), hy - 2 * u];
  if (pose === 'talk') {
    elbow = [X(sx + 5), seat - 8 * u];
    hand = [X(sx + 11), seat - 16 * u];
  }
  if (pose === 'sip') {
    elbow = [X(sx + 6), seat - 9 * u];
    hand = [X(sx + 7.5), seat - 23 * u];
  }
  limb(b, shoulder[0], shoulder[1], elbow[0], elbow[1], 2.2 * u, look.top, look.topShade);
  limb(b, elbow[0], elbow[1], hand[0], hand[1], 1.9 * u, look.top, look.topShade);
  disc(b, hand[0], hand[1], 1.5 * u, look.skin, look.skinShade);
  if (pose === 'sip') cup(b, hand[0] + dir * 1.5 * u, hand[1] - 1.5 * u, u);
}

/**
 * Someone sitting across the table facing out: head, shoulders and arms
 * above the tabletop at `tableY`, centred on `cx`.
 */
export function facing(b: B, cx: number, tableY: number, h: number, look: Look, pose: Pose = 'rest') {
  const u = h / 50;
  const shoulder = tableY - 11 * u;
  const nod = pose === 'nod' ? 1.2 * u : 0;
  if (look.style === 'long') limb(b, cx, shoulder - 8 * u, cx, shoulder + 2 * u, 6 * u, look.hair, 'hairShine');
  for (let y = Math.floor(shoulder); y < tableY; y++) {
    const half = 7.5 * u - Math.max(0, (shoulder + 2 * u - y) * 0.9);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const edge = x + 0.5 - cx;
      b.set(x, y, edge > half * 0.55 || edge < -half * 0.8 ? look.topShade : look.top);
    }
  }
  limb(b, cx, shoulder - 3 * u, cx, shoulder + 0.5 * u, 1.7 * u, look.skinShade);
  const hy = shoulder - 9 * u + nod;
  const r = 5.4 * u;
  disc(b, cx, hy, r, look.skin, look.skinShade);
  for (let y = Math.floor(hy - r - 1); y <= hy + r; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const ox = x + 0.5 - cx;
      const oy = y + 0.5 - hy;
      if (ox * ox + oy * oy > (r + 0.5) ** 2) continue;
      const face = oy > -r * 0.35 && Math.abs(ox) < r * 0.8;
      if (!face) b.set(x, y, hy - r * 0.6 > y && (x + y) % 3 === 0 ? 'hairShine' : look.hair);
    }
  }
  if (look.style === 'bun') disc(b, cx, hy - r * 1.1, r * 0.45, look.hair);
  b.set(Math.floor(cx - r * 0.4), Math.floor(hy + r * 0.05), 'eye');
  b.set(Math.floor(cx + r * 0.4), Math.floor(hy + r * 0.05), 'eye');
  b.set(Math.floor(cx), Math.floor(hy + r * 0.45), look.skinShade);
  const lift = pose === 'talk' ? 6 * u : 0;
  for (const side of [-1, 1]) {
    const up = side === 1 ? lift : 0;
    limb(b, cx + side * 6.5 * u, shoulder + 2 * u, cx + side * 7.5 * u, tableY - 3 * u - up, 2 * u, look.top, look.topShade);
    limb(b, cx + side * 7.5 * u, tableY - 3 * u - up, cx + side * 3.5 * u, tableY - 1 * u - up * 1.3, 1.8 * u, look.top, look.topShade);
    disc(b, cx + side * 3 * u, tableY - 1 * u - up * 1.3, 1.5 * u, look.skin, look.skinShade);
  }
}

/** A coffee cup with its handle, about `u` times the size of one at full scale. */
export function cup(b: B, x: number, bottom: number, u = 1) {
  const w = Math.max(3, Math.round(3.5 * u));
  const hgt = Math.max(3, Math.round(3.5 * u));
  b.rect(Math.round(x - w / 2), Math.round(bottom - hgt), w, hgt, 'cup');
  b.set(Math.round(x + w / 2), Math.round(bottom - hgt + 1), 'cup');
  b.set(Math.round(x - w / 2), Math.round(bottom - hgt), 'shirtWhiteDark');
}

/** An open laptop side on, on a table at `top`, its screen turned back toward someone facing `dir`. */
export function laptop(b: B, x: number, top: number, dir: 1 | -1, u = 1) {
  const len = Math.round(11 * u);
  for (let i = 0; i < len; i++) b.set(Math.round(x + dir * i), top - 1, 'laptop');
  const hinge = x + dir * len;
  const hgt = Math.round(8 * u);
  const wide = Math.max(3, Math.round(6 * u));
  for (let j = 0; j < hgt; j++) {
    const lx = Math.round(hinge + dir * (j * 0.25));
    for (let i = 0; i < wide; i++) {
      const edge = i === 0 || j === hgt - 1;
      b.set(lx - dir * i, top - 2 - j, edge ? 'laptop' : 'screen');
    }
  }
}

/** A folding bistro chair seen side on for someone facing `dir` with their back at `x`. */
export function chair(b: B, x: number, floor: number, h: number, dir: 1 | -1) {
  const { seat, depth, back } = seatOf(floor, h);
  const u = h / 50;
  const bx = Math.round(x - dir * 2 * u);
  const w = Math.max(1, Math.round(1.5 * u));
  for (let y = Math.round(seat - back); y <= floor; y++) for (let i = 0; i < w; i++) b.set(bx - dir * i, y, 'chairDark');
  for (let i = 0; i < Math.round(4 * u); i++) {
    b.set(bx + dir * i, Math.round(seat - back), 'chair');
    b.set(bx + dir * i, Math.round(seat - back + 3 * u), 'chair');
  }
  for (let i = 0; i <= depth; i++) {
    b.set(Math.round(bx + dir * i), Math.round(seat), 'chair');
    b.set(Math.round(bx + dir * i), Math.round(seat + 1), 'chairDark');
  }
  for (let y = Math.round(seat + 2); y <= floor; y++) {
    const t = (y - seat - 2) / Math.max(1, floor - seat - 2);
    b.set(Math.round(bx + dir * depth * (1 - t * 0.15)), y, 'chairDark');
    b.set(Math.round(bx + dir * depth * t), y, 'chairDark');
  }
}

/** Draws into a fresh sprite covering the given box of the scene, so drawing code can use scene coordinates. */
export function sprite(x0: number, y0: number, w: number, h: number, draw: (b: B) => void): Sprite<StradaKey> {
  const { sprite: s, set } = blank<StradaKey>(w, h);
  const b: B = {
    set: (x, y, k) => set(x - x0, y - y0, k),
    rect: (x, y, rw, rh, k) => {
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i - x0, y + j - y0, k);
    },
  };
  draw(b);
  return s;
}
