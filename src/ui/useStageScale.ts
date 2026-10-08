import { useEffect, useState } from 'react';

/**
 * Size of one logical scene pixel in CSS pixels. The scale is an integer in
 * device pixels, so nearest-neighbour scaling stays crisp on HiDPI screens.
 */
export function useStageScale(w: number, h: number) {
  const compute = () => {
    const dpr = window.devicePixelRatio || 1;
    const device = Math.floor(Math.min((window.innerWidth * dpr) / w, (window.innerHeight * dpr) / h));
    return Math.max(1, device) / dpr;
  };
  const [scale, setScale] = useState(compute);
  useEffect(() => {
    const onResize = () => setScale(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });
  return scale;
}
