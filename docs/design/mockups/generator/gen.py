"""Generates the Grimoire design-options canvas (artboards + canvas.json)."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # docs/design/mockups

DARK = dict(bg="#1a1e24", outer="#0b0f13", text="#bccad8", muted="#97a1b9", heading="#c14343",
            accent="#863737", accentDark="#652121", bright="#c94d4d", accent2="#61afef",
            line="#2f3b4d", onAccent="#e5ebee", link="#61afef", overlay="rgba(4, 6, 9, 0.64)")
LIGHT = dict(bg="#f8fbff", outer="#eef3fd", text="#30353a", muted="#697580", heading="#c14343",
             accent="#912e2e", accentDark="#c35c5c", bright="#cd2626", accent2="#5599d0",
             line="#b5c2d8", onAccent="#e5ebee", link="#912e2e", overlay="rgba(20, 24, 30, 0.45)")

FONTS = ["EB Garamond", "Alegreya", "Lora", "Cormorant Garamond"]
W = 360

# ---- the sample character (BRIEF.md Part 1) ----
ABILITIES = [("STR", "Strength", 17), ("DEX", "Dexterity", 13), ("CON", "Constitution", 15),
             ("INT", "Intelligence", 8), ("WIS", "Wisdom", 12), ("CHA", "Charisma", 10)]
PROF = 2
SAVE_PROF = {"STR", "CON"}
SKILLS = [("Acrobatics", "DEX"), ("Animal Handling", "WIS"), ("Arcana", "INT"), ("Athletics", "STR"),
          ("Deception", "CHA"), ("History", "INT"), ("Insight", "WIS"), ("Intimidation", "CHA"),
          ("Investigation", "INT"), ("Medicine", "WIS"), ("Nature", "INT"), ("Perception", "WIS"),
          ("Performance", "CHA"), ("Persuasion", "CHA"), ("Religion", "INT"),
          ("Sleight of Hand", "DEX"), ("Stealth", "DEX"), ("Survival", "WIS")]
SKILL_PROF = {"Athletics", "Intimidation", "Perception", "Survival", "Insight"}
MOD = {a: (s - 10) // 2 for a, _, s in ABILITIES}
SAVE = {a: MOD[a] + (PROF if a in SAVE_PROF else 0) for a, _, _ in ABILITIES}
SKILL = {n: MOD[a] + (PROF if n in SKILL_PROF else 0) for n, a in SKILLS}
PASSIVE = 10 + SKILL["Perception"]

# The brief's own numbers must come out of the table above.
assert [MOD[a] for a, _, _ in ABILITIES] == [3, 1, 2, -1, 1, 0]
assert SAVE["STR"] == 5 and SAVE["CON"] == 4
assert (SKILL["Athletics"], SKILL["Intimidation"], SKILL["Perception"], SKILL["Survival"],
        SKILL["Insight"]) == (5, 2, 3, 3, 3)
assert PASSIVE == 13
assert len(SKILLS) == 18


def sg(n):
    return f"+{n}" if n >= 0 else f"−{-n}"


ICONS = {
    "user": '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"></path>',
    "book": '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"></path><path d="M5 17a3 3 0 0 1 3-3h11"></path>',
    "dice": '<path d="M12 2 21 7v10l-9 5-9-5V7z"></path><path d="M3 7l9 5 9-5M12 12v10"></path>',
    "sliders": '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"></path><circle cx="16" cy="7" r="2"></circle><circle cx="10" cy="17" r="2"></circle>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>',
    "dots": '<path d="M12 5h.01M12 12h.01M12 19h.01"></path>',
    "plus": '<path d="M12 5v14M5 12h14"></path>',
    "import": '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path>',
    "chev": '<path d="M9 5l7 7-7 7"></path>',
    "map": '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"></path><path d="M9 4v14M15 6v14"></path>',
    "users": '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 13.8c2.1.8 3.5 3 3.5 6.2"></path>',
}


def icon(name, size=24, color="currentColor", width=1.75):
    extra = "; stroke-width: 3" if name == "dots" else f"; stroke-width: {width}"
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="{color}" '
            f'style="flex-shrink: 0; stroke-linecap: round; stroke-linejoin: round{extra}" aria-hidden="true">'
            f'{ICONS[name]}</svg>')


def page(title, h, body, T, font, root_extra=""):
    props = {"headingFont": {"editor": "enum", "options": FONTS, "default": font},
             "$preview": {"width": W, "height": h}}
    fonts_link = ("https://fonts.googleapis.com/css2?family=Alegreya:wght@500;700"
                  "&family=Cormorant+Garamond:wght@500;700&family=EB+Garamond:wght@500;700"
                  "&family=Inter:wght@400;500;600;700&family=Lora:wght@500;700&display=swap")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="{fonts_link.replace('&', '&amp;')}" rel="stylesheet">
<style>
body{{margin:0;background:{T['outer']}}}
button,input{{font-family:inherit;font-size:inherit;color:inherit;margin:0}}
input::placeholder{{color:{T['muted']}}}
a{{color:{T['link']}}}a:hover{{color:{T['link']}}}
</style>
</helmet>
<div style="width: {W}px; height: {h}px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; overflow: hidden; background: {T['bg']}; color: {T['text']}; font-family: Inter, system-ui, sans-serif; font-size: 15px; line-height: 1.35{root_extra}">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps(props)}'>
class Component extends DCLogic {{
  renderVals() {{
    const f = this.props.headingFont ?? '{font}';
    return {{ hf: f + ', Georgia, serif' }};
  }}
}}
</script>
</body>
</html>
"""


