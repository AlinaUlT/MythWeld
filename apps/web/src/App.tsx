// SETUP-04: the router. The shell is the layout; `/` and unknown paths open the first tab.
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { CharactersPage } from './pages/CharactersPage';
import { DicePage } from './pages/DicePage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppShell } from './shell/AppShell';
import { defaultTabPath } from './shell/tabs';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to={defaultTabPath} replace /> },
      { path: 'characters', element: <CharactersPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'dice', element: <DicePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to={defaultTabPath} replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
