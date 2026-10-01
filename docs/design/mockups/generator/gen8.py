"""Our design v2: ADR 009 on top of v1. Page 'Our design v2'."""
import json
import math
import os
import sys

from gen import ABILITIES, ICONS, MOD, PASSIVE, SAVE, SAVE_PROF, ROOT, sg
import gen6
import gen7
from gen5 import C, CARD, LINK, W, H, pbtn
from gen4 import badge, dot, hp_bar, icon, label
from gen7 import SERIF, serif, page, topbar

gen6.P = "V2-"
f = gen6.f

ICONS.update({
    "paw": '<circle cx="7" cy="9" r="2"></circle><circle cx="12" cy="6.5" r="2"></circle><circle cx="17" cy="9" r="2"></circle><path d="M12 12c-3 0-5 3-5 5.5 0 1.5 1 2.5 2.5 2.5 1 0 1.7-.5 2.5-.5s1.5.5 2.5.5c1.5 0 2.5-1 2.5-2.5 0-2.5-2-5.5-5-5.5z"></path>',
    "list": '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"></path>',
    "shield": '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"></path>',
    "fx": '<path d="M4 18c3 0 3-12 6-12M5 11h5"></path><path d="M13 9l6 8M19 9l-6 8"></path>',
    "image": '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M21 16l-5-5-9 9"></path>',
    "flag": '<path d="M5 21V4h11l-2 4 2 4H5"></path>',
    "wand": '<path d="M4 20 15 9"></path><path d="M16 3l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"></path>',
})


def star8(size, filled):
    pts = []
    for i in range(16):
        a = math.radians(-90 + i * 22.5)
        r = 10.5 if i % 2 == 0 else 5.2
        pts.append(f"{12 + r * math.cos(a):.2f},{12 + r * math.sin(a):.2f}")
    fill = C["strong"] if filled else "none"
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" aria-hidden="true" style="flex-shrink: 0">'
            f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{C["strong"]}" style="stroke-width: 1.4; stroke-linejoin: round"></polygon></svg>')


def token(size, letter="I", frame="ring"):
    ring = {"ring": f"box-shadow: 0 0 0 2px {C['surface']}, 0 0 0 4px {C['strong']}",
            "double": f"box-shadow: 0 0 0 2px {C['surface']}, 0 0 0 3px {C['strong']}, 0 0 0 5px {C['surface']}, 0 0 0 6px {C['strong']}",
            "thin": f"box-shadow: 0 0 0 1px {C['muted']}"}[frame]
    return (f'<span style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; '
            f'display: flex; align-items: center; justify-content: center; font-family: {SERIF}; font-weight: 700; font-size: {size // 2}px; {ring}">{letter}</span>')


def stars(n_filled, n=3, size=20):
    return (f'<span aria-label="Inspiration {n_filled} of {n}" style="display: flex; gap: 2px">'
            + "".join(star8(size, i < n_filled) for i in range(n)) + "</span>")


# ---------------------------------------------------------------- sheet frame v2
def header(name="Iren", sub="Fighter 1", stats=None, letter="I", back=None):
    stats = stats or [("17", "AC"), ("+3", "Init"), ("30 ft", "Speed"), ("+2", "Prof"), (str(PASSIVE), "Passive")]
    cells = "".join(
        f'<a href="{f("Roll")}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; {LINK}">'
        f'<span style="font-size: 18px; font-weight: 700; line-height: 22px">{v}</span><span style="font-size: 11px; color: {C["muted"]}">{l}</span></a>'
        for v, l in stats)
    return (f'<header style="flex-shrink: 0; background: {C["surface"]}; border-bottom: 1px solid {C["line"]}">'
            f'<div style="height: 64px; display: flex; align-items: center; gap: 2px; padding: 0 2px">'
            f'{gen6.ibtn_link(back or f("Characters"), "back", "Back to my characters")}'
            f'<a href="{f("Token")}" aria-label="Portrait and token" style="margin: 0 10px 0 2px; {LINK}">{token(42, letter)}</a>'
            f'<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="display: flex; align-items: baseline; gap: 6px">{serif(22, name)}<span style="font-size: 12px; color: {C["muted"]}; '
            f'white-space: nowrap">{sub}</span></span>{stars(2)}</div>'
            f'{gen6.ibtn_link(f("Rest"), "moon", "Rest")}{gen6.ibtn_link(f("Add"), "pen", "Edit mode")}'
            f'{gen6.ibtn_link(f("Actions"), "more", "Actions")}</div>'
            f'<div style="height: 50px; display: grid; grid-template-columns: repeat({len(stats)}, minmax(0, 1fr)); border-top: 1px solid {C["line"]}">{cells}</div>'
            f'</header>')


