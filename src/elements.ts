import type { TimeOfDay } from './scene/palette';

export type ElementId =
  | 'rain'
  | 'bird'
  | 'bell'
  | 'squirrel'
  | 'dove'
  | 'wind'
  | 'crickets'
  | 'owl';

export interface ElementState {
  present: boolean;
  muted: boolean;
  /** 0..1, retained while muted. */
  volume: number;
}

export type BarPlacement = 'above' | 'below' | 'right';

export interface ElementDef {
  id: ElementId;
  name: string;
  /** Where the anchored control bar attaches, in logical scene pixels. */
  bar: { x: number; y: number; place: BarPlacement };
}

/** Bottom of the stack first; hit-testing walks this list in reverse. */
export const ELEMENTS: ElementDef[] = [
  { id: 'wind', name: 'Breeze', bar: { x: 84, y: 64, place: 'below' } },
  { id: 'bell', name: 'Campanile bell', bar: { x: 116, y: 36, place: 'right' } },
  { id: 'crickets', name: 'Crickets', bar: { x: 202, y: 147, place: 'above' } },
  { id: 'rain', name: 'Rain', bar: { x: 141, y: 30, place: 'below' } },
  { id: 'dove', name: 'Mourning dove', bar: { x: 46, y: 37, place: 'right' } },
  { id: 'squirrel', name: 'Squirrel', bar: { x: 70, y: 33, place: 'right' } },
  { id: 'owl', name: 'Owl', bar: { x: 44, y: 37, place: 'right' } },
  { id: 'bird', name: 'Bird', bar: { x: 49, y: 37, place: 'right' } },
];

export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map((e) => [e.id, e])) as Record<
  ElementId,
  ElementDef
>;

/** What each time of day offers, in inventory order; the third slot is always that time's bird. */
export const INVENTORY: Record<TimeOfDay, ElementId[]> = {
  day: ['rain', 'bell', 'bird', 'squirrel'],
  sunset: ['rain', 'bell', 'dove', 'wind'],
  night: ['rain', 'bell', 'owl', 'crickets'],
};

/**
 * Whether an element plays and shows now. Elements added at another time of
 * day stay in the scene's state but rest until that time comes back round.
 */
export const isActive = (time: TimeOfDay, id: ElementId, s: ElementState) =>
  s.present && INVENTORY[time].includes(id);

export const VOLUME_STEPS = 6;
export const DEFAULT_VOLUME = 4 / VOLUME_STEPS;
export const MASTER_STEPS = 8;
export const DEFAULT_MASTER = 0.7;
