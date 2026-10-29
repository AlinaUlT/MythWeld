// SHEET-11: every English namespace, one file per screen or shared piece, so two rows of one wave
// never edit one locale file. A new screen or piece adds its file here.
// SHEET-30: one namespace per section of the sheet's tabs, and per panel the sheet opens, each
// empty until its row fills it (`apps/web/src/sheet/`).

import about from '../locales/en/about.json' with { type: 'json' };
import actions from '../locales/en/actions.json' with { type: 'json' };
import attacks from '../locales/en/attacks.json' with { type: 'json' };
import breakdown from '../locales/en/breakdown.json' with { type: 'json' };
import characters from '../locales/en/characters.json' with { type: 'json' };
import checks from '../locales/en/checks.json' with { type: 'json' };
import choices from '../locales/en/choices.json' with { type: 'json' };
import coins from '../locales/en/coins.json' with { type: 'json' };
import common from '../locales/en/common.json' with { type: 'json' };
import concentration from '../locales/en/concentration.json' with { type: 'json' };
import conditions from '../locales/en/conditions.json' with { type: 'json' };
import create from '../locales/en/create.json' with { type: 'json' };
import deathSaves from '../locales/en/deathSaves.json' with { type: 'json' };
import description from '../locales/en/description.json' with { type: 'json' };
import dice from '../locales/en/dice.json' with { type: 'json' };
import features from '../locales/en/features.json' with { type: 'json' };
import gear from '../locales/en/gear.json' with { type: 'json' };
import inspiration from '../locales/en/inspiration.json' with { type: 'json' };
import notes from '../locales/en/notes.json' with { type: 'json' };
import numberPad from '../locales/en/numberPad.json' with { type: 'json' };
import player from '../locales/en/player.json' with { type: 'json' };
import rest from '../locales/en/rest.json' with { type: 'json' };
import roll from '../locales/en/roll.json' with { type: 'json' };
import settings from '../locales/en/settings.json' with { type: 'json' };
import sheet from '../locales/en/sheet.json' with { type: 'json' };
import spells from '../locales/en/spells.json' with { type: 'json' };
import start from '../locales/en/start.json' with { type: 'json' };
import toast from '../locales/en/toast.json' with { type: 'json' };
import token from '../locales/en/token.json' with { type: 'json' };
import turn from '../locales/en/turn.json' with { type: 'json' };

export const en = {
  common,
  start,
  player,
  settings,
  characters,
  create,
  sheet,
  dice,
  toast,
  roll,
  breakdown,
  description,
  checks,
  conditions,
  concentration,
  deathSaves,
  attacks,
  turn,
  spells,
  gear,
  coins,
  features,
  about,
  notes,
  inspiration,
  token,
  numberPad,
  rest,
  actions,
  choices,
};

export type Namespaces = typeof en;
