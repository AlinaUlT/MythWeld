"""The player flow the owner described: start -> player page -> characters -> sheet, plus create and rulebooks."""
import json
import os
import sys

from gen import ABILITIES, MOD, PASSIVE, SAVE, SAVE_PROF, SKILL, SKILL_PROF, SKILLS, ROOT, sg
from gen2 import ratio
from gen4 import C, badge, dot, hp_bar, icon, label

W, H = 360, 800
C = dict(C, warnBg="#FBF1D9", warnText="#6B4A00", danger="#A23A2E")
assert ratio(C["warnText"], C["warnBg"]) >= 4.5 and ratio(C["danger"], C["surface"]) >= 4.5
R = 14
CARD = f"box-sizing: border-box; background: {C['surface']}; border: 1px solid {C['line']}; border-radius: {R}px"
LINK = "text-decoration: none; color: inherit"


def page(title, body, script=None, props=None):
    p = {"$preview": {"width": W, "height": H}}
    p.update(props or {})
    js = script or "renderVals() {\n    return {};\n  }"
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0;background:#dcdcd8}}
button,input{{font-family:inherit;font-size:inherit;color:inherit;margin:0}}
button:disabled{{opacity:0.4}}
input::placeholder{{color:{C['muted']}}}
a{{color:{C['text']}}}a:hover{{color:{C['text']}}}
</style>
</helmet>
<div style="width: {W}px; height: {H}px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; overflow: hidden; background: {C['bg']}; color: {C['text']}; font-family: Inter, system-ui, sans-serif; font-size: 15px; line-height: 1.35">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps(p)}'>
class Component extends DCLogic {{
  {js}
}}
</script>
</body>
</html>
"""


def icon_link(href, name, lbl):
    return (f'<a href="{href}" aria-label="{lbl}" style="width: 44px; height: 44px; flex-shrink: 0; display: flex; '
            f'align-items: center; justify-content: center; {LINK}">{icon(name, 22)}</a>')


def icon_btn(name, lbl):
    return (f'<button aria-label="{lbl}" style="width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; '
            f'justify-content: center; padding: 0; border: 0; background: transparent">{icon(name, 22)}</button>')


def topbar(title, back=None, right=""):
    b = icon_link(back, "back", "Back") if back else '<span style="width: 12px"></span>'
    return (f'<header style="height: 60px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 4px">{b}'
            f'<h1 style="margin: 0; flex-grow: 1; font-size: 22px; font-weight: 800">{title}</h1>{right}</header>')


def pbtn(text, href=None, primary=True, grow=False, ic=None):
    look = (f"background: {C['strong']}; color: {C['onStrong']}; border: 0" if primary
            else f"background: transparent; color: {C['text']}; border: 1px solid {C['muted']}")
    g = "flex-grow: 1; " if grow else ""
    i = icon(ic, 20) if ic else ""
    inner = (f'style="{g}height: 48px; box-sizing: border-box; padding: 0 18px; display: flex; align-items: center; '
             f'justify-content: center; gap: 8px; border-radius: 12px; {look}; font-weight: 600; text-decoration: none"')
    if href:
        return f'<a href="{href}" {inner}>{i}{text}</a>'
    return f'<button {inner}>{i}{text}</button>'


# ---------------------------------------------------------------- 1. start
def start():
    def choice(href, ic, title, sub, tag=""):
        tg = badge(tag) if tag else ""
        open_tag = f'<a href="{href}" ' if href else '<div '
        close_tag = "</a>" if href else "</div>"
        muted = "" if href else f"color: {C['muted']}; "
        return (f'{open_tag}style="height: 150px; {CARD}; border-radius: 20px; padding: 20px; display: flex; flex-direction: column; '
                f'justify-content: space-between; {muted}{LINK}">'
                f'<span style="display: flex; justify-content: space-between; align-items: flex-start">{icon(ic, 34)}{tg}</span>'
                f'<span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 30px; font-weight: 800">{title}</span>'
                f'<span style="font-size: 14px; color: {C["muted"]}">{sub}</span></span>{close_tag}')
    body = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 24px">
<span style="font-size: 40px; font-weight: 800; letter-spacing: -0.02em">Grimoire</span>
<span style="font-size: 14px; color: {C['muted']}; margin-top: 4px">5E compatible · works with no network</span>
</div>
<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; padding: 0 16px 36px">
{choice('Flow-Player.dc.html', 'user', 'Player', 'Your characters, rulebooks, dice')}
{choice(None, 'map', 'DM', 'Campaigns, initiative, monsters', 'Later')}
</div>"""
    return page("Start", body)


