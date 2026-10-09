import { useEffect, useRef, useState, type Dispatch } from 'react';
import { ELEMENT_BY_ID, INVENTORY, MASTER_STEPS } from '../elements';
import { BIRD_IDLE } from '../scene/sprites';
import type { Action, AppState } from '../state';
import { Icon, SpriteArt } from './PixelArt';
import {
  ADD,
  BELL_TILE,
  CLOUD_TILE,
  EXIT_FULLSCREEN,
  FULLSCREEN,
  MOON,
  SPEAKER,
  SPEAKER_MUTED,
  SUN,
  SUNSET,
} from './icons';
import type { TimeOfDay } from '../scene/palette';

const TILE_ART = { rain: CLOUD_TILE, bird: BIRD_IDLE, bell: BELL_TILE };

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
  const nextAbsent = INVENTORY.find((id) => !state.elements[id].present);

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
        {INVENTORY.map((id) => {
          const present = state.elements[id].present;
          const name = ELEMENT_BY_ID[id].name;
          return (
            <button
              key={id}
              className={`tile inventory ${present ? 'present' : ''}`}
              aria-label={present ? `Remove ${name}` : `Add ${name}`}
              aria-pressed={present}
              onClick={() => dispatch({ type: present ? 'remove' : 'add', id })}
            >
              <SpriteArt sprite={TILE_ART[id]} />
            </button>
          );
        })}
        <button
          className="tile inventory add"
          aria-label={nextAbsent ? `Add ${ELEMENT_BY_ID[nextAbsent].name}` : 'All elements added'}
          aria-disabled={!nextAbsent}
          onClick={() => nextAbsent && dispatch({ type: 'add', id: nextAbsent })}
        >
          <Icon rows={ADD} />
        </button>
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
