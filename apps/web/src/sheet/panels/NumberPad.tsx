// SHEET-40: the Damage, Heal and Temp HP number pad (SPEC §7.2, ADR 010 item 6, ADR 013 item 1,
// boards V3-Keypad and V3-TempHP). One pad with three modes: the person types an amount, sees the
// hit points before and after ("12 / 12 → 12 / 12 +5", the temporary ones in their own colour), and
// applies it: one change with its "Undo" toast. The after is what the module's own action would
// give, run on a copy, so the screen holds no hit point rule. Damage that leaves a concentrating
// character above 0 asks for the Constitution save, with its DC and a Roll (SHEET-39's dialog), and
// "End concentration" when it fails (ENG-20); the pad offers a knock-out where the edition has it
// and the damage would drop the character to 0 (ENG-65). Temporary hit points never add up, so the
// pad offers to replace them when the new amount is lower. A dead character takes none: the pad
// says so. The damage's type and a critical hit are not on the board's pad.
import { finderOf } from '@grimoire/engine';
import { Delete } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../shared/BottomSheet';
import { RollDialog } from '../../shared/RollDialog';
import { Part } from '../../theme/Part';
import { perform, playerStamp } from '../changes';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { numberAt } from '../SheetNumber';
import { SwitchRow } from '../SwitchRow';
import type { PanelProps } from './panel';

/** Which dock button opened the pad. */
export type NumberPadMode = 'damage' | 'heal';

type Mode = NumberPadMode | 'temp';

