// SHEET-48: the Features tab (ADR 009 item 2, board V3-Features): features grouped under what gave
// them, the species, each class with its subclass named below, the background and the feats the
// character has of its own. Each feature opens its description in place (SHEET-31) and shows its
// uses, with the label of what comes back and when, and its switches. A use is one change with its
// Undo toast; so is a switch. The groups are the module's (`system.features`); what a pack no
// longer has is not gathered, so it is not here (SPEC §8.2).
import {
  recoveryOf,
  resourceUses,
  setToggle,
  useResource as spendResource,
} from '@grimoire/engine';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Description } from '../../shared/Description';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { SheetNumber } from '../SheetNumber';
import { wordsOf } from './AboutList';

/** More uses than this are shown as the number alone. */
const MOST_CIRCLES = 12;

/** One use: filled while it is left. */
function UseDot({ left }: { left: boolean }) {
  return (
    <span
      aria-hidden
      data-left={left}
      className={`size-4 shrink-0 rounded-full border-2 border-strong ${left ? 'bg-strong' : ''}`}
    />
  );
}

function Recovery({ resource }: { resource: string }) {
  const { t } = useTranslation('features');
  const { computed } = useSheet();
  const parts = recoveryOf(computed, resource);
  if (parts.length === 0) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-1 text-12 text-muted" data-testid="recovery">
      {parts.map((part, at) => {
        const event = wordsOf(part.on).toLowerCase();
        return (
          <span key={part.on} className="inline-flex items-baseline">
            {part.amount === 'all' ? (
              t(`recovery.all.${part.on}`, { defaultValue: t('recovery.allOther', { event }) })
            ) : (
              <SheetNumber
                path={part.path}
                label={t(`recovery.count.${part.on}`, {
                  defaultValue: t('recovery.countOther', { event }),
                })}
                labelAfter
                className="inline-flex items-baseline gap-1"
              />
            )}
            {at < parts.length - 1 && <span aria-hidden>{t('separator')}</span>}
          </span>
        );
      })}
    </p>
  );
}

function Uses({ resource, name }: { resource: string; name?: string }) {
  const { t } = useTranslation('features');
  const { character, computed } = useSheet();
  const uses = resourceUses(character, computed, resource);
  if (uses === undefined) return null;
  const max = Math.max(0, Math.floor(uses.max));
  const spend = () =>
    perform(character, (stamp) =>
      spendResource(character, computed, { key: resource, count: 1 }, stamp),
    ).catch((error: unknown) => console.error(error));
  return (
    <div className="flex flex-col gap-1" data-resource={resource}>
      {name !== undefined && <span className="text-13 font-semibold">{name}</span>}
      <Recovery resource={resource} />
      <div className="flex items-center gap-3">
        {max <= MOST_CIRCLES && (
          <span className="flex flex-wrap gap-1.5">
            {Array.from({ length: max }, (_, at) => (
              // The circles are a fixed row, so their place is their key.
              // biome-ignore lint/suspicious/noArrayIndexKey: the row never changes order.
              <UseDot key={at} left={at < uses.left} />
            ))}
          </span>
        )}
        <span className="grow text-14" data-testid="uses-left">
          {t('left', { left: uses.left, max })}
        </span>
        <Part
          as="button"
          type="button"
          name="button-secondary"
          disabled={uses.left === 0}
          aria-label={t('use', { name: name ?? resource })}
          onClick={spend}
          className="flex h-control items-center px-4 text-14 font-semibold disabled:text-muted"
        >
          {t('useButton')}
        </Part>
      </div>
    </div>
  );
}

function Switch({ part, label, on }: { part: string; label: string; on: boolean }) {
  const { character, computed } = useSheet();
  const id = useId();
  const flip = () =>
    perform(character, (stamp) => setToggle(character, computed, { part, on: !on }, stamp)).catch(
      (error: unknown) => console.error(error),
    );
  return (
    <div className="flex min-h-control items-center gap-3">
      <span id={id} className="grow text-14">
        {label}
      </span>
      <Part
        as="button"
        type="button"
        name="chip"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        onClick={flip}
        className="flex h-7 w-12 shrink-0 items-center bg-track p-0.5 aria-checked:justify-end aria-checked:bg-strong"
      >
        <span className="size-6 rounded-full bg-muted aria-hidden:bg-muted" />
      </Part>
    </div>
  );
}

