// SHEET-46: the Spells tab (board V3-Spells, ADR 010 items 9 and 10, ADR 009 item 4): spellcasting at
// a glance, the slot grid, then the spells: those a class holds, and those a feature grants with
// their source, and, when the grant gives uses, "no spell slot" and the limit ("1/LR"). A spell's
// row opens nothing yet: SHEET-47's cast panel does. Its i18n namespace is `spells`.
import { finderOf, STAT_TYPE } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { SheetSpell, SlotColumn, SpellLimit } from '@grimoire/system-5e';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import type { AppCharacter } from '../../systems';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';
import { SheetNumber, usePress } from '../SheetNumber';

type SpellsT = TFunction<'spells'>;

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** The name of the entity `id`, or the words saying no pack has it. */
function useNameOf(t: SpellsT): (id: string) => string {
  const { character, content } = useSheet();
  const find = finderOf(character, content.index);
  return (id) => {
    const found = find(id);
    return found === undefined ? t('missing', { id }) : nameIn(found.name);
  };
}

const castingNumber = 'flex items-baseline gap-1 select-none';

/** One line of spellcasting at a glance: the stat, then its save DC and spell attack. */
function CastingLine({
  ability,
  dc,
  attack,
  caption,
  t,
}: {
  ability: string;
  dc: string;
  attack: string;
  caption?: string;
  t: SpellsT;
}) {
  const { computed } = useSheet();
  const stat = computed.byKey[STAT_TYPE]?.[ability];
  const abbr = stat?.type === STAT_TYPE ? nameIn(stat.abbr) : ability;
  return (
    <div className="flex h-8 items-center gap-4 text-14">
      <Part
        as="span"
        name="chip"
        className="flex h-5 items-center bg-strong px-2 text-12 font-semibold text-on-strong"
      >
        {abbr}
      </Part>
      <SheetNumber
        path={dc}
        label={t('casting.dc')}
        className={castingNumber}
        labelClassName="text-12 text-muted"
        valueClassName="font-bold"
      />
      <SheetNumber
        path={attack}
        label={t('casting.attack')}
        format="signed"
        rolls
        className={castingNumber}
        labelClassName="text-12 text-muted"
        valueClassName="font-bold"
      />
      {caption !== undefined && <span className="text-12 text-muted">{caption}</span>}
    </div>
  );
}

/** Each casting class's line, then one for each stat a feature's spells are cast with. */
function Casting({ t }: { t: SpellsT }) {
  const { character, computed, system } = useSheet();
  const classes = system.casting(character, computed);
  const granted = system.grantedCasting(computed);
  if (classes.length + granted.length === 0) return null;
  return (
    <div className="flex flex-col">
      {classes.map(({ source, ability, dc, attack }) => (
        <CastingLine key={source} ability={ability} dc={dc} attack={attack} t={t} />
      ))}
      {granted.map(({ source, ability, dc, attack }) => (
        <CastingLine
          key={source}
          ability={ability}
          dc={dc}
          attack={attack}
          caption={t('casting.granted')}
          t={t}
        />
      ))}
    </div>
  );
}

/** One column of the grid: its spent circles hollow, then those left filled, two to a row. */
function SlotColumnView({ column, t }: { column: SlotColumn; t: SpellsT }) {
  const sheet = useSheet();
  const { key, level, path, max, spent, left } = column;
  const name = key === 'pact' ? t('slots.pact', { level }) : t('slots.level', { level });
  // A long press opens the breakdown of the column's maximum (SPEC §7.2); a tap does nothing here.
  const handlers = usePress(undefined, () => sheet.breakdown(path));
  return (
    <button
      type="button"
      data-path={path}
      aria-label={t('slots.summary', { name, left, max })}
      className="flex flex-col items-center gap-1.5 select-none"
      {...handlers}
    >
      <span className="text-12 font-bold">{name}</span>
      <span aria-hidden className="grid grid-cols-2 gap-1.5">
        {Array.from({ length: max }, (_, at) => (
          <span
            // Each circle of a column looks like its neighbours, so its place is its key.
            // biome-ignore lint/suspicious/noArrayIndexKey: the circles have no identity.
            key={at}
            data-slot={at < Math.min(spent, max) ? 'spent' : 'left'}
            className={cn(
              'size-5 rounded-full border-2 border-strong',
              at >= Math.min(spent, max) && 'bg-strong',
            )}
          />
        ))}
      </span>
    </button>
  );
}

function SlotGrid({ t }: { t: SpellsT }) {
  const { character, computed, system } = useSheet();
  const columns = system.slots(character, computed);
  if (columns.length === 0) return null;
  return (
    <Part
      as="section"
      name="card"
      aria-label={t('slots.title')}
      className="flex flex-wrap items-start justify-around gap-x-4 gap-y-3 px-3.5 py-3"
    >
      {columns.map((column) => (
        <SlotColumnView key={column.key} column={column} t={t} />
      ))}
    </Part>
  );
}

