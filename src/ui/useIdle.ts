import { useEffect, useRef, useState } from 'react';

const IDLE_MS = 5000;

/**
 * True after five seconds without pointer or keyboard activity, unless a
 * control bar is open, a pointer is pressed, or a control has keyboard focus.
 */
export function useIdle(busy: boolean) {
  const [idle, setIdle] = useState(false);
  const last = useRef(performance.now());
  const pressed = useRef(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const wake = () => {
      last.current = performance.now();
      setIdle(false);
    };
    const down = () => {
      pressed.current = true;
      wake();
    };
    const up = () => {
      pressed.current = false;
      wake();
    };
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', wake);
    window.addEventListener('wheel', wake);
    window.addEventListener('focusin', wake);

    const tick = window.setInterval(() => {
      const active = document.activeElement;
      const keyboardFocus = active instanceof HTMLElement && active.matches(':focus-visible');
      const holding = busyRef.current || pressed.current || keyboardFocus;
      if (holding) last.current = performance.now();
      else if (performance.now() - last.current > IDLE_MS) setIdle(true);
    }, 500);

    return () => {
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('wheel', wake);
      window.removeEventListener('focusin', wake);
      window.clearInterval(tick);
    };
  }, []);

  return idle;
}
