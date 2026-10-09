import { useEffect, useState } from 'react';

/** At most this fraction of the scene's width or height is cropped to fill the window. */
const MAX_CROP = 0.2;

/**
 * `scale` is the size of one logical scene pixel in CSS pixels, chosen so the
 * scene covers the window, cropping no more than MAX_CROP of either axis.
 * `fit` is the scale at which the whole scene would just fit.
 */
export function useStageScale(w: number, h: number) {
  const compute = () => {
    const sx = window.innerWidth / w;
    const sy = window.innerHeight / h;
    const cover = Math.max(sx, sy);
    const scale = Math.min(cover, sx / (1 - MAX_CROP), sy / (1 - MAX_CROP));
    return { scale, fit: Math.min(sx, sy) };
  };
  const [size, setSize] = useState(compute);
  useEffect(() => {
    const onResize = () => setSize(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });
  return size;
}
