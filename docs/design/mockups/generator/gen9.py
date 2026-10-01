"""Our design v3: ADR 010 on top of v2. Page 'Our design v3'."""
import json
import os
import sys

from gen import ICONS, MOD, PASSIVE, ROOT, sg
import gen6
import gen7
import gen8
from gen5 import C, CARD, LINK, W, H, pbtn
from gen4 import badge, hp_bar, icon, label
from gen7 import SERIF, serif, page, topbar
from gen8 import token, stars, star8

gen6.P = "V3-"
f = gen6.f

ICONS.update({
    "up": '<path d="M12 19V5M6 11l6-6 6 6"></path>',
    "bookmark": '<path d="M6 3h12v18l-6-4-6 4z"></path>',
    "zap": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"></path>',
    "back2": '<path d="M9 14 4 9l5-5"></path><path d="M4 9h11a5 5 0 0 1 0 10h-3"></path>',
})


def chip(text, on=False, small=False):
    h = 30 if small else 34
    look = (f"background: {C['strong']}; color: {C['onStrong']}; font-weight: 600" if on else f"background: {C['soft']}; color: {C['muted']}")
    return (f'<span style="flex-shrink: 0; height: {h}px; padding: 0 12px; border-radius: {h // 2}px; display: flex; align-items: center; '
            f'font-size: 13px; {look}">{text}</span>')


# ---------------------------------------------------------------- sheet frame v3: level chip, Turn tab
def header(name="Iren", sub="Fighter 1", stats=None, letter="I", level="1"):
    stats = stats or [("17", "AC"), ("+3", "Init"), ("30 ft", "Speed"), ("+2", "Prof"), (str(PASSIVE), "Passive")]
    cells = "".join(
        f'<a href="{f("Roll")}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; {LINK}">'
        f'<span style="font-size: 18px; font-weight: 700; line-height: 22px">{v}</span><span style="font-size: 11px; color: {C["muted"]}">{l}</span></a>'
        for v, l in stats)
    lvl = (f'<a href="{f("LevelUp")}" aria-label="Level up" style="height: 22px; padding: 0 8px; border-radius: 11px; border: 1px solid {C["strong"]}; '
           f'display: flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 700; {LINK}">Lv {level}{icon("up", 12)}</a>')
    return (f'<header style="flex-shrink: 0; background: {C["surface"]}; border-bottom: 1px solid {C["line"]}">'
            f'<div style="height: 64px; display: flex; align-items: center; gap: 2px; padding: 0 2px">'
            f'{gen6.ibtn_link(f("Characters"), "back", "Back to my characters")}'
            f'<a href="{f("Token")}" aria-label="Portrait and token" style="margin: 0 10px 0 2px; {LINK}">{token(42, letter)}</a>'
            f'<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">'
            f'<span style="display: flex; align-items: baseline; gap: 6px">{serif(22, name)}<span style="font-size: 12px; color: {C["muted"]}; '
            f'white-space: nowrap">{sub}</span></span><span style="display: flex; align-items: center; gap: 8px">{stars(2, 3, 18)}</span></div>'
            f'{gen6.ibtn_link(f("Rest"), "moon", "Rest")}{gen6.ibtn_link(f("Add"), "pen", "Edit mode")}'
            f'{gen6.ibtn_link(f("Actions"), "more", "Actions")}</div>'
            f'<div style="height: 50px; display: grid; grid-template-columns: repeat({len(stats)}, minmax(0, 1fr)); border-top: 1px solid {C["line"]}">{cells}</div>'
            f'</header>')


TABS = ["Main", "Turn", "Combat", "Spells", "Gear", "Features", "About", "Notes"]


