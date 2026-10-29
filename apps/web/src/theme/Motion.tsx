// SHEET-05: a screen draws an animation with this, never with its own keyframes or speed, so the
// active skin sets the preset's colours, speed and size (ADR 015 item 8). Off screen it pauses.
import { type ComponentPropsWithoutRef, type ElementType, useCallback } from 'react';
import { type MotionPreset, pauseOffScreen } from './motion';

type MotionProps<T extends ElementType> = { preset: MotionPreset; as?: T } & Omit<
  ComponentPropsWithoutRef<T>,
  'as' | 'preset'
>;

export function Motion<T extends ElementType = 'span'>({ preset, as, ...rest }: MotionProps<T>) {
  const Element: ElementType = as ?? 'span';
  const watch = useCallback((element: Element | null) => {
    if (element) return pauseOffScreen(element);
  }, []);
  return <Element {...rest} ref={watch} data-motion={preset} />;
}
