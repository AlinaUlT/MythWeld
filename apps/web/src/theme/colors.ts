import type { ThemePart } from './part';

// The colours of docs/design/mockups/README.md ("The tokens these mockups use"), named in kebab
// case. Light is the mockups' value. Dark is not drawn yet, so its values are placeholders with
// the same contrast rules, measured in test/theme.test.ts. Both stay placeholders until the owner
// picks the base colours (BRIEF Part 5).
export const colors = {
  light: {
    'color-bg': '#F5F5F3',
    'color-surface': '#FFFFFF',
    'color-text': '#1C1D20',
    'color-strong': '#1C1D20',
    'color-on-strong': '#FFFFFF',
    'color-muted': '#5E6269',
    'color-line': '#E2E2DE',
    'color-soft': '#EDECE8',
    'color-hp': '#B5473A',
    'color-track': '#E6E3DF',
    'color-temp': '#2F7A4A',
    'color-warn-bg': '#FBF1D9',
    'color-warn-text': '#6B4A00',
    'color-danger': '#A23A2E',
    'color-neutral': '#44464B',
    'color-scrim-low': 'rgba(20, 20, 22, 0.25)',
    'color-scrim-mid': 'rgba(20, 20, 22, 0.35)',
    'color-scrim': 'rgba(20, 20, 22, 0.45)',
    'color-scrim-high': 'rgba(20, 20, 22, 0.55)',
  },
  dark: {
    'color-bg': '#131417',
    'color-surface': '#1C1D21',
    'color-text': '#ECEBE7',
    'color-strong': '#ECEBE7',
    'color-on-strong': '#1C1D20',
    'color-muted': '#A2A6AD',
    'color-line': '#303237',
    'color-soft': '#26272C',
    'color-hp': '#E0705F',
    'color-track': '#2E2F33',
    'color-temp': '#5DBB82',
    'color-warn-bg': '#362B12',
    'color-warn-text': '#F0CF7E',
    'color-danger': '#EE8273',
    'color-neutral': '#B9BCC2',
    'color-scrim-low': 'rgba(0, 0, 0, 0.35)',
    'color-scrim-mid': 'rgba(0, 0, 0, 0.45)',
    'color-scrim': 'rgba(0, 0, 0, 0.55)',
    'color-scrim-high': 'rgba(0, 0, 0, 0.65)',
  },
} satisfies ThemePart;
