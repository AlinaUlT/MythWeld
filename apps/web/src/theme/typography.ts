import type { ThemePart } from './part';

// The mockups' fonts, text sizes and line heights. A size is named by its pixels at the 360 px
// phone width and stored in rem, so the phone's own text size still scales it. EB Garamond is the
// heading placeholder until the owner picks (BRIEF X1); SHEET-06 ships both fonts in the app.
export const typography = {
  shared: {
    'font-body': 'Inter, system-ui, sans-serif',
    'font-heading': "'EB Garamond', Georgia, serif",
    'text-11': '0.6875rem',
    'text-12': '0.75rem',
    'text-13': '0.8125rem',
    'text-14': '0.875rem',
    'text-15': '0.9375rem',
    'text-16': '1rem',
    'text-17': '1.0625rem',
    'text-18': '1.125rem',
    'text-19': '1.1875rem',
    'text-20': '1.25rem',
    'text-21': '1.3125rem',
    'text-22': '1.375rem',
    'text-24': '1.5rem',
    'text-26': '1.625rem',
    'text-28': '1.75rem',
    'text-30': '1.875rem',
    'text-32': '2rem',
    'text-44': '2.75rem',
    'text-48': '3rem',
    'text-54': '3.375rem',
    'leading-tight': '1.1',
    'leading-snug': '1.35',
    'leading-22': '1.375rem',
    'leading-26': '1.625rem',
  },
} satisfies ThemePart;
