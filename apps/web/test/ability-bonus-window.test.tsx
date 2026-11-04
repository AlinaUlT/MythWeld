import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contentOf, installBuiltInPacks, installedPacks } from '../src/content/packs';
import '../src/i18n';
import { AbilityBonusWindow } from '../src/pages/create/AbilityBonusWindow';
import { askOf, type Draft, newDraft, type StepProps, statsOf } from '../src/pages/create/draft';
import { MANUAL_FORM_SYSTEMS } from '../src/systems';

// SHEET-29: the Origin step's warning for ability score increases from two editions, drawn closed
// (the popup opens on a tap: the e2e test has it). The 2014 Dwarf (`con +2`) with the 2024 Soldier
// is golden F's mix (ADR 017); the 2024 rules base takes the background's by default.

const { packs } = installBuiltInPacks();
const form = MANUAL_FORM_SYSTEMS.find(({ system }) => system === '5e') ?? failed();

function failed(): never {
  throw new Error('No manual form system.');
}

function drawn(change: Partial<Draft>): string {
  const draft: Draft = {
    ...newDraft(form, packs),
    mix: true,
    packs: ['srd-2014', 'srd-2024'],
    classes: [{ id: 'srd-2024:class/fighter', level: 1 }],
    ...change,
  };
  const { index } = contentOf(draft, packs);
  const stats = statsOf(index, draft);
  const made = form.make(
    askOf(
      draft,
      stats.map(({ key }) => key),
      { id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f', at: '2026-11-04T12:00:00.000Z', unnamed: 'U' },
    ),
    index,
  );
  const props: StepProps = {
    draft,
    change: () => {},
    form,
    installed: installedPacks().packs,
    entities: index.entities,
    computed: made.computed,
    stats,
    bonus: form.abilityBonus(made.character, index),
  };
  return renderToStaticMarkup(<AbilityBonusWindow {...props} />);
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '|')
    .replace(/\|+/g, '|')
    .replaceAll('&#x27;', "'");
const MIX = {
  species: 'srd-2014:species/dwarf',
  background: 'srd-2024:background/soldier',
} as const;

describe('SHEET-29 the warning on the Origin step', () => {
  it('says two sources raise the abilities, what is used, and offers Choose', () => {
    const html = drawn(MIX);
    expect(text(html)).toContain('Two sources raise your abilities');
    expect(text(html)).toContain(
      'The species and the background both give ability bonuses. You can use one, both or neither.',
    );
    // The 2024 rules base takes the background's.
    expect(text(html)).toContain('Using: the background bonuses');
    expect(text(html)).toContain('|Choose|');
    // The popup is closed.
    expect(html).not.toContain('role="dialog"');
  });

  it('says each of the four stored sources, with the rules base’s word for the species', () => {
    expect(text(drawn({ ...MIX, bonusSource: 'species' }))).toContain('Using: the species bonuses');
    expect(text(drawn({ ...MIX, bonusSource: 'both' }))).toContain('Using: both');
    expect(text(drawn({ ...MIX, bonusSource: 'neither' }))).toContain('Using: neither');
    // Whatever is ticked, the warning stays (ADR 017 item 4).
    for (const bonusSource of ['species', 'background', 'both', 'neither'] as const) {
      expect(drawn({ ...MIX, bonusSource })).toContain('data-testid="bonus-conflict"');
    }
    expect(text(drawn({ ...MIX, ruleset: '2014', bonusSource: 'species' }))).toContain(
      'Using: the race bonuses',
    );
  });

  it('draws nothing when one side gives no increases, or nothing is picked', () => {
    expect(drawn({ species: MIX.species })).toBe('');
    expect(drawn({ background: MIX.background })).toBe('');
    expect(drawn({})).toBe('');
  });
});
