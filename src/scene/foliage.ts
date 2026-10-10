import { hash, noise, type Brush } from './pixels';

/** Colours for leaves and bark, which every scene with trees provides. */
export type FoliageKey = 'leafLight' | 'leaf' | 'leafMid' | 'leafDark' | 'leafDeep' | 'trunk' | 'trunkDark';

/** A chunky clump of leaves drawn in 2x2 blocks, lit from the upper left. */
export function blob(p: Brush<FoliageKey>, cx: number, cy: number, r: number, seed: number, shade = 0) {
  for (let by = Math.floor((cy - r * 1.3) / 2); by <= (cy + r * 1.3) / 2; by++) {
    for (let bx = Math.floor((cx - r * 1.3) / 2); bx <= (cx + r * 1.3) / 2; bx++) {
      const x = bx * 2 + 1;
      const y = by * 2 + 1;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const edge = r * (0.78 + 0.3 * noise(x, y, 5, seed) + 0.2 * (hash(bx, by, seed + 1) - 0.5));
      if (d > edge) continue;
      // Small leaf clusters on a staggered 6px grid, each lit on its upper side.
      const row = Math.floor((y + seed) / 6);
      const lx = ((((x + (row % 2) * 3 + seed) % 6) + 6) % 6) / 6 - 0.5;
      const ly = ((((y + seed) % 6) + 6) % 6) / 6 - 0.5;
      const cluster = -(lx * 0.3 + ly * 0.7) * 0.55;
      const v = ((-dx * 0.6 - dy * 0.8) / r) * 0.5 + cluster + (hash(bx, by, seed) - 0.5) * 0.22 + shade;
      let key: FoliageKey = v > 0.38 ? 'leafLight' : v > 0.02 ? 'leaf' : v > -0.32 ? 'leafMid' : 'leafDark';
      if (d / edge > 0.8 && dy > r * 0.25) key = shade < 0 ? 'leafDeep' : 'leafDark';
      p.rect(bx * 2, by * 2, 2, 2, key);
    }
  }
}

export function branch(p: Brush<FoliageKey>, pts: [number, number][], from: number, to: number) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let s = 0; s <= len; s += 0.5) {
      const r = (from + (to - from) * ((run + s) / total)) / 2;
      const cx = x0 + ((x1 - x0) * s) / len;
      const cy = y0 + ((y1 - y0) * s) / len;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
          p.set(x, y, y + 0.5 < cy ? 'trunk' : 'trunkDark');
        }
      }
    }
    run += len;
  }
}
