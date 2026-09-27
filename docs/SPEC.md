# Grimoire — лист персонажа и справочник для 5e (2014 + 2024)

> Техническое задание для Claude Code · версия 1.0 · 26.09.2026
> «Grimoire» — рабочее название; меняется в одном месте (`APP_NAME` и scope пакетов `@grimoire/*`).

---

## 0. Как работать с этим документом

**Для Claude Code**

1. Прочитай документ целиком до начала работы. Положи его в репозиторий как `docs/SPEC.md`.
2. Создай `CLAUDE.md` в корне из Приложения А.
3. Работай строго по этапам раздела 12: один этап — одна ветка и один PR. Следующий этап не начинается, пока не выполнены все пункты «Готово, когда».
4. Решения раздела 2 приняты. Если решение по ходу работы кажется неверным, не меняй его молча: опиши проблему и альтернативу в `docs/adr/NNN-название.md` и спроси.
5. Всё, что помечено **[ПРОВЕРИТЬ]**, сверь с первоисточником (текст SRD, код dnd5e) до реализации.
6. Код, комментарии и коммиты — на английском. Интерфейс — на русском и английском. Документация в `docs/` — на русском.

**Для владельца проекта:** разделы 1–3 и 13–14 читаются за 10 минут, остальное написано для Claude Code.

**Первый запрос в Claude Code** (в пустом репозитории, куда положен этот файл как `docs/SPEC.md`):

> Прочитай docs/SPEC.md целиком. Создай CLAUDE.md из Приложения А. Задай вопросы, если что-то в разделах 2–6 противоречит друг другу, затем выполни этап 0 из раздела 12 и покажи, как открыть приложение на телефоне.

---

## 1. Что строим

Мобильное offline-first приложение (ставится на телефон как PWA) с тремя опорами:

1. **Интерактивный лист персонажа** для правил 2014 и 2024 годов. Все производные числа — модификаторы, спасброски, навыки, КД, хиты, ячейки заклинаний — считаются автоматически, и у каждого числа можно посмотреть, из чего оно сложилось.
2. **Справочник**: виды/расы, классы, предыстории, черты, заклинания, снаряжение, состояния, правила — на русском и английском.
3. **Кастомизация**: свои характеристики, навыки, черты, заклинания, виды, предыстории, предметы. Всё связано через один движок правил: новая черта, дающая владение новым навыком, сразу меняет лист.

Первый релиз — лист персонажа. Дальше: помощник мастера, встроенный AI-ассистент, экспорт и интеграция с Foundry VTT, возможно — своя упрощённая «виртуальная комната».

**Референс — RPG Companion (Android):** менеджер листов, конструктор хоумбрю, компендиум, кубы, кампании, трекер инициативы и устанавливаемые «системные файлы» из репозиториев сообщества. Чем отличаемся:
- прозрачный движок — каждое число объяснимо и переопределяемо;
- 2014 и 2024 в одном приложении с корректной разницей правил;
- русский язык как родной, а не как перевод интерфейса.

---

## 2. Ключевые решения

| # | Решение | Почему | Альтернатива и цена |
|---|---|---|---|
| D1 | **PWA: Vite + React + TypeScript**; позже обёртка Capacitor для APK | Claude Code может сам запускать и проверять веб-приложение в песочнице (Playwright). На телефон ставится по ссылке, без магазина. Тот же TS-код потом переиспользуется в модуле Foundry, который тоже работает в браузере | Expo/React Native «нативнее», но его сложнее проверять в облаке; у Flutter движок на Dart не перенести в Foundry. Смена платформы затронет только `apps/web`: движок, схемы, контент и PDF от UI не зависят |
| D2 | **Движок правил — отдельный пакет на чистом TS**, без React и DOM | Правила и есть продукт. Отдельный пакет проверяется «золотыми» персонажами, и его же используют PDF-экспорт, экспорт в Foundry и ассистент | Логика в компонентах приведёт к расхождению чисел между экраном, PDF и экспортом |
| D3 | **Всё — данные**: даже шесть характеристик и 18 навыков описаны как записи пакета | Своя характеристика или свой навык — не особый случай, а ещё одна запись; связанность получается сама | Захардкоженные СИЛ…ХАР превращают кастомные статы в костыли |
| D4 | **Пакеты контента с лицензией в метаданных**; сборка по умолчанию содержит только SRD | Полный текст PHB и переводы ttg.club распространять нельзя (раздел 3). Пакет — единый формат и для SRD, и для хоумбрю, и для личного контента | «Всё с сайтов внутри» — риск удаления из стора и претензий; формат для хоумбрю всё равно понадобится |
| D5 | **Offline-first**: IndexedDB (Dexie), без аккаунтов в MVP | Лист нужен за столом, где интернета может не быть; без бэкенда нечего поддерживать | Бэкенд с первого дня добавляет сложность раньше, чем пользу |
| D6 | **Ручной режим создания раньше мастера** | Готового персонажа переносят с бумаги за 5 минут; мастер создания — сложная часть, она идёт вторым заходом | Мастер первым — долго живём без работающего листа |
| D7 | **Каждое число объяснимо (breakdown) и переопределяемо вручную** | Доверие к автоматике, отладка хоумбрю, мастер видит, откуда +7 | Непрозрачные числа — игроки возвращаются к бумаге |
| D8 | **i18n**: интерфейс через i18next; названия сущностей на обоих языках прямо в записи; длинные тексты — в языковых оверлеях | Поиск должен находить и «огненный шар», и «fireball»: русскоязычные игроки знают оба названия | Один язык контента ломает поиск и обмен хоумбрю |
| D9 | **PDF: свой шаблон + заполнение официального бланка, который загрузил пользователь** | Свой шаблон полностью под контролем (кириллица, 2014/2024). Официальные бланки WotC раздаёт бесплатно, но встраивать их в приложение нельзя — пользователь загружает файл сам | Только свой шаблон — это не «стандартный лист»; только официальный — нет русского и зависимость от чужих полей |
| D10 | **Foundry: сначала экспорт и импорт JSON актёра, модуль-мост — потом** | Экспорт закрывает большую часть пользы и проверяется простым импортом в Foundry; живая синхронизация требует модуля и ретранслятора | Живой мост сразу — месяцы работы до первой пользы |
| D11 | **Бэкенд с этапа L5 — Supabase; весь проект на одном языке, TypeScript** | Аккаунты, база с правами доступа, хранилище файлов и реальное время — готовые; серверный код тоже на TypeScript. Один язык на всё: движок, интерфейс, сервер, модуль Foundry | Elixir/Phoenix лучше всех для живых комнат, но это второй язык в проекте; PocketBase — ещё до версии 1.0 и без готовых комнат и присутствия |

---

## 3. Данные и лицензии

Раздел нужно прочитать до написания импорта: от него зависит архитектура контента.

### 3.1 Что можно встроить в приложение

Единственный открытый источник правил — SRD. Оба документа распространяются по **CC-BY-4.0** (нужна атрибуция, 3.5). Объём по данным 5e-database:

| | SRD 5.1 (правила 2014) | SRD 5.2.1 (правила 2024) |
|---|---|---|
| Классы | 12, по одному подклассу | 12, по одному подклассу |
| Расы / виды | 9 рас | 9 видов (без аасимара) |
| Предыстории | **1** (Acolyte) | 4 (Acolyte, Criminal, Sage, Soldier) |
| Черты | **1** (Grappler) | 17: 4 происхождения, 2 общие, 4 боевых стиля, 7 эпических даров |
| Заклинания | 319 | 339 |

**Вывод, который надо принять заранее:** на одних SRD полную библиотеку PHB не собрать — в правилах 2014 открыты всего одна предыстория и одна черта. Всё остальное попадает в приложение только через пользовательские пакеты (раздел 8): пользователь вносит то, что есть в его книгах, — вручную, импортом JSON или (позже) через ассистента из вставленного текста. Такие пакеты хранятся на устройстве и никуда не выгружаются. RPG Companion решает ту же задачу похоже — через устанавливаемые «системные файлы».

### 3.2 Источники

