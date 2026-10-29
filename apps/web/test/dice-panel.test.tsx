import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../src/i18n';
import { DicePanel, DiceSheet } from '../src/shared/DicePanel';

const pressed = (markup: string) =>
  [...markup.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)].map(
    ([, on, text]) => [text, on],
  );

describe('SHEET-38 the dice panel', () => {
  it('opens on 1d20, with the standard dice and no rolls yet', () => {
    const markup = renderToStaticMarkup(<DicePanel editing={false} />);
    expect(pressed(markup)).toEqual([
      ['d4', 'false'],
      ['d6', 'false'],
      ['d8', 'false'],
      ['d10', 'false'],
      ['d12', 'false'],
      ['d20', 'true'],
      ['d100', 'false'],
    ]);
    expect(markup).toContain('value="1d20"');
    expect(markup).toContain('No rolls yet');
    expect(markup).toContain('Roll 1d20');
    expect(markup).not.toContain('Add die');
  });

  it('asks the faces of a new die in the edit mode', () => {
    expect(renderToStaticMarkup(<DicePanel editing />)).toContain('Add die');
  });
});

describe('SHEET-38 the half-screen frame', () => {
  it('draws nothing while closed', () => {
    expect(renderToStaticMarkup(<DiceSheet open={false} onClose={() => undefined} />)).toBe('');
  });

  it('is a dialog at most half the screen high', () => {
    const markup = renderToStaticMarkup(<DiceSheet open onClose={() => undefined} />);
    expect(markup).toMatch(/role="dialog" aria-modal="true"[^>]*class="[^"]*max-h-\[50dvh\]/);
    expect(markup).toContain('>Dice</h2>');
    expect(markup).toContain('Edit dice');
    expect(markup).toContain('aria-label="Close"');
  });
});
