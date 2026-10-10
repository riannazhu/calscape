import {
  DEFAULT_MASTER,
  DEFAULT_VOLUME,
  ELEMENTS,
  type ElementId,
  type ElementState,
} from './elements';
import { timeForHour, type TimeOfDay } from './scene/palette';

export interface AppState {
  elements: Record<ElementId, ElementState>;
  time: TimeOfDay;
  /** 0..1, multiplies every element gain. */
  master: number;
  /** Silences the whole scene while keeping `master`. */
  masterMuted: boolean;
}

export type Action =
  | { type: 'add'; id: ElementId }
  | { type: 'remove'; id: ElementId }
  | { type: 'toggleMute'; id: ElementId }
  | { type: 'setVolume'; id: ElementId; volume: number }
  | { type: 'setTime'; time: TimeOfDay }
  | { type: 'setMaster'; master: number }
  | { type: 'toggleMasterMute' };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const absent = (): ElementState => ({ present: false, muted: false, volume: DEFAULT_VOLUME });

export function initialState(): AppState {
  return {
    elements: Object.fromEntries(ELEMENTS.map((e) => [e.id, absent()])) as Record<ElementId, ElementState>,
    time: timeForHour(new Date().getHours()),
    master: DEFAULT_MASTER,
    masterMuted: false,
  };
}

function patch(s: AppState, id: ElementId, p: Partial<ElementState>): AppState {
  return { ...s, elements: { ...s.elements, [id]: { ...s.elements[id], ...p } } };
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'add':
      return s.elements[a.id].present ? s : patch(s, a.id, { present: true, muted: false });
    case 'remove':
      return patch(s, a.id, { present: false });
    case 'toggleMute':
      return patch(s, a.id, { muted: !s.elements[a.id].muted });
    case 'setVolume':
      return patch(s, a.id, { volume: clamp01(a.volume) });
    case 'setTime':
      return { ...s, time: a.time };
    case 'setMaster':
      return { ...s, master: clamp01(a.master) };
    case 'toggleMasterMute':
      return { ...s, masterMuted: !s.masterMuted };
  }
}
