// SETUP-04: the bottom-bar tabs as data, in the order of SPEC §7.1.
import { BookOpen, Dices, type LucideIcon, Settings, Users } from 'lucide-react';

export type TabLabelKey = 'nav.characters' | 'nav.library' | 'nav.dice' | 'nav.settings';

export interface Tab {
  path: string;
  icon: LucideIcon;
  labelKey: TabLabelKey;
}

export const tabs: readonly Tab[] = [
  { path: '/characters', icon: Users, labelKey: 'nav.characters' },
  { path: '/library', icon: BookOpen, labelKey: 'nav.library' },
  { path: '/dice', icon: Dices, labelKey: 'nav.dice' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export const defaultTabPath = '/characters';