HF = "font-family: {{hf}}"


def badge(T, text):
    return (f'<span style="display: inline-flex; align-items: center; height: 20px; padding: 0 7px; '
            f'border: 1px solid {T["muted"]}; border-radius: 6px; font-size: 12px; font-weight: 600; '
            f'color: {T["muted"]}; letter-spacing: 0.02em; flex-shrink: 0">{text}</span>')


def dot(T, on, size=10):
    if on:
        return (f'<span style="width: {size}px; height: {size}px; border-radius: 50%; flex-shrink: 0; '
                f'background: {T["bright"]}"></span>')
    return (f'<span style="width: {size}px; height: {size}px; border-radius: 50%; flex-shrink: 0; '
            f'box-sizing: border-box; border: 1.5px solid {T["muted"]}"></span>')


def icon_btn(T, name, label, color=None):
    return (f'<button aria-label="{label}" style="width: 44px; height: 44px; flex-shrink: 0; display: flex; '
            f'align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; '
            f'color: {color or T["muted"]}">{icon(name, 22)}</button>')


# ---- sheet header: 56 + 72 + 64 + 44 + 1 border = 237 ----
HEADER_H = 237
BOTTOM_H = 64


def sheet_header(T):
    stats = [("17", "AC"), ("+3", "Initiative"), ("30 ft", "Speed"), ("+2", "Proficiency")]
    cells = "".join(
        f'<button style="display: flex; flex-direction: column; align-items: center; justify-content: center; '
        f'gap: 2px; padding: 0; border: 0; background: transparent; color: {T["text"]}">'
        f'<span style="font-size: 21px; font-weight: 700; line-height: 26px">{v}</span>'
        f'<span style="font-size: 12px; color: {T["muted"]}">{l}</span></button>' for v, l in stats)
    tabs = ["Main", "Combat", "Spells", "Equipment", "Features", "Notes"]
    tab_html = ""
    for i, t in enumerate(tabs):
        if i == 0:
            tab_html += (f'<button style="flex-shrink: 0; height: 44px; box-sizing: border-box; padding: 0 12px; '
                         f'border: 0; border-bottom: 2px solid {T["bright"]}; background: transparent; '
                         f'color: {T["text"]}; font-weight: 600; white-space: nowrap">{t}</button>')
        else:
            tab_html += (f'<button style="flex-shrink: 0; height: 44px; padding: 0 12px; border: 0; '
                         f'background: transparent; color: {T["muted"]}; white-space: nowrap">{t}</button>')
    return f"""<header style="flex-shrink: 0; background: {T['outer']}; border-bottom: 1px solid {T['line']}">
<div style="height: 56px; box-sizing: border-box; display: flex; align-items: center; gap: 4px; padding: 0 4px 0 16px">
<div style="flex-grow: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px">
<h1 style="margin: 0; {HF}; font-size: 28px; font-weight: 700; line-height: 34px; color: {T['heading']}">Iren</h1>
<span style="font-size: 15px; color: {T['text']}; white-space: nowrap">Fighter 1</span>
{badge(T, '2024')}
</div>
<button aria-label="1 choice to make" style="height: 44px; min-width: 44px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent"><span style="height: 24px; padding: 0 8px; border-radius: 12px; display: flex; align-items: center; background: {T['accent']}; color: {T['onAccent']}; font-size: 13px; font-weight: 700">!1</span></button>
{icon_btn(T, 'lock', 'Play mode: the sheet is locked', T['text'])}
</div>
<div style="height: 72px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 16px">
<div style="flex-grow: 1; min-width: 0">
<div style="display: flex; justify-content: space-between; align-items: baseline">
<span style="font-size: 12px; color: {T['muted']}; text-transform: uppercase; letter-spacing: 0.06em">Hit points</span>
<span style="font-size: 20px; font-weight: 700">12 <span style="font-size: 14px; font-weight: 500; color: {T['muted']}">/ 12</span></span>
</div>
<div style="height: 8px; border-radius: 4px; background: {T['line']}; margin-top: 6px"><div style="width: 100%; height: 8px; border-radius: 4px; background: {T['bright']}"></div></div>
</div>
<button style="height: 44px; padding: 0 14px; border: 0; border-radius: 10px; background: {T['accent']}; color: {T['onAccent']}; font-weight: 600">Damage</button>
<button style="height: 44px; padding: 0 14px; border: 1px solid {T['muted']}; border-radius: 10px; background: transparent; color: {T['text']}; font-weight: 600">Heal</button>
</div>
<div style="height: 64px; box-sizing: border-box; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid {T['line']}">
{cells}
</div>
<nav aria-label="Sheet tabs" style="height: 44px; box-sizing: border-box; display: flex; border-top: 1px solid {T['line']}">
<div style="flex-grow: 1; min-width: 0; display: flex; overflow: hidden; padding-left: 4px">{tab_html}</div>
{icon_btn(T, 'dots', 'Tab menu: Edit switch')}
</nav>
</header>"""


