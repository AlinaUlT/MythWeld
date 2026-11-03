// SHEET-50: a labelled switch of the sheet (SHEET-48's features, SHEET-50's worn and attuned): the
// label, then a switch the size of a tap target. It only says what the person tapped; the change it
// makes is its caller's.
import { useId } from 'react';
import { Part } from '../theme/Part';

export function SwitchRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-control items-center gap-3">
      <span id={id} className="grow text-14">
        {label}
      </span>
      <Part
        as="button"
        type="button"
        name="chip"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        onClick={() => onChange(!on)}
        className="flex h-7 w-12 shrink-0 items-center bg-track p-0.5 aria-checked:justify-end aria-checked:bg-strong"
      >
        <span className="size-6 rounded-full bg-muted" />
      </Part>
    </div>
  );
}
