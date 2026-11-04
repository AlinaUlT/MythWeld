// SHEET-44: the Combat tab's attacks (SPEC §7.2, board V3-Sheet, BRIEF P4: "the greatsword attack
// row"): each equipped weapon that has an attack, as a row. The name opens the weapon's description
// in place (SHEET-31), with its dice, its damage bonus and type, and its mastery property
// ("Mastery: Graze", or that the character has not mastered it). The attack bonus is a number: a
// tap rolls it (SHEET-39), a long press opens its breakdown, as does the damage bonus. A character
// with no weapon equipped is told where to equip one. Equipping is the Gear tab's (SHEET-50).
import { finderOf } from '@grimoire/engine';
import { useTranslation } from 'react-i18next';
import { Description } from '../../shared/Description';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { SheetNumber } from '../SheetNumber';
import { wordsOf } from './AboutList';

export function Attacks() {
  const { t } = useTranslation('attacks');
  const { character, content, computed, system } = useSheet();
  const attacks = system.attacks(computed);
  const find = finderOf(character, content.index);
  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col gap-1 py-3"
      aria-label={t('title')}
    >
      <h2 className="px-4 font-heading text-18 font-bold">{t('title')}</h2>
      {attacks.length === 0 ? (
        <p className="px-4 py-2 text-15 text-muted">{t('none')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {attacks.map(({ item, key, kind, hit, damage, mastery }) => {
            const weapon = find(item);
            if (weapon === undefined) return null;
            const type =
              damage === undefined
                ? undefined
                : (() => {
                    const entry = computed.byKey.damageType?.[damage.type];
                    return entry === undefined
                      ? wordsOf(damage.type).toLowerCase()
                      : nameIn(entry.name);
                  })();
            const masteryEntry =
              mastery === undefined ? undefined : computed.byKey.weaponMastery?.[mastery.key];
            const masteryName =
              mastery === undefined
                ? undefined
                : masteryEntry === undefined
                  ? wordsOf(mastery.key)
                  : nameIn(masteryEntry.name);
            return (
              <li key={key} data-attack={key} className="flex items-center">
                <div className="min-w-0 grow">
                  <Description entity={weapon}>
                    {[
                      t(`kind.${kind}`),
                      ...(mastery === undefined || masteryName === undefined
                        ? []
                        : [t(mastery.uses ? 'mastery' : 'notMastered', { name: masteryName })]),
                    ].join(t('separator'))}
                  </Description>
                  {damage !== undefined && (
                    <p className="flex flex-wrap items-baseline gap-x-1 px-4 pb-2 text-14">
                      <span className="text-muted">{t('damage')}</span>
                      <span className="font-semibold">{damage.dice}</span>
                      <SheetNumber
                        path={damage.path}
                        label={t('damageBonus')}
                        format="signed"
                        className="flex items-baseline"
                        labelClassName="sr-only"
                        valueClassName="font-semibold"
                      />
                      <span>{type}</span>
                    </p>
                  )}
                </div>
                <SheetNumber
                  path={hit}
                  label={t('attack')}
                  format="signed"
                  rolls
                  className="mr-3 flex min-h-control min-w-16 shrink-0 flex-col items-center justify-center"
                  labelClassName="text-12 text-muted"
                  valueClassName="text-20 font-bold"
                />
              </li>
            );
          })}
        </ul>
      )}
    </Part>
  );
}
