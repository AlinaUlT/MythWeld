"""Our own design, v1: the reference app's ideas and parts, not its layout. Page 'Our design v1'."""
import json
import os
import sys

from gen import ABILITIES, MOD, PASSIVE, SAVE, SAVE_PROF, ROOT, sg
import gen5
import gen6
from gen5 import C, CARD, LINK, W, H, pbtn
from gen4 import badge, dot, hp_bar, icon, label

SERIF = "'EB Garamond', Georgia, serif"
gen6.P = "G-"
f = gen6.f


def page(title, body, script=None, props=None):
    html = gen5.page(title, body, script, props)
    return html.replace("family=Inter:wght@400;500;600;700;800",
                        "family=EB+Garamond:wght@500;600;700&amp;family=Inter:wght@400;500;600;700;800")


gen6.page = page


def serif(size, text, extra=""):
    return f'<span style="font-family: {SERIF}; font-size: {size}px; font-weight: 700; line-height: 1.1{extra}">{text}</span>'


def topbar(title, back, right=""):
    return (f'<header style="height: 60px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 4px">'
            f'{gen6.ibtn_link(back, "back", "Back")}<h1 style="margin: 0; flex-grow: 1; font-family: {SERIF}; font-size: 28px; '
            f'font-weight: 700">{title}</h1>{right}</header>')


# ---------------------------------------------------------------- sheet frame: serif name, tabs at the bottom (V3)
def sheet_header():
    stats = "".join(
        f'<a href="{f("Roll")}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; {LINK}">'
        f'<span style="font-size: 19px; font-weight: 700; line-height: 24px">{v}</span><span style="font-size: 11px; color: {C["muted"]}">{l}</span></a>'
        for v, l in [("17", "AC"), ("+3", "Init"), ("30 ft", "Speed"), ("+2", "Prof"), (str(PASSIVE), "Passive")])
    return (f'<header style="flex-shrink: 0; background: {C["surface"]}; border-bottom: 1px solid {C["line"]}">'
            f'<div style="height: 60px; display: flex; align-items: center; gap: 2px; padding: 0 2px">'
            f'{gen6.ibtn_link(f("Characters"), "back", "Back to my characters")}'
            f'<div style="flex-grow: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px">{serif(26, "Iren")}'
            f'<span style="font-size: 13px; color: {C["muted"]}; white-space: nowrap">Fighter 1</span>{badge("2024")}</div>'
            f'{gen6.ibtn_link(f("Rest"), "moon", "Rest")}{gen6.ibtn_link(f("Edit"), "pen", "Edit mode")}'
            f'{gen6.ibtn_link(f("Actions"), "more", "Actions")}</div>'
            f'<div style="height: 52px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-top: 1px solid {C["line"]}">{stats}</div>'
            f'</header>')


def sheet_dock(active):
    tabs = ""
    for t in ["Main", "Combat", "Spells", "Gear", "Features", "Notes"]:
        on = t == active or (active == "Stats" and t == "Main")
        href = {"Main": f("Sheet"), "Features": f("Features")}.get(t)
        look = (f"border-bottom: 2px solid {C['text']}; color: {C['text']}; font-weight: 700" if on
                else f"border-bottom: 2px solid transparent; color: {C['muted']}")
        st = (f'style="flex-shrink: 0; height: 48px; box-sizing: border-box; padding: 0 11px; border: 0; {look}; background: transparent; '
              f'white-space: nowrap; display: flex; align-items: center; text-decoration: none"')
        tabs += f'<a href="{href}" {st}>{t}</a>' if href and not on else f'<button {st}>{t}</button>'
    hp = (f'<div style="height: 64px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 16px">'
          f'<div style="flex-grow: 1; min-width: 0"><div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px">'
          f'<span style="font-size: 12px; color: {C["muted"]}; text-transform: uppercase; letter-spacing: 0.06em">Hit points</span>'
          f'<span style="font-size: 18px; font-weight: 700">12 <span style="font-size: 13px; font-weight: 500; color: {C["muted"]}">/ 12</span></span></div>'
          f'<div style="display: flex">{hp_bar(8)}</div></div>'
          f'<button style="height: 44px; padding: 0 14px; border: 0; border-radius: 12px; background: {C["strong"]}; color: {C["onStrong"]}; font-weight: 600">Damage</button>'
          f'<button style="height: 44px; padding: 0 14px; border: 1px solid {C["muted"]}; border-radius: 12px; background: transparent; font-weight: 600">Heal</button></div>')
    return (f'<div style="flex-shrink: 0; background: {C["surface"]}; border-top: 1px solid {C["line"]}; box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05)">'
            f'{hp}<div style="display: flex; overflow: hidden; padding: 0 6px; border-top: 1px solid {C["line"]}">{tabs}</div></div>')


