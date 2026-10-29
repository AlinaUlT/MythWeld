// SHEET-11: the router (ADR 008). `/` is the start page; an unknown path opens it too. Every phase 2
// screen has its route here, so the rows that fill the screens never edit this file.
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { CharactersPage } from './pages/CharactersPage';
import { DicePage } from './pages/DicePage';
import { NewCharacterPage } from './pages/NewCharacterPage';
import { PlayerPage } from './pages/PlayerPage';
import { SettingsPage } from './pages/SettingsPage';
import { SheetPage } from './pages/SheetPage';
import { StartPage } from './pages/StartPage';
import { AppLayout } from './shell/AppLayout';
import { paths } from './shell/routes';

const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      children: [
        { path: paths.start, element: <StartPage /> },
        { path: paths.player, element: <PlayerPage /> },
        { path: paths.settings, element: <SettingsPage /> },
        { path: paths.characters, element: <CharactersPage /> },
        { path: paths.newCharacter, element: <NewCharacterPage /> },
        { path: paths.sheet, element: <SheetPage /> },
        { path: paths.dice, element: <DicePage /> },
        { path: '*', element: <Navigate to={paths.start} replace /> },
      ],
    },
  ],
  // Vite sets BASE_URL from `base`, so the app is found under whatever path it is served from.
  { basename: import.meta.env.BASE_URL },
);

export function App() {
  return <RouterProvider router={router} />;
}
