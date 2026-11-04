// SHEET-51: the Gear tab's coins (SPEC §7.2, board V3-Sheet): each coin of the character's system
// with how many it holds, and a − and a + for each step the system offers. Each tap is one change
// with its "Undo" toast. A step that would take a count below 0 is not offered: its button is off.
// Which coins and which steps exist is the module's (`system.coins`), not this file's.
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { useSheet } from '../SheetContext';

const stepButton = 'flex size-control shrink-0 items-center justify-center text-15 text-text';

export function Coins() {
  const { t } = useTranslation('coins');
  const { character, system } = useSheet();
  const { coins, steps } = system.coins(character);

  const step = (coin: (typeof coins)[number]['coin'], by: number) =>
    perform(character, (stamp) => system.changeCoin(character, { coin, step: by }, stamp)).catch(
      (error: unknown) => console.error(error),
    );

  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col py-3"
      aria-label={t('title')}
    >
      <h2 className="px-4 pb-2 font-heading text-18 font-bold">{t('title')}</h2>
      <ul className="flex flex-col divide-y divide-line">
        {coins.map(({ coin, amount }) => {
          const name = t(`name.${coin}`, { defaultValue: coin });
          return (
            <li key={coin} data-coin={coin} className="flex items-center gap-1 px-4 py-1">
              <span className="w-9 shrink-0 text-14 font-semibold text-muted">
                {t(`short.${coin}`, { defaultValue: coin })}
              </span>
              {[...steps].reverse().map((by) => (
                <Part
                  key={`-${by}`}
                  as="button"
                  type="button"
                  name="button-secondary"
                  aria-label={t('take', { count: by, name })}
                  disabled={amount < by}
                  className={stepButton}
                  onClick={() => step(coin, -by)}
                >
                  {t('minus', { count: by })}
                </Part>
              ))}
              <span
                className="min-w-0 grow text-center text-18 font-bold"
                data-testid="coin-amount"
              >
                {t('amount', { value: amount })}
              </span>
              {steps.map((by) => (
                <Part
                  key={`+${by}`}
                  as="button"
                  type="button"
                  name="button-secondary"
                  aria-label={t('add', { count: by, name })}
                  className={stepButton}
                  onClick={() => step(coin, by)}
                >
                  {t('plus', { count: by })}
                </Part>
              ))}
            </li>
          );
        })}
      </ul>
    </Part>
  );
}
