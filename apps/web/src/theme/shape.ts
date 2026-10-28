import type { ThemePart } from './part';

// The mockups' corners, shadows and control heights. Each corner is named by what wears it; a
// shape whose corner is half its height (bars, chips, pills) is `pill`. A shadow is darker in the
// dark mode, where the mockups' light shadows would not show.
export const shape = {
  shared: {
    'radius-xs': '4px',
    'radius-badge': '6px',
    'radius-field': '10px',
    'radius-button': '12px',
    'radius-card': '14px',
    'radius-panel': '16px',
    'radius-sheet': '20px',
    'radius-pill': '9999px',
    'spacing-control': '44px',
    'spacing-control-lg': '48px',
  },
  light: {
    'shadow-raised': '0 1px 3px rgba(0, 0, 0, 0.12)',
    'shadow-dock': '0 -4px 12px rgba(0, 0, 0, 0.05)',
    'shadow-sheet': '0 -8px 24px rgba(0, 0, 0, 0.18)',
    'shadow-float': '0 6px 16px rgba(0, 0, 0, 0.25)',
  },
  dark: {
    'shadow-raised': '0 1px 3px rgba(0, 0, 0, 0.4)',
    'shadow-dock': '0 -4px 12px rgba(0, 0, 0, 0.3)',
    'shadow-sheet': '0 -8px 24px rgba(0, 0, 0, 0.5)',
    'shadow-float': '0 6px 16px rgba(0, 0, 0, 0.6)',
  },
} satisfies ThemePart;
