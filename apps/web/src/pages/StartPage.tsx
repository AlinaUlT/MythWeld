// SHEET-11: the start page (ADR 008 item 2, ADR 013 item 16, board V3-Start): the app's name, the
// game system, and two squares, Player and DM. The DM side opens with the DM tools' phase. The
// page has no back arrow: until a second system brings the system picker (ADR 013 item 15), there
// is nothing before it.
import { Crown, type LucideIcon, ShieldPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { APP_NAME } from '../config/app';
import { GearLink } from '../shell/Page';
import { paths } from '../shell/routes';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';

// A const, not a string in place: SHEET-02's check reads any `fill="…"` as an SVG colour.
const cardFill = 'card';

const square =
  'flex aspect-[1/1.1] grow basis-0 flex-col items-center justify-center gap-2.5 p-4 text-center';

function SquareContent({
  icon: Icon,
  title,
  line,
}: {
  icon: LucideIcon;
  title: string;
  line: ReactNode;
}) {
  return (
    <>
      <span className="flex size-18 items-center justify-center rounded-full bg-soft">
        <Icon aria-hidden className="size-10" />
      </span>
      <span className="font-heading text-28 leading-tight font-bold">{title}</span>
      {line}
    </>
  );
}

export function StartPage() {
  const { t } = useTranslation('start');
  const { t: tc } = useTranslation();
  return (
    <Slot as="main" name="page" className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-end px-1">
        <GearLink />
      </header>
      <div className="flex grow flex-col items-center justify-center gap-2.5 px-4 text-center">
        <h1 className="font-heading text-48 leading-tight font-bold break-words">{APP_NAME}</h1>
        <Part name="chip" className="flex h-7.5 items-center bg-soft px-3 text-13 text-muted">
          {t('system')}
        </Part>
      </div>
      <div className="flex shrink-0 gap-3 px-4 pb-12">
        <Part as={Link} name="card" fill={cardFill} to={paths.player} className={square}>
          <SquareContent
            icon={ShieldPlus}
            title={t('player.title')}
            line={<span className="text-12 text-muted">{t('player.hint')}</span>}
          />
        </Part>
        <Part name="card" fill={cardFill} className={`${square} text-muted`}>
          <SquareContent
            icon={Crown}
            title={t('dm.title')}
            line={<span className="text-12">{tc('comingLater')}</span>}
          />
        </Part>
      </div>
    </Slot>
  );
}
