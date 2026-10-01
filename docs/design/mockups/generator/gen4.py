"""Five overall-design options: a home page plus the V3 'Thumb' sheet in each design language."""
import json
import os
import sys

from gen import ABILITIES, ICONS, MOD, PASSIVE, SAVE, SAVE_PROF, SKILL, SKILL_PROF, SKILLS, ROOT, sg
from gen2 import ratio

W, H = 360, 800
# One neutral palette for all five, so only the design differs.
C = dict(bg="#F5F5F3", surface="#FFFFFF", text="#1C1D20", muted="#5E6269", line="#E2E2DE",
         strong="#1C1D20", onStrong="#FFFFFF", hp="#B5473A", track="#E6E3DF", soft="#EDECE8")
assert ratio(C["text"], C["bg"]) >= 4.5 and ratio(C["muted"], C["bg"]) >= 4.5
assert ratio(C["muted"], C["surface"]) >= 4.5 and ratio(C["onStrong"], C["strong"]) >= 4.5
assert ratio(C["muted"], C["soft"]) >= 4.5

ICONS.update({
    "home": '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"></path>',
    "search": '<circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"></path>',
    "back": '<path d="M15 5l-7 7 7 7"></path>',
    "wand": '<path d="M4 20 15 9"></path><path d="M16 3l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"></path>',
    "pen": '<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13 7l4 4"></path>',
    "file": '<path d="M7 3h7l5 5v13H7z"></path><path d="M14 3v5h5"></path>',
    "star": '<path d="M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z"></path>',
    "clock": '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l3 2"></path>',
    "more": '<path d="M5 12h.01M12 12h.01M19 12h.01"></path>',
    "moon": '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"></path>',
    "cal": '<rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M4 10h16M9 3v4M15 3v4"></path>',
})


def icon(name, size=24, color="currentColor", width=1.75):
    w = 3 if name in ("dots", "more") else width
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="{color}" '
            f'style="flex-shrink: 0; stroke-linecap: round; stroke-linejoin: round; stroke-width: {w}" aria-hidden="true">'
            f'{ICONS[name]}</svg>')


# ---- the five design languages ----
S = {
    1: dict(name="Dashboard", r=16, card="shadow", head="Inter, sans-serif", hw=700, tabs="pill",
            nav=["Home", "Characters", "Library", "Dice", "More"], fonts=[]),
    2: dict(name="Tiles", r=4, card="flat", head="Inter, sans-serif", hw=800, tabs="under", upper=True,
            nav=None, fonts=[]),
    3: dict(name="Search first", r=0, card="line", head="Inter, sans-serif", hw=300, tabs="text",
            nav=["Home", "Dice", "You"], fonts=[]),
    4: dict(name="Gallery", r=20, card="shadow", head="'EB Garamond', Georgia, serif", hw=600, tabs="dark",
            nav=None, fonts=["EB+Garamond:wght@500;600;700"]),
    5: dict(name="Journal", r=10, card="flat", head="Lora, Georgia, serif", hw=600, tabs="under",
            nav=["Journal", "Characters", "Dice", "Library", "More"], fonts=["Lora:wght@500;600;700"]),
}
NAV_ICON = {"Home": "home", "Characters": "user", "Library": "book", "Dice": "dice", "More": "more",
            "You": "user", "Journal": "cal"}


