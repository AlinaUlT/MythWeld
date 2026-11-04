// SHEET-47: the cast panel (ADR 010 item 10, ADR 011 item 2, board V3-Cast): a tap on a spell opens
// it. It shows the spell's summary and "See full description", what forbids a cast now (SHEET-17's
// `castWarnings`; the cast still happens), the dice at the slot picked (ENG-50), the slot to use,
// "Don't use a spell slot", then "Cast" and the damage or healing roll. A new concentration ends
// the one held only after the person confirms (SPEC §6.4). The cast is the module's `castSpell`:
// run on a copy it says if it would be refused, and run for real it is one change with its "Undo".
import { finderOf, parseRoll } from '@grimoire/engine';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { descriptionOf } from '../../content/descriptions';
import { logRoll } from '../../db/rollLog';
import { BottomSheet } from '../../shared/BottomSheet';
import { DescriptionBody } from '../../shared/Description';
import { panelDie, rollWith } from '../../shared/dice';
import type { CastWarning, SpellDef } from '../../systems';
import { Part } from '../../theme/Part';
import { stepLabel } from '../breakdown';
import { perform, playerStamp } from '../changes';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { SwitchRow } from '../SwitchRow';
import type { PanelProps } from './panel';

export interface CastPanelProps extends PanelProps {
  spell: string;
  /** The spell grant it is cast through, when the spell has uses of its own. */
  part: string | undefined;
}

const button =
  'flex min-h-control items-center justify-center px-4 font-semibold text-on-strong disabled:opacity-disabled';
const secondary = 'flex min-h-control items-center justify-center px-4 font-semibold';
const small = 'text-12 font-semibold tracking-wide text-muted uppercase';

export function CastPanel({ spell: id, part, onClose }: CastPanelProps) {
  const { t } = useTranslation('cast');
  const { character, content } = useSheet();
  const found = finderOf(character, content.index)(id);
  if (found === undefined || found.type !== 'spell') {
    return (
      <BottomSheet title={t('missingTitle')} onClose={onClose}>
        <p className="py-2 text-15 text-muted">{t('missing', { id })}</p>
      </BottomSheet>
    );
  }
  return <SpellCast spell={found} part={part} onClose={onClose} />;
}

