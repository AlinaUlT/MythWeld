// SHEET-58: the sheet's "⋯" menu (ADR 013 item 2, BRIEF P4, board V3-Actions), top to bottom: Level
// up, Link for the DM, Export, Copy, Transfer, Rules options, Change history, Delete. The rows of
// My characters' Actions (SHEET-25: `ActionRows`) run Export, Copy and Delete; this menu adds its own
// around them. Level up (phase 4), Link for the DM and Transfer (the table link), Rules options
// (phase 4's house rules) and Change history (SHEET-59) show as coming later, shown and not
// tappable. Rest and Edit stay header buttons. Delete from the sheet goes back to My characters
// first: the page would show a character that is gone. The toast offers "Undo".
import { History, Settings2, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BottomSheet } from '../../shared/BottomSheet';
import { ActionRow, ActionRows } from '../../shared/CharacterActions';
import { paths } from '../../shell/routes';
import { useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

export function ActionsMenu({ onClose }: PanelProps) {
  const { t } = useTranslation('actions');
  const { t: tc } = useTranslation();
  const { character } = useSheet();
  const navigate = useNavigate();
  const later = tc('comingLater');
  return (
    <BottomSheet title={character.name} onClose={onClose}>
      <div className="-mx-5 flex flex-col" data-testid="sheet-actions">
        <ActionRows
          target={{ id: character.id, name: character.name, opens: true }}
          onClose={onClose}
          first={<ActionRow icon={TrendingUp} label={t('levelUp')} note={later} />}
          beforeDelete={
            <>
              <ActionRow icon={Settings2} label={t('rules')} note={later} />
              <ActionRow icon={History} label={t('history')} note={later} />
            </>
          }
          afterDelete={() => void navigate(paths.characters)}
        />
      </div>
    </BottomSheet>
  );
}