def bottom_bar(T, active="Characters"):
    items = [("Characters", "user"), ("Library", "book"), ("Dice", "dice"), ("Settings", "sliders")]
    out = ""
    for label, ic in items:
        on = label == active
        out += (f'<button style="display: flex; flex-direction: column; align-items: center; justify-content: center; '
                f'gap: 3px; padding: 0; border: 0; background: transparent; '
                f'color: {T["text"] if on else T["muted"]}; font-size: 12px; font-weight: {600 if on else 500}">'
                f'{icon(ic, 24, T["bright"] if on else "currentColor")}<span>{label}</span></button>')
    return (f'<nav aria-label="Main" style="height: {BOTTOM_H}px; flex-shrink: 0; box-sizing: border-box; display: grid; '
            f'grid-template-columns: repeat(4, minmax(0, 1fr)); background: {T["outer"]}; '
            f'border-top: 1px solid {T["line"]}">{out}</nav>')


def h2(T, text, mb=8):
    return (f'<h2 style="margin: 0 0 {mb}px; height: 28px; {HF}; font-size: 20px; font-weight: 700; '
            f'line-height: 28px; color: {T["heading"]}">{text}</h2>')


def main(inner, gap):
    return (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; '
            f'padding: 16px 16px 24px; display: flex; flex-direction: column; gap: {gap}px">{inner}</main>')


