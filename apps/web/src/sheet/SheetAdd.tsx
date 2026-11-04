// SHEET-52: the sheet's "+" (board V3-Add), in edit mode only, 16 px above the dock at the left, as
// the dice button is at the right. It opens "Add to the sheet". Play mode locks the structure
// (SPEC §7.2), so no button shows there.
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Slot } from '../theme/Slot';
import { useSheet } from './SheetContext';

export function SheetAdd({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation('sheet');
  const { editing } = useSheet();
  if (!editing) return null;
  return (
    <Slot
      as="button"
      type="button"
      name="button"
      aria-label={t('add')}
      onClick={onAdd}
      className="absolute bottom-[calc(var(--dock-height,0px)+16px)] left-4 flex size-14 items-center justify-center rounded-full text-on-strong shadow-float"
    >
      <Plus aria-hidden className="size-7" />
    </Slot>
  );
}
