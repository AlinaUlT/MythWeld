# Changelog

What a person using the app can see, newest first. One line per change, with the date and the
ticket id. Changes nobody can see (tests, refactoring, CI) do not go here; they are in `git log`.

Format:

```
- 2026-MM-DD · SHEET-04 · Long-press on any number shows where it came from.
```

---

- 2026-10-04 · ENG-66 · The published fifth-edition pack JSON Schema asks for
  `systemSchemaVersion` 7, and a recovery may be on `revive`, coming back to life; a pack of
  version 6 still opens in the app.
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
