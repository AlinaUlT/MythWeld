// SHEET-73: Escape closes the panel on top, not every panel. A panel over a panel (the number
// pad's roll dialog) used to close both, because each panel listened on `window` by itself.
// Here one listener serves a stack: the panel mounted last is the top one, and only it closes.
import { useEffect, useRef } from 'react';

interface Entry {
  close: () => void;
}

const stack: Entry[] = [];

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') stack.at(-1)?.close();
}

/** While `active`, Escape calls `onClose` when this panel is the last one opened. */
export function useEscapeClose(onClose: () => void, active = true): void {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const entry: Entry = { close: () => latest.current() };
    if (stack.length === 0) window.addEventListener('keydown', onKey);
    stack.push(entry);
    return () => {
      stack.splice(stack.indexOf(entry), 1);
      if (stack.length === 0) window.removeEventListener('keydown', onKey);
    };
  }, [active]);
}
