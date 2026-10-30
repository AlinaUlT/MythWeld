// SHEET-48: the Features tab (ADR 009 item 2, board V3-Features): a card for each thing that gave
// the character features, under its name: the species, each class (its subclass on the line
// below), the background, then the feats. Each feature opens its description in place (SHEET-31)
// and holds its uses with "Use", the label of what brings them back, and its switches. Which
// feature stands under which card, and every number, comes from the system's `featureGroups`
// and the engine's trackers (`FeatureRow`); this file draws them.
import type { FeatureGroup, FeatureRow, FeatureUses } from '@grimoire/system-5e';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { textIn } from '../../content/descriptions';
import { Description } from '../../shared/Description';
import { Part } from '../../theme/Part';
import { spendUse, switchFeature } from '../featureActions';
import { useSheet } from '../SheetContext';

/** The most use circles drawn; more uses are told in words only. */
const MAX_DOTS = 10;

function Dots({ uses }: { uses: FeatureUses }) {
  if (uses.max > MAX_DOTS) return null;
  return (
    <span aria-hidden className="flex gap-1.5">
      {Array.from({ length: Math.max(0, Math.floor(uses.max)) }, (_, at) => (
        <span
          // The circles are interchangeable; the place is the only difference.
          // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
          key={at}
          className={`size-4 rounded-full border-2 border-strong ${at < uses.left ? 'bg-strong' : ''}`}
        />
      ))}
    </span>
  );
}

function recoveryLabel(uses: FeatureUses, t: TFunction<'features'>) {
  return uses.recovery
    .map((each) => {
      const event = t(`recovery.events.${each.on}`, { defaultValue: each.on });
      return each.amount === 'all'
        ? t('recovery.all', { event })
        : t('recovery.count', { count: each.amount, event });
    })
    .join(t('recovery.separator'));
}

function UsesBar({ uses }: { uses: FeatureUses }) {
  const { t, i18n } = useTranslation('features');
  const { character, computed } = useSheet();
  const name = textIn(uses.label, i18n.language);
  return (
    <div className="flex items-center gap-3 px-4 pb-3">
      <Dots uses={uses} />
      <span
        role="status"
        aria-label={t('uses.label', { name, left: uses.left, max: uses.max })}
        className="grow text-14"
      >
        <b data-path={`resources.${uses.key}.max`}>{uses.left}</b>{' '}
        {t('uses.left', { max: uses.max })}
      </span>
      <Part
        as="button"
        type="button"
        name="button"
        fill="button"
        disabled={uses.left <= 0}
        onClick={() => void spendUse(character, computed, uses.key)}
        className="flex h-11 items-center px-6 font-bold text-on-strong disabled:opacity-40"
      >
        {t('uses.use')}
      </Part>
    </div>
  );
}

function SwitchRow({ part, label, on }: FeatureRow['switches'][number]) {
  const { i18n } = useTranslation('features');
  const { character, computed } = useSheet();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => void switchFeature(character, computed, part, !on)}
      className="flex min-h-control w-full items-center gap-3 px-4 pb-3 text-left text-14"
    >
      <span className="grow">{textIn(label, i18n.language)}</span>
      <Part
        as="span"
        name="chip"
        aria-hidden
        className={`flex h-7 w-12 shrink-0 items-center p-0.5 ${on ? 'justify-end bg-strong' : 'bg-track'}`}
      >
        <span className={`size-6 rounded-full ${on ? 'bg-on-strong' : 'bg-muted'}`} />
      </Part>
    </button>
  );
}

function Feature({ row }: { row: FeatureRow }) {
  const { t } = useTranslation('features');
  const line = row.uses
    .map((uses) => recoveryLabel(uses, t))
    .concat(row.alwaysOn ? [t('alwaysOn')] : [])
    .join(t('recovery.separator'));
  return (
    <div className="border-t border-line">
      <Description entity={row.entity}>{line === '' ? undefined : line}</Description>
      {row.uses.map((uses) => (
        <UsesBar key={uses.key} uses={uses} />
      ))}
      {row.switches.map((each) => (
        <SwitchRow key={each.part} {...each} />
      ))}
    </div>
  );
}

function Group({ group }: { group: FeatureGroup }) {
  const { t, i18n } = useTranslation('features');
  const name = group.source === undefined ? t('feats') : textIn(group.source.name, i18n.language);
  const detail =
    group.detail === undefined || (group.kind !== 'class' && group.kind !== 'species')
      ? undefined
      : t(`detail.${group.kind}`, { name: textIn(group.detail.name, i18n.language) });
  return (
    <Part as="section" name="panel" className="shrink-0 overflow-hidden bg-surface">
      <div className="flex flex-col gap-0.5 bg-soft px-4 py-2.5">
        <span className="flex items-baseline gap-2">
          <h2 className="font-heading text-21 leading-tight font-bold">{name}</h2>
          <span className="text-12 tracking-wide text-muted uppercase">
            {t(`kind.${group.kind}`, { level: group.level })}
          </span>
        </span>
        {detail !== undefined && <span className="text-13 text-muted">{detail}</span>}
      </div>
      {group.features.map((row) => (
        <Feature key={row.entity.id} row={row} />
      ))}
    </Part>
  );
}

export function FeatureList() {
  const { t } = useTranslation('features');
  const { character, computed, system } = useSheet();
  const groups = system.featureGroups(character, computed);
  if (groups.length === 0) return <p className="px-1 text-15 text-muted">{t('empty')}</p>;
  return (
    <>
      {groups.map((group) => (
        <Group key={`${group.kind}:${group.source?.id ?? ''}`} group={group} />
      ))}
    </>
  );
}
