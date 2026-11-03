// SHEET-36: the choices panel's rules that hold no screen (SPEC §7.2, "What needs choosing"): the
// entry a pending choice is about, how many picks it still needs, the name of a pick, and the change
// that stores the picks. Each pending choice of a grant is `choices[part]`, a list in the order
// picked; the order is the order of a distribution's numbers (SRD 5.2.1's ability score pattern).
import type { LogEntry } from '@grimoire/schema';
import type { AppCharacter, AppComputed, SheetSystem } from '../systems';
import { playerEntry } from './changes';
import { nameIn } from './names';
import { wordsOf } from './sections/AboutList';

/** A pending choice of the computed character. */
export type PendingChoice = AppComputed['pendingChoices'][number];

/** The id of the entity a part id names: the part is `<entity id>#<grant id>`. */
export function entityOfPart(part: string): string {
  const at = part.lastIndexOf('#');
  return at < 0 ? part : part.slice(0, at);
}

/** How many picks a pending choice takes in all: its count, or its longest pattern's. */
export function picksOf(choice: PendingChoice): number {
  const { grant } = choice;
  if ('choose' in grant && grant.choose !== undefined) return grant.choose.count;
  if ('patterns' in grant) return Math.max(...grant.patterns.map((pattern) => pattern.length));
  return choice.chosen.length;
}

/** How many more picks a pending choice needs: never below 1 while the choice is pending. */
export function picksLeft(choice: PendingChoice): number {
  return Math.max(1, picksOf(choice) - choice.chosen.length);
}

/** The numbers a distribution gives, as the patterns it offers: `[[2, 1], [1, 1, 1]]`. */
export function patternsOf(choice: PendingChoice): readonly (readonly number[])[] {
  return 'patterns' in choice.grant ? choice.grant.patterns : [];
}

/**
 * The name of a pick: an entry's name when it is an id the packs hold, else the name of the key in
 * the entries of the type its grant names, else the words of the key; a missing id is said so.
 */
export function pickName(
  computed: AppComputed,
  system: Pick<SheetSystem, 'aboutLists'>,
  index: { get(id: string): { ok: boolean; entity?: { name: { en?: string; ru?: string } } } },
  choice: PendingChoice,
  pick: string,
  missing: (id: string) => string,
): string {
  if (pick.includes(':')) {
    const found = index.get(pick);
    return found.ok && found.entity !== undefined ? nameIn(found.entity.name) : missing(pick);
  }
  const { grant } = choice;
  const category = 'category' in grant ? grant.category : undefined;
  const preferred = Object.values(system.aboutLists).find(
    (list) => list.category === category,
  )?.type;
  const types = [
    ...(preferred === undefined ? [] : [preferred]),
    ...(grant.kind === 'abilityScore' ? ['ability'] : []),
    ...Object.keys(computed.byKey),
  ];
  for (const type of types) {
    const kept = Object.hasOwn(computed.byKey, type) ? computed.byKey[type] : undefined;
    const entry = kept !== undefined && Object.hasOwn(kept, pick) ? kept[pick] : undefined;
    if (entry !== undefined) return nameIn(entry.name);
  }
  return wordsOf(pick);
}

/** The entry that stores `picks` for the grant `part`; no picks removes the stored choice. */
export function choiceEntry(
  character: AppCharacter,
  part: PendingChoice['part'],
  picks: readonly string[],
): LogEntry {
  const before = Object.hasOwn(character.choices, part) ? character.choices[part] : undefined;
  return playerEntry(character, 'setChoice', part, [
    {
      path: ['choices', part],
      ...(before !== undefined && { before: [...before] }),
      ...(picks.length > 0 && { after: [...picks] }),
    },
  ]);
}

/** The picks stored for `part`, in the order picked. */
export function storedPicks(
  character: AppCharacter,
  part: PendingChoice['part'],
): readonly string[] {
  return Object.hasOwn(character.choices, part) ? (character.choices[part] ?? []) : [];
}
