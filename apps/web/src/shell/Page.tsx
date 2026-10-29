// SHEET-11: the frame of a page: its header (back arrow, title, gear) above what the page holds.
// SHEET-24: a page may put its own control at the header's end, before the gear (My characters' +).
import { ChevronLeft, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';
import { paths } from './routes';

const iconButton = 'flex size-control shrink-0 items-center justify-center text-text';
const icon = 'size-[22px]';

/**
 * Where the back arrow goes: a path, or `history`, a step back to the page the person came from,
 * for a page opened from many places (Settings). With no step to take, `history` goes to the start.
 */
export type Back = string;

export function BackButton({ to }: { to: Back }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { key } = useLocation();
  const label = t('back');
  // React Router names the first page of a visit `default`: there is nothing to step back to.
  if (to === 'history' && key !== 'default') {
    return (
      <Part
        as="button"
        type="button"
        name="icon-button"
        aria-label={label}
        className={iconButton}
        onClick={() => navigate(-1)}
      >
        <ChevronLeft aria-hidden className={icon} />
      </Part>
    );
  }
  return (
    <Part
      as={Link}
      name="icon-button"
      to={to === 'history' ? paths.start : to}
      aria-label={label}
      className={iconButton}
    >
      <ChevronLeft aria-hidden className={icon} />
    </Part>
  );
}

export function GearLink() {
  const { t } = useTranslation();
  return (
    <Part
      as={Link}
      name="icon-button"
      to={paths.settings}
      aria-label={t('settings')}
      className={iconButton}
    >
      <SlidersHorizontal aria-hidden className={icon} />
    </Part>
  );
}

interface PageProps {
  title: string;
  back: Back;
  gear?: boolean;
  /** The page's own control, at the header's end. */
  action?: ReactNode;
  children?: ReactNode;
}

export function Page({ title, back, gear = false, action, children }: PageProps) {
  return (
    <Slot as="main" name="page" className="flex min-h-dvh flex-col">
      <header className="flex h-15 shrink-0 items-center gap-1 px-1">
        <BackButton to={back} />
        <h1 className="grow font-heading text-28 leading-tight font-bold">{title}</h1>
        {action}
        {gear && <GearLink />}
      </header>
      {children}
    </Slot>
  );
}