const MODES: readonly Mode[] = ['damage', 'heal', 'temp'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;
/** The longest amount the pad takes: four digits. */
const MAX_DIGITS = 4;

export interface NumberPadProps extends PanelProps {
  mode: NumberPadMode;
}

/** What damage left to ask or tell after it was applied. */
interface Follow {
  status: 'up' | 'down' | 'dead' | 'knockedOut';
  dc?: number;
  ended?: string;
}

export function NumberPad({ mode: first, onClose }: NumberPadProps) {
  const { t } = useTranslation('numberPad');
  const { character, content, computed, system } = useSheet();
  const [mode, setMode] = useState<Mode>(first);
  const [digits, setDigits] = useState('');
  const [knockOut, setKnockOut] = useState(false);
  const [replace, setReplace] = useState(false);
  const [follow, setFollow] = useState<Follow | undefined>(undefined);
  const [rolling, setRolling] = useState(false);

  const amount = digits === '' ? 0 : Number(digits);
  const { current, temp, maxPath } = system.hitPoints(character);
  const max = numberAt(computed, maxPath);
  const offered = mode === 'damage' && system.knockOutOffered(character, amount);
  const knocking = offered && knockOut;
  const replacing = mode === 'temp' && temp > 0 && amount > 0 && amount < temp && replace;

  /** The action of the mode, for the amount typed. */
  const damage = (stamp: Parameters<typeof system.applyDamage>[3]) =>
    system.applyDamage(character, content.index, { amount, knockOut: knocking }, stamp);
  const act = (stamp: Parameters<typeof system.applyDamage>[3]) => {
    const index = content.index;
    if (mode === 'damage') return damage(stamp);
    if (mode === 'heal') return system.applyHealing(character, index, { amount }, stamp);
    return system.setTempHp(character, index, { amount, replace: replacing }, stamp);
  };

  // What the action gives, run on a copy: the hit points after it, or why it would not run.
  const preview = amount === 0 ? undefined : act(playerStamp(character));
  const after = preview?.ok ? system.hitPoints(preview.character) : { current, temp };
  const refusal = preview !== undefined && !preview.ok ? preview : undefined;
  const maxText = max === undefined ? t('noMax') : String(max);

  const press = (key: (typeof KEYS)[number]) => {
    if (key === 'clear') setDigits('');
    else if (key === 'back') setDigits(digits.slice(0, -1));
    else if (digits.length < MAX_DIGITS) setDigits(`${digits}${key}`.replace(/^0+/, ''));
  };

  const run = async () => {
    const held: { outcome?: Follow } = {};
    const made = await perform(character, (stamp) => {
      if (mode !== 'damage') return act(stamp);
      const result = damage(stamp);
      if (result.ok) {
        const { status, concentrationDc, concentrationEnded } = result.outcome;
        held.outcome = {
          status,
          ...(concentrationDc !== undefined && { dc: concentrationDc }),
          ...(concentrationEnded !== undefined && { ended: concentrationEnded }),
        };
      }
      return result;
    });
    if (!made.ok) return;
    if (held.outcome !== undefined && needsFollowUp(held.outcome)) setFollow(held.outcome);
    else onClose();
  };

  if (follow !== undefined) {
    const held = system.concentration(character) ?? follow.ended;
    const spell = held === undefined ? undefined : finderOf(character, content.index)(held);
    const spellName = spell === undefined ? (held ?? '') : nameIn(spell.name);
    const save = system.concentrationSave(computed);
    return (
      <BottomSheet title={t('followTitle')} onClose={onClose}>
        <div className="flex flex-col gap-3 pb-3" data-testid="pad-follow">
          {follow.status !== 'up' && (
            <p className="text-15" role="status">
              {t(`status.${follow.status}`)}
            </p>
          )}
          {follow.ended !== undefined && (
            <p className="text-15" role="status">
              {t('ended', { name: spellName })}
            </p>
          )}
          {follow.dc !== undefined && (
            <>
              <p className="text-15">{t('save', { dc: follow.dc, name: spellName })}</p>
              <div className="flex flex-wrap gap-2">
                {save !== undefined && (
                  <Part
                    as="button"
                    type="button"
                    name="button"
                    fill="button"
                    onClick={() => setRolling(true)}
                    className="flex min-h-control items-center px-4 font-semibold text-on-strong"
                  >
                    {t('roll')}
                  </Part>
                )}
                <Part
                  as="button"
                  type="button"
                  name="button-secondary"
                  onClick={onClose}
                  className="flex min-h-control items-center px-4 font-semibold"
                >
                  {t('kept')}
                </Part>
                <Part
                  as="button"
                  type="button"
                  name="button-secondary"
                  onClick={() =>
                    perform(character, (stamp) =>
                      system.endConcentration(character, content.index, stamp),
                    )
                      .then(onClose)
                      .catch((error: unknown) => console.error(error))
                  }
                  className="flex min-h-control items-center px-4 font-semibold"
                >
                  {t('lost')}
                </Part>
              </div>
            </>
          )}
          {follow.dc === undefined && (
            <Part
              as="button"
              type="button"
              name="button"
              fill="button"
              onClick={onClose}
              className="flex min-h-control items-center self-start px-4 font-semibold text-on-strong"
            >
              {t('done')}
            </Part>
          )}
        </div>
        {rolling && save !== undefined && (
          <RollDialog path={save} onClose={() => setRolling(false)} />
        )}
      </BottomSheet>
    );
  }

  const label = t(`apply.${mode}`, { amount });
  return (
    <BottomSheet title={t('title')} onClose={onClose}>
      <div className="flex flex-col gap-3 pb-3">
        <fieldset className="m-0 flex min-w-0 rounded-card border-0 bg-soft p-0.5">
          <legend className="sr-only">{t('modes')}</legend>
          {MODES.map((each) => (
            <button
              key={each}
              type="button"
              aria-pressed={each === mode}
              onClick={() => {
                setMode(each);
                setKnockOut(false);
                setReplace(false);
              }}
              className={`flex min-h-control grow items-center justify-center text-15 font-semibold ${each === mode ? `bg-surface ${each === 'temp' ? 'text-temp' : ''}` : 'text-muted'}`}
            >
              {t(`mode.${each}`)}
            </button>
          ))}
        </fieldset>

        <div className="flex items-baseline justify-between gap-3 px-1">
          <span className="text-14 text-muted" data-testid="pad-summary">
            {t('summary', { current, max: maxText, after: after.current })}
            {after.temp > 0 && (
              <span className="ml-1 text-temp">{t('temp', { value: after.temp })}</span>
            )}
          </span>
          <span
            className={`text-44 leading-none font-extrabold ${mode === 'temp' ? 'text-temp' : ''}`}
            data-testid="pad-amount"
          >
            {amount}
          </span>
        </div>

        {offered && <SwitchRow label={t('knockOut')} on={knockOut} onChange={setKnockOut} />}
        {mode === 'temp' && temp > 0 && amount > 0 && amount < temp && (
          <SwitchRow label={t('replace', { temp })} on={replace} onChange={setReplace} />
        )}
        {refusal !== undefined && (
          <p className="text-13 text-warn-text" role="alert">
            {refusal.code === 'dead' ? t('dead') : refusal.message}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={t(`key.${key}`, { defaultValue: key })}
              onClick={() => press(key)}
              className="flex h-13 items-center justify-center rounded-card border border-line text-22 font-bold"
            >
              {key === 'clear' ? (
                'C'
              ) : key === 'back' ? (
                <Delete aria-hidden className="size-6" />
              ) : (
                key
              )}
            </button>
          ))}
        </div>

        <Part
          as="button"
          type="button"
          name="button"
          fill="button"
          disabled={amount === 0 || (preview !== undefined && !preview.ok)}
          onClick={() => run().catch((error: unknown) => console.error(error))}
          className="flex min-h-control items-center justify-center px-4 font-semibold text-on-strong disabled:opacity-disabled"
        >
          {label}
        </Part>
      </div>
    </BottomSheet>
  );
}

/** Whether what damage did leaves something to ask or tell: a save, a death, a knock-out. */
function needsFollowUp(follow: Follow): boolean {
  return follow.status !== 'up' || follow.dc !== undefined || follow.ended !== undefined;
}
