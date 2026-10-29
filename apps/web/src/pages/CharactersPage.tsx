// SHEET-24: My characters (ADR 008 item 4, board V3-Characters): one card per saved character,
// newest change first, each opening its sheet; "+" makes a new one. Every row opens through its
// migration frame; one that does not open is listed with its reason and opens nothing (SPEC §8.2).
// No counter and no limit before the payment phase (ADR 005 item 2).
// SHEET-25: a card swiped left shows Copy, DM link, Delete and More; More, or the card's "⋯",
// opens its Actions. The list follows the database, so a copy, a delete and its undo show at once.
import type { L10n } from '@grimoire/schema';
import { liveQuery } from 'dexie';
import type { TFunction } from 'i18next';
import { Copy, Ellipsis, Link2, Plus, Trash2 } from 'lucide-react';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { contentOf, type InstalledPack } from '../content/packs';
import { copyCharacter } from '../db/characterActions';
import { type ListedCharacter, listCharacters } from '../db/characters';
import { useSwipe } from '../lib/swipe';
import { CharacterActions } from '../shared/CharacterActions';
import { removeCharacter } from '../shared/undo';
import { Page } from '../shell/Page';
import { paths, sheetPath } from '../shell/routes';
import { type AppCharacter, listLineOf } from '../systems';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';

const card = 'flex h-21 items-center gap-3.5 px-3.5';

type CharactersT = TFunction<'characters'>;

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/**
 * The line under a character's name: its module's entities, each named from the character's own
 * packs, a class with its level; an id no pack holds reads `Missing: <id>`.
 */
export function listLineText(
  character: AppCharacter,
  t: CharactersT,
  packs?: readonly InstalledPack[],
): string {
  const { index } = contentOf(character, packs);
  return listLineOf(character)
    .map(({ id, level }) => {
      const found = index.get(id);
      const name = found.ok ? nameIn(found.entity.name) : t('missing', { id });
      return level === undefined ? name : t('classLevel', { name, level });
    })
    .join(t('separator'));
}

function Portrait({ name }: { name: string }) {
  return (
    <Slot
      as="span"
      name="portrait"
      className="flex size-14 shrink-0 items-center justify-center rounded-full text-24 font-bold text-on-strong"
    >
      {Array.from(name)[0]?.toLocaleUpperCase()}
    </Slot>
  );
}

/** The tray a swipe shows: four tiles, each 60 px wide (board V3-Characters). */
const TILE = 60;
const TRAY = 4 * TILE;
const tile = 'flex h-full w-15 flex-col items-center justify-center gap-1 text-12 font-semibold';
const tileIcon = 'size-[22px]';

