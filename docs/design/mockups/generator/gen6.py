"""The reference app's structure, redrawn with our rules: page 'Reference, improved'."""
import json
import os
import sys

from gen import ABILITIES, ICONS, MOD, PASSIVE, SAVE, SAVE_PROF, SKILL, SKILL_PROF, SKILLS, ROOT, sg
import gen5
from gen5 import C, CARD, LINK, W, H, page, icon_link, pbtn
from gen4 import badge, dot, hp_bar, icon, label

ICONS.update(gen5.EXTRA_ICONS)
ICONS.update({
    "d20": '<path d="M12 2 21 7v10l-9 5-9-5V7z"></path><path d="M12 2 7 10h10zM7 10l-4 7M17 10l4 7M7 10l5 12 5-12"></path>',
    "help": '<circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5h.01"></path>',
    "sword": '<path d="M14.5 3H21v6.5L10 20.5 3.5 14z"></path><path d="M5 19l-2 2M7.5 16.5l-3-3"></path>',
    "minus": '<path d="M5 12h14"></path>',
    "sun": '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>',
    "cond": '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v6M12 16.5h.01"></path>',
})

P = "R-"  # file prefix for this page


def f(name):
    return f"{P}{name}.dc.html"


def ibtn_link(href, name, lbl, color=None):
    col = f"color: {color}; " if color else ""
    return (f'<a href="{href}" aria-label="{lbl}" style="width: 44px; height: 44px; flex-shrink: 0; display: flex; '
            f'align-items: center; justify-content: center; {col}{LINK}">{icon(name, 22)}</a>')


def ibtn(name, lbl):
    return (f'<button aria-label="{lbl}" style="width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; '
            f'justify-content: center; padding: 0; border: 0; background: transparent">{icon(name, 22)}</button>')


def topbar(title, back, right=""):
    return (f'<header style="height: 60px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 4px">'
            f'{ibtn_link(back, "back", "Back")}<h1 style="margin: 0; flex-grow: 1; font-size: 22px; font-weight: 800">{title}</h1>'
            f'{right}</header>')


def sheet_bg(title_href=None):
    """A darkened copy of the play sheet, used under bottom sheets."""
    return sheet_header() + sheet_main_content() + sheet_dock("Stats")


def overlay(inner, close_href):
    return (f'<a href="{close_href}" aria-label="Close" style="position: absolute; inset: 0; background: rgba(20, 20, 22, 0.45)"></a>'
            f'<section style="position: absolute; left: 0; right: 0; bottom: 0; box-sizing: border-box; padding: 8px 16px 20px; '
            f'background: {C["surface"]}; border-radius: 20px 20px 0 0; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="width: 40px; height: 4px; border-radius: 2px; background: {C["line"]}; align-self: center; margin-bottom: 4px"></div>'
            f'{inner}</section>')


# ---------------------------------------------------------------- 1. start
def start():
    def choice(href, ic, title, sub, tag=""):
        tg = badge(tag) if tag else ""
        tag_open, tag_close = (f'<a href="{href}" ', "</a>") if href else ("<div ", "</div>")
        muted = "" if href else f"color: {C['muted']}; "
        return (f'{tag_open}style="height: 132px; {CARD}; border-radius: 20px; padding: 18px 20px; display: flex; align-items: center; '
                f'gap: 18px; {muted}{LINK}"><span style="width: 64px; height: 64px; flex-shrink: 0; border-radius: 50%; '
                f'background: {C["strong"] if href else C["soft"]}; color: {C["onStrong"] if href else C["muted"]}; display: flex; '
                f'align-items: center; justify-content: center">{icon(ic, 30)}</span><span style="flex-grow: 1; display: flex; '
                f'flex-direction: column; gap: 4px"><span style="display: flex; align-items: center; gap: 8px">'
                f'<span style="font-size: 26px; font-weight: 800">{title}</span>{tg}</span>'
                f'<span style="font-size: 14px; color: {C["muted"]}">{sub}</span></span></{"a" if href else "div"}>')
    systems = (f'<div style="display: flex; gap: 8px; align-items: center">'
               f'<span style="height: 36px; padding: 0 14px; border-radius: 18px; display: flex; align-items: center; gap: 6px; '
               f'background: {C["strong"]}; color: {C["onStrong"]}; font-size: 14px; font-weight: 600">{icon("check", 16)}5E compatible</span>'
               f'<span style="height: 36px; padding: 0 14px; border-radius: 18px; display: flex; align-items: center; gap: 6px; '
               f'border: 1px dashed {C["muted"]}; color: {C["muted"]}; font-size: 14px">{icon("plus", 16)}More systems later</span></div>')
    body = f"""<header style="height: 56px; flex-shrink: 0; display: flex; justify-content: flex-end; padding: 0 4px">{ibtn('help', 'Help')}{ibtn('sliders', 'Settings')}</header>
<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 14px; padding: 0 24px">
<span style="font-size: 40px; font-weight: 800; letter-spacing: -0.02em">Grimoire</span>
{label('Game system')}
{systems}
</div>
<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; padding: 0 16px 36px">
{choice(f('Hub'), 'user', 'Player', 'Characters, rulebooks, dice')}
{choice(None, 'map', 'DM', 'Campaigns, party, encounters', 'Later')}
</div>"""
    return page("Start", body)