/** The entity `id` the character has: a pack's, or its own (a character's own entries are not in the packs). */
function hadOf(computed: ReturnType<typeof useSheet>['computed'], id: string) {
  return computed.entities.find(({ entity }) => entity.id === id)?.entity;
}

/** The switch the trackers keep for `part`, when they keep one. */
function stored(toggles: Readonly<Record<string, boolean | undefined>>, part: string) {
  return Object.entries(toggles).find(([each]) => each === part)?.[1];
}

function Row({
  row,
}: {
  row: ReturnType<ReturnType<typeof useSheet>['system']['features']>[number]['rows'][number];
}) {
  const { t } = useTranslation('features');
  const { character, computed } = useSheet();
  const found = hadOf(computed, row.id);
  if (found === undefined) {
    return <p className="px-4 py-2 text-14 text-muted">{t('missing', { id: row.id })}</p>;
  }
  const toggles = character.state.toggles;
  const controls: ReactNode[] = [
    ...row.resources.map((key) => (
      <Uses key={key} resource={key} {...(row.resources.length > 1 && { name: wordsOf(key) })} />
    )),
    ...row.toggles.map((toggle) => (
      <Switch
        key={toggle.part}
        part={toggle.part}
        label={nameIn(toggle.label)}
        on={stored(toggles, toggle.part) ?? toggle.default}
      />
    )),
  ];
  return (
    <li className="flex flex-col" data-feature={row.id}>
      <Description entity={found} />
      {controls.length > 0 && <div className="flex flex-col gap-2 px-4 pb-3">{controls}</div>}
    </li>
  );
}

export function FeatureList() {
  const { t } = useTranslation('features');
  const { character, computed, system } = useSheet();
  const groups = system.features(character, computed);
  const term = system.terms(character.ruleset).species;
  const wordOf = (kind: 'species' | 'class' | 'background') =>
    kind === 'species' ? t(term === 'race' ? 'group.race' : 'group.species') : t(`group.${kind}`);
  const named = (id: string | undefined) => {
    if (id === undefined) return undefined;
    const found = hadOf(computed, id);
    return found === undefined ? t('missing', { id }) : nameIn(found.name);
  };
  const sourceWord = (kind: 'species' | 'class' | 'background') =>
    kind === 'species'
      ? t(term === 'race' ? 'source.race' : 'source.species')
      : t(kind === 'class' ? 'source.class' : 'source.background');
  if (groups.length === 0) return <p className="px-1 py-2 text-15 text-muted">{t('none')}</p>;
  return (
    <>
      {groups.map((group) => {
        const subclass = group.subclass;
        const key = `${group.kind}:${group.source ?? ''}`;
        const title =
          group.kind === 'feats' ? t('group.feats') : (named(group.source) ?? wordOf(group.kind));
        return (
          <Part
            as="section"
            key={key}
            name="card"
            fill="card"
            className="flex flex-col py-3"
            aria-label={title}
          >
            <header className="flex flex-col gap-0.5 px-4 pb-1">
              <h2 className="font-heading text-18 font-bold">{title}</h2>
              {group.kind !== 'feats' && (
                <p className="text-12 text-muted">
                  {group.kind === 'class'
                    ? t('group.classLevel', { level: group.level })
                    : sourceWord(group.kind)}
                </p>
              )}
              {subclass !== undefined && (
                <p className="text-13 text-muted" data-testid="subclass">
                  {'chosen' in subclass
                    ? t('subclass.chosen', { name: named(subclass.chosen) })
                    : t('subclass.chosenAt', { level: subclass.chosenAt })}
                </p>
              )}
            </header>
            <ul className="flex flex-col divide-y divide-line">
              {group.rows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </ul>
          </Part>
        );
      })}
    </>
  );
}
