import { useEffect, useRef, useState, type Dispatch } from 'react';
import { MASTER_STEPS } from '../elements';
import type { TimeOfDay } from '../scene/palette';
import { SCENE_BY_ID } from '../scenes';
import { elementsOf, type Action, type AppState } from '../state';
import { Icon, SpriteArt } from './PixelArt';
import { EXIT_FULLSCREEN, FULLSCREEN, MOON, SPEAKER, SPEAKER_MUTED, SUN, SUNSET } from './icons';

const TIMES: { time: TimeOfDay; label: string; icon: string[] }[] = [
  { time: 'day', label: 'Day', icon: SUN },
  { time: 'sunset', label: 'Sunset', icon: SUNSET },
  { time: 'night', label: 'Night', icon: MOON },
];

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function BottomControls({ state, dispatch }: Props) {
  const scene = SCENE_BY_ID[state.scene];
  const elements = elementsOf(state);
  return (
    <>
      <div className="chrome bottom-left panel" role="group" aria-label="Time of day">
        {TIMES.map(({ time, label, icon }) => (
          <button
            key={time}
            className={`tile ${state.time === time ? 'active' : ''}`}
            aria-label={label}
            aria-pressed={state.time === time}
            onClick={() => dispatch({ type: 'setTime', time })}
          >
            <Icon rows={icon} />
          </button>
        ))}
      </div>

      <div className="chrome bottom-center panel" role="group" aria-label="Inventory">
        {scene.inventory[state.time].map((id) => {
          const present = elements[id].present;
          const name = scene.elements.find((e) => e.id === id)!.name;
          const art = scene.tiles[id]!;
          return (
            <button
              key={id}
              className={`tile inventory ${present ? 'present' : ''}`}
              aria-label={present ? `Remove ${name}` : `Add ${name}`}
              aria-pressed={present}
              onClick={() => dispatch({ type: present ? 'remove' : 'add', id })}
            >
              <SpriteArt sprite={art.sprite} palette={art.palette} />
            </button>
          );
        })}
      </div>

      <div className="chrome bottom-right">
        <MasterVolume
          value={state.master}
          muted={state.masterMuted}
          onChange={(master) => dispatch({ type: 'setMaster', master })}
          onToggleMute={() => dispatch({ type: 'toggleMasterMute' })}
        />
        <FullscreenTile />
      </div>
    </>
  );
}

interface MasterVolumeProps {
  value: number;
  muted: boolean;
  onChange(v: number): void;
  onToggleMute(): void;
}

function MasterVolume({ value, muted, onChange, onToggleMute }: MasterVolumeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromPointer = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 1 / MASTER_STEPS;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? value + step
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? value - step
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? 1
              : null;
    if (next === null) return;
    e.preventDefault();
    onChange(Math.min(1, Math.max(0, next)));
  };

  return (
    <div className={`panel master ${muted ? 'muted' : ''}`}>
      <button
        className="master-mute"
        aria-label={muted ? 'Unmute all sound' : 'Mute all sound'}
        aria-pressed={muted}
        onClick={onToggleMute}
      >
        <Icon rows={muted ? SPEAKER_MUTED : SPEAKER} />
      </button>
      <div
        ref={ref}
        className="blocks master-blocks"
        role="slider"
        tabIndex={0}
        aria-label="Master volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)}%${muted ? ', muted' : ''}`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {Array.from({ length: MASTER_STEPS }, (_, i) => (
          <span key={i} className={`block ${(i + 0.5) / MASTER_STEPS <= value ? 'on' : ''}`} />
        ))}
      </div>
    </div>
  );
}

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

function FullscreenTile() {
  const doc = document as FullscreenDoc;
  const current = () => Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
  const [full, setFull] = useState(current);

  useEffect(() => {
    const sync = () => setFull(current());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  });

  const toggle = () => {
    const el = document.documentElement as FullscreenEl;
    if (current()) void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    else void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  };

  return (
    <button
      className="tile"
      aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}
      aria-pressed={full}
      onClick={toggle}
    >
      <Icon rows={full ? EXIT_FULLSCREEN : FULLSCREEN} />
    </button>
  );
}