function SpellCast({
  spell,
  part,
  onClose,
}: {
  spell: SpellDef;
  part: string | undefined;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('cast');
  const { t: tb } = useTranslation('breakdown');
  const { character, content, computed, system } = useSheet();
  const find = finderOf(character, content.index);
  const [slotKey, setSlotKey] = useState<string | undefined>(undefined);
  const [noSlot, setNoSlot] = useState(part !== undefined || spell.level === 0);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<string | undefined>(undefined);
  const [rolled, setRolled] = useState<string | undefined>(undefined);

  const columns = system
    .spells(character, computed)
    .slots.filter(({ level }) => level >= spell.level);
  const keyOf = (column: (typeof columns)[number]) =>
    column.slot === 'pact' ? 'pact' : `${column.level}`;
  const nameOfColumn = (column: (typeof columns)[number]) =>
    column.slot === 'pact'
      ? t('pact', { level: column.level })
      : t('level', { level: column.level });
  const open = columns.find(({ max, spent }) => spent < max) ?? columns[0];
  const picked = columns.find((column) => keyOf(column) === slotKey) ?? open;

  const ask =
    spell.level === 0 || noSlot
      ? part !== undefined && spell.level > 0
        ? { spell: spell.id, grant: part }
        : { spell: spell.id }
      : picked === undefined
        ? undefined
        : { spell: spell.id, slot: picked.slot };
  const preview =
    ask === undefined
      ? undefined
      : system.castSpell(character, content.index, ask, playerStamp(character));
  const unchanged = preview !== undefined && !preview.ok && preview.code === 'unchanged';
  const refusal = preview !== undefined && !preview.ok && !unchanged ? preview : undefined;

  const refusalText = (result: { code: string; message: string }) =>
    result.code === 'noSlotLeft' || result.code === 'noUseLeft' || result.code === 'slotTooLow'
      ? t(`refused.${result.code}`)
      : result.message;

  const held = system.concentration(character);
  const replaces = spell.concentration && held !== undefined && held !== spell.id;
  const nameOf = (entityId: string) => {
    const entity = find(entityId);
    return entity === undefined ? entityId : nameIn(entity.name);
  };

  const stat = system.spellCastingStat(character, computed, spell.id);
  const dice = system.spellDice(spell, computed.values, {
    ...(!noSlot && picked !== undefined && spell.level > 0 && { slot: picked.level }),
    ...(stat !== undefined && { stat }),
  });
  const typeName = (type: string) => {
    const entity = computed.byKey.damageType?.[type];
    return entity === undefined ? type : nameIn(entity.name);
  };
  const school = computed.byKey.school?.[spell.school];
  const schoolName =
    school === undefined
      ? `${spell.school.charAt(0).toUpperCase()}${spell.school.slice(1)}`
      : nameIn(school.name);

  /** A formula as the person reads it: each `@path` written as the number it is now. */
  const shown = (formula: string) =>
    formula
      .replace(/@([\w.]+)/g, (whole, path: string) => {
        const value = computed.values[path];
        return typeof value === 'number' ? String(value) : whole;
      })
      .replace(/\+ -(\d)/g, '- $1');

  const warnings = system.castWarnings(computed);
  const warningText = (warning: CastWarning) =>
    warning.code === 'incapacitated'
      ? t('warning.incapacitated', { name: nameOf(warning.condition) })
      : t('warning.cannotCast');

  const run = () => {
    if (ask === undefined) return;
    setFailed(undefined);
    perform(character, (stamp) => system.castSpell(character, content.index, ask, stamp))
      .then((made) => {
        if (made.ok) onClose();
        else setFailed(refusalText(made));
      })
      .catch((error: unknown) => console.error(error));
  };
  const cast = () => {
    if (unchanged) {
      onClose();
      return;
    }
    if (replaces && !confirming) {
      setConfirming(true);
      return;
    }
    run();
  };

  /** Rolls each formula with the fair die, logs each roll, and shows what came up. */
  const roll = (label: string, formulas: readonly { formula: string; name: string }[]) => {
    const read = (path: string) =>
      Object.hasOwn(computed.values, path) ? computed.values[path] : undefined;
    const parts = formulas.flatMap(({ formula, name }) => {
      const parsed = parseRoll(formula);
      if (!parsed.ok) return [];
      const made = rollWith({
        formula: parsed.formula,
        read,
        die: panelDie(),
        roller: { actorId: character.id, name: character.name },
        id: crypto.randomUUID(),
        now: new Date(),
        label,
      });
      logRoll(made.record).then(
        (logged) => {
          if (!logged.ok) console.error(logged.message);
        },
        (error: unknown) => console.error(error),
      );
      return [t('rolledPart', { total: made.record.total, label: name })];
    });
    setRolled(t('rolled', { parts: parts.join(t('separator')) }));
  };

  const description = descriptionOf(spell, i18n.language);
  const uses = columns.map((column) =>
    t('slotLeft', {
      name: nameOfColumn(column),
      left: column.max - column.spent,
      max: column.max,
    }),
  );
  const healingKey = dice.healing?.kind === 'tempHp' ? 'healingTemp' : 'healing';

  return (
    <BottomSheet title={nameIn(spell.name)} onClose={onClose}>
      <div className="flex flex-col gap-3 pb-3" data-cast={spell.id}>
        <div className="flex flex-wrap items-center gap-2 text-14 text-muted">
          <Part
            as="span"
            name="chip"
            className="flex h-5 items-center bg-soft px-2 text-12 font-semibold"
          >
            {spell.ruleset}
          </Part>
          <span data-testid="cast-line">
            {[
              spell.level === 0 ? t('cantrip') : t('level', { level: spell.level }),
              schoolName,
              ...(uses.length > 0 && spell.level > 0
                ? [t('slotsLeft', { list: uses.join(t('separator')) })]
                : []),
            ].join(t('separator'))}
          </span>
        </div>

        <Part name="panel" className="border border-line py-3">
          <DescriptionBody description={description} />
        </Part>

        {warnings.map((warning) => (
          <div
            key={warning.code}
            className="flex flex-col gap-1 bg-warn-bg px-3 py-2 text-13 text-warn-text"
            role="alert"
            data-testid="cast-warning"
          >
            <p className="m-0">{warningText(warning)}</p>
            {warning.code === 'cannotCast' && warning.steps.length > 0 && (
              <ul className="m-0 flex list-disc flex-col pl-5">
                {warning.steps.map((step, at) => (
                  // A breakdown is a fixed list of steps, so a step's place is its key.
                  // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
                  <li key={at}>{stepLabel(computed, system, step, tb)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {(dice.damage.length > 0 || dice.healing !== undefined) && (
          <section className="flex flex-col gap-1" aria-label={t('diceHeading')}>
            <h3 className={`m-0 ${small}`}>{t('diceHeading')}</h3>
            {dice.damage.map(({ formula, type }) => (
              <p key={`${formula}:${type}`} className="m-0 text-15" data-testid="cast-damage">
                {t('damage', { formula: shown(formula), type: typeName(type) })}
              </p>
            ))}
            {dice.healing !== undefined && (
              <p className="m-0 text-15" data-testid="cast-healing">
                {t(healingKey, { formula: shown(dice.healing.formula) })}
              </p>
            )}
            {rolled !== undefined && (
              <output className="text-15 font-bold" data-testid="cast-rolled">
                {rolled}
              </output>
            )}
          </section>
        )}

        {spell.level > 0 && !noSlot && (
          <section className="flex flex-col gap-2" aria-label={t('slotsHeading')}>
            <h3 className={`m-0 ${small}`}>{t('slotsHeading')}</h3>
            {columns.length === 0 ? (
              <p className="m-0 text-14 text-muted">{t('noSlotAvailable')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {columns.map((column) => (
                  <Part
                    key={keyOf(column)}
                    as="button"
                    type="button"
                    name="chip"
                    aria-pressed={picked !== undefined && keyOf(column) === keyOf(picked)}
                    disabled={column.spent >= column.max}
                    onClick={() => {
                      setSlotKey(keyOf(column));
                      setConfirming(false);
                    }}
                    className={`flex min-h-control items-center px-3 text-15 font-semibold disabled:opacity-disabled ${picked !== undefined && keyOf(column) === keyOf(picked) ? 'bg-strong text-on-strong' : 'bg-soft'}`}
                  >
                    {nameOfColumn(column)}
                  </Part>
                ))}
              </div>
            )}
          </section>
        )}

        {spell.level > 0 && (
          <div className="flex flex-col">
            <SwitchRow
              label={t('noSlot')}
              on={noSlot}
              onChange={(on) => {
                setNoSlot(on);
                setConfirming(false);
              }}
            />
            <p className="m-0 text-12 text-muted">
              {part === undefined ? t('noSlotHint') : t('noSlotHintGrant')}
            </p>
          </div>
        )}

        {refusal !== undefined && (
          <p className="m-0 bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
            {refusalText(refusal)}
          </p>
        )}
        {failed !== undefined && (
          <p className="m-0 bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
            {failed}
          </p>
        )}

        {confirming && held !== undefined ? (
          <div
            className="sticky bottom-0 flex flex-col gap-2 bg-surface py-2"
            data-testid="cast-confirm"
          >
            <p className="m-0 text-15">
              {t('concentration.confirm', { name: nameIn(spell.name), held: nameOf(held) })}
            </p>
            <div className="flex gap-2">
              <Part
                as="button"
                type="button"
                name="button"
                fill="button"
                onClick={run}
                className={button}
              >
                {t('concentration.ok')}
              </Part>
              <Part
                as="button"
                type="button"
                name="button-secondary"
                onClick={() => setConfirming(false)}
                className={secondary}
              >
                {t('concentration.back')}
              </Part>
            </div>
          </div>
        ) : (
          <div className="sticky bottom-0 flex flex-wrap gap-2 bg-surface py-2">
            <Part
              as="button"
              type="button"
              name="button"
              fill="button"
              disabled={refusal !== undefined || ask === undefined}
              onClick={cast}
              className={button}
            >
              {t('cast')}
            </Part>
            {dice.damage.length > 0 && (
              <Part
                as="button"
                type="button"
                name="button-secondary"
                onClick={() =>
                  roll(
                    t('rolledDamage', { name: nameIn(spell.name) }),
                    dice.damage.map(({ formula, type }) => ({ formula, name: typeName(type) })),
                  )
                }
                className={secondary}
              >
                {t('rollDamage')}
              </Part>
            )}
            {dice.healing !== undefined && (
              <Part
                as="button"
                type="button"
                name="button-secondary"
                onClick={() =>
                  roll(t('rolledHealing', { name: nameIn(spell.name) }), [
                    { formula: dice.healing?.formula ?? '', name: t('rollHealing') },
                  ])
                }
                className={secondary}
              >
                {t('rollHealing')}
              </Part>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
