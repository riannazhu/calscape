import { relight, type Palette, type TimeOfDay } from '../palette';
import { COLOURS, EDGES } from './art';

/** A colour of the patio picture itself, by its code. */
export type ArtKey = `art${number}`;
export const artKey = (code: number): ArtKey => `art${code}`;

export type StradaKey =
  | ArtKey
  | 'edgeTop'
  | 'edgeBottom'
  | 'star'
  | 'wispTop'
  | 'wispMid'
  | 'wispBase'
  | 'cloudLight'
  | 'cloudMid'
  | 'cloudShade'
  | 'cloudDark'
  | 'rain'
  | 'rainTint'
  | 'woodDark'
  | 'heater'
  | 'heaterDark'
  | 'heaterGlow'
  | 'bulbGlow'
  | 'lampGlow'
  | 'bannerGold'
  | 'bannerGoldDark'
  | 'bannerNavy'
  | 'bannerNavyLight'
  | 'bannerNavyDark'
  | 'bannerArm'
  | 'laptop'
  | 'screen'
  | 'cup'
  | 'tire'
  | 'skin1'
  | 'skin2'
  | 'skin3'
  | 'hairGold'
  | 'shirtRed'
  | 'shirtBlue'
  | 'shirtWhite'
  | 'shirtGreen'
  | 'shirtNavy'
  | 'pants'
  | 'sparrow'
  | 'sparrowDark'
  | 'sparrowLight'
  | 'sparrowCap'
  | 'crow'
  | 'crowLight'
  | 'eye'
  | 'beak'
  | 'bug'
  | 'bugLight'
  | 'outline'
  | 'outlineGlow';

function art(time: TimeOfDay) {
  const out: Record<ArtKey, string> = {};
  COLOURS[time].forEach((c, i) => (out[artKey(i)] = c));
  return { ...out, edgeTop: EDGES[time][0], edgeBottom: EDGES[time][1] };
}

/** Late morning on the patio: blue sky through the plum trees, people at every table. */
const DAY: Palette<StradaKey> = {
  ...art('day'),
  star: '#eef0ff',
  wispTop: '#ffffff',
  wispMid: '#eef4fb',
  wispBase: '#c9d9ee',
  cloudLight: '#f4f4f8',
  cloudMid: '#d6d8e2',
  cloudShade: '#afb3c4',
  cloudDark: '#8c90a6',
  rain: '#eef4ff',
  rainTint: 'rgba(60, 70, 100, 0.16)',
  woodDark: '#7d5234',
  heater: '#5d6070',
  heaterDark: '#3c3e4c',
  heaterGlow: '#ffb070',
  bulbGlow: '#ffe3a0',
  lampGlow: '#ffe09a',
  bannerGold: '#fdb515',
  bannerGoldDark: '#c98a10',
  bannerNavy: '#003262',
  bannerNavyLight: '#0d4683',
  bannerNavyDark: '#00213f',
  bannerArm: '#2a1c1e',
  laptop: '#b9bccb',
  screen: '#cfe4ff',
  cup: '#fbf8f2',
  tire: '#26242c',
  skin1: '#f2c9a5',
  skin2: '#c98d63',
  skin3: '#8a5a3c',
  hairGold: '#d9a84e',
  shirtRed: '#d2564e',
  shirtBlue: '#4a78c8',
  shirtWhite: '#f1ece8',
  shirtGreen: '#4f9a6a',
  shirtNavy: '#2d3a6a',
  pants: '#3d4a78',
  sparrow: '#9a6a44',
  sparrowDark: '#5a3c2c',
  sparrowLight: '#e2d2b8',
  sparrowCap: '#8a8a96',
  crow: '#24232e',
  crowLight: '#4a4e6a',
  eye: '#121018',
  beak: '#2a2630',
  bug: '#5a3a26',
  bugLight: '#b07a48',
  outline: '#d6eeff',
  outlineGlow: 'rgba(72, 156, 255, 0.6)',
};

/** Golden hour: a peach-and-lilac sky through the leaves, string lights and heaters on. */
const SUNSET: Palette<StradaKey> = {
  ...relight(DAY, [0.8, 0.68, 0.68], '#ff8a5a', 0.2, {
    wispTop: '#c48fca',
    wispMid: '#f0a4ba',
    wispBase: '#ffcf9c',
    cloudLight: '#e9dcea',
    cloudMid: '#c3b6d4',
    cloudShade: '#9a8fb5',
    cloudDark: '#766e98',
    rain: '#dfe6ff',
    rainTint: 'rgba(40, 44, 100, 0.18)',
    heaterGlow: '#ffb070',
    bulbGlow: '#ffd27f',
    lampGlow: '#ffd27f',
    bannerGold: '#ffb526',
    bannerGoldDark: '#c87e16',
    bannerNavy: '#132b5c',
    bannerNavyLight: '#24417c',
    bannerNavyDark: '#0b1b3d',
    screen: '#d8e8ff',
    outline: '#d6eeff',
    outlineGlow: 'rgba(72, 156, 255, 0.6)',
  }),
  ...art('sunset'),
};

/** Evening on the patio: deep blue sky, warm string lights and heaters glowing. */
const NIGHT: Palette<StradaKey> = {
  ...relight(DAY, [0.42, 0.45, 0.62], '#141a40', 0.25, {
    wispTop: '#2c3a6e',
    wispMid: '#28366a',
    wispBase: '#34447c',
    cloudLight: '#737aa6',
    cloudMid: '#5d6491',
    cloudShade: '#4a507e',
    cloudDark: '#393e69',
    rain: '#b4c4f0',
    rainTint: 'rgba(6, 10, 32, 0.22)',
    heaterGlow: '#ffa860',
    bulbGlow: '#ffcf75',
    lampGlow: '#ffcf75',
    bannerGold: '#e0a432',
    bannerGoldDark: '#a6761f',
    bannerNavy: '#0b2149',
    bannerNavyLight: '#183568',
    bannerNavyDark: '#05122d',
    screen: '#c4dcff',
    star: '#eef0ff',
    outline: '#d6eeff',
    outlineGlow: 'rgba(72, 156, 255, 0.65)',
  }),
  ...art('night'),
};

export const PALETTES: Record<TimeOfDay, Palette<StradaKey>> = { day: DAY, sunset: SUNSET, night: NIGHT };