def page(title, fonts, body):
    fam = "&amp;".join(f"family={f}" for f in ["Inter:wght@300;400;500;600;700;800"] + fonts)
    props = {"$preview": {"width": W, "height": H}}
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
<link href="https://fonts.googleapis.com/css2?{fam}&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0;background:#dcdcd8}}
button,input{{font-family:inherit;font-size:inherit;color:inherit;margin:0}}
input::placeholder{{color:{C['muted']}}}
a{{color:{C['text']}}}a:hover{{color:{C['text']}}}
</style>
</helmet>
<div style="width: {W}px; height: {H}px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; overflow: hidden; background: {C['bg']}; color: {C['text']}; font-family: Inter, system-ui, sans-serif; font-size: 15px; line-height: 1.35">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps(props)}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
"""


def box(s, extra=""):
    r = s["r"]
    if s["card"] == "shadow":
        return (f"box-sizing: border-box; background: {C['surface']}; border: 0; border-radius: {r}px; "
                f"box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 3px 10px rgba(0, 0, 0, 0.05){extra}")
    if s["card"] == "flat":
        return (f"box-sizing: border-box; background: {C['surface']}; border: 1px solid {C['line']}; "
                f"border-radius: {r}px{extra}")
    return f"box-sizing: border-box; background: transparent; border: 0; border-bottom: 1px solid {C['line']}; border-radius: 0{extra}"


def head(s, size, text, color=None, extra=""):
    up = "text-transform: uppercase; letter-spacing: 0.06em; " if s.get("upper") and size < 30 else ""
    return (f'<span style="font-family: {s["head"]}; font-weight: {s["hw"]}; font-size: {size}px; {up}'
            f'color: {color or C["text"]}{extra}">{text}</span>')


def label(text):
    return (f'<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; '
            f'color: {C["muted"]}">{text}</div>')


def badge(text, color=None):
    c = color or C["muted"]
    return (f'<span style="display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border: 1px solid {c}; '
            f'border-radius: 6px; font-size: 12px; font-weight: 600; color: {c}; flex-shrink: 0">{text}</span>')


def dot(on, size=8):
    if on:
        return f'<span style="width: {size}px; height: {size}px; border-radius: 50%; flex-shrink: 0; background: {C["text"]}"></span>'
    return (f'<span style="width: {size}px; height: {size}px; border-radius: 50%; flex-shrink: 0; box-sizing: border-box; '
            f'border: 1.5px solid {C["muted"]}"></span>')


def ibtn(name, lbl, size=22, color=None):
    return (f'<button aria-label="{lbl}" style="width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; '
            f'justify-content: center; padding: 0; border: 0; background: transparent; color: {color or C["text"]}">'
            f'{icon(name, size)}</button>')


def btn(text, primary=True, s=None, grow=False, ic=None):
    r = min((s or S[1])["r"], 12) if (s or S[1])["r"] else 0
    g = "flex-grow: 1; " if grow else ""
    look = (f"background: {C['strong']}; color: {C['onStrong']}; border: 0" if primary
            else f"background: transparent; color: {C['text']}; border: 1px solid {C['muted']}")
    i = icon(ic, 20) if ic else ""
    return (f'<button style="{g}height: 44px; padding: 0 16px; display: flex; align-items: center; justify-content: center; gap: 8px; '
            f'border-radius: {r}px; {look}; font-weight: 600">{i}{text}</button>')


def hp_bar(h=6, fill=None, track=None):
    return (f'<div style="height: {h}px; border-radius: {h // 2}px; background: {track or C["track"]}; flex-grow: 1">'
            f'<div style="width: 100%; height: {h}px; border-radius: {h // 2}px; background: {fill or C["hp"]}"></div></div>')


def portrait(size, s, dark=True):
    r = "50%" if s["r"] >= 10 else f"{s['r']}px"
    return (f'<span style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: {r}; display: flex; '
            f'align-items: center; justify-content: center; background: {C["strong"]}; color: {C["onStrong"]}; '
            f'font-family: {s["head"]}; font-weight: 600; font-size: {size // 2}px">I</span>')


def bottom_nav(s, active):
    items = s["nav"]
    out = ""
    for it in items:
        on = it == active
        if s["name"] == "Journal" and it == "Dice":
            out += (f'<button aria-label="Dice" style="justify-self: center; width: 56px; height: 56px; margin-top: -18px; '
                     f'border-radius: 50%; border: 4px solid {C["bg"]}; background: {C["strong"]}; color: {C["onStrong"]}; '
                     f'display: flex; align-items: center; justify-content: center; padding: 0">{icon("dice", 26)}</button>')
            continue
        out += (f'<button style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; '
                f'padding: 0; border: 0; background: transparent; color: {C["text"] if on else C["muted"]}; '
                f'font-size: 12px; font-weight: {600 if on else 500}">{icon(NAV_ICON[it], 24)}<span>{it}</span></button>')
    return (f'<nav aria-label="Main" style="height: 64px; flex-shrink: 0; box-sizing: border-box; display: grid; '
            f'grid-template-columns: repeat({len(items)}, minmax(0, 1fr)); align-items: center; background: {C["surface"]}; '
            f'border-top: 1px solid {C["line"]}">{out}</nav>')


# ---------------------------------------------------------------- the sheet (V3 Thumb) in each language
def tabs_row(s):
    names = ["Main", "Combat", "Spells", "Equipment", "Features", "Notes"]
    out = ""
    for i, t in enumerate(names):
        on = i == 0
        if s["tabs"] in ("pill", "dark"):
            look = (f"background: {C['strong']}; color: {C['onStrong']}; font-weight: 600" if on
                    else f"background: {C['soft'] if s['tabs'] == 'pill' else 'transparent'}; color: {C['muted']}")
            out += (f'<button style="flex-shrink: 0; height: 34px; padding: 0 14px; border: 0; border-radius: 17px; {look}; '
                    f'white-space: nowrap">{t}</button>')
        elif s["tabs"] == "under":
            up = "text-transform: uppercase; letter-spacing: 0.06em; font-size: 13px; " if s.get("upper") else ""
            look = (f"border-bottom: 2px solid {C['text']}; color: {C['text']}; font-weight: 600" if on
                    else f"border-bottom: 2px solid transparent; color: {C['muted']}")
            out += (f'<button style="flex-shrink: 0; height: 44px; box-sizing: border-box; padding: 0 12px; border: 0; {look}; '
                    f'{up}background: transparent; white-space: nowrap">{t}</button>')
        else:
            look = f"color: {C['text']}; font-weight: 700" if on else f"color: {C['muted']}"
            out += (f'<button style="flex-shrink: 0; height: 44px; padding: 0 10px; border: 0; background: transparent; {look}; '
                    f'white-space: nowrap">{t}</button>')
    gap = "gap: 6px; align-items: center; " if s["tabs"] in ("pill", "dark") else ""
    return (f'<div style="height: 48px; display: flex; {gap}overflow: hidden; padding: 0 12px; border-top: 1px solid {C["line"]}">'
            f'{out}</div>')


def sheet(s):
    back = ibtn("back", "Back to home") if s["nav"] is None else ""
    lpad = "4px" if back else "16px"
    name_row = (f'<div style="height: 56px; display: flex; align-items: center; gap: 6px; padding: 0 4px 0 {lpad}">{back}'
                f'<div style="flex-grow: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px">'
                f'{head(s, 26, "Iren")}<span style="font-size: 15px; white-space: nowrap">Fighter 1</span>{badge("2024")}</div>'
                f'<button aria-label="1 choice to make" style="height: 44px; min-width: 44px; display: flex; align-items: center; '
                f'justify-content: center; padding: 0; border: 0; background: transparent"><span style="height: 24px; padding: 0 8px; '
                f'border-radius: 12px; display: flex; align-items: center; background: {C["strong"]}; color: {C["onStrong"]}; '
                f'font-size: 13px; font-weight: 700">!1</span></button>{ibtn("lock", "Play mode: the sheet is locked")}</div>')
    if s["name"] == "Gallery":
        name_row = (f'<div style="height: 120px; box-sizing: border-box; position: relative; background: {C["strong"]}; color: {C["onStrong"]}; '
                    f'display: flex; flex-direction: column; justify-content: flex-end; padding: 0 16px 14px">'
                    f'<span style="position: absolute; right: 12px; top: -30px; font-family: {s["head"]}; font-size: 170px; line-height: 1; '
                    f'color: rgba(255, 255, 255, 0.08)">I</span>'
                    f'<div style="position: absolute; left: 4px; top: 4px; display: flex">{ibtn("back", "Back to home", 22, C["onStrong"])}</div>'
                    f'<div style="position: absolute; right: 4px; top: 4px; display: flex; align-items: center">'
                    f'<span style="height: 24px; padding: 0 8px; border-radius: 12px; display: flex; align-items: center; background: {C["onStrong"]}; '
                    f'color: {C["strong"]}; font-size: 13px; font-weight: 700">!1</span>{ibtn("lock", "Play mode: the sheet is locked", 22, C["onStrong"])}</div>'
                    f'<div style="display: flex; align-items: baseline; gap: 10px">{head(s, 38, "Iren", C["onStrong"])}'
                    f'<span style="font-size: 15px">Fighter 1</span>{badge("2024", "#C9CCD2")}</div></div>')
    stats = "".join(
        f'<button style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 0; '
        f'border: 0; background: transparent; color: {C["text"]}"><span style="font-size: 20px; font-weight: 700; line-height: 24px">{v}</span>'
        f'<span style="font-size: 12px; color: {C["muted"]}">{l}</span></button>'
        for v, l in [("17", "AC"), ("+3", "Initiative"), ("30 ft", "Speed"), ("+2", "Proficiency")])
    stats_row = (f'<div style="height: 60px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); '
                 f'border-top: 1px solid {C["line"]}; background: {C["surface"]}">{stats}</div>')
    top = (f'<header style="flex-shrink: 0; background: {C["surface"]}; border-bottom: 1px solid {C["line"]}">'
           f'{name_row}{stats_row}</header>')

    rr = min(s["r"], 12)
    if s["card"] == "line":
        tile = f"box-sizing: border-box; background: transparent; border: 0; border-right: 1px solid {C['line']}"
    else:
        tile = box(s).replace(f"border-radius: {s['r']}px", f"border-radius: {rr}px")
    tiles = "".join(
        f'<button style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; '
        f'padding: 0; {tile}; color: {C["text"]}"><span style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; '
        f'color: {C["muted"]}">{ab}</span><span style="font-size: 22px; font-weight: 700; line-height: 28px">{sg(MOD[ab])}</span>'
        f'<span style="font-size: 12px; color: {C["muted"]}">{score}</span></button>' for ab, _, score in ABILITIES)
    chips = "".join(
        f'<button style="height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0; '
        f'{tile}; color: {C["text"]}"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: {C["muted"]}">{ab}</span>'
        f'{dot(ab in SAVE_PROF)}<span style="font-weight: 700">{sg(SAVE[ab])}</span></button>' for ab, _, _ in ABILITIES)
    rows = "".join(
        f'<button style="height: 38px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0; border: 0; '
        f'border-bottom: 1px solid {C["line"]}; background: transparent; color: {C["text"]}; text-align: left; font-size: 14px">'
        f'{dot(n in SKILL_PROF)}<span style="flex-grow: 1; white-space: nowrap; overflow: hidden">{n}</span>'
        f'<span style="font-weight: {700 if n in SKILL_PROF else 500}">{sg(SKILL[n])}</span></button>' for n, _ in SKILLS)
    gap = 6 if s["card"] != "line" else 0
    content = (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 14px 16px; display: flex; flex-direction: column; gap: 18px">'
               f'<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: {gap}px">{tiles}</div>'
               f'<section><div style="margin-bottom: 8px">{head(s, 18, "Saving throws")}</div>'
               f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: {gap or 0}px">{chips}</div></section>'
               f'<section><div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px">'
               f'{head(s, 18, "Skills")}<span style="font-size: 13px; color: {C["muted"]}">Passive Perception '
               f'<b style="color: {C["text"]}">{PASSIVE}</b></span></div>'
               f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 14px; grid-auto-flow: column; '
               f'grid-template-rows: repeat(9, 38px)">{rows}</div></section></main>')
    hp = (f'<div style="height: 64px; display: flex; align-items: center; gap: 10px; padding: 0 16px">'
          f'<div style="flex-grow: 1; min-width: 0"><div style="display: flex; justify-content: space-between; align-items: baseline; '
          f'margin-bottom: 6px"><span style="font-size: 12px; color: {C["muted"]}; text-transform: uppercase; letter-spacing: 0.06em">'
          f'Hit points</span><span style="font-size: 18px; font-weight: 700">12 <span style="font-size: 13px; font-weight: 500; '
          f'color: {C["muted"]}">/ 12</span></span></div><div style="display: flex">{hp_bar(8)}</div></div>'
          f'{btn("Damage", True, s)}{btn("Heal", False, s)}</div>')
    dock = (f'<div style="flex-shrink: 0; background: {C["surface"]}; border-top: 1px solid {C["line"]}; '
            f'box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04)">{hp}{tabs_row(s)}</div>')
    nav = bottom_nav(s, "Characters") if s["nav"] else ""
    return top + content + dock + nav


# ---------------------------------------------------------------- homes
def home_dashboard(s):
    dice = "".join(f'<button style="width: 50px; height: 50px; flex-shrink: 0; {box(s)}; font-weight: 700; font-size: 15px; '
                   f'border-radius: 14px">{d}</button>' for d in ["d4", "d6", "d8", "d10", "d12", "d20"])
    lib = "".join(
        f'<button style="height: 60px; display: flex; align-items: center; gap: 12px; padding: 0 14px; {box(s)}; text-align: left">'
        f'<span style="width: 36px; height: 36px; border-radius: 10px; background: {C["soft"]}; display: flex; align-items: center; '
        f'justify-content: center">{icon(ic, 20)}</span><span style="flex-grow: 1; display: flex; flex-direction: column">'
        f'<span style="font-weight: 600">{t}</span><span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span>{badge(ed)}</button>'
        for ic, t, sub, ed in [("book", "Bless", "Spell, level 1", "2024"), ("file", "Chain mail", "Heavy armor, AC 16", "2024")])
    later = "".join(
        f'<div style="width: 132px; height: 92px; flex-shrink: 0; padding: 12px; display: flex; flex-direction: column; '
        f'justify-content: space-between; {box(s)}">{icon(ic, 22, C["muted"])}<span style="display: flex; flex-direction: column">'
        f'<span style="font-weight: 600">{t}</span><span style="font-size: 12px; color: {C["muted"]}">{sub}</span></span></div>'
        for ic, t, sub in [("map", "Campaigns", "For DMs, later"), ("pen", "Homebrew", "Later"), ("wand", "Generators", "For DMs, later")])
    body = f"""<header style="height: 60px; flex-shrink: 0; display: flex; align-items: center; padding: 0 4px 0 16px">
