// SHEET-46: the top of the Spells tab (board V3-Spells, ADR 009 item 4): for each way the character
// casts, the stat it casts with, the spell save DC and the spell attack. The numbers are the
// header's, read from `Computed` at the paths the system names; a tap on the attack rolls it, a
// long press on either opens its breakdown. Where more than one way casts, each row names whose it is.
import { STAT_TYPE } from '@grimoire/engine';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { SheetNumber } from '../SheetNumber';

const chip = 'flex h-8.5 shrink-0 items-center px-3 text-13';
const number = 'flex items-baseline gap-1 select-none';

export function SpellcastingGlance() {
  const { t } = useTranslation('spells');
  const { character, computed, system } = useSheet();
  const rows = system.spellcasting(character, computed);
  if (rows.length === 0) return null;
  return (
    <section aria-label={t('glance.label')} className="flex flex-col gap-2">
      {rows.map(({ source, ability, dc, attack }) => {
        const stat = computed.byKey[STAT_TYPE]?.[ability];
        const abbr = stat?.type === STAT_TYPE ? nameIn(stat.abbr) : ability;
        const owner = computed.entities.find(({ entity }) => entity.id === source)?.entity;
        return (
          <div key={`${source}:${ability}`} className="flex flex-wrap items-center gap-2">
            <Part
              as="span"
              name="chip"
              className={`${chip} bg-strong font-semibold text-on-strong`}
            >
              {abbr}
            </Part>
            <Part as="span" name="chip" className={`${chip} bg-soft text-muted`}>
              <SheetNumber path={dc} label={t('glance.dc')} className={number} />
            </Part>
            <Part as="span" name="chip" className={`${chip} bg-soft text-muted`}>
              <SheetNumber
                path={attack}
                label={t('glance.attack')}
                format="signed"
                rolls
                className={number}
              />
            </Part>
            {rows.length > 1 && owner !== undefined && (
              <span className="text-12 text-muted">{nameIn(owner.name)}</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
