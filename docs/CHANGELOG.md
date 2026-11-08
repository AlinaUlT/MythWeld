# Changelog

What a person using the app can see, newest first. One line per change, with the date and the
ticket id. Changes nobody can see (tests, refactoring, CI) do not go here; they are in `git log`.

Format:

```
- 2026-11-08 · SHEET-86 · The Spells tab shows how many spells a class prepares and how many cantrips it knows, each opening its breakdown; a class without that count shows no number.
- 2026-11-08 · SHEET-85 · A character at full hit points stays at full when a pick raises the maximum: a Hill Dwarf reads 12 of 12, not 11 of 12. A character below full keeps the hit points it has.
- 2026-11-04 · SHEET-76 · The Turn tab lists your feats too: Savage Attacker under Once per turn, and Alert and Defense under Always on with their numbers (Initiative +2, AC +1), each opening its breakdown.
- 2026-11-04 · SHEET-59 · The sheet's ⋯ menu opens Change history: your last 50 changes with the time of each and an Undo for any one of them; a change a later one wrote over waits until that later one is undone.
- 2026-11-04 · SHEET-79 · In edit mode a skill's breakdown links to where its stat comes from, and you can set the stat by hand (Athletics on Dexterity, say) with a note; it has Undo and Remove.
- 2026-11-04 · SHEET-80 · In edit mode a custom item and a custom feature have an Edit button: change the name, the weight and the words, with Undo.
- 2026-11-04 · SHEET-84 · The Hit points pad offers all 13 damage types of the SRD, not one.
- 2026-11-04 · SHEET-83 · The roll dialog calls a weapon attack by the weapon's name, "Greatsword", not by its path.
- 2026-11-04 · SHEET-72 · The Hit points pad can name the damage's type: the character's resistance, vulnerability or immunity to it is shown and applied, and at 0 hit points a critical hit gives two death save failures.
- 2026-11-04 · SHEET-74 · With "I roll myself" on, a short rest's hit die and a spell's damage and healing rolls ask for the faces your dice show and count them.
- 2026-11-04 · SHEET-69 · With "I roll myself" on, the roll dialog asks for the faces your dice show (the d20, and a weapon's damage dice) and counts them, as the dice panel does.
- 2026-11-04 · SHEET-35 · In edit mode the AC breakdown lists each way the base armor class can be worked out (armor, or a feature of your own) with its number, and lets you pick one, or go back to the highest; the pick has Undo.
- 2026-11-04 · SHEET-70 · On a narrow phone the sheet's header no longer cuts the class line when the choices badge shows; the badges go under the class line when they do not fit beside it.
- 2026-11-04 · SHEET-75 · A long web address in a pack's attribution, under See full description, now wraps inside the card.
- 2026-11-04 · SHEET-77 · A button that cannot be pressed now (Items' One less at 1, a coin's − at 0, a form's Save with nothing to save) is drawn faint, with a not-allowed cursor.
- 2026-11-04 · SHEET-78 · A right-click on a number on the sheet opens its breakdown every time, not only the first.
- 2026-11-04 · SHEET-81 · On the sheet the toast with Undo now sits above the dice button and the + button, so both can be tapped while it shows.
- 2026-11-04 · SHEET-82 · The toast after a change goes after 5 seconds also when the toast before it was undone.
- 2026-11-04 · SHEET-57 · In edit mode you can add a section of your own, such as Mounts or Pets, as a tab after the built-in ones, with entries of a name and free text (a companion's stat block among them); each add and remove has Undo.
- 2026-11-04 · SHEET-52 · In edit mode a + button adds a custom item (name, weight, how many, description) to the Gear tab or a custom feature (name, description) to the Features tab, as text only; each has Undo, and a custom feature can be removed.
- 2026-11-04 · SHEET-29 · When your species or race and your background both raise ability scores, the new-character form warns and a popup lets you take one, both or neither; the live numbers follow each tick, and Create stays on.
- 2026-11-04 · SHEET-58 · The sheet's ⋯ menu lists the character's actions: Export, Copy and Delete work from it (Delete goes back to My characters, with Undo); Level up, Link for the DM, Transfer, Rules options and Change history show as coming later.
- 2026-11-04 · SHEET-34 · In edit mode a number's breakdown has an "Override by hand" form: type the number you want and a note, or remove the edit; each is one change with Undo, the breakdown shows it as a manual edit, and every number that reads it follows.
- 2026-11-04 · SHEET-51 · The Gear tab shows your coins, cp sp ep gp pp, each with − and + buttons for steps of 1 and 10, and Undo.
- 2026-11-04 · SHEET-49 · The Turn tab lists what you can do on your turn from your features, grouped by when you use them, with your weapon attacks under Action and the uses a feature has left.
- 2026-11-04 · SHEET-47 · A tap on a spell opens the cast panel: its summary and full text, what forbids a cast now, the dice at the slot you pick, the slot or no slot, and Cast with Undo; a new concentration spell asks before it ends the old one.
- 2026-11-04 · SHEET-45 · The Rest button opens the two rests: each lists what comes back before you confirm, a short rest spends hit dice you roll, a long rest in the 2014 rules reminds you that exhaustion goes down only if the character ate and drank; each rest is one change with Undo.
- 2026-11-04 · SHEET-73 · The Escape key closes only the panel on top: with the roll dialog over the number pad, the first press closes the dialog and the second closes the pad.
- 2026-11-04 · SHEET-71 · A change made inside an open panel shows its "Undo" toast at the top of the screen, above the panel, so you can undo it without closing the panel.
- 2026-11-04 · SHEET-44 · The Combat tab lists your equipped weapons' attacks: tap the attack bonus to roll it, with the damage dice, damage bonus, type and weapon mastery.
- 2026-11-04 · SHEET-43 · The Combat tab follows a dying character: death save circles, a roll in the roll dialog that applies the result, Stabilize, first aid for a knocked-out character, and a revival for the dead.
- 2026-11-04 · SHEET-40 · The Damage and Heal buttons open a number pad: type an amount, see the hit points before and after, and apply it, with Undo; Temp HP too, a knock-out where your rules have it, and the concentration save after damage.
- 2026-11-04 · SHEET-42 · Conditions can be added to the character from the sheet and ended, each with its level and description; exhaustion at its highest level says it is death.
- 2026-11-04 · SHEET-41 · The Combat tab shows the spell you concentrate on until it ends, with a button to end it (and Undo).
- 2026-11-03 · SHEET-46 · The Spells tab shows spellcasting at a glance, the slot grid (tap a circle to spend or give back a slot), each class's prepared and known spells and the spells your features grant, with their edition.
- 2026-11-03 · SHEET-50 · The Gear tab lists what you carry with its weight; switch an item worn or attuned and AC and attacks change at once, set how many, put an item inside another, or remove it, each with Undo.
- 2026-11-03 · SHEET-48 · The Features tab groups features under the species, each class with its subclass, the background and your own feats; each opens its description, and uses and switches work in place.
- 2026-11-03 · SHEET-36 · The choices badge on the sheet opens a list of every choice still to make; each is answered in place, with Undo.
- 2026-11-03 · SHEET-39 · Tap an ability, save, skill or initiative on the sheet to roll it: the d20 of its mode (advantage, disadvantage, inspiration in 2014), the dice shown, the total, every roll kept in the log.
- 2026-11-03 · SHEET-33 · Long-press a number on the sheet to see where it comes from: each part with its source, and a manual edit marked as one.
- 2026-11-03 · SHEET-32 · The Main tab shows the ability tiles, the saving throws, the skills grouped by their stat with proficiency dots, and the passive checks.
- 2026-11-03 · SHEET-28 · The new-character form's Equipment step adds items with a quantity, and warns when an item is of the other edition or in no ticked pack.
- 2026-MM-DD · AREA-NN · What a person can now see, in one sentence.
```

