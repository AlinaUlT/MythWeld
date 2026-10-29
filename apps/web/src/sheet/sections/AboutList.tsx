// SHEET-53: the About tab (ADR 009 item 3, board V3-About): the origin, the alignment, the
// languages and the training the character has. Every name is read from `Computed` through the
// system's `about`; a key no pack has an entry for is written as its key, never dropped. Its i18n
// namespace is `about`.
import type { L10n } from '@grimoire/schema';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { AppAbout } from '../../systems';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';

type AboutT = TFunction<'about'>;
type Listed = 'armor' | 'weapons' | 'tools' | 'languages' | 'skills';

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** `playingCards` as "Playing cards": a key no pack names is still readable. */
function spelled(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLocaleLowerCase();
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}

function proficiencyNames(about: AppAbout, list: Listed, t: AboutT): string[] {
  return about[list].map(({ key, entity }) =>
    entity === undefined
      ? t(`groups.${list}.${key}`, { defaultValue: spelled(key) })
      : nameIn(entity.name),
  );
}

function Row({ label, names, t }: { label: string; names: readonly string[]; t: AboutT }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2 last:border-b-0">
      <dt className="text-12 font-semibold tracking-wide text-muted">{label}</dt>
      <dd className="m-0 text-14">{names.length === 0 ? t('none') : names.join(t('separator'))}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Part as="section" name="card" className="mx-4 mt-3 px-3 py-2">
      <h3 className="m-0 font-heading text-16 font-bold">{title}</h3>
      <dl className="m-0">{children}</dl>
    </Part>
  );
}

export function AboutList() {
  const { t } = useTranslation('about');
  const { character, computed, system } = useSheet();
  const about = system.about(character, computed);
  const names = (list: Listed) => proficiencyNames(about, list, t);
  return (
    <>
      <Card title={t('title', { name: character.name })}>
        <Row label={t('species')} names={about.species.map(({ name }) => nameIn(name))} t={t} />
        <Row
          label={t('background')}
          names={about.background.map(({ name }) => nameIn(name))}
          t={t}
        />
        <Row
          label={t('alignment')}
          names={about.alignment === undefined ? [] : [about.alignment]}
          t={t}
        />
        <Row label={t('languages')} names={names('languages')} t={t} />
      </Card>
      <Card title={t('proficiencies')}>
        <Row label={t('armor')} names={names('armor')} t={t} />
        <Row label={t('weapons')} names={names('weapons')} t={t} />
        <Row label={t('tools')} names={names('tools')} t={t} />
        <Row label={t('skills')} names={names('skills')} t={t} />
      </Card>
    </>
  );
}