TABS = ["Main", "Combat", "Spells", "Gear", "Features", "About", "Notes", "Pets"]


def dock(active, hp="12", hpmax="12"):
    out = ""
    for t in TABS:
        on = t == active
        href = {"Main": f("Sheet"), "Features": f("Features"), "About": f("About")}.get(t)
        look = (f"border-bottom: 2px solid {C['text']}; color: {C['text']}; font-weight: 700" if on
                else f"border-bottom: 2px solid transparent; color: {C['muted']}")
        st = (f'style="flex-shrink: 0; height: 48px; box-sizing: border-box; padding: 0 10px; border: 0; {look}; background: transparent; '
              f'white-space: nowrap; display: flex; align-items: center; text-decoration: none"')
        out += f'<a href="{href}" {st}>{t}</a>' if href and not on else f'<button {st}>{t}</button>'
    hp_row = (f'<div style="height: 64px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 16px">'
              f'<div style="flex-grow: 1; min-width: 0"><div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px">'
              f'<span style="font-size: 12px; color: {C["muted"]}; text-transform: uppercase; letter-spacing: 0.06em">Hit points</span>'
              f'<span style="font-size: 18px; font-weight: 700">{hp} <span style="font-size: 13px; font-weight: 500; color: {C["muted"]}">/ {hpmax}</span></span></div>'
              f'<div style="display: flex">{hp_bar(8)}</div></div>'
              f'<button style="height: 44px; padding: 0 14px; border: 0; border-radius: 12px; background: {C["strong"]}; color: {C["onStrong"]}; font-weight: 600">Damage</button>'
              f'<button style="height: 44px; padding: 0 14px; border: 1px solid {C["muted"]}; border-radius: 12px; background: transparent; font-weight: 600">Heal</button></div>')
    return (f'<div style="flex-shrink: 0; background: {C["surface"]}; border-top: 1px solid {C["line"]}; box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05)">'
            f'{hp_row}<div style="display: flex; overflow: hidden; padding: 0 6px; border-top: 1px solid {C["line"]}">{out}</div></div>')


def dice_fab(href=None):
    return (f'<a href="{href or f("SheetDice")}" aria-label="Dice" style="position: absolute; right: 16px; bottom: 132px; width: 56px; height: 56px; '
            f'border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; align-items: center; justify-content: center; '
            f'box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25)">{icon("d20", 28)}</a>')


gen6.sheet_header = lambda: header()
gen6.sheet_dock = lambda active: dock("Main")


def sheet():
    return page("Sheet", header() + gen6.sheet_main_content() + dock("Main") + dice_fab())


