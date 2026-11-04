import type { Computed } from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import { attackPath, type WeaponKind } from './attacks';
import type { FifthEditionEntity } from './entity-types';

// SHEET-44: what the Combat tab's attacks name for a fifth-edition character (SPEC §7.2, board
// V3-Sheet, ENG-16): each equipped weapon that has an attack, in the order `compute()` has them:
// the path of its attack bonus (a number that rolls, SHEET-39), its own damage dice and type with
// the path of the bonus added to them, and, in 2024, its mastery property: named by the weapon,
// "used" when the character has that kind of weapon's mastery (`attacks.<key>.mastery` is 1).
// A weapon with no key, or one an earlier weapon's key took, has no attack (ENG-16 §8).

/** One attack of the Combat tab. */
export interface AttackShown {
  /** The weapon's entry. */
  item: EntityId;
  key: string;
  kind: WeaponKind;
  /** The path of the attack bonus: the number a tap rolls. */
  hit: string;
  /** The weapon's own dice and type, and the path of the bonus added to them. */
  damage?: { path: string; dice: string; type: string };
  /** The weapon's mastery property (2024), and whether the character uses it. */
  mastery?: { key: string; uses: boolean };
}

/** The attacks of the equipped weapons, each weapon once, by its key. */
export function fifthEditionAttacks(computed: Computed<FifthEditionEntity>): AttackShown[] {
  const shown: AttackShown[] = [];
  const taken = new Set<string>();
  for (const { entity } of computed.entities) {
    if (entity.type !== 'item' || entity.weapon === undefined || entity.key === undefined) continue;
    const { key } = entity;
    const path = attackPath(key);
    if (taken.has(key) || !Object.hasOwn(computed.values, `${path}.hit`)) continue;
    taken.add(key);
    const { weapon } = entity;
    const damagePath = `${path}.damage`;
    shown.push({
      item: entity.id,
      key,
      kind: weapon.kind,
      hit: `${path}.hit`,
      ...(weapon.damage !== undefined &&
        Object.hasOwn(computed.values, damagePath) && {
          damage: { path: damagePath, dice: weapon.damage.formula, type: weapon.damage.type },
        }),
      ...(weapon.mastery !== undefined && {
        mastery: { key: weapon.mastery, uses: computed.values[`${path}.mastery`] === 1 },
      }),
    });
  }
  return shown;
}
