import type { CSSProperties } from 'react';
import type { ThemePart } from './part';
import { camel } from './slots';

// SHEET-04: each part's shape comes from a fixed menu of styles the app has built (ADR 015 item 7).
// A style sets every property of `partProperties`, each from the tokens, so a skin picks a style by
// name and changes its look through the same tokens (`radius-card`, `color-line`, …); it cannot
// write a style of its own. The fill stays the slot's or a colour token's (SHEET-03).
export const partProperties = ['border', 'border-radius', 'box-shadow'] as const;

type PartProperty = (typeof partProperties)[number];
type PartStyle = Record<PartProperty, string>;

const token = (key: string) => `var(--theme-${key})`;
const line = (width: string, style: string, color: string) =>
  `${width} ${style} ${token(`color-${color}`)}`;

// A window's bevel: a light edge top and left, a dark one bottom and right.
const bevel = `inset 2px 2px 0 ${token('color-surface')}, inset -2px -2px 0 ${token('color-muted')}`;

function style(border: string, radius: string, shadow: string): PartStyle {
  return { border, 'border-radius': radius, 'box-shadow': shadow };
}

const button = {
  flat: style('none', token('radius-button'), 'none'),
  outlined: style(line('1px', 'solid', 'muted'), token('radius-button'), 'none'),
  raised: style('none', token('radius-button'), token('shadow-raised')),
  bevel: style(line('1px', 'solid', 'strong'), '0', bevel),
};

export const partStyles = {
  button,
  'button-secondary': button,
  'icon-button': {
    plain: style('none', token('radius-button'), 'none'),
    outlined: style(line('1px', 'solid', 'line'), token('radius-button'), 'none'),
    round: style(line('1px', 'solid', 'line'), token('radius-pill'), 'none'),
  },
  card: {
    outlined: style(line('1px', 'solid', 'line'), token('radius-card'), 'none'),
    flat: style('none', token('radius-card'), 'none'),
    raised: style('none', token('radius-card'), token('shadow-raised')),
  },
  panel: {
    outlined: style(line('1px', 'solid', 'line'), token('radius-panel'), 'none'),
    flat: style('none', token('radius-panel'), 'none'),
    raised: style('none', token('radius-panel'), token('shadow-raised')),
    window: style(line('1px', 'solid', 'strong'), '0', bevel),
  },
  chip: {
    flat: style('none', token('radius-pill'), 'none'),
    outlined: style(line('1px', 'solid', 'muted'), token('radius-pill'), 'none'),
    dashed: style(line('1px', 'dashed', 'muted'), token('radius-pill'), 'none'),
  },
  sheet: {
    floating: style(
      'none',
      `${token('radius-sheet')} ${token('radius-sheet')} 0 0`,
      token('shadow-sheet'),
    ),
    edged: style(
      line('1px', 'solid', 'line'),
      `${token('radius-sheet')} ${token('radius-sheet')} 0 0`,
      'none',
    ),
    window: style(line('1px', 'solid', 'strong'), '0', bevel),
  },
  toast: {
    flat: style('none', token('radius-button'), 'none'),
    raised: style('none', token('radius-button'), token('shadow-float')),
  },
  // SHEET-27: a text field or a picker the person types or picks in (the manual form).
  field: {
    outlined: style(line('1px', 'solid', 'muted'), token('radius-field'), 'none'),
    underlined: style('none', '0', `inset 0 -1px 0 ${token('color-muted')}`),
    window: style(line('1px', 'solid', 'strong'), '0', `inset 2px 2px 0 ${token('color-muted')}`),
  },
} as const satisfies Record<string, Record<string, PartStyle>>;

export type PartName = keyof typeof partStyles;
export type PartPicks = { [P in PartName]: keyof (typeof partStyles)[P] & string };

// The base theme's pick for each part: the look the V3 boards draw.
export const basePicks: PartPicks = {
  button: 'flat',
  'button-secondary': 'outlined',
  'icon-button': 'plain',
  card: 'outlined',
  panel: 'outlined',
  chip: 'flat',
  sheet: 'floating',
  toast: 'flat',
  field: 'outlined',
};

// The theme keys `part-<part>-<property>` a set of picks fills. A pick the menu lacks throws, so a
// skin naming a style this app does not have is refused, not drawn half-styled.
export function partsTheme(picks: Record<string, string>): ThemePart {
  const shared: Record<string, string> = {};
  for (const name of Object.keys(partStyles) as PartName[]) {
    const menu: Record<string, PartStyle> = partStyles[name];
    const pick = picks[name];
    const chosen = pick === undefined ? undefined : menu[pick];
    if (!chosen) throw new Error(`Part ${name} has no style ${pick}`);
    for (const property of partProperties) shared[`part-${name}-${property}`] = chosen[property];
  }
  return { shared };
}

export const parts = partsTheme(basePicks);

// The style a part's element wears: each property reads the part's theme key.
export function partStyle(name: PartName): CSSProperties {
  return Object.fromEntries(
    partProperties.map((property) => [camel(property), `var(--theme-part-${name}-${property})`]),
  );
}
