import { fileURLToPath } from 'node:url';
import { fetchSource } from './fetch-source.ts';
import { SOURCE_DIR_NAME } from './pin.ts';

// CONT-01: `pnpm fetch-source`. Prints the commit, the files per ruleset and the folder.

const dir = fileURLToPath(new URL(`../../${SOURCE_DIR_NAME}`, import.meta.url));
const result = fetchSource({ dir });
const { manifest } = result;
const count = (ruleset: string): number =>
  manifest.files.filter((file) => file.path.startsWith(`${ruleset}/`)).length;
const verb = result.status === 'fetched' ? 'fetched' : 'already there';
console.log(
  `5e-database ${manifest.commit.slice(0, 7)} ${verb}: ${count('2014')} files for 2014, ` +
    `${count('2024')} for 2024, in ${dir}`,
);
