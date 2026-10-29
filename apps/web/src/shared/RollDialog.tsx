// SHEET-11: the roll dialog, empty until SHEET-39 fills it.
// Its own file and its own i18n namespace (`roll`) keep that row apart from its wave.
// SHEET-30: the sheet mounts it on a tap of a number that rolls, with that number's computed path.
export interface RollDialogProps {
  path: string;
  onClose: () => void;
}

export function RollDialog(_props: RollDialogProps) {
  return null;
}
