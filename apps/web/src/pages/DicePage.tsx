// SHEET-11: the dice page's route. SHEET-38: it holds the dice panel, rolling for no character
// (board V3-Dice); "Edit dice" in the header adds the person's own dice.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DicePanel, EditDiceButton } from '../shared/DicePanel';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function DicePage() {
  const { t } = useTranslation('dice');
  const [editing, setEditing] = useState(false);
  return (
    <Page
      title={t('title')}
      back={paths.player}
      action={<EditDiceButton editing={editing} onToggle={() => setEditing(!editing)} />}
    >
      <DicePanel editing={editing} />
    </Page>
  );
}