gen6.sheet_header = sheet_header
gen6.sheet_dock = sheet_dock


# ---------------------------------------------------------------- 1. start
def start():
    def choice(href, ic, title, sub, tag=""):
        tg = badge(tag) if tag else ""
        tag_open, tag_close = (f'<a href="{href}" ', "</a>") if href else ("<div ", "</div>")
        col = "" if href else f"color: {C['muted']}; "
        return (f'{tag_open}style="height: 120px; {CARD}; border-radius: 18px; padding: 0 20px; display: flex; align-items: center; gap: 18px; '
                f'{col}{LINK}">{icon(ic, 34)}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px">'
                f'<span style="display: flex; align-items: center; gap: 8px">{serif(30, title)}{tg}</span>'
                f'<span style="font-size: 14px; color: {C["muted"]}">{sub}</span></span>{icon("chev", 20, C["muted"])}{tag_close}')
    body = f"""<header style="height: 56px; flex-shrink: 0; display: flex; justify-content: flex-end; padding: 0 4px">{gen6.ibtn('sliders', 'Settings')}</header>
<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px; padding: 0 24px; text-align: center">
{serif(54, 'Grimoire')}
<span style="height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid {C['muted']}; display: flex; align-items: center; font-size: 13px; color: {C['muted']}">5E compatible · 2014 and 2024 rules</span>
</div>
<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; padding: 0 16px 36px">
{choice(f('Player'), 'user', 'Player', 'Your characters and your rulebook')}
{choice(None, 'map', 'Game master', 'Campaigns, party, encounters', 'Later')}
</div>"""
    return page("Start", body)


