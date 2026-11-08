// SHEET-46: the Spells tab (ADR 010 items 9 and 10, ADR 009 item 4, board V3-Spells): spellcasting
// at a glance, the slot grid, the spells each class knows and has prepared, and the spells the
// character's features grant. The slots are columns, one for each spell level the character has
// slots of, two circles to a row, filled while one is left; a tap on a filled circle spends a slot
// and a tap on a hollow one gives it back, each one change with its "Undo" toast. A granted spell
// shows its source and, when it has uses of its own, "1/LR" and "no spell slot"; the uses are the
// resource of its grant's key (ENG-57), so two grants of one entity are told apart. Every spell
// shows its edition or warns that it is of the other one (ENG-49). SHEET-47: a tap on a spell opens
// the cast panel, which holds its description (ADR 011 item 2: no separate spell card).
// SHEET-86: the casting card also shows how many spells a class prepares and how many cantrips it
// knows (ADR 019), each a number with its breakdown.
import { finderOf, recoveryOf, resourceUses, shareRuleset } from '@grimoire/engine';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { SheetNumber } from '../SheetNumber';

const heading = 'font-heading text-18 font-bold';

function Slots() {
  const { t } = useTranslation('spells');
  const { character, content, computed, system } = useSheet();
  const { slots } = system.spells(character, computed);
  if (slots.length === 0) return null;
  const run = (action: Parameters<typeof perform>[1]) =>
    perform(character, action).catch((error: unknown) => console.error(error));
  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col gap-3 p-4"
      aria-label={t('slots')}
    >
      <h2 className={heading}>{t('slots')}</h2>
      <div className="flex flex-wrap gap-x-6 gap-y-4" data-testid="slot-grid">
        {slots.map((column) => {
          const key = column.slot === 'pact' ? 'pact' : `${column.level}`;
          const name =
            column.slot === 'pact'
              ? t('pact', { level: column.level })
              : t('level', { level: column.level });
          return (
            <div key={key} className="flex flex-col gap-2" data-slot={key}>
              <h3 className="text-12 font-semibold tracking-wide text-muted uppercase">{name}</h3>
              <div className="grid w-fit grid-cols-2 gap-4">
                {Array.from({ length: column.max }, (_, at) => {
                  const left = at < column.max - column.spent;
                  return (
                    <button
                      // The circles are a fixed grid, so their place is their key.
                      // biome-ignore lint/suspicious/noArrayIndexKey: the grid never changes order.
                      key={at}
                      type="button"
                      data-left={left}
                      aria-label={t(left ? 'spend' : 'regain', { name })}
                      onClick={() =>
                        run((stamp) =>
                          left
                            ? system.spendSlot(
                                character,
                                content.index,
                                { slot: column.slot },
                                stamp,
                              )
                            : system.regainSlot(character, { slot: column.slot, amount: 1 }, stamp),
                        )
                      }
                      className={`relative size-7 shrink-0 rounded-full border-2 border-strong before:absolute before:-inset-2 before:content-[''] ${left ? 'bg-strong' : ''}`}
                    />
                  );
                })}
              </div>
              <span className="text-12 text-muted" data-testid="slots-left">
                {t('slotsLeft', { left: column.max - column.spent, max: column.max })}
              </span>
            </div>
          );
        })}
      </div>
    </Part>
  );
}

function AtAGlance() {
  const { t } = useTranslation('spells');
  const { character, computed, system } = useSheet();
  const casting = system.casting(character, computed);
  if (casting.length === 0) return null;
  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col gap-2 p-4"
      aria-label={t('casting')}
    >
      <h2 className={heading}>{t('casting')}</h2>
      {casting.map(({ source, ability, dc, attack, prepared, cantrips }) => {
        const stat = computed.byKey.ability?.[ability];
        const abbr = stat?.type === 'ability' ? nameIn(stat.abbr) : ability;
        const owner = computed.entities.find(({ entity }) => entity.id === source)?.entity;
        return (
          <div key={source} className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="text-13 font-semibold tracking-wide text-muted">
              {owner === undefined
                ? abbr
                : t('castingOf', { name: nameIn(owner.name), ability: abbr })}
            </span>
            <SheetNumber
              path={dc}
              label={t('saveDc')}
              className="flex min-h-control items-baseline gap-2"
              labelClassName="text-13 text-muted"
              valueClassName="text-20 font-bold"
            />
            <SheetNumber
              path={attack}
              label={t('attack')}
              format="signed"
              rolls
              className="flex min-h-control items-baseline gap-2"
              labelClassName="text-13 text-muted"
              valueClassName="text-20 font-bold"
            />
            {/* SHEET-86: how many spells the class prepares and how many cantrips it knows, each
                with its breakdown on a long press; only where the class has that count. */}
            {prepared !== undefined && (
              <SheetNumber
                path={prepared}
                label={t('preparedCount')}
                className="flex min-h-control items-baseline gap-2"
                labelClassName="text-13 text-muted"
                valueClassName="text-20 font-bold"
              />
            )}
            {cantrips !== undefined && (
              <SheetNumber
                path={cantrips}
                label={t('cantripsCount')}
                className="flex min-h-control items-baseline gap-2"
                labelClassName="text-13 text-muted"
                valueClassName="text-20 font-bold"
              />
            )}
          </div>
        );
      })}
    </Part>
  );
}