# ---------------------------------------------------------------- 2. player page
def player():
    def big(href, ic, title, sub):
        return (f'<a href="{href}" style="height: 118px; {CARD}; padding: 18px; display: flex; align-items: center; gap: 16px; {LINK}">'
                f'<span style="width: 56px; height: 56px; flex-shrink: 0; border-radius: 16px; background: {C["strong"]}; '
                f'color: {C["onStrong"]}; display: flex; align-items: center; justify-content: center">{icon(ic, 28)}</span>'
                f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 20px; font-weight: 700">{title}</span>'
                f'<span style="font-size: 14px; color: {C["muted"]}">{sub}</span></span>{icon("chev", 20, C["muted"])}</a>')

    def small(ic, title):
        return (f'<button style="flex-grow: 1; height: 64px; {CARD}; display: flex; align-items: center; justify-content: center; '
                f'gap: 10px; font-weight: 600">{icon(ic, 22)}{title}</button>')
    body = f"""{topbar('Player', 'Flow-Start.dc.html', icon_btn('sliders', 'Settings'))}
<main style="flex-grow: 1; padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 12px">
{big('Flow-Characters.dc.html', 'user', 'My characters', '2 of 3 · last opened: Iren')}
{big('Flow-Create.dc.html', 'plus', 'Create a character', 'Every choice is saved as you go')}
{big('Flow-Rulebooks.dc.html', 'book', 'Rulebooks', 'Rules base 2024 · SRD 2024, SRD 2014')}
<div style="display: flex; gap: 12px">{small('dice', 'Dice')}{small('pen', 'My packs')}</div>
</main>"""
    return page("Player", body)


# ---------------------------------------------------------------- 3. my characters
def characters():
    plus = (f'<a href="Flow-Create.dc.html" aria-label="New character" style="width: 44px; height: 44px; margin-right: 8px; border-radius: 22px; '
            f'background: {C["strong"]}; color: {C["onStrong"]}; display: flex; align-items: center; justify-content: center">{icon("plus", 24)}</a>')

    def card(name, sub, hp, href=None, sample=False):
        tag_open = f'<a href="{href}" ' if href else '<div '
        tag_close = "</a>" if href else "</div>"
        sm = f'<span style="font-size: 12px; color: {C["muted"]}">sample</span>' if sample else badge("2024")
        return (f'{tag_open}style="height: 92px; {CARD}; padding: 0 14px; display: flex; align-items: center; gap: 14px; {LINK}">'
                f'<span style="width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; '
                f'display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700">{name[0]}</span>'
                f'<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px">'
                f'<span style="display: flex; align-items: center; gap: 8px"><span style="font-size: 19px; font-weight: 700">{name}</span>{sm}</span>'
                f'<span style="font-size: 14px; color: {C["muted"]}">{sub}</span>'
                f'<span style="display: flex; align-items: center; gap: 8px">{hp_bar(4)}<span style="font-size: 12px; color: {C["muted"]}">{hp}</span></span>'
                f'</span>{tag_close}')
    actions = [("copy", "Copy", C["strong"]), ("link", "DM link", C["strong"]), ("trash", "Delete", C["danger"]),
               ("more", "More", "#44464B")]
    swipe_btns = "".join(
        f'<a href="Flow-Actions.dc.html" style="width: 60px; height: 92px; display: flex; flex-direction: column; align-items: center; justify-content: center; '
        f'gap: 4px; background: {bg}; color: #FFFFFF; font-size: 12px; font-weight: 600; text-decoration: none">{icon(ic, 22)}{t}</a>'
        for ic, t, bg in actions)
    swiped = (f'<div style="position: relative; height: 92px; border-radius: {R}px; overflow: hidden">'
              f'<div style="position: absolute; right: 0; top: 0; display: flex">{swipe_btns}</div>'
              f'<div style="position: absolute; left: -240px; top: 0; width: 328px">{card("Mira", "Elf · Wizard 3", "18 / 18", sample=True)}</div></div>')
    body = f"""{topbar('My characters', 'Flow-Player.dc.html', '<span style="font-size: 13px; color: ' + C['muted'] + '; margin-right: 8px">2 of 3</span>' + plus)}
<main style="flex-grow: 1; padding: 8px 16px; display: flex; flex-direction: column; gap: 10px">
{card('Iren', 'Human · Fighter 1', '12 / 12', 'Flow-Sheet-Main.dc.html')}
{swiped}
<p style="margin: 6px 4px 0; font-size: 13px; color: {C['muted']}">Tap to open. Swipe left for actions; "More" lists them all.</p>
</main>"""
    return page("My characters", body)


