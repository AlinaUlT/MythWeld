// SHEET-49: the Turn tab (ADR 010 item 8, board V3-Turn): "On your turn, a reminder, from your
// features". The features are grouped by when they are used, from each one's `activation` (the
// module's `turn`): action, bonus action, reaction, no action, always on, other, and the limited
// uses of a feature that names no timing. The equipped weapons' attacks are the first lines of
// "Action", from the Combat tab's own attack list, so nothing is typed twice. Each feature opens its
// description in place, and shows what gave it, and its uses with when they come back.
import { finderOf, resourceUses } from '@grimoire/engine';
import { useTranslation } from 'react-i18next';
import { Description } from '../../shared/Description';
import type { TurnGroup, TurnTiming } from '../../systems';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { SheetNumber } from '../SheetNumber';
import { wordsOf } from './AboutList';
import { Recovery } from './FeatureList';

const heading = 'px-4 pt-2 text-12 font-semibold tracking-wide text-muted uppercase';

/** An attack as one line: its name, what it rolls to hit, its damage and its mastery. */
function AttackLine({
  attack,
}: {
  attack: ReturnType<ReturnType<typeof useSheet>['system']['attacks']>[number];
}) {
  const { t } = useTranslation('turn');
  const { character, content, computed } = useSheet();
  const weapon = finderOf(character, content.index)(attack.item);
  if (weapon === undefined) return null;
  const { damage, mastery } = attack;
  const typeEntry = damage === undefined ? undefined : computed.byKey.damageType?.[damage.type];
  const typeName =
    damage === undefined
      ? undefined
      : typeEntry === undefined
        ? wordsOf(damage.type).toLowerCase()
        : nameIn(typeEntry.name);
  const masteryEntry =
    mastery === undefined ? undefined : computed.byKey.weaponMastery?.[mastery.key];
  const masteryName =
    mastery === undefined
      ? undefined
      : masteryEntry === undefined
        ? wordsOf(mastery.key)
        : nameIn(masteryEntry.name);
  return (
    <li data-turn-attack={attack.key} className="flex flex-col px-4 py-2.5">
      <span className="text-15 font-bold">{t('attack', { name: nameIn(weapon.name) })}</span>
      <p className="flex flex-wrap items-baseline gap-x-1 text-13 text-muted">
        <SheetNumber
          path={attack.hit}
          label={t('toHit')}
          format="signed"
          rolls
          labelAfter
          className="inline-flex min-h-control items-baseline gap-1"
          valueClassName="font-semibold text-text"
        />
        {damage !== undefined && (
          <>
            <span aria-hidden>{t('separator')}</span>
            <span className="font-semibold text-text">{damage.dice}</span>
            <SheetNumber
              path={damage.path}
              label={t('damageBonus')}
              format="signed"
              className="inline-flex items-baseline"
              labelClassName="sr-only"
              valueClassName="font-semibold text-text"
            />
            <span>{typeName}</span>
          </>
        )}
        {masteryName !== undefined && mastery?.uses && (
          <>
            <span aria-hidden>{t('separator')}</span>
            <span>{t('mastery', { name: masteryName })}</span>
          </>
        )}
      </p>
    </li>
  );
}

/** A feature as a row: its description in place, what gave it, and its uses. */
function FeatureLine({ row }: { row: TurnGroup['rows'][number] }) {
  const { t } = useTranslation('turn');
  const { character, content, computed, system } = useSheet();
  const find = finderOf(character, content.index);
  const found = find(row.id);
  if (found === undefined) {
    return <li className="px-4 py-2 text-14 text-muted">{t('missing', { id: row.id })}</li>;
  }
  const { kind, source } = row.source;
  const term = system.terms(character.ruleset).species;
  const origin =
    kind === 'feats'
      ? t('source.feats')
      : kind === 'species'
        ? t(term === 'race' ? 'source.race' : 'source.species')
        : source === undefined
          ? t('source.background')
          : (() => {
              const entity = find(source);
              return entity === undefined ? source : nameIn(entity.name);
            })();
  const uses = row.resources.flatMap((key) => {
    const each = resourceUses(character, computed, key);
    return each === undefined ? [] : [{ key, left: each.left, max: Math.floor(each.max) }];
  });
  return (
    <li data-turn-feature={row.id} className="flex flex-col">
      <Description entity={found}>
        {[origin, ...uses.map(({ left, max }) => t('left', { left, max }))].join(t('separator'))}
      </Description>
      {uses.map(({ key }) => (
        <div key={key} className="px-4 pb-2">
          <Recovery resource={key} />
        </div>
      ))}
    </li>
  );
}

export function TurnList() {
  const { t } = useTranslation('turn');
  const { character, computed, system } = useSheet();
  const attacks = system.attacks(computed);
  const found = system.turn(character, computed);
  // The attacks open the "Action" group, which exists for them when no feature is an action.
  const groups: TurnGroup[] =
    attacks.length > 0 && !found.some(({ timing }) => timing === 'action')
      ? [{ timing: 'action', rows: [] }, ...found]
      : found;
  if (groups.length === 0) return <p className="px-1 py-2 text-15 text-muted">{t('none')}</p>;
  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col py-3"
      aria-label={t('title')}
    >
      <header className="flex flex-col gap-0.5 px-4 pb-1">
        <h2 className="font-heading text-18 font-bold">{t('title')}</h2>
        <p className="text-12 text-muted">{t('hint')}</p>
      </header>
      {groups.map(({ timing, rows }) => (
        <section
          key={timing}
          data-timing={timing satisfies TurnTiming}
          aria-label={t(`group.${timing}`)}
        >
          <h3 className={heading}>{t(`group.${timing}`)}</h3>
          <ul className="flex flex-col divide-y divide-line">
            {timing === 'action' &&
              attacks.map((attack) => <AttackLine key={attack.key} attack={attack} />)}
            {rows.map((row) => (
              <FeatureLine key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </Part>
  );
}