<span style="flex-grow: 1; font-size: 20px; font-weight: 800; letter-spacing: -0.01em">Grimoire</span>{ibtn('search', 'Search')}
</header>
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 12px">
{label('Continue')}
<section style="{box(s)}; padding: 16px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center; gap: 12px">{portrait(52, s)}<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px">
<span style="display: flex; align-items: center; gap: 8px">{head(s, 22, 'Iren')}{badge('2024')}</span>
<span style="font-size: 14px; color: {C['muted']}">Human · Fighter 1</span></div></div>
<div style="display: flex; align-items: center; gap: 10px">{hp_bar()}<span style="font-size: 13px; color: {C['muted']}">12 / 12 HP</span></div>
<div style="display: flex; gap: 8px">{btn('Open sheet', True, s, True)}{btn('Roll', False, s, False, 'dice')}</div>
</section>
{label('Quick roll')}
<div style="display: flex; gap: 8px">{dice}</div>
{label('From the library')}
{lib}
{label('Later')}
<div style="display: flex; gap: 8px">{later}</div>
</main>
{bottom_nav(s, 'Home')}"""
    return body


def home_tiles(s):
    tiles = [("user", "Characters", "1 of 3", False, ""), ("book", "Library", "SRD 2014 · 2024", False, ""),
             ("dice", "Dice", "Any roll", False, ""), ("pen", "Homebrew", "Your packs", False, ""),
             ("map", "Campaigns", "1 of 1", False, "DM"), ("wand", "Generators", "NPCs, loot, names", False, "DM"),
             ("file", "PDF sheet", "Later", True, ""), ("sliders", "Settings", "Theme, units", False, "")]
    grid = ""
    for ic, t, sub, later, tag in tiles:
        col = C["muted"] if later else C["text"]
        tg = badge(tag) if tag else ""
        grid += (f'<button style="height: 112px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; '
                 f'align-items: flex-start; {box(s)}; color: {col}; text-align: left">'
                 f'<span style="display: flex; width: 100%; justify-content: space-between; align-items: flex-start">{icon(ic, 26)}{tg}</span>'
                 f'<span style="display: flex; flex-direction: column; gap: 2px">{head(s, 13, t, col)}'
                 f'<span style="font-size: 12px; color: {C["muted"]}">{sub}</span></span></button>')
    body = f"""<header style="height: 72px; flex-shrink: 0; display: flex; align-items: center; padding: 0 4px 0 16px">