# ---------------------------------------------------------------- 2. player page: what a player needs before making a character
def player():
    chapters = [("I", "Species", ["2024"], None), ("II", "Classes", ["2024"], f("Classes")), ("III", "Backgrounds", ["2024"], None),
                ("IV", "Feats", ["2024"], None), ("V", "Spells", ["2024", "2014"], None), ("VI", "Equipment", ["2024"], None),
                ("VII", "Rules and conditions", ["2024"], None)]
    toc = ""
    for num, name, srcs, href in chapters:
        tag_open, tag_close = (f'<a href="{href}" ', "</a>") if href else ("<div ", "</div>")
        toc += (f'{tag_open}style="height: 46px; display: flex; align-items: center; gap: 10px; border-top: 1px solid {C["line"]}; padding: 0 14px; {LINK}">'
                f'<span style="width: 30px; font-family: {SERIF}; font-size: 16px; color: {C["muted"]}">{num}</span>'
                f'<span style="flex-grow: 1; font-weight: 600">{name}</span>{"".join(badge(s) for s in srcs)}{tag_close}')
    seg = (f'<span style="display: flex; padding: 3px; border-radius: 10px; background: {C["soft"]}">'
           f'<span style="height: 30px; padding: 0 12px; display: flex; align-items: center; font-size: 13px; color: {C["muted"]}">2014</span>'
           f'<span style="height: 30px; padding: 0 12px; display: flex; align-items: center; font-size: 13px; font-weight: 700; border-radius: 8px; '
           f'background: {C["surface"]}; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12)">2024</span></span>')
    portraits = "".join(
        f'<span style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid {C["surface"]}; background: {bg}; color: {C["onStrong"]}; '
        f'display: flex; align-items: center; justify-content: center; font-weight: 700; margin-left: {ml}px">{ch}</span>'
        for ch, bg, ml in [("I", C["strong"], 0), ("M", "#6B6F76", -12)])
    tile = lambda href, ic, t, sub: (
        f'<{"a href=" + chr(34) + href + chr(34) if href else "div"} style="flex-grow: 1; flex-basis: 0; height: 72px; {CARD}; padding: 0 14px; '
        f'display: flex; align-items: center; gap: 10px; {LINK}">{icon(ic, 24)}<span style="display: flex; flex-direction: column">'
        f'<span style="font-weight: 700">{t}</span><span style="font-size: 12px; color: {C["muted"]}">{sub}</span></span></{"a" if href else "div"}>')
    body = f"""{topbar('Player', f('Start'), gen6.ibtn('sliders', 'Settings'))}
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 12px">
<a href="{f('Characters')}" style="height: 80px; {CARD}; padding: 0 14px; display: flex; align-items: center; gap: 14px; {LINK}">
<span style="display: flex">{portraits}</span><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 18px; font-weight: 700">My characters</span><span style="font-size: 13px; color: {C['muted']}">2 of 3 · last opened: Iren</span></span>{icon('chev', 20, C['muted'])}</a>
<div style="margin-top: 6px">{label('Before you make a character')}</div>
<section style="{CARD}; overflow: hidden">
<div style="height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 14px">{serif(22, 'Rulebook', '; flex-grow: 1')}<span style="font-size: 12px; color: {C['muted']}">Rules base</span>{seg}</div>
{toc}
<div style="padding: 8px 14px 10px; border-top: 1px solid {C['line']}; font-size: 12px; color: {C['muted']}">Tap a chapter's source to choose 2014, 2024 or your packs.</div>
</section>
<div style="display: flex; gap: 10px">{tile(f('Dice'), 'd20', 'Dice', 'Roll anything')}{tile(None, 'pen', 'My packs', 'Homebrew')}</div>
</main>"""
    return page("Player", body)


# ---------------------------------------------------------------- 3. characters: + in the corner
def characters():
    html = gen6.characters()
    return html.replace("Flow-Create.dc.html", f("Create")).replace(
        'font-size: 22px; font-weight: 800">My characters', f'font-family: {SERIF}; font-size: 28px; font-weight: 700">My characters').replace(
        f'href="{f("Hub")}"', f'href="{f("Player")}"')


