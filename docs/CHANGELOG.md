# Changelog

What a person using the app can see, newest first. One line per change, with the date and the
ticket id. Changes nobody can see (tests, refactoring, CI) do not go here; they are in `git log`.

Format:

```
- 2026-MM-DD · AREA-NN · What a person can now see, in one sentence.
```

---

- 2026-10-29 · SHEET-25 · A swipe or "⋯" on a character opens its Actions: Copy makes a
  copy, Export saves it as a JSON file, and Delete removes it with an Undo.
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
