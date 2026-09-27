import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// The real biome.json and plugin are copied next to a sample file, so the sample is linted by the
// same rules as apps/web/src without ever being a file that `pnpm lint` sees.
const repo = resolve(import.meta.dirname, '../../..');
const biome = join(repo, 'node_modules/.bin/biome');
const dir = mkdtempSync(join(tmpdir(), 'setup-05-'));
cpSync(join(repo, 'biome.json'), join(dir, 'biome.json'));
cpSync(join(repo, 'biome'), join(dir, 'biome'), { recursive: true });
mkdirSync(join(dir, 'apps/web/src'), { recursive: true });

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function lint(source: string) {
  writeFileSync(join(dir, 'apps/web/src/Sample.tsx'), source);
  const run = spawnSync(
    biome,
    ['lint', '--vcs-enabled=false', '--max-diagnostics=50', 'apps/web/src/Sample.tsx'],
    { cwd: dir, encoding: 'utf8' },
  );
  const output = run.stdout + run.stderr;
  const lines = [...output.matchAll(/Sample\.tsx:(\d+):\d+ (?:lint\/style\/noJsxLiterals|plugin)/g)]
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  return { status: run.status, lines };
}

const bad = `export function Bad() {
  return (
    <div title="Tip" aria-label={'Close'}>
      <p>Hello</p>
      {'World'}
      {\`Template\`}
      <img alt="Picture" src="/a.png" />
      <input placeholder="Name" label="Label" aria-description="More" type="text" />
    </div>
  );
}
`;

const good = `import { useTranslation } from 'react-i18next';

export function Good() {
  const { t } = useTranslation();
  return (
    <div className="p-2" title={t('nav.dice')} data-testid="good">
      <a href="/dice">{t('nav.dice')}</a> <img alt={t('nav.dice')} src="/a.png" />
      {' '}
    </div>
  );
}
`;

describe('SETUP-05 no visible literals', () => {
  it('fails on each kind of visible text written in a component', () => {
    const result = lint(bad);
    expect(result.status).toBe(1);
    // title, aria-label (line 3); text (4); braces (5); template (6); alt (7);
    // placeholder, label, aria-description (8).
    expect(result.lines).toEqual([3, 3, 4, 5, 6, 7, 8, 8, 8]);
  });

  it('passes text from i18n keys, class names, links and a lone space', () => {
    const result = lint(good);
    expect(result.lines).toEqual([]);
    expect(result.status).toBe(0);
  });
});
