// SHEET-32: a skill's or a save's proficiency, as the board draws it: a ring when there is none, a
// filled dot when proficient. Half proficiency is a ring in the text colour, expertise a filled dot
// inside a ring. The mark's words are the dot's label.
import type { ProficiencyMark } from '@grimoire/system-5e';
import { useTranslation } from 'react-i18next';

const dots: Record<ProficiencyMark, string> = {
  none: 'border-2 border-muted',
  half: 'border-2 border-strong',
  full: 'border-2 border-strong bg-strong',
  expert: 'border-2 border-strong bg-strong ring-1 ring-strong ring-offset-2 ring-offset-surface',
};

export function ProficiencyDot({ mark, className }: { mark: ProficiencyMark; className?: string }) {
  const { t } = useTranslation('checks');
  return (
    <span
      role="img"
      aria-label={t(`proficiency.${mark}`)}
      data-mark={mark}
      className={`flex size-3 shrink-0 items-center justify-center ${className ?? ''}`}
    >
      <span className={`size-2 rounded-pill ${dots[mark]}`} />
    </span>
  );
}