<div style="flex-grow: 1; display: flex; flex-direction: column">{head(s, 22, 'Grimoire', None, '; letter-spacing: 0.14em; text-transform: uppercase')}
<span style="font-size: 12px; color: {C['muted']}">5E compatible</span></div>{ibtn('search', 'Search')}
</header>
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px">
<button style="height: 60px; display: flex; align-items: center; gap: 12px; padding: 0 12px; {box(s)}; background: {C['strong']}; color: {C['onStrong']}; border-color: {C['strong']}; text-align: left">
{portrait(36, s)}<span style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-size: 12px; opacity: 0.8">CONTINUE</span><span style="font-weight: 700">Iren · Fighter 1 · 12 / 12 HP</span></span>{icon('chev', 20)}</button>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">{grid}</div>
</main>
<button aria-label="Roll dice" style="position: absolute; right: 16px; bottom: 20px; width: 60px; height: 60px; border-radius: 4px; border: 0; background: {C['strong']}; color: {C['onStrong']}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25)">{icon('dice', 28)}</button>"""
    return body


def home_search(s):
    def row(ic, t, sub="", muted=False):
        col = C["muted"] if muted else C["text"]
        sb = f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span>' if sub else ""
        return (f'<button style="width: 100%; height: 50px; display: flex; align-items: center; gap: 14px; padding: 0; {box(s)}; '
                f'color: {col}; text-align: left">{icon(ic, 20, C["muted"])}<span style="flex-grow: 1">{t}</span>{sb}'
                f'{icon("chev", 18, C["muted"])}</button>')
    body = f"""<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 28px 20px 12px; display: flex; flex-direction: column; gap: 6px">
{head(s, 34, 'Grimoire', None, '; letter-spacing: -0.02em')}
<label style="display: flex; align-items: center; gap: 10px; height: 52px; margin: 10px 0 18px; padding: 0 16px; border-radius: 26px; background: {C['soft']}; color: {C['muted']}">{icon('search', 20)}<input aria-label="Search" placeholder="Spells, rules, characters" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-size: 16px; outline: none"></label>
{label('Characters')}
<button style="width: 100%; height: 64px; display: flex; align-items: center; gap: 14px; padding: 0; {box(s)}; text-align: left">{portrait(40, s)}<span style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-weight: 600">Iren</span><span style="font-size: 13px; color: {C['muted']}">Human · Fighter 1 · 12 / 12 HP</span></span>{badge('2024')}</button>
{row('plus', 'New character', '1 of 3')}
<div style="height: 14px"></div>
{label('Library')}
{row('book', 'Spells')}{row('file', 'Equipment')}{row('sliders', 'Rules and conditions')}
<div style="height: 14px"></div>
{label('Tools')}
{row('pen', 'Homebrew')}{row('map', 'Campaigns', 'DM · later', True)}
</main>
{bottom_nav(s, 'Home')}"""
    return body


def home_gallery(s):
    body = f"""<header style="height: 60px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 4px">
{ibtn('menu', 'Menu')}{head(s, 24, 'Grimoire')}{ibtn('search', 'Search')}
</header>
<main style="flex-grow: 1; min-height: 0; overflow: hidden; position: relative">
<div style="position: absolute; left: 24px; top: 12px; width: 280px; height: 470px; box-sizing: border-box; border-radius: {s['r']}px; background: {C['strong']}; color: {C['onStrong']}; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; justify-content: flex-end; padding: 22px">
<span style="position: absolute; right: -10px; top: -40px; font-family: {s['head']}; font-size: 330px; line-height: 1; color: rgba(255, 255, 255, 0.07)">I</span>
<span style="position: absolute; left: 22px; top: 22px; font-size: 12px; letter-spacing: 0.08em; color: #C9CCD2">PORTRAIT</span>
<div style="display: flex; align-items: center; gap: 10px">{head(s, 46, 'Iren', C['onStrong'])}{badge('2024', '#C9CCD2')}</div>
<span style="font-size: 15px; color: #C9CCD2; margin-bottom: 14px">Human · Fighter 1</span>
<div style="display: flex; align-items: center; gap: 10px">{hp_bar(6, '#E07A6C', 'rgba(255, 255, 255, 0.2)')}<span style="font-size: 13px">12 / 12</span></div>
</div>
<div style="position: absolute; left: 318px; top: 42px; width: 240px; height: 410px; box-sizing: border-box; border-radius: {s['r']}px; border: 2px dashed {C['muted']}; display: flex; align-items: center; padding-left: 16px; color: {C['muted']}">{icon('plus', 28)}</div>
<div style="position: absolute; left: 0; right: 0; top: 500px; display: flex; justify-content: center; gap: 8px"><span style="width: 18px; height: 6px; border-radius: 3px; background: {C['text']}"></span><span style="width: 6px; height: 6px; border-radius: 3px; background: {C['line']}"></span></div>
<div style="position: absolute; left: 24px; right: 24px; top: 530px; display: flex; gap: 10px">{btn('Open', True, s, True)}{btn('Roll', False, s, True, 'dice')}</div>
</main>
<div style="height: 76px; flex-shrink: 0; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid {C['line']}">
{''.join(f'<button style="display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 12px; border: 0; background: transparent; color: {C["muted"]}; font-size: 12px">{icon(i, 24)}{t}</button>' for i, t in [('dice', 'Dice'), ('book', 'Library'), ('moon', 'Rest')])}
</div>"""
    return body


def drawer_gallery(s):
    def grp(title, items):
        out = f'<div style="margin: 14px 0 4px">{label(title)}</div>'
        for ic, t, tag in items:
            later = tag == "Later"
            col = C["muted"] if later else C["text"]
            tg = badge(tag) if tag else ""
            out += (f'<button style="width: 100%; height: 44px; display: flex; align-items: center; gap: 14px; padding: 0 4px; border: 0; '
                    f'background: transparent; color: {col}; text-align: left">{icon(ic, 20)}<span style="flex-grow: 1">{t}</span>{tg}</button>')
        return out
    under = home_gallery(s)
    body = f"""{under}
