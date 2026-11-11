import { SOURCE_DIR } from './packages/content/src/import/source.ts';
import { fetchSource } from './packages/content/src/source/fetch-source.ts';

// CONT-04: the tests of the import read the files `pnpm fetch-source` fetches (CONT-01). This puts
// them in place before the unit tests run, and fetches nothing when they are already there. With no
// network the fetch fails here with a warning, and the tests that read the source then fail, each
// saying to run `pnpm fetch-source`.
export default function fetchTheSource(): void {
  try {
    fetchSource({ dir: SOURCE_DIR });
  } catch (error) {
    console.warn(
      `The import source was not fetched: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
