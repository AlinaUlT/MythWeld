import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS, usePress } from '../src/sheet/SheetNumber';

// SHEET-78: `usePress` keeps a flag that says a long press already opened the breakdown, so the
// click that ends a touch press does not also tap. A mouse's context menu sends no click after it,
// so it must not leave the flag set. The hook's own refs live in one render, so the handlers are
// taken from a render and called as the browser would.

type Handlers = ReturnType<typeof usePress>;

function handlersOf(onTap: () => void, onLongPress: () => void): Handlers {
  let handlers: Handlers | undefined;
  function Probe() {
    handlers = usePress(onTap, onLongPress);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  if (handlers === undefined) throw new Error('no handlers');
  return handlers;
}

const down = (button: number) => ({ button }) as never;
const menu = () => ({ preventDefault: () => undefined });

describe('SHEET-78 usePress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens on every right-click on the same control, not only the first', () => {
    const tap = vi.fn();
    const open = vi.fn();
    const press = handlersOf(tap, open);
    for (const n of [1, 2, 3]) {
      press.onPointerDown(down(2));
      press.onContextMenu(menu());
      expect(open).toHaveBeenCalledTimes(n);
    }
    expect(tap).not.toHaveBeenCalled();
  });

  it('taps after a right-click: the left click is a tap again', () => {
    const tap = vi.fn();
    const press = handlersOf(tap, vi.fn());
    press.onPointerDown(down(2));
    press.onContextMenu(menu());
    press.onPointerDown(down(0));
    press.onPointerUp();
    press.onClick();
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it('a touch long press opens once; the click that ends it is not a tap', () => {
    const tap = vi.fn();
    const open = vi.fn();
    const press = handlersOf(tap, open);
    press.onPointerDown(down(0));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(open).toHaveBeenCalledTimes(1);
    // The browser's own context menu follows the long press: it must not open a second time.
    press.onContextMenu(menu());
    expect(open).toHaveBeenCalledTimes(1);
    press.onPointerUp();
    press.onClick();
    expect(tap).not.toHaveBeenCalled();
    // The next short tap taps.
    press.onPointerDown(down(0));
    press.onPointerUp();
    press.onClick();
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it('a context menu that comes before the timer on touch opens once and swallows the click', () => {
    const tap = vi.fn();
    const open = vi.fn();
    const press = handlersOf(tap, open);
    press.onPointerDown({ button: 0 } as never);
    press.onContextMenu(menu());
    vi.advanceTimersByTime(LONG_PRESS_MS);
    press.onPointerUp();
    press.onClick();
    expect(open).toHaveBeenCalledTimes(1);
    expect(tap).not.toHaveBeenCalled();
  });
});