# ---------------------------------------------------------------- 4. create
def create():
    steps = [("Rules", "2024 rules · SRD 2024", True),
             ("Species", "Human · skill: Insight · origin feat: Alert", True),
             ("Class", "Fighter 1 · Defense · skills: Perception, Survival", True),
             ("Background", "Soldier · Savage Attacker · Athletics, Intimidation", True),
             ("Abilities", "15 13 14 8 12 10 · background: STR +2, CON +1", True),
             ("Equipment", "Chain mail, greatsword", True),
             ("Details", "Name and portrait", False)]
    rows = ""
    for i, (t, sub, done) in enumerate(steps, 1):
        mark = (f'<span style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; '
                f'display: flex; align-items: center; justify-content: center">{icon("check", 16)}</span>' if done else
                f'<span style="width: 28px; height: 28px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; border: 2px solid {C["strong"]}; '
                f'display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700">{i}</span>')
        cur = "" if done else f"border-color: {C['strong']}; border-width: 2px; "
        rows += (f'<button style="width: 100%; min-height: 60px; {CARD}; {cur}padding: 10px 12px; display: flex; align-items: center; gap: 12px; '
                 f'text-align: left"><span style="display: flex; flex-direction: column; align-items: center">{mark}</span>'
                 f'<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 700">{t}</span>'
                 f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span>'
                 f'<span style="font-size: 13px; font-weight: 600">{"Change" if done else ""}</span></button>')
    name = (f'<label for="cname" style="font-size: 13px; font-weight: 600">Name</label>'
            f'<input id="cname" value="Iren" style="height: 48px; box-sizing: border-box; border: 1px solid {C["muted"]}; border-radius: 12px; '
            f'padding: 0 14px; font-size: 16px; background: {C["surface"]}; color: {C["text"]}">')
    live = "".join(f'<span style="display: flex; flex-direction: column; align-items: center"><b style="font-size: 18px">{v}</b>'
                   f'<span style="font-size: 12px; color: {C["muted"]}">{l}</span></span>'
                   for v, l in [("17", "AC"), ("12", "HP"), ("+3", "Init"), ("+2", "Prof")])
    body = f"""{topbar('New character', 'Flow-Player.dc.html', '<span style="font-size: 13px; color: ' + C['muted'] + '; margin-right: 14px">Saved</span>')}
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 8px">
{rows}
<div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px">{name}</div>
</main>
<div style="flex-shrink: 0; background: {C['surface']}; border-top: 1px solid {C['line']}; padding: 10px 16px 16px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; justify-content: space-around">{live}</div>
{pbtn('Open the sheet', 'Flow-Sheet-Main.dc.html')}
</div>"""
    return page("New character", body)


