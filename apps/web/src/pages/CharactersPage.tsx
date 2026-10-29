// SHEET-24: My characters (ADR 008 item 4, board V3-Characters): one card per saved character,
// newest change first, each opening its sheet; "+" makes a new one. Every row opens through its
// migration frame; one that does not open is listed with its reason and opens nothing (SPEC §8.2).
// No counter and no limit before the payment phase (ADR 005 item 2).
// SHEET-25: a card swiped left shows Copy, DM link, Delete and More; More, or the card's "⋯",
// opens the character's Actions. The list is watched, so a copy, a deletion and its undo show at
// once.
// SHEET-26: "Import file" reads a character file through its checks; a refused one shows its
// reason in a card above the list, and nothing of it is saved.
import type { L10n } from '@grimoire/schema';
import { liveQuery } from 'dexie';
import type { TFunction } from 'i18next';
import { Copy, Ellipsis, Link2, type LucideIcon, Plus, Trash2 } from 'lucide-react';
import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { contentOf, type InstalledPack } from '../content/packs';
import { type ListedCharacter, listCharacters } from '../db/characters';
import {
  type ActionsTarget,
  CharacterActions,
  copyTarget,
  deleteTarget,
} from '../shared/CharacterActions';
import { ImportButton, ImportRefusal, type RefusedFile } from '../shared/CharacterImport';
import { Page } from '../shell/Page';
import { paths, sheetPath } from '../shell/routes';
import { type AppCharacter, listLineOf } from '../systems';
import { motionStyle } from '../theme/motions';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';

/** How far a card slides open: its four actions, 60 px each (board V3-Characters). */
export const ACTIONS_PX = 240;

/** How far a drag goes, in pixels, before it is a swipe and not a tap. */
const DRAG_PX = 8;

/** How far a swipe goes, in pixels, before it opens or closes the card. */
export const SWIPE_PX = 56;

/** Whether a card that was `open` is open after a sideways drag of `dx` pixels. */
export function swipedOpen(open: boolean, dx: number): boolean {
  return open ? dx < SWIPE_PX : dx <= -SWIPE_PX;
}

/** Where a card that was `open` is drawn while it is dragged by `dx` pixels. */
export function cardOffset(open: boolean, dx: number): number {
  return Math.min(0, Math.max(-ACTIONS_PX, (open ? -ACTIONS_PX : 0) + dx));
}

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

function OpenedCard({ character, t }: { character: AppCharacter; t: CharactersT }) {
  return (
    <Part
      as={Link}
      name="card"
      fill="card"
      to={sheetPath(character.id)}
      draggable={false}
      className={`${card} h-full pr-14`}
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
    </Part>
  );
}

function UnopenedCard({ listed, t }: { listed: ListedCharacter; t: CharactersT }) {
  if (listed.opened.ok) return null;
  const name = listed.name ?? t('unnamed');
  return (
    <Part name="card" fill="card" className={`${card} h-full pr-14 text-muted`}>
      <Portrait name={name} />
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-19 font-bold">{name}</span>
        <span className="text-13">{t(`unopened.${listed.opened.code}`)}</span>
      </span>
    </Part>
  );
}

interface SwipeActionProps {
  icon: LucideIcon;
  label: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/** One of the actions under a swiped card; with no `onClick` it is shown, not tappable. */
function SwipeAction({ icon: Icon, label, className = '', style, onClick }: SwipeActionProps) {
  return (
    <button
      type="button"
      disabled={onClick === undefined}
      onClick={onClick}
      style={style}
      className={`flex h-full w-15 flex-col items-center justify-center gap-1 text-12 font-semibold text-on-strong disabled:opacity-40 ${className}`}
    >
      <Icon aria-hidden className="size-[22px]" />
      {label}
    </button>
  );
}

interface SwipeRowProps {
  target: ActionsTarget;
  open: boolean;
  onSwipe: (open: boolean) => void;
  onActions: () => void;
  children: ReactNode;
}

/**
 * A card that a swipe left slides open over its actions, and a swipe right closes. A tap on an
 * open card closes it; a drag never opens the sheet. Its "⋯" opens the Actions without a swipe.
 */
function SwipeRow({ target, open, onSwipe, onActions, children }: SwipeRowProps) {
  const { t } = useTranslation('actions');
  const [dx, setDx] = useState<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number; sideways: boolean } | undefined>(undefined);
  const dragged = useRef(false);
  const run = (action: () => void) => () => {
    onSwipe(false);
    action();
  };

