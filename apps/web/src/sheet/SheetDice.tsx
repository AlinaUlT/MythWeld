// SHEET-30: the sheet's dice button (board V3-Sheet), 16 px above the dock, and the half-screen
// panel it opens (ADR 009 item 1, board V3-SheetDice): SHEET-38's `DiceSheet`, rolled by this
// character, whose computed paths a formula reads (own fields only).
import { Dices } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DiceSheet } from '../shared/DicePanel';
import { Slot } from '../theme/Slot';
import { useSheet } from './SheetContext';

export function SheetDice() {
  const { t } = useTranslation('sheet');
  const { character, computed } = useSheet();
  const [open, setOpen] = useState(false);
  const read = (path: string) =>
    Object.hasOwn(computed.values, path) ? computed.values[path] : undefined;
  return (
    <>
      <Slot
        as="button"
        type="button"
        name="button"
        aria-label={t('dice')}
        onClick={() => setOpen(true)}
        className="absolute right-4 bottom-[calc(var(--dock-height,0px)+16px)] flex size-14 items-center justify-center rounded-full text-on-strong shadow-float"
      >
        <Dices aria-hidden className="size-7" />
      </Slot>
      <DiceSheet
        open={open}
        onClose={() => setOpen(false)}
        roller={{ actorId: character.id, name: character.name }}
        read={read}
      />
    </>
  );
}