# ---------------------------------------------------------------- 2. hub (radial, with labels)
def hub():
    def node(x, y, ic, text, href=None, later=False, size=72):
        bg = C["soft"] if later else C["surface"]
        col = C["muted"] if later else C["text"]
        tag_open, tag_close = (f'<a href="{href}" ', "</a>") if href else ("<div ", "</div>")
        tg = f'<span style="font-size: 11px; color: {C["muted"]}">Later</span>' if later else ""
        return (f'{tag_open}style="position: absolute; left: {x - 50}px; top: {y - size // 2}px; width: 100px; display: flex; '
                f'flex-direction: column; align-items: center; gap: 6px; color: {col}; {LINK}">'
                f'<span style="width: {size}px; height: {size}px; border-radius: 50%; background: {bg}; border: 1px solid {C["line"]}; '
                f'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); display: flex; align-items: center; justify-content: center">{icon(ic, 28)}</span>'
                f'<span style="font-size: 14px; font-weight: 600; text-align: center">{text}</span>{tg}{tag_close}')
    cx, cy = 180, 330
    ring = (f'<span style="position: absolute; left: {cx - 125}px; top: {cy - 125}px; width: 250px; height: 250px; box-sizing: border-box; '
            f'border-radius: 50%; border: 1px dashed {C["line"]}"></span>')
    center = (f'<a href="{f("Dice")}" aria-label="Dice" style="position: absolute; left: {cx - 56}px; top: {cy - 56}px; width: 112px; '
              f'height: 112px; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; flex-direction: column; '
              f'align-items: center; justify-content: center; gap: 4px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25); {LINK}; '
              f'color: {C["onStrong"]}">{icon("d20", 40)}<span style="font-weight: 700">Roll</span></a>')
    nodes = (node(cx, cy - 150, "user", "My characters", f("Characters"))
             + node(cx - 128, cy - 20, "book", "Rulebooks", f("Library"))
             + node(cx + 128, cy - 20, "plus", "Create", "Flow-Create.dc.html")
             + node(cx - 82, cy + 128, "pen", "My packs")
             + node(cx + 82, cy + 128, "map", "Campaign", None, True))
    cont = (f'<a href="{f("Sheet")}" style="position: absolute; left: 16px; right: 16px; bottom: 28px; height: 76px; {CARD}; padding: 0 14px; '
            f'display: flex; align-items: center; gap: 12px; {LINK}"><span style="width: 48px; height: 48px; border-radius: 50%; '
            f'background: {C["strong"]}; color: {C["onStrong"]}; display: flex; align-items: center; justify-content: center; font-size: 20px; '
            f'font-weight: 700">I</span><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 12px; color: {C["muted"]}; text-transform: uppercase; letter-spacing: 0.06em">Continue</span>'
            f'<span style="font-weight: 700">Iren · Fighter 1 · 12 / 12 HP</span></span>{icon("chev", 20, C["muted"])}</a>')
    body = (f'<header style="height: 56px; flex-shrink: 0; display: flex; align-items: center; padding: 0 4px">'
            f'{ibtn_link(f("Start"), "back", "Back to start")}<span style="flex-grow: 1; font-size: 22px; font-weight: 800">Player</span>'
            f'{ibtn("help", "Help")}{ibtn("sliders", "Settings")}</header>'
            f'<div style="position: relative; flex-grow: 1">{ring}{nodes}{center}{cont}</div>')
    return page("Player hub", body)