# ---- Layout A: tiles ----
def content_a(T):
    tiles = ""
    for ab, _, score in ABILITIES:
        tiles += (f'<button style="height: 96px; box-sizing: border-box; display: flex; flex-direction: column; '
                  f'align-items: center; justify-content: center; gap: 2px; padding: 0; border: 1px solid {T["line"]}; '
                  f'border-radius: 12px; background: transparent; color: {T["text"]}">'
                  f'<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: {T["muted"]}">{ab}</span>'
                  f'<span style="font-size: 30px; font-weight: 700; line-height: 34px">{score}</span>'
                  f'<span style="min-width: 36px; height: 22px; box-sizing: border-box; padding: 0 8px; border: 1px solid {T["line"]}; '
                  f'border-radius: 11px; font-size: 14px; font-weight: 600; line-height: 20px">{sg(MOD[ab])}</span></button>')
    grid = f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{tiles}</div>'
    saves = ""
    for ab, name, _ in ABILITIES:
        saves += (f'<button style="height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; '
                  f'padding: 0; border: 0; border-bottom: 1px solid {T["line"]}; background: transparent; '
                  f'color: {T["text"]}; text-align: left">{dot(T, ab in SAVE_PROF)}'
                  f'<span style="flex-grow: 1">{name}</span><span style="font-weight: 600">{sg(SAVE[ab])}</span></button>')
    saves_sec = (f'<section>{h2(T, "Saving throws")}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); '
                 f'column-gap: 16px; grid-auto-flow: column; grid-template-rows: repeat(3, 44px)">{saves}</div></section>')
    rows = ""
    for n, ab in SKILLS:
        rows += (f'<button style="width: 100%; height: 40px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; '
                 f'padding: 0; border: 0; border-bottom: 1px solid {T["line"]}; background: transparent; '
                 f'color: {T["text"]}; text-align: left">{dot(T, n in SKILL_PROF)}'
                 f'<span style="flex-grow: 1">{n}</span>'
                 f'<span style="font-size: 12px; color: {T["muted"]}; width: 32px">{ab}</span>'
                 f'<span style="font-weight: 600; width: 28px; text-align: right">{sg(SKILL[n])}</span></button>')
    passive = (f'<div style="height: 48px; box-sizing: border-box; display: flex; align-items: center; padding: 0 12px; '
               f'margin-bottom: 8px; border: 1px solid {T["line"]}; border-radius: 10px">'
               f'<span style="flex-grow: 1">Passive Perception</span>'
               f'<span style="font-size: 20px; font-weight: 700">{PASSIVE}</span></div>')
    skills_sec = f'<section>{h2(T, "Skills")}{passive}<div>{rows}</div></section>'
    height = 16 + 200 + 24 + (36 + 132) + 24 + (36 + 56 + 18 * 40) + 24
    return main(grid + saves_sec + skills_sec, 24), height


# ---- Layout B: grouped by ability ----
def content_b(T):
    cards = ""
    height = 16 + 28 + 24
    for ab, name, score in ABILITIES:
        skill_rows = [(n, SKILL[n], n in SKILL_PROF) for n, a in SKILLS if a == ab]
        extra = ""
        if ab == "WIS":
            extra = (f'<div style="height: 36px; display: flex; align-items: center; gap: 10px; color: {T["muted"]}">'
                     f'<span style="width: 10px"></span><span style="flex-grow: 1">Passive Perception</span>'
                     f'<span style="font-weight: 600; color: {T["text"]}">{PASSIVE}</span></div>')
        body = ""
        n_rows = len(skill_rows) + (1 if extra else 0)
        if skill_rows:
            inner = "".join(
                f'<button style="width: 100%; height: 36px; display: flex; align-items: center; gap: 10px; padding: 0; border: 0; '
                f'background: transparent; color: {T["text"]}; text-align: left">{dot(T, p)}'
                f'<span style="flex-grow: 1">{n}</span><span style="font-weight: 600">{sg(v)}</span></button>'
                for n, v, p in skill_rows)
            body = (f'<div style="margin-top: 8px; border-top: 1px solid {T["line"]}; padding-top: 4px">{inner}{extra}</div>')
        cards += f"""<section style="border: 1px solid {T['line']}; border-radius: 12px; padding: 12px">
<div style="height: 52px; display: flex; align-items: center; gap: 10px">
<div style="flex-grow: 1; min-width: 0">
<div style="{HF}; font-size: 20px; font-weight: 700; line-height: 26px; color: {T['heading']}">{name}</div>
<div style="font-size: 13px; color: {T['muted']}">{ab} · score {score}</div>
</div>
<button aria-label="{name} modifier {sg(MOD[ab])}" style="width: 56px; height: 52px; box-sizing: border-box; padding: 0; border: 1px solid {T['line']}; border-radius: 10px; background: transparent; color: {T['text']}; font-size: 24px; font-weight: 700">{sg(MOD[ab])}</button>
<button aria-label="{name} save {sg(SAVE[ab])}" style="width: 76px; height: 52px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 0; border: 1px solid {T['line']}; border-radius: 10px; background: transparent; color: {T['text']}">
<span style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: {T['muted']}">SAVE</span>
<span style="display: flex; align-items: center; gap: 6px; font-size: 17px; font-weight: 700">{dot(T, ab in SAVE_PROF, 8)}{sg(SAVE[ab])}</span>
</button>
</div>
{body}
</section>"""
        height += 2 + 24 + 52 + (8 + 1 + 4 + n_rows * 36 if skill_rows else 0) + 12
    height += 24 - 12
    head = h2(T, "Abilities and skills", 0)
    return main(head + cards, 12), height


