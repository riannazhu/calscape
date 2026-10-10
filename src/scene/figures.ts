import type { Brush } from './pixels';
import { flipX, fromRows, type Sprite } from './sprites';

/** Colours every scene with people provides, besides each person's own look. */
export type FigureKey = 'pants' | 'shoe' | 'shirtBlue' | 'shirtWhite' | 'basket';

export interface Look<K extends string> {
  hair: K;
  skin: K;
  top: K;
  pants?: K;
}

/**
 * Poses face right; H hair, S skin, T top, P trousers, D shoes, G guitar,
 * and an open book held up: C cover, W pages.
 */
export const POSES = {
  stand: ['.HHH.', '.HSS.', '..S..', '.TTT.', 'TTTTT', 'STTTS', '.PPP.', '.P.P.', '.D.D.'],
  crouch: ['.HHH.', '.HSS.', '.TTT.', 'STTTS', '.PPP.', 'P...P', 'D...D'],
  sit: ['.HH...', 'HSS...', '.TT...', '.TTS..', '.PPPPD'],
  sitBack: ['.HHH.', '.HHH.', 'TTTTT', 'TTTTT', 'PPPPP'],
  read: ['.HH.....', 'HSS.CWWC', '.TTSCWWC', '.TTTS...', '.PPPPPD.'],
  lie: ['HHSTTTTPPPD', 'HHSTTTTPPPD'],
  guitar: ['.HH.....', 'HSS.....', '.TT..G..', '.TGGGGGS', '.GGGPPPD'],
};

export function person<K extends string>(
  pose: keyof typeof POSES | string[],
  look: Look<K>,
  facingLeft = false,
): Sprite<K | FigureKey> {
  const s = fromRows<K | FigureKey>(typeof pose === 'string' ? POSES[pose] : pose, {
    H: look.hair,
    S: look.skin,
    T: look.top,
    P: look.pants ?? 'pants',
    D: 'shoe',
    C: 'shirtBlue',
    W: 'shirtWhite',
    G: 'basket',
  });
  return facingLeft ? flipX(s) : s;
}

export interface Figure<K extends string> {
  sprite: Sprite<K>;
  x: number;
  y: number;
}

/** Paints a sprite into a backdrop layer. */
export function stamp<K extends string>(p: Brush<K>, { sprite, x, y }: Figure<K>) {
  for (let j = 0; j < sprite.h; j++) {
    for (let i = 0; i < sprite.w; i++) {
      const key = sprite.px[j * sprite.w + i];
      if (key) p.set(x + i, y + j, key);
    }
  }
}