interface TileProps {
  icon: ReactNode;
  label: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

function Tile({ icon, label, className = '', style, onClick }: TileProps) {
  return (
    <button
      type="button"
      disabled={onClick === undefined}
      onClick={onClick}
      className={`${tile} ${className}`}
      style={style}
    >
      {icon}
      {label}
    </button>
  );
}

interface OpenedCardProps {
  character: AppCharacter;
  t: CharactersT;
  swiped: boolean;
  setSwiped: (open: boolean) => void;
  onActions: () => void;
}

function OpenedCard({ character, t, swiped, setSwiped, onActions }: OpenedCardProps) {
  const { t: ta } = useTranslation('actions');
  const { offset, handlers } = useSwipe(TRAY, swiped, setSwiped);
  const act = (action: () => Promise<unknown>) => () => {
    setSwiped(false);
    action().catch(console.error);
  };
  return (
    <Part name="card" fill="card" className="relative shrink-0 overflow-hidden">
      {offset < 0 && (
        <div className="absolute inset-y-0 right-0 flex text-on-strong">
          <Tile
            icon={<Copy aria-hidden className={tileIcon} />}
            label={ta('copy')}
            className="bg-strong"
            onClick={act(() =>
              copyCharacter(character.id, { name: ta('copyName', { name: character.name }) }),
            )}
          />
          {/* Link for the DM comes with the table link's phase (ADR 005). */}
          <Tile
            icon={<Link2 aria-hidden className={tileIcon} />}
            label={ta('dmLinkShort')}
            className="bg-strong disabled:text-muted"
          />
          <Tile
            icon={<Trash2 aria-hidden className={tileIcon} />}
            label={ta('delete')}
            className="bg-danger"
            onClick={act(() => removeCharacter(character.id, character.name))}
          />
          <Tile
            icon={<Ellipsis aria-hidden className={tileIcon} />}
            label={ta('more')}
            // The lint reads `bg-neutral` as Tailwind's palette; this is the theme's token.
            style={{ background: 'var(--color-neutral)' }}
            onClick={() => {
              setSwiped(false);
              onActions();
            }}
          />
        </div>
      )}
      <Slot
        name="card"
        {...handlers}
        className={`${card} relative touch-pan-y`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        <Link
          to={sheetPath(character.id)}
          draggable={false}
          className="flex min-w-0 grow items-center gap-3.5"
        >
          <Portrait name={character.name} />
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="truncate text-19 font-bold">{character.name}</span>
              <Part
                as="span"
                name="chip"
                className="flex h-5 shrink-0 items-center bg-soft px-2 text-12 font-semibold text-muted"
              >
                {character.ruleset}
              </Part>
            </span>
            <span className="truncate text-14">{listLineText(character, t)}</span>
            <span className="text-12 text-muted">
              {t('created', { date: new Date(character.createdAt) })}
            </span>
          </span>
        </Link>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={ta('open', { name: character.name })}
          onClick={onActions}
          className="-mr-2 flex size-control shrink-0 items-center justify-center text-muted"
        >
          <Ellipsis aria-hidden className="size-6" />
        </Part>
      </Slot>
    </Part>
  );
}

function UnopenedCard({ listed, t }: { listed: ListedCharacter; t: CharactersT }) {
  if (listed.opened.ok) return null;
  const name = listed.name ?? t('unnamed');
  return (
    <Part name="card" fill="card" className={`${card} shrink-0 text-muted`}>
      <Portrait name={name} />
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-19 font-bold">{name}</span>
        <span className="text-13">{t(`unopened.${listed.opened.code}`)}</span>
      </span>
    </Part>
  );
}

function NewCharacterLink() {
  const { t } = useTranslation('characters');
  return (
    <Part
      as={Link}
      name="icon-button"
      fill="button"
      to={paths.newCharacter}
      aria-label={t('new')}
      className="mr-2 flex size-control shrink-0 items-center justify-center text-on-strong"
    >
      <Plus aria-hidden className="size-6" />
    </Part>
  );
}

function Empty({ t }: { t: CharactersT }) {
  const { t: tc } = useTranslation();
  return (
    <div className="flex grow flex-col items-center justify-center gap-3 px-4 pb-12 text-center">
      <p className="text-15 text-muted">{t('empty')}</p>
      <Part
        as={Link}
        name="button"
        fill="button"
        to={paths.newCharacter}
        className="flex h-control items-center gap-2 px-5 text-15 font-semibold text-on-strong"
      >
        <Plus aria-hidden className="size-5" />
        {t('new')}
      </Part>
      {/* Importing a file comes with SHEET-26. */}
      <Part
        as="button"
        type="button"
        name="button-secondary"
        disabled
        className="flex h-control flex-col items-center justify-center px-5 text-muted"
      >
        <span className="text-14 font-semibold">{t('import')}</span>
        <span className="text-11">{tc('comingLater')}</span>
      </Part>
    </div>
  );
}

type ListState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; characters: readonly ListedCharacter[] };

function List({ characters, t }: { characters: readonly ListedCharacter[]; t: CharactersT }) {
  // One card is swiped open at a time; Actions open for one character at a time.
  const [swiped, setSwiped] = useState<string>();
  const [actionsFor, setActionsFor] = useState<AppCharacter>();
  const closeActions = useCallback(() => setActionsFor(undefined), []);
  if (characters.length === 0) return <Empty t={t} />;
  return (
    <div className="flex grow flex-col gap-2.5 px-4 py-2">
      {characters.map((listed) => {
        const { id, opened } = listed;
        if (!opened.ok) return <UnopenedCard key={id} listed={listed} t={t} />;
        const character = opened.value;
        return (
          <OpenedCard
            key={id}
            character={character}
            t={t}
            swiped={swiped === id}
            setSwiped={(open) => setSwiped(open ? id : undefined)}
            onActions={() => setActionsFor(character)}
          />
        );
      })}
      <p className="mx-1 mt-1.5 text-13 text-muted">{t('hint')}</p>
      {actionsFor && (
        <CharacterActions
          character={actionsFor}
          line={listLineText(actionsFor, t)}
          onClose={closeActions}
        />
      )}
    </div>
  );
}

export function CharactersPage() {
  const { t } = useTranslation('characters');
  const [list, setList] = useState<ListState>({ status: 'loading' });

  useEffect(() => {
    const subscription = liveQuery(() => listCharacters()).subscribe({
      next: (characters) => setList({ status: 'ready', characters }),
      error: (error: unknown) => {
        console.error(error);
        setList({ status: 'failed' });
      },
    });
    return () => subscription.unsubscribe();
  }, []);

  // While the rows are read, nothing shows under the header.
  return (
    <Page title={t('title')} back={paths.player} action={<NewCharacterLink />}>
      {list.status === 'ready' && <List characters={list.characters} t={t} />}
      {list.status === 'failed' && <p className="px-5 py-2 text-15 text-muted">{t('failed')}</p>}
    </Page>
  );
}
