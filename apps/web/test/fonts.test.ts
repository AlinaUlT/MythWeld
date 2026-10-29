import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { FONT_PACKAGES } from '../src/config/fonts';
import { baseTheme } from '../src/theme/theme';

const require = createRequire(import.meta.url);
const css = readFileSync(new URL('../src/theme/fonts.css', import.meta.url), 'utf8');
const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map((match) => {
  const body = match[1] ?? '';
  return {
    family: body.match(/font-family: "?([^";]+)"?;/)?.[1],
    url: body.match(/url\("([^"]+)"\)/)?.[1] ?? '',
    ranges: body.match(/unicode-range:\s*([^;]+);/)?.[1]?.replace(/\s+/g, ' ') ?? '',
  };
});
// The first family a token names is the one the app ships; the rest are fallbacks.
const firstFamily = (stack: string) => stack.split(',')[0]?.trim().replace(/'/g, '');
const bodyFamily = firstFamily(baseTheme.shared['font-body'] ?? '');
const headingFamily = firstFamily(baseTheme.shared['font-heading'] ?? '');

describe('SHEET-06 the app ships its fonts', () => {
  it('declares the two families the font tokens name, and no other', () => {
    expect(new Set(faces.map((face) => face.family))).toEqual(new Set([bodyFamily, headingFamily]));
  });

  it('loads every file from a shipped package, never from a font service', () => {
    for (const face of faces) {
      expect(face.url).not.toMatch(/^(https?:)?\/\//);
      expect(FONT_PACKAGES.some((font) => face.url.startsWith(`${font.name}/files/`))).toBe(true);
      expect(() => require.resolve(face.url)).not.toThrow();
    }
  });

  it('covers Latin and Cyrillic letters in each family', () => {
    for (const family of [bodyFamily, headingFamily]) {
      const ranges = faces.filter((face) => face.family === family).map((face) => face.ranges);
      expect(ranges.some((range) => range.startsWith('U+0000-00FF'))).toBe(true);
      expect(ranges.some((range) => range.includes('U+0400-045F'))).toBe(true);
    }
  });

  it('ships only packages whose own licence file is the SIL Open Font License 1.1', () => {
    for (const font of FONT_PACKAGES) {
      const pkg = require(`${font.name}/package.json`) as { license: string };
      expect(pkg.license).toBe('OFL-1.1');
      const license = readFileSync(require.resolve(`${font.name}/LICENSE`), 'utf8');
      expect(license).toContain(
        'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
      );
      expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007');
    }
  });
});
