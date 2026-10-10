import { hex, mix, rgb, type RGB } from './pixels';

export type TimeOfDay = 'day' | 'sunset' | 'night';

/** Each scene names its own colours; sprites and painters are typed by those names. */
export type Palette<K extends string> = Record<K, string>;

/** The time of day that matches a clock hour. */
export function timeForHour(hour: number): TimeOfDay {
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
}

/**
 * The same scene under other light: every solid colour is scaled by `light`
 * per channel and pulled `amount` of the way toward `tint`. Hand-picked
 * colours in `set` (sky, lamps, lit windows) replace the derived ones.
 */
export function relight<K extends string>(
  base: Palette<K>,
  light: RGB,
  tint: string,
  amount: number,
  set: Partial<Palette<K>>,
): Palette<K> {
  const t = rgb(tint);
  const out = { ...base };
  for (const k of Object.keys(base) as K[]) {
    if (!base[k].startsWith('#')) continue;
    const c = rgb(base[k]);
    out[k] = hex(mix([c[0] * light[0], c[1] * light[1], c[2] * light[2]], t, amount));
  }
  return { ...out, ...set };
}
