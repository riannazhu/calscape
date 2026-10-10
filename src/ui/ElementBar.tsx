import { useEffect, useLayoutEffect, useRef, useState, type Dispatch } from 'react';
import { VOLUME_STEPS, type ElementDef, type ElementState } from '../elements';
import type { Action } from '../state';
import { Icon } from './PixelArt';
import { MINUS, PLUS, REMOVE, SPEAKER, SPEAKER_MUTED } from './icons';

interface Props {
  def: ElementDef;
  state: ElementState;
  scale: number;
  autoFocus: boolean;
  onPointerEnter(): void;
  onPointerLeave(): void;
  onPin(): void;
  /** Plays a short sample at the newly chosen volume. */
  onPreview(volume: number): void;
  afterRemove(): void;
  dispatch: Dispatch<Action>;
}

const TRANSFORM = {
  above: 'translate(-50%, -100%)',
  below: 'translate(-50%, 0)',
  right: 'translate(0, -50%)',
};

/** Gap kept between a bar and the window edge, in CSS pixels. */
const EDGE = 8;

/** How far to move a span [a, b] (already offset by `by`) so it fits inside [0, max]. */
function fit(a: number, b: number, by: number, max: number) {
  const a0 = a - by;
  const b0 = b - by;
  if (a0 < EDGE) return EDGE - a0;
  if (b0 > max - EDGE) return Math.max(EDGE - a0, max - EDGE - b0);
  return 0;
}

/** Compact controls anchored to a scene object, nudged to stay inside the visible scene. */
export function ElementBar({
  def,
  state,
  scale,
  autoFocus,
  onPointerEnter,
  onPointerLeave,
  onPin,
  onPreview,
  afterRemove,
  dispatch,
}: Props) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [nudge, setNudge] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = fit(r.left, r.right, nudge.x, window.innerWidth);
    const y = fit(r.top, r.bottom, nudge.y, window.innerHeight);
    if (x !== nudge.x || y !== nudge.y) setNudge({ x, y });
  });
  useEffect(() => {
    if (autoFocus) firstRef.current?.focus();
  }, [autoFocus]);

  const level = Math.round(state.volume * VOLUME_STEPS);
  const setLevel = (n: number) => {
    const next = Math.min(VOLUME_STEPS, Math.max(0, n));
    if (next === level) return;
    dispatch({ type: 'setVolume', id: def.id, volume: next / VOLUME_STEPS });
    onPreview(next / VOLUME_STEPS);
  };

  return (
    <div
      ref={barRef}
      className={`element-bar panel ${state.muted ? 'muted' : ''}`}
      role="group"
      aria-label={`${def.name} controls`}
      style={{
        left: def.bar.x * scale,
        top: def.bar.y * scale,
        transform: `translate(${nudge.x}px, ${nudge.y}px) ${TRANSFORM[def.bar.place]}`,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPin}
    >
      <button
        ref={firstRef}
        className="tile small"
        aria-label={state.muted ? `Unmute ${def.name}` : `Mute ${def.name}`}
        aria-pressed={state.muted}
        onClick={() => dispatch({ type: 'toggleMute', id: def.id })}
      >
        <Icon rows={state.muted ? SPEAKER_MUTED : SPEAKER} />
      </button>
      <button
        className="tile small"
        aria-label={`Lower ${def.name} volume`}
        aria-disabled={level <= 0}
        onClick={() => setLevel(level - 1)}
      >
        <Icon rows={MINUS} />
      </button>
      <div
        className="blocks"
        role="img"
        aria-label={`${def.name} volume ${level} of ${VOLUME_STEPS}${state.muted ? ', muted' : ''}`}
      >
        {Array.from({ length: VOLUME_STEPS }, (_, i) => (
          <span
            key={i}
            className={`block ${i < level ? 'on' : ''}`}
            onClick={() => setLevel(i + 1)}
          />
        ))}
      </div>
      <button
        className="tile small"
        aria-label={`Raise ${def.name} volume`}
        aria-disabled={level >= VOLUME_STEPS}
        onClick={() => setLevel(level + 1)}
      >
        <Icon rows={PLUS} />
      </button>
      <button
        className="tile small remove"
        aria-label={`Remove ${def.name}`}
        onClick={() => {
          dispatch({ type: 'remove', id: def.id });
          afterRemove();
        }}
      >
        <Icon rows={REMOVE} />
      </button>
    </div>
  );
}