# ---------------------------------------------------------------- 5. rulebooks
def rulebooks():
    def seg(opts, on):
        return ('<div style="display: flex; padding: 3px; border-radius: 12px; background: ' + C["soft"] + '">' + "".join(
            f'<button style="flex-grow: 1; height: 40px; border: 0; border-radius: 9px; font-weight: 600; '
            f'background: {C["surface"] if o == on else "transparent"}; color: {C["text"] if o == on else C["muted"]}; '
            f'box-shadow: {"0 1px 3px rgba(0, 0, 0, 0.12)" if o == on else "none"}">{o}</button>' for o in opts) + "</div>")
    folders = [("Species", ["2024"]), ("Classes", ["2024"]), ("Backgrounds", ["2024"]), ("Feats", ["2024"]),
               ("Spells", ["2024", "2014"]), ("Equipment", ["2024"]), ("Magic items", ["2014"]), ("Conditions", ["2024"])]
    rows = ""
    for name, srcs in folders:
        chips = "".join(badge(s) for s in srcs)
        open_row = name == "Spells"
        rows += (f'<button style="width: 100%; height: 52px; display: flex; align-items: center; gap: 12px; padding: 0 12px; border: 0; '
                 f'border-bottom: 1px solid {C["line"]}; background: transparent; text-align: left">{icon("folder", 20, C["muted"])}'
                 f'<span style="flex-grow: 1; font-weight: 600">{name}</span>{chips}{icon("chev", 18, C["muted"])}</button>')
        if open_row:
            opts = "".join(
                f'<label style="display: flex; align-items: center; gap: 10px; height: 36px"><span style="width: 20px; height: 20px; box-sizing: border-box; '
                f'border-radius: 5px; border: 2px solid {C["strong"]}; background: {C["strong"] if on else "transparent"}; color: {C["onStrong"]}; '
                f'display: flex; align-items: center; justify-content: center">{icon("check", 14) if on else ""}</span>{t}</label>'
                for t, on in [("SRD 2024", True), ("SRD 2014", True), ("My packs (0)", False)])
            rows += (f'<div style="padding: 6px 12px 10px 44px; border-bottom: 1px solid {C["line"]}; background: {C["soft"]}">{opts}'
                     f'<div style="margin-top: 6px; padding: 8px 10px; border-radius: 8px; background: {C["warnBg"]}; color: {C["warnText"]}; '
                     f'font-size: 13px">Two editions mixed. Entries that may not fit show a warning; nothing is blocked.</div></div>')
    body = f"""{topbar('Rulebooks', 'Flow-Player.dc.html')}
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 10px">
{label('Rules base')}
{seg(['2014', '2024'], '2024')}
<div style="margin-top: 8px">{label('Where each folder takes its content')}</div>
<div style="{CARD}; overflow: hidden">{rows}</div>
</main>"""
    return page("Rulebooks", body)


# ---------------------------------------------------------------- sheet parts (V3 Thumb, no bottom bar)
def sheet_top():
    stats = "".join(
        f'<button style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 0; '
        f'border: 0; background: transparent"><span style="font-size: 20px; font-weight: 700; line-height: 24px">{v}</span>'
        f'<span style="font-size: 12px; color: {C["muted"]}">{l}</span></button>'
        for v, l in [("17", "AC"), ("+3", "Initiative"), ("30 ft", "Speed"), ("+2", "Proficiency")])
    dots3 = (f'<a href="Flow-Actions.dc.html" aria-label="Actions" style="width: 44px; height: 44px; display: flex; align-items: center; '
             f'justify-content: center; {LINK}">{icon("more", 24)}</a>')
    return (f'<header style="flex-shrink: 0; background: {C["surface"]}; border-bottom: 1px solid {C["line"]}">'
            f'<div style="height: 56px; display: flex; align-items: center; gap: 4px; padding: 0 4px">'
            f'{icon_link("Flow-Characters.dc.html", "back", "Back to my characters")}'
            f'<div style="flex-grow: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px">'
            f'<span style="font-size: 24px; font-weight: 800">Iren</span><span style="white-space: nowrap">Fighter 1</span>{badge("2024")}</div>'
            f'<span style="height: 24px; padding: 0 8px; border-radius: 12px; display: flex; align-items: center; background: {C["strong"]}; '
            f'color: {C["onStrong"]}; font-size: 13px; font-weight: 700">!1</span>{dots3}</div>'
            f'<div style="height: 60px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid {C["line"]}">{stats}</div>'
            f'</header>')


