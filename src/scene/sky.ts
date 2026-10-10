import { hash, mix, noise, type RGB } from './pixels';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A stepped ring of light around a point. */
export interface Glow {
  x: number;
  y: number;
  r: number;
  a: number;
  steps: number;
}

export interface Sky {
  /** Colours from the deepest sky to its brightest point. */
  ramp: RGB[];
  /** How many solid colour steps the ramp is broken into. */
  levels: number;
  /** Where a point sits on the ramp, 0 deepest to 1 brightest. */
  field(x: number, y: number): number;
  glows: Glow[];
  glow: RGB;
}

/** Fade for a stepped glow ring at normalised distance `d` (0 centre, 1 edge). */
export function glowAt(d: number, steps: number) {
  if (d >= 1) return 0;
  const q = (Math.floor(d * steps) + 0.5) / steps;
  return (1 - q) ** 2;
}

/** Colour at a fraction along a ramp of solid colours. */
function along(ramp: RGB[], q: number): RGB {
  const at = q * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(at));
  return mix(ramp[i], ramp[i + 1], at - i);
}

/**
 * The sky colour at a pixel. Each 2x2 block takes one solid step of the ramp;
 * smooth noise wobbles the step edges so the bands read as natural, not ruled.
 */
export function steppedSky(sky: Sky, x: number, y: number): RGB {
  const bx = x >> 1;
  const by = y >> 1;
  const cx = bx * 2 + 1;
  const cy = by * 2 + 1;
  const wobble = (noise(bx, by, 5, 41) - 0.5) * 1.2 + (hash(bx, by, 42) - 0.5) * 0.35;
  const q = clamp01(Math.round(sky.field(cx, cy) * sky.levels + wobble) / sky.levels);
  let c = along(sky.ramp, q);
  for (const g of sky.glows) c = mix(c, sky.glow, g.a * glowAt(Math.hypot(cx - g.x, cy - g.y) / g.r, g.steps));
  return c;
}

/**
 * A rainy sky: a low deck of cloud (darkest first), brightest toward the
 * horizon at `horizon`, mottled into soft billows in 2x2 blocks. `clear`
 * still tints it by `show`, so the hour stays legible.
 */
export function overcastSky(deck: RGB[], clear: RGB, show: number, horizon: number, x: number, y: number): RGB {
  const bx = x >> 1;
  const by = y >> 1;
  const levels = 12;
  const billow = (noise(bx, by * 2, 9, 61) - 0.5) * 0.5 + (noise(bx, by, 4, 62) - 0.5) * 0.25;
  const wobble = (hash(bx, by, 63) - 0.5) * 0.3;
  const v = clamp01((by * 2 + 1) / horizon + billow);
  const q = clamp01(Math.round(v * levels + wobble) / levels);
  return mix(along(deck, q), clear, show);
}