/** One spell row: its name opening its description, its level and edition, and what limits it. */
function SpellRow({
  id,
  extra = [],
  usesKey,
  part,
}: {
  id: string;
  /** What the row adds to its line: "always prepared", "no spell slot". */
  extra?: readonly string[];
  /** The key of the grant's own uses, for a granted spell that has them. */
  usesKey?: string | undefined;
  /** The grant's part id, for a granted spell that has its own uses: the cast spends one. */
  part?: string | undefined;
}) {
  const { t } = useTranslation('spells');
  const { character, content, computed, cast } = useSheet();
  const found = finderOf(character, content.index)(id);
  if (found === undefined || found.type !== 'spell') {
    return <li className="px-4 py-2 text-14 text-muted">{t('missing', { id })}</li>;
  }
  const own = found.ruleset !== 'any' && !shareRuleset(found.ruleset, character.ruleset);
  const uses = usesKey === undefined ? undefined : resourceUses(character, computed, usesKey);
  const events =
    usesKey === undefined
      ? []
      : recoveryOf(computed, usesKey).map(({ on }) => t(`recovery.${on}`, { defaultValue: on }));
  const limit =
    uses === undefined
      ? []
      : [t('limit', { max: Math.floor(uses.max), events: events.join(t('or')) }), t('noSlot')];
  const line = [
    found.level === 0 ? t('cantrip') : t('level', { level: found.level }),
    ...(character.allowMixedRulesets || own ? [found.ruleset] : []),
    ...limit,
    ...extra,
  ].join(t('separator'));
  return (
    <li className="flex flex-col" data-spell={id}>
      <button
        type="button"
        onClick={() => cast(id, usesKey === undefined ? undefined : part)}
        className="flex min-h-control items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-15 font-bold">{nameIn(found.name)}</span>
          <span className="text-12 text-muted">{line}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </button>
      {uses !== undefined && (
        <p className="px-4 pb-2 text-13 text-muted" data-testid="spell-uses">
          {t('usesLeft', { left: uses.left, max: Math.floor(uses.max) })}
        </p>
      )}
      {own && (
        <p className="mx-4 mb-2 bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
          {t(character.allowMixedRulesets ? 'otherRuleset' : 'otherRulesetNotMixing', {
            ruleset: found.ruleset,
          })}
        </p>
      )}
    </li>
  );
}

/** The ids sorted by the level of the spell each names, then by name; what is missing last. */
function sortedSpells(ids: readonly string[], levelAndName: (id: string) => [number, string]) {
  return [...ids].sort((a, b) => {
    const [la, na] = levelAndName(a);
    const [lb, nb] = levelAndName(b);
    return la - lb || na.localeCompare(nb) || a.localeCompare(b);
  });
}

function Lists() {
  const { t } = useTranslation('spells');
  const { character, content, computed, system } = useSheet();
  const { lists } = system.spells(character, computed);
  const find = finderOf(character, content.index);
  const levelAndName = (id: string): [number, string] => {
    const found = find(id);
    return found?.type === 'spell'
      ? [found.level, nameIn(found.name)]
      : [Number.MAX_SAFE_INTEGER, id];
  };
  return (
    <>
      {lists.map(({ owner, known, prepared }) => {
        const named = find(owner);
        const knownOnly = known.filter((id) => !prepared.includes(id));
        const title = named === undefined ? t('missing', { id: owner }) : nameIn(named.name);
        return (
          <Part
            as="section"
            key={owner}
            name="card"
            fill="card"
            className="flex flex-col py-3"
            aria-label={title}
          >
            <h2 className={`${heading} px-4 pb-1`}>{title}</h2>
            {prepared.length > 0 && (
              <>
                <h3 className="px-4 pt-1 text-12 font-semibold tracking-wide text-muted uppercase">
                  {t('prepared')}
                </h3>
                <ul className="flex flex-col divide-y divide-line">
                  {sortedSpells(prepared, levelAndName).map((id) => (
                    <SpellRow key={id} id={id} />
                  ))}
                </ul>
              </>
            )}
            {knownOnly.length > 0 && (
              <>
                <h3 className="px-4 pt-2 text-12 font-semibold tracking-wide text-muted uppercase">
                  {t('known')}
                </h3>
                <ul className="flex flex-col divide-y divide-line">
                  {sortedSpells(knownOnly, levelAndName).map((id) => (
                    <SpellRow key={id} id={id} />
                  ))}
                </ul>
              </>
            )}
          </Part>
        );
      })}
    </>
  );
}

function Granted() {
  const { t } = useTranslation('spells');
  const { character, computed, system } = useSheet();
  const { granted } = system.spells(character, computed);
  if (granted.length === 0) return null;
  const source = (id: string) => {
    const had = computed.entities.find(({ entity }) => entity.id === id)?.entity;
    return had === undefined ? id : nameIn(had.name);
  };
  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col py-3"
      aria-label={t('granted')}
    >
      <h2 className={`${heading} px-4 pb-1`}>{t('granted')}</h2>
      <ul className="flex flex-col divide-y divide-line">
        {granted.map(({ spell, part, from, key, alwaysPrepared }) => (
          <SpellRow
            key={`${part}:${spell}`}
            id={spell}
            usesKey={key}
            part={part}
            extra={[
              t('from', { name: source(from) }),
              ...(alwaysPrepared ? [t('alwaysPrepared')] : []),
            ]}
          />
        ))}
      </ul>
    </Part>
  );
}

export function SpellList() {
  const { t } = useTranslation('spells');
  const { character, computed, system } = useSheet();
  const shown = system.spells(character, computed);
  const none =
    shown.slots.length === 0 &&
    shown.lists.length === 0 &&
    shown.granted.length === 0 &&
    system.casting(character, computed).length === 0;
  if (none) return <p className="px-1 py-2 text-15 text-muted">{t('none')}</p>;
  return (
    <>
      <AtAGlance />
      <Slots />
      <Lists />
      <Granted />
    </>
  );
}