def dock(active, hp="12", hpmax="12", spells_href=None):
    out = ""
    for t in TABS:
        on = t == active
        href = {"Main": f("Sheet"), "Turn": f("Turn"), "Features": f("Features"), "About": f("About"), "Spells": spells_href}.get(t)
        look = (f"border-bottom: 2px solid {C['text']}; color: {C['text']}; font-weight: 700" if on
                else f"border-bottom: 2px solid transparent; color: {C['muted']}")
        st = (f'style="flex-shrink: 0; height: 48px; box-sizing: border-box; padding: 0 10px; border: 0; {look}; background: transparent; '
              f'white-space: nowrap; display: flex; align-items: center; text-decoration: none"')
        out += f'<a href="{href}" {st}>{t}</a>' if href and not on else f'<button {st}>{t}</button>'
    btn = lambda t, primary: (f'<a href="{f("Keypad")}" style="height: 44px; padding: 0 14px; border-radius: 12px; display: flex; align-items: center; '
                              f'font-weight: 600; text-decoration: none; '
                              + (f'background: {C["strong"]}; color: {C["onStrong"]}' if primary else f'border: 1px solid {C["muted"]}; color: {C["text"]}')
                              + f'">{t}</a>')
    hp_row = (f'<div style="height: 64px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 16px">'
              f'<div style="flex-grow: 1; min-width: 0"><div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px">'
              f'<span style="font-size: 12px; color: {C["muted"]}; text-transform: uppercase; letter-spacing: 0.06em">Hit points</span>'
              f'<span style="font-size: 18px; font-weight: 700">{hp} <span style="font-size: 13px; font-weight: 500; color: {C["muted"]}">/ {hpmax}</span></span></div>'
              f'<div style="display: flex">{hp_bar(8)}</div></div>{btn("Damage", True)}{btn("Heal", False)}</div>')
    return (f'<div style="flex-shrink: 0; background: {C["surface"]}; border-top: 1px solid {C["line"]}; box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05)">'
            f'{hp_row}<div style="display: flex; overflow: hidden; padding: 0 6px; border-top: 1px solid {C["line"]}">{out}</div></div>')


gen8.header = header
gen8.dock = dock
gen6.sheet_header = lambda: header()
gen6.sheet_dock = lambda active: dock("Main")


def sheet():
    return page("Sheet", header() + gen6.sheet_main_content() + dock("Main") + gen8.dice_fab())


def half(inner, close_href, height=430):
    return (f'<a href="{close_href}" aria-label="Close" style="position: absolute; left: 0; right: 0; top: 0; height: {800 - height}px; '
            f'background: rgba(20, 20, 22, 0.25)"></a>'
            f'<section style="position: absolute; left: 0; right: 0; bottom: 0; height: {height}px; box-sizing: border-box; padding: 8px 16px 16px; '
            f'background: {C["surface"]}; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; gap: 10px">'
            f'<div style="width: 40px; height: 4px; border-radius: 2px; background: {C["line"]}; align-self: center"></div>{inner}</section>')


def under():
    return header() + gen6.sheet_main_content() + dock("Main")


# ---------------------------------------------------------------- the Turn tab
def turn():
    def grp(title, rows):
        return (f'<section><div style="margin-bottom: 6px">{label(title)}</div><div style="{CARD}; overflow: hidden">{rows}</div></section>')

    def row(name, sub, right="", first=False):
        return (f'<div style="min-height: 50px; display: flex; align-items: center; gap: 10px; padding: 6px 14px; '
                f'border-top: {"0" if first else "1px solid " + C["line"]}"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px">'
                f'<b>{name}</b><span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span>{right}</div>')
    uses = "".join(f'<span style="width: 14px; height: 14px; box-sizing: border-box; border-radius: 50%; border: 2px solid {C["strong"]}; '
                   f'background: {C["strong"]}"></span>' for _ in range(2))
    content = (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px">'
               f'<div style="display: flex; align-items: baseline; gap: 8px">{serif(22, "On your turn")}'
               f'<span style="font-size: 12px; color: {C["muted"]}">a reminder, from your features</span></div>'
               + grp("Action", row("Attack: Greatsword", "+5 to hit · 2d6+3 slashing · Graze", "", True))
               + grp("Bonus action", row("Second Wind", "Fighter · 1 back on a short rest, all on a long rest", f'<span style="display: flex; gap: 4px">{uses}</span>', True))
               + grp("Once per turn", row("Savage Attacker", "Soldier's feat · when you roll weapon damage", "", True))
               + grp("Always on", row("Alert", "Initiative +2", "", True) + row("Defense", "AC +1"))
               + "</main>")
    return page("Turn tab", header() + content + dock("Turn") + gen8.dice_fab())