# ---------------------------------------------------------------- 3. characters (+ in the corner, swipe actions)
def characters():
    plus = (f'<a href="Flow-Create.dc.html" aria-label="New character" style="width: 44px; height: 44px; margin-right: 8px; border-radius: 22px; '
            f'background: {C["strong"]}; color: {C["onStrong"]}; display: flex; align-items: center; justify-content: center">{icon("plus", 24)}</a>')

    def card(name, sub, created, href=None, sample=False):
        tag_open, tag_close = (f'<a href="{href}" ', "</a>") if href else ("<div ", "</div>")
        sm = f'<span style="font-size: 12px; color: {C["muted"]}">sample</span>' if sample else badge("2024")
        return (f'{tag_open}style="height: 84px; {CARD}; padding: 0 14px; display: flex; align-items: center; gap: 14px; {LINK}">'
                f'<span style="width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; '
                f'display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700">{name[0]}</span>'
                f'<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">'
                f'<span style="display: flex; align-items: center; gap: 8px"><span style="font-size: 19px; font-weight: 700">{name}</span>{sm}</span>'
                f'<span style="font-size: 14px">{sub}</span><span style="font-size: 12px; color: {C["muted"]}">{created}</span></span>{tag_close}')
    acts = [("copy", "Copy", C["strong"]), ("link", "DM link", C["strong"]), ("trash", "Delete", C["danger"]), ("more", "More", "#44464B")]
    btns = "".join(
        f'<a href="{f("Actions")}" style="width: 60px; height: 84px; display: flex; flex-direction: column; align-items: center; justify-content: center; '
        f'gap: 4px; background: {bg}; color: #FFFFFF; font-size: 12px; font-weight: 600; text-decoration: none">{icon(ic, 22)}{t}</a>'
        for ic, t, bg in acts)
    swiped = (f'<div style="position: relative; height: 84px; border-radius: 14px; overflow: hidden"><div style="position: absolute; right: 0; '
              f'top: 0; display: flex">{btns}</div><div style="position: absolute; left: -240px; top: 0; width: 328px">'
              f'{card("Mira", "Elf · Wizard 3", "Created 12 Sep 2026", sample=True)}</div></div>')
    body = f"""{topbar('My characters', f('Hub'), '<span style="font-size: 13px; color: ' + C['muted'] + '; margin-right: 8px">2 of 3</span>' + plus)}
<main style="flex-grow: 1; padding: 8px 16px; display: flex; flex-direction: column; gap: 10px">
{card('Iren', 'Human · Fighter 1', 'Created 30 Sep 2026', f('Sheet'))}
{swiped}
<p style="margin: 6px 4px 0; font-size: 13px; color: {C['muted']}">Tap to open. Swipe left for actions.</p>
</main>"""
    return page("My characters", body)


# ---------------------------------------------------------------- sheet parts
def sheet_header():
    stats = "".join(
        f'<a href="{f("Roll")}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; {LINK}">'
        f'<span style="font-size: 19px; font-weight: 700; line-height: 24px">{v}</span><span style="font-size: 11px; color: {C["muted"]}">{l}</span></a>'
        for v, l in [("17", "AC"), ("+3", "Init"), ("30 ft", "Speed"), ("+2", "Prof"), (str(PASSIVE), "Passive")])
    return (f'<header style="flex-shrink: 0; background: {C["surface"]}; border-bottom: 1px solid {C["line"]}">'
            f'<div style="height: 60px; display: flex; align-items: center; gap: 2px; padding: 0 2px">'
            f'{ibtn_link(f("Characters"), "back", "Back to my characters")}'
            f'<span style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; '
            f'display: flex; align-items: center; justify-content: center; font-weight: 700; margin-right: 6px">I</span>'
            f'<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column"><span style="font-size: 19px; font-weight: 800; '
            f'line-height: 22px">Iren</span><span style="font-size: 12px; color: {C["muted"]}; white-space: nowrap">Human · Fighter 1 · 2024</span></div>'
            f'{ibtn_link(f("Rest"), "moon", "Rest")}{ibtn_link(f("Edit"), "pen", "Edit mode")}{ibtn_link(f("Actions"), "more", "Actions")}</div>'
            f'<div style="height: 52px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-top: 1px solid {C["line"]}">{stats}</div>'
            f'</header>')


