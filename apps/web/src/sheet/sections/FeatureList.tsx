// SHEET-30: the Features tab: features by source, filled by SHEET-48. Its own file and its own
// i18n namespace (`features`) keep that row apart from its wave.
// SHEET-48: the features grouped under what gave them: the species, each class (its subclass under
// the name), the background, the feats (ADR 009 item 2, board V3-Features). A feature opens its
// description in place; one with uses shows them, what comes back on each recovery event
// (`recoveryOf`) and a "Use" button; a toggled effect shows its switch. Both are trackers, so they
// change in play mode too.
import {
  type ResourceRecovery,
  recoveryOf,
  resourceUses,
  setToggle,
  useResource as spendUse,
} from '@grimoire/engine';
import type { EntityPartId } from '@grimoire/schema';
import type { FeatureSource, FeatureSubline } from '@grimoire/system-5e';
import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { textIn } from '../../content/descriptions';
import { en } from '../../i18n/namespaces';
import { Description } from '../../shared/Description';
import { Part } from '../../theme/Part';
import { act } from '../act';
import { type SheetValue, useSheet } from '../SheetContext';

type FeaturesT = TFunction<'features'>;
type SourceEntry = FeatureSource['entries'][number];
type RecoveryEvent = keyof typeof en.features.recovery.when;

/** The most uses drawn as dots; a resource with more shows its count alone. */
export const MAX_DOTS = 10;

/** The entity's part of a grant's place, `<entityId>#<grantId>`: the id of what gave it. */
function giverOf(place: string): string {
  const at = place.indexOf('#');
  return at === -1 ? place : place.slice(0, at);
}

/** "1 back on a short rest, all on a long rest": what comes back on each event, in order. */
export function recoveryLabel(recovery: readonly ResourceRecovery[], t: FeaturesT): string {
  return recovery
    .map(({ on, amount }) => {
      const event: RecoveryEvent = Object.hasOwn(en.features.recovery.when, on)
        ? (on as RecoveryEvent)
        : 'other';
      const when = t(`recovery.when.${event}`, { event: on });
      return amount === 'all'
        ? t('recovery.all', { when })
        : t('recovery.amount', { amount, when });
    })
    .join(t('recovery.separator'));
}

function Uses({ resourceKey, sheet }: { resourceKey: string; sheet: SheetValue }) {
  const { t } = useTranslation('features');
  const { character, computed } = sheet;
  const uses = resourceUses(character, computed, resourceKey);
  if (uses === undefined) return null;
  const max = Math.floor(uses.max);
  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <span className="flex items-center gap-3">
        <span className="grow text-13 text-muted">
          {recoveryLabel(recoveryOf(computed, resourceKey), t)}
        </span>
        {max <= MAX_DOTS && (
          <span
            role="img"
            aria-label={t('uses.summary', { left: uses.left, max })}
            className="flex gap-1.5"
          >
            {Array.from({ length: max }, (_, at) => (
              <span
                // The dots of one resource are fixed, so their place is their key.
                // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
                key={at}
                data-filled={at < uses.left}
                className="size-4 rounded-full border-2 border-strong data-[filled=true]:bg-strong"
              />
            ))}
          </span>
        )}
      </span>
      <span className="flex items-center gap-3">
        <span className="grow text-14">{t('uses.left', { left: uses.left, max })}</span>
        <Part
          as="button"
          type="button"
          name="button"
          fill="button"
          disabled={uses.left === 0}
          onClick={() =>
            act(character, (stamp) =>
              spendUse(character, computed, { key: resourceKey, count: 1 }, stamp),
            )
          }
          className="flex h-control items-center px-6 text-15 font-bold text-on-strong disabled:opacity-40"
        >
          {t('uses.use')}
        </Part>
      </span>
    </div>
  );
}

function Switches({ entity, sheet }: { entity: SourceEntry; sheet: SheetValue }) {
  const { t, i18n } = useTranslation('features');
  const { character, computed } = sheet;
  return (entity.effects ?? []).map(({ id, toggle }) => {
    if (toggle === undefined) return null;
    const part = `${entity.id}#${id}` as EntityPartId;
    const on = character.state.toggles[part] ?? toggle.default;
    return (
      <button
        key={part}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() =>
          act(character, (stamp) => setToggle(character, computed, { part, on: !on }, stamp))
        }
        className="flex min-h-control items-center gap-3 px-4 text-left text-14"
      >
        <span className="grow">{textIn(toggle.label, i18n.language)}</span>
        <Part
          as="span"
          name="chip"
          className={`flex h-7 items-center px-3 text-13 font-semibold ${on ? 'bg-strong text-on-strong' : 'bg-soft text-muted'}`}
        >
          {t(on ? 'switch.on' : 'switch.off')}
        </Part>
      </button>
    );
  });
}

function Entry({ entity, sheet }: { entity: SourceEntry; sheet: SheetValue }) {
  const keys = [
    ...new Set(
      sheet.computed.resources
        .filter(({ from }) => giverOf(from) === entity.id)
        .map(({ key }) => key),
    ),
  ];
  return (
    <div className="flex flex-col border-t border-line">
      <Description entity={entity} />
      {keys.map((key) => (
        <Uses key={key} resourceKey={key} sheet={sheet} />
      ))}
      <Switches entity={entity} sheet={sheet} />
    </div>
  );
}

function sublineText(subline: FeatureSubline, t: FeaturesT, language: string): string {
  if (subline.kind === 'lineage' || subline.kind === 'subclass') {
    return t(`subline.${subline.kind}`, { name: textIn(subline.entity.name, language) });
  }
  return t(`subline.${subline.kind}`);
}

function Source({ source, sheet }: { source: FeatureSource; sheet: SheetValue }) {
  const { t, i18n } = useTranslation('features');
  const titleId = useId();
  const { entity, subline, level, entries, missing } = source;
  const name = entity === undefined ? t('feats') : textIn(entity.name, i18n.language);
  return (
    <Part
      as="section"
      name="card"
      fill="card"
      aria-labelledby={titleId}
      data-source={source.kind}
      className="flex shrink-0 flex-col overflow-hidden"
    >
      <div className="flex flex-col gap-0.5 bg-soft px-4 py-2.5">
        <span className="flex items-baseline gap-2">
          <h2 id={titleId} className="font-heading text-21 leading-tight font-bold">
            {name}
          </h2>
          {source.kind !== 'feats' && (
            <span className="text-12 tracking-wide text-muted uppercase">
              {t(`kind.${source.kind}`, { level })}
            </span>
          )}
        </span>
        {subline !== undefined && (
          <span className="text-13 text-muted">{sublineText(subline, t, i18n.language)}</span>
        )}
      </div>
      {entries.map((each) => (
        <Entry key={each.id} entity={each} sheet={sheet} />
      ))}
      {missing.map((id) => (
        <p
          key={id}
          role="alert"
          className="border-t border-line bg-warn-bg px-4 py-2 text-14 text-warn-text"
        >
          {t('missing', { id })}
        </p>
      ))}
      {entries.length === 0 && missing.length === 0 && (
        <p className="border-t border-line px-4 py-3 text-14 text-muted">{t('noEntries')}</p>
      )}
    </Part>
  );
}

export function FeatureList() {
  const sheet = useSheet();
  const sources = sheet.system.featureSources(sheet.character, sheet.computed);
  return (
    <>
      {sources.map((source) => (
        <Source key={source.entity?.id ?? source.kind} source={source} sheet={sheet} />
      ))}
    </>
  );
}
