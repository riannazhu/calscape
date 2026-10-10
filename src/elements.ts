export type ElementId =
  // The Glade
  | 'rain'
  | 'bird'
  | 'bell'
  | 'squirrel'
  | 'dove'
  | 'wind'
  | 'crickets'
  | 'owl'
  // Caffè Strada (with rain and crickets)
  | 'chatter'
  | 'typing'
  | 'sparrow'
  | 'crow'
  // Berkeley Marina
  | 'waves'
  | 'foghorn'
  | 'gull'
  | 'geese'
  | 'heron'
  | 'sealions';

export interface ElementState {
  present: boolean;
  muted: boolean;
  /** 0..1, retained while muted. */
  volume: number;
}

type BarPlacement = 'above' | 'below' | 'right';

export interface ElementDef {
  id: ElementId;
  name: string;
  /** Where the anchored control bar attaches, in logical scene pixels. */
  bar: { x: number; y: number; place: BarPlacement };
}

export const VOLUME_STEPS = 8;
export const DEFAULT_VOLUME = 4 / VOLUME_STEPS;
export const MASTER_STEPS = 8;
export const DEFAULT_MASTER = 0.7;
