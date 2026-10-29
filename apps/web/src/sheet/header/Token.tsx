// SHEET-30: the header's portrait token, the character's first letter in a round frame (board
// V3-Sheet) until SHEET-56 makes it from the person's image. Its i18n namespace is `token`.
import { Slot } from '../../theme/Slot';
import { useSheet } from '../SheetContext';

export function Token() {
  const { character } = useSheet();
  return (
    <Slot as="span" name="token-frame-ring" className="mr-2.5 ml-0.5 flex shrink-0 rounded-full">
      <Slot
        as="span"
        name="portrait"
        className="flex size-10.5 items-center justify-center rounded-full font-heading text-21 font-bold text-on-strong"
      >
        {Array.from(character.name)[0]?.toLocaleUpperCase()}
      </Slot>
    </Slot>
  );
}
