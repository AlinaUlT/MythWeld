// SHEET-42: the two panels the Conditions section opens (SPEC §7.2, board V3-Sheet's "Add"): one
// condition's panel, with its description, its level and "Remove", and the list to add one from.
// Each change is one entry from the character's module, stored with its "Undo" toast: a level that
// kills ends every attunement in the same entry (ENG-69), and exhaustion at its highest level is
// death, which gives no number (ENG-67), so the panel says so. A condition another entry gives is
// shown but cannot be changed here: end what gives it. A condition no pack holds is "Missing".
import { finderOf, shareRuleset } from '@grimoire/engine';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../shared/BottomSheet';
import { Description } from '../../shared/Description';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

const option =
  'flex min-h-control w-full items-center justify-between gap-2 px-3 text-left text-15';

/** The panel of the condition `id`, stored or given. */
export function ConditionPanel({ id, onClose }: PanelProps & { id: string }) {
  const { t } = useTranslation('conditions');
  const { character, content, computed, system } = useSheet();
  const find = finderOf(character, content.index);
  const { had, missing } = system.conditions(character, computed, find);
  const shown = had.find((one) => one.id === id);
  const entity = find(id);
  const run = (action: Parameters<typeof perform>[1], close = false) =>
    perform(character, action)
      .then(() => {
        if (close) onClose();
      })
      .catch((error: unknown) => console.error(error));
  const nameOfId = (given: string) => {
    const found = find(given);
    return found === undefined ? given : nameIn(found.name);
  };

  if (shown === undefined || entity === undefined) {
    // Stored, and no entry holds it; or already gone: the panel offers to end what is left.
    return (
      <BottomSheet title={t('missing', { id })} onClose={onClose}>
        <div className="flex flex-col gap-3 pb-3">
          {missing.some((each) => each === id) && (
            <button
              type="button"
              className="flex min-h-control items-center self-start rounded-button border border-strong px-4 text-15 font-semibold"
              onClick={() =>
                run(
                  (stamp) => system.removeCondition(character, content.index, { id }, stamp),
                  true,
                )
              }
            >
              {t('remove')}
            </button>
          )}
        </div>
      </BottomSheet>
    );
  }

  const name = nameIn(entity.name);
  const levels = Array.from({ length: shown.max }, (_, at) => at + 1);
  const deathLevel = system.fatalLevel(entity);
  return (
    <BottomSheet title={name} onClose={onClose}>
      <div className="flex flex-col gap-3 pb-3">
        <Description entity={entity} />
        {shown.withheld && (
          <p className="bg-warn-bg px-3 py-2 text-13 text-warn-text" role="status">
            {t('immune')}
          </p>
        )}
        {shown.fatal && (
          <p className="bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
            {t('death', { name })}
          </p>
        )}
        {shown.stored && shown.max > 1 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-12 font-semibold tracking-wide text-muted uppercase">
              {t('levelHeading')}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {levels.map((level) => (
                <li key={level}>
                  <Part
                    as="button"
                    type="button"
                    name="chip"
                    aria-pressed={level === shown.level}
                    aria-label={t('setLevel', { name, level })}
                    onClick={() =>
                      run((stamp) =>
                        system.setConditionLevel(character, content.index, { id, level }, stamp),
                      )
                    }
                    className={`flex min-h-control min-w-control items-center justify-center px-3 text-15 font-semibold ${level === shown.level ? 'bg-strong text-on-strong' : 'bg-soft'}`}
                  >
                    {level === deathLevel ? t('levelDeath', { level }) : level}
                  </Part>
                </li>
              ))}
            </ul>
          </div>
        )}
        {shown.stored ? (
          <button
            type="button"
            className="flex min-h-control items-center self-start rounded-button border border-strong px-4 text-15 font-semibold"
            onClick={() =>
              run((stamp) => system.removeCondition(character, content.index, { id }, stamp), true)
            }
          >
            {t('remove')}
          </button>
        ) : (
          <p className="text-14 text-muted">
            {shown.givenBy.length === 0
              ? t('givenByRule')
              : t('givenBy', { names: shown.givenBy.map(nameOfId).join(t('and')) })}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

/** The list the person adds a condition from. */
export function AddConditionPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('conditions');
  const { character, content, system } = useSheet();
  const choices = system.conditionsToAdd(character, content.index);
  const add = (id: string) =>
    perform(character, (stamp) => system.setConditionLevel(character, content.index, { id }, stamp))
      .then(onClose)
      .catch((error: unknown) => console.error(error));
  return (
    <BottomSheet title={t('addTitle')} onClose={onClose}>
      <div className="flex flex-col pb-3">
        {choices.length === 0 && <p className="py-2 text-15 text-muted">{t('noneToAdd')}</p>}
        <ul className="flex flex-col divide-y divide-line">
          {choices.map((entity) => {
            const other =
              entity.ruleset !== 'any' && !shareRuleset(entity.ruleset, character.ruleset);
            const edition = character.allowMixedRulesets || other ? ` · ${entity.ruleset}` : '';
            return (
              <li key={entity.id} data-condition={entity.id}>
                <button type="button" className={option} onClick={() => add(entity.id)}>
                  <span>
                    {nameIn(entity.name)}
                    {edition}
                  </span>
                </button>
                {other && (
                  <p className="mx-3 mb-2 bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
                    {t(character.allowMixedRulesets ? 'otherRuleset' : 'otherRulesetNotMixing', {
                      ruleset: entity.ruleset,
                    })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </BottomSheet>
  );
}