<div style="position: absolute; inset: 0; background: rgba(20, 20, 22, 0.45)"></div>
<nav aria-label="Menu" style="position: absolute; left: 0; top: 0; bottom: 0; width: 292px; box-sizing: border-box; background: {C['surface']}; padding: 18px 20px; overflow: hidden; box-shadow: 8px 0 24px rgba(0, 0, 0, 0.2)">
{head(s, 28, 'Grimoire')}
{grp('Play', [('user', 'Characters', ''), ('dice', 'Dice', ''), ('book', 'Library', '')])}
{grp('Make', [('pen', 'Homebrew packs', ''), ('star', 'Themes and skins', '★')])}
{grp('Run games', [('map', 'Campaigns', 'DM'), ('clock', 'Initiative', 'DM'), ('wand', 'Generators', 'DM')])}
{grp('Coming later', [('file', 'PDF sheet', 'Later'), ('users', 'Table link', 'Later')])}
<div style="position: absolute; left: 20px; right: 20px; bottom: 16px; border-top: 1px solid {C['line']}; padding-top: 8px">
<button style="width: 100%; height: 44px; display: flex; align-items: center; gap: 14px; padding: 0 4px; border: 0; background: transparent; text-align: left">{icon('sliders', 20)}Settings</button></div>
</nav>"""
    return body


def home_journal(s):
    def entry(ic, text, when, sample=False):
        sm = f' <span style="color: {C["muted"]}">(sample)</span>' if sample else ""
        return (f'<div style="display: flex; gap: 12px; padding: 10px 0"><span style="width: 34px; height: 34px; flex-shrink: 0; '
                f'border-radius: 50%; background: {C["soft"]}; display: flex; align-items: center; justify-content: center">{icon(ic, 18)}</span>'
                f'<div style="flex-grow: 1; border-bottom: 1px solid {C["line"]}; padding-bottom: 10px"><div>{text}{sm}</div>'
                f'<div style="font-size: 12px; color: {C["muted"]}; margin-top: 2px">{when}</div></div></div>')
    body = f"""<header style="height: 64px; flex-shrink: 0; display: flex; align-items: center; padding: 0 4px 0 16px">
