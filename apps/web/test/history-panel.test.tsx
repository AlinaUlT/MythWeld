import { applyEntry, changeTo, compute, entryOf } from '@grimoire/engine';
import type { LogEntry } from '@grimoire/schema';
import { fifthEditionCharacterSchema, HP_CURRENT_PATH, HP_TEMP_PATH } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { HistoryList } from '../src/sheet/panels/HistoryPanel';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-59: the list of the last changes, drawn on golden B (SPEC §6.7: 12 hit points). Three
// changes are made one after another: damage 12 → 9, damage 9 → 7, and 5 temporary hit points. The
// first one's place holds 7 now, not the 9 it wrote, so its undo is off; the other two can be undone.

const packs = installBuiltInPacks().packs;
const base: AppCharacter = fifthEditionCharacterSchema.parse(goldenB);

const stamp = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  at: new Date(Date.UTC(2026, 9, 1, 18, n)).toISOString(),
  by: { role: 'player' as const, name: 'Wren' },
});

function made(character: AppCharacter, n: number, path: string[], after: number): LogEntry {
  return entryOf(stamp(n), {
    action: 'applyDamage',
    subject: 'hp',
    changes: [changeTo(character, path, after)],
  });
}

/** The character after each change, and the three entries. */
function played() {
  const one = made(base, 1, [...HP_CURRENT_PATH], 9);
  const afterOne = applyEntry(base, one);
  if (!afterOne.ok) throw new Error(afterOne.message);
  const two = made(afterOne.character, 2, [...HP_CURRENT_PATH], 7);
  const afterTwo = applyEntry(afterOne.character, two);
  if (!afterTwo.ok) throw new Error(afterTwo.message);
  const three = made(afterTwo.character, 3, [...HP_TEMP_PATH], 5);
  const afterThree = applyEntry(afterTwo.character, three);
  if (!afterThree.ok) throw new Error(afterThree.message);
  return { character: afterThree.character, entries: [three, two, one] };
}

function drawn(history: Parameters<typeof HistoryList>[0]['history'], character = base): string {
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const sheet: SheetValue = {
    character,
    content,
    computed: compute(character, content.index, system.module),
    system,
    editing: false,
    roll: () => {},
    breakdown: () => {},
    cast: () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <HistoryList history={history} onUndo={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const rowOf = (html: string, n: number) =>
  html.match(new RegExp(`<li[^>]*data-change="${stamp(n).id}"[\\s\\S]*?</li>`))?.[0] ?? '';

describe('SHEET-59 the change history', () => {
  const { character, entries } = played();
  const html = drawn({ entries, refused: [] }, character);

  it('lists the changes newest first, each with its Undo', () => {
    const order = [...html.matchAll(/data-change="([^"]+)"/g)].map(([, id]) => id);
    expect(order).toEqual([stamp(3).id, stamp(2).id, stamp(1).id]);
    expect(text(html)).toContain('|Your last 3 changes, newest first.|');
    expect(html.match(/>Undo</g)).toHaveLength(3);
    expect(rowOf(html, 3)).toContain('aria-label="Undo: ');
  });

  it('turns off the Undo of a change a later one wrote over, and says why', () => {
    // Change 1 wrote 9; change 2 wrote 7 over it.
    expect(rowOf(html, 1)).toMatch(/disabled=""[^>]*aria-label|aria-label[^>]*disabled=""/);
    expect(text(rowOf(html, 1))).toContain(
      'A later change touched the same place. Undo that one first.',
    );
    // The later changes can be undone.
    for (const n of [2, 3]) {
      expect(rowOf(html, n), `change ${n}`).not.toContain('disabled=""');
      expect(rowOf(html, n)).not.toContain('A later change');
    }
  });

  it('says so when there is nothing to list, and when the history is still loading', () => {
    expect(text(drawn({ entries: [], refused: [] }))).toContain('|No change has been made yet.|');
    expect(text(drawn(undefined))).toContain('|Loading the changes…|');
  });

  it('names a change the app cannot read, with no Undo', () => {
    const odd = drawn({
      entries: [],
      refused: [{ id: 'x', code: 'newer', message: 'newer' }],
    });
    expect(text(odd)).toContain('A change this app cannot read.');
    expect(odd).not.toContain('>Undo<');
  });
});
