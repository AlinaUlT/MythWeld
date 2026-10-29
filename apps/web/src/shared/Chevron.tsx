// SHEET-31: the control that opens and closes (ADR 013 item 7): a chevron in a circle, an outline
// in the text colour, pointing down when closed and up when open, turning with the `turn` preset.
// The creation steps and every other piece that opens and closes draw this one.
import { CircleChevronDown } from 'lucide-react';
import { Motion } from '../theme/Motion';

export function Chevron({ open }: { open: boolean }) {
  return (
    <Motion
      preset="turn"
      as="span"
      aria-hidden
      data-open={open}
      className="flex shrink-0"
      style={{ transform: open ? 'rotate(180deg)' : 'none' }}
    >
      <CircleChevronDown className="size-6" strokeWidth={1.6} />
    </Motion>
  );
}
