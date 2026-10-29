// SHEET-11: every English namespace, one file per screen or shared piece, so two rows of one wave
// never edit one locale file. A new screen or piece adds its file here.
import breakdown from '../locales/en/breakdown.json' with { type: 'json' };
import characters from '../locales/en/characters.json' with { type: 'json' };
import common from '../locales/en/common.json' with { type: 'json' };
import create from '../locales/en/create.json' with { type: 'json' };
import description from '../locales/en/description.json' with { type: 'json' };
import dice from '../locales/en/dice.json' with { type: 'json' };
import player from '../locales/en/player.json' with { type: 'json' };
import roll from '../locales/en/roll.json' with { type: 'json' };
import settings from '../locales/en/settings.json' with { type: 'json' };
import sheet from '../locales/en/sheet.json' with { type: 'json' };
import start from '../locales/en/start.json' with { type: 'json' };
import toast from '../locales/en/toast.json' with { type: 'json' };

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
};

export type Namespaces = typeof en;
