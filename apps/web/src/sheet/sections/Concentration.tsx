// SHEET-41: the Combat tab's concentration (SPEC §6.4, §7.2): the spell the character holds, shown
// until it ends. Its row opens the spell's description in place (SHEET-31); "End concentration"
// ends it by hand, one change with its "Undo" toast. A spell no pack holds still shows as
// "Missing: <id>" and can still be ended (SPEC §8.2). A character who concentrates on nothing
// shows no card. Starting a concentration is the cast panel's (SHEET-47); the save a hit asks for
// is the number pad's (SHEET-40).
import { finderOf } from '@grimoire/engine';
import { useTranslation } from 'react-i18next';
import { Description } from '../../shared/Description';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { useSheet } from '../SheetContext';

export function Concentration() {
  const { t } = useTranslation('concentration');
  const { character, content, system } = useSheet();
  const id = system.concentration(character);
  if (id === undefined) return null;
  const found = finderOf(character, content.index)(id);
  const end = () =>
    perform(character, (stamp) => system.endConcentration(character, content.index, stamp)).catch(
      (error: unknown) => console.error(error),
    );
  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col gap-1 py-3"
      aria-label={t('title')}
      data-concentration={id}
    >
      <h2 className="px-4 font-heading text-18 font-bold">{t('title')}</h2>
      {found === undefined || found.type !== 'spell' ? (
        <p className="px-4 py-2 text-15 text-muted">{t('missing', { id })}</p>
      ) : (
        <Description entity={found}>
          {found.level === 0 ? t('cantrip') : t('level', { level: found.level })}
        </Description>
      )}
      <div className="px-4 pt-1">
        <button
          type="button"
          onClick={end}
          className="flex min-h-control items-center rounded-button border border-strong px-4 text-15 font-semibold"
        >
          {t('end')}
        </button>
      </div>
    </Part>
  );
}
