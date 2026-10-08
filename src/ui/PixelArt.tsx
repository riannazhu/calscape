import { memo } from 'react';
import type { Sprite } from '../scene/sprites';
import { DAY, type Palette } from '../scene/palette';

interface Run {
  x: number;
  y: number;
  w: number;
  fill: string;
}

function runs(w: number, h: number, colorAt: (x: number, y: number) => string | null): Run[] {
  const out: Run[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const fill = colorAt(x, y);
      if (!fill) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < w && colorAt(end, y) === fill) end++;
      out.push({ x, y, w: end - x, fill });
      x = end;
    }
  }
  return out;
}

function Svg({ w, h, rs }: { w: number; h: number; rs: Run[] }) {
  return (
    <svg
      className="pixel-art"
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: `calc(var(--u) * ${w})`, height: `calc(var(--u) * ${h})` }}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

/** One-colour icon drawn in `currentColor`; `#` marks a filled pixel. */
export const Icon = memo(function Icon({ rows }: { rows: string[] }) {
  const w = Math.max(...rows.map((r) => r.length));
  const rs = runs(w, rows.length, (x, y) => (rows[y][x] === '#' ? 'currentColor' : null));
  return <Svg w={w} h={rows.length} rs={rs} />;
});

/** Full-colour scene sprite, always in the day palette for legibility. */
export const SpriteArt = memo(function SpriteArt({
  sprite,
  palette = DAY,
}: {
  sprite: Sprite;
  palette?: Palette;
}) {
  const rs = runs(sprite.w, sprite.h, (x, y) => {
    const k = sprite.px[y * sprite.w + x];
    return k ? palette[k] : null;
  });
  return <Svg w={sprite.w} h={sprite.h} rs={rs} />;
});