def sheet_dock(active, hp_html=None):
    tabs = ""
    for t in ["Main", "Combat", "Spells", "Equipment", "Features", "Notes"]:
        on = t == active
        href = {"Main": "Flow-Sheet-Main.dc.html", "Features": "Flow-Sheet-Features.dc.html"}.get(t)
        look = (f"background: {C['strong']}; color: {C['onStrong']}; font-weight: 600" if on
                else f"background: {C['soft']}; color: {C['muted']}")
        st = (f'style="flex-shrink: 0; height: 34px; box-sizing: border-box; padding: 0 14px; border: 0; border-radius: 17px; {look}; '
              f'white-space: nowrap; display: flex; align-items: center; text-decoration: none"')
        tabs += f'<a href="{href}" {st}>{t}</a>' if href and not on else f'<button {st}>{t}</button>'
    hp = hp_html or (
        f'<div style="height: 64px; display: flex; align-items: center; gap: 10px; padding: 0 16px">'
        f'<div style="flex-grow: 1; min-width: 0"><div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px">'
        f'<span style="font-size: 12px; color: {C["muted"]}; text-transform: uppercase; letter-spacing: 0.06em">Hit points</span>'
        f'<span style="font-size: 18px; font-weight: 700">12 <span style="font-size: 13px; font-weight: 500; color: {C["muted"]}">/ 12</span></span></div>'
        f'<div style="display: flex">{hp_bar(8)}</div></div>'
        f'<button style="height: 44px; padding: 0 14px; border: 0; border-radius: 12px; background: {C["strong"]}; color: {C["onStrong"]}; font-weight: 600">Damage</button>'
        f'<button style="height: 44px; padding: 0 14px; border: 1px solid {C["muted"]}; border-radius: 12px; background: transparent; font-weight: 600">Heal</button></div>')
    return (f'<div style="flex-shrink: 0; background: {C["surface"]}; border-top: 1px solid {C["line"]}; box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05)">'
            f'{hp}<div style="height: 52px; display: flex; gap: 6px; align-items: center; overflow: hidden; padding: 0 12px; '
            f'border-top: 1px solid {C["line"]}">{tabs}</div></div>')


def main_content():
    tile = f"box-sizing: border-box; background: {C['surface']}; border: 1px solid {C['line']}; border-radius: 12px"
    tiles = "".join(
        f'<button style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 0; {tile}">'
        f'<span style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: {C["muted"]}">{ab}</span>'
        f'<span style="font-size: 22px; font-weight: 700; line-height: 28px">{sg(MOD[ab])}</span>'
        f'<span style="font-size: 12px; color: {C["muted"]}">{score}</span></button>' for ab, _, score in ABILITIES)
    chips = "".join(
        f'<button style="height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0; {tile}">'
        f'<span style="font-size: 12px; font-weight: 600; color: {C["muted"]}">{ab}</span>{dot(ab in SAVE_PROF)}'
        f'<span style="font-weight: 700">{sg(SAVE[ab])}</span></button>' for ab, _, _ in ABILITIES)
    rows = "".join(
        f'<button style="height: 38px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0; border: 0; '
        f'border-bottom: 1px solid {C["line"]}; background: transparent; text-align: left; font-size: 14px">{dot(n in SKILL_PROF)}'
        f'<span style="flex-grow: 1; white-space: nowrap; overflow: hidden">{n}</span>'
        f'<span style="font-weight: {700 if n in SKILL_PROF else 500}">{sg(SKILL[n])}</span></button>' for n, _ in SKILLS)
    return (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 14px 16px; display: flex; flex-direction: column; gap: 16px">'
            f'<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px">{tiles}</div>'
            f'<section><div style="font-size: 17px; font-weight: 700; margin-bottom: 8px">Saving throws</div>'
            f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px">{chips}</div></section>'
            f'<section><div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px">'
            f'<span style="font-size: 17px; font-weight: 700">Skills</span><span style="font-size: 13px; color: {C["muted"]}">Passive Perception '
            f'<b style="color: {C["text"]}">{PASSIVE}</b></span></div>'
            f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 14px; grid-auto-flow: column; '
            f'grid-template-rows: repeat(9, 38px)">{rows}</div></section></main>')


