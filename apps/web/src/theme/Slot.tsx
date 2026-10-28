// SHEET-03: a screen draws a slot with this, never with its own background or frame, so the active
// skin decides what fills it (ADR 015 item 6). The slot's look wins over a style the screen passes.
import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { type SlotName, slotStyle } from './slots';

type SlotProps<T extends ElementType> = { name: SlotName; as?: T } & Omit<
  ComponentPropsWithoutRef<T>,
  'as' | 'name'
>;

export function Slot<T extends ElementType = 'div'>({ name, as, style, ...rest }: SlotProps<T>) {
  const Element: ElementType = as ?? 'div';
  return <Element {...rest} data-skin-slot={name} style={{ ...style, ...slotStyle(name) }} />;
}
