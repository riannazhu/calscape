import { DEFAULT_MASTER, DEFAULT_VOLUME, type ElementId, type ElementState } from './elements';
import { timeForHour, type TimeOfDay } from './scene/palette';
import { SCENES, type SceneId } from './scenes';

type Elements = Partial<Record<ElementId, ElementState>>;

export interface AppState {
  scene: SceneId;
  /** Each scene keeps its own elements, so switching away and back finds them as they were. */
  scenes: Record<SceneId, Elements>;
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
  | { type: 'setScene'; scene: SceneId }
  | { type: 'setMaster'; master: number }
  | { type: 'toggleMasterMute' };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const absent = (): ElementState => ({ present: false, muted: false, volume: DEFAULT_VOLUME });

export function initialState(): AppState {
  return {
    scene: 'glade',
    scenes: Object.fromEntries(
      SCENES.map((s) => [s.id, Object.fromEntries(s.elements.map((e) => [e.id, absent()]))]),
    ) as Record<SceneId, Elements>,
    time: timeForHour(new Date().getHours()),
    master: DEFAULT_MASTER,
    masterMuted: false,
  };
}

/** The current scene's elements. */
export const elementsOf = (s: AppState) => s.scenes[s.scene] as Record<ElementId, ElementState>;

function patch(s: AppState, id: ElementId, p: Partial<ElementState>): AppState {
  const els = elementsOf(s);
  return { ...s, scenes: { ...s.scenes, [s.scene]: { ...els, [id]: { ...els[id], ...p } } } };
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'add':
      return elementsOf(s)[a.id].present ? s : patch(s, a.id, { present: true, muted: false });
    case 'remove':
      return patch(s, a.id, { present: false });
    case 'toggleMute':
      return patch(s, a.id, { muted: !elementsOf(s)[a.id].muted });
    case 'setVolume':
      return patch(s, a.id, { volume: clamp01(a.volume) });
    case 'setTime':
      return { ...s, time: a.time };
    case 'setScene':
      return { ...s, scene: a.scene };
    case 'setMaster':
      return { ...s, master: clamp01(a.master) };
    case 'toggleMasterMute':
      return { ...s, masterMuted: !s.masterMuted };
  }
}
