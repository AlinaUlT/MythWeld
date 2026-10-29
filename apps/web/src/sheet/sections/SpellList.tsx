// SHEET-46: the Spells tab (board V3-Spells, ADR 009 item 4, ADR 010 items 9 and 10): the
// spellcasting at a glance, the slot grid, then the spells: those the character's classes know and
// have prepared, and those a feature gives, each marked with its source and, when the grant gives it
// uses of its own, "no spell slot" and the limit, "1/LR". A spell of the other edition says so
// (ADR 005 item 3.5); a spell no pack has shows "Missing: <id>" and never fails (SPEC §8.2).
// Opening a spell to cast it is SHEET-47's.
import type { TFunction } from 'i18next';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import type { SpellListEntry } from '../../systems';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { SlotGrid } from './SlotGrid';
import { SpellcastingGlance } from './SpellcastingGlance';

type SpellsT = TFunction<'spells'>;

const EVENTS = ['short', 'long', 'dawn', 'turn', 'manual', 'revive'] as const;
type Event = (typeof EVENTS)[number];

const isEvent = (on: string): on is Event => (EVENTS as readonly string[]).includes(on);

/** The rows by spell level, cantrips first and spells no pack has last; the stored order within. */
function sorted(rows: readonly SpellListEntry[]): SpellListEntry[] {
  const levelOf = ({ spell }: SpellListEntry) => spell?.level ?? Number.POSITIVE_INFINITY;
  return rows
    .map((row, at) => ({ row, at }))
    .sort((a, b) => levelOf(a.row) - levelOf(b.row) || a.at - b.at)
    .map(({ row }) => row);
}

/** "1/LR": the uses a grant gives and when they come back; with some spent, how many are left. */
function limitOf({ uses }: Required<Pick<SpellListEntry, 'uses'>>, t: SpellsT): string {
  const recovery = uses.recovery
    .map(({ on }) => (isEvent(on) ? t(`recovery.${on}`) : on))
    .join(t('recovery.separator'));
  const limit = recovery === '' ? String(uses.max) : t('limit', { max: uses.max, recovery });
  return uses.spent > 0 ? `${limit}${t('separator')}${t('left', { left: uses.left })}` : limit;
}

/** The parts of a row's second line, the last of them in bold when `strong`. */
interface Part2 {
  text: string;
  strong?: boolean;
  warn?: boolean;
}

function detailsOf(entry: SpellListEntry, t: SpellsT, own: string): Part2[] {
  const { spell, from, sourceName, alwaysPrepared, unprepared, uses, otherRuleset } = entry;
  const parts: Part2[] = [];
  if (spell !== undefined) {
    parts.push({ text: spell.level === 0 ? t('cantrip') : t('level', { level: spell.level }) });
  }
  if (from.kind === 'grant') {
    const name = sourceName === undefined ? from.source : nameIn(sourceName);
    parts.push({ text: t('from', { name }) });
  }
  if (alwaysPrepared === true) parts.push({ text: t('alwaysPrepared') });
  if (unprepared) parts.push({ text: t('unprepared') });
  if (uses !== undefined) {
    parts.push({ text: t('noSlot'), strong: true }, { text: limitOf({ uses }, t), strong: true });
  }
  if (otherRuleset !== undefined) {
    parts.push({ text: t('otherRuleset', { ruleset: otherRuleset, own }), warn: true });
  }
  return parts;
}

function SpellRow({ entry }: { entry: SpellListEntry }) {
  const { t } = useTranslation('spells');
  const { character } = useSheet();
  const { spell, id, otherRuleset } = entry;
  const details = detailsOf(entry, t, character.ruleset);
  const edition = spell === undefined ? undefined : spell.ruleset;
  return (
    <li className="flex min-h-12.5 items-center gap-2.5 border-b border-line py-1.5">
      <span className="flex min-w-0 grow flex-col gap-0.5">
        {spell === undefined ? (
          <b className="truncate font-bold text-muted">{t('missing', { id })}</b>
        ) : (
          <b className="truncate font-bold">{nameIn(spell.name)}</b>
        )}
        <span className="text-12 text-muted">
          {details.map(({ text, strong, warn }, at) => (
            // The parts of a line never change order.
            // biome-ignore lint/suspicious/noArrayIndexKey: a line's parts are fixed.
            <Fragment key={at}>
              {at > 0 && t('separator')}
              <span className={`${strong ? 'font-bold' : ''} ${warn ? 'text-warn-text' : ''}`}>
                {text}
              </span>
            </Fragment>
          ))}
        </span>
      </span>
      {spell !== undefined && (
        <Part
          as="span"
          name="chip"
          className={`flex h-5 shrink-0 items-center px-2 text-12 font-semibold ${
            otherRuleset === undefined ? 'bg-soft text-muted' : 'bg-warn-bg text-warn-text'
          }`}
        >
          {edition === 'any' ? t('edition.any') : edition}
        </Part>
      )}
    </li>
  );
}

export function SpellList() {
  const { t } = useTranslation('spells');
  const { character, content, computed, system } = useSheet();
  const rows = sorted(system.spells(character, content.index, computed));
  const empty =
    rows.length === 0 &&
    system.slotGrid(character, computed).length === 0 &&
    system.spellcasting(character, computed).length === 0;
  if (empty) return <p className="text-15 text-muted">{t('none')}</p>;
  return (
    <>
      <SpellcastingGlance />
      <SlotGrid />
      {rows.length > 0 && (
        <ul aria-label={t('list.label')} className="flex flex-col">
          {rows.map((entry) => {
            const { from, id } = entry;
            return (
              <SpellRow
                key={`${from.kind}:${from.kind === 'grant' ? from.part : from.source}:${id}`}
                entry={entry}
              />
            );
          })}
        </ul>
      )}
    </>
  );
}
