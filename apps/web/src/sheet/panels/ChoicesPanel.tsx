// SHEET-36: every pending choice, the list the choices badge opens (SPEC §7.2 "What needs
// choosing", BRIEF P4). Each grant's pending choice shows the entry that gives it, what it gives, how
// many picks it still needs, the picks made (tap one to take it back) and the options left (tap one
// to pick it). A key whose own key is a choice, the size of a species that offers several, is
// answered from its list too, and stored where its module keeps it. Every pick is one change with its
// "Undo" toast. Missing is not broken: an entry a pack no longer has shows "Missing: <id>".
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../shared/BottomSheet';
import { changeCharacter } from '../../shared/undo';
import { Part } from '../../theme/Part';
import { pathName } from '../breakdown';
import { playerEntry } from '../changes';
import {
  choiceEntry,
  entityOfPart,
  type PendingChoice,
  patternsOf,
  pickName,
  picksLeft,
  storedPicks,
} from '../choices';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { wordsOf } from '../sections/AboutList';
import type { PanelProps } from './panel';

const option =
  'flex min-h-control w-full items-center justify-between gap-2 px-3 text-left text-15';

export function ChoicesPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('choices');
  const { t: tb } = useTranslation('breakdown');
  const { character, content, computed, system } = useSheet();
  const missing = (id: string) => t('missing', { id });
  const save = (entry: ReturnType<typeof choiceEntry>) => {
    // SHEET-85: a character at full hit points follows a maximum the pick raises.
    changeCharacter(character.id, system.keepFullHitPoints(character, entry, content.index)).catch(
      (error: unknown) => console.error(error),
    );
  };
  const nameOf = (choice: PendingChoice, pick: string) =>
    pickName(computed, system, content.index, choice, pick, missing);

  const nothing = computed.pendingChoices.length === 0 && computed.pendingKeys.length === 0;

  return (
    <BottomSheet title={t('title')} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-3">
        {nothing && <p className="py-2 text-15 text-muted">{t('nothing')}</p>}

        {computed.pendingChoices.map((choice) => {
          const stored = storedPicks(character, choice.part);
          const source = content.index.get(entityOfPart(choice.part));
          const grant = choice.grant;
          const kind =
            'category' in grant
              ? `${wordsOf(grant.category)} ${t('kind.proficiency')}`
              : t(`kind.${grant.kind}`, { defaultValue: wordsOf(grant.kind) });
          const left = picksLeft(choice);
          const patterns = patternsOf(choice);
          return (
            <section
              key={choice.part}
              aria-label={
                source.ok ? nameIn(source.entity.name) : missing(entityOfPart(choice.part))
              }
              className="flex flex-col gap-2"
              data-part={choice.part}
            >
              <h3 className="font-heading text-18 font-bold">
                {source.ok ? nameIn(source.entity.name) : missing(entityOfPart(choice.part))}
              </h3>
              <p className="text-13 text-muted">
                {t('need', { kind, count: left })}
                {patterns.length > 0 &&
                  ` ${t('patterns', {
                    patterns: patterns
                      .map((pattern) => pattern.map((n) => `+${n}`).join(' '))
                      .join(t('or')),
                  })}`}
              </p>
              {stored.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={t('picked')}>
                  {stored.map((pick, at) => (
                    <li key={pick}>
                      <Part
                        as="button"
                        type="button"
                        name="chip"
                        aria-label={t('remove', { name: nameOf(choice, pick) })}
                        onClick={() =>
                          save(
                            choiceEntry(
                              character,
                              choice.part,
                              stored.filter((_, index) => index !== at),
                            ),
                          )
                        }
                        className="flex min-h-control items-center gap-1.5 bg-strong px-3 text-14 font-semibold text-on-strong"
                      >
                        {nameOf(choice, pick)}
                        <X aria-hidden className="size-4" />
                      </Part>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="flex flex-col divide-y divide-line">
                {choice.options.map((pick) => (
                  <li key={pick}>
                    <button
                      type="button"
                      className={option}
                      aria-label={t('pick', { name: nameOf(choice, pick) })}
                      onClick={() => save(choiceEntry(character, choice.part, [...stored, pick]))}
                    >
                      <span>{nameOf(choice, pick)}</span>
                      <Check aria-hidden className="size-4 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {computed.pendingKeys.map((pending) => {
          const answer = system.pendingKey(pending.path);
          const label = pathName(computed, system, pending.path, tb);
          const nameOfKey = (key: string) => {
            const kept =
              answer !== undefined && Object.hasOwn(computed.byKey, answer.type)
                ? computed.byKey[answer.type]
                : undefined;
            const entry = kept !== undefined && Object.hasOwn(kept, key) ? kept[key] : undefined;
            return entry === undefined ? wordsOf(key) : nameIn(entry.name);
          };
          return (
            <section
              key={pending.path}
              aria-label={label}
              className="flex flex-col gap-2"
              data-path={pending.path}
            >
              <h3 className="font-heading text-18 font-bold">{label}</h3>
              <p className="text-13 text-muted">
                {answer === undefined ? t('cannotAnswer') : t('needOne')}
              </p>
              <ul className="flex flex-col divide-y divide-line">
                {pending.options.map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      className={option}
                      disabled={answer === undefined}
                      aria-label={t('pick', { name: nameOfKey(key) })}
                      onClick={() => {
                        const changes = answer?.answer(character, key);
                        if (changes !== undefined) {
                          save(playerEntry(character, 'setChoice', pending.path, changes));
                        }
                      }}
                    >
                      <span>{nameOfKey(key)}</span>
                      <Check aria-hidden className="size-4 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </BottomSheet>
  );
}
