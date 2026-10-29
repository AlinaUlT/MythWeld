// SHEET-30: the sheet's frame (board V3-Sheet, SPEC §7.2): the header pinned above, the dock pinned
// below, the open tab scrolling between them. The stored character is watched, so each change and
// each undo shows at once; its packs load into its content index, and `compute()` runs once per
// stored version. Play mode is on each time the sheet opens. A character that does not open, and
// a pack it names that is not on the device, are said, never thrown (SPEC §8.2). The tab is kept
// in the address (`?tab=`), so going back returns to it; a sideways swipe on the tab changes it.
import { compute } from '@grimoire/engine';
import { liveQuery } from 'dexie';
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { contentOf } from '../content/packs';
import { type OpenedCharacter, openCharacter } from '../db/characters';
import { BreakdownSheet } from '../shared/BreakdownSheet';
import { RollDialog } from '../shared/RollDialog';
import { ActionsMenu } from '../sheet/panels/ActionsMenu';
import { ChoicesPanel } from '../sheet/panels/ChoicesPanel';
import { NumberPad, type NumberPadMode } from '../sheet/panels/NumberPad';
import { RestPanel } from '../sheet/panels/RestPanel';
import { SheetContext, type SheetValue } from '../sheet/SheetContext';
import { SheetDice } from '../sheet/SheetDice';
import { SheetDock } from '../sheet/SheetDock';
import { SheetHeader } from '../sheet/SheetHeader';
import { SHEET_TABS, type SheetTabId, tabOf } from '../sheet/tabs';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';
import { type AppCharacter, type SheetSystem, sheetSystemOf } from '../systems';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';

/** How far a sideways swipe goes, in pixels, before it changes the tab. */
export const SWIPE_PX = 56;

/** What the sheet has open over it, if anything. */
type Open =
  | { kind: 'roll' | 'breakdown'; path: string }
  | { kind: 'numberPad'; mode: NumberPadMode }
  | { kind: 'rest' | 'actions' | 'choices' };

type Loaded = { status: 'loading' } | { status: 'failed' } | OpenedCharacter;

/** The tab a swipe from `from` by `dx` and `dy` pixels moves to; the same tab when it is no swipe. */
export function swipedTab(from: SheetTabId, dx: number, dy: number): SheetTabId {
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 2 * Math.abs(dy)) return from;
  const at = SHEET_TABS.findIndex(({ id }) => id === from);
  const next = SHEET_TABS[at + (dx < 0 ? 1 : -1)];
  return next?.id ?? from;
}

function Message({ text }: { text: string }) {
  const { t } = useTranslation('sheet');
  return (
    <Page title={t('title')} back={paths.characters}>
      <p className="px-5 py-2 text-15 text-muted">{text}</p>
    </Page>
  );
}

function Frame({ character, system }: { character: AppCharacter; system: SheetSystem }) {
  const { t } = useTranslation('sheet');
  const [search, setSearch] = useSearchParams();
  const tab = tabOf(search.get('tab'));
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<Open | undefined>(undefined);
  const close = () => setOpen(undefined);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);

  // The index changes only with the packs; `compute()` only with the stored character.
  const packs = character.packs.join('\n');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `packs` stands for `character.packs`.
  const content = useMemo(() => contentOf(character), [character.system, packs]);
  const computed = useMemo(
    () => compute(character, content.index, system.module),
    [character, content, system],
  );

  const sheet: SheetValue = {
    character,
    content,
    computed,
    system,
    editing,
    roll: (path) => setOpen({ kind: 'roll', path }),
    breakdown: (path) => setOpen({ kind: 'breakdown', path }),
  };

  const showTab = (next: SheetTabId) => {
    if (next === tab) return;
    setSearch(next === 'main' ? {} : { tab: next }, { replace: true });
  };

  const sections = SHEET_TABS.find(({ id }) => id === tab)?.sections ?? [];

  return (
    <SheetContext value={sheet}>
      <Slot name="character-page" className="relative flex h-dvh flex-col overflow-hidden">
        <SheetHeader
          onChoices={() => setOpen({ kind: 'choices' })}
          onRest={() => setOpen({ kind: 'rest' })}
          onEdit={() => setEditing((on) => !on)}
          onActions={() => setOpen({ kind: 'actions' })}
        />
        <main
          id="sheet-tab-panel"
          role="tabpanel"
          aria-labelledby={`sheet-tab-${tab}`}
          className="flex min-h-0 grow touch-pan-y flex-col gap-3.5 overflow-y-auto px-4 py-3"
          onPointerDown={(event: PointerEvent) => {
            start.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event: PointerEvent) => {
            const from = start.current;
            start.current = undefined;
            if (from !== undefined) {
              showTab(swipedTab(tab, event.clientX - from.x, event.clientY - from.y));
            }
          }}
          onPointerCancel={() => {
            start.current = undefined;
          }}
        >
          {content.notInstalled.map((id) => (
            <Part
              key={id}
              name="panel"
              role="alert"
              className="bg-warn-bg px-3 py-2 text-14 text-warn-text"
            >
              {t('notInstalled', { id })}
            </Part>
          ))}
          {sections.map((Section, at) => (
            // A tab's sections are fixed, so their place is their key.
            // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
            <Section key={at} />
          ))}
        </main>
        <SheetDock
          tab={tab}
          onTab={showTab}
          onNumberPad={(mode) => setOpen({ kind: 'numberPad', mode })}
        />
        <SheetDice />
        {open?.kind === 'roll' && <RollDialog path={open.path} onClose={close} />}
        {open?.kind === 'breakdown' && <BreakdownSheet path={open.path} onClose={close} />}
        {open?.kind === 'numberPad' && <NumberPad mode={open.mode} onClose={close} />}
        {open?.kind === 'rest' && <RestPanel onClose={close} />}
        {open?.kind === 'actions' && <ActionsMenu onClose={close} />}
        {open?.kind === 'choices' && <ChoicesPanel onClose={close} />}
      </Slot>
    </SheetContext>
  );
}

export function SheetPage() {
  const { t } = useTranslation('sheet');
  const { id = '' } = useParams();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    setLoaded({ status: 'loading' });
    const watched = liveQuery(() => openCharacter(id)).subscribe({
      next: setLoaded,
      error: (error: unknown) => {
        console.error(error);
        setLoaded({ status: 'failed' });
      },
    });
    return () => watched.unsubscribe();
  }, [id]);

  if ('status' in loaded) {
    // While the row is read, the frame of a page shows, with nothing in it.
    if (loaded.status === 'loading') return <Page title={t('title')} back={paths.characters} />;
    return <Message text={t('failed')} />;
  }
  if (!loaded.ok) {
    return (
      <Message text={t(loaded.code === 'notFound' ? 'notFound' : `unopened.${loaded.code}`)} />
    );
  }
  const system = sheetSystemOf(loaded.value);
  if (system === undefined) return <Message text={t('noSheet')} />;
  return <Frame character={loaded.value} system={system} />;
}
