// SHEET-13: the person's display choices (SPEC §7.5, BRIEF P10, not drawn yet, so built from
// SHEET-04's parts): the units shown, "I roll myself", the theme and the motion switch. Each takes
// effect at once and is kept on the device. Language, backup, packs, AI and purchases come with
// their phases.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type SettingKey, type Settings, settingValues } from '../settings/settings';
import { changeSetting, useSettings } from '../settings/useSettings';
import { Page } from '../shell/Page';
import { Part } from '../theme/Part';

const row = 'flex min-h-control items-center gap-3 px-4 py-2.5';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-13 font-semibold text-muted">{title}</h2>
      <Part name="card" fill="card" className="flex flex-col divide-y divide-line">
        {children}
      </Part>
    </section>
  );
}

type ChoiceKey = { [K in SettingKey]: Settings[K] extends string ? K : never }[SettingKey];
type SwitchKey = { [K in SettingKey]: Settings[K] extends boolean ? K : never }[SettingKey];

/**
 * One value of a choice from a short list, as radio buttons drawn side by side. When they do not
 * fit beside the label at 360 px (three distance units, SHEET-68), they move under it.
 */
function Choice<K extends ChoiceKey>({
  setting,
  label,
  names,
}: {
  setting: K;
  label: string;
  names: (value: Settings[K]) => string;
}) {
  const value = useSettings()[setting];
  // Each list is one choice's values, so its entries are that choice's type.
  const values = settingValues[setting] as readonly string[] as readonly Settings[K][];
  return (
    <fieldset className={`${row} flex-wrap`}>
      <legend className="sr-only">{label}</legend>
      <span aria-hidden className="grow text-15">
        {label}
      </span>
      <Part name="chip" className="flex shrink-0 gap-1 bg-soft p-1">
        {values.map((option) => (
          <Part
            as="label"
            key={option}
            name="chip"
            className="flex min-h-control min-w-18 cursor-pointer items-center justify-center px-3 text-14 font-semibold text-muted has-checked:bg-strong has-checked:text-on-strong has-focus-visible:outline-2 has-focus-visible:outline-strong"
          >
            <input
              type="radio"
              name={setting}
              value={option}
              checked={option === value}
              onChange={() => changeSetting(setting, option)}
              className="sr-only"
            />
            {names(option)}
          </Part>
        ))}
      </Part>
    </fieldset>
  );
}

/** A choice that is on or off. */
function Switch({ setting, label, hint }: { setting: SwitchKey; label: string; hint: string }) {
  const on = useSettings()[setting];
  return (
    <label className={`${row} group cursor-pointer`}>
      <span className="flex grow flex-col gap-0.5">
        <span className="text-15">{label}</span>
        <span className="text-12 text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        aria-checked={on}
        onChange={(event) => changeSetting(setting, event.target.checked)}
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

export function SettingsPage() {
  const { t } = useTranslation('settings');
  return (
    <Page title={t('title')} back="history">
      <div className="flex flex-col gap-6 px-4 pt-2 pb-10">
        <Group title={t('units.title')}>
          <Choice
            setting="distance"
            label={t('units.distance')}
            names={(unit) => t(`units.${unit}`)}
          />
          <Choice setting="weight" label={t('units.weight')} names={(unit) => t(`units.${unit}`)} />
        </Group>
        <Group title={t('dice.title')}>
          <Switch
            setting="rollMyself"
            label={t('dice.rollMyself')}
            hint={t('dice.rollMyselfHint')}
          />
        </Group>
        <Group title={t('theme.title')}>
          <Choice setting="theme" label={t('theme.mode')} names={(mode) => t(`theme.${mode}`)} />
          <Switch
            setting="stillMotion"
            label={t('theme.stillMotion')}
            hint={t('theme.stillMotionHint')}
          />
        </Group>
      </div>
    </Page>
  );
}
