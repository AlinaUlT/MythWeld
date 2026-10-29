// SHEET-04: a screen draws a button, a card, a chip or another part with this, never with its own
// corners, border or shadow, so the active skin's pick from the part's menu shapes it (ADR 015
// item 7). `fill` names the slot that paints it, when it has one. The look wins over a passed style.
import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { type PartName, partStyle } from './parts';
import { type SlotName, type slotProperties, slotStyle } from './slots';

// A part is filled only by a slot that sets nothing but its background, so the slot and the part
// never set one property twice.
type FillSlot = {
  [S in SlotName]: (typeof slotProperties)[S] extends readonly ['background'] ? S : never;
}[SlotName];

type PartProps<T extends ElementType> = { name: PartName; fill?: FillSlot; as?: T } & Omit<
  ComponentPropsWithoutRef<T>,
  'as' | 'name' | 'fill'
>;

export function Part<T extends ElementType = 'div'>({
  name,
  fill,
  as,
  style,
  ...rest
}: PartProps<T>) {
  const Element: ElementType = as ?? 'div';
  return (
    <Element
      {...rest}
      data-skin-part={name}
      data-skin-slot={fill}
      style={{ ...style, ...(fill ? slotStyle(fill) : {}), ...partStyle(name) }}
    />
  );
}
