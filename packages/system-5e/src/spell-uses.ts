import type { GrantOf } from '@grimoire/engine';
import type { FifthEditionEntity } from './entity-types';

// ENG-57: a spell a grant gives with its own uses (ADR 014 item 7) is cast through them, with no
// slot. Those uses are the core's resource (ENG-04's uses, ENG-29's maximum, ENG-30's uses spent),
// keyed by the grant's `key`: beside a `spell` grant with `uses`, the module gives the `resource`
// grant they are. So `resources.<key>.max` is computed with its breakdown, effects and overrides,
// the uses spent are `state.resources.<key>`, and a rest gives them back by their `recovery`
// (ENG-21's `recoveredOn`). A grant's uses count every spell it gives; a key two grants give is one
// resource (ENG-29). `castSpell` spends them (`casting.ts`).

/** A grant of fifth edition. */
type FifthEditionGrant = GrantOf<FifthEditionEntity>;

/**
 * `grants`, each `spell` grant with `uses` followed by the `resource` grant of those uses: the same
 * id, so its part is the grant written in the pack, the same `atLevel`, its `key` and `uses`, and
 * the entity's name as its label. The same list when no grant has uses.
 */
export function spellUsesGrants(
  entity: FifthEditionEntity,
  grants: readonly FifthEditionGrant[],
): readonly FifthEditionGrant[] {
  if (!grants.some((grant) => grant.kind === 'spell' && grant.uses !== undefined)) return grants;
  return grants.flatMap((grant): FifthEditionGrant[] => {
    if (grant.kind !== 'spell' || grant.uses === undefined || grant.key === undefined) {
      return [grant];
    }
    const { id, atLevel, key, uses } = grant;
    const label = { ...entity.name };
    return [
      grant,
      { id, kind: 'resource', key, label, uses, ...(atLevel !== undefined && { atLevel }) },
    ];
  });
}
