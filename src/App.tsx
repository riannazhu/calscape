import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AudioEngine } from './audio/engine';
import { ELEMENTS, ELEMENT_BY_ID, type ElementId } from './elements';
import { H, W } from './scene/backdrop';
import { PALETTES } from './scene/palette';
import { World } from './scene/world';
import { initialState, reducer } from './state';
import { BottomControls } from './ui/BottomControls';
import { ElementBar } from './ui/ElementBar';
import { useIdle } from './ui/useIdle';
import { useStageScale } from './ui/useStageScale';

const HOVER_GRACE_MS = 450;
const FRAME_MS = 50;
/** Interface pixels are sized as if the scene were 320 pixels wide, whatever its resolution. */
const UI_PIXEL = W / 320;

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const engineRef = useRef<AudioEngine>(null);
  engineRef.current ??= new AudioEngine();
  const engine = engineRef.current;
  const worldRef = useRef<World>(null);
  worldRef.current ??= new World();
  const world = worldRef.current;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteTargets = useRef<Partial<Record<ElementId, HTMLButtonElement | null>>>({});
  const { scale, fit } = useStageScale(W, H);
  const dpr = window.devicePixelRatio || 1;
  const uiUnit = Math.max(1, Math.round(fit * UI_PIXEL * dpr)) / dpr;

  const [hovered, setHovered] = useState<ElementId | null>(null);
  const [lingering, setLingering] = useState<ElementId | null>(null);
  const [pinned, setPinned] = useState<ElementId | null>(null);
  const [focused, setFocused] = useState<ElementId | null>(null);
  const [focusBarOnOpen, setFocusBarOnOpen] = useState(false);
  const graceTimer = useRef(0);
  const overBar = useRef(false);

  const openId = pinned ?? lingering;
  const highlight = hovered ?? openId ?? focused;
  const idle = useIdle(openId !== null);

  // Audio must only start from an explicit user gesture.
  useEffect(() => {
    const unlock = () => engine.unlock();
    const events = ['pointerdown', 'keydown', 'click', 'touchend'] as const;
    events.forEach((e) => window.addEventListener(e, unlock, { capture: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock, { capture: true }));
  }, [engine]);

  useEffect(() => engine.sync(state.elements), [engine, state.elements]);
  useEffect(
    () => engine.setMaster(state.master, state.masterMuted),
    [engine, state.master, state.masterMuted],
  );
  useEffect(() => {
    engine.onChirp = (ms) => world.birdSing(ms);
  }, [engine, world]);

  useEffect(() => {
    world.time = state.time;
    world.highlight = highlight;
    for (const e of ELEMENTS) world.present[e.id] = state.elements[e.id].present;
  }, [world, state.time, state.elements, highlight]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => (world.reducedMotion = mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [world]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      world.render(ctx, now);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world]);

  // Removing an element closes its controls.
  useEffect(() => {
    const gone = (id: ElementId | null) => id !== null && !state.elements[id].present;
    if (gone(pinned)) setPinned(null);
    if (gone(lingering)) setLingering(null);
    if (gone(hovered)) setHovered(null);
  }, [state.elements, pinned, lingering, hovered]);

  const close = useCallback(() => {
    window.clearTimeout(graceTimer.current);
    setPinned(null);
    setLingering(null);
  }, []);

  const startGrace = useCallback(() => {
    window.clearTimeout(graceTimer.current);
    graceTimer.current = window.setTimeout(() => {
      if (!overBar.current) setLingering(null);
    }, HOVER_GRACE_MS);
  }, []);

  const toLogical = (e: React.PointerEvent | React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const;
  };

  const onScenePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const hit = world.hitTest(...toLogical(e));
    if (hit === hovered) return;
    setHovered(hit);
    if (hit) {
      window.clearTimeout(graceTimer.current);
      setLingering(hit);
    } else {
      startGrace();
    }
  };

  const onScenePointerLeave = () => {
    if (hovered) startGrace();
    setHovered(null);
  };

  const onSceneClick = (e: React.MouseEvent) => {
    const hit = world.hitTest(...toLogical(e));
    if (hit) {
      setPinned(hit);
      setLingering(hit);
    } else {
      close();
    }
  };

  // Clicking anywhere outside the open bar or a sprite closes the controls.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (t.closest('.element-bar') || t === canvasRef.current) return;
      close();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !openId) return;
      const inBar = document.activeElement?.closest('.element-bar');
      close();
      if (inBar) spriteTargets.current[openId]?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, close]);

  const openFromKeyboard = (id: ElementId) => {
    setPinned(id);
    setLingering(id);
    setFocusBarOnOpen(true);
  };

  const bar = openId ? ELEMENT_BY_ID[openId] : null;
  const pal = PALETTES[state.time];
  const cursor = hovered ? 'pointer' : 'default';

  return (
    <div
      className={`app ${idle ? 'idle' : ''} ${state.time}`}
      style={{
        ['--u' as string]: `${uiUnit}px`,
        ['--scene-top' as string]: pal.sky0,
        ['--scene-bottom' as string]: pal.lawnMid,
      }}
    >
      <h1 className="sr-only">CalScape: Glade facing Doe Library</h1>
      <div className="stage" style={{ width: W * scale, height: H * scale }}>
        <canvas
          ref={canvasRef}
          className="scene"
          width={W}
          height={H}
          style={{ cursor }}
          onPointerMove={onScenePointerMove}
          onPointerLeave={onScenePointerLeave}
          onClick={onSceneClick}
          aria-hidden="true"
        />

        {ELEMENTS.filter((e) => state.elements[e.id].present).map((e) => {
          const b = world.bounds(e.id);
          const s = state.elements[e.id];
          const status = s.muted ? 'muted' : `volume ${Math.round(s.volume * 100)}%`;
          return (
            <button
              key={e.id}
              ref={(el) => {
                spriteTargets.current[e.id] = el;
              }}
              className="sprite-target"
              style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}
              aria-label={`${e.name}, ${status}. Press Enter for controls.`}
              aria-expanded={openId === e.id}
              onFocus={() => setFocused(e.id)}
              onBlur={() => setFocused((f) => (f === e.id ? null : f))}
              onClick={() => openFromKeyboard(e.id)}
            />
          );
        })}

        {bar && (
          <ElementBar
            key={bar.id}
            def={bar}
            state={state.elements[bar.id]}
            scale={scale}
            autoFocus={focusBarOnOpen}
            onPointerEnter={() => {
              overBar.current = true;
              window.clearTimeout(graceTimer.current);
            }}
            onPointerLeave={() => {
              overBar.current = false;
              if (!pinned) startGrace();
            }}
            onPin={() => setPinned(bar.id)}
            onPreview={(volume) => engine.preview(bar.id, volume, state.elements[bar.id].muted)}
            dispatch={dispatch}
            afterRemove={() => {
              overBar.current = false;
              close();
            }}
          />
        )}
      </div>

      <div className="chrome panel corner top-left">CalScape</div>
      <div className="chrome panel corner top-right">Glade</div>

      <BottomControls state={state} dispatch={dispatch} />
    </div>
  );
}
