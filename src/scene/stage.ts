import type { ElementId } from '../elements';
import type { Palette, TimeOfDay } from './palette';
import { mulberry32 } from './pixels';
import { opaque, type Sprite } from './sprites';

export const W = 320;
export const H = 180;

type OutlineKey = 'outline' | 'outlineGlow';

export interface Part<K extends string> {
  sprite: Sprite<K>;
  x: number;
  y: number;
}

export interface Placed<K extends string> {
  id: ElementId;
  parts: Part<K>[];
}

/** Which pixels of a full-scene canvas are painted. */
export function alphaMask(c: HTMLCanvasElement) {
  const data = c.getContext('2d')!.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) m[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  return m;
}

/** What the app sees of a scene, whatever its colours. */
export interface SceneStage {
  present: Partial<Record<ElementId, boolean>>;
  time: TimeOfDay;
  reducedMotion: boolean;
  highlight: ElementId | null;
  call(id: ElementId, ms: number): void;
  bounds(id: ElementId): { x: number; y: number; w: number; h: number };
  hitTest(lx: number, ly: number): ElementId | null;
  render(ctx: CanvasRenderingContext2D, now: number): void;
}

/**
 * One scene drawn on the 320x180 canvas, plus the silhouette masks used for
 * outlines and hit-testing. Lives outside React render state.
 */
export abstract class Stage<K extends string> implements SceneStage {
  present: Partial<Record<ElementId, boolean>> = {};
  time: TimeOfDay = 'day';
  reducedMotion = false;
  highlight: ElementId | null = null;

  protected rng = mulberry32(Date.now() & 0xffff);
  protected placedCache: Placed<K>[] = [];
  /** Large targets that need no extra margin around their silhouette. */
  protected unpadded = new Set<ElementId>();
  private callUntil: Partial<Record<ElementId, number>> = {};

  /** `elements` is the scene's stacking order, bottom first; hit-testing walks it from the top. */
  constructor(elements: ElementId[]) {
    for (const id of elements) this.present[id] = false;
  }

  protected abstract get palette(): Palette<K | OutlineKey>;
  /** Where an element sits when nothing is animating it. */
  protected abstract restingParts(id: ElementId): Part<K>[];
  abstract render(ctx: CanvasRenderingContext2D, now: number): void;

  /** Whether scenery in front hides an element at this pixel. */
  protected occluded(_id: ElementId, x: number, y: number) {
    return x < 0 || y < 0 || x >= W || y >= H;
  }

  /** An element is calling for the next `ms`: the bird sings, the owl hoots, and so on. */
  call(id: ElementId, ms: number) {
    this.callUntil[id] = Math.max(this.callUntil[id] ?? 0, performance.now() + ms);
  }

  protected calling(id: ElementId, now: number) {
    return now < (this.callUntil[id] ?? 0);
  }

  /** Resting bounds of an element, used to place keyboard focus targets. */
  bounds(id: ElementId) {
    const parts = this.restingParts(id);
    const x0 = Math.max(0, Math.min(...parts.map((p) => p.x)));
    const y0 = Math.max(0, Math.min(...parts.map((p) => p.y)));
    const x1 = Math.min(W, Math.max(...parts.map((p) => p.x + p.sprite.w)));
    const y1 = Math.min(H, Math.max(...parts.map((p) => p.y + p.sprite.h)));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private mask(p: Placed<K>, x: number, y: number): boolean {
    if (!p.parts.some((s) => opaque(s.sprite, x - s.x, y - s.y))) return false;
    return !this.occluded(p.id, x, y);
  }

  hitTest(lx: number, ly: number): ElementId | null {
    const x = Math.floor(lx);
    const y = Math.floor(ly);
    for (let i = this.placedCache.length - 1; i >= 0; i--) {
      const p = this.placedCache[i];
      const pad = this.unpadded.has(p.id) ? 0 : 2;
      for (let dy = -pad; dy <= pad; dy++) {
        for (let dx = -pad; dx <= pad; dx++) {
          if (this.mask(p, x + dx, y + dy)) return p.id;
        }
      }
    }
    return null;
  }

  /** Outlines whichever placed element is highlighted. */
  protected drawHighlight(ctx: CanvasRenderingContext2D) {
    const hl = this.placedCache.find((p) => p.id === this.highlight);
    if (hl) this.drawOutline(ctx, hl);
  }

  /** A crisp ice-blue edge with a soft blue glow ring just outside it. */
  private drawOutline(ctx: CanvasRenderingContext2D, p: Placed<K>) {
    const pal = this.palette;
    const x0 = Math.min(...p.parts.map((s) => s.x)) - 3;
    const y0 = Math.min(...p.parts.map((s) => s.y)) - 3;
    const x1 = Math.max(...p.parts.map((s) => s.x + s.sprite.w)) + 3;
    const y1 = Math.max(...p.parts.map((s) => s.y + s.sprite.h)) + 3;
    const bw = x1 - x0;
    const bh = y1 - y0;
    const inside = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) inside[y * bw + x] = this.mask(p, x + x0, y + y0) ? 1 : 0;
    }
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= bw || y >= bh ? 0 : inside[y * bw + x]);
    const ring = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) ring[y * bw + x] = 1;
        else if (at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)) {
          ring[y * bw + x] = 2;
        }
      }
    }
    ctx.fillStyle = pal.outlineGlow;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (at(x, y) || ring[y * bw + x] === 1) continue;
        const r = (xx: number, yy: number) =>
          xx >= 0 && yy >= 0 && xx < bw && yy < bh && ring[yy * bw + xx] === 1;
        if (ring[y * bw + x] === 2 || r(x - 1, y) || r(x + 1, y) || r(x, y - 1) || r(x, y + 1)) {
          ctx.fillRect(x + x0, y + y0, 1, 1);
        }
      }
    }
    ctx.fillStyle = pal.outline;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) if (ring[y * bw + x] === 1) ctx.fillRect(x + x0, y + y0, 1, 1);
    }
  }
}