def sheet_main():
    return page("Sheet, Main", sheet_top() + main_content() + sheet_dock("Main"))


# ---------------------------------------------------------------- 6. features (interactive)
def sheet_features():
    def group(title, inner):
        return (f'<section style="display: flex; flex-direction: column; gap: 6px">{label(title)}{inner}</section>')

    def item(name, sub, right=""):
        return (f'<div style="min-height: 52px; {CARD}; padding: 8px 12px; display: flex; align-items: center; gap: 10px">'
                f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600">{name}</span>'
                f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span>{right}</div>')
    second_wind = f"""<div style="{CARD}; padding: 12px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; gap: 10px">
<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 700">Second Wind</span>
<span style="font-size: 13px; color: {C['muted']}">1 back on a short rest, all on a long rest</span></span>
<span style="display: flex; gap: 6px"><sc-for list="{{{{dots}}}}" as="d" hint-placeholder-count="2"><span style="width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%; border: 2px solid {C['strong']}; background: {{{{d.bg}}}}"></span></sc-for></span>
</div>
<div style="display: flex; align-items: center; gap: 10px">
<span style="flex-grow: 1; font-size: 14px"><b>{{{{uses}}}}</b> of 2 uses left</span>
<button onClick="{{{{use}}}}" disabled="{{{{empty}}}}" style="height: 44px; padding: 0 22px; border: 0; border-radius: 12px; background: {C['strong']}; color: {C['onStrong']}; font-weight: 700">Use</button>
</div>
</div>"""
    content = (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 14px 16px; display: flex; flex-direction: column; gap: 14px">'
               + group("Class · Fighter 1",
                       second_wind + item("Fighting Style: Defense", "AC +1 · always on") + item("Weapon Mastery", "Greatsword: Graze"))
               + group("Species · Human", item("Skill", "Insight") + item("Origin feat", "Alert"))
               + group("Background · Soldier", item("Feat", "Savage Attacker") + item("Skills", "Athletics, Intimidation"))
               + group("Feats", item("Alert", "Initiative +2") + item("Savage Attacker", "From Soldier", icon("chev", 18, C["muted"])))
               + group("Subclass", item("Not chosen yet", "Comes at a later level"))
               + "</main>")
    toast = (f'<sc-if value="{{{{toast}}}}" hint-placeholder-val="{{{{ false }}}}"><div style="position: absolute; left: 16px; right: 16px; bottom: 132px; '
             f'height: 48px; border-radius: 12px; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; align-items: center; '
             f'padding: 0 6px 0 16px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25)"><span style="flex-grow: 1">Second Wind used</span>'
             f'<button onClick="{{{{undo}}}}" style="height: 40px; padding: 0 14px; border: 0; background: transparent; color: {C["onStrong"]}; '
             f'font-weight: 700; text-decoration: underline">Undo</button></div></sc-if>')
    js = f"""constructor(props) {{
    super(props);
    this.state = {{ uses: 2, toast: false }};
  }}
  renderVals() {{
    const uses = this.state.uses;
    return {{
      uses: uses,
      empty: uses === 0,
      toast: this.state.toast,
      dots: [0, 1].map((i) => ({{ bg: i < uses ? '{C['strong']}' : 'transparent' }})),
      use: () => this.setState({{ uses: Math.max(0, uses - 1), toast: true }}),
      undo: () => this.setState({{ uses: Math.min(2, uses + 1), toast: false }}),
    }};
  }}"""
    return page("Sheet, Features", sheet_top() + content + toast + sheet_dock("Features"), js)


# ---------------------------------------------------------------- 7. actions
def actions():
    rows = [("copy", "Copy", "Make a second, separate character", C["text"]),
            ("link", "Link for DM", "Share with your DM's table", C["text"]),
            ("send", "Transfer", "Move to another device", C["text"]),
            ("file", "Export file", "Save as a file", C["text"]),
            ("pen", "Rename", "", C["text"]),
            ("trash", "Delete", "Undo stays available for a moment", C["danger"])]
    items = "".join(
        f'<button style="width: 100%; min-height: 56px; display: flex; align-items: center; gap: 14px; padding: 6px 4px; border: 0; '
        f'border-bottom: 1px solid {C["line"]}; background: transparent; color: {col}; text-align: left">{icon(ic, 22)}'
        f'<span style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-weight: 600">{t}</span>'
        + (f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span>' if sub else "")
        + '</span></button>' for ic, t, sub, col in rows)
    sheet = (f'<div style="position: absolute; inset: 0; background: rgba(20, 20, 22, 0.45)"></div>'
             f'<section aria-label="Actions" style="position: absolute; left: 0; right: 0; bottom: 0; box-sizing: border-box; padding: 8px 16px 20px; '
             f'background: {C["surface"]}; border-radius: 20px 20px 0 0; display: flex; flex-direction: column">'
             f'<div style="width: 40px; height: 4px; border-radius: 2px; background: {C["line"]}; align-self: center; margin-bottom: 12px"></div>'
             f'<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px"><span style="flex-grow: 1; font-size: 20px; font-weight: 800">Iren · Actions</span>'
             f'<a href="Flow-Sheet-Main.dc.html" aria-label="Close" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; {LINK}">'
             f'{icon("close", 22)}</a></div>{items}</section>')
    return page("Actions", sheet_top() + main_content() + sheet_dock("Main") + sheet)


EXTRA_ICONS = {
    "check": '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"></path>',
    "link": '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>',
    "trash": '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>',
    "send": '<path d="M4 12l16-8-6 16-3-6z"></path><path d="M11 14l9-10"></path>',
    "folder": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
    "close": '<path d="M6 6l12 12M18 6 6 18"></path>',
}

SCREENS = [("Flow-Start.dc.html", "1 · Start", start, 0, 0),
           ("Flow-Player.dc.html", "2 · Player", player, 1, 0),
           ("Flow-Characters.dc.html", "3 · My characters (swipe)", characters, 2, 0),
           ("Flow-Sheet-Main.dc.html", "4 · Sheet, Main", sheet_main, 3, 0),
           ("Flow-Sheet-Features.dc.html", "5 · Sheet, Features (try Use)", sheet_features, 4, 0),
           ("Flow-Actions.dc.html", "6 · Actions (⋯ or swipe)", actions, 5, 0),
           ("Flow-Create.dc.html", "From Player: Create a character", create, 1, 1),
           ("Flow-Rulebooks.dc.html", "From Player: Rulebooks", rulebooks, 2, 1)]


def run(canvas_src):
    from gen import ICONS
    ICONS.update(EXTRA_ICONS)
    with open(canvas_src, encoding="utf-8") as f:
        canvas = json.load(f)
    pages = canvas.get("pages") or []
    if not any(p["id"] == "player-flow" for p in pages):
        pages.append({"id": "player-flow", "name": "Player flow"})
    canvas["pages"] = pages
    canvas["launch"] = {"view": "canvas", "page": "player-flow"}
    canvas["notes"]["flow-1"] = {"x": 0, "y": 0, "text": "Player flow: press Play and tap through", "kind": "title1",
                                 "maxW": 2560, "page": "player-flow"}
    canvas["notes"]["flow-2"] = {"x": 440, "y": 1180, "text": "Also from the Player page", "kind": "title1",
                                 "maxW": 800, "page": "player-flow"}
    for fname, title, fn, col, row in SCREENS:
        with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as f:
            f.write(fn())
        canvas["boards"][fname] = {"x": col * 440, "y": 260 + row * 1180, "w": W, "h": H, "title": title,
                                   "page": "player-flow", "is_interactive": True}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(canvas, f, indent=1, ensure_ascii=False)
    print("pages:", [p["id"] for p in canvas["pages"]], "boards:", len(canvas["boards"]))


if __name__ == "__main__":
    run(sys.argv[1])
