// SETUP-04: the layout every page sits in: the page on top, the tab bar fixed to the bottom.
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { cn } from '../lib/cn';
import { tabs } from './tabs';

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="px-4 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-4">
          {tabs.map(({ path, icon: Icon, labelKey }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 text-xs',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                <Icon aria-hidden className="size-6" />
                <span>{t(labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
