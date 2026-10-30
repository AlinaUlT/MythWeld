// SHEET-30: the header's inspiration stars, its own file and i18n namespace (`inspiration`).
// SHEET-55: the stars (ADR 009 item 5, board V3-Sheet): one eight-pointed star for each of the
// house rules' maximum, filled for each one held. An empty star tapped gains one, a filled star
// tapped spends one; each is a log entry with "Undo" (SPEC §7.2). Next to them, the edition's own
// maximum when the house rule differs; what spending does is the group's description.
import type { LogEntry } from '@grimoire/schema';
import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import { useSheet } from '../SheetContext';

/** The star's outline, in a 24-unit box: eight points, outer radius 10.5, inner radius 6.2. */
const STAR =
  '12,1.5 14,7.2 19.4,4.6 16.8,10 22.5,12 16.8,14 19.4,19.4 14,16.8 12,22.5 10,16.8 4.6,19.4 7.2,14 1.5,12 7.2,10 4.6,4.6 10,7.2';

export function Inspiration() {
  const { t } = useTranslation('inspiration');
  const { character, system } = useSheet();
  const { term, held, max, editionMax, use } = system.inspiration(character);
  const name = t(`name.${term}`);
  const stars = Array.from({ length: max }, (_, at) => ({ n: at + 1, filled: at < held }));

  const change = async (gain: boolean) => {
    const stamp = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      by: { role: 'player' as const, name: character.name },
    };
    const made = gain
      ? system.gainInspiration(character, stamp)
      : system.spendInspiration(character, stamp);
    if (!made.ok) return console.warn(made.message);
    const entry: LogEntry = made.entry;
    const saved = await changeCharacter(character.id, entry);
    if (!saved.ok) console.warn(saved.message);
  };

  return (
    <span className="flex items-center gap-2">
      <fieldset
        aria-label={t('summary', { name, held, max })}
        title={t(`use.${use}`)}
        className="m-0 flex gap-0.5 border-0 p-0"
      >
        {stars.map(({ n, filled }) => {
          return (
            <button
              key={n}
              type="button"
              aria-label={t(filled ? 'spend' : 'gain', { name })}
              onClick={() => void change(!filled)}
              className="flex size-[18px] shrink-0 items-center justify-center text-strong"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]">
                <polygon
                  points={STAR}
                  fill={filled ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          );
        })}
      </fieldset>
      {max !== editionMax && (
        <span className="text-11 whitespace-nowrap text-muted">
          {t('rulesMax', { max: editionMax })}
        </span>
      )}
    </span>
  );
}
