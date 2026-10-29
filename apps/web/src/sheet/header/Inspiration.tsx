// SHEET-55: the header's inspiration, eight-pointed stars (ADR 009 item 5, board V3-Sheet). One
// star per point the house rules allow (`houseRules.inspirationMax`, 3 by default); the held ones
// are filled. A filled star spent, an empty one gained, each one log entry with its "Undo" toast
// (SHEET-23). The edition's own maximum (`inspiration.max`, 1 in both SRDs) shows beside the stars,
// and what spending one does (`inspiration.use`) is their label.
import { EDITION_RULES, gainInspiration, spendInspiration } from '@grimoire/system-5e';
import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';

const STAR_POINTS = 8;

/** The star's outline: eight points, alternating the outer and the inner radius. */
function starPoints(outer: number, inner: number): string {
  return Array.from({ length: STAR_POINTS * 2 }, (_, at) => {
    const radius = at % 2 === 0 ? outer : inner;
    const angle = (Math.PI * at) / STAR_POINTS - Math.PI / 2;
    return `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

const STAR = starPoints(11, 6);

export function Inspiration() {
  const { t } = useTranslation('inspiration');
  const { character } = useSheet();
  const { houseRules, state } = character.systemData;
  const rules = EDITION_RULES[character.ruleset];
  const term = t(`term.${rules.terms.inspiration}`);
  const held = state.inspiration;

  const change = (at: number) => {
    const stamp = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      by: { role: 'player' as const, name: character.name },
    };
    const made = at < held ? spendInspiration(character, stamp) : gainInspiration(character, stamp);
    if (made.ok) void changeCharacter(character.id, made.entry);
  };

  return (
    <fieldset
      aria-label={t('group', { term, held, max: houseRules.inspirationMax })}
      className="m-0 flex min-w-0 shrink-0 items-center border-0 p-0"
    >
      {Array.from({ length: houseRules.inspirationMax }, (_, at) => {
        const filled = at < held;
        return (
          <Part
            // The stars never change order; their place is their key.
            // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
            key={at}
            as="button"
            type="button"
            name="icon-button"
            aria-pressed={filled}
            aria-label={t(filled ? 'spend' : 'gain', {
              term,
              use: t(`use.${rules.inspiration.use}`),
            })}
            onClick={() => change(at)}
            className="flex size-6 items-center justify-center"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5 stroke-current stroke-1">
              <polygon points={STAR} className={filled ? 'fill-strong' : 'fill-transparent'} />
            </svg>
          </Part>
        );
      })}
      <span className="pl-1 text-11 whitespace-nowrap text-muted">
        {t('rules', { max: rules.inspiration.max })}
      </span>
    </fieldset>
  );
}
