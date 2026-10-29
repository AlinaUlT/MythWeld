// SHEET-05: a screen moves an element with this, never with its own transition or animation, so
// the active skin sets the preset's speed and size, and reduced motion stops it (ADR 015 items 8
// and 9). A loop pauses while it is off screen or the app is in the background.
import { type ComponentPropsWithoutRef, type ElementType, useEffect, useRef } from 'react';
import { type MotionName, motionPresets, motionStyle, watchOnScreen } from './motions';

type MotionProps<T extends ElementType> = { preset: MotionName; as?: T } & Omit<
  ComponentPropsWithoutRef<T>,
  'as' | 'preset'
>;

export function Motion<T extends ElementType = 'div'>({
  preset,
  as,
  style,
  ...rest
}: MotionProps<T>) {
  const Element: ElementType = as ?? 'div';
  const ref = useRef<Element>(null);
  const loop = motionPresets[preset].kind === 'loop';
  useEffect(() => (loop && ref.current ? watchOnScreen(ref.current) : undefined), [loop]);
  return (
    <Element
      {...rest}
      ref={ref}
      data-skin-motion={preset}
      style={{ ...style, ...motionStyle(preset) }}
    />
  );
}
