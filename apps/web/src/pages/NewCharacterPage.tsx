// SHEET-27: the manual form (SPEC §7.4 manual mode, BRIEF P3, board V3-Create): one scrolling form,
// each step in its own file, and a bar pinned at the bottom with the live AC, hit points and
// initiative, computed on every change. Warnings show in amber under what they are about and never
// block "Create": it saves the character at full hit points and opens its sheet. Steps that open
// and close, score methods and the roll calculator are phase 4's (ADR 010, ADR 013).
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { contentOf, installedPacks } from '../content/packs';
import { saveCharacter } from '../db/characters';
import { Page } from '../shell/Page';
import { paths, sheetPath } from '../shell/routes';
import { MANUAL_FORM_SYSTEMS, type ManualFormSystem } from '../systems';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';
import { AbilitiesStep } from './create/AbilitiesStep';
import { ClassesStep } from './create/ClassesStep';
import { askOf, type Draft, newDraft, type StepProps, statsOf } from './create/draft';
import { EquipmentStep } from './create/EquipmentStep';
import { WarningLine } from './create/Fields';
import { NameStep } from './create/NameStep';
import { OriginStep } from './create/OriginStep';
import { RulesStep } from './create/RulesStep';

/** The id and time the live numbers are computed with; the saved character gets its own. */
const DRAFT_ID = '00000000-0000-4000-8000-000000000000';
const DRAFT_AT = '2000-01-01T00:00:00.000Z';

/** The manual form's system: the one it offers for now (BRIEF P3 step 1). */
function formOf(system: string): ManualFormSystem {
  const form = MANUAL_FORM_SYSTEMS.find((each) => each.system === system) ?? MANUAL_FORM_SYSTEMS[0];
  if (form === undefined) throw new Error('The app carries no system the manual form can make.');
  return form;
}

function LiveNumber({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex grow basis-0 flex-col items-center">
      <span className="text-22 leading-tight font-bold" data-testid="live-number">
        {value}
      </span>
      <span className="text-12 text-muted">{label}</span>
    </span>
  );
}

/** A computed number as the bar shows it; a value that is not a number shows a dash. */
function shown(value: unknown, t: TFunction<'create'>, signed = false): string {
  if (typeof value !== 'number') return t('bar.none');
  return signed ? t('bar.signed', { value }) : t('bar.plain', { value });
}

export function NewCharacterPage() {
  const { t } = useTranslation('create');
  const navigate = useNavigate();
  const installed = installedPacks().packs;
  const [draft, setDraft] = useState<Draft>(() => newDraft(formOf(''), installed));
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = formOf(draft.system);

  const { index } = useMemo(
    () => contentOf({ system: draft.system, packs: draft.packs }, installed),
    [draft.system, draft.packs, installed],
  );
  const { ruleset, mix } = draft;
  const stats = useMemo(() => statsOf(index, { ruleset, mix }), [index, ruleset, mix]);
  const unnamed = t('unnamed');
  const { computed } = useMemo(
    () =>
      form.make(
        askOf(
          draft,
          stats.map(({ key }) => key),
          { id: DRAFT_ID, at: DRAFT_AT, unnamed },
        ),
        index,
      ),
    [form, draft, stats, index, unnamed],
  );

  const props: StepProps = {
    draft,
    change: (next) => setDraft((now) => next(now)),
    form,
    installed,
    entities: index.entities,
    computed,
    stats,
  };

  async function create() {
    setSaving(true);
    setFailed(false);
    const ask = askOf(
      draft,
      stats.map(({ key }) => key),
      { id: crypto.randomUUID(), at: new Date().toISOString(), unnamed },
    );
    try {
      const saved = await saveCharacter(form.make(ask, index).character);
      if (saved.ok) {
        navigate(sheetPath(saved.value.id));
        return;
      }
      console.error(saved.message);
    } catch (error) {
      console.error(error);
    }
    setFailed(true);
    setSaving(false);
  }

  return (
    <Page title={t('title')} back={paths.characters}>
      <div className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <RulesStep {...props} />
        <NameStep {...props} />
        <OriginStep {...props} />
        <ClassesStep {...props} />
        <AbilitiesStep {...props} />
        <EquipmentStep {...props} />
      </div>
      <Slot
        as="footer"
        name="dock"
        className="sticky bottom-0 flex flex-col gap-2.5 px-4 pt-2.5 pb-3"
        aria-label={t('bar.label')}
      >
        <div className="flex" aria-live="polite">
          <LiveNumber label={t('bar.ac')} value={shown(computed.values['ac.total'], t)} />
          <LiveNumber label={t('bar.hp')} value={shown(computed.values['hp.max'], t)} />
          <LiveNumber label={t('bar.init')} value={shown(computed.values['init.total'], t, true)} />
        </div>
        {failed && <WarningLine text={t('failed')} />}
        <Part
          as="button"
          type="button"
          name="button"
          fill="button"
          disabled={saving}
          onClick={create}
          className="flex h-control items-center justify-center text-16 font-semibold text-on-strong"
        >
          {t('create')}
        </Part>
      </Slot>
    </Page>
  );
}