# ---------------------------------------------------------------- dice panel over the sheet (half the screen)
def sheet_dice():
    quick = "".join(
        f'<button style="height: 52px; {CARD}; font-weight: 700; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px">'
        f'{icon("d20", 18, C["muted"])}{d}</button>' for d in ["d4", "d6", "d8", "d10", "d12", "d20", "d100", "+1"])
    panel = (f'<a href="{f("Sheet")}" aria-label="Close" style="position: absolute; left: 0; right: 0; top: 0; height: 400px; background: rgba(20, 20, 22, 0.25)"></a>'
             f'<section aria-label="Dice" style="position: absolute; left: 0; right: 0; bottom: 0; height: 400px; box-sizing: border-box; padding: 8px 16px 16px; '
             f'background: {C["surface"]}; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; gap: 10px">'
             f'<div style="width: 40px; height: 4px; border-radius: 2px; background: {C["line"]}; align-self: center"></div>'
             f'<div style="display: flex; align-items: center; justify-content: space-between">{serif(22, "Dice")}'
             f'<span style="font-size: 12px; color: {C["muted"]}">half screen · the sheet stays visible</span></div>'
             f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: {C["soft"]}">'
             f'<span style="flex-grow: 1; font-size: 14px; color: {C["muted"]}">Last: 2d6 + 3 → 4, 5 + 3 (sample)</span><b style="font-size: 30px">12</b></div>'
             f'<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px">{quick}</div>'
             f'<div style="display: flex; gap: 8px; align-items: center"><span style="flex-grow: 1; height: 44px; box-sizing: border-box; border-radius: 12px; '
             f'border: 2px dashed {C["line"]}; display: flex; align-items: center; padding: 0 12px; font-weight: 700">2 × d6 + 3</span>'
             f'<button style="height: 44px; padding: 0 12px; border: 1px solid {C["muted"]}; border-radius: 12px; background: transparent; font-weight: 600">+ Modifier</button></div>'
             f'{pbtn("Roll", f("Roll"), True, False, "d20")}</section>')
    return page("Sheet with dice", header() + gen6.sheet_main_content() + dock("Main") + panel)


# ---------------------------------------------------------------- features grouped by source
def features():
    def src(title, kind, sub, inner):
        subline = f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span>' if sub else ""
        return (f'<section style="{CARD}; overflow: hidden"><div style="padding: 10px 14px; display: flex; flex-direction: column; gap: 2px; '
                f'background: {C["soft"]}"><span style="display: flex; align-items: baseline; gap: 8px">{serif(21, title)}'
                f'<span style="font-size: 12px; color: {C["muted"]}; text-transform: uppercase; letter-spacing: 0.06em">{kind}</span></span>{subline}</div>{inner}</section>')

    def feat(name, desc, right=""):
        return (f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid {C["line"]}">'
                f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><b>{name}</b>'
                f'<span style="font-size: 13px; color: {C["muted"]}">{desc}</span></span>{right}</div>')
    sw = (f'<div style="padding: 10px 14px; border-top: 1px solid {C["line"]}; display: flex; flex-direction: column; gap: 8px">'
          f'<div style="display: flex; align-items: center; gap: 10px"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px">'
          f'<b>Second Wind</b><span style="font-size: 13px; color: {C["muted"]}">1 back on a short rest, all on a long rest</span></span>'
          f'<span style="display: flex; gap: 6px"><sc-for list="{{{{dots}}}}" as="d" hint-placeholder-count="2"><span style="width: 16px; height: 16px; '
          f'box-sizing: border-box; border-radius: 50%; border: 2px solid {C["strong"]}; background: {{{{d.bg}}}}"></span></sc-for></span></div>'
          f'<div style="display: flex; align-items: center; gap: 8px"><span style="flex-grow: 1; font-size: 14px"><b>{{{{uses}}}}</b> of 2 left</span>'
          f'<button onClick="{{{{use}}}}" disabled="{{{{empty}}}}" style="height: 44px; padding: 0 24px; border: 0; border-radius: 12px; '
          f'background: {C["strong"]}; color: {C["onStrong"]}; font-weight: 700">Use</button></div></div>')
    on = f'<span style="font-size: 12px; color: {C["muted"]}">Always on</span>'
    content = (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px">'
               + src("Human", "species", "", feat("Skill", "Proficient in Insight") + feat("Origin feat", "Alert"))
               + src("Fighter", "class · level 1", "Subclass: chosen at a later level",
                     sw + feat("Fighting Style: Defense", "AC +1", on) + feat("Weapon Mastery", "Greatsword: Graze"))
               + src("Soldier", "background", "", feat("Feat", "Savage Attacker") + feat("Skills", "Athletics, Intimidation"))
               + "</main>")
    toast = (f'<sc-if value="{{{{toast}}}}" hint-placeholder-val="{{{{ false }}}}"><div style="position: absolute; left: 16px; right: 16px; bottom: 132px; '
             f'height: 48px; border-radius: 12px; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; align-items: center; padding: 0 6px 0 16px">'
             f'<span style="flex-grow: 1">Second Wind used</span><button onClick="{{{{undo}}}}" style="height: 40px; padding: 0 14px; border: 0; '
             f'background: transparent; color: {C["onStrong"]}; font-weight: 700; text-decoration: underline">Undo</button></div></sc-if>')
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
    return page("Features by source", header() + content + toast + dock("Features") + dice_fab(), js)