| Источник | Что это | Как используем |
|---|---|---|
| [5e-bits/5e-srd-api](https://github.com/5e-bits/5e-srd-api) → `packages/5e-database/src/{2014,2024}/en/*.json` | Структурированный JSON обоих SRD: классы с таблицами уровней, виды, предыстории с выборами, черты, заклинания, снаряжение, монстры. Код MIT, содержимое — SRD. Старый репозиторий `5e-bits/5e-database` архивирован 23.09.2026, данные переехали сюда | **Основной источник импорта.** Текст в 2014 в основном лежит в `desc: string[]`, в 2024 — в `description: string`; импорт должен понимать оба поля. У предысторий 2024 текста нет вовсе — брать из SRD PDF. У особенностей (features) есть только текст, механику дописываем сами (6.8) |
| [foundryvtt/dnd5e](https://github.com/foundryvtt/dnd5e) → `packs/_source/**/*.yml` | Компендиумы SRD 2014 и 2024 с механикой: Active Effects, использования, advancement. Код MIT, содержимое CC-BY-4.0 | Справочник при механизации особенностей; идентификаторы (`system.identifier`) для экспорта в Foundry |
| [SRD 5.2.1](https://www.dndbeyond.com/srd) и SRD 5.1 (PDF) | Каноничный текст | Сверка правил и точный текст атрибуции |
| 5e-database `src/2014/ru` | Частичный русский перевод: навыки, состояния, характеристики и т. п. | **Не использовать как источник терминов**: там «Восприятие» и «Расследование» вместо принятых «Внимательность» и «Анализ» |
| [Long Story Short — SRD 5.1 на русском](https://longstoryshort.app/srd/) | Русский перевод SRD 5.1, не завершён, лицензия **CC BY-NC-SA 4.0** | Только отдельным пакетом с этой лицензией и только в некоммерческой сборке; производные тексты остаются под той же лицензией |
| [palikhov/srd-dnd-5e-ru](https://github.com/palikhov/srd-dnd-5e-ru) («Киборги и Чародеи») | Русский перевод SRD 5.1 в Markdown | Лицензия в репозитории явно не указана — только с разрешения авторов |
| [new.ttg.club](https://new.ttg.club/) (2024), [5e14.ttg.club](https://5e14.ttg.club/) (2014) | Русский справочник; тексты — переводы материалов WotC («Права на материалы Wizards of the Coast принадлежат Wizards of the Coast»). У сайта есть API (`/api/v2/...`, код Apache-2.0), но `robots.txt` запрещает автоматический доступ к нему | **Эталон русской терминологии** (отдельные термины и названия) и ссылки «Открыть на ttg.club». Не парсить. Для интеграции — договориться с командой (support@ttg.club, их Discord) |
| [dnd5e.wikidot.com](http://dnd5e.wikidot.com/), [dnd2024.wikidot.com](http://dnd2024.wikidot.com/) | Фанатские вики с текстами книг за пределами SRD. Подпись «CC BY-SA 3.0» — стандартная для wikidot, она не может лицензировать тексты WotC | Только ссылки для личного чтения. Не импортировать |

### 3.3 Следствия для архитектуры

- Каждый пакет несёт `license`: SPDX-идентификатор, текст атрибуции, флаг `redistributable`.
- Два профиля сборки: `public` — только пакеты с `redistributable: true`; `personal` — плюс локальные. Пользовательские пакеты в любом профиле живут только в IndexedDB устройства.
- Русские тексты SRD по умолчанию — собственный перевод (CC-BY-4.0 разрешает производные работы). Названия — общепринятые, сверенные с ttg.club; тексты переводим сами по глоссарию. У каждой записи метка `translation: 'machine' | 'reviewed' | 'community'`; непроверенный перевод отмечается маленьким значком.
- Ссылки на ttg.club и wikidot хранятся в `source.links[]` — это просто URL.

### 3.4 Название и бренд

Не использовать «D&D», «Dungeons & Dragons», логотипы и оформление WotC в названии, иконке и интерфейсе. Допустима фраза «совместимо с пятой редакцией» / «5E compatible» — её прямо разрешает юридический раздел SRD 5.2.1. Других упоминаний WotC, кроме атрибуции, не добавлять.

### 3.5 Атрибуция

Экран «О приложении» и README содержат тексты из Приложения В. **[ПРОВЕРИТЬ]** дословно по юридической странице каждого SRD PDF.

---

## 4. Стек и структура репозитория

### 4.1 Структура (pnpm workspaces)

```
/apps/web            PWA (React) — единственное место, где есть UI
/packages/schema     Zod-схемы, TS-типы, экспорт JSON Schema пакета
/packages/engine     движок: формулы, эффекты, конвейер расчёта, кубы, отдых
/packages/content    импорт SRD, механика, глоссарий, собранные пакеты
/packages/pdf        PDF: свой шаблон и заполнение форм
/packages/foundry    (этап L1) маппинг в Foundry dnd5e и обратно
/docs                SPEC.md, adr/, glossary.md
```

Направление зависимостей: `schema ← engine ← pdf, foundry ← apps/web`. Пакет `engine` не импортирует React, DOM, Dexie и сеть; это проверяется в CI (dependency-cruiser или правило линтера).

### 4.2 Библиотеки

| Задача | Выбор |
|---|---|
| Сборка и UI | Vite, React 19, TypeScript strict, React Router 7 |
| Стили и компоненты | Tailwind CSS v4, shadcn/ui (Radix), Vaul (нижние шторки), lucide-react |
| Состояние | Zustand (UI), Dexie + `dexie-react-hooks` (данные) |
| Валидация | Zod 4 (схемы → типы → JSON Schema через `z.toJSONSchema`) |
| i18n | i18next + react-i18next (русские формы множественного числа из коробки) |
| Поиск | MiniSearch (префикс + нечёткий поиск по обоим языкам) |
| Длинные списки | @tanstack/react-virtual |
| Markdown | react-markdown + свой remark-плагин для ссылок `{@…}` |
| Кубы | @dice-roller/rpg-dice-roller |
| Формулы | свой интерпретатор поверх AST (разбор — jsep или свой парсер); без `eval` и `new Function` |
| PDF | @react-pdf/renderer (свой шаблон), pdf-lib + @pdf-lib/fontkit (заполнение форм) |
| PWA | vite-plugin-pwa (Workbox) |
| Тесты | Vitest, Testing Library, Playwright (эмуляция Pixel 7 и iPhone 14) |
| Качество | Biome (линт и формат), GitHub Actions |
| Деплой | Cloudflare Pages (работает и с приватным репозиторием) или GitHub Pages; для SPA — fallback на `index.html` |

---

## 5. Модель данных

Все схемы живут в `packages/schema` на Zod; ниже — сокращённые TS-эквиваленты. Названия полей — ориентир, структура — обязательна.

### 5.1 Идентификаторы

- `EntityId = "<packId>:<type>/<slug>"`, например `srd-2024:feat/alert` или `hb-local:skill/occultism`. Идентификатор стабилен: переименование сущности его не меняет.
- `key` — короткий ключ для формул (`str`, `stealth`, `fighter`). Уникален среди активных пакетов персонажа; конфликт обнаруживается при подключении пакета.
- Слаги SRD совпадают со слагами 5e-database и, где возможно, с `system.identifier` в Foundry dnd5e (`alert`, `savage-attacker`, `defense`) — это упрощает экспорт.

### 5.2 Общая часть сущности

```ts
type Locale = 'ru' | 'en';
type L10n = Partial<Record<Locale, string>>;        // минимум один язык
type Ruleset = '2014' | '2024';
type Formula = string;                               // см. 5.6

interface EntityBase {
  id: EntityId;
  type: EntityType;
  key?: string;
  ruleset: Ruleset | 'any';
  name: L10n;                    // оба языка прямо здесь — для двуязычного поиска
  aliases?: L10n[];              // старые и альтернативные переводы
  summary?: L10n;                // одна строка для списков
  text?: L10n;                   // у SRD — в языковом оверлее (5.7); у хоумбрю можно здесь
  tags?: string[];
  source: { pack: string; page?: string; links?: string[] };
  effects?: Effect[];            // пассивная механика (5.4)
  grants?: Grant[];              // что даёт и какие выборы требует (5.5)
  prerequisites?: Prerequisite[];
  meta?: {
    translation?: 'official' | 'community' | 'machine' | 'reviewed';
    foundry?: { identifier?: string; uuid?: string };
    variantOf?: EntityId;        // хоумбрю-копия записи SRD
    manual?: boolean;            // механика не автоматизирована — только текст и трекер
  };
}

type EntityType =
  | 'ability' | 'skill' | 'species' | 'lineage' | 'class' | 'subclass'
  | 'background' | 'feat' | 'feature' | 'spell' | 'item' | 'condition'
  | 'language' | 'damageType' | 'weaponProperty' | 'weaponMastery'
  | 'toolKind' | 'rule';
```

### 5.3 Основные типы сущностей

```ts
interface AbilityDef extends EntityBase {
  type: 'ability'; key: string;                // 'str'…'cha', 'san' (Рассудок), свои
  abbr: L10n;                                  // 'СИЛ' / 'STR'
  order: number;
  modFormula?: Formula;                        // по умолчанию 'floor((@score - 10) / 2)'
  hasSave?: boolean;                           // по умолчанию true
  defaultMax?: number;                         // потолок при повышениях, по умолчанию 20
}

interface SkillDef extends EntityBase {
  type: 'skill'; key: string;
  ability: string;                             // ключ характеристики, в том числе кастомной
  totalFormula?: Formula;                      // своя формула итога (редко)
  passive?: boolean;                           // показывать пассивное значение
}

interface ClassDef extends EntityBase {
  type: 'class'; key: string;
  hitDie: 6 | 8 | 10 | 12;
  primaryAbilities: string[];
  saves: string[];
  subclassLevel: number;                       // 2014: 1–3 в зависимости от класса; 2024: 3
  levels: Array<{
    level: number;                             // 1..20
    features: EntityId[];
    table?: Record<string, number | string>;   // колонки таблицы класса: rages, secondWindUses, weaponMastery…
    abilityScoreImprovement?: boolean;
  }>;
  spellcasting?: SpellcastingDef;
  multiclass?: { prerequisites: Prerequisite[]; grants: Grant[] };
}

interface SubclassDef extends EntityBase {
  type: 'subclass'; key: string;
  classKey: string;
  levels: Array<{ level: number; features: EntityId[] }>;
  alwaysPrepared?: Array<{ level: number; spells: EntityId[] }>;  // доменные заклинания и т. п.
  spellcasting?: SpellcastingDef;              // подклассы-«третькастеры» (в хоумбрю)
}

interface SpellcastingDef {
  ability: string;
  progression: 'full' | 'half' | 'third' | 'pact' | 'none';
  preparation: 'prepared' | 'known' | 'spellbook';
  preparedCount?: Formula | number[];          // 2014: формула; 2024: колонка таблицы
  cantripsKnown?: number[];
  spellsKnown?: number[];
  slotsTable?: number[][];                     // для одиночного класса и магии договора
  spellList: { classKey?: string; tag?: string };
  ritual?: boolean;
}

interface SpeciesDef extends EntityBase {       // lineage — подраса / родословная, та же форма
  type: 'species' | 'lineage';
  size: string[];                              // варианты на выбор
  speed: Partial<Record<'walk' | 'fly' | 'swim' | 'climb' | 'burrow', number>>;
  creatureType: string;
  traits: EntityId[];                          // → FeatureDef
  lineages?: EntityId[];
}

interface BackgroundDef extends EntityBase {
  type: 'background';
  abilityOptions?: string[];                   // 2024: три характеристики (+2/+1 или +1/+1/+1)
  originFeat?: EntityId;                       // 2024
  feature?: EntityId;                          // 2014
}

interface FeatDef extends EntityBase {
  type: 'feat';
  category?: 'origin' | 'general' | 'fightingStyle' | 'epicBoon' | string;
  repeatable?: boolean;
}

interface FeatureDef extends EntityBase {       // умения классов, черты видов, умения предысторий
  type: 'feature';
  origin: { kind: 'class' | 'subclass' | 'species' | 'background' | 'feat' | 'item' | 'custom'; id: EntityId; level?: number };
  activation?: 'action' | 'bonus' | 'reaction' | 'free' | 'passive' | 'special';
  uses?: UsesDef;
}

interface UsesDef {
  max: Formula;                                // '@classes.fighter.table.secondWindUses'
  recovery: Array<{ on: 'short' | 'long' | 'dawn' | 'turn' | 'manual'; amount: 'all' | Formula }>;
}

interface SpellDef extends EntityBase {
  type: 'spell';
  level: number;                               // 0 — заговор
  school: string;
  castingTime: { value: number; unit: 'action' | 'bonus' | 'reaction' | 'minute' | 'hour'; note?: L10n };
  range: { kind: 'self' | 'touch' | 'distance' | 'sight' | 'unlimited' | 'special'; distance?: number; area?: { shape: string; size: number } };
  components: { v: boolean; s: boolean; m?: L10n; mCost?: number; mConsumed?: boolean };
  duration: { kind: 'instant' | 'timed' | 'untilDispelled' | 'special'; value?: number; unit?: string };
  concentration: boolean;
  ritual: boolean;
  classes: string[];                           // ключи классов
  attack?: 'melee' | 'ranged';
  save?: string;
  damage?: Array<{ formula: Formula; type: string }>;
  scaling?: { kind: 'cantrip' | 'slot'; formula: Formula };
}

interface ItemDef extends EntityBase {
  type: 'item';
  category: 'weapon' | 'armor' | 'shield' | 'gear' | 'tool' | 'consumable' | 'ammunition' | 'focus' | 'pack' | 'treasure';
  weight?: number;
  cost?: { amount: number; unit: 'cp' | 'sp' | 'ep' | 'gp' | 'pp' };
  weapon?: { group: 'simple' | 'martial'; kind: 'melee' | 'ranged'; damage: { formula: Formula; type: string };
             versatile?: Formula; properties: string[]; range?: { normal: number; long?: number }; mastery?: string };
  armor?: { group: 'light' | 'medium' | 'heavy'; baseAC: number; dexCap: number | null; strRequirement?: number; stealthDisadvantage?: boolean };
  magic?: { rarity: string; attunement?: boolean | L10n; bonus?: number };
  // Щит: category 'shield' + эффект { target: 'ac.bonus', op: 'add', value: 2, when: '@equipped' }.
  // Эффекты предметов по умолчанию действуют только при '@equipped' (и '@attuned', если нужна настройка).
}

interface ConditionDef extends EntityBase { type: 'condition'; maxLevel?: number }  // истощение — с уровнями
```

### 5.4 Эффекты (пассивная механика)

```ts
interface Effect {
  id: string;                                  // стабилен внутри сущности
  target: string;                              // путь в рассчитанном состоянии (каталог ниже)
  op: 'add' | 'mul' | 'set' | 'max' | 'min' | 'append' | 'advantage' | 'disadvantage' | 'note';
  value: Formula | number | boolean | string;
  phase?: 'base' | 'derived' | 'final';        // по умолчанию выводится из target
  priority?: number;                           // порядок внутри фазы
  when?: Formula;                              // '@equipped', '@armor.worn', '@conditions.exhaustion.level >= 2'
  situational?: L10n;                          // «против яда»: не применять автоматически, а показать подсказку и переключатель в диалоге броска
  toggle?: { label: L10n; default: boolean };  // пользователь включает сам: «Ярость», «Щит веры»
  label?: L10n;                                // подпись в breakdown
}
```

Соответствие Foundry V14 для экспорта: `add → add`, `mul → multiply`, `set → override`, `max → upgrade`, `min → downgrade`.

**Каталог целей.** Строится из активных сущностей: кастомная характеристика `san` автоматически даёт цели `abilities.san.*`.

| Цель | Фаза | Пример |
|---|---|---|
| `abilities.<key>.score`, `abilities.<key>.max` | base | Пояс силы великана: `max 21` |
| `abilities.<key>.saveBonus`, `saves.all.bonus` | derived | Кольцо защиты: `saves.all.bonus +1` |
| `skills.<key>.prof` (0 / 0.5 / 1 / 2) | derived | Компетентность: `max 2` |
| `skills.<key>.bonus`, `skills.all.bonus`, `checks.<ability>.bonus` | derived | |
| `skills.<key>.ability` | derived | сменить характеристику навыка (`set`) |
| `d20.all.bonus` | derived | Истощение 2024: `-2 * @conditions.exhaustion.level` |
| `init.bonus` | derived | Alert 2024: `+@prof` |
| `ac.bonus`, `ac.formulas` (`append` кандидата) | derived | Defense: `+1` при `@armor.worn`; Защита без доспехов: `10 + @abilities.dex.mod + @abilities.con.mod` |
| `hp.max.bonus` | derived | Дварфийская выдержка 2014: `+@level` |
| `speed.<kind>`, `speed.<kind>.bonus`, `speed.all.mul` | derived | |
| `senses.<kind>` | derived | Тёмное зрение: `max 60` |
| `defenses.resist` / `immune` / `vuln` / `conditionImmune` | derived | `append 'poison'` |
| `prof.armor` / `prof.weapon` / `prof.tool` / `prof.language` | derived | |
| `attack.<weapon.melee \| weapon.ranged \| spell>.bonus`, `damage.<…>.bonus` | derived | Archery: `attack.weapon.ranged.bonus +2` |
| `spell.dc.bonus`, `spell.attack.bonus` | derived | |
| `resources.<key>.max` | derived | |
| `crit.range` | derived | Improved Critical: `min 19` |
| `roll.save.<key \| all>`, `roll.skill.<key>`, `roll.check.<ability>`, `roll.attack.<kind \| all>`, `roll.init`, `roll.deathSave` | — | Remarkable Athlete 2024: `advantage` на `roll.init` и `roll.skill.athletics` |

### 5.5 Гранты и выборы

```ts
type Grant = { id: string; atLevel?: number } & (
  | { kind: 'proficiency'; category: 'skill' | 'save' | 'armor' | 'weapon' | 'tool' | 'language';
      fixed?: string[]; choose?: Choose; level?: 0.5 | 1 | 2 }
  | { kind: 'feature'; ids: EntityId[] }
  | { kind: 'feat'; fixed?: EntityId; choose?: Choose }              // человек 2024: черта происхождения на выбор
  | { kind: 'spell'; fixed?: EntityId[]; choose?: Choose; ability?: string | 'choice'; alwaysPrepared?: boolean; uses?: UsesDef }
  | { kind: 'abilityScore'; mode: 'fixed'; values: Record<string, number> }             // 2014: раса
  | { kind: 'abilityScore'; mode: 'distribute'; from: string[]; patterns: number[][] }  // 2024: [[2,1],[1,1,1]]
  | { kind: 'resource'; key: string; label: L10n; uses: UsesDef }
  | { kind: 'item'; fixed?: Array<{ id: EntityId; qty: number }>; choose?: Choose }
);
interface Choose { count: number; from: string[] | { tag?: string; category?: string; type?: EntityType } }

type Prerequisite =
  | { kind: 'ability'; key: string; min: number }                  // «Сила 13»
  | { kind: 'level'; min: number }
  | { kind: 'entity'; id: EntityId }                               // есть черта, особенность, класс
  | { kind: 'proficiency'; category: string; id: string }
  | { kind: 'formula'; formula: Formula; label: L10n };

type Entity = AbilityDef | SkillDef | ClassDef | SubclassDef | SpeciesDef | BackgroundDef
            | FeatDef | FeatureDef | SpellDef | ItemDef | ConditionDef | SimpleDef;  // SimpleDef — язык, тип урона и т. п.
```

Требования не блокируют выбор, а дают предупреждение (в мастере — с пояснением, чего не хватает).

Сделанный выбор хранится в персонаже: `choices["<entityId>#<grantId>"] = string[]`. Невыполненный выбор — не ошибка, а значок «нужен выбор» на листе.

### 5.6 Формулы

- Операции: `+ - * /`, скобки, сравнения, `&& || !`, тернарный `?:`.
- Функции: `floor ceil round min max abs clamp if`.
- Ссылки: `@abilities.dex.mod`, `@abilities.san.score`, `@prof`, `@level`, `@classes.fighter.level`, `@classes.fighter.table.secondWindUses`, `@skills.stealth.total`, `@conditions.exhaustion.level`, `@armor.worn`, `@armor.group`, `@shield`, `@equipped`, `@attuned`; контекстные `@score` (в формуле модификатора), `@self.*`, `@item.*`.
- Формулы бросков — отдельный контекст: допускают кости (`1d10 + @classes.fighter.level`, `2d20kh1`); на экране показываются со средним значением.
- Интерпретатор возвращает значение **и список прочитанных путей** — для обнаружения циклов и для breakdown. Ссылка на отсутствующий путь даёт 0 и предупреждение, а не исключение.
- Фазовая дисциплина: формулы фазы `base` читают только уровни, уровни классов и выборы (не модификаторы) — это исключает циклы.
- Защита от чужих пакетов: ограничение длины формулы и глубины разбора; никакого выполнения кода.

### 5.7 Пакет контента

```ts
interface ContentPack {
  id: string;                          // 'srd-2014', 'srd-2024', 'hb-local', 'my-books'
  version: string;                     // semver
  schemaVersion: number;
  title: L10n;
  description?: L10n;
  ruleset: Ruleset | 'any';
  license: { spdx?: string; name: string; url?: string; attribution?: string; redistributable: boolean };
  authors?: string[];
  dependsOn?: Array<{ id: string; version?: string }>;
  entities: Entity[];
}

// Языковой оверлей — отдельный файл, грузится лениво
interface LocaleOverlay {
  packId: string;
  locale: Locale;
  texts: Record<EntityId, { text?: string; summary?: string; [field: string]: string | undefined }>;
}
```

- JSON Schema пакета генерируется из Zod и публикуется как `/schema/pack.schema.json`: по ней пишут хоумбрю вручную и проверяют ответы ассистента.
- Пакеты SRD разбиты по типам сущностей; в precache PWA попадает то, что нужно листу. Монстры и прочее «мастерское» грузятся лениво.

### 5.8 Документ персонажа

```ts
interface CharacterDoc {
  id: string; schemaVersion: number; rev: number; createdAt: string; updatedAt: string;
  ruleset: Ruleset;
  allowMixedRulesets?: boolean;                 // контент другого набора — с предупреждением
  mode: 'guided' | 'manual';
  packs: string[];                              // активные пакеты, по порядку
  houseRules: HouseRules;                       // 8.4
  name: string; player?: string; portraitBlobId?: string;
  abilities: { method: 'standard' | 'pointBuy' | 'roll' | 'manual'; base: Record<string, number> };
  species?: { id: EntityId; lineage?: EntityId; size?: string };
  background?: { id: EntityId };
  classes: Array<{ id: EntityId; subclass?: EntityId; level: number; hp: Array<number | 'avg'> }>;
  feats: Array<{ id: EntityId; via: 'asi' | 'origin' | 'species' | 'class' | 'bonus' | 'custom'; atLevel?: number }>;
  choices: Record<string, string[]>;
  spells: Record<string, { known: EntityId[]; prepared: EntityId[] }>;   // ключ — источник (класс или черта)
  inventory: Array<{ uid: string; itemId?: EntityId; custom?: { name: string; weight?: number };
                     qty: number; equipped?: boolean; attuned?: boolean; container?: string; note?: string }>;
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };
  state: {
    hp: { current: number; temp: number };
    hitDiceSpent: Record<string, number>;       // { d10: 1 }
    slotsSpent: Record<string, number>;
    pactSlotsSpent?: number;
    resources: Record<string, number>;          // потрачено
    deathSaves: { success: number; failure: number };
    conditions: Array<{ id: EntityId; level?: number }>;
    concentration?: EntityId;
    inspiration: boolean;
    toggles: Record<string, boolean>;           // включённые toggle-эффекты
  };
  overrides: Array<{ path: string; value: number | string | boolean; note?: string }>;
  localEntities: Entity[];                      // хоумбрю только этого персонажа
  notes: { appearance?: string; personality?: string; ideals?: string; bonds?: string;
           flaws?: string; backstory?: string; allies?: string; free?: string };      // markdown
}
```

Миграции: `schemaVersion` есть у персонажа и у пакета; миграции — чистые функции `vN → vN+1` с тестами; старый файл при импорте мигрирует автоматически.

---

## 6. Движок правил

### 6.1 Конвейер `compute(character, contentIndex, ruleset) → Computed`

Чистая функция, результат мемоизируется.

1. **Разрешить ссылки.** Собрать сущности персонажа: вид, родословную, предысторию, классы и подклассы до текущего уровня, черты, предметы, состояния, локальные сущности. Отсутствующая ссылка — предупреждение и пропуск, не падение.
2. **Раскрыть гранты** с учётом уровней и `choices`, рекурсивно (черта может дать черту). Получить владения, особенности, заклинания, ресурсы и список невыполненных выборов.
3. **Собрать эффекты** всех активных источников с атрибуцией: особенности, черты, вид, предыстория, надетые и настроенные предметы, состояния, включённые toggle, ручные переопределения.
4. **Фаза base.** Значение характеристики = база + повышения (2014 — от расы, 2024 — от предыстории) + повышения за уровни и черты + эффекты на `abilities.*.score`; затем `set/max/min`; затем потолок `abilities.*.max`.
5. **Производные значения:** модификаторы, бонус мастерства (по суммарному уровню), спасброски, навыки (владение 0/½/1/2), пассивные значения, максимум хитов, КД (кандидаты формул → лучший или закреплённый пользователем; в 2024 это прямо записано как правило «только одна базовая КД»), инициатива, скорость, СЛ и бонус атаки заклинаний, ячейки (одиночный класс — таблица класса; мультикласс — общая таблица с правилом округления набора правил), максимумы ресурсов, атаки.
6. **Фаза derived:** эффекты на производные цели.
7. **Фаза final:** ручные переопределения; всегда побеждают, в breakdown подписаны как «Ручная правка».
8. **Выход:** значения, `breakdown[path]`, `warnings[]`, `pendingChoices[]`.

### 6.2 Breakdown

Для каждого числа хранится список вкладов `{ label, value, sourceId }`. Пример: «Скрытность +7 = ЛОВ +3, бонус мастерства +2 ×2 (Компетентность: Плут)». Касание числа на листе открывает эту раскладку. Её же используют PDF-экспорт и ассистент.

### 6.3 Наборы правил

Интерфейс `RulesetModule` (`packages/engine/src/rulesets/{2014,2024}.ts`) описывает то, что не является данными: шаги создания персонажа, источник повышений характеристик, округление полукастеров, правила отдыха, служебные формулы (например, СЛ концентрации), термины интерфейса.

Известная разница, которую движок обязан учитывать. Каждую строку **[ПРОВЕРИТЬ]** по тексту SRD перед реализацией.

| Область | 2014 (SRD 5.1) | 2024 (SRD 5.2.1) |
|---|---|---|
| Термин | Раса / Race, подраса | Вид / Species, родословная (lineage, legacy) |
| Повышение характеристик | От расы | От предыстории: +2/+1 или +1/+1/+1 среди трёх указанных характеристик |
| Черта на старте | Нет (черты — опциональная замена повышения характеристик) | Черта происхождения от предыстории; у человека — ещё одна |
| Уровень подкласса | 1, 2 или 3 в зависимости от класса | 3 у всех |
| Категории черт | Нет | Происхождения, общие, боевой стиль, эпический дар (19 уровень) |
| Оружейное мастерство | Нет | Свойства мастерства; число видов оружия — колонка таблицы класса |
| Подготовка заклинаний | Смешанно: «известные» (бард, чародей, следопыт, колдун) и «подготовленные» по формуле | У всех классов число подготовленных — колонка таблицы |
| Мультикласс: вклад паладина и следопыта | Половина уровней, округление **вниз** | Половина уровней, округление **вверх** (так в dnd5e для Foundry: `roundUp` в modern, округление вниз в legacy) |
| Истощение | Таблица из 6 уровней с разными эффектами | Каждый уровень: −2 к броскам к20 и −5 фт скорости; 6-й уровень — смерть |
| Продолжительный отдых: кости хитов | Восстанавливается половина (минимум 1) | Восстанавливаются все |
| Вдохновение | Вдохновение | Героическое вдохновение |

Истощение — хороший пример «правил как данных»: это сущность `condition` с `maxLevel: 6` и эффектами с `when: '@conditions.exhaustion.level >= N'` (2014) или одной формулой (2024).

### 6.4 Действия над персонажем

Чистые функции `CharacterDoc → { doc, logEntry }`:

- `applyDamage` — сначала временные хиты; при концентрации — запрос спасброска Телосложения со СЛ по набору правил; урон при 0 хитов — провал спасброска от смерти.
- `applyHealing`, `setTempHp` (временные хиты не складываются: берётся большее, с подтверждением).
- `spendSlot`, `useResource`, `toggleCondition`, `setConcentration` (новое концентрационное заклинание завершает предыдущее — с подтверждением).
- `shortRest` — трата костей хитов с броском или вводом выпавшего числа; `longRest` — по правилам набора.
- `levelUp`, `undoLevelUp`.

Каждая запись журнала позволяет отменить действие.

### 6.5 Кубы

- Ввод принимает и `d`, и кириллическую `к`: `2к6+3` = `2d6+3`. Отображение по языку: RU `1к20`, EN `1d20`.
- Преимущество и помеха, критические 20 и 1, диапазон крита из `crit.range`, удвоение костей урона на крите.
- Режим «Кидаю сам»: пользователь вводит выпавшее на физических кубах, приложение считает итог.
- Журнал бросков персонажа (последние 100), вибрация на Android.

### 6.6 Требования к движку

- `compute` детерминирован и без побочных эффектов; не дольше 10 мс для персонажа 20 уровня с мультиклассом на среднем телефоне (бенчмарк в Vitest с замедлением CPU ×4).
- Покрытие пакета `engine` тестами — не меньше 90 % строк.

### 6.7 Золотые тесты

Ожидаемые значения посчитаны вручную. **Не подгонять ожидания под код.** Если значение кажется неверным — остановиться и объяснить.

**A. 2014 · горный дварф · жрец (домен Жизни) 1 уровня.** Стандартный набор: СИЛ 13, ЛОВ 10, ТЕЛ 14, ИНТ 8, МДР 15, ХАР 12; горный дварф: +2 ТЕЛ, +1 МДР. Предыстория Acolyte (Проницательность, Религия). Навыки жреца: Медицина, Убеждение. Снаряжение: кольчуга, щит, боевой молот.

| Параметр | Ожидаемо |
|---|---|
| Характеристики | СИЛ 13 (+1), ЛОВ 10 (+0), ТЕЛ 16 (+3), ИНТ 8 (−1), МДР 16 (+3), ХАР 12 (+1) |
| Хиты | 12 (8 + 3 + 1 за дварфийскую выдержку) |
| Спасброски | МДР +5, ХАР +3, остальные равны модификатору |
| Навыки | Проницательность +5, Медицина +5, Убеждение +3, Религия +1, Внимательность +3 |
| Пассивная Внимательность | 13 |
| КД | 18 (кольчуга 16 + щит 2; тяжёлый доспех — от домена Жизни) |
| Скорость / инициатива | 25 фт / +0 |
| СЛ заклинаний / бонус атаки | 13 / +5 |
| Заклинания | подготовлено 4 + доменные (Bless, Cure Wounds) всегда подготовлены; ячеек 1 уровня — 2; заговоров — 3 |
| Боевой молот | +3 к попаданию (владение от вида), 1к8+1 дробящий |

**B. 2024 · человек · воин 1 уровня.** Стандартный набор: СИЛ 15, ЛОВ 13, ТЕЛ 14, ИНТ 8, МДР 12, ХАР 10. Предыстория Soldier: +2 СИЛ, +1 ТЕЛ, черта Savage Attacker, Атлетика и Запугивание. Человек: навык — Проницательность; черта происхождения — Alert. Навыки воина: Внимательность, Выживание. Боевой стиль Defense. Кольчуга, двуручный меч.

| Параметр | Ожидаемо |
|---|---|
| Характеристики | СИЛ 17 (+3), ЛОВ 13 (+1), ТЕЛ 15 (+2), ИНТ 8 (−1), МДР 12 (+1), ХАР 10 (+0) |
| Хиты | 12 |
| Спасброски | СИЛ +5, ТЕЛ +4 |
| Навыки | Атлетика +5, Запугивание +2, Внимательность +3, Выживание +3, Проницательность +3 |
| Пассивная Внимательность | 13 |
| Инициатива | +3 (ЛОВ +1, Alert +2) |
| КД | 17 (кольчуга 16 + Defense 1) |
| Двуручный меч | +5, 2к6+3 рубящий, мастерство Graze |
| Second Wind | 2 использования; короткий отдых возвращает 1, продолжительный — все |
| Скорость | 30 фт |

**B4. Тот же воин, 4 уровень.** На 3 уровне подкласс Champion; на 4 уровне повышение характеристик: +2 СИЛ; хиты по среднему.

| Параметр | Ожидаемо |
|---|---|
| СИЛ | 19 (+4) |
| Хиты | 36 = 12 + 3 × (6 + 2) |
| Атлетика | +6, с преимуществом (Remarkable Athlete) |
| Инициатива | +3, с преимуществом |
| Двуручный меч | +6, 2к6+4; крит на 19–20 (Improved Critical) |
| Second Wind | 3 использования |
| Оружейное мастерство | 4 вида оружия |

**C. Мультикласс: волшебник 3 / паладин 3** — проверка округления.

| | 2014 | 2024 |
|---|---|---|
| Уровень заклинателя | 3 + ⌊3/2⌋ = 4 | 3 + ⌈3/2⌉ = 5 |
| Ячейки | 1 ур.: 4, 2 ур.: 3 | 1 ур.: 4, 2 ур.: 3, 3 ур.: 2 |
| Бонус мастерства | +3 | +3 |

**D. 2024 · истощение 2 на персонаже B.** Все броски к20 −4: Атлетика +1, спасбросок СИЛ +1, атака двуручным мечом +1, инициатива −1. Скорость 20 фт. Урон не меняется. Снятие состояния возвращает значения B.

**E. Кастомный контент** — пакет из Приложения Д, применённый к персонажу B:

| Проверка | Ожидаемо |
|---|---|
| Рассудок (`san`) 14 | модификатор +2; характеристика видна в блоке характеристик и спасбросков |
| Самообладание (навык от `san`, без владения) | +2 |
| Оккультизм (ИНТ, владение от черты «Знаток тайного») | ИНТ 8 → 9 (−1) + мастерство 2 = +1 |
| Рассудок меняется на 16 | Самообладание сразу +3 |
| Черта удалена | Оккультизм −1, ИНТ 8 |
| Пакет отключён | персонаж открывается; на месте ссылок — «Отсутствует: hb-local:…», без падения |

### 6.8 Механизация SRD

5e-database даёт структуру (уровни, владения, выборы, ячейки, таблицы классов) и текст, но не эффекты. Эффекты пишутся вручную в `packages/content/mechanics/<pack>/<type>/<slug>.json` и сливаются с импортом по `EntityId`. Сверяться с эффектами Foundry dnd5e (`packs/_source`).

Приоритет механизации:
1. Всё, что меняет числа на листе: КД, хиты, скорость, навыки, спасброски, инициатива, чувства, сопротивления.
2. Ресурсы и использования.
3. Заклинания, которые дают особенности.
4. Остальное — только текст с меткой `meta.manual: true` (и трекер, если есть использования).

У каждой механизированной сущности — хотя бы один unit-тест.

---

## 7. Экраны и UX (mobile-first)

### 7.1 Навигация

Нижняя панель: **Персонажи · Библиотека · Кубы · Настройки**. Позже появится вкладка «Мастер».

### 7.2 Лист персонажа

Закреплённая шапка: имя, класс и уровень, полоска хитов с кнопками «Урон» и «Лечение», КД, инициатива, скорость, бонус мастерства, значок невыполненных выборов.

Вкладки (листаются свайпом): **Основное · Бой · Заклинания · Снаряжение · Особенности · Заметки**.

```
┌──────────────────────────────────┐
│ Ирен · Воин 4               [!1] │  [!1] — нужен выбор
│ Хиты 31/36 +5 вр. [Урон] [Леч.]  │
│ КД 17 · Иниц. +3 · 30 фт · БМ +2 │
├──────────────────────────────────┤
│ Основное  Бой  Закл.  Снар.  …   │
├──────────────────────────────────┤
│  СИЛ   ЛОВ   ТЕЛ   ИНТ   …       │  касание — бросок
│  19    13    15    8             │  долгое касание — раскладка и правка
│  +4    +1    +2    −1            │
│                                  │
│ Спасброски …   Навыки …          │
└──────────────────────────────────┘
```

Поведение:
- Касание навыка, спасброска или атаки — бросок; диалог с переключателями преимущества и помехи и ситуативными подсказками из `situational`.
- Долгое касание числа — раскладка (breakdown) и «Переопределить вручную».
- Урон и лечение — своя цифровая клавиатура; урон при концентрации сразу предлагает спасбросок.
- **Режим игры** включён по умолчанию после создания: структура листа заблокирована, меняются только трекеры — защита от случайных касаний. Переключатель «Редактирование».
- **Отмена:** после каждого изменения — тост «Отменить»; история последних 50 состояний персонажа.
- Отдых: «Короткий» (диалог трат костей хитов) и «Продолжительный»; до подтверждения показано, что восстановится.
- «Что нужно выбрать»: список невыполненных выборов с переходом к каждому.
- Заклинания: ячейки по уровням (касание — потратить), отметка подготовленных, фильтры, значки концентрации и ритуала, урон при накладывании на более высоком уровне; кнопка «Наложить» тратит ячейку и ставит концентрацию.
- Снаряжение: надеть и настроиться — КД и атаки меняются сразу; вес; монеты с быстрыми +/−; контейнеры.
- Особенности сгруппированы по источнику (класс, вид, предыстория, черты), с трекерами использований и подписью восстановления.
- Тёмная тема по умолчанию, светлая — в настройках; цели касания не меньше 44 px; основные действия — в нижней половине экрана.

### 7.3 Библиотека

- Переключатель набора правил: 2014 / 2024 / оба.
- Разделы: Виды/Расы (термин зависит от набора), Классы (с таблицей уровней), Предыстории, Черты, Заклинания (фильтры: уровень, школа, класс, время накладывания, концентрация, ритуал, компоненты), Снаряжение, Магические предметы, Состояния, Правила.
- Карточка: текст со ссылками-чипами, сводка механики, «Где используется» (обратные ссылки), источник и лицензия, «Открыть на ttg.club» (если есть ссылка), «Добавить персонажу», **«Сделать хоумбрю-копию»** (клон с `variantOf`).
- Поиск один на всё приложение: по обоим языкам, ё = е, с опечатками.

### 7.4 Создание и развитие персонажа

- **Ручной режим (этап 2):** одна прокручиваемая форма: набор правил → имя → вид/раса → предыстория → классы и уровни → характеристики (любые числа) → снаряжение. Движок сразу считает всё; нарушения правил — только предупреждения.
- **Мастер (этап 4):** пошагово по правилам выбранного набора, с предпросмотром листа на каждом шаге и выбором из грантов.
- **Повышение уровня:** выбор класса (мультикласс с проверкой требований), хиты (бросок или среднее), новые особенности, повышение характеристик или черта, новые заклинания; предпросмотр изменений; отмена повышения.

### 7.5 Настройки

Язык (RU/EN); единицы (футы / метры / клетки, фунты / кг — хранение всегда в футах и фунтах); нотация кубов; тема; «Кидаю сам»; резервная копия и восстановление; пакеты контента; «О приложении» с атрибуцией.

---

## 8. Кастомизация (хоумбрю)

### 8.1 Что можно создавать

Характеристики, навыки, черты, заклинания, особенности, виды и родословные, предыстории, предметы, состояния. Классы и подклассы — на этапе L (нужен редактор таблиц уровней).

### 8.2 Как «всё связано»

- Любая сущность ссылается на другие по `EntityId`. Ссылки в тексте: `{@spell srd-2024:spell/fireball}`, `{@condition …}`, `{@roll 8d6}`, `{@dc 15}`.
- Кастомная характеристика сразу появляется в блоке характеристик, в спасбросках (если `hasSave`), в списке характеристик для навыков, в автодополнении формул и в каталоге целей эффектов.
- Кастомный навык: выбор характеристики (в том числе кастомной), владение и компетентность, пассивное значение.
- Переименование не ломает связи — идентификатор стабилен. Удаление предупреждает: «используется в N персонажах и сущностях».
- Отсутствующая ссылка никогда не роняет приложение: плейсхолдер и предупреждение.

### 8.3 Редактор

- Формы генерируются из Zod-схем; для эффектов и грантов — отдельные виджеты.
- **Конструктор эффектов:** цель из каталога (человеческие названия, включая кастомные), операция, значение с автодополнением `@`-ссылок и живым вычислением на выбранном персонаже, условие `when`, `situational`, `toggle`.
- **Предпросмотр «до/после»:** выбираешь персонажа — видишь, какие рассчитанные значения изменит сущность.
- Хранение: общий пакет «Мой хоумбрю» (`hb-local`) и сущности конкретного персонажа (`localEntities`); можно переносить между ними.
- Экспорт и импорт пакета в JSON (через Web Share API — отправить в мессенджер), проверка по JSON Schema, отчёт о конфликтах ключей.

### 8.4 Домашние правила

Настройки персонажа (позже — кампании), которые читает `RulesetModule`: способ хитов при повышении уровня (бросок / среднее / максимум), бюджет покупки характеристик, потолок характеристик, разрешены ли черты (2014) и мультикласс, учёт веса (нет / простой / вариантный), свободная смена характеристики навыка. Значения по умолчанию — по SRD.

---

## 9. Локализация

- Интерфейс: `apps/web/src/locales/{ru,en}/{common,sheet,library,editor}.json`. Текста прямо в JSX нет (правило линтера).
- Термины, зависящие от набора правил, — через контекст i18next: `term.species_2014` = «Раса», `term.species_2024` = «Вид».
- Контент: названия на обоих языках в записи, тексты — в оверлеях. Если перевода нет — английский текст со значком «EN»; переключатель «Показать оригинал».
- Поиск: индекс по `name.ru + name.en + aliases + tags`, нормализация ё → е и регистра, префикс и опечатки.
- Кубы: RU `к`, EN `d`; ввод принимает оба варианта.
- Единицы: хранение в футах и фунтах, отображение — по настройке.
- Глоссарий: `packages/content/glossary.ru.json`; стартовый список — в Приложении Б; сверять с ttg.club.
- Перевод текстов SRD: скрипт `translate` делает черновик по глоссарию (`translation: 'machine'`); после вычитки — `'reviewed'`. Отдельная проверка следит, что термины глоссария переведены единообразно.

---

## 10. Экспорт в PDF для печати

### 10.1 Вариант А — свой шаблон (этап 6а)

- Классическая раскладка, знакомая по стандартному листу, но в собственном оформлении. Страница 1 — характеристики, спасброски, навыки, бой, атаки, особенности; страница 2 — внешность, личность, предыстория, снаряжение, заметки; страница 3 — заклинания (ячейки кружками, список по уровням). Опционально — карточки заклинаний.
- RU и EN; A4 и Letter; чёрно-белая печать без заливок.
- Встроенный шрифт с кириллицей под OFL (например, PT Serif / PT Sans или Noto Serif / Noto Sans).
- Опция «Поля для карандаша»: текущие хиты и потраченные ячейки остаются пустыми.
- @react-pdf/renderer, генерация на устройстве, кнопки «Поделиться» и «Скачать».

### 10.2 Вариант Б — заполнить официальный бланк (этап 6б)

- Пользователь загружает заполняемый PDF: официальный лист 2014 или 2024 (WotC раздаёт их бесплатно) или любой русский заполняемый бланк. Файл хранится только на устройстве; в приложение и репозиторий бланки не встраиваются.
- pdf-lib: получить список полей → применить профиль сопоставления (`поле PDF → путь в Computed + форматтер`) → при желании «сплющить» форму.
- Кириллица: встроить шрифт через @pdf-lib/fontkit и перегенерировать внешний вид полей этим шрифтом, иначе вместо букв будет пусто.
- Имена полей **не хардкодить по памяти**: профиль строится по реальному файлу; есть экран ручного сопоставления; профили сохраняются и экспортируются. В репозитории — только профили (JSON), без самих PDF.

### 10.3 Критерии

PDF открывается в Chrome, Acrobat и на Android; кириллица отображается; числа совпадают с листом (Playwright-тест извлекает текст из PDF и сравнивает с `Computed`).

---

## 11. Хранение, резервные копии, приватность

- Таблицы Dexie: `characters`, `packs`, `entityIndex`, `settings`, `rollLog`, `history`, `blobs` (портреты, загруженные бланки PDF).
- `navigator.storage.persist()` при первом запуске — защита от автоматической очистки браузером.
- «Экспорт всего» — один JSON (персонажи и пользовательские пакеты); импорт с миграциями.
- Никакой телеметрии по умолчанию; никаких внешних запросов, кроме ссылок, которые открывает сам пользователь.

---

## 12. Этапы

Каждый этап — отдельный PR. После каждого этапа владелец открывает новую версию по ссылке на своём телефоне.

### Этап 0. Каркас

**Сделать:** монорепозиторий pnpm; Vite + React + TS strict; Tailwind + shadcn/ui; i18next с RU/EN и переключателем; Dexie; vite-plugin-pwa (иконка-заглушка без символики WotC); Vitest, Playwright (Pixel 7), Biome; GitHub Actions (lint, typecheck, test, build); деплой; `CLAUDE.md`; `docs/adr/001-platform.md`.

**Готово, когда:**
- приложение открывается на телефоне по ссылке и ставится на главный экран;
- работает офлайн после первого открытия;
- CI зелёный;
- e2e-тест делает скриншот главного экрана на обоих языках.

### Этап 1. Схемы и движок

**Сделать:** Zod-схемы раздела 5 и JSON Schema; интерпретатор формул; эффекты; конвейер 6.1; breakdown; модули наборов правил (минимум: повышения характеристик, мультикласс, истощение, отдых); действия 6.4; кубы 6.5. **Фикстуры** — вручную описанные минимальные сущности SRD, нужные для золотых тестов (без полного импорта).

**Готово, когда:**
- все золотые тесты 6.7 (A, B, B4, C, D, E) проходят;
- покрытие `engine` не меньше 90 %, бенчмарк укладывается в 10 мс;
- цикл в формулах обнаруживается с понятным сообщением.

**Не делать:** UI, импорт SRD.

### Этап 2. Лист персонажа (ручной режим)

**Сделать:** список персонажей; ручное создание (7.4); лист со всеми вкладками (7.2); трекеры хитов, ячеек, ресурсов, состояний, спасбросков от смерти, концентрации; броски; отдых; режим игры; отмена; экспорт и импорт персонажа в JSON. Контент на этом этапе — мини-пакет из фикстур этапа 1 плюс свободный ввод («свой предмет», «своя особенность» с текстом).

**Готово, когда:**
- персонажи A и B собираются в интерфейсе не дольше чем за 5 минут каждый и показывают значения из 6.7;
- e2e-сценарий «урон при концентрации → спасбросок → отмена» проходит;
- есть скриншоты всех вкладок на обоих языках при 360×800.

**Не делать:** мастер создания, редактор хоумбрю.

### Этап 3. Контент SRD и библиотека

**Сделать:** скрипты импорта 5e-database → пакеты `srd-2014` и `srd-2024` (валидируются схемой); механизация (6.8); русские оверлеи (машинный черновик по глоссарию); экраны библиотеки (7.3); поиск; экран атрибуции.

**Готово, когда:**
- импорт воспроизводится одной командой, все сущности проходят схему, количество записей совпадает с источником;
- все особенности 1–5 уровней механизированы или явно помечены `manual: true`;
- поиск по «огнен» и по «fireb» находит одно и то же заклинание;
- экран «О приложении» содержит атрибуцию обоих SRD.

### Этап 4. Мастер создания и повышение уровня

**Сделать:** мастер создания по шагам набора правил и мастер повышения уровня (7.4), выбор из грантов, предпросмотр изменений, домашние правила (8.4).

**Готово, когда:**
- персонажи A и B создаются мастером с теми же итогами, что в 6.7;
- мастер повышения доводит B до 4 уровня со значениями B4;
- мультикласс проверяет требования (предупреждение, не запрет);
- отмена повышения возвращает прежнее состояние.

### Этап 5. Хоумбрю

**Сделать:** редактор сущностей и конструктор эффектов (8.3), предпросмотр «до/после», пакеты `hb-local` и `localEntities`, экспорт и импорт пакетов, «Сделать хоумбрю-копию» из библиотеки.

**Готово, когда:**
- пакет из Приложения Д создаётся в редакторе без ручного JSON;
- тест E проходит через интерфейс;
- экспорт → импорт в чистом профиле браузера восстанавливает пакет;
- импорт невалидного файла даёт понятный отчёт.

### Этап 6. PDF

**Сделать:** 6а — свой шаблон (10.1); 6б — заполнение загруженных бланков и экран сопоставления полей (10.2).

**Готово, когда:** выполнены критерии 10.3; для 6б пользователь загружает официальный лист 2024 или 2014 и сопоставляет поля через экран; профиль сохраняется и переиспользуется.

### Этап 7. Полировка и Android

**Сделать:** доступность (контраст, крупный шрифт, подписи для экранного диктора), производительность, пустые состояния, короткий онбординг; по желанию — Capacitor и APK.

**Готово, когда:** Lighthouse на мобильном: PWA и доступность не ниже 90; холодный старт офлайн на среднем телефоне быстрее 2 секунд.

### Этапы L (позже, отдельными ТЗ или дополнениями)

- **L1. Foundry: экспорт и импорт JSON актёра** (Foundry V14, dnd5e 6.x) — Приложение Г. Готово, когда персонажи A и B4 импортируются в чистый мир Foundry через «Import Data» и показывают те же значения, а настройка мира `rulesVersion` соответствует набору правил персонажа.
- **L2. Модуль-компаньон для Foundry:** регистрирует кастомные характеристики и навыки в `CONFIG.DND5E.abilities` и `CONFIG.DND5E.skills` (в dnd5e уже есть встроенные опциональные Честь и Рассудок); затем — живой мост через ретранслятор: броски с телефона в чат Foundry, синхронизация хитов.
- **L3. Помощник мастера:** трекер инициативы, конструктор столкновений (бюджет опыта — по набору правил), монстры SRD (есть в 5e-database для обоих наборов), панель группы с импортом листов игроков.
- **L4. AI-ассистент** — 13.1.
- **L5. Аккаунты, синхронизация и кампании — Supabase** (решение D11): вход через Discord и Google; облачная копия и синхронизация персонажей (номер версии документа + объединение изменений по полям); кампании с правами доступа на уровне строк базы (общие пакеты и домашние правила); панель мастера с хитами группы и общие броски через Realtime (Broadcast, Presence); хранилище для портретов и карт. Серверная логика — Edge Functions на TypeScript, при необходимости с тем же движком правил. Учесть: на бесплатном тарифе проект засыпает после недели без активности в базе.
- **L6. Упрощённая «виртуальная комната»** — отдельное ТЗ. Небольшому столу хватит Supabase Realtime. Если понадобится сервер, который держит одно главное состояние на стол и показывает каждому игроку только его часть (туман войны, хиты монстров, заметки мастера), — писать его тоже на TypeScript: Cloudflare Durable Objects (один объект на стол) или Colyseus (комнаты, синхронизация состояния, StateView для скрытой информации). Весь проект остаётся на одном языке.

---

## 13. Будущее и бэклог

### 13.1 AI-ассистент (этап L4)

- Ключ API пользователя (Anthropic) хранится локально. Вызов прямо из браузера (заголовок `anthropic-dangerous-direct-browser-access` **[ПРОВЕРИТЬ]**) или через маленький прокси (Cloudflare Worker) — решить на этапе.
- Инструменты для модели — те же функции, что у интерфейса: `searchLibrary`, `getEntity`, `computeCharacter` (с breakdown), `proposeEntity(json)`. Предложение проходит валидацию Zod и становится черновиком; сохраняет его только пользователь.
- Главные сценарии:
  - ответ на вопрос по правилам со ссылками на записи библиотеки;
  - «вставь текст черты из своей книги — получи структурированную сущность с эффектами»: так пользователь быстро вносит свой контент, а приложение ничего чужого не распространяет;
  - советы при повышении уровня;
  - идеи для мастера: NPC, описания, столкновения.
- Всё сгенерированное помечено значком «AI».

### 13.2 Бэклог идей

- Планировщик билда 1–20: когда какие особенности появятся, «что если» без изменения персонажа.
- Сравнение вариантов в мастере: выбрал черту — видишь, как изменится лист.
- Журнал сессии: урон, лечение, заклинания, добыча — итог сессии на одном экране.
- Печать карточек заклинаний.
- «Поделиться с мастером»: файл или ссылка с компактным JSON; мастер видит лист только для чтения.
- Слоты настройки (3 предмета) с напоминанием.
- Быстрые карточки правил: действия в бою, состояния, укрытие.
- Настраиваемый лист: перестановка и скрытие блоков.

---

## 14. Открытые вопросы к владельцу

1. Название приложения.
2. Только для себя и друзей — или публикация в Google Play? От этого зависит, какие русские тексты можно включить и насколько важен этап Capacitor.
3. Планируется ли монетизация? Перевод Long Story Short (CC BY-NC-SA) с ней несовместим.
4. Русские тексты SRD: машинный перевод по глоссарию с постепенной вычиткой — или договориться с авторами готовых переводов?
5. Какие бланки вы печатаете (официальный 2014, 2024, русский)? Для него сделать профиль первым.
6. Играете ли вы сейчас в Foundry? Если да, L1 можно поднять выше этапа 6.

---

## Приложение А. CLAUDE.md

```markdown
# Grimoire — project rules for Claude Code

Spec: docs/SPEC.md (in Russian). Read the relevant section before each task.

## Architecture
- pnpm monorepo: apps/web (UI only), packages/schema, packages/engine, packages/content, packages/pdf.
- packages/engine is pure TypeScript: no React, DOM, Dexie or network. Every rule lives in engine or content, never in components.
- Everything is data: abilities, skills and conditions are entities. Never hardcode the six abilities or the 18 skills in UI code.
- compute() is a pure, deterministic function; UI reads only Computed and its breakdown.

## Content and licensing (hard rules)
- Ship only SRD 5.1 / SRD 5.2.1 content (CC-BY-4.0) in the repo and in builds.
- Never scrape or copy text from ttg.club, dnd5e.wikidot.com, dnd2024.wikidot.com or any non-SRD book. ttg.club is a terminology reference only.
- Every pack carries license metadata; packs with redistributable:false never enter the public build.
- No "D&D", "Dungeons & Dragons" or WotC logos in names, icons or UI.

## i18n
- No user-facing string literals in components; use i18next keys and add ru + en together.
- Entity names are bilingual inside the entity; long texts live in locale overlays.
- Russian terms come from packages/content/glossary.ru.json.
- Dice: show "к" in ru and "d" in en; the parser accepts both.

## Quality gates (before every commit)
- pnpm lint && pnpm typecheck && pnpm test
- UI changes: pnpm e2e (Playwright, Pixel 7) and attach ru + en screenshots to the PR.
- Golden tests in packages/engine/test/golden are the source of truth. Never change expected values to make a test pass; if a value looks wrong, stop and explain.

## Workflow
- One phase from SPEC §12 per branch and PR; copy that phase's "Готово, когда" checklist into the PR description.
- Any deviation from SPEC §2 goes to docs/adr/NNN-title.md, and you ask before implementing it.
- Code, comments and commits in English; docs/ in Russian.
```

---

## Приложение Б. Стартовый глоссарий RU

Сверено с глоссарием и разделами ttg.club, кроме строк с пометкой.

| EN | RU | Примечание |
|---|---|---|
| Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma | Сила, Ловкость, Телосложение, Интеллект, Мудрость, Харизма | сокращения СИЛ, ЛОВ, ТЕЛ, ИНТ, МДР, ХАР **[ПРОВЕРИТЬ]** |
| Hit Points | Хиты | |
| Hit Point Dice (2024) / Hit Dice (2014) | Кость хитов | |
| Armor Class | Класс доспеха (КД) | |
| Proficiency Bonus | Бонус мастерства | |
| Saving Throw | Спасбросок | |
| Proficiency | Владение | **[ПРОВЕРИТЬ]** |
| Expertise | Компетентность | |
| Advantage / Disadvantage | Преимущество / Помеха | |
| Initiative | Инициатива | |
| Passive Perception | Пассивная внимательность | |
| Short Rest / Long Rest | Короткий отдых / Продолжительный отдых | |
| Cantrip | Заговор | |
| Spell Slot | Ячейка заклинаний | **[ПРОВЕРИТЬ]** |
| Concentration | Концентрация | |
| Heroic Inspiration | Героическое вдохновение | 2024 |
| Species / Race | Вид / Раса | 2024 / 2014 |
| Feat | Черта | |
| Background | Предыстория | |
| Exhaustion | Истощение | в глоссарии ttg 2024 состояние названо «Истощённый» **[ПРОВЕРИТЬ]** |

Навыки (в скобках — характеристика): Акробатика (ЛОВ), Анализ (ИНТ) — Investigation, Атлетика (СИЛ), Внимательность (МДР) — Perception, Выживание (МДР), Выступление (ХАР), Запугивание (ХАР), История (ИНТ), Ловкость рук (ЛОВ), Магия (ИНТ) — Arcana, Медицина (МДР), Обман (ХАР), Природа (ИНТ), Проницательность (МДР) — Insight, Религия (ИНТ), Скрытность (ЛОВ), Убеждение (ХАР), Уход за животными (МДР). **[ПРОВЕРИТЬ]** по ttg.club.

Названия состояний, заклинаний и черт — брать общепринятые (сверка с ttg.club), только названия, без текстов.

---

## Приложение В. Тексты атрибуции

**SRD 5.1:**
> This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

**SRD 5.2.1:**
> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

**[ПРОВЕРИТЬ]** оба текста дословно по юридической странице соответствующего PDF.

Дополнительно: MIT-уведомления 5e-database и dnd5e (если используются их данные или идентификаторы) — в `THIRD_PARTY_NOTICES.md`. Если подключается перевод Long Story Short — атрибуция и лицензия CC BY-NC-SA 4.0 в метаданных этого пакета (формулировку согласовать с авторами).

---

## Приложение Г. Foundry VTT (для этапов L1–L2)

- На сентябрь 2026 актуальна система dnd5e 6.x для Foundry V14 (в `system.json`: `minimum: 14.367`).
- Набор правил — настройка мира `dnd5e.rulesVersion`: `modern` (2024, по умолчанию) или `legacy` (2014).
- Актёр `type: "character"`: `system.abilities.<key>.value`, `system.attributes` (hp, ac, init, movement, senses, death…), `system.details` (xp, background…), `system.skills`, `system.spells` (ячейки), `system.traits`, `system.currency`. Остальное — встроенные Items: `class` (с `system.levels`), `subclass`, `race` (вид), `background`, `feat`, `spell`, `weapon`, `equipment`, `consumable`, `tool`, `loot`, `container`.
- У записей SRD в компендиумах есть `system.identifier` (`alert`, `defense`), `system.source.rules` (`"2024"`) и `system.source.license` (`CC-BY-4.0`) — по ним сопоставлять.
- Эффекты в V14: `effects[].system.changes[] = { key, value, type, phase, priority }`, где `type` — `add`, `override`, `upgrade` и т. п. (полный список **[ПРОВЕРИТЬ]** в коде Foundry V14). Пример — Defense 2024: `{ key: "system.attributes.ac.bonus", value: 1, type: "add", phase: "initial" }`.
- Кастомные характеристики и навыки существуют в Foundry, только если модуль зарегистрировал их в `CONFIG.DND5E.abilities` / `CONFIG.DND5E.skills`. Без модуля их значения экспортируются в `flags.grimoire.*` и в описание.
- Проверка экспорта: импорт JSON через контекстное меню актёра «Import Data» в чистом мире и сравнение со значениями золотых тестов.

---

## Приложение Д. Пример пакета хоумбрю (фикстура для теста E)

```json
{
  "id": "hb-local",
  "version": "1.0.0",
  "schemaVersion": 1,
  "title": { "ru": "Мой хоумбрю", "en": "My homebrew" },
  "ruleset": "any",
  "license": { "name": "Personal", "redistributable": false },
  "entities": [
    {
      "id": "hb-local:ability/san", "type": "ability", "key": "san", "ruleset": "any",
      "name": { "ru": "Рассудок", "en": "Sanity" },
      "abbr": { "ru": "РАС", "en": "SAN" },
      "order": 7, "hasSave": true,
      "source": { "pack": "hb-local" }
    },
    {
      "id": "hb-local:skill/occultism", "type": "skill", "key": "occultism", "ruleset": "any",
      "name": { "ru": "Оккультизм", "en": "Occultism" },
      "ability": "int",
      "source": { "pack": "hb-local" }
    },
    {
      "id": "hb-local:skill/composure", "type": "skill", "key": "composure", "ruleset": "any",
      "name": { "ru": "Самообладание", "en": "Composure" },
      "ability": "san",
      "source": { "pack": "hb-local" }
    },
    {
      "id": "hb-local:feat/arcane-scholar", "type": "feat", "ruleset": "any", "category": "general",
      "name": { "ru": "Знаток тайного", "en": "Arcane Scholar" },
      "text": {
        "ru": "Вы получаете владение навыком Оккультизм. Ваш Интеллект увеличивается на 1, но не выше 20.",
        "en": "You gain proficiency in Occultism. Increase your Intelligence by 1, to a maximum of 20."
      },
      "source": { "pack": "hb-local" },
      "grants": [
        { "id": "occult-prof", "kind": "proficiency", "category": "skill", "fixed": ["occultism"] }
      ],
      "effects": [
        { "id": "int-plus-1", "target": "abilities.int.score", "op": "add", "value": 1,
          "label": { "ru": "Знаток тайного", "en": "Arcane Scholar" } }
      ]
    }
  ]
}
```

Для персонажа B база `abilities.base.san = 14`. Потолок 20 обеспечивает `defaultMax` характеристики.