# ---- Layout C: compact ----
def content_c(T):
    tiles = ""
    for ab, _, score in ABILITIES:
        tiles += (f'<button style="height: 76px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; '
                  f'justify-content: center; gap: 1px; padding: 0; border: 1px solid {T["line"]}; border-radius: 10px; '
                  f'background: transparent; color: {T["text"]}">'
                  f'<span style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: {T["muted"]}">{ab}</span>'
                  f'<span style="font-size: 22px; font-weight: 700; line-height: 28px">{sg(MOD[ab])}</span>'
                  f'<span style="font-size: 12px; color: {T["muted"]}">{score}</span></button>')
    strip = f'<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px">{tiles}</div>'
    chips = ""
    for ab, _, _ in ABILITIES:
        chips += (f'<button style="height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; '
                  f'gap: 8px; padding: 0; border: 1px solid {T["line"]}; border-radius: 10px; background: transparent; '
                  f'color: {T["text"]}"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; '
                  f'color: {T["muted"]}">{ab}</span>{dot(T, ab in SAVE_PROF, 8)}'
                  f'<span style="font-weight: 700">{sg(SAVE[ab])}</span></button>')
    saves = (f'<section>{h2(T, "Saving throws")}<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); '
             f'gap: 8px">{chips}</div></section>')
    rows = ""
    for n, _ in SKILLS:
        p = n in SKILL_PROF
        rows += (f'<button style="height: 40px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0; '
                 f'border: 0; border-bottom: 1px solid {T["line"]}; background: transparent; color: {T["text"]}; '
                 f'text-align: left; font-size: 14px">{dot(T, p, 8)}<span style="flex-grow: 1; white-space: nowrap; '
                 f'overflow: hidden">{n}</span><span style="font-weight: {700 if p else 500}">{sg(SKILL[n])}</span></button>')
    skills_head = (f'<div style="display: flex; align-items: baseline; justify-content: space-between">{h2(T, "Skills")}'
                   f'<span style="font-size: 13px; color: {T["muted"]}">Passive Perception '
                   f'<span style="font-size: 15px; font-weight: 700; color: {T["text"]}">{PASSIVE}</span></span></div>')
    skills = (f'<section>{skills_head}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); '
              f'column-gap: 14px; grid-auto-flow: column; grid-template-rows: repeat(9, 40px)">{rows}</div></section>')
    height = 16 + 76 + 24 + (36 + 96) + 24 + (36 + 360) + 24
    return main(strip + saves + skills, 24), height


def sheet(T, content_fn, font, title, fixed_h=None):
    inner, ch = content_fn(T)
    h = fixed_h or (HEADER_H + ch + BOTTOM_H + 8)
    return page(title, h, sheet_header(T) + inner + bottom_bar(T), T, font), h


# ---- P1 first start ----
def p1(T, font):
    def choice(ic, title, sub):
        return (f'<button style="width: 100%; height: 76px; box-sizing: border-box; display: flex; align-items: center; gap: 14px; '
                f'padding: 0 12px 0 14px; border: 1px solid {T["line"]}; border-radius: 14px; background: transparent; '
                f'color: {T["text"]}; text-align: left">'
                f'<span style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; display: flex; align-items: center; '
                f'justify-content: center; background: {T["accent"]}; color: {T["onAccent"]}">{icon(ic, 24)}</span>'
                f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px">'
                f'<span style="font-size: 17px; font-weight: 600">{title}</span>'
                f'<span style="font-size: 13px; color: {T["muted"]}">{sub}</span></span>'
                f'<span style="color: {T["muted"]}; display: flex">{icon("chev", 20)}</span></button>')
    body = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 14px; padding: 40px 20px 0">