# ---------------------------------------------------------------- dice panel v3: any count, custom dice, edit mode
def sheet_dice():
    kinds = "".join(chip(d, d == "d6", True) for d in ["d4", "d6", "d8", "d10", "d12", "d20", "d100"])
    custom = chip("d3", False, True) + chip("d7", False, True)
    b = (f"width: 44px; height: 44px; border-radius: 12px; border: 1px solid {C['line']}; background: {C['surface']}; "
         f"display: flex; align-items: center; justify-content: center; padding: 0")
    inner = (f'<div style="display: flex; align-items: center; justify-content: space-between">{serif(22, "Dice")}'
             f'<span style="height: 32px; padding: 0 12px; border-radius: 16px; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; '
             f'align-items: center; gap: 6px; font-size: 13px; font-weight: 600">{icon("pen", 14)}Edit dice</span></div>'
             f'<div style="display: flex; flex-wrap: wrap; gap: 6px">{kinds}</div>'
             f'<div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center"><span style="font-size: 12px; color: {C["muted"]}">Custom:</span>{custom}'
             f'<span style="height: 30px; padding: 0 12px; border-radius: 15px; border: 1px dashed {C["muted"]}; display: flex; align-items: center; '
             f'font-size: 13px; color: {C["muted"]}">+ New die · faces: 7</span></div>'
             f'<div style="display: flex; align-items: center; gap: 10px"><span style="font-weight: 700">How many</span>'
             f'<button aria-label="Fewer" style="{b}">{icon("minus", 20)}</button>'
             f'<input aria-label="Number of dice" value="37" style="width: 64px; height: 44px; box-sizing: border-box; text-align: center; font-size: 20px; '
             f'font-weight: 800; border: 1px solid {C["muted"]}; border-radius: 12px; background: transparent; color: {C["text"]}">'
             f'<button aria-label="More" style="{b}">{icon("plus", 20)}</button><span style="font-size: 20px; font-weight: 800">× d6</span></div>'
             f'<div style="display: flex; gap: 8px; align-items: center"><span style="flex-grow: 1; height: 44px; box-sizing: border-box; border-radius: 12px; '
             f'border: 2px dashed {C["line"]}; display: flex; align-items: center; padding: 0 12px; font-weight: 700">37d6 + 3</span>'
             f'<button style="height: 44px; padding: 0 12px; border: 1px solid {C["muted"]}; border-radius: 12px; background: transparent; font-weight: 600">+ Modifier</button></div>'
             f'{pbtn("Roll 37d6 + 3", f("Roll"), True, False, "d20")}')
    return page("Dice on the sheet", under() + half(inner, f("Sheet")))


