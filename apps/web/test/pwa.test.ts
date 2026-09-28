import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_BACKGROUND_COLOR } from '../src/config/app';

// Every PNG icon is generated from this one file at build time.
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');

describe('SETUP-07 app icon', () => {
  it('is a square drawing, as the icon generator needs', () => {
    expect(svg).toContain('viewBox="0 0 512 512"');
  });

  it('is drawn on the app background, so it matches the splash screen', () => {
    expect(svg).toContain(
      `<rect width="512" height="512" rx="96" fill="${APP_BACKGROUND_COLOR}"/>`,
    );
  });

  it('holds no text, so it renders the same on every machine', () => {
    expect(svg).not.toContain('<text');
  });
});
