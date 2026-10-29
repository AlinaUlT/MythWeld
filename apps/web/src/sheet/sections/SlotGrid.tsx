// SHEET-46: the spell slot grid (board V3-Spells, ADR 010 item 9): a card with one column for each
// spell level the character has slots of, and one for its pact magic slots, circles two to a row.
// A filled circle is a slot left, an empty one a slot spent. Slots are trackers, so play mode
// changes them (BRIEF Part 1): a tap on a filled circle spends one slot, a tap on an empty one gives
// one back, each change through `changeCharacter` so "Undo" follows it (SHEET-23). Casting with a
// slot is SHEET-47's.

import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import type { SlotColumn } from '../../systems';
import { Part } from '../../theme/Part';
import { type SheetValue, useSheet } from '../SheetContext';
import { playerStamp } from '../stamp';

/** One slot of `column` spent, or given back: the stored character changes, or nothing does. */
async function tap(sheet: SheetValue, column: SlotColumn, spend: boolean): Promise<void> {
  const { character, content, system } = sheet;
  const made = system.changeSlot(character, content.index, column, spend, playerStamp(character));
  // A refusal changes nothing: the grid keeps showing what is stored.
  if (!made.ok) return;
  const saved = await changeCharacter(character.id, made.entry);
  if (!saved.ok) console.error(saved.message);
}

export function SlotGrid() {
  const { t } = useTranslation('spells');
  const sheet = useSheet();
  const columns = sheet.system.slotGrid(sheet.character, sheet.computed);
  if (columns.length === 0) return null;
  return (
    <Part
      name="card"
      role="group"
      aria-label={t('grid.label')}
      className="flex flex-wrap justify-around gap-x-5 gap-y-3 bg-surface px-3.5 py-3"
    >
      {columns.map((column) => {
        const name = t(column.kind === 'pact' ? 'grid.pact' : 'grid.level', {
          level: column.level,
        });
        return (
          <div
            key={`${column.kind}:${column.level}`}
            className="flex flex-col items-center gap-1.5"
          >
            <span className="text-12 font-bold">
              <span aria-hidden>{name}</span>
              <span className="sr-only">
                {t('grid.summary', { name, left: column.left, max: column.max })}
              </span>
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {Array.from({ length: column.max }, (_, at) => {
                const left = at < column.left;
                return (
                  <button
                    // A column's circles are alike, so their place is their key.
                    // biome-ignore lint/suspicious/noArrayIndexKey: the circles never change order.
                    key={at}
                    type="button"
                    aria-label={t(left ? 'grid.spend' : 'grid.regain', { name })}
                    data-slot-level={column.level}
                    data-slot-kind={column.kind}
                    data-slot-left={left}
                    onClick={() => void tap(sheet, column, left)}
                    className={`relative size-5 rounded-pill border-2 border-strong after:absolute after:-inset-[3px] after:content-[''] ${
                      left ? 'bg-strong' : 'bg-transparent'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </Part>
  );
}
