// SHEET-55: the header's inspiration stars (ADR 009 item 5, board V3-Sheet): as many eight-pointed
// stars as the house rules' maximum, the ones held filled. A tap on a filled star spends one, a
// tap on an empty star gains one; each is one change with its "Undo" toast (ENG-59, SHEET-23).
// Next to the stars, when the house rules allow more than the edition does, the edition's own
// maximum. What a spent one does to a roll is the roll dialog's (SHEET-39).
import { useTranslation } from 'react-i18next';
import { perform } from '../changes';
import { useSheet } from '../SheetContext';

const POINTS = 8;
const OUTER = 10.5;
const INNER = 5.2;
const CENTRE = 12;

/** The eight-pointed star of the board, as the points of a polygon in a 24-unit square. */
export const STAR_POINTS = Array.from({ length: POINTS * 2 }, (_, at) => {
  const radius = at % 2 === 0 ? OUTER : INNER;
  const angle = (at * Math.PI) / POINTS;
  return `${(CENTRE + radius * Math.sin(angle)).toFixed(2)},${(CENTRE - radius * Math.cos(angle)).toFixed(2)}`;
}).join(' ');

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[18px] shrink-0">
      <polygon
        points={STAR_POINTS}
        className={`stroke-current stroke-[1.4] [stroke-linejoin:round] ${filled ? 'fill-current' : 'fill-none'}`}
      />
    </svg>
  );
}

export function Inspiration() {
  const { t } = useTranslation('inspiration');
  const { character, system } = useSheet();
  const { held, max, rules, term } = system.inspiration(character);

  const tap = (filled: boolean) => {
    const action = filled ? system.spendInspiration : system.gainInspiration;
    perform(character, (stamp) => action(character, stamp)).catch((error: unknown) =>
      console.error(error),
    );
  };

  return (
    <div className="flex h-8 items-center gap-2 border-t border-line px-4">
      <fieldset className="m-0 flex min-w-0 border-0 p-0">
        <legend className="sr-only">{t(`label.${term}`, { held, max })}</legend>
        {Array.from({ length: max }, (_, at) => {
          const filled = at < held;
          return (
            <button
              // The stars are a fixed row, so their place is their key.
              // biome-ignore lint/suspicious/noArrayIndexKey: the row never changes order.
              key={at}
              type="button"
              aria-label={t(filled ? 'spend' : 'gain')}
              data-filled={filled}
              onClick={() => tap(filled)}
              className="relative flex size-5 items-center justify-center text-text before:absolute before:-inset-x-0.5 before:-inset-y-3.5 before:content-['']"
            >
              <Star filled={filled} />
            </button>
          );
        })}
      </fieldset>
      {max !== rules.max && (
        <span className="text-11 whitespace-nowrap text-muted">
          {t('rules', { max: rules.max })}
        </span>
      )}
    </div>
  );
}
