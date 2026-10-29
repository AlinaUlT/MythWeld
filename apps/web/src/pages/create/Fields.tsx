// SHEET-27: the pieces every step of the manual form is built from: the step's card, a picker, a
// text field, a short choice drawn side by side, a tick box, a switch and an amber warning line.
// Each is drawn with a part (ADR 015 item 7), so a skin shapes them; each control is 44 px tall.

import type { EntityId } from '@grimoire/schema';
import type { TFunction } from 'i18next';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppEntity } from '../../content/packs';
import { Part } from '../../theme/Part';
import { nameIn } from './draft';
import type { FormWarning } from './warnings';

export const fieldClass = 'h-control w-full bg-surface px-3 text-16 text-text';

/** A step of the form: its heading and what it asks. */
export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Part as="section" name="card" fill="card" className="flex flex-col gap-3 p-4">
      <h2 className="text-17 font-bold">{title}</h2>
      {children}
    </Part>
  );
}

/** A control with its label above it; `id` is the control's. */
export function Labelled({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-13 font-semibold text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

/** One option of a picker. */
export interface PickOption<V extends string = string> {
  value: V;
  label: string;
}

/** A picker of one value; `none` is the label of picking nothing, when nothing may be picked. */
export function Picker<V extends string>({
  label,
  value,
  options,
  none,
  onPick,
}: {
  label: string;
  value: V | undefined;
  options: readonly PickOption<V>[];
  none?: string;
  onPick: (value: V | undefined) => void;
}) {
  // Each option's value is one of `options`, so what the person picks is a `V`.
  const picked = (text: string) => options.find((option) => option.value === text)?.value;
  const id = useId();
  return (
    <Labelled id={id} label={label}>
      <Part
        as="select"
        id={id}
        name="field"
        className={fieldClass}
        value={value ?? ''}
        onChange={(event: { target: { value: string } }) => onPick(picked(event.target.value))}
      >
        {none !== undefined && <option value="">{none}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Part>
    </Labelled>
  );
}

/** A short choice from a list, as radio buttons drawn side by side. */
export function Segmented<V extends string>({
  label,
  name,
  value,
  values,
  names,
  onPick,
}: {
  label: string;
  name: string;
  value: V;
  values: readonly V[];
  names: (value: V) => string;
  onPick: (value: V) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-13 font-semibold text-muted">{label}</legend>
      <Part name="chip" className="flex gap-1 bg-soft p-1">
        {values.map((option) => (
          <Part
            as="label"
            key={option}
            name="chip"
            className="flex min-h-control grow basis-0 cursor-pointer items-center justify-center px-3 text-14 font-semibold text-muted has-checked:bg-strong has-checked:text-on-strong has-focus-visible:outline-2 has-focus-visible:outline-strong"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={option === value}
              onChange={() => onPick(option)}
              className="sr-only"
            />
            {names(option)}
          </Part>
        ))}
      </Part>
    </fieldset>
  );
}

/** A tick box with its label; `hint` is a second line. */
export function Tick({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-control items-center gap-3 ${disabled ? 'text-muted' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="size-5 shrink-0 accent-strong"
      />
      <span className="flex flex-col">
        <span className="text-15">{label}</span>
        {hint !== undefined && <span className="text-12 text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** A choice that is on or off, drawn as a switch. */
export function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="group flex min-h-control cursor-pointer items-center gap-3">
      <span className="flex grow flex-col gap-0.5">
        <span className="text-15">{label}</span>
        <span className="text-12 text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        aria-checked={on}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <Part
        as="span"
        name="chip"
        aria-hidden
        className="flex h-7 w-12 shrink-0 items-center bg-track p-0.5 group-has-checked:justify-end group-has-checked:bg-strong group-has-focus-visible:outline-2 group-has-focus-visible:outline-strong"
      >
        <span className="size-6 rounded-full bg-muted group-has-checked:bg-on-strong" />
      </Part>
    </label>
  );
}

/** Warnings, in amber, each on its own line. They never block "Create". */
export function Warnings({ warnings }: { warnings: readonly FormWarning[] }) {
  const { t } = useTranslation('create');
  if (warnings.length === 0) return null;
  return (
    <Part
      as="ul"
      name="panel"
      className="flex flex-col gap-1 bg-warn-bg px-3 py-2 text-13 text-warn-text"
    >
      {warnings.map((warning, at) => (
        // A warning has no id; the same one twice reads the same, so its place is its key.
        // biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt whole on each change.
        <li key={at}>{t(`warn.${warning.key}`, warning.values)}</li>
      ))}
    </Part>
  );
}

/** One line in amber, for a warning the form itself gives. */
export function WarningLine({ text }: { text: string }) {
  return (
    <Part as="p" name="panel" className="bg-warn-bg px-3 py-2 text-13 text-warn-text">
      {text}
    </Part>
  );
}

/**
 * The options of a picker of entries: each named, with its edition when the form mixes; the
 * current pick is kept among them when nothing offers it any more, named, or `Missing: <id>`.
 */
export function entryOptions(
  offered: readonly AppEntity[],
  current: EntityId | undefined,
  entities: readonly AppEntity[],
  mix: boolean,
  t: TFunction<'create'>,
): PickOption<EntityId>[] {
  const labelOf = (entity: AppEntity) =>
    mix
      ? t('withEdition', { name: nameIn(entity.name), ruleset: entity.ruleset })
      : nameIn(entity.name);
  const options = offered.map((entity) => ({ value: entity.id, label: labelOf(entity) }));
  if (current === undefined || options.some(({ value }) => value === current)) return options;
  const found = entities.find((entity) => entity.id === current);
  const label =
    found === undefined
      ? t('warn.missing', { id: current })
      : t('withEdition', { name: nameIn(found.name), ruleset: found.ruleset });
  return [{ value: current, label }, ...options];
}
