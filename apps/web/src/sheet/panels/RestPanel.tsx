// SHEET-45: the Rest panel (SPEC §6.4, BRIEF P6, board V3-Rest). One panel, three views: the board's
// two cards (what a short and a long rest give back, each with its button), and a frame for each
// rest. The short frame spends hit dice: each spend rolls a fair die, or, with "I roll myself" on,
// counts the face the person typed for it (SHEET-74, SPEC §6.5); logged like any roll, and the
// list below it follows. The long frame lists what comes back before "Confirm". Every list is
// the module's rest action run on a copy (`restLines`), so no rest rule is written here; Confirm
// runs the same action for real: one change with its "Undo" toast (ENG-21).
import { finderOf, parseRoll } from '@grimoire/engine';
import type { HitDieAsk } from '@grimoire/system-5e';
import { Clock, Moon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logRoll } from '../../db/rollLog';
import { useSettings } from '../../settings/useSettings';
import { BottomSheet } from '../../shared/BottomSheet';
import { type DiceField, panelDie, readNothing, rollWith, typedDie } from '../../shared/dice';
import { allFaces, TypedFaces, typedNumbers } from '../../shared/TypedFaces';
import type { RestLine } from '../../systems';
import { Part } from '../../theme/Part';
import { perform, playerStamp } from '../changes';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

type Frame = 'short' | 'long';

const button =
  'flex min-h-control items-center justify-center px-4 font-semibold text-on-strong disabled:opacity-disabled';
const secondary = 'flex min-h-control items-center justify-center px-4 font-semibold';

