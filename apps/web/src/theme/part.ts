// SHEET-01: one concern of a theme. Each key is the Tailwind theme variable it fills, without the
// leading `--` (`color-bg` fills `--color-bg`, so `bg-bg` paints with it). `light` and `dark`
// hold what changes with the mode; `shared` holds what both modes use. SHEET-05: `still` holds
// the values a shared key takes while motion is stopped (ADR 015 item 9).
export interface ThemePart {
  light?: Record<string, string>;
  dark?: Record<string, string>;
  shared?: Record<string, string>;
  still?: Record<string, string>;
}