# ---------------------------------------------------------------- 4. create: every choice recorded
def create():
    steps = [("Rules", "2024 rules · SRD 2024", True), ("Species", "Human · skill: Insight · origin feat: Alert", True),
             ("Class", "Fighter 1 · Defense · skills: Perception, Survival", True),
             ("Background", "Soldier · Savage Attacker · Athletics, Intimidation", True),
             ("Abilities", "15 13 14 8 12 10 · background: STR +2, CON +1", True),
             ("Equipment", "Chain mail, greatsword", True), ("Details", "Name and portrait", False)]
    rows = ""
    for i, (t, sub, done) in enumerate(steps, 1):
        mark = (f'<span style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; '
                f'display: flex; align-items: center; justify-content: center">{icon("check", 15)}</span>' if done else
                f'<span style="width: 26px; height: 26px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; border: 2px solid {C["strong"]}; '
                f'display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700">{i}</span>')
        line = (f'<span style="position: absolute; left: 12px; top: 34px; bottom: -8px; width: 2px; background: {C["line"]}"></span>'
                if i < len(steps) else "")
        rows += (f'<div style="position: relative; min-height: 58px; display: flex; gap: 12px; padding: 4px 0">{line}{mark}'
                 f'<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 700">{t}</span>'
                 f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span>'
                 f'<span style="font-size: 13px; font-weight: 600; padding-top: 3px">{"Change" if done else ""}</span></div>')
    live = "".join(f'<span style="display: flex; flex-direction: column; align-items: center"><b style="font-size: 18px">{v}</b>'
                   f'<span style="font-size: 12px; color: {C["muted"]}">{l}</span></span>' for v, l in [("17", "AC"), ("12", "HP"), ("+3", "Init"), ("+2", "Prof")])
    body = f"""{topbar('New character', f('Characters'), '<span style="font-size: 13px; color: ' + C['muted'] + '; margin-right: 14px">Saved</span>')}
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column">
<p style="margin: 0 0 10px; font-size: 13px; color: {C['muted']}">Every choice is recorded. Change any step later; the sheet follows.</p>
{rows}
<label for="cname" style="margin-top: 8px; font-size: 13px; font-weight: 600">Name</label>
<input id="cname" value="Iren" style="height: 48px; margin-top: 6px; box-sizing: border-box; border: 1px solid {C['muted']}; border-radius: 12px; padding: 0 14px; font-size: 16px; background: {C['surface']}; color: {C['text']}">
</main>
<div style="flex-shrink: 0; background: {C['surface']}; border-top: 1px solid {C['line']}; padding: 10px 16px 16px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; justify-content: space-around">{live}</div>
{pbtn('Open the sheet', f('Sheet'))}
</div>"""
    return page("New character", body)


# ---------------------------------------------------------------- 5. a rulebook chapter
def classes():
    names = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"]
    rows = "".join(
        f'<div style="height: 50px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid {C["line"]}">'
        f'<span style="flex-grow: 1; font-weight: 600">{n}</span>'
        + (f'<span style="font-size: 12px; color: {C["muted"]}">Iren</span>' if n == "Fighter" else "")
        + f'{badge("2024")}{icon("chev", 18, C["muted"])}</div>' for n in names)
    chips = "".join(
        f'<span style="height: 34px; padding: 0 12px; border-radius: 17px; display: flex; align-items: center; gap: 6px; font-size: 13px; '
        + (f'background: {C["strong"]}; color: {C["onStrong"]}; font-weight: 600">{icon("check", 14)}' if on else f'background: {C["soft"]}; color: {C["muted"]}">')
        + f'{t}</span>' for t, on in [("SRD 2024", True), ("SRD 2014", False), ("My packs", False)])
    body = f"""{topbar('Classes', f('Player'), '<span style="font-family: ' + SERIF + '; font-size: 18px; color: ' + C['muted'] + '; margin-right: 16px">II</span>')}
<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 10px">
<label style="height: 46px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 12px; background: {C['soft']}; color: {C['muted']}">{icon('search', 20)}<input aria-label="Search classes" placeholder="Search classes" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-size: 16px; outline: none"></label>
<div style="display: flex; gap: 6px">{chips}</div>
<p style="margin: 0; font-size: 12px; color: {C['muted']}">Sample list. Entries come from the SRD import.</p>
</div>
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 4px 16px">{rows}</main>"""
    return page("Classes", body)


# ---------------------------------------------------------------- 6-7. sheet and features (from gen6, with our frame)
def sheet():
    return page("Sheet", sheet_header() + gen6.sheet_main_content() + sheet_dock("Main"))


def features():
    return gen6.features()


