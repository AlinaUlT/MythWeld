// SHEET-25: a card swiped left shows its actions (board V3-Characters). The card follows the
// finger between closed and the tray's width, then settles open past half the tray, else closed.
import { type PointerEvent, type SyntheticEvent, useRef, useState } from 'react';

/** How far a finger moves before the swipe decides it is sideways or a scroll, in px. */
export const SWIPE_SLOP = 8;

/** Where the card sits as the finger moves `dx` from `start`: between `-tray` and 0. */
export function swipeOffset(start: number, dx: number, tray: number): number {
  return Math.min(0, Math.max(-tray, start + dx));
}

/** Whether a card let go at `offset` settles open. */
export function settlesOpen(offset: number, tray: number): boolean {
  return offset <= -tray / 2;
}

interface Touch {
  x: number;
  y: number;
  sideways?: boolean;
}

/**
 * The swipe of one card whose tray is `tray` px wide: the offset to draw, and the handlers for the
 * card. A sideways move never counts as a tap, so the card's link does not open after it.
 */
export function useSwipe(tray: number, open: boolean, setOpen: (open: boolean) => void) {
  const [drag, setDrag] = useState<number>();
  const touch = useRef<Touch>(undefined);
  const swiped = useRef(false);
  const start = open ? -tray : 0;

  const end = () => {
    if (touch.current?.sideways && drag !== undefined) setOpen(settlesOpen(drag, tray));
    touch.current = undefined;
    setDrag(undefined);
  };

  return {
    offset: drag ?? start,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        touch.current = { x: event.clientX, y: event.clientY };
        swiped.current = false;
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const current = touch.current;
        if (current === undefined) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (current.sideways === undefined) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_SLOP) return;
          current.sideways = Math.abs(dx) > Math.abs(dy);
          if (current.sideways) {
            swiped.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }
        if (current.sideways) setDrag(swipeOffset(start, dx, tray));
      },
      onPointerUp: end,
      onPointerCancel: end,
      // A swipe is not a tap; a tap on an open card closes it.
      onClickCapture: (event: SyntheticEvent) => {
        if (swiped.current || open) {
          event.preventDefault();
          event.stopPropagation();
          if (!swiped.current) setOpen(false);
        }
        swiped.current = false;
      },
    },
  };
}
