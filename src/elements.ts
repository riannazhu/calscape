export type ElementId = 'rain' | 'bird' | 'bell';

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
  { id: 'bell', name: 'Campanile bell', bar: { x: 94, y: 20, place: 'right' } },
  { id: 'rain', name: 'Rain cloud', bar: { x: 160, y: 36, place: 'below' } },
  { id: 'bird', name: 'Bird', bar: { x: 237, y: 84, place: 'above' } },
];

export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map((e) => [e.id, e])) as Record<
  ElementId,
  ElementDef
>;

/** Inventory order. */
export const INVENTORY: ElementId[] = ['rain', 'bird', 'bell'];

export const VOLUME_STEPS = 6;
export const DEFAULT_VOLUME = 4 / VOLUME_STEPS;
export const MASTER_STEPS = 8;
export const DEFAULT_MASTER = 0.7;