  const onPointerDown = (event: PointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY, sideways: false };
    dragged.current = false;
  };
  const onPointerMove = (event: PointerEvent) => {
    const from = start.current;
    if (from === undefined) return;
    const x = event.clientX - from.x;
    const y = event.clientY - from.y;
    if (!from.sideways) {
      if (Math.abs(x) < DRAG_PX || Math.abs(x) < Math.abs(y)) return;
      from.sideways = true;
      dragged.current = true;
      // From here the drag is the card's, wherever the pointer goes; a tap keeps its own target.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDx(x);
  };
  const onPointerEnd = (event: PointerEvent) => {
    const from = start.current;
    start.current = undefined;
    setDx(undefined);
    if (from?.sideways) onSwipe(swipedOpen(open, event.clientX - from.x));
  };

  return (
    <div
      className="relative h-21 shrink-0 overflow-hidden"
      style={{ borderRadius: 'var(--theme-part-card-border-radius)' }}
    >
      {/* Hidden while the card is closed and still, so no edge of it shows past the card's corners. */}
      <div
        className={`absolute inset-y-0 right-0 flex ${!open && dx === undefined ? 'invisible' : ''}`}
        inert={!open}
      >
        <SwipeAction
          icon={Copy}
          label={t('swipe.copy')}
          className="bg-strong"
          {...(target.opens && { onClick: run(() => void copyTarget(target, t)) })}
        />
        <SwipeAction icon={Link2} label={t('swipe.dmLink')} className="bg-strong" />
        <SwipeAction
          icon={Trash2}
          label={t('swipe.delete')}
          className="bg-danger"
          onClick={run(() => void deleteTarget(target))}
        />
        <SwipeAction
          icon={Ellipsis}
          label={t('swipe.more')}
          style={{ background: 'var(--theme-color-neutral)' }}
          onClick={run(onActions)}
        />
      </div>
      <div
        className="relative h-full touch-pan-y"
        style={{
          transform: `translateX(${cardOffset(open, dx ?? 0)}px)`,
          ...(dx === undefined && motionStyle('slide')),
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          // The click that ends a drag, and a tap on an open card, never reach the card's link;
          // the tap closes the card.
          if (!dragged.current && !open) return;
          event.preventDefault();
          event.stopPropagation();
          if (dragged.current) dragged.current = false;
          else onSwipe(false);
        }}
      >
        {children}
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('title')}
          inert={open}
          onClick={onActions}
          className="absolute top-1/2 right-1.5 flex size-control -translate-y-1/2 items-center justify-center text-muted"
        >
          <Ellipsis aria-hidden className="size-[22px]" />
        </Part>
      </div>
    </div>
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

function Empty({
  t,
  onRefused,
}: {
  t: CharactersT;
  onRefused: (refused: RefusedFile | undefined) => void;
}) {
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
      <ImportButton onRefused={onRefused} />
    </div>
  );
}

type ListState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; characters: readonly ListedCharacter[] };

/** The character a listed row is, for its Actions. */
function targetOf(listed: ListedCharacter, t: CharactersT): ActionsTarget {
  return listed.opened.ok
    ? { id: listed.id, name: listed.opened.value.name, opens: true }
    : { id: listed.id, name: listed.name ?? t('unnamed'), opens: false };
}

function List({
  characters,
  t,
  onRefused,
}: {
  characters: readonly ListedCharacter[];
  t: CharactersT;
  onRefused: (refused: RefusedFile | undefined) => void;
}) {
  const [swiped, setSwiped] = useState<string | undefined>(undefined);
  const [actions, setActions] = useState<{ target: ActionsTarget; line?: string } | undefined>(
    undefined,
  );
  if (characters.length === 0) return <Empty t={t} onRefused={onRefused} />;
  return (
    <div className="flex grow flex-col gap-2.5 px-4 py-2">
      {characters.map((listed) => {
        const target = targetOf(listed, t);
        const line = listed.opened.ok ? listLineText(listed.opened.value, t) : undefined;
        return (
          <SwipeRow
            key={listed.id}
            target={target}
            open={swiped === listed.id}
            onSwipe={(open) => setSwiped(open ? listed.id : undefined)}
            onActions={() => setActions({ target, ...(line !== undefined && { line }) })}
          >
            {listed.opened.ok ? (
              <OpenedCard character={listed.opened.value} t={t} />
            ) : (
              <UnopenedCard listed={listed} t={t} />
            )}
          </SwipeRow>
        );
      })}
      <p className="mx-1 mt-1.5 text-13 text-muted">{t('hint')}</p>
      <div className="flex justify-center">
        <ImportButton onRefused={onRefused} />
      </div>
      {actions !== undefined && (
        <CharacterActions
          target={actions.target}
          {...(actions.line !== undefined && { line: actions.line })}
          onClose={() => setActions(undefined)}
        />
      )}
    </div>
  );
}

export function CharactersPage() {
  const { t } = useTranslation('characters');
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [refused, setRefused] = useState<RefusedFile | undefined>(undefined);

  useEffect(() => {
    const watched = liveQuery(() => listCharacters()).subscribe({
      next: (characters) => setList({ status: 'ready', characters }),
      error: (error: unknown) => {
        console.error(error);
        setList({ status: 'failed' });
      },
    });
    return () => watched.unsubscribe();
  }, []);

  // While the rows are read, nothing shows under the header.
  return (
    <Page title={t('title')} back={paths.player} action={<NewCharacterLink />}>
      {refused !== undefined && (
        <ImportRefusal refused={refused} onClose={() => setRefused(undefined)} />
      )}
      {list.status === 'ready' && (
        <List characters={list.characters} t={t} onRefused={setRefused} />
      )}
      {list.status === 'failed' && <p className="px-5 py-2 text-15 text-muted">{t('failed')}</p>}
    </Page>
  );
}
