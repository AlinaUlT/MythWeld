// SHEET-11: the layout every page sits in. No bottom bar (ADR 008 item 1): each page draws its own
// header, with a back arrow and, where it needs one, the gear. The toasts sit over every page.
import { Outlet } from 'react-router';
import { ToastHost } from '../shared/ToastHost';
import { Slot } from '../theme/Slot';

export function AppLayout() {
  return (
    <Slot name="app" className="min-h-dvh text-text">
      <Outlet />
      <ToastHost />
    </Slot>
  );
}
