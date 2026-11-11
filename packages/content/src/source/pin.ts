// CONT-01: the import source, pinned. Every number later rows measure comes from this commit
// (ENG-02, ENG-32 measured it too). Moving the pin is a ticket of its own, with a new measurement.

/** The repository the structured SRD data lives in (SPEC §3.2). */
export const SOURCE_REPO = 'https://github.com/5e-bits/5e-srd-api.git';

/** The one commit every fetch checks out. */
export const SOURCE_COMMIT = 'e6edf9a51fad4b59a7e9561fad6c15232caed214';

/** The two rulesets' data. Only the English folders are taken, never `ru` (SPEC §3.2). */
export const SOURCE_RULESETS = ['2014', '2024'] as const;
export type SourceRuleset = (typeof SOURCE_RULESETS)[number];

/** Where the data folders sit inside the repository, for one ruleset. */
export function sourceFolder(ruleset: SourceRuleset): string {
  return `packages/5e-database/src/${ruleset}/en`;
}

/** The data package's own license file: the legal text that comes with the files. */
export const SOURCE_LICENSE = 'packages/5e-database/LICENSE.md';

/** Where the fetched files go, relative to `packages/content`. Git ignores it (CONT-01 §4). */
export const SOURCE_DIR_NAME = '.source/5e-database';

/** The manifest the fetch writes next to the files. */
export const MANIFEST_NAME = 'SOURCE.json';
