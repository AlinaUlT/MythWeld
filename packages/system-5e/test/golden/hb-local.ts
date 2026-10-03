import type { z } from 'zod';
import type { fifthEditionPackSchema } from '../../src/index.ts';

// ENG-22: golden E's pack (SPEC §6.7), the owner's homebrew of SPEC Appendix Д, word for word, with
// the two fields a pack has gained since: its system (ADR 004 item 3) and the module's version
// (ENG-39). A stat of its own, a skill on it, a skill on INT, and a feat that gives the second and
// raises INT.

const source = { pack: 'hb-local' };

/** SPEC Appendix Д's pack, `hb-local`. */
export const hbLocal = {
  id: 'hb-local',
  version: '1.0.0',
  schemaVersion: 2,
  system: '5e',
  systemSchemaVersion: 5,
  title: { ru: 'Мой хоумбрю', en: 'My homebrew' },
  ruleset: 'any',
  license: { name: 'Personal', redistributable: false },
  entities: [
    {
      id: 'hb-local:ability/san',
      type: 'ability',
      key: 'san',
      ruleset: 'any',
      name: { ru: 'Рассудок', en: 'Sanity' },
      abbr: { ru: 'РАС', en: 'SAN' },
      order: 7,
      hasSave: true,
      source,
    },
    {
      id: 'hb-local:skill/occultism',
      type: 'skill',
      key: 'occultism',
      ruleset: 'any',
      name: { ru: 'Оккультизм', en: 'Occultism' },
      ability: 'int',
      source,
    },
    {
      id: 'hb-local:skill/composure',
      type: 'skill',
      key: 'composure',
      ruleset: 'any',
      name: { ru: 'Самообладание', en: 'Composure' },
      ability: 'san',
      source,
    },
    {
      id: 'hb-local:feat/arcane-scholar',
      type: 'feat',
      ruleset: 'any',
      category: 'general',
      name: { ru: 'Знаток тайного', en: 'Arcane Scholar' },
      text: {
        ru: 'Вы получаете владение навыком Оккультизм. Ваш Интеллект увеличивается на 1, но не выше 20.',
        en: 'You gain proficiency in Occultism. Increase your Intelligence by 1, to a maximum of 20.',
      },
      source,
      grants: [{ id: 'occult-prof', kind: 'proficiency', category: 'skill', fixed: ['occultism'] }],
      effects: [
        {
          id: 'int-plus-1',
          target: 'abilities.int.score',
          op: 'add',
          value: 1,
          label: { ru: 'Знаток тайного', en: 'Arcane Scholar' },
        },
      ],
    },
  ],
} satisfies z.input<typeof fifthEditionPackSchema>;
