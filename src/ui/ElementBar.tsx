import { useEffect, useRef, type Dispatch } from 'react';
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
  afterRemove(): void;
  dispatch: Dispatch<Action>;
}

const TRANSFORM = {
  above: 'translate(-50%, -100%)',
  below: 'translate(-50%, 0)',
  right: 'translate(0, 0)',
};

/** Compact controls anchored to a scene object. */
export function ElementBar({
  def,
  state,
  scale,
  autoFocus,
  onPointerEnter,
  onPointerLeave,
  onPin,
  afterRemove,
  dispatch,
}: Props) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) firstRef.current?.focus();
  }, [autoFocus]);

  const level = Math.round(state.volume * VOLUME_STEPS);
  const setLevel = (n: number) =>
    dispatch({ type: 'setVolume', id: def.id, volume: Math.min(VOLUME_STEPS, Math.max(0, n)) / VOLUME_STEPS });

  return (
    <div
      className={`element-bar panel ${state.muted ? 'muted' : ''}`}
      role="group"
      aria-label={`${def.name} controls`}
      style={{ left: def.bar.x * scale, top: def.bar.y * scale, transform: TRANSFORM[def.bar.place] }}
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