# ---------------------------------------------------------------- 8. edit mode: tap a number, change it in a sheet
def edit():
    banner = (f'<header style="flex-shrink: 0; height: 60px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 16px; '
              f'background: {C["strong"]}; color: {C["onStrong"]}"><span style="flex-grow: 1; display: flex; flex-direction: column">'
              f'<span style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em">Edit mode · tap any number</span>'
              f'{serif(22, "Iren")}</span><a href="{f("Sheet")}" style="height: 40px; padding: 0 18px; border-radius: 10px; '
              f'background: {C["onStrong"]}; color: {C["strong"]}; display: flex; align-items: center; font-weight: 700; text-decoration: none">Done</a></header>')
    b = (f"width: 56px; height: 56px; border-radius: 14px; border: 1px solid {C['line']}; background: {C['surface']}; "
         f"display: flex; align-items: center; justify-content: center; padding: 0")
    toggle = (f'<span style="width: 44px; height: 26px; border-radius: 13px; background: {C["strong"]}; position: relative; flex-shrink: 0">'
              f'<span style="position: absolute; top: 3px; left: 21px; width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF"></span></span>')
    inner = (f'<div style="display: flex; align-items: baseline; justify-content: space-between">{serif(26, "Strength")}'
             f'<span style="font-size: 13px; color: {C["muted"]}">modifier {sg(MOD["STR"])} · save {sg(SAVE["STR"])}</span></div>'
             f'<div style="display: flex; align-items: center; justify-content: center; gap: 22px; padding: 4px 0">'
             f'<button aria-label="Lower" style="{b}">{icon("minus", 24)}</button><span style="font-size: 44px; font-weight: 800; width: 70px; '
             f'text-align: center">17</span><button aria-label="Raise" style="{b}">{icon("plus", 24)}</button></div>'
             f'<div style="display: flex; align-items: center; gap: 10px; height: 44px"><span style="flex-grow: 1">Proficient in Strength saves</span>{toggle}</div>'
             f'<div style="padding: 10px 12px; border-radius: 10px; background: {C["soft"]}; font-size: 14px"><b>17</b> = standard array 15 + Soldier +2</div>'
             f'<label for="ovr" style="font-size: 13px; font-weight: 600">Override by hand</label>'
             f'<input id="ovr" placeholder="17" style="height: 44px; box-sizing: border-box; border: 1px solid {C["muted"]}; border-radius: 10px; padding: 0 12px; '
             f'font-size: 16px; background: transparent; color: {C["text"]}">'
             f'<span style="font-size: 12px; color: {C["muted"]}">A typed value always wins. The sheet labels it "Manual edit".</span>')
    under = banner + gen6.sheet_main_content() + sheet_dock("Main")
    return page("Edit mode", under + gen6.overlay(inner, f("Edit")))


# ---------------------------------------------------------------- 9. rest
def rest():
    def opt(ic, t, lines, primary):
        ls = "".join(f'<li style="margin: 2px 0">{x}</li>' for x in lines)
        return (f'<div style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">'
                f'<div style="display: flex; align-items: center; gap: 10px">{icon(ic, 22)}{serif(22, t, "; flex-grow: 1")}</div>'
                f'<ul style="margin: 0; padding-left: 20px; font-size: 14px; color: {C["muted"]}">{ls}</ul>{pbtn(t, f("Sheet"), primary)}</div>')
    inner = (opt("clock", "Short rest", ["Second Wind: 1 use back", "Spend hit dice to heal"], False)
             + opt("moon", "Long rest", ["Hit points back to 12", "Second Wind back to 2 of 2", "Hit dice back"], True))
    return page("Rest", gen6.sheet_bg() + gen6.overlay(inner, f("Sheet")))


