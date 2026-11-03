// SHEET-53: the About tab (ADR 009 item 3, board V3-About): the species with its lineage, the
// background, the size, the alignment, the languages, and the armor, weapon, tool and skill
// proficiencies. Every name is read from the character's packs; an id a pack no longer has shows
// "Missing: <id>" (SPEC §8.2). The lists are what `compute()` gathered, so a new grant shows at
// once. The alignment is the note `alignment` (SPEC §5.8 has no field for it): written in edit
// mode, saved when the field loses focus, one change with its Undo toast.
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import type { AboutListName } from '../../systems';
import { Part } from '../../theme/Part';
import { noteEntry } from '../changes';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';

/** The key of the note that holds the alignment. */
export const ALIGNMENT_NOTE = 'alignment';

/** The lists below the proficiencies' heading, in the board's order, and the text key of each. */
const PROFICIENCIES = ['armor', 'weapons', 'tools'] as const satisfies readonly AboutListName[];

/** `playingCards` as "Playing cards": the words of a key no entry or text names. */
export function wordsOf(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-13 font-semibold text-muted">{label}</dt>
      <dd className="text-15 text-text">{children}</dd>
    </div>
  );
}

function Alignment() {
  const { t } = useTranslation('about');
  const { character, editing } = useSheet();
  const id = useId();
  const stored = character.notes[ALIGNMENT_NOTE];
  const [draft, setDraft] = useState(stored ?? '');
  const [seen, setSeen] = useState(stored);
  if (seen !== stored) {
    setSeen(stored);
    setDraft(stored ?? '');
  }
  if (!editing) return <Row label={t('alignment')}>{stored ?? t('alignmentNone')}</Row>;
  const save = () => {
    const entry = noteEntry(character, draft, undefined, ALIGNMENT_NOTE);
    if (entry !== undefined) {
      changeCharacter(character.id, entry).catch((error: unknown) => console.error(error));
    }
  };
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <label htmlFor={id} className="text-13 font-semibold text-muted">
        {t('alignment')}
      </label>
      <Part
        as="input"
        id={id}
        name="field"
        type="text"
        className="h-control w-full bg-surface px-3 text-16 text-text"
        value={draft}
        placeholder={t('alignmentNone')}
        onChange={(event: { target: { value: string } }) => setDraft(event.target.value)}
        onBlur={save}
      />
    </div>
  );
}

export function AboutList() {
  const { t } = useTranslation('about');
  const { character, content, computed, system } = useSheet();
  const about = system.about(character, computed);
  const terms = system.terms(character.ruleset);

  /** The name of the entity `id`, or that it is missing. */
  const entityName = (id: string) => {
    const found = content.index.get(id);
    return found.ok ? nameIn(found.entity.name) : t('missing', { id });
  };
  /** The name of the entry of `type` with `key`, else the words for `key` in this locale. */
  const keyName = (type: string, category: string, key: string) => {
    const entry = computed.byKey[type]?.[key];
    return entry === undefined
      ? t(`keys.${category}.${key}`, { defaultValue: wordsOf(key) })
      : nameIn(entry.name);
  };
  const listOf = (name: AboutListName, category: string, type: string) => {
    const keys = about.lists[name];
    return keys.length === 0
      ? t('none')
      : keys.map((key) => keyName(type, category, key)).join(t('separator'));
  };
  const lists = (name: AboutListName) => {
    const { category, type } = system.aboutLists[name];
    return listOf(name, category, type);
  };

  return (
    <Part as="section" name="card" fill="card" className="flex flex-col p-4">
      <h2 className="font-heading text-18 font-bold">{t('title', { name: character.name })}</h2>
      <dl className="flex flex-col divide-y divide-line">
        <Row label={t(`terms.${terms.species}`)}>
          {about.species === undefined ? t('none') : entityName(about.species)}
        </Row>
        {about.lineages.length > 0 && (
          <Row label={t(`terms.${terms.lineage}`)}>
            {about.lineages.map(entityName).join(t('separator'))}
          </Row>
        )}
        <Row label={t('background')}>
          {about.background === undefined ? t('none') : entityName(about.background)}
        </Row>
        {about.size !== undefined && (
          <Row label={t('size')}>{keyName('size', 'size', about.size)}</Row>
        )}
        <Alignment />
        <Row label={t('languages')}>{lists('languages')}</Row>
      </dl>
      <h3 className="mt-3 text-13 font-bold tracking-wide text-muted uppercase">
        {t('proficiencies')}
      </h3>
      <dl className="flex flex-col divide-y divide-line">
        {PROFICIENCIES.map((name) => (
          <Row key={name} label={t(name)}>
            {lists(name)}
          </Row>
        ))}
        <Row label={t('skills')}>{lists('skills')}</Row>
      </dl>
    </Part>
  );
}
