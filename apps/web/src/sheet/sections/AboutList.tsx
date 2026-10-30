// SHEET-53: the About tab (ADR 009 item 3, board V3-About): the species and its size, the
// background, the alignment, the languages and the armor, weapon and tool proficiencies. Names come
// from the character's packs; a key no pack names shows as words made from the key. In edit mode the alignment is
// a text field, written through `changeCharacter` so it can be undone.
import { type ComputedKey, changeTo, entryOf } from '@grimoire/engine';
import type { EntityId, L10n } from '@grimoire/schema';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';

/** Where the alignment is stored. */
export const ALIGNMENT_PATH = ['systemData', 'alignment'];

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** Each proficiency category the tab lists, and the entity type its keys name, if any. */
const LISTED = [
  { category: 'language', type: 'language', row: 'languages' },
  { category: 'armor', type: 'item', row: 'armor' },
  { category: 'weapon', type: 'item', row: 'weapons' },
  { category: 'tool', type: 'toolKind', row: 'tools' },
] as const;

/** The armor and weapon groups the app words itself: they name no entity. */
const GROUPS = ['light', 'medium', 'heavy', 'shield', 'simple', 'martial'] as const;
type Group = (typeof GROUPS)[number];

function isGroup(key: string): key is Group {
  return (GROUPS as readonly string[]).includes(key);
}

/** A key no pack names, as words: `playingCards` is "Playing cards". */
function wordsOf(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Row({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-12 tracking-wide text-muted uppercase">{label}</span>
      <span className="text-15 break-words">{children}</span>
    </div>
  );
}

function AlignmentRow({ label }: { label: string }) {
  const { t } = useTranslation('about');
  const { character, editing } = useSheet();
  const stored = character.systemData.alignment;
  const [draft, setDraft] = useState(stored ?? '');
  useEffect(() => setDraft(stored ?? ''), [stored]);
  if (!editing) return <Row label={label}>{stored ?? t('notSet')}</Row>;

  const write = () => {
    const after = draft.trim();
    if (after === (stored ?? '')) return;
    const entry = entryOf(
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        by: { role: 'player', name: character.player ?? character.name },
      },
      {
        action: 'setAlignment',
        subject: 'alignment',
        changes: [changeTo(character, ALIGNMENT_PATH, after === '' ? undefined : after)],
      },
    );
    void changeCharacter(character.id, entry);
  };

  return (
    <label className="flex flex-col gap-0.5 py-2">
      <span className="text-12 tracking-wide text-muted uppercase">{label}</span>
      <input
        type="text"
        value={draft}
        placeholder={t('alignmentPlaceholder')}
        maxLength={80}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={write}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="min-h-control border-b border-line bg-transparent text-15 outline-none focus-visible:border-strong"
      />
    </label>
  );
}

export function AboutList() {
  const { t } = useTranslation('about');
  const { character, content, computed } = useSheet();
  const { species, background } = character.systemData;

  const entityName = (id: EntityId) => {
    const found = content.index.get(id);
    return found.ok ? nameIn(found.entity.name) : t('missing', { id });
  };
  const keyName = (type: string, key: string) => {
    const entry = computed.byKey[type]?.[key];
    return entry === undefined ? wordsOf(key) : nameIn(entry.name);
  };
  const size: ComputedKey | undefined = computed.keys.size;
  const sizeStep = size?.steps.at(-1);
  const sizeName = size === undefined ? undefined : keyName('size', size.key);

  return (
    <section aria-label={t('title', { name: character.name })} className="px-4 py-2">
      <h2 className="py-1 text-16 font-bold">{t('title', { name: character.name })}</h2>
      <Part name="card" className="flex flex-col divide-y divide-line px-3">
        <Row label={t('species')}>
          {species === undefined ? t('notSet') : entityName(species.id)}
        </Row>
        {sizeName !== undefined && (
          <Row label={t('size')}>
            {sizeStep === undefined || sizeStep.kind === 'override'
              ? sizeName
              : t('sizeFrom', { size: sizeName, source: nameIn(sizeStep.label) })}
          </Row>
        )}
        <Row label={t('background')}>
          {background === undefined ? t('notSet') : entityName(background.id)}
        </Row>
        <AlignmentRow label={t('alignment')} />
        {LISTED.slice(0, 1).map(({ category, type, row }) => (
          <Row key={row} label={t(row)}>
            {listed(
              computed.proficiencies,
              category,
              (key) => keyName(type, key),
              t('none'),
              t('separator'),
            )}
          </Row>
        ))}
      </Part>
      <h3 className="pt-3 pb-1 text-14 font-bold text-muted">{t('proficiencies')}</h3>
      <Part name="card" className="flex flex-col divide-y divide-line px-3">
        {LISTED.slice(1).map(({ category, type, row }) => (
          <Row key={row} label={t(row)}>
            {listed(
              computed.proficiencies,
              category,
              (key) => (isGroup(key) ? t(`groups.${key}`) : keyName(type, key)),
              t('none'),
              t('separator'),
            )}
          </Row>
        ))}
      </Part>
    </section>
  );
}

/** The names of the keys the character's proficiencies give in `category`, none twice. */
function listed(
  proficiencies: readonly { category: string; key: string }[],
  category: string,
  name: (key: string) => string,
  none: string,
  separator: string,
): string {
  const keys = [
    ...new Set(proficiencies.filter((each) => each.category === category).map(({ key }) => key)),
  ];
  return keys.length === 0 ? none : keys.map(name).join(separator);
}