# ---------------------------------------------------------------- about tab
def about():
    def row(k, v, sample=False):
        sm = f' <span style="font-size: 12px; color: {C["muted"]}">(sample)</span>' if sample else ""
        return (f'<div style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid {C["line"]}">'
                f'<span style="width: 108px; flex-shrink: 0; font-size: 13px; color: {C["muted"]}">{k}</span><span style="flex-grow: 1">{v}{sm}</span></div>')
    content = (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: flex; flex-direction: column">'
               f'{serif(22, "About Iren")}<div style="height: 6px"></div>'
               + row("Species", "Human") + row("Background", "Soldier") + row("Alignment", "Neutral good", True)
               + row("Languages", "Common, Dwarvish, Elvish", True)
               + f'<div style="margin: 14px 0 2px">{label("Proficiencies")}</div>'
               + row("Armor", "All armor, shields", True) + row("Weapons", "Simple, martial", True) + row("Tools", "One gaming set", True)
               + row("Skills", "Athletics, Intimidation, Insight, Perception, Survival")
               + "</main>")
    return page("About", header() + content + dock("About") + dice_fab())


# ---------------------------------------------------------------- spells for a caster (sample character)
def spells():
    stats = [("12", "AC"), ("+2", "Init"), ("13", "Spell DC"), ("+5", "Spell atk"), ("+2", "Prof")]
    slots = "".join(
        f'<span style="display: flex; align-items: center; gap: 8px"><span style="width: 56px; font-size: 13px; color: {C["muted"]}">Level {lv}</span>'
        + "".join(f'<span style="width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%; border: 2px solid {C["strong"]}; '
                  f'background: {C["strong"] if i < used else "transparent"}"></span>' for i in range(n)) + "</span>"
        for lv, n, used in [(1, 4, 3), (2, 2, 2)])
    sp = "".join(
        f'<div style="min-height: 50px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid {C["line"]}">'
        f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><b>{n}</b><span style="font-size: 12px; color: {C["muted"]}">{lv}</span></span>'
        f'{badge(src)}<button style="height: 36px; padding: 0 14px; border: 1px solid {C["muted"]}; border-radius: 10px; background: transparent; font-weight: 600">Cast</button></div>'
        for n, lv, src in [("Magic Missile", "Level 1", "2024"), ("Shield", "Level 1", "2024"), ("Misty Step", "Level 2", "2024"), ("Fire Bolt", "Cantrip", "2014")])
    content = (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px">'
               f'<div style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px"><div style="display: flex; align-items: baseline; gap: 8px">'
               f'{serif(20, "Spellcasting")}<span style="font-size: 12px; color: {C["muted"]}">sample numbers</span></div>'
               f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; text-align: center">'
               + "".join(f'<span style="display: flex; flex-direction: column; padding: 8px 0; border-radius: 10px; background: {C["soft"]}">'
                         f'<b style="font-size: 20px">{v}</b><span style="font-size: 12px; color: {C["muted"]}">{l}</span></span>'
                         for v, l in [("INT", "ability"), ("13", "save DC"), ("+5", "attack")])
               + f'</div></div><div style="display: flex; flex-direction: column; gap: 8px">{slots}</div><div>{sp}</div></main>')
    return page("Spells for a caster", header("Mira", "Wizard 3 · sample", stats, "M") + content + dock("Spells", "18", "18"))


