// SHEET-12: the player page's six sections (ADR 013 item 17, board V3-Player). Characters opens
// the list and shows how many are stored, with no limit (ADR 005 item 2); the other five open with
// their phases (Dice roll with SHEET-38) and show as coming later until then.
import {
  Bookmark,
  BookOpen,
  Dices,
  type LucideIcon,
  ScrollText,
  Search,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { countCharacters } from '../db/characters';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';
import { Part } from '../theme/Part';

const tile = 'flex h-32 flex-col justify-end gap-1 p-3.5';

interface Section {
  key: 'characters' | 'sources' | 'library' | 'dice' | 'quickRules' | 'bookmarks';
  icon: LucideIcon;
  /** Where the tile goes; none while the section's phase has not opened. */
  to?: string;
}

export const sections: readonly Section[] = [
  { key: 'characters', icon: Users, to: paths.characters },
  { key: 'sources', icon: BookOpen },
  { key: 'library', icon: Search },
  { key: 'dice', icon: Dices },
  { key: 'quickRules', icon: ScrollText },
  { key: 'bookmarks', icon: Bookmark },
];

/** The six tiles; `characters` is the stored count, `undefined` until it is read. */
export function PlayerSections({ characters }: { characters: number | undefined }) {
  const { t } = useTranslation('player');
  const { t: tc } = useTranslation();
  return (
    <div className="grid grid-cols-2 content-start gap-2.5 px-4 pb-4">
      {sections.map(({ key, icon: Icon, to }) => {
        const content = (
          <>
            <Icon aria-hidden className="size-[30px] shrink-0" />
            <span className="text-16 font-bold">{t(`${key}.title`)}</span>
            <span className="min-h-[1lh] text-12 text-muted">
              {to === undefined
                ? tc('comingLater')
                : characters !== undefined && t('characters.count', { count: characters })}
            </span>
          </>
        );
        return to === undefined ? (
          <Part key={key} name="card" fill="card" className={`${tile} text-muted`}>
            {content}
          </Part>
        ) : (
          <Part key={key} as={Link} name="card" fill="card" to={to} className={tile}>
            {content}
          </Part>
        );
      })}
    </div>
  );
}

export function PlayerPage() {
  const { t } = useTranslation('player');
  const [characters, setCharacters] = useState<number>();
  useEffect(() => {
    let current = true;
    countCharacters().then(
      (count) => current && setCharacters(count),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);
  return (
    <Page title={t('title')} back={paths.start} gear>
      <PlayerSections characters={characters} />
    </Page>
  );
}
