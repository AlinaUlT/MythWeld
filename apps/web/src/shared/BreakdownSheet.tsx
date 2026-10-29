// SHEET-11: a number's breakdown, empty until SHEET-33 fills it.
// Its own file and its own i18n namespace (`breakdown`) keep that row apart from its wave.
// SHEET-30: the sheet mounts it on a number's long press, with that number's computed path.
export interface BreakdownSheetProps {
  path: string;
  onClose: () => void;
}

export function BreakdownSheet(_props: BreakdownSheetProps) {
  return null;
}