# ---------------------------------------------------------------- edit mode: add to the sheet
def add():
    def opt(ic, t, sub, href=None):
        tag_open, tag_close = (f'<a href="{href}" ', "</a>") if href else ("<button ", "</button>")
        return (f'{tag_open}style="width: 100%; min-height: 60px; display: flex; align-items: center; gap: 14px; padding: 6px 4px; border: 0; '
                f'border-bottom: 1px solid {C["line"]}; background: transparent; text-align: left; {LINK}">'
                f'<span style="width: 40px; height: 40px; border-radius: 12px; background: {C["soft"]}; display: flex; align-items: center; justify-content: center">{icon(ic, 22)}</span>'
                f'<span style="flex-grow: 1; display: flex; flex-direction: column"><b>{t}</b><span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span>'
                f'{icon("chev", 18, C["muted"])}{tag_close}')
    banner = (f'<header style="flex-shrink: 0; height: 60px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 16px; '
              f'background: {C["strong"]}; color: {C["onStrong"]}"><span style="flex-grow: 1; display: flex; flex-direction: column">'
              f'<span style="font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em">Edit mode</span>{serif(22, "Iren")}</span>'
              f'<a href="{f("Sheet")}" style="height: 40px; padding: 0 18px; border-radius: 10px; background: {C["onStrong"]}; color: {C["strong"]}; '
              f'display: flex; align-items: center; font-weight: 700; text-decoration: none">Done</a></header>')
    inner = (f'{serif(24, "Add to the sheet")}'
             + opt("list", "Section", "Mounts, Pets, Familiars, Notes, or any list")
             + opt("paw", "Companion", "Familiar, pet or mount, with a small stat block")
             + opt("shield", "Custom item", "Armor, weapon or gear of your own")
             + opt("fx", "Custom stat", "A new stat from a formula, like Vitality", f("Stat"))
             + opt("image", "Portrait and token", "Your image in a round frame", f("Token")))
    return page("Edit mode, add", banner + gen6.sheet_main_content() + dock("Main") + gen6.overlay(inner, f("Sheet")))


# ---------------------------------------------------------------- a custom stat
def stat():
    chip = lambda t, strong=False: (f'<span style="height: 36px; padding: 0 12px; border-radius: 10px; display: flex; align-items: center; font-weight: 700; '
                                    + (f'background: {C["strong"]}; color: {C["onStrong"]}' if strong else f'background: {C["soft"]}') + f'">{t}</span>')
    op = lambda t: f'<span style="font-size: 18px; color: {C["muted"]}">{t}</span>'
    score = 8 + MOD["STR"] + MOD["DEX"] + MOD["CON"]
    mod = (score - 10) // 2
    assert (score, mod) == (14, 2)
    radio = lambda t, on: (f'<label style="display: flex; align-items: center; gap: 10px; min-height: 44px"><span style="width: 20px; height: 20px; '
                           f'box-sizing: border-box; border-radius: 50%; border: 2px solid {C["strong"]}; display: flex; align-items: center; justify-content: center">'
                           + (f'<span style="width: 10px; height: 10px; border-radius: 50%; background: {C["strong"]}"></span>' if on else "")
                           + f'</span><span>{t}</span></label>')
    body = (topbar("New stat", f("Add"), f'<button style="height: 40px; padding: 0 16px; margin-right: 8px; border: 0; border-radius: 10px; '
                                          f'background: {C["strong"]}; color: {C["onStrong"]}; font-weight: 700">Save</button>')
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 12px">'
            f'<label style="font-size: 13px; font-weight: 600">Name<input value="Vitality" style="display: block; width: 100%; margin-top: 6px; height: 48px; '
            f'box-sizing: border-box; border: 1px solid {C["muted"]}; border-radius: 12px; padding: 0 14px; font-size: 16px; background: {C["surface"]}; color: {C["text"]}"></label>'
            f'<div style="font-size: 13px; font-weight: 600">Score formula</div>'
            f'<div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center">{chip("8")}{op("+")}{chip("STR mod", True)}{op("+")}'
            f'{chip("DEX mod", True)}{op("+")}{chip("CON mod", True)}<span style="height: 36px; padding: 0 10px; border-radius: 10px; border: 1px dashed {C["muted"]}; '
            f'display: flex; align-items: center; color: {C["muted"]}">+ add</span></div>'
            f'<div style="{CARD}; padding: 14px; display: flex; align-items: center; gap: 12px">'
            f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; color: {C["muted"]}">For Iren</span>'
            f'<span>8 + {MOD["STR"]} + {MOD["DEX"]} + {MOD["CON"]} = <b>{score}</b></span></span>'
            f'<span style="display: flex; flex-direction: column; align-items: center"><b style="font-size: 30px">{sg(mod)}</b>'
            f'<span style="font-size: 12px; color: {C["muted"]}">modifier</span></span></div>'
            f'<div style="font-size: 13px; font-weight: 600">How it is used</div>'
            f'<div style="font-size: 14px">A bonus to any check, save or attack roll, equal to the proficiency bonus.</div>'
            f'<div style="padding: 10px 12px; border-radius: 10px; background: {C["warnBg"]}; color: {C["warnText"]}; font-size: 13px">'
            f'Open question: "equal to the proficiency bonus" is the size of the bonus, or the number of uses?</div>'
            f'{radio("Bonus size = proficiency bonus (+2)", False)}{radio("Uses = proficiency bonus (2), bonus = Vitality +2", False)}'
            f'</main>')
    return page("Custom stat", body)