<span style="align-self: flex-start; height: 26px; display: flex; align-items: center; padding: 0 10px; border: 1px solid {T['muted']}; border-radius: 13px; font-size: 12px; font-weight: 600; color: {T['muted']}; letter-spacing: 0.04em">5E compatible</span>
<h1 style="margin: 0; {HF}; font-size: 52px; font-weight: 700; line-height: 1.05; color: {T['heading']}">Grimoire</h1>
<p style="margin: 0; font-size: 16px; line-height: 24px; color: {T['text']}">Character sheets that show where every number comes from. A rules library. Your own homebrew. Works with no network.</p>
</div>
<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; padding: 24px 16px 28px">
<h2 style="margin: 0 0 4px; {HF}; font-size: 22px; font-weight: 700; color: {T['text']}">How will you use it?</h2>
{choice('user', 'I play', 'Characters, dice and the library')}
{choice('map', 'I run games', 'Campaigns, initiative and monsters')}
{choice('users', 'Both', 'Every tab, for players and game masters')}
<p style="margin: 6px 0 0; text-align: center; font-size: 13px; color: {T['muted']}">You can change this in Settings.</p>
</div>"""
    return page("First start", 800, body, T, font)


# ---- P2 characters ----
def p2(T, font):
    body = f"""<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: {T['outer']}; border-bottom: 1px solid {T['line']}">
<h1 style="margin: 0; flex-grow: 1; {HF}; font-size: 28px; font-weight: 700; color: {T['heading']}">Characters</h1>
<span style="height: 28px; display: flex; align-items: center; padding: 0 10px; border: 1px solid {T['muted']}; border-radius: 14px; font-size: 13px; color: {T['muted']}">1 of 3</span>
</header>
<main style="flex-grow: 1; min-height: 0; box-sizing: border-box; padding: 16px; display: flex; flex-direction: column; gap: 12px">
<button style="width: 100%; height: 96px; box-sizing: border-box; display: flex; align-items: center; gap: 14px; padding: 0 14px; border: 1px solid {T['line']}; border-radius: 14px; background: transparent; color: {T['text']}; text-align: left">
<span style="width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: {T['accentDark']}; color: {T['onAccent']}; {HF}; font-size: 26px; font-weight: 700">I</span>
<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px">
<span style="display: flex; align-items: center; gap: 8px"><span style="{HF}; font-size: 21px; font-weight: 700; line-height: 24px">Iren</span>{badge(T, '2024')}</span>
<span style="font-size: 14px; color: {T['muted']}">Human · Fighter 1</span>
<span style="display: flex; align-items: center; gap: 8px"><span style="flex-grow: 1; height: 4px; border-radius: 2px; background: {T['line']}; display: flex"><span style="width: 100%; height: 4px; border-radius: 2px; background: {T['bright']}"></span></span><span style="font-size: 12px; color: {T['muted']}">12 / 12</span></span>
</span>
</button>
</main>
<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; padding: 0 16px 12px">
<button style="height: 52px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 12px; background: {T['accent']}; color: {T['onAccent']}; font-size: 16px; font-weight: 600">{icon('plus', 22)}New character</button>
<button style="height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; background: transparent; color: {T['link']}; font-size: 15px; font-weight: 600">{icon('import', 20)}Import file</button>
</div>
{bottom_bar(T, 'Characters')}"""
    return page("Characters", 800, body, T, font)


# ---- P5 breakdown ----
def p5(T, font):
    inner, _ = content_a(T)
    under = sheet_header(T) + inner + bottom_bar(T)

    def part(label, sub, val, last=False, strong=False):
        border = "" if last else f"border-bottom: 1px solid {T['line']}; "
        sub_html = f'<div style="font-size: 13px; color: {T["muted"]}">{sub}</div>' if sub else ""
        return (f'<div style="height: 56px; box-sizing: border-box; {border}display: flex; align-items: center; gap: 12px">'
                f'<div style="flex-grow: 1; min-width: 0"><div style="font-weight: {600 if strong else 500}">{label}</div>'
                f'{sub_html}</div>'
                f'<div style="font-size: 18px; font-weight: 700">{val}</div></div>')
    field = (f"height: 44px; box-sizing: border-box; border: 1px solid {T['muted']}; border-radius: 10px; "
             f"background: transparent; padding: 0 12px; font-size: 16px; color: {T['text']}")
    sheet_html = f"""<div style="position: absolute; inset: 0; background: {T['overlay']}"></div>
