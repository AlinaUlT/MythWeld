import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// The real biome.json and plugins are copied next to a sample file, as in the SETUP-05 test, so a
// bad sample is linted by the same rules as apps/web/src without ever being a file `pnpm lint` sees.
const repo = resolve(import.meta.dirname, '../../..');
const biome = join(repo, 'node_modules/.bin/biome');
const dir = mkdtempSync(join(tmpdir(), 'sheet-02-'));
cpSync(join(repo, 'biome.json'), join(dir, 'biome.json'));
cpSync(join(repo, 'biome'), join(dir, 'biome'), { recursive: true });

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function lint(path: string, source: string) {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), source);
  const run = spawnSync(biome, ['lint', '--vcs-enabled=false', '--max-diagnostics=50', path], {
    cwd: dir,
    encoding: 'utf8',
  });
  const output = run.stdout + run.stderr;
  const file = path.split('/').at(-1)?.replace('.', '\\.');
  const lines = [...output.matchAll(new RegExp(`${file}:(\\d+):\\d+ plugin`, 'g'))]
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  return { status: run.status, lines };
}

const bad = `export function Bad({ x }: { x: string }) {
  return (
    <div className="bg-red-500" style={{ color: 'red', fontFamily: 'Inter' }}>
      <p className="text-[#1c1d20]" />
      <p className="hover:border-x-white/50" />
      <p className={\`shadow-[0_0_4px_oklch(0.5_0_0)] \${x}\`} />
      <p className="text-[color:tomato]" />
      <svg fill="black" stroke={'#fff'}>
        <circle style={{ animation: 'spin 1s', background: 'white', transitionDuration: '200ms' }}>
          <animate attributeName="r" />
        </circle>
        <text fontFamily="Georgia" />
      </svg>
      <p className={\`font-['EB_Garamond'] \${x}\`} />
      <Icon color="tomato" />
      <span className="animate-pulse" />
      <span className="motion-safe:animate-[wiggle_1s_ease-in-out]" />
      <span className="transition duration-200 ease-in-out" />
      <span className={\`delay-[50ms] \${x}\`} />
      <span className="hover:transition-colors" />
    </div>
  );
}
`;

const good = `import { useTranslation } from 'react-i18next';

export function Good({ tone }: { tone: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="bg-background text-primary border-border font-sans font-black font-[600] font-[var(--heading)] animate-none transition-none"
      style={{ color: 'var(--primary)', background: 'url(a.png)', width: '2px', animation: 'none' }}
    >
      <span style={{ transition: 'var(--theme-motion-turn)' }}>{t('nav.transition')}</span>
      <svg aria-hidden="true" fill="none" stroke="currentColor">
        <path fill="url(#shade)" />
      </svg>
      <a href="#section">{t('nav.dice')}</a>
      <Icon color={tone} />
    </div>
  );
}
`;

describe('SHEET-02 no look written in a component', () => {
  it('fails on each kind of colour, font or animation written in a component', () => {
    const result = lint('apps/web/src/Sample.tsx', bad);
    expect(result.status).toBe(1);
    // Palette class, style colour, style font (3); hex in brackets (4); palette class with a
    // variant and an opacity (5); colour function in a template (6); typed colour (7); SVG fill
    // and stroke (8); style animation, background, transition (9); <animate> (10); SVG font (12);
    // font in brackets (14); icon colour (15); Tailwind's own animation (16); animation in
    // brackets (17); SHEET-05's transition classes: Tailwind's own (18), a delay in brackets in a
    // template (19), a transition with a variant (20).
    expect(result.lines).toEqual([
      3, 3, 3, 4, 5, 6, 7, 8, 8, 9, 9, 9, 10, 12, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  it('passes theme tokens, weights, currentColor, url(#...), var(--...) and anchors', () => {
    const result = lint('apps/web/src/Sample.tsx', good);
    expect(result.lines).toEqual([]);
    expect(result.status).toBe(0);
  });

  it('leaves .ts files alone: the manifest colour is a fixed value there (ADR 015 item 13)', () => {
    const result = lint('apps/web/src/config/Sample.ts', "export const COLOR = '#0a0a0a';\n");
    expect(result.lines).toEqual([]);
    expect(result.status).toBe(0);
  });
});

describe('SHEET-67 a component names its fill slot', () => {
  it('passes a slot name in a component fill, in place and nested', () => {
    const source = `export function Good() {
  return (
    <Part name="card" fill="card">
      <Part as="svg" name="chip" fill={'surface'} />
    </Part>
  );
}
`;
    const result = lint('apps/web/src/Slot.tsx', source);
    expect(result.lines).toEqual([]);
    expect(result.status).toBe(0);
  });

  it('still fails a colour in a component fill and an SVG fill inside one', () => {
    const source = `export function Bad() {
  return (
    <svg>
      <Part name="card" fill="#fff" />
      <Part name="card" render={<path fill="tomato" />}>
        <path fill="black" />
      </Part>
      <motion.path fill="tomato" />
    </svg>
  );
}
`;
    const result = lint('apps/web/src/Paint.tsx', source);
    expect(result.status).toBe(1);
    // A hex colour as a component's fill (4); an SVG fill in a component's prop (5); an SVG
    // fill inside a component (6); an SVG fill on a member name (8).
    expect(result.lines).toEqual([4, 5, 6, 8]);
  });
});