export function RestPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('rest');
  const { character, content, computed, system } = useSheet();
  const { rollMyself } = useSettings();
  const [typed, setTyped] = useState<string[]>([]);
  const [frame, setFrame] = useState<Frame | undefined>(undefined);
  const [dice, setDice] = useState<HitDieAsk[]>([]);
  const [failed, setFailed] = useState<string | undefined>(undefined);
  const find = finderOf(character, content.index);

  /** The rest's action, for the dice spent so far. */
  const act = (kind: Frame, ask: readonly HitDieAsk[], stamp: ReturnType<typeof playerStamp>) =>
    kind === 'short'
      ? system.shortRest(character, content.index, { hitDice: ask }, stamp)
      : system.longRest(character, content.index, stamp);

  const preview = (
    kind: Frame,
    ask: readonly HitDieAsk[],
  ): { lines: RestLine[]; refusal: string | undefined; unchanged: boolean } => {
    const result = act(kind, ask, playerStamp(character));
    return result.ok
      ? {
          lines: system.restLines(character, computed, result),
          refusal: undefined,
          unchanged: false,
        }
      : { lines: [], refusal: refusalText(result), unchanged: result.code === 'unchanged' };
  };

  const refusalText = (result: { code: string; message: string }) => {
    if (result.code === 'dead') return t('refused.dead');
    if (result.code === 'unchanged') return t('refused.unchanged');
    if (result.code === 'tooFewHitPoints' && 'min' in result && 'hp' in result) {
      return t('refused.tooFewHitPoints', { min: Number(result.min), hp: Number(result.hp) });
    }
    return result.message;
  };

  const nameOf = (id: string) => {
    const found = find(id);
    return found === undefined ? id : nameIn(found.name);
  };

  const text = (line: RestLine): string => {
    switch (line.kind) {
      case 'hitPoints':
        return line.to === line.max
          ? t('line.hitPointsFull', { to: line.to })
          : t('line.hitPoints', { from: line.from, to: line.to, max: line.max });
      case 'tempHitPoints':
        return t('line.tempHitPoints', { lost: line.lost });
      case 'hitDie':
        return t('line.hitDie', { die: `d${line.die}`, roll: line.roll, hp: line.hp });
      case 'hitDiceBack':
        return t('line.hitDiceBack', { back: line.back, die: `d${line.die}` });
      case 'slots':
        return t('line.slots', { level: line.level, back: line.back });
      case 'pactSlots':
        return t('line.pactSlots', { back: line.back });
      case 'uses':
        return t('line.uses', {
          name: line.label === undefined ? line.key : nameIn(line.label),
          count: line.back,
          left: line.left,
          max: line.max,
        });
      case 'condition':
        return line.to === 0
          ? t('line.conditionEnds', { name: nameOf(line.id) })
          : t('line.condition', { name: nameOf(line.id), to: line.to });
      case 'concentrationEnds':
        return t('line.concentrationEnds', { name: nameOf(line.id) });
      case 'inspiration':
        return t('line.inspiration');
      case 'knockOutEnds':
        return t('line.knockOutEnds');
    }
  };

  const list = (lines: readonly RestLine[], extra?: string, none?: string): ReactNode => (
    <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-15" data-testid="rest-lines">
      {lines.map((line) => (
        <li key={text(line)}>{text(line)}</li>
      ))}
      {extra !== undefined && <li>{extra}</li>}
      {lines.length === 0 && extra === undefined && (
        <li className="list-none text-muted">{none}</li>
      )}
    </ul>
  );

  const confirm = (kind: Frame) => {
    setFailed(undefined);
    perform(character, (stamp) => act(kind, dice, stamp))
      .then((made) => {
        if (made.ok) onClose();
        else setFailed(refusalText(made));
      })
      .catch((error: unknown) => console.error(error));
  };

  /** Rolls one hit die of `die` faces, fair or typed, and logs the roll. */
  const spend = (die: number, at: number) => {
    const formula = parseRoll(`1d${die}`);
    if (!formula.ok) return;
    const one = fields.slice(at, at + 1);
    if (rollMyself && !allFaces(one, [typed[at] ?? ''])) return;
    const made = rollWith({
      formula: formula.formula,
      read: readNothing,
      die: rollMyself ? typedDie(typedNumbers(one, [typed[at] ?? ''])) : panelDie(),
      roller: { actorId: character.id, name: character.name },
      id: crypto.randomUUID(),
      now: new Date(),
      label: t('spend', { die: `d${die}` }),
    });
    logRoll(made.record).then(
      (logged) => {
        if (!logged.ok) console.error(logged.message);
      },
      (error: unknown) => console.error(error),
    );
    setDice((spent) => [...spent, { die, roll: made.record.total }]);
    setTyped((now) => now.map((face, place) => (place === at ? '' : face)));
  };

  const hitDice = system.restDice(character, computed);
  // "I roll myself": one field for each kind of hit die the character has (SHEET-74).
  const fields: DiceField[] = rollMyself
    ? hitDice.map(({ die }) => ({ key: `hit:${die}`, term: `1d${die}`, faces: die, n: 1 }))
    : [];

  if (frame === undefined) {
    const short = preview('short', []);
    const long = preview('long', []);
    const cards: { kind: Frame; icon: ReactNode; shown: typeof short; extra?: string }[] = [
      {
        kind: 'short',
        icon: <Clock aria-hidden className="size-[22px]" />,
        shown: short,
        ...(hitDice.some(({ left }) => left > 0) && { extra: t('short.dice') }),
      },
      { kind: 'long', icon: <Moon aria-hidden className="size-[22px]" />, shown: long },
    ];
    return (
      <BottomSheet title={t('title')} onClose={onClose}>
        <div className="flex flex-col gap-3 pb-3">
          {cards.map(({ kind, icon, shown, extra }) => (
            <Part
              key={kind}
              name="panel"
              data-rest={kind}
              className="flex flex-col gap-2 border border-line p-3"
            >
              <div className="flex items-center gap-2 font-heading text-18 font-bold">
                {icon}
                <span>{t(`${kind}.title`)}</span>
              </div>
              {list(
                shown.lines,
                extra,
                shown.refusal !== undefined && !shown.unchanged ? shown.refusal : t(`${kind}.none`),
              )}
              <Part
                as="button"
                type="button"
                name="button"
                fill="button"
                onClick={() => {
                  setDice([]);
                  setFailed(undefined);
                  setFrame(kind);
                }}
                className={`${button} self-start`}
              >
                {t(`${kind}.title`)}
              </Part>
            </Part>
          ))}
        </div>
      </BottomSheet>
    );
  }

  const shown = preview(frame, dice);
  const left = (die: number) =>
    (hitDice.find((each) => each.die === die)?.left ?? 0) -
    dice.filter((each) => each.die === die).length;
  const food = frame === 'long' && system.restNeedsFood(character);
  // The hit dice spent are listed with their rolls above, so the list below leaves them out.
  const rolled = shown.lines.filter(
    (line): line is Extract<RestLine, { kind: 'hitDie' }> => line.kind === 'hitDie',
  );
  const comes = shown.lines.filter((line) => line.kind !== 'hitDie');
  return (
    <BottomSheet title={t(`${frame}.title`)} onClose={onClose}>
      <div className="flex flex-col gap-3 pb-3" data-rest-frame={frame}>
        {frame === 'short' && (
          <section className="flex flex-col gap-2" aria-labelledby="rest-dice-heading">
            <h3
              id="rest-dice-heading"
              className="m-0 text-12 font-semibold tracking-wide text-muted uppercase"
            >
              {t('diceHeading')}
            </h3>
            {hitDice.length === 0 && <p className="m-0 text-15 text-muted">{t('noDice')}</p>}
            <TypedFaces fields={fields} typed={typed} onChange={setTyped} />
            {hitDice.map(({ die, max }, at) => (
              <div key={die} className="flex items-center gap-3" data-testid="rest-dice">
                <span className="grow text-15">
                  {t('left', { die: `d${die}`, left: left(die), max })}
                </span>
                <Part
                  as="button"
                  type="button"
                  name="button-secondary"
                  disabled={
                    left(die) <= 0 ||
                    (rollMyself && !allFaces(fields.slice(at, at + 1), [typed[at] ?? '']))
                  }
                  onClick={() => spend(die, at)}
                  className={`${secondary} disabled:opacity-disabled`}
                >
                  {t('spend', { die: `d${die}` })}
                </Part>
              </div>
            ))}
            {dice.map((each, at) => (
              // A spent die has no id; its place in the list is its key.
              // biome-ignore lint/suspicious/noArrayIndexKey: the list only changes at its end.
              <div key={at} className="flex items-center gap-3 text-14" data-testid="rest-spent">
                <span className="grow">
                  {t('spent', { die: `d${each.die}`, roll: each.roll, hp: rolled[at]?.hp ?? 0 })}
                </span>
                <Part
                  as="button"
                  type="button"
                  name="button-secondary"
                  aria-label={t('takeBack', { die: `d${each.die}`, roll: each.roll })}
                  onClick={() => setDice((spent) => spent.filter((_, place) => place !== at))}
                  className={`${secondary} text-14`}
                >
                  {t('takeBackShort')}
                </Part>
              </div>
            ))}
          </section>
        )}
        <h3 className="m-0 text-12 font-semibold tracking-wide text-muted uppercase">
          {t('willBack')}
        </h3>
        {list(comes, undefined, t(`${frame}.none`))}
        {shown.refusal !== undefined && !shown.unchanged && (
          <p className="m-0 bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
            {shown.refusal}
          </p>
        )}
        {food && (
          <p className="m-0 bg-warn-bg px-3 py-2 text-13 text-warn-text" data-testid="rest-food">
            {t('food')}
          </p>
        )}
        {failed !== undefined && (
          <p className="m-0 bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
            {failed}
          </p>
        )}
        <div className="flex gap-2">
          <Part
            as="button"
            type="button"
            name="button"
            fill="button"
            disabled={shown.refusal !== undefined}
            onClick={() => confirm(frame)}
            className={button}
          >
            {t('confirm')}
          </Part>
          <Part
            as="button"
            type="button"
            name="button-secondary"
            onClick={() => setFrame(undefined)}
            className={secondary}
          >
            {t('cancel')}
          </Part>
        </div>
      </div>
    </BottomSheet>
  );
}