<span style="flex-grow: 1">{head(s, 28, 'Journal')}</span>{ibtn('search', 'Search')}
</header>
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column">
<div style="display: flex; gap: 14px; padding-bottom: 14px">
<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px">{portrait(52, s)}Iren</div>
<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: {C['muted']}"><span style="width: 52px; height: 52px; box-sizing: border-box; border-radius: 50%; border: 1.5px dashed {C['muted']}; display: flex; align-items: center; justify-content: center">{icon('plus', 22)}</span>New</div>
</div>
<section style="{box(s)}; padding: 14px; display: flex; align-items: center; gap: 12px">
<span style="width: 40px; height: 40px; border-radius: 8px; background: {C['strong']}; color: {C['onStrong']}; display: flex; align-items: center; justify-content: center">{icon('cal', 20)}</span>
<div style="flex-grow: 1"><div style="font-weight: 600">Next session: Saturday, 18:00</div><div style="font-size: 13px; color: {C['muted']}">Sample · campaigns come later</div></div>
</section>
<div style="margin: 18px 0 2px">{head(s, 18, 'Today')}</div>
{entry('dice', 'Iren rolled Athletics: <b>19</b>', '21:40', True)}
{entry('moon', 'Long rest: all hit points and uses back', '21:10')}
{entry('file', 'Chain mail added to Iren', '20:55')}
<div style="margin: 14px 0 2px">{head(s, 18, 'Yesterday')}</div>
{entry('user', 'Iren created · Fighter 1 · 2024 rules', '19:30')}
</main>
{bottom_nav(s, 'Journal')}"""
    return body


HOMES = {1: home_dashboard, 2: home_tiles, 3: home_search, 4: home_gallery, 5: home_journal}


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as f:
        canvas = json.load(f)
    pages = canvas.get("pages") or []
    if not any(p["id"] == "overall" for p in pages):
        pages.append({"id": "overall", "name": "Overall design · 5 options"})
    canvas["pages"] = pages
    canvas["launch"] = {"view": "canvas", "page": "overall"}
    notes = canvas["notes"]
    notes["overall-home"] = {"x": 0, "y": 0, "text": "Home: the first page, five options", "kind": "title1",
                             "maxW": 2080, "page": "overall"}
    notes["overall-sheet"] = {"x": 0, "y": 1180, "text": "The sheet (V3 Thumb) in each option", "kind": "title1",
                              "maxW": 2080, "page": "overall"}
    notes["overall-extra"] = {"x": 0, "y": 2360, "text": "Option 4: its menu, where later features live",
                              "kind": "title1", "maxW": 2080, "page": "overall"}
    for n in range(1, 6):
        s = S[n]
        for kind, y, fn in [("Home", 260, HOMES[n]), ("Sheet", 1440, sheet)]:
            fname = f"O{n}-{kind}.dc.html"
            with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as f:
                f.write(page(f"{s['name']}, {kind.lower()}", s["fonts"], fn(s)))
            canvas["boards"][fname] = {"x": (n - 1) * 440, "y": y, "w": W, "h": H,
                                       "title": f"{n} · {s['name']} · {kind}", "page": "overall"}
            if fname not in canvas["order"]:
                canvas["order"].append(fname)
    fname = "O4-Menu.dc.html"
    with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as f:
        f.write(page("Gallery, menu", S[4]["fonts"], drawer_gallery(S[4])))
    canvas["boards"][fname] = {"x": 3 * 440, "y": 2620, "w": W, "h": H, "title": "4 · Gallery · Menu", "page": "overall"}
    if fname not in canvas["order"]:
        canvas["order"].append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(canvas, f, indent=1, ensure_ascii=False)
    print("pages:", [p["id"] for p in canvas["pages"]], "boards:", len(canvas["boards"]))


if __name__ == "__main__":
    run(sys.argv[1])