<section aria-label="Where this number comes from" style="position: absolute; left: 0; right: 0; bottom: 0; box-sizing: border-box; padding: 8px 16px 20px; background: {T['bg']}; border-top: 1px solid {T['line']}; border-radius: 18px 18px 0 0; display: flex; flex-direction: column">
<div style="width: 40px; height: 4px; border-radius: 2px; background: {T['muted']}; align-self: center; margin-bottom: 14px"></div>
<div style="font-size: 12px; color: {T['muted']}; text-transform: uppercase; letter-spacing: 0.06em">Where this number comes from</div>
<div style="display: flex; align-items: baseline; justify-content: space-between; margin: 2px 0 6px">
<h2 style="margin: 0; {HF}; font-size: 28px; font-weight: 700; color: {T['heading']}">Athletics</h2>
<span style="font-size: 36px; font-weight: 700">{sg(SKILL['Athletics'])}</span>
</div>
{part('Strength modifier', 'Strength 17', sg(MOD['STR']))}
{part('Proficiency bonus', 'Proficient from background: Soldier', sg(PROF))}
{part('Total', '', sg(SKILL['Athletics']), last=True, strong=True)}
<label for="override" style="display: block; font-size: 14px; font-weight: 600; margin: 12px 0 8px">Override by hand</label>
<div style="display: flex; gap: 8px">
<input id="override" placeholder="{sg(SKILL['Athletics'])}" style="width: 88px; {field}">
<input aria-label="Note for the override" placeholder="Note, optional" style="flex-grow: 1; min-width: 0; {field}">
</div>
<p style="margin: 8px 0 16px; font-size: 13px; line-height: 18px; color: {T['muted']}">A typed value always wins. The number then carries a "Manual edit" label.</p>
<button style="height: 52px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 12px; background: {T['accent']}; color: {T['onAccent']}; font-size: 16px; font-weight: 600">{icon('dice', 22)}Roll d20 {sg(SKILL['Athletics'])}</button>
</section>"""
    return page("Where a number comes from", 800, under + sheet_html, T, font)


def write(name, html):
    with open(os.path.join(ROOT, name), "w", encoding="utf-8") as f:
        f.write(html)


def main_gen():
    boards, order = {}, []
    y1 = 260
    font_files = ["Main.dc.html", "Font-Alegreya.dc.html", "Font-Lora.dc.html", "Font-Cormorant.dc.html"]
    for i, (fname, font) in enumerate(zip(font_files, FONTS)):
        html, h = sheet(DARK, content_a, font, f"Sheet, {font}", fixed_h=800)
        write(fname, html)
        boards[fname] = {"x": i * 440, "y": y1, "w": W, "h": 800, "title": f"{font}"}
        order.append(fname)

    t2 = y1 + 800 + 120
    y2 = t2 + 260
    row2 = [("Layout-A.dc.html", DARK, content_a, "A · Tiles"),
            ("Layout-B.dc.html", DARK, content_b, "B · Grouped by ability"),
            ("Layout-C.dc.html", DARK, content_c, "C · Compact"),
            ("Layout-A-Light.dc.html", LIGHT, content_a, "A · Tiles, light theme")]
    hmax = 0
    for i, (fname, T, fn, title) in enumerate(row2):
        html, h = sheet(T, fn, "EB Garamond", title)
        write(fname, html)
        boards[fname] = {"x": i * 440, "y": y2, "w": W, "h": h, "title": title}
        order.append(fname)
        hmax = max(hmax, h)

    t3 = y2 + hmax + 120
    y3 = t3 + 260
    row3 = [("P1-First-start.dc.html", p1(DARK, "EB Garamond"), "P1 · First start"),
            ("P2-Characters.dc.html", p2(DARK, "EB Garamond"), "P2 · Characters"),
            ("P5-Breakdown.dc.html", p5(DARK, "EB Garamond"), "P5 · Where a number comes from")]
    for i, (fname, html, title) in enumerate(row3):
        write(fname, html)
        boards[fname] = {"x": i * 440, "y": y3, "w": W, "h": 800, "title": title}
        order.append(fname)

    canvas = {
        "v": 3,
        "createdOnFiles": {"v": 1, "at": "2026-09-30T17:53:17Z"},
        "title": "Grimoire design options",
        "launch": {"view": "canvas"},
        "pages": [],
        "boards": boards,
        "order": order,
        "notes": {
            "row1": {"x": 0, "y": 0, "text": "1. Heading font: one sheet, four fonts", "kind": "title1", "maxW": 1680},
            "row2": {"x": 0, "y": t2, "text": "2. Sheet, Main tab: three layouts", "kind": "title1", "maxW": 1680},
            "row3": {"x": 0, "y": t3, "text": "3. More screens", "kind": "title1", "maxW": 1680},
        },
        "designSystems": [],
    }
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(canvas, f, indent=1, ensure_ascii=False)
    for k in order:
        print(k, boards[k]["h"])


if __name__ == "__main__":
    main_gen()