# ---------------------------------------------------------------- 10. dice: a tray you fill by tapping dice
def dice():
    grid = "".join(
        f'<button style="height: 64px; {CARD}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px">'
        f'{icon("d20", 22, C["muted"])}<span style="font-weight: 700">{d}</span></button>' for d in ["d4", "d6", "d8", "d10", "d12", "d20", "d100", "+1"])
    chip = lambda t: (f'<span style="height: 36px; padding: 0 6px 0 12px; border-radius: 18px; background: {C["surface"]}; border: 1px solid {C["line"]}; '
                      f'display: flex; align-items: center; gap: 4px; font-weight: 700">{t}<span style="width: 26px; height: 26px; display: flex; '
                      f'align-items: center; justify-content: center; color: {C["muted"]}">{icon("close", 14)}</span></span>')
    faces = "".join(f'<span style="width: 40px; height: 40px; border-radius: 10px; border: 2px solid {C["strong"]}; display: flex; align-items: center; '
                    f'justify-content: center; font-weight: 800; font-size: 18px">{n}</span>' for n in (4, 5))
    body = f"""{topbar('Dice', f('Player'), '<span style="height: 32px; padding: 0 12px; margin-right: 8px; border-radius: 16px; border: 1px solid ' + C['muted'] + '; display: flex; align-items: center; font-size: 13px; color: ' + C['muted'] + '">Skins ★</span>')}
<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 14px">
<section style="{CARD}; padding: 16px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; justify-content: space-between; align-items: baseline">{label('Last roll')}<span style="font-size: 12px; color: {C['muted']}">sample</span></div>
<div style="display: flex; align-items: center; gap: 8px">{faces}<span style="font-size: 18px; color: {C['muted']}">+ 3 =</span><span style="margin-left: auto; font-size: 48px; font-weight: 800; line-height: 1">12</span></div>
</section>
<div>{label('Your roll')}</div>
<div style="min-height: 56px; box-sizing: border-box; padding: 10px; border-radius: 14px; border: 2px dashed {C['line']}; display: flex; flex-wrap: wrap; gap: 8px; align-items: center">{chip('2 × d6')}{chip('+3')}<span style="margin-left: auto; font-size: 13px; font-weight: 600; color: {C['muted']}">Clear</span></div>
<div>{label('Tap a die to add it')}</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px">{grid}</div>
</main>
<div style="flex-shrink: 0; padding: 10px 16px 20px; background: {C['surface']}; border-top: 1px solid {C['line']}">{pbtn('Roll 2d6 + 3', None, True, False, 'd20')}</div>"""
    return page("Dice", body)


def roll():
    return gen6.roll()


def actions():
    return gen6.actions()


SCREENS = [("Start", "1 · Start: Player or Game master", start, 0, 0),
           ("Player", "2 · Player: what you need before making a character", player, 1, 0),
           ("Characters", "3 · My characters: + in the corner", characters, 2, 0),
           ("Sheet", "4 · Sheet (V3)", sheet, 3, 0),
           ("Features", "5 · Features (try Use)", features, 4, 0),
           ("Edit", "6 · Edit mode: tap a number", edit, 5, 0),
           ("Dice", "From Player: Dice", dice, 0, 1),
           ("Classes", "From Player: a rulebook chapter", classes, 1, 1),
           ("Create", "From +: New character", create, 2, 1),
           ("Roll", "From the sheet: a roll", roll, 3, 1),
           ("Rest", "From the sheet: Rest", rest, 4, 1),
           ("Actions", "From ⋯ or a swipe: Actions", actions, 5, 1)]


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    pages = canvas.get("pages") or []
    if not any(p["id"] == "ours-v1" for p in pages):
        pages.append({"id": "ours-v1", "name": "Our design v1"})
    canvas["pages"] = pages
    canvas["launch"] = {"view": "canvas", "page": "ours-v1"}
    canvas["notes"]["ours-1"] = {"x": 0, "y": 0, "text": "Our design v1: same ideas and parts, our own layout. Press Play",
                                 "kind": "title1", "maxW": 2560, "page": "ours-v1"}
    canvas["notes"]["ours-2"] = {"x": 0, "y": 1180, "text": "Opened from the Player page, the list and the sheet",
                                 "kind": "title1", "maxW": 2560, "page": "ours-v1"}
    for name, title, fn, col, row in SCREENS:
        fname = f(name)
        with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as fh:
            fh.write(fn())
        canvas["boards"][fname] = {"x": col * 440, "y": 260 + row * 1180, "w": W, "h": H, "title": title,
                                   "page": "ours-v1", "is_interactive": True}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    print("pages:", [p["id"] for p in canvas["pages"]], "boards:", len(canvas["boards"]))


if __name__ == "__main__":
    run(sys.argv[1])