---

- 2026-11-03 · SHEET-26 · My characters has Import file: it reads a character file, migrates an
  older one, refuses one that fails its checks with the reason, and never replaces a character it
  already has.
- 2026-11-03 · SHEET-56 · Tap the token on the sheet to choose an image of the character, an
  animated picture or a short video included, and a frame; it is cut round and stays on the
  device. My characters shows it too.
- 2026-11-03 · SHEET-53 · The About tab shows the species and lineage, background, size,
  alignment, languages and the armor, weapon, tool and skill proficiencies; the alignment is
  written in edit mode.
- 2026-11-03 · SHEET-55 · The header shows inspiration as stars; a tap on an empty star gains one
  and a tap on a filled star spends one, with Undo; the edition's own maximum shows beside the
  stars when the house rule allows more.
- 2026-11-03 · SHEET-54 · The Notes tab keeps free text: it is saved when the field loses focus,
  with a "Note saved" toast and Undo.
- 2026-10-29 · SHEET-25 · A character on My characters swiped left, or its ⋯, opens its
  Actions: Copy makes a copy, Export saves it as a file, and Delete removes it with Undo; Link for
  the DM and Transfer are marked as coming later.
- 2026-10-29 · SHEET-68 · Settings can show distances in squares of 5 feet; the sheet's speed
  follows.