# ---------------------------------------------------------------- portrait and token
def token_page():
    frames = "".join(
        f'<button style="flex-grow: 1; height: 96px; {CARD}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px'
        + (f'; border: 2px solid {C["strong"]}' if fr == "ring" else "") + f'">{token(48, "I", fr)}<span style="font-size: 12px">{name}</span></button>'
        for fr, name in [("thin", "Thin"), ("ring", "Ring"), ("double", "Double")])
    body = (topbar("Portrait", f("Sheet"))
            + f'<main style="flex-grow: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 14px">'
            f'<div style="height: 220px; border-radius: 16px; border: 2px dashed {C["line"]}; display: flex; flex-direction: column; align-items: center; '
            f'justify-content: center; gap: 8px; color: {C["muted"]}">{icon("image", 40)}<span>Choose an image of Iren</span>'
            f'<span style="font-size: 12px">stays on this device</span></div>'
            f'<div style="display: flex; align-items: center; gap: 16px"><span style="padding: 8px">{token(96, "I")}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 4px">{serif(22, "Token")}<span style="font-size: 13px; color: {C["muted"]}">'
            f'The portrait, cut round, in a simple frame. Used on the sheet, in lists and in the initiative tracker.</span></span></div>'
            f'<div>{label("Frame")}</div><div style="display: flex; gap: 8px">{frames}</div>'
            f'</main><div style="padding: 10px 16px 20px">{pbtn("Use as token", f("Sheet"))}</div>')
    return page("Portrait and token", body)


