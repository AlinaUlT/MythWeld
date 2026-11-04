import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { RestPanel } from '../src/sheet/panels/RestPanel';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-45: the Rest panel's first view on golden B (SPEC §6.7: a human fighter 1 of the 2024 rules,
// one d10, 12 hit points, Second Wind with 2 uses: one back on a short rest, all on a long rest).
// The frames, the spending of a hit die and Confirm are the e2e test's; the lists themselves are
// the module's (`sheet-rest.test.ts`).

void i18n;
const packs = installBuiltInPacks().packs;

function drawn(state: {
  current: number;
  temp?: number;
  hitDiceSpent?: Record<string, number>;
  secondWindSpent?: number;
}): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...goldenB,
    state: { ...goldenB.state, resources: { secondWind: state.secondWindSpent ?? 0 } },
    systemData: {
      ...goldenB.systemData,
      state: {
        ...goldenB.systemData.state,
        hp: { current: state.current, temp: state.temp ?? 0 },
        hitDiceSpent: state.hitDiceSpent ?? {},
      },
    },
  });
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
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <RestPanel onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('SHEET-45 the Rest panel', () => {
  it('has the board’s two cards, each with the button that opens its frame', () => {
    const html = drawn({ current: 3, secondWindSpent: 2 });
    expect(text(html)).toContain('|Rest|');
    expect(html).toContain('data-rest="short"');
    expect(html).toContain('data-rest="long"');
    expect(text(html)).toContain('|Short rest|');
    expect(text(html)).toContain('|Long rest|');
  });

  it('lists what a short rest gives with no hit die: a use of Second Wind, and the dice to spend', () => {
    const html = text(drawn({ current: 3, secondWindSpent: 2 }));
    expect(html).toContain('Second Wind: 1 use back, 1 of 2 left');
    expect(html).toContain('Spend hit dice to heal');
  });

  it('lists what a long rest gives: hit points, the temporary ones ending, hit dice, every use', () => {
    const html = text(drawn({ current: 3, temp: 5, hitDiceSpent: { d10: 1 }, secondWindSpent: 2 }));
    expect(html).toContain('Hit points back to 12');
    expect(html).toContain('5 temporary hit points end');
    expect(html).toContain('Hit dice back: 1 × d10');
    expect(html).toContain('Second Wind: 2 uses back, 2 of 2 left');
  });

  it('says so when nothing comes back, and when no hit die is left to spend', () => {
    const html = text(drawn({ current: 12, hitDiceSpent: { d10: 1 } }));
    expect(html).toContain('Nothing comes back without a hit die.');
    expect(html).not.toContain('Spend hit dice to heal');
  });
});
