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

/**
 * CONT-73: the SRD 5.2.1 PDF, the one source of its rules chapters (5e-database has no 2024 `Rules`
 * file). The publisher's own file, CC-BY-4.0, by its hash: the fetch refuses any other bytes.
 */
export const SRD_PDF = {
  url: 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf',
  sha256: '8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87',
} as const;

/** Where the PDF goes in the fetched folder, and the rules file the fetch derives from it. */
export const SRD_PDF_PATH = 'srd-5.2.1/SRD_CC_v5.2.1.pdf';
export const SRD_PDF_LICENSE_PATH = 'srd-5.2.1/LICENSE.md';
export const DERIVED_RULES_PATH = '2024/5e-SRD-Rules.json';