# ---------------------------------------------------------------- a character in a campaign
def campaign():
    banner = (f'<div style="flex-shrink: 0; padding: 10px 16px; display: flex; align-items: center; gap: 10px; background: {C["warnBg"]}; color: {C["warnText"]}">'
              f'{icon("flag", 20)}<span style="flex-grow: 1; font-size: 13px"><b>Campaign copy</b> · The Sunken Keep (sample)<br>1 change waits for the DM</span>'
              f'<span style="font-weight: 700; font-size: 13px">See</span></div>')
    inner = (f'{serif(24, "Waiting for the DM")}'
             f'<div style="{CARD}; padding: 12px 14px; display: flex; align-items: center; gap: 10px"><span style="flex-grow: 1; display: flex; flex-direction: column">'
             f'<b>Strength 17 → 18</b><span style="font-size: 13px; color: {C["muted"]}">sent today · needs approval</span></span>'
             f'<span style="font-size: 13px; font-weight: 600; color: {C["muted"]}">Withdraw</span></div>'
             f'<div style="font-size: 14px; font-weight: 700">Needs the DM</div>'
             f'<div style="font-size: 14px; color: {C["muted"]}">Ability scores and other stats, spell slots, short and long rests.</div>'
             f'<div style="font-size: 14px; font-weight: 700">Free to change</div>'
             f'<div style="font-size: 14px; color: {C["muted"]}">Inventory and money.</div>'
             f'<div style="font-size: 13px; color: {C["muted"]}; padding: 10px 12px; border-radius: 10px; background: {C["soft"]}">'
             f'Your own Iren outside the campaign stays yours: every change there applies at once.</div>')
    return page("In a campaign", header() + banner + gen6.sheet_main_content() + dock("Main") + gen6.overlay(inner, f("Sheet")))


def dm_review():
    def req(who, what, when):
        return (f'<div style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px">'
                f'<div style="display: flex; align-items: center; gap: 10px">{token(36, who[0])}<span style="flex-grow: 1; display: flex; flex-direction: column">'
                f'<b>{who} · {what}</b><span style="font-size: 13px; color: {C["muted"]}">{when}</span></span></div>'
                f'<div style="display: flex; gap: 8px">{pbtn("Approve", None, True, True)}{pbtn("Decline", None, False, True)}</div></div>')
    body = (topbar("Changes to approve", f("Campaign"), badge("Later"))
            + f'<main style="flex-grow: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<p style="margin: 0; font-size: 13px; color: {C["muted"]}">The Game master side. The DM sees every change players make in the campaign; important ones wait here.</p>'
            + req("Iren", "Strength 17 → 18", "today, 21:40 · sample")
            + req("Mira", "Long rest", "today, 21:12 · sample")
            + f'<div style="{CARD}; padding: 12px 14px; font-size: 14px"><b>Log</b><br><span style="color: {C["muted"]}">Iren bought a rope (applied) · Mira sold a dagger (applied)</span></div>'
            + '</main>')
    return page("DM review", body)


# ---------------------------------------------------------------- player page v2: several books at once
def player():
    def book(name, sub, on, pack=False):
        sw = (f'<span style="width: 44px; height: 26px; border-radius: 13px; background: {C["strong"] if on else C["line"]}; position: relative; flex-shrink: 0">'
              f'<span style="position: absolute; top: 3px; left: {21 if on else 3}px; width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF"></span></span>')
        return (f'<div style="height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-top: 1px solid {C["line"]}">'
                f'{icon("pen" if pack else "book", 20, C["muted"])}<span style="flex-grow: 1; display: flex; flex-direction: column"><b>{name}</b>'
                f'<span style="font-size: 12px; color: {C["muted"]}">{sub}</span></span>{sw}</div>')
    chapters = [("I", "Species", ["2024", "2014"], None), ("II", "Classes", ["2024", "Pack"], f("Classes")), ("III", "Backgrounds", ["2024", "2014"], None),
                ("IV", "Feats", ["2024"], None), ("V", "Spells", ["2024", "2014", "Pack"], None), ("VI", "Equipment", ["2024", "2014"], None)]
    toc = ""
    for num, name, srcs, href in chapters:
        tag_open, tag_close = (f'<a href="{href}" ', "</a>") if href else ("<div ", "</div>")
        toc += (f'{tag_open}style="height: 42px; display: flex; align-items: center; gap: 8px; border-top: 1px solid {C["line"]}; padding: 0 14px; {LINK}">'
                f'<span style="width: 28px; font-family: {SERIF}; color: {C["muted"]}">{num}</span><span style="flex-grow: 1; font-weight: 600">{name}</span>'
                f'{"".join(badge(s) for s in srcs)}{tag_close}')
    body = (topbar("Player", f("Start"), gen6.ibtn("sliders", "Settings"))
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<a href="{f("Characters")}" style="height: 64px; {CARD}; padding: 0 14px; display: flex; align-items: center; gap: 12px; {LINK}">'
            f'{token(36, "I")}<span style="flex-grow: 1; display: flex; flex-direction: column"><b>My characters</b>'
            f'<span style="font-size: 12px; color: {C["muted"]}">2 of 3 · last opened: Iren</span></span>{icon("chev", 18, C["muted"])}</a>'
            f'<section style="{CARD}; overflow: hidden"><div style="padding: 10px 14px">{serif(20, "Books in use")}'
            f'<span style="font-size: 12px; color: {C["muted"]}; margin-left: 8px">all on at once</span></div>'
            + book("SRD 2024", "5E compatible · 2024 rules", True) + book("SRD 2014", "5E compatible · 2014 rules", True)
            + book("Stormcoast Additions", "my homebrew pack · sample", True, True) + "</section>"
            f'<section style="{CARD}; overflow: hidden"><div style="height: 44px; display: flex; align-items: center; padding: 0 14px">'
            f'{serif(20, "Rulebook", "; flex-grow: 1")}<span style="font-size: 12px; color: {C["muted"]}">each entry keeps its source</span></div>{toc}</section>'
            f'</main>')
    return page("Player", body)


