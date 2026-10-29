import 'fake-indexeddb/auto';
import { changeTo, entryOf } from '@grimoire/engine';
import type { LogEntry } from '@grimoire/schema';
import { fifthEditionCharacterSchema, HP_CURRENT_PATH } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { doneKeyOf, nameOf, ToastHost, ToastView } from '../src/shared/ToastHost';
import {
  changeCharacter,
  currentToast,
  hideToast,
  subscribeToast,
  type Toast,
  undoToast,
} from '../src/shared/undo';

// Board V3-Features draws the toast after Second Wind is used: "Second Wind used", then "Undo".
// Golden A of SPEC §6.7 (12 hit points) is the stored character the store's changes go to.

const a = fifthEditionCharacterSchema.parse(goldenA);
const at = '2026-10-01T18:00:00.000Z';
const by = { role: 'player', name: 'Wren' } as const;

/** An entry of `action` on `subject`, named `label`; its change is the luck resource's. */
function made(action: string, subject: string, label?: LogEntry['label']): LogEntry {
  return {
    id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    at,
    by,
    action,
    subject,
    ...(label !== undefined && { label }),
    changes: [{ path: ['state', 'resources', 'luck'], before: 1, after: 2 }],
  };
}

/** The toast's text, as drawn. */
function textOf(toast: Toast): string {
  return renderToStaticMarkup(<ToastView toast={toast} />).replace(/<[^>]+>/g, ' ');
}

/** Hit points taken from golden A, from 12 to `after`, as change `n`. */
function hurt(n: number, from: number, after: number): LogEntry {
  const character = {
    ...a,
    systemData: {
      ...a.systemData,
      state: { ...a.systemData.state, hp: { current: from, temp: 0 } },
    },
  };
  return entryOf(
    { id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, at, by },
    {
      action: 'applyDamage',
      subject: 'hp',
      changes: [changeTo(character, HP_CURRENT_PATH, after)],
    },
  );
}

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-23-toast-${count}`);
  await database.open();
  await saveCharacter(a, database.characters);
});

afterEach(async () => {
  const toast = currentToast();
  if (toast) hideToast(toast);
  await database.delete();
});

describe('SHEET-23 the undo toast', () => {
  it("names the change as board V3-Features does, with the label's name", () => {
    const toast: Toast = {
      kind: 'changed',
      entry: made('useResource', 'luck', { en: 'Second Wind' }),
    };
    const html = renderToStaticMarkup(<ToastView toast={toast} />);
    expect(html).toContain('data-skin-part="toast"');
    expect(html).toContain('<span class="grow truncate">Second Wind used</span>');
    expect(html).toContain('<button type="button"');
    expect(textOf(toast).trim().split(/\s+/)).toEqual(['Second', 'Wind', 'used', 'Undo']);
  });

  it('names a change with no label by its subject, and an action with no text of its own', () => {
    expect(
      textOf({ kind: 'changed', entry: made('removeCondition', 'tales:condition/weary') }),
    ).toContain('tales:condition/weary ended');
    expect(textOf({ kind: 'changed', entry: made('tradeLuck', 'luck') })).toContain('Change made');
    expect(doneKeyOf('constructor')).toBe('other');
    expect(nameOf(made('useResource', 'luck', { en: 'Luck', ru: 'Удача' }), 'ru')).toBe('Удача');
    expect(nameOf(made('useResource', 'luck', { en: 'Luck' }), 'ru')).toBe('Luck');
  });

  it('gives every action of the core and the fifth-edition module its own text', () => {
    // Each action key an `ActionResult`'s entry carries, read from the actions' source files.
    const actions = [
      'useResource',
      'regainResource',
      'setCondition',
      'removeCondition',
      'setToggle',
      'castSpell',
      'spendSlot',
      'regainSlot',
      'endConcentration',
      'applyDamage',
      'applyHealing',
      'setTempHp',
      'revive',
      'rollDeathSave',
      'stabilize',
      'firstAid',
      'rollInitiative',
      'shortRest',
      'longRest',
      'gainInspiration',
      'spendInspiration',
      'levelUp',
    ];
    expect(Object.keys(en.toast.done)).toEqual([...actions, 'other']);
    for (const action of actions) expect(doneKeyOf(action)).toBe(action);
  });

  it('says a refused undo in its place, with no "Undo"', () => {
    const html = renderToStaticMarkup(
      <ToastView toast={{ kind: 'notUndone', entry: made('useResource', 'luck') }} />,
    );
    expect(html).toContain('Not undone: it changed since');
    expect(html).not.toContain('<button');
  });

  it('shows the toast after a written change, and none after a refused one', async () => {
    let calls = 0;
    const stop = subscribeToast(() => {
      calls += 1;
    });
    const first = hurt(1, 12, 11);
    expect((await changeCharacter(a.id, first, at, database)).ok).toBe(true);
    expect(currentToast()).toEqual({ kind: 'changed', entry: first });
    expect(renderToStaticMarkup(<ToastHost />)).toContain('Damage taken');
    // Made over the stored 11 as if it still held 12: refused, and the toast stays the first's.
    expect((await changeCharacter(a.id, hurt(2, 12, 10), at, database)).ok).toBe(false);
    expect(currentToast()?.entry).toEqual(first);
    const second = hurt(3, 11, 9);
    await changeCharacter(a.id, second, at, database);
    expect(currentToast()?.entry).toEqual(second);
    expect(calls).toBe(2);
    stop();
  });

  it("undoes the toast's own change, and the toast goes", async () => {
    await changeCharacter(a.id, hurt(1, 12, 11), at, database);
    const toast = currentToast() as Toast;
    expect((await undoToast(toast, at, database)).ok).toBe(true);
    expect(currentToast()).toBeUndefined();
    const stored = fifthEditionCharacterSchema.parse(await database.characters.get(a.id));
    expect(stored.systemData.state.hp.current).toBe(12);
    expect(renderToStaticMarkup(<ToastHost />)).toBe(
      '<div role="status" class="pointer-events-none fixed inset-x-4 bottom-[calc(var(--dock-height,0px)+16px)]"></div>',
    );
  });

  it('says so when the undo is refused, and an old toast never hides a newer one', async () => {
    await changeCharacter(a.id, hurt(1, 12, 11), at, database);
    const toast = currentToast() as Toast;
    // Another tab writes over the place: the store holds 7, not 11.
    const stored = fifthEditionCharacterSchema.parse(await database.characters.get(a.id));
    await saveCharacter(
      {
        ...stored,
        systemData: {
          ...stored.systemData,
          state: { ...stored.systemData.state, hp: { current: 7, temp: 0 } },
        },
      },
      database.characters,
    );
    expect(await undoToast(toast, at, database)).toMatchObject({ ok: false, code: 'changed' });
    const refused = currentToast() as Toast;
    expect(refused).toEqual({ kind: 'notUndone', entry: toast.entry });
    hideToast(toast);
    expect(currentToast()).toBe(refused);
    hideToast(refused);
    expect(currentToast()).toBeUndefined();
  });
});