/** The recovery events the tab has words for: the fifth-edition module's list. */
const EVENTS = ['short', 'long', 'dawn', 'turn', 'manual', 'revive'] as const;

/** What a recovery event is called in a limit: "LR" for the long rest; the event's key if unknown. */
function eventName(on: string, t: SpellsT): string {
  const known = EVENTS.find((event) => event === on);
  return known === undefined ? on : t(`events.${known}`);
}

/** The limit of a grant's uses: "1/LR", and how many are left once one is spent. */
function limitText(limit: SpellLimit, t: SpellsT): string {
  const events = limit.recovery.map(({ on }) => eventName(on, t)).join(t('eventsSeparator'));
  const text = t('limit', { max: limit.max, events });
  return limit.spent > 0 ? [text, t('left', { left: limit.left })].join(t('separator')) : text;
}

/** Whether the spell is of one edition and the character of the other: it warns, never blocks. */
function otherEdition(spell: SheetSpell['spell'], character: AppCharacter): boolean {
  return spell !== undefined && spell.ruleset !== 'any' && spell.ruleset !== character.ruleset;
}

/** The words under a spell's name: its level, then where it comes from. */
function SubLine({
  row,
  character,
  nameOf,
  t,
}: {
  row: SheetSpell;
  character: AppCharacter;
  nameOf: (id: string) => string;
  t: SpellsT;
}) {
  const { spell, from } = row;
  const level =
    spell === undefined
      ? undefined
      : spell.level === 0
        ? t('cantrip')
        : t('level', { level: spell.level });
  const edition = otherEdition(spell, character)
    ? t('otherEdition', { edition: spell?.ruleset, ruleset: character.ruleset })
    : undefined;
  const parts =
    from.kind === 'class'
      ? [level, t(from.state)]
      : [level, t('from', { source: nameOf(from.source) })];
  return (
    <span className="text-12 text-muted">
      {parts.filter((part) => part !== undefined).join(t('separator'))}
      {from.kind === 'grant' && from.limit !== undefined && (
        <>
          {t('separator')}
          <b>{[t('noSlot'), limitText(from.limit, t)].join(t('separator'))}</b>
        </>
      )}
      {edition !== undefined && (
        <span role="alert" className="block text-warn-text">
          {edition}
        </span>
      )}
    </span>
  );
}

function SpellRow({
  row,
  character,
  nameOf,
  t,
}: {
  row: SheetSpell;
  character: AppCharacter;
  nameOf: (id: string) => string;
  t: SpellsT;
}) {
  const { spell } = row;
  const other = otherEdition(spell, character);
  return (
    <li className="flex min-h-12.5 items-center gap-2.5 border-b border-line py-1.5">
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <b className="truncate text-15">
          {spell === undefined ? t('missing', { id: row.id }) : nameIn(spell.name)}
        </b>
        <SubLine row={row} character={character} nameOf={nameOf} t={t} />
      </span>
      {spell !== undefined && spell.ruleset !== 'any' && (
        <Part
          as="span"
          name="chip"
          className={cn(
            'flex h-5 shrink-0 items-center px-2 text-12 font-semibold',
            other ? 'bg-warn-bg text-warn-text' : 'bg-soft text-muted',
          )}
        >
          {spell.ruleset}
        </Part>
      )}
    </li>
  );
}

/** A class's spells sorted by level then name; a missing one last; a feature's, as they come. */
function inOrder(rows: readonly SheetSpell[]): SheetSpell[] {
  const level = (row: SheetSpell) => row.spell?.level ?? Number.POSITIVE_INFINITY;
  const name = (row: SheetSpell) => (row.spell === undefined ? row.id : nameIn(row.spell.name));
  const own = rows
    .filter(({ from }) => from.kind === 'class')
    .sort((a, b) => level(a) - level(b) || name(a).localeCompare(name(b)));
  return [...own, ...rows.filter(({ from }) => from.kind === 'grant')];
}

function Spells({ t }: { t: SpellsT }) {
  const { character, computed, content, system } = useSheet();
  const nameOf = useNameOf(t);
  const rows = inOrder(system.spells(character, computed, content.index));
  if (rows.length === 0) return null;
  return (
    <section aria-label={t('list.title')}>
      <ul>
        {rows.map((row) => (
          <SpellRow
            key={`${row.from.kind === 'grant' ? row.from.part : row.from.source}/${row.id}`}
            row={row}
            character={character}
            nameOf={nameOf}
            t={t}
          />
        ))}
      </ul>
    </section>
  );
}

export function SpellList() {
  const { t } = useTranslation('spells');
  const { character, computed, content, system } = useSheet();
  const nothing =
    system.casting(character, computed).length === 0 &&
    system.grantedCasting(computed).length === 0 &&
    system.slots(character, computed).length === 0 &&
    system.spells(character, computed, content.index).length === 0;
  if (nothing) return <p className="text-15 text-muted">{t('empty')}</p>;
  return (
    <>
      <Casting t={t} />
      <SlotGrid t={t} />
      <Spells t={t} />
    </>
  );
}