# ---------------------------------------------------------------- damage / heal number pad
def keypad():
    seg = "".join(f'<span style="flex-grow: 1; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 9px; '
                  + (f'background: {C["surface"]}; font-weight: 700; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12)' if t == "Damage" else f'color: {C["muted"]}')
                  + f'">{t}</span>' for t in ["Damage", "Heal", "Temp HP"])
    keys = "".join(f'<button style="height: 52px; {CARD}; font-size: 22px; font-weight: 700">{k}</button>'
                   for k in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"])
    inner = (f'<div style="display: flex; padding: 3px; border-radius: 12px; background: {C["soft"]}">{seg}</div>'
             f'<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px">'
             f'<span style="color: {C["muted"]}">12 → 5</span><span style="font-size: 44px; font-weight: 800; line-height: 1">7</span></div>'
             f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{keys}</div>'
             f'{pbtn("Apply 7 damage", f("Sheet"))}')
    return page("Damage and heal pad", under() + half(inner, f("Sheet"), 470))


# ---------------------------------------------------------------- level up
def level_up():
    toggle = (f'<div style="display: flex; padding: 3px; border-radius: 12px; background: {C["soft"]}">'
              f'<span style="flex-grow: 1; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 9px; '
              f'background: {C["surface"]}; font-weight: 700; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12)">Experience points</span>'
              f'<span style="flex-grow: 1; height: 38px; display: flex; align-items: center; justify-content: center; color: {C["muted"]}">Milestone</span></div>')
    inner = (f'<div style="display: flex; align-items: baseline; justify-content: space-between">{serif(24, "Level 1 → 2")}'
             f'<span style="font-size: 12px; color: {C["muted"]}">sample XP</span></div>{toggle}'
             f'<div style="display: flex; justify-content: space-between; font-size: 14px"><span>300 / 300 XP</span><span style="color: {C["muted"]}">ready</span></div>'
             f'<div style="display: flex">{hp_bar(10, C["strong"])}</div>'
             f'<div style="display: flex; gap: 8px">{pbtn("+ XP", None, False, True)}{pbtn("Set XP", None, False, True)}</div>'
             f'{pbtn("Level up", f("Sheet"), True, False, "up")}'
             f'<div style="font-size: 13px; color: {C["muted"]}; padding: 10px 12px; border-radius: 10px; background: {C["soft"]}">'
             f'In a campaign the DM decides: your level-up waits for approval, or only the DM levels characters.</div>')
    return page("Level up", under() + half(inner, f("Sheet"), 440))


# ---------------------------------------------------------------- spells v3: slot grid, granted spell, cast dialog
MIRA_STATS = [("12", "AC"), ("+2", "Init"), ("13", "Spell DC"), ("+5", "Spell atk"), ("+2", "Prof")]


def slot_grid():
    cols = [("Level 1", 4, 1), ("Level 2", 2, 0), ("Level 3", 1, 0)]
    out = ""
    for name, n, used in cols:
        circles = "".join(f'<span style="width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; border: 2px solid {C["strong"]}; '
                          f'background: {"transparent" if i < used else C["strong"]}"></span>' for i in range(n))
        out += (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="font-size: 12px; font-weight: 700">{name}</span>'
                f'<div style="display: grid; grid-template-columns: repeat(2, 20px); gap: 6px">{circles}</div></div>')
    return (f'<div style="{CARD}; padding: 12px 14px; display: flex; justify-content: space-around; align-items: flex-start">{out}</div>')


def spells():
    sp = "".join(
        f'<a href="{f("Cast")}" style="min-height: 50px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid {C["line"]}; {LINK}">'
        f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><b>{n}</b><span style="font-size: 12px; color: {C["muted"]}">{sub}</span></span>'
        f'{badge(src)}</a>'
        for n, sub, src in [("Magic Missile", "Level 1", "2024"), ("Shield", "Level 1", "2024"), ("Misty Step", "Level 2", "2024")])
    granted = (f'<div style="min-height: 56px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid {C["line"]}">'
               f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><b>Speak with Animals</b>'
               f'<span style="font-size: 12px; color: {C["muted"]}">from Stormcoast Additions (sample pack) · <b>no spell slot · 1/LR</b></span></span>'
               f'{badge("Pack")}</div>')
    content = (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px">'
               f'<div style="display: flex; gap: 8px">{chip("INT", True)}{chip("Save DC 13")}{chip("Attack +5")}'
               f'<span style="font-size: 12px; color: {C["muted"]}; align-self: center">sample</span></div>'
               f'{slot_grid()}<span style="font-size: 12px; color: {C["muted"]}">Level 3: one slot from a magic item (sample)</span>'
               f'<div>{sp}{granted}</div></main>')
    return page("Spells v3", header("Mira", "Wizard 3", MIRA_STATS, "M", "3") + content + dock("Spells", "18", "18", f("Spells")))


def cast():
    lv = "".join(chip(f"Level {i}", i == 1) for i in (1, 2, 3))
    check = (f'<label style="display: flex; align-items: center; gap: 12px; min-height: 44px"><span style="width: 24px; height: 24px; box-sizing: border-box; '
             f'border-radius: 6px; border: 2px solid {C["strong"]}"></span><span style="display: flex; flex-direction: column"><b>Don\'t use a spell slot</b>'
             f'<span style="font-size: 13px; color: {C["muted"]}">for a free cast from a feature or an item</span></span></label>')
    inner = (f'<div style="display: flex; align-items: baseline; justify-content: space-between">{serif(24, "Magic Missile")}{badge("2024")}</div>'
             f'<div style="font-size: 13px; color: {C["muted"]}">Level 1 · Evocation · slots left: level 1 3 of 4</div>'
             f'<div>{label("Slot level")}</div><div style="display: flex; gap: 6px">{lv}</div>{check}'
             f'<div style="display: flex; gap: 8px">{pbtn("Cast", f("Spells"), True, True)}{pbtn("Damage", f("Roll"), False, True)}</div>')
    under_ = header("Mira", "Wizard 3", MIRA_STATS, "M", "3") + gen6.sheet_main_content() + dock("Spells", "18", "18", f("Spells"))
    return page("Cast a spell", under_ + half(inner, f("Spells"), 360))


# ---------------------------------------------------------------- player page v3
def player():
    menu = (f'<div style="position: absolute; right: 24px; top: 196px; width: 230px; {CARD}; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2); z-index: 2; overflow: hidden">'
            + "".join(f'<div style="height: 46px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-top: 1px solid {C["line"]}">{icon(i, 18)}{t}</div>'
                      for i, t in [("import", "Import a pack file"), ("book", "Downloaded packs"), ("pen", "Create a new pack")]) + "</div>")
    books = "".join(
        f'<div style="height: 46px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-top: 1px solid {C["line"]}">'
        f'{icon(ic, 18, C["muted"])}<span style="flex-grow: 1"><b>{n}</b> <span style="font-size: 12px; color: {C["muted"]}">{s}</span></span>'
        f'<span style="width: 40px; height: 24px; border-radius: 12px; background: {C["strong"]}; position: relative"><span style="position: absolute; top: 3px; '
        f'left: 19px; width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF"></span></span></div>'
        for ic, n, s in [("book", "SRD 2024", "rules"), ("book", "SRD 2014", "rules"), ("pen", "Stormcoast Additions", "sample pack")])
    topics = "".join(chip(t, False, True) for t in ["Armor", "Backgrounds", "Classes", "Encounters", "Feats", "Items", "Monsters", "Species", "Spells", "Weapons"])
    tool = lambda ic, t, href=None: (f'<{"a href=" + chr(34) + href + chr(34) if href else "div"} style="flex-grow: 1; flex-basis: 0; height: 64px; {CARD}; '
                                     f'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 13px; font-weight: 600; {LINK}">'
                                     f'{icon(ic, 20)}{t}</{"a" if href else "div"}>')
    body = (topbar("Player", f("Start"), gen6.ibtn("sliders", "Settings"))
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; position: relative">'
            f'<a href="{f("Characters")}" style="height: 56px; {CARD}; padding: 0 14px; display: flex; align-items: center; gap: 12px; {LINK}">'
            f'{token(32, "I")}<span style="flex-grow: 1"><b>My characters</b> <span style="font-size: 12px; color: {C["muted"]}">2 of 3</span></span>{icon("chev", 18, C["muted"])}</a>'
            f'<section style="{CARD}; overflow: hidden"><div style="height: 44px; display: flex; align-items: center; padding: 0 4px 0 14px">'
            f'{serif(19, "Books in use", "; flex-grow: 1")}<a href="{f("Sources")}" style="font-size: 13px; font-weight: 600; margin-right: 4px; {LINK}">All sources</a>'
            f'<span style="width: 40px; height: 40px; border-radius: 10px; background: {C["soft"]}; display: flex; align-items: center; justify-content: center">{icon("more", 20)}</span></div>'
            f'{books}</section>'
            f'<a href="{f("Library")}" style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; {LINK}">'
            f'<span style="display: flex; align-items: center">{serif(19, "Library", "; flex-grow: 1")}{icon("chev", 18, C["muted"])}</span>'
            f'<span style="display: flex; flex-wrap: wrap; gap: 6px">{topics}</span></a>'
            f'<div>{label("Handy")}</div><div style="display: flex; gap: 8px">{tool("d20", "Dice", f("Dice"))}{tool("bookmark", "Bookmarks")}{tool("zap", "Quick rules")}</div>'
            f'{menu}</main>')
    return page("Player v3", body)


def sources():
    rows = [("book", "SRD 2024", "System Reference Document 5.2.1 · CC-BY-4.0", "built-in", True),
            ("book", "SRD 2014", "System Reference Document 5.1 · CC-BY-4.0", "built-in", True),
            ("pen", "Stormcoast Additions", "my pack · personal · sample", "local", True),
            ("import", "Tavern Games", "downloaded · sample", "community", False)]
    items = "".join(
        f'<div style="min-height: 64px; display: flex; align-items: center; gap: 12px; padding: 6px 14px; border-top: 1px solid {C["line"]}">'
        f'{icon(ic, 20, C["muted"])}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><b>{n}</b>'
        f'<span style="font-size: 12px; color: {C["muted"]}">{s}</span></span>{badge(kind)}'
        f'<span style="width: 40px; height: 24px; border-radius: 12px; background: {C["strong"] if on else C["line"]}; position: relative; flex-shrink: 0">'
        f'<span style="position: absolute; top: 3px; left: {19 if on else 3}px; width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF"></span></span></div>'
        for ic, n, s, kind, on in rows)
    body = (topbar("All sources", f("Player"))
            + f'<main style="flex-grow: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<p style="margin: 0; font-size: 13px; color: {C["muted"]}">Every book and pack on this device. Built-in, local and community stay in their own groups.</p>'
            f'<section style="{CARD}; overflow: hidden">{items}</section>'
            f'<div style="display: flex; gap: 8px">{pbtn("Import a file", None, False, True, "import")}{pbtn("New pack", None, True, True, "plus")}</div></main>')
    return page("All sources", body)


def library():
    topics = "".join(chip(t, t == "Spells", True) for t in ["Armor", "Backgrounds", "Classes", "Encounter templates", "Feats", "Items", "Monsters", "Species", "Spells", "Weapons"])
    rows = "".join(
        f'<a href="{f("Entry")}" style="min-height: 52px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid {C["line"]}; {LINK}">'
        f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><b>{n}</b><span style="font-size: 12px; color: {C["muted"]}">{sub}</span></span>'
        f'{badge(src)}</a>'
        for n, sub, src in [("Bless", "Level 1 · Enchantment", "2024"), ("Bless", "Level 1 · Enchantment", "2014"), ("Fire Bolt", "Cantrip · Evocation", "2024"),
                            ("Magic Missile", "Level 1 · Evocation", "2024"), ("Stormcall", "Level 2 · Evocation", "Pack")])
    body = (topbar("Library", f("Player"))
            + f'<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; flex-wrap: wrap; gap: 6px">{topics}</div>'
            f'<label style="height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 12px; background: {C["soft"]}; '
            f'color: {C["muted"]}">{icon("search", 18)}<input aria-label="Search spells" placeholder="Search spells" style="flex-grow: 1; min-width: 0; border: 0; '
            f'background: transparent; font-size: 16px; outline: none"></label>'
            f'<p style="margin: 0; font-size: 12px; color: {C["muted"]}">Sample list. The same spell from two books shows twice, each with its source.</p></div>'
            f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 4px 16px">{rows}</main>')
    return page("Library", body)


def entry():
    fields = "".join(
        f'<div style="display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid {C["line"]}"><span style="width: 118px; flex-shrink: 0; '
        f'font-size: 13px; color: {C["muted"]}">{k}</span><span>{v}</span></div>'
        for k, v in [("Level", "1 · Enchantment"), ("Casting time", "[from the SRD]"), ("Range", "[from the SRD]"), ("Components", "[from the SRD]"),
                     ("Duration", "[from the SRD]"), ("Classes", "[from the SRD]")])
    body = (topbar("Bless", f("Library"), badge("2024") + '<span style="width: 12px"></span>')
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="padding: 10px 12px; border-radius: 10px; background: {C["soft"]}; font-size: 13px"><b>Source:</b> SRD 5.2.1 · CC-BY-4.0 · '
            f'Wizards of the Coast LLC <span style="color: {C["muted"]}">(attribution as the license asks)</span></div>'
            f'<div>{fields}</div>'
            f'<div style="font-size: 15px; line-height: 23px">[The full spell text from the SRD, with tappable links to conditions and other entries.]</div>'
            f'<div style="font-size: 15px; line-height: 23px; color: {C["muted"]}"><b>At higher levels.</b> [From the SRD.]</div>'
            f'<div style="display: flex; gap: 8px; margin-top: auto; padding-bottom: 16px">{pbtn("Add to character", None, True, True)}{pbtn("Homebrew copy", None, False, True)}</div>'
            f'</main>')
    return page("Entry", body)


# ---------------------------------------------------------------- creation v3: steps open and close; score methods
def create():
    def step(t, sub, open_=False, details=""):
        arrow = icon("up" if open_ else "chev", 18, C["muted"]) if open_ else f'<span style="display: inline-flex; transform: rotate(90deg)">{icon("chev", 18, C["muted"])}</span>'
        body = (f'<div style="padding: 0 14px 12px 50px; font-size: 14px; display: flex; flex-direction: column; gap: 4px">{details}</div>' if open_ else "")
        return (f'<section style="{CARD}; overflow: hidden"><div style="min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 6px 8px 6px 14px">'
                f'<span style="width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; '
                f'align-items: center; justify-content: center">{icon("check", 14)}</span><span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">'
                f'<b>{t}</b><span style="font-size: 12px; color: {C["muted"]}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span></span>'
                f'<span style="font-size: 13px; font-weight: 600">Change</span><span style="width: 36px; height: 36px; display: flex; align-items: center; '
                f'justify-content: center">{arrow}</span></div>{body}</section>')
    ab = (f'<span>Method: <b>Standard array</b> <a href="{f("Methods")}" style="font-weight: 600; {LINK}">· other methods</a></span>'
          f'<span style="color: {C["muted"]}">15 13 14 8 12 10 → STR DEX CON INT WIS CHA</span>'
          f'<span style="color: {C["muted"]}">Soldier: STR +2, CON +1 → 17 13 15 8 12 10</span>')
    sp = (f'<span>Human · 2024</span><span style="color: {C["muted"]}">Skill: Insight · Origin feat: Alert</span>')
    body = (topbar("New character", f("Characters"), f'<span style="font-size: 13px; color: {C["muted"]}; margin-right: 14px">Saved</span>')
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 8px">'
            + step("Rules", "2024 rules · SRD 2024")
            + step("Species", "Human", True, sp)
            + step("Class", "Fighter 1 · Defense")
            + step("Background", "Soldier")
            + step("Abilities", "17 13 15 8 12 10", True, ab)
            + step("Equipment", "Chain mail, greatsword")
            + "</main>"
            + f'<div style="padding: 10px 16px 16px; border-top: 1px solid {C["line"]}; background: {C["surface"]}">{pbtn("Open the sheet", f("Sheet"))}</div>')
    return page("New character v3", body)


METHOD_NAME = "Reroll-a-1 4d6"


def methods():
    def opt(t, sub, on=False):
        return (f'<div style="min-height: 52px; display: flex; align-items: center; gap: 12px; padding: 4px 14px; border-top: 1px solid {C["line"]}">'
                f'<span style="width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; border: 2px solid {C["strong"]}; display: flex; '
                f'align-items: center; justify-content: center">' + (f'<span style="width: 10px; height: 10px; border-radius: 50%; background: {C["strong"]}"></span>' if on else "")
                + f'</span><span style="flex-grow: 1; display: flex; flex-direction: column"><b>{t}</b><span style="font-size: 12px; color: {C["muted"]}">{sub}</span></span></div>')
    rule = lambda k, v: (f'<div style="display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid {C["line"]}; font-size: 14px">'
                         f'<span style="width: 92px; flex-shrink: 0; color: {C["muted"]}">{k}</span><span>{v}</span></div>')
    die = lambda n, mark="": (f'<span style="width: 34px; height: 34px; border-radius: 8px; border: 2px solid {C["strong"]}; display: flex; align-items: center; '
                              f'justify-content: center; font-weight: 800; {mark}">{n}</span>')
    body = (topbar("Ability scores", f("Create"))
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<section style="{CARD}; overflow: hidden">'
            + opt("Standard array", "15 14 13 12 10 8") + opt("Point buy", "27 points") + opt("4d6, drop the lowest", "for each stat")
            + opt("Reroll-a-1 4d6", "reroll one 1, once, keep it", True) + opt("1d4 + 3d6", "one d4 bonus for all, max 18") + opt("8d20", "drop highest and lowest")
            + f'<div style="height: 44px; display: flex; align-items: center; padding: 0 14px; border-top: 1px solid {C["line"]}; font-weight: 600">+ New method</div></section>'
            f'<section style="{CARD}; padding: 10px 14px">{serif(19, METHOD_NAME)}'
            + rule("Dice", "4d6 for each of the 6 stats") + rule("Reroll", "one die showing 1, once; keep the new result")
            + rule("Drop", "open: the lowest, or none?") + rule("Cap", "none")
            + f'<div style="margin-top: 10px; font-size: 13px; color: {C["muted"]}">Example (sample roll)</div>'
            f'<div style="display: flex; align-items: center; gap: 6px; margin-top: 6px">{die(3)}{die(4)}{die(1, "opacity: 0.4; text-decoration: line-through")}'
            f'{die(1)}<span style="color: {C["muted"]}">→ reroll →</span>{die(5, "background: " + C["soft"])}</div></section>'
            f'</main>')
    return page("Ability score methods", body)


# ---------------------------------------------------------------- DM review v3: grouped changes
def dm_review():
    def card(who, lines):
        ls = "".join(f'<div style="padding: 6px 0; border-top: 1px solid {C["line"]}; font-size: 15px">{x}</div>' for x in lines)
        return (f'<section style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">'
                f'<div style="display: flex; align-items: center; gap: 10px">{token(34, who[0])}<b style="flex-grow: 1; font-size: 17px">{who}</b>'
                f'<span aria-label="Edit" style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center">{icon("pen", 18)}</span></div>'
                f'<div>{ls}</div><div style="font-weight: 700">Approve changes?</div>'
                f'<div style="display: flex; gap: 8px">{pbtn("Yes", None, True, True)}{pbtn("No", None, False, True)}</div></section>')
    body = (topbar("Changes to approve", f("Sheet"), badge("Later") + '<span style="width: 12px"></span>')
            + f'<main style="flex-grow: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 10px">'
            + card("Mira", ["HP 6 → 12", "+24 gold, +12 silver", 'Added spell "Shield"'])
            + f'<div style="height: 48px; {CARD}; display: flex; align-items: center; justify-content: center; font-weight: 600">See all changes (5)</div>'
            + f'<p style="margin: 0; font-size: 12px; color: {C["muted"]}">Sample names and numbers.</p></main>')
    return page("DM review v3", body)


SCREENS = [
    ("Player", "Player: ⋯ on books, All sources, Library, Handy", player, 0, 0),
    ("Sources", "All sources", sources, 1, 0),
    ("Library", "Library: topics on top", library, 2, 0),
    ("Entry", "An entry: all details and its source", entry, 3, 0),
    ("Sheet", "Sheet: Lv chip, Turn tab", sheet, 0, 1),
    ("Turn", "Turn tab: what you can do", turn, 1, 1),
    ("SheetDice", "Dice: any count, custom dice", sheet_dice, 2, 1),
    ("Keypad", "Damage / Heal: type a number", keypad, 3, 1),
    ("LevelUp", "Level up: XP or milestone", level_up, 4, 1),
    ("Spells", "Spells: slot grid, granted spell 1/LR", spells, 5, 1),
    ("Cast", "Cast: Don't use a spell slot", cast, 6, 1),
    ("Create", "New character: steps open and close", create, 0, 2),
    ("Methods", "Ability score methods", methods, 1, 2),
    ("DMReview", "DM: changes reviewed together", dm_review, 2, 2),
    # support screens so every tap stays inside v3
    ("Start", "Support: start", gen7.start, 0, 3), ("Characters", "Support: my characters", gen7.characters, 1, 3),
    ("Dice", "Support: dice page", gen7.dice, 2, 3), ("Roll", "Support: a roll", gen6.roll, 3, 3),
    ("Rest", "Support: rest", gen7.rest, 4, 3), ("Actions", "Support: actions", gen6.actions, 5, 3),
    ("Features", "Support: features", gen8.features, 6, 3), ("About", "Support: about", gen8.about, 0, 4),
    ("Add", "Support: edit mode", gen8.add, 1, 4), ("Stat", "Support: custom stat", gen8.stat, 2, 4),
    ("Token", "Support: portrait", gen8.token_page, 3, 4),
]


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    pages = canvas.get("pages") or []
    if not any(p["id"] == "ours-v3" for p in pages):
        pages.append({"id": "ours-v3", "name": "Our design v3"})
    canvas["pages"] = pages
    canvas["launch"] = {"view": "canvas", "page": "ours-v3"}
    notes = canvas["notes"]
    for i, t in enumerate(["Player page and library (ADR 010)", "The sheet: Turn tab, dice, damage pad, level up, spells",
                           "Making a character, and the DM's review", "Support screens: same as v2, so taps stay in v3", ""]):
        if t:
            notes[f"v3-{i}"] = {"x": 0, "y": i * 1180, "text": t, "kind": "title1", "maxW": 2960, "page": "ours-v3"}
    for name, title, fn, col, row in SCREENS:
        fname = f(name)
        with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as fh:
            fh.write(fn())
        canvas["boards"][fname] = {"x": col * 440, "y": 260 + row * 1180, "w": W, "h": H, "title": title,
                                   "page": "ours-v3", "is_interactive": True}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    print("pages:", [p["id"] for p in canvas["pages"]], "boards:", len(canvas["boards"]))


if __name__ == "__main__":
    run(sys.argv[1])
