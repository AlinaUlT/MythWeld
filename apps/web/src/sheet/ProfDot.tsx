// SHEET-32: the dot of a proficiency level (board V3-Sheet): empty, half, filled, or ringed for
// expertise. It is drawn from tokens only; its words are the screen reader's.
import { useTranslation } from 'react-i18next';

/** The words key of a proficiency level (SRD: none, half, proficient, expertise). */
export function profKey(level: number): 'none' | 'half' | 'proficient' | 'expertise' {
  if (level >= 2) return 'expertise';
  if (level >= 1) return 'proficient';
  if (level > 0) return 'half';
  return 'none';
}

export function ProfDot({ level }: { level: number }) {
  const { t } = useTranslation('checks');
  const key = profKey(level);
  const fill =
    key === 'proficient' || key === 'expertise'
      ? 'bg-strong'
      : key === 'half'
        ? 'bg-linear-to-r from-strong from-50% to-transparent to-50%'
        : '';
  return (
    <span
      role="img"
      aria-label={t(`prof.${key}`)}
      data-prof={key}
      className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border-2 border-strong ${key === 'expertise' ? 'p-px' : ''}`}
    >
      {key === 'expertise' ? <span className="size-full rounded-full bg-strong" /> : null}
      {key !== 'expertise' && <span className={`size-full rounded-full ${fill}`} />}
    </span>
  );
}