- 2026-10-29 · SHEET-30 · A character opens its sheet: the name, class and level, edition, AC,
  initiative, speed, proficiency, passive Perception and, for a caster, the spell save DC and
  attack pinned at the top; hit points with temporary ones in their own colour, Damage, Heal and
  eight tabs pinned at the bottom. The tabs are still empty.
- 2026-10-29 · SHEET-27 · New character makes a character by hand: rules base and packs, name,
  race or species, background, classes and levels, and any ability scores, with the live AC, hit
  points and initiative pinned at the bottom; warnings show in amber and never block Create.
- 2026-10-29 · SHEET-38 · The dice page rolls any count of any die, a modifier, or any formula
  typed with d or к, fairly; it keeps the person's own dice, shows the last roll's faces and the
  earlier rolls, and with "I roll myself" on counts the faces the person types.
- 2026-10-29 · SHEET-13 · Settings chooses dark or light colours, stops animations, picks feet
  or metres and pounds or kilograms, and turns on "I roll myself"; each choice is kept on the
  device and already holds when the app opens.
- 2026-10-29 · SHEET-24 · My characters lists the characters saved on the device, newest change
  first, each with its edition, species and classes; a character that cannot open says why.
- 2026-10-29 · SHEET-12 · The player page shows six sections: Characters, with how many are
  saved, opens the list; Sources, Library, Dice roll, Quick rules and Bookmarks are marked as
  coming later.
- 2026-10-29 · SHEET-11 · The app opens on a start page with Player and DM (DM coming later)
  instead of the bottom bar; every page has a back arrow, and the gear opens Settings.
- 2026-10-29 · SHEET-06 · Text is set in Inter and headings in EB Garamond on every device,
  offline too, with Latin and Cyrillic letters.
- 2026-10-28 · SHEET-03 · The bottom bar takes the dock's look: the surface colour with a soft
  shadow above it.
- 2026-10-28 · SHEET-01 · The app paints with the mockups' colours: their light values, and
  placeholder dark ones, still dark by default; the icon and the splash screen take the new dark
  background.
- 2026-10-13 · ENG-66 · The published fifth-edition pack JSON Schema asks for
  `systemSchemaVersion` 8, and a recovery may name `revive`, coming back to life; a pack of
  version 7 still opens in the app.
- 2026-10-05 · ENG-68 · The published fifth-edition pack JSON Schema asks for
  `systemSchemaVersion` 7; a pack of version 6 still opens in the app.
- 2026-10-03 · ENG-65 · The published fifth-edition pack JSON Schema asks for
  `systemSchemaVersion` 6; a pack of version 5 still opens in the app.
- 2026-10-03 · ENG-61 · The published fifth-edition pack JSON Schema asks for `schemaVersion` 2,
  and a condition may say what a rest takes from its level (`recovery`); a pack of version 1 still
  opens in the app.
- 2026-10-03 · ENG-58 · The published fifth-edition pack JSON Schema asks for
  `systemSchemaVersion` 3; a pack of version 2 still opens in the app.
- 2026-10-03 · ENG-53 · The fifth-edition pack schema accepts a spell's `healing`: a roll formula,
  and whether it gives hit points or temporary hit points. `@mod` in a spell's formulas is the
  modifier of the stat it is cast with.
- 2026-10-02 · ENG-16 · The fifth-edition pack schema accepts a `mastery` proficiency: the kinds of
  weapons whose mastery property a character uses.
- 2026-10-02 · ENG-47 · The published fifth-edition pack JSON Schema asks for
  `systemSchemaVersion` 2.
- 2026-10-02 · ENG-38 · The public link serves the JSON Schema of a fifth-edition content pack, at
  `schema/5e/pack.schema.json`: an editor or a validator checks a pack written by hand with it.
- 2026-09-28 · SETUP-08 · The app has a public link: https://alinault.github.io/MythWeld/. It
  updates by itself after every change that passes the checks.
- 2026-09-28 · SETUP-07 · The app can be installed to the home screen, with its own icon, and opens
  with no network after the first visit.
- 2026-09-27 · SETUP-04 · The app opens dark, with a bottom bar of four tabs: Characters, Library,
  Dice, Settings. Each tab shows only its title.
