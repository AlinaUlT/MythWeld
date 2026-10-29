// SHEET-30: the Damage and Heal number pad (board V3-Keypad), empty until SHEET-40 fills it.
// The frame mounts it while it is open. Its own file and its own i18n namespace
// (`numberPad`) keep that row apart from its wave.
import type { PanelProps } from './panel';

/** Which dock button opened the pad. */
export type NumberPadMode = 'damage' | 'heal';

export interface NumberPadProps extends PanelProps {
  mode: NumberPadMode;
}

export function NumberPad(_props: NumberPadProps) {
  return null;
}
