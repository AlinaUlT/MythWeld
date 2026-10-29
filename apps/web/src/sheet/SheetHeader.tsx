// SHEET-30: the sheet's pinned header (board V3-Sheet, BRIEF P4, ADR 013 items 1 and 2): back, the
// token, the name, under it the class line as the level, the edition badge and the choices badge,
// then Rest, the Edit switch and "⋯"; under them the stats row, and for a caster each casting
// class's ability, spell save DC and spell attack (ADR 009 item 4). Every number is a
// `SheetNumber`.
import { STAT_TYPE } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { TFunction } from 'i18next';
import { Ellipsis, Lock, Moon, PencilLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../shell/Page';
import { paths } from '../shell/routes';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';
import { Inspiration } from './header/Inspiration';
import { Token } from './header/Token';
import { useSheet } from './SheetContext';
import { SheetNumber } from './SheetNumber';

const iconButton = 'flex size-control shrink-0 items-center justify-center text-text';
const icon = 'size-[22px]';

type SheetT = TFunction<'sheet'>;

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** The class line: each class named from the character's packs, with its level. */
function useClassLine(t: SheetT): string {
  const { character, content, system } = useSheet();
  return system
    .classLine(character)
    .map(({ id, level }) => {
      const found = content.index.get(id);
      const name = found.ok ? nameIn(found.entity.name) : t('missing', { id });
      return level === undefined ? name : t('classLevel', { name, level });
    })
    .join(t('separator'));
}

/** What the header's buttons open. */
export interface HeaderActions {
  onChoices: () => void;
  onRest: () => void;
  onEdit: () => void;
  onActions: () => void;
}

function ChoicesBadge({ onChoices, t }: { onChoices: () => void; t: SheetT }) {
  const { computed } = useSheet();
  const count = computed.pendingChoices.length + computed.pendingKeys.length;
  if (count === 0) return null;
  return (
    <Part
      as="button"
      type="button"
      name="chip"
      aria-label={t('choices', { count })}
      onClick={onChoices}
      className="flex h-5 shrink-0 items-center bg-hp px-2 text-12 font-bold text-on-strong"
    >
      {t('choicesBadge', { count })}
    </Part>
  );
}

function StatsRow({ t }: { t: SheetT }) {
  const { system } = useSheet();
  return (
    <div className="grid h-12.5 grid-cols-5 border-t border-line">
      {system.numbers.map(({ key, path, format, rolls }) => (
        <SheetNumber
          key={key}
          path={path}
          label={t(`numbers.${key}`)}
          format={format}
          rolls={rolls === true}
          labelAfter
          className="flex min-w-0 flex-col items-center justify-center gap-px select-none"
          valueClassName="text-18 leading-22 font-bold whitespace-nowrap"
          labelClassName="text-11 text-muted"
        />
      ))}
    </div>
  );
}

function CastingRow({ t }: { t: SheetT }) {
  const { character, computed, system } = useSheet();
  const casting = system.casting(character, computed);
  if (casting.length === 0) return null;
  const number = 'flex items-baseline gap-1 select-none';
  return (
    <div className="flex flex-col border-t border-line px-4 py-1.5">
      {casting.map(({ source, ability, dc, attack }) => {
        const stat = computed.byKey[STAT_TYPE]?.[ability];
        const abbr = stat?.type === STAT_TYPE ? nameIn(stat.abbr) : ability;
        return (
          <div key={source} className="flex h-8 items-center gap-4 text-14">
            <span className="text-12 font-semibold tracking-wide text-muted">{abbr}</span>
            <SheetNumber
              path={dc}
              label={t('casting.dc')}
              className={number}
              labelClassName="text-12 text-muted"
              valueClassName="font-bold"
            />
            <SheetNumber
              path={attack}
              label={t('casting.attack')}
              format="signed"
              rolls
              className={number}
              labelClassName="text-12 text-muted"
              valueClassName="font-bold"
            />
          </div>
        );
      })}
    </div>
  );
}

export function SheetHeader({ onChoices, onRest, onEdit, onActions }: HeaderActions) {
  const { t } = useTranslation('sheet');
  const { character, editing } = useSheet();
  const classLine = useClassLine(t);
  return (
    <Slot as="header" name="header" className="shrink-0 border-b border-line">
      <div className="flex h-16 items-center gap-0.5 px-0.5">
        <BackButton to={paths.characters} />
        <Token />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h1 className="truncate font-heading text-22 leading-tight font-bold">
            {character.name}
          </h1>
          <span className="flex h-5 min-w-0 items-center gap-1.5">
            <span className="truncate text-12 whitespace-nowrap text-muted">{classLine}</span>
            <Part
              as="span"
              name="chip"
              className="flex h-5 shrink-0 items-center bg-soft px-2 text-12 font-semibold text-muted"
            >
              {character.ruleset}
            </Part>
            <ChoicesBadge onChoices={onChoices} t={t} />
            <Inspiration />
          </span>
        </div>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('rest')}
          onClick={onRest}
          className={iconButton}
        >
          <Moon aria-hidden className={icon} />
        </Part>
        {/* Play mode is locked (SPEC §7.2): the switch shows a lock until edit mode is on. */}
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('edit')}
          aria-pressed={editing}
          onClick={onEdit}
          className={iconButton}
        >
          {editing ? (
            <PencilLine aria-hidden className={icon} />
          ) : (
            <Lock aria-hidden className={icon} />
          )}
        </Part>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('actions')}
          onClick={onActions}
          className={iconButton}
        >
          <Ellipsis aria-hidden className={icon} />
        </Part>
      </div>
      <StatsRow t={t} />
      <CastingRow t={t} />
    </Slot>
  );
}
