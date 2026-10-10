import type { ElementDef, ElementId, ElementState } from './elements';
import { Glade } from './scene/glade/glade';
import { PALETTES as GLADE } from './scene/glade/palette';
import { BELL_TILE, BIRD_IDLE, CLOUD_TILE, CRICKET, DOVE, OWL, SQUIRREL, WIND_TILE } from './scene/glade/sprites';
import { Marina } from './scene/marina/marina';
import { PALETTES as MARINA } from './scene/marina/palette';
import { FOG_TILE, GOOSE_TILE, GULL, HERON, SEALION_TILE, WAVES_TILE } from './scene/marina/sprites';
import type { TimeOfDay } from './scene/palette';
import type { Sprite } from './scene/sprites';
import type { SceneStage } from './scene/stage';
import { Strada } from './scene/strada/strada';
import { PALETTES as STRADA } from './scene/strada/palette';
import { CHATTER_TILE, CRICKET as STRADA_CRICKET, CROW, SPARROW, TYPING_TILE } from './scene/strada/sprites';
import { BOAT, CUP, PINE } from './ui/icons';

export type SceneId = 'glade' | 'strada' | 'marina';

interface Art {
  sprite: Sprite;
  palette: Record<string, string>;
}

export interface SceneDef {
  id: SceneId;
  /** Full description for screen readers. */
  title: string;
  icon: Sprite;
  /** In stacking order, bottom first. */
  elements: ElementDef[];
  /** What each time of day offers, in inventory order; the third slot changes with the time. */
  inventory: Record<TimeOfDay, ElementId[]>;
  /** Inventory art, always in daylight colours. */
  tiles: Partial<Record<ElementId, Art>>;
  /** Page colours above and below the scene, matching its top and bottom edges. */
  edges: Record<TimeOfDay, [string, string]>;
  create(ids: ElementId[]): SceneStage;
}

const edges = <P extends Record<TimeOfDay, Record<string, string>>>(pals: P, top: string, bottom: string) =>
  Object.fromEntries((['day', 'sunset', 'night'] as const).map((t) => [t, [pals[t][top], pals[t][bottom]]])) as Record<
    TimeOfDay,
    [string, string]
  >;

const glade = (sprite: Sprite): Art => ({ sprite, palette: GLADE.day });
const strada = (sprite: Sprite): Art => ({ sprite, palette: STRADA.day });
const marina = (sprite: Sprite): Art => ({ sprite, palette: MARINA.day });

export const SCENES: SceneDef[] = [
  {
    id: 'glade',
    title: 'Glade facing Doe Library',
    icon: PINE,
    elements: [
      { id: 'wind', name: 'Breeze', bar: { x: 84, y: 64, place: 'below' } },
      { id: 'bell', name: 'Campanile bell', bar: { x: 116, y: 36, place: 'right' } },
      { id: 'crickets', name: 'Crickets', bar: { x: 202, y: 147, place: 'above' } },
      { id: 'rain', name: 'Rain', bar: { x: 141, y: 30, place: 'below' } },
      { id: 'dove', name: 'Mourning dove', bar: { x: 46, y: 37, place: 'right' } },
      { id: 'squirrel', name: 'Squirrel', bar: { x: 70, y: 33, place: 'right' } },
      { id: 'owl', name: 'Owl', bar: { x: 44, y: 37, place: 'right' } },
      { id: 'bird', name: 'Bird', bar: { x: 49, y: 37, place: 'right' } },
    ],
    inventory: {
      day: ['rain', 'bell', 'bird', 'squirrel'],
      sunset: ['rain', 'bell', 'dove', 'wind'],
      night: ['rain', 'bell', 'owl', 'crickets'],
    },
    tiles: {
      rain: glade(CLOUD_TILE),
      bird: glade(BIRD_IDLE),
      bell: glade(BELL_TILE),
      squirrel: glade(SQUIRREL[0]),
      dove: glade(DOVE[0]),
      wind: glade(WIND_TILE),
      crickets: glade(CRICKET[0]),
      owl: glade(OWL.open),
    },
    edges: edges(GLADE, 'sky0', 'lawnMid'),
    create: (ids) => new Glade(ids),
  },
  {
    id: 'strada',
    title: 'Caffè Strada patio on Bancroft Way',
    icon: CUP,
    elements: [
      { id: 'chatter', name: 'Café chatter', bar: { x: 274, y: 95, place: 'above' } },
      { id: 'typing', name: 'Laptop typing', bar: { x: 156, y: 96, place: 'above' } },
      { id: 'crickets', name: 'Crickets', bar: { x: 207, y: 155, place: 'above' } },
      { id: 'rain', name: 'Rain', bar: { x: 150, y: 50, place: 'below' } },
      { id: 'sparrow', name: 'House sparrow', bar: { x: 282, y: 122, place: 'above' } },
      { id: 'crow', name: 'Crow', bar: { x: 139, y: 52, place: 'right' } },
    ],
    inventory: {
      day: ['rain', 'chatter', 'sparrow', 'typing'],
      sunset: ['rain', 'chatter', 'crow', 'typing'],
      night: ['rain', 'chatter', 'crickets', 'typing'],
    },
    tiles: {
      rain: glade(CLOUD_TILE),
      chatter: strada(CHATTER_TILE),
      typing: strada(TYPING_TILE),
      sparrow: strada(SPARROW.idle),
      crow: strada(CROW.idle),
      crickets: strada(STRADA_CRICKET[0]),
    },
    edges: edges(STRADA, 'edgeTop', 'edgeBottom'),
    create: (ids) => new Strada(ids),
  },
  {
    id: 'marina',
    title: 'Berkeley Marina shore facing the Golden Gate',
    icon: BOAT,
    elements: [
      { id: 'foghorn', name: 'Foghorn', bar: { x: 286, y: 76, place: 'above' } },
      { id: 'waves', name: 'Waves', bar: { x: 200, y: 132, place: 'above' } },
      { id: 'sealions', name: 'Sea lions', bar: { x: 254, y: 119, place: 'above' } },
      { id: 'geese', name: 'Canada geese', bar: { x: 216, y: 156, place: 'above' } },
      { id: 'gull', name: 'Western gull', bar: { x: 134, y: 106, place: 'right' } },
      { id: 'heron', name: 'Night heron', bar: { x: 133, y: 106, place: 'right' } },
    ],
    inventory: {
      day: ['waves', 'foghorn', 'gull', 'sealions'],
      sunset: ['waves', 'foghorn', 'geese', 'sealions'],
      night: ['waves', 'foghorn', 'heron', 'sealions'],
    },
    tiles: {
      waves: marina(WAVES_TILE),
      foghorn: marina(FOG_TILE),
      gull: marina(GULL.idle),
      geese: marina(GOOSE_TILE),
      heron: marina(HERON.idle),
      sealions: marina(SEALION_TILE),
    },
    edges: edges(MARINA, 'sky0', 'grassMid'),
    create: (ids) => new Marina(ids),
  },
];

export const SCENE_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s])) as Record<SceneId, SceneDef>;

/** Every element of every scene, once each. */
export const ALL_ELEMENTS = [...new Set(SCENES.flatMap((s) => s.elements.map((e) => e.id)))];

/**
 * Whether an element plays and shows now. Elements added at another time of
 * day stay in the scene's state but rest until that time comes back round.
 */
export const isActive = (scene: SceneDef, time: TimeOfDay, id: ElementId, s: ElementState | undefined) =>
  !!s?.present && scene.inventory[time].includes(id);
