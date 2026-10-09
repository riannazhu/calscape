import type { PaletteKey, TimeOfDay } from './palette';
import type { Painter } from './pixels';
import { flipX, fromRows, type Sprite } from './sprites';

interface Look {
  hair: PaletteKey;
  skin: PaletteKey;
  top: PaletteKey;
  pants?: PaletteKey;
}

/**
 * Poses face right; H hair, S skin, T top, P trousers, D shoes, B book,
 * G guitar, K camera.
 */
const POSES = {
  stand: ['.HHH.', '.HSS.', '..S..', '.TTT.', 'TTTTT', 'STTTS', '.PPP.', '.P.P.', '.D.D.'],
  crouch: ['.HHH.', '.HSS.', '.TTT.', 'STTTS', '.PPP.', 'P...P', 'D...D'],
  sit: ['.HH...', 'HSS...', '.TT...', '.TTS..', '.PPPPD'],
  sitBack: ['.HHH.', '.HHH.', 'TTTTT', 'TTTTT', 'PPPPP'],
  read: ['BB.HH.....', 'BBSHHTTTPP', '..S.TTTTPD'],
  lie: ['HHSTTTTPPPD', 'HHSTTTTPPPD'],
  guitar: ['.HH.....', 'HSS.....', '.TT..G..', '.TGGGGGS', '.GGGPPPD'],
  photo: ['.HHH..', '.HSKK.', '..SSK.', '.TTT..', 'TTTT..', '.TTT..', '.PPP..', '.P.P..', '.D.D..'],
};

function person(pose: keyof typeof POSES, look: Look, facingLeft = false): Sprite {
  const s = fromRows(POSES[pose], {
    H: look.hair,
    S: look.skin,
    T: look.top,
    P: look.pants ?? 'pants',
    D: 'shoe',
    B: 'shirtWhite',
    G: 'basket',
    K: 'shoe',
  });
  return facingLeft ? flipX(s) : s;
}

const BASKET = fromRows(['.bb.', 'b..b', 'bbbb', 'bbbb'], { b: 'basket' });

export interface Placed {
  sprite: Sprite;
  x: number;
  y: number;
}

/** The spikeball net and where each player's hands meet the ball. */
export const SPIKEBALL = {
  net: { x: 100, y: 147 },
  hands: [
    { x: 92, y: 143 },
    { x: 108, y: 143 },
    { x: 100, y: 137 },
    { x: 101, y: 152 },
  ],
};

const COUPLE: Placed[] = [
  { sprite: person('sitBack', { hair: 'hairDark', skin: 'skin2', top: 'shirtBlue' }), x: 170, y: 139 },
  { sprite: person('sitBack', { hair: 'hairBrown', skin: 'skin1', top: 'shirtWhite' }), x: 177, y: 139 },
];

const PICNIC: Placed[] = [
  { sprite: person('sit', { hair: 'hairBrown', skin: 'skin1', top: 'shirtYellow' }), x: 46, y: 143 },
  { sprite: person('sit', { hair: 'hairDark', skin: 'skin3', top: 'shirtBlue' }, true), x: 56, y: 143 },
  { sprite: BASKET, x: 62, y: 145 },
];

/** Midday on the Glade, back to front so nearer people overlap farther ones. */
const DAY_PEOPLE: Placed[] = [
  { sprite: person('stand', { hair: 'hairDark', skin: 'skin2', top: 'shirtGreen' }), x: 98, y: 133 },
  ...COUPLE,
  { sprite: person('read', { hair: 'hairBrown', skin: 'skin3', top: 'shirtYellow' }), x: 186, y: 146 },
  { sprite: person('lie', { hair: 'hairGold', skin: 'skin1', top: 'shirtRed' }), x: 257, y: 149 },
  { sprite: person('crouch', { hair: 'hairGold', skin: 'skin1', top: 'shirtRed' }), x: 87, y: 141 },
  { sprite: person('crouch', { hair: 'hairBrown', skin: 'skin3', top: 'shirtWhite' }, true), x: 109, y: 141 },
  ...PICNIC,
  { sprite: person('stand', { hair: 'hairDark', skin: 'skin1', top: 'shirtBlue' }, true), x: 99, y: 150 },
];

/** Golden hour: a picnic, a guitar circle, a photographer and sunset watchers. */
const SUNSET_PEOPLE: Placed[] = [
  ...COUPLE,
  { sprite: person('photo', { hair: 'hairDark', skin: 'skin2', top: 'shirtGreen' }, true), x: 140, y: 135 },
  { sprite: person('sit', { hair: 'hairGold', skin: 'skin1', top: 'shirtRed' }), x: 98, y: 145 },
  { sprite: person('guitar', { hair: 'hairBrown', skin: 'skin3', top: 'shirtWhite' }), x: 108, y: 145 },
  { sprite: person('sit', { hair: 'hairDark', skin: 'skin1', top: 'shirtBlue' }, true), x: 120, y: 145 },
  { sprite: person('lie', { hair: 'hairBrown', skin: 'skin2', top: 'shirtYellow' }), x: 257, y: 149 },
  ...PICNIC,
];

/** Who is on the Glade at each time of day; nobody at night. */
export function peopleFor(time: TimeOfDay): Placed[] {
  return time === 'day' ? DAY_PEOPLE : time === 'sunset' ? SUNSET_PEOPLE : [];
}

/** A beach towel under the sunbather. */
export function drawTowel(p: Painter) {
  for (let y = 148; y <= 151; y++) {
    for (let x = 255; x <= 269; x++) p.set(x, y, (x >> 1) % 2 ? 'shirtYellow' : 'shirtWhite');
  }
}

/** Checked picnic blanket under the two sitters, drawn before the people. */
export function drawBlanket(p: Painter) {
  for (let r = 0; r < 5; r++) {
    const y = 146 + r;
    for (let x = 44 - r; x <= 67 - r; x++) {
      p.set(x, y, (Math.floor((x + r) / 2) + Math.floor(r / 2)) % 2 === 0 ? 'blanketA' : 'blanketB');
    }
  }
}

/** The round spikeball net on its little legs. */
export function drawNet(p: Painter) {
  const { x, y } = SPIKEBALL.net;
  for (let dx = -4; dx <= 4; dx++) {
    const edge = Math.abs(dx) === 4;
    p.set(x + dx, y - 1, edge ? 'netRim' : Math.abs(dx) === 3 ? 'netRim' : 'netMesh');
    p.set(x + dx, y, edge ? 'netRim' : 'netMesh');
    if (Math.abs(dx) <= 3) p.set(x + dx, y + 1, 'netRim');
  }
  p.set(x - 3, y + 2, 'netMesh');
  p.set(x + 3, y + 2, 'netMesh');
}

export function stamp(p: Painter, { sprite, x, y }: Placed) {
  for (let j = 0; j < sprite.h; j++) {
    for (let i = 0; i < sprite.w; i++) {
      const key = sprite.px[j * sprite.w + i];
      if (key) p.set(x + i, y + j, key);
    }
  }
}
