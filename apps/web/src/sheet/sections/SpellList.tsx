// SHEET-46: the Spells tab (board V3-Spells, ADR 010 items 9 and 10, ADR 009 item 4): each casting
// class's stat, save DC and attack; the slot grid, one column per spell level with circles two per
// row, full for a slot still there; and the spell list, each line with its edition and, for a spell
// a feature grants, its source and its own uses ("1/LR, no spell slot"). What goes in the grid and
// the list is the module's (`system.slots`, `system.spells`); this file only draws it.
import { STAT_TYPE } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';
import { SheetNumber } from '../SheetNumber';

/** A name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

function CastingChips() {
  const { t } = useTranslation('spells');
  const { character, computed, system } = useSheet();
  const casting = system.casting(character, computed);
  if (casting.length === 0) return null;
  const chip = 'flex h-8.5 items-center gap-1 rounded-full bg-soft px-3 text-13 text-muted';
  return (
    <div className="flex flex-col gap-2">
      {casting.map(({ source, ability, dc, attack }) => {
        const stat = computed.byKey[STAT_TYPE]?.[ability];
        const abbr = stat?.type === STAT_TYPE ? nameIn(stat.abbr) : ability;
        return (
          <div key={source} className="flex flex-wrap gap-2">
            <span className="flex h-8.5 items-center rounded-full bg-strong px-3 text-13 font-semibold text-on-strong">
              {abbr}
            </span>
            <SheetNumber
              path={dc}
              label={t('casting.dc')}
              className={chip}
              valueClassName="font-semibold text-text"
            />
            <SheetNumber
              path={attack}
              label={t('casting.attack')}
              format="signed"
              rolls
              className={chip}
              valueClassName="font-semibold text-text"
            />
          </div>
        );
      })}
    </div>
  );
}

function SlotGrid() {
  const { t } = useTranslation('spells');
  const { character, computed, system } = useSheet();
  const columns = system.slots(character, computed);
  if (columns.length === 0) return null;
  return (
    <Part
      as="ul"
      name="card"
      aria-label={t('slots.title')}
      className="flex justify-around gap-2 border border-line bg-surface px-3.5 py-3"
    >
      {columns.map(({ key, level, pact, max, left }) => (
        <li
          key={key}
          aria-label={t('slots.group', {
            name: pact ? t('slots.pact', { level }) : t('slots.level', { level }),
            left,
            max,
          })}
          className="flex flex-col items-center gap-1.5"
        >
          <span className="text-12 font-bold">
            {pact ? t('slots.pact', { level }) : t('slots.level', { level })}
          </span>
          <div className="grid grid-cols-[repeat(2,theme(spacing.5))] gap-1.5" aria-hidden>
            {Array.from({ length: max }, (_, at) => (
              <span
                // The circles of a column are interchangeable: the position is the identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed count of equal circles
                key={at}
                data-full={at < left}
                className="size-5 rounded-full border-2 border-text data-[full=true]:bg-text"
              />
            ))}
          </div>
        </li>
      ))}
    </Part>
  );
}

function SpellLines() {
  const { t } = useTranslation('spells');
  const { character, computed, content, system } = useSheet();
  const rows = system.spells(character, computed, content.index);
  if (rows.length === 0) return <p className="text-14 text-muted">{t('list.empty')}</p>;
  return (
    <ul className="flex flex-col" aria-label={t('list.title')}>
      {rows.map((row) => {
        const { id, from, source, sourceName, grant, name, level, ruleset, otherRuleset, uses } =
          row;
        const detail: string[] = [];
        if (level !== undefined) {
          detail.push(level === 0 ? t('list.cantrip') : t('list.level', { level }));
        }
        if (from === 'grant') {
          detail.push(
            t('list.from', { name: sourceName === undefined ? source : nameIn(sourceName) }),
          );
        }
        if (from === 'class' && !row.prepared) detail.push(t('list.notPrepared'));
        if (uses !== undefined) {
          const recovery = uses.recovery.map((event) =>
            t(`list.recovery.${event}`, { defaultValue: event }),
          );
          detail.push(
            t('list.noSlot'),
            t('list.uses', { left: uses.left, max: uses.max, recovery: recovery.join('/') }),
          );
        }
        return (
          <li
            key={`${id}|${from}|${grant ?? source}`}
            className="flex min-h-14 items-center gap-2.5 border-b border-line py-1.5"
          >
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <b className="truncate">
                {name === undefined ? t('list.missing', { id }) : nameIn(name)}
              </b>
              <span className="text-12 text-muted">{detail.join(t('list.separator'))}</span>
              {otherRuleset && (
                <span className="text-12 text-warn-text">
                  {t('list.otherRuleset', { ruleset })}
                </span>
              )}
            </span>
            {ruleset !== undefined && (
              <Part
                as="span"
                name="chip"
                className="flex h-5 shrink-0 items-center border border-muted px-1.5 text-12 font-semibold text-muted"
              >
                {ruleset}
              </Part>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SpellList() {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <CastingChips />
      <SlotGrid />
      <SpellLines />
    </div>
  );
}