def sheet_dock(active):
    chips = ""
    for t in ["Stats", "Skills", "Features", "Combat", "Gear", "Spells", "Notes"]:
        on = t == active
        href = {"Stats": f("Sheet"), "Skills": f("Sheet"), "Features": f("Features"), "Combat": f("Weapon")}.get(t)
        look = (f"background: {C['strong']}; color: {C['onStrong']}; font-weight: 600" if on
                else f"background: {C['soft']}; color: {C['muted']}")
        st = (f'style="flex-shrink: 0; height: 34px; box-sizing: border-box; padding: 0 14px; border: 0; border-radius: 17px; {look}; '
              f'white-space: nowrap; display: flex; align-items: center; text-decoration: none"')
        chips += f'<a href="{href}" {st}>{t}</a>' if href and not on else f'<button {st}>{t}</button>'
    hp = (f'<div style="height: 64px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 16px">'
          f'<div style="flex-grow: 1; min-width: 0"><div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px">'
          f'<span style="font-size: 12px; color: {C["muted"]}; text-transform: uppercase; letter-spacing: 0.06em">Hit points</span>'
          f'<span style="font-size: 18px; font-weight: 700">12 <span style="font-size: 13px; font-weight: 500; color: {C["muted"]}">/ 12</span></span></div>'
          f'<div style="display: flex">{hp_bar(8)}</div></div>'
          f'<button aria-label="Damage" style="width: 48px; height: 44px; border: 0; border-radius: 12px; background: {C["strong"]}; color: {C["onStrong"]}; '
          f'display: flex; align-items: center; justify-content: center">{icon("minus", 22)}</button>'
          f'<button aria-label="Heal" style="width: 48px; height: 44px; border: 1px solid {C["muted"]}; border-radius: 12px; background: transparent; '
          f'display: flex; align-items: center; justify-content: center">{icon("plus", 22)}</button></div>')
    return (f'<div style="flex-shrink: 0; background: {C["surface"]}; border-top: 1px solid {C["line"]}; box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05)">'
            f'{hp}<div style="height: 52px; display: flex; gap: 6px; align-items: center; overflow: hidden; padding: 0 12px; '
            f'border-top: 1px solid {C["line"]}">{chips}</div></div>')


def sec_title(t, right=""):
    return (f'<div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px">'
            f'<span style="font-size: 17px; font-weight: 800">{t}</span>{right}</div>')


def sheet_main_content():
    tile = f"box-sizing: border-box; background: {C['surface']}; border: 1px solid {C['line']}; border-radius: 12px"
    tiles = "".join(
        f'<a href="{f("Roll")}" style="height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; '
        f'{tile}; {LINK}"><span style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: {C["muted"]}">{ab}</span>'
        f'<span style="font-size: 22px; font-weight: 700; line-height: 26px">{sg(MOD[ab])}</span>'
        f'<span style="font-size: 12px; color: {C["muted"]}">{score}</span></a>' for ab, _, score in ABILITIES)
    chips = "".join(
        f'<a href="{f("Roll")}" style="height: 40px; display: flex; align-items: center; justify-content: center; gap: 7px; {tile}; {LINK}">'
        f'<span style="font-size: 12px; font-weight: 600; color: {C["muted"]}">{ab}</span>{dot(ab in SAVE_PROF)}'
        f'<span style="font-weight: 700">{sg(SAVE[ab])}</span></a>' for ab, _, _ in ABILITIES)

    def group(ab_name, ab):
        rows = "".join(
            f'<a href="{f("Roll")}" style="height: 34px; display: flex; align-items: center; gap: 8px; font-size: 14px; {LINK}">'
            f'{dot(n in SKILL_PROF)}<span style="flex-grow: 1; white-space: nowrap">{n}</span>'
            f'<span style="font-weight: {700 if n in SKILL_PROF else 500}">{sg(SKILL[n])}</span></a>'
            for n, a in SKILLS if a == ab)
        return (f'<div><div style="font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: {C["muted"]}; '
                f'margin: 4px 0 2px">{ab_name}</div>{rows}</div>')
    left = group("Strength", "STR") + group("Dexterity", "DEX") + group("Intelligence", "INT")
    right = group("Wisdom", "WIS") + group("Charisma", "CHA")
    cond = (f'<div style="height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 12px; {tile}">{icon("cond", 20, C["muted"])}'
            f'<span style="flex-grow: 1; color: {C["muted"]}">No conditions</span><span style="font-weight: 600">Add</span></div>')
    return (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: flex; flex-direction: column; gap: 14px">'
            f'{cond}<section>{sec_title("Abilities")}<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px">{tiles}</div></section>'
            f'<section>{sec_title("Saving throws")}<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px">{chips}</div></section>'
            f'<section>{sec_title("Skills")}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px">'
            f'<div>{left}</div><div>{right}</div></div></section></main>')