SCREENS = [("Start", "Start", gen7.start, 0, 0), ("Player", "Player: several books at once", player, 1, 0),
           ("Characters", "My characters", gen7.characters, 2, 0), ("Sheet", "Sheet: token, Inspiration, dice button", sheet, 3, 0),
           ("SheetDice", "Dice on the sheet: half screen", sheet_dice, 4, 0), ("Features", "Features by source (try Use)", features, 5, 0),
           ("About", "About tab", about, 6, 0),
           ("Classes", "A chapter", gen7.classes, 0, 1), ("Dice", "Dice page", gen7.dice, 1, 1), ("Create", "New character", gen7.create, 2, 1),
           ("Roll", "A roll", gen6.roll, 3, 1), ("Rest", "Rest", gen7.rest, 4, 1), ("Actions", "Actions", gen6.actions, 5, 1),
           ("Spells", "Spells for a caster (sample)", spells, 6, 1),
           ("Add", "Edit mode: add to the sheet", add, 0, 2), ("Stat", "A custom stat: Vitality", stat, 1, 2),
           ("Token", "Portrait and token", token_page, 2, 2), ("Campaign", "In a campaign: waiting for the DM", campaign, 3, 2),
           ("DMReview", "DM side (later): approve changes", dm_review, 4, 2)]


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    pages = canvas.get("pages") or []
    if not any(p["id"] == "ours-v2" for p in pages):
        pages.append({"id": "ours-v2", "name": "Our design v2"})
    canvas["pages"] = pages
    canvas["launch"] = {"view": "canvas", "page": "ours-v2"}
    notes = canvas["notes"]
    notes["v2-1"] = {"x": 0, "y": 0, "text": "Our design v2 (ADR 009): the main flow. Press Play", "kind": "title1", "maxW": 2960, "page": "ours-v2"}
    notes["v2-2"] = {"x": 0, "y": 1180, "text": "Opened from the pages above", "kind": "title1", "maxW": 2960, "page": "ours-v2"}
    notes["v2-3"] = {"x": 0, "y": 2360, "text": "Edit mode, custom stats, token, campaign", "kind": "title1", "maxW": 2960, "page": "ours-v2"}
    for name, title, fn, col, row in SCREENS:
        fname = f(name)
        with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as fh:
            fh.write(fn())
        canvas["boards"][fname] = {"x": col * 440, "y": 260 + row * 1180, "w": W, "h": H, "title": title,
                                   "page": "ours-v2", "is_interactive": True}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    print("pages:", [p["id"] for p in canvas["pages"]], "boards:", len(canvas["boards"]))


if __name__ == "__main__":
    run(sys.argv[1])