def sheet():
    return page("Sheet", sheet_header() + sheet_main_content() + sheet_dock("Stats"))


# ---------------------------------------------------------------- 5. features (interactive uses)
def features():
    def grp(title, sub, inner, open_=True):
        chev = "▾" if open_ else "▸"
        body = inner if open_ else ""
        return (f'<section style="{CARD}; overflow: hidden"><div style="height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 14px; '
                f'border-bottom: {"1px solid " + C["line"] if open_ else "0"}"><span style="flex-grow: 1"><b>{title}</b> '
                f'<span style="color: {C["muted"]}; font-size: 13px">{sub}</span></span><span style="color: {C["muted"]}">{chev}</span></div>{body}</section>')

    def row(name, sub, right=""):
        return (f'<div style="min-height: 48px; display: flex; align-items: center; gap: 10px; padding: 6px 14px; border-top: 1px solid {C["line"]}">'
                f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600">{name}</span>'
                f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span>{right}</div>')
    sw = f"""<div style="padding: 10px 14px; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: center; gap: 10px"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 700">Second Wind</span>
<span style="font-size: 13px; color: {C['muted']}">1 back on a short rest, all on a long rest</span></span>
<span style="display: flex; gap: 6px"><sc-for list="{{{{dots}}}}" as="d" hint-placeholder-count="2"><span style="width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%; border: 2px solid {C['strong']}; background: {{{{d.bg}}}}"></span></sc-for></span></div>
<div style="display: flex; align-items: center; gap: 8px"><span style="flex-grow: 1; font-size: 14px"><b>{{{{uses}}}}</b> of 2 left</span>
<button onClick="{{{{use}}}}" disabled="{{{{empty}}}}" style="height: 44px; padding: 0 24px; border: 0; border-radius: 12px; background: {C['strong']}; color: {C['onStrong']}; font-weight: 700">Use</button></div></div>"""
    always = f'<span style="font-size: 12px; color: {C["muted"]}">Always on</span>'
    content = (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px">'
               + sec_title("Features", f'<span style="font-size: 13px; color: {C["muted"]}">grouped by where they come from</span>')
               + grp("Fighter", "level 1", sw + row("Fighting Style: Defense", "AC +1", always) + row("Weapon Mastery", "Greatsword: Graze"))
               + grp("Human", "species", row("Skill", "Insight") + row("Origin feat", "Alert"))
               + grp("Soldier", "background", "", False)
               + grp("Feats", "Savage Attacker, Alert", "", False)
               + grp("Subclass", "chosen at a later level", "", False)
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
    return page("Sheet, features", sheet_header() + content + toast + sheet_dock("Features"), js)


# ---------------------------------------------------------------- 6. edit mode
def edit():
    def step(val):
        b = (f"width: 44px; height: 44px; border-radius: 12px; border: 1px solid {C['line']}; background: {C['surface']}; "
             f"display: flex; align-items: center; justify-content: center; padding: 0")
        return (f'<span style="display: flex; align-items: center; gap: 6px"><button aria-label="Lower" style="{b}">{icon("minus", 20)}</button>'
                f'<span style="width: 34px; text-align: center; font-size: 20px; font-weight: 700">{val}</span>'
                f'<button aria-label="Raise" style="{b}">{icon("plus", 20)}</button></span>')

    def toggle(on):
        return (f'<span style="width: 44px; height: 26px; border-radius: 13px; background: {C["strong"] if on else C["line"]}; position: relative; '
                f'flex-shrink: 0"><span style="position: absolute; top: 3px; left: {21 if on else 3}px; width: 20px; height: 20px; border-radius: 50%; '
                f'background: #FFFFFF"></span></span>')
    rows = "".join(
        f'<div style="height: 58px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid {C["line"]}">'
        f'<span style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-weight: 600">{name}</span>'
        f'<span style="font-size: 13px; color: {C["muted"]}">modifier {sg(MOD[ab])}</span></span>{step(score)}'
        f'<span style="display: flex; flex-direction: column; align-items: center; gap: 3px; width: 50px"><span style="font-size: 11px; '
        f'color: {C["muted"]}">Save</span>{toggle(ab in SAVE_PROF)}</span></div>' for ab, name, score in ABILITIES)
    links = "".join(
        f'<button style="width: 100%; height: 50px; display: flex; align-items: center; gap: 10px; padding: 0; border: 0; border-bottom: 1px solid {C["line"]}; '
        f'background: transparent; text-align: left"><span style="flex-grow: 1"><b>{t}</b> <span style="font-size: 13px; color: {C["muted"]}">{s}</span></span>'
        f'{icon("chev", 18, C["muted"])}</button>'
        for t, s in [("Skills", "5 proficient"), ("Hit points", "max 12"), ("Proficiencies", "armor, weapons, tools, languages"),
                     ("Basics", "name, portrait, species, background")])
    body = (f'<header style="height: 60px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 16px; '
            f'background: {C["strong"]}; color: {C["onStrong"]}"><span style="flex-grow: 1; display: flex; flex-direction: column">'
            f'<span style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em">Edit mode</span>'
            f'<span style="font-size: 19px; font-weight: 800">Iren</span></span>'
            f'<a href="{f("Sheet")}" style="height: 40px; padding: 0 18px; border-radius: 10px; background: {C["onStrong"]}; color: {C["strong"]}; '
            f'display: flex; align-items: center; font-weight: 700; text-decoration: none">Done</a></header>'
            f'<div style="padding: 10px 16px; font-size: 13px; color: {C["muted"]}; background: {C["soft"]}">Every change is saved at once and can be undone.</div>'
            f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 12px 16px">{sec_title("Ability scores")}{rows}'
            f'<div style="height: 16px"></div>{sec_title("More to edit")}{links}</main>')
    return page("Sheet, edit mode", body)


# ---------------------------------------------------------------- 7. roll result
def roll():
    die = (f'<div style="width: 92px; height: 92px; position: relative; flex-shrink: 0">{icon("d20", 92, C["strong"], 1.2)}'
           f'<span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding-top: 10px; '
           f'font-size: 22px; font-weight: 800">14</span></div>')
    inner = (f'<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 22px; font-weight: 800">Athletics</span>'
             f'<span style="font-size: 12px; color: {C["muted"]}">sample roll</span></div>'
             f'<div style="display: flex; align-items: center; gap: 18px">{die}<div style="display: flex; flex-direction: column; gap: 4px">'
             f'<span style="font-size: 15px; color: {C["muted"]}">d20 (14) + 5</span><span style="font-size: 48px; font-weight: 800; line-height: 1">19</span></div></div>'
             f'<div style="font-size: 13px; color: {C["muted"]}; padding: 8px 12px; border-radius: 10px; background: {C["soft"]}">'
             f'+5 = Strength +3, proficiency +2 (Soldier)</div>'
             f'<div style="display: flex; gap: 8px">{pbtn("Advantage", None, False, True)}{pbtn("Disadvantage", None, False, True)}</div>'
             f'{pbtn("Done", f("Sheet"))}')
    return page("Roll result", sheet_bg() + overlay(inner, f("Sheet")))


# ---------------------------------------------------------------- 8. weapon card
def weapon():
    stat = lambda v, l: (f'<div style="flex-grow: 1; {CARD}; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 2px">'
                         f'<span style="font-size: 22px; font-weight: 800">{v}</span><span style="font-size: 12px; color: {C["muted"]}">{l}</span></div>')
    inner = (f'<div style="display: flex; align-items: center; gap: 10px"><span style="width: 44px; height: 44px; border-radius: 12px; background: {C["soft"]}; '
             f'display: flex; align-items: center; justify-content: center">{icon("sword", 22)}</span><span style="flex-grow: 1; display: flex; flex-direction: column">'
             f'<span style="font-size: 22px; font-weight: 800">Greatsword</span><span style="font-size: 13px; color: {C["muted"]}">Weapon · proficient</span></span>'
             f'{badge("2024")}</div>'
             f'<div style="display: flex; gap: 8px">{stat("+5", "to hit")}{stat("2d6+3", "slashing")}{stat("Graze", "mastery")}</div>'
             f'<div style="display: flex; gap: 8px">{pbtn("Attack", f("Roll"), True, True, "d20")}{pbtn("Damage", f("Roll"), False, True)}</div>'
             f'<button style="height: 44px; border: 0; background: transparent; font-weight: 600; color: {C["muted"]}">Details and editing</button>')
    return page("Weapon card", sheet_bg() + overlay(inner, f("Sheet")))


# ---------------------------------------------------------------- 9. rest
def rest():
    def opt(ic, t, lines, primary):
        ls = "".join(f'<li style="margin: 2px 0">{x}</li>' for x in lines)
        return (f'<div style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">'
                f'<div style="display: flex; align-items: center; gap: 10px">{icon(ic, 22)}<b style="flex-grow: 1; font-size: 17px">{t}</b></div>'
                f'<ul style="margin: 0; padding-left: 20px; font-size: 14px; color: {C["muted"]}">{ls}</ul>'
                f'{pbtn(t, f("Sheet"), primary)}</div>')
    inner = (f'<span style="font-size: 22px; font-weight: 800">Rest</span>'
             + opt("clock", "Short rest", ["Second Wind: 1 use back", "Spend hit dice to heal"], False)
             + opt("moon", "Long rest", ["Hit points back to 12", "Second Wind back to 2 of 2", "Hit dice back"], True)
             + f'<button style="height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; background: transparent; '
               f'color: {C["muted"]}; font-weight: 600">{icon("sun", 20)}Dawn: items that recharge at dawn</button>')
    return page("Rest", sheet_bg() + overlay(inner, f("Sheet")))


# ---------------------------------------------------------------- 10. actions (⋯ and swipe "More")
def actions():
    rows = [("copy", "Copy", ""), ("link", "Link for DM", "Share with your DM's table"), ("send", "Transfer", "Move to another device"),
            ("file", "Export file", ""), ("user", "About", "background, alignment, languages"), ("trash", "Delete", "Undo stays available for a moment")]
    items = "".join(
        f'<button style="width: 100%; min-height: 52px; display: flex; align-items: center; gap: 14px; padding: 4px; border: 0; border-bottom: 1px solid {C["line"]}; '
        f'background: transparent; color: {C["danger"] if t == "Delete" else C["text"]}; text-align: left">{icon(ic, 22)}'
        f'<span style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-weight: 600">{t}</span>'
        + (f'<span style="font-size: 13px; color: {C["muted"]}">{s}</span>' if s else "") + '</span></button>' for ic, t, s in rows)
    inner = f'<span style="font-size: 20px; font-weight: 800">Iren · Actions</span>{items}'
    return page("Actions", sheet_bg() + overlay(inner, f("Sheet")))


# ---------------------------------------------------------------- 11. library
def library():
    cats = ["Species", "Classes", "Backgrounds", "Feats", "Spells", "Armor", "Weapons", "Items", "Monsters", "Conditions"]
    chips = "".join(
        f'<span style="flex-shrink: 0; height: 34px; padding: 0 14px; border-radius: 17px; display: flex; align-items: center; '
        f'{"background: " + C["strong"] + "; color: " + C["onStrong"] + "; font-weight: 600" if c == "Armor" else "background: " + C["soft"] + "; color: " + C["muted"]}">{c}</span>'
        for c in cats)
    groups = [("Light", [("Padded Armor", "11 + Dex", "Stealth disadvantage"), ("Leather Armor", "11 + Dex", ""), ("Studded Leather Armor", "12 + Dex", "")]),
              ("Medium", [("Hide Armor", "12 + Dex (max 2)", ""), ("Chain Shirt", "13 + Dex (max 2)", "")]),
              ("Heavy", [("Chain Mail", "16", "Iren wears this")])]
    out = ""
    for g, items in groups:
        out += f'<div style="margin: 10px 0 2px">{label(g)}</div>'
        for n, ac, note in items:
            nt = f' · {note}' if note else ""
            out += (f'<div style="min-height: 52px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid {C["line"]}">'
                    f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-weight: 600">{n}</span>'
                    f'<span style="font-size: 12px; color: {C["muted"]}">SRD 2024{nt}</span></span><span style="font-weight: 600">AC {ac}</span></div>')
    search = (f'<div style="position: absolute; left: 16px; right: 16px; bottom: 24px; height: 52px; border-radius: 26px; background: {C["surface"]}; '
              f'border: 1px solid {C["line"]}; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15); display: flex; align-items: center; gap: 10px; padding: 0 6px 0 16px">'
              f'{icon("search", 20, C["muted"])}<span style="flex-grow: 1; color: {C["muted"]}">Search armor</span>'
              f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; '
              f'align-items: center; justify-content: center">{icon("sliders", 18)}</span></div>')
    body = (f'{topbar("Rulebooks", f("Hub"), badge("2024") + "<span style=&quot;width: 12px&quot;></span>")}'
            f'<div style="display: flex; gap: 6px; overflow: hidden; padding: 0 16px 8px">{chips}</div>'
            f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px">'
            f'<p style="margin: 4px 0 0; font-size: 12px; color: {C["muted"]}">Sample list. Real entries come from the SRD import.</p>{out}</main>{search}')
    return page("Rulebooks", body.replace("&quot;", '"'))


# ---------------------------------------------------------------- 12. dice
def dice():
    b = (f"width: 44px; height: 44px; border-radius: 12px; border: 1px solid {C['line']}; background: {C['surface']}; "
         f"display: flex; align-items: center; justify-content: center; padding: 0")
    rows = "".join(
        f'<div style="height: 54px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid {C["line"]}">'
        f'<span style="flex-grow: 1; font-size: 18px; font-weight: 700">{d}</span>'
        f'<button aria-label="Fewer {d}" style="{b}">{icon("minus", 20)}</button><span style="width: 30px; text-align: center; font-size: 20px; '
        f'font-weight: 700">{n}</span><button aria-label="More {d}" style="{b}">{icon("plus", 20)}</button></div>'
        for d, n in [("d4", 0), ("d6", 2), ("d8", 0), ("d10", 0), ("d12", 0), ("d20", 0), ("d100", 0)])
    body = (f'{topbar("Dice", f("Hub"), "<span style=&quot;height: 32px; padding: 0 12px; margin-right: 8px; border-radius: 16px; border: 1px solid " + C["muted"] + "; display: flex; align-items: center; font-size: 13px; color: " + C["muted"] + "&quot;>Skins ★</span>")}'
            f'<div style="margin: 0 16px; {CARD}; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between">'
            f'<span style="display: flex; flex-direction: column"><span style="font-size: 15px; color: {C["muted"]}">2d6 + 3 → (4, 5) + 3</span>'
            f'<span style="font-size: 12px; color: {C["muted"]}">last roll · sample</span></span><span style="font-size: 44px; font-weight: 800">12</span></div>'
            f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 8px 16px">{rows}'
            f'<div style="height: 54px; display: flex; align-items: center; gap: 10px"><span style="flex-grow: 1; font-size: 18px; font-weight: 700">Modifier</span>'
            f'<button aria-label="Lower" style="{b}">{icon("minus", 20)}</button><span style="width: 30px; text-align: center; font-size: 20px; font-weight: 700">+3</span>'
            f'<button aria-label="Raise" style="{b}">{icon("plus", 20)}</button></div></main>'
            f'<div style="flex-shrink: 0; padding: 10px 16px 20px; background: {C["surface"]}; border-top: 1px solid {C["line"]}">{pbtn("Roll 2d6 + 3", None, True, False, "d20")}</div>')
    return page("Dice", body.replace("&quot;", '"'))


SCREENS = [("Start", "1 · Start: system, then Player or DM", start, 0, 0),
           ("Hub", "2 · Player hub (round menu, labelled)", hub, 1, 0),
           ("Characters", "3 · My characters (+ in the corner)", characters, 2, 0),
           ("Sheet", "4 · Sheet (one scroll, HP and sections at the bottom)", sheet, 3, 0),
           ("Features", "5 · Features (try Use)", features, 4, 0),
           ("Edit", "6 · Edit mode", edit, 5, 0),
           ("Roll", "Roll result", roll, 3, 1),
           ("Weapon", "Weapon card", weapon, 4, 1),
           ("Rest", "Rest", rest, 5, 1),
           ("Actions", "Actions (⋯ or swipe More)", actions, 2, 1),
           ("Library", "Rulebooks", library, 0, 1),
           ("Dice", "Dice", dice, 1, 1)]


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    pages = canvas.get("pages") or []
    if not any(p["id"] == "reference" for p in pages):
        pages.append({"id": "reference", "name": "Reference, improved"})
    canvas["pages"] = pages
    canvas["launch"] = {"view": "canvas", "page": "reference"}
    canvas["notes"]["ref-1"] = {"x": 0, "y": 0, "text": "Your reference app's structure, redrawn: press Play and tap through",
                                "kind": "title1", "maxW": 2560, "page": "reference"}
    canvas["notes"]["ref-2"] = {"x": 0, "y": 1180, "text": "Opened from the hub and the sheet", "kind": "title1",
                                "maxW": 2560, "page": "reference"}
    for name, title, fn, col, row in SCREENS:
        fname = f(name)
        with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as fh:
            fh.write(fn())
        canvas["boards"][fname] = {"x": col * 440, "y": 260 + row * 1180, "w": W, "h": H, "title": title,
                                   "page": "reference", "is_interactive": True}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    print("pages:", [p["id"] for p in canvas["pages"]], "boards:", len(canvas["boards"]))


if __name__ == "__main__":
    run(sys.argv[1])
