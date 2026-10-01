"""ADR 013 on page 'Our design v3': temp HP, level options, creation, DM side, start, spell window."""
import json
import tempfile
import os
import sys

from gen import ABILITIES, ICONS, ROOT
import gen6
import gen8
import gen9
import gen12
from gen5 import C, CARD, LINK, W, H, pbtn
from gen4 import badge, icon, label
from gen7 import SERIF, serif, page, topbar
from gen8 import token, stars

f = gen9.f
TEMP = "#2F7A4A"  # 5.25 : 1 on white, measured with gen2.ratio
ICONS.update({
    "shield": '<path d="M12 3l8 3v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6z"></path><path d="M12 7v10M8.5 11h7"></path>',
    "crown": '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"></path>',
    "scroll": '<path d="M8 4h10a2 2 0 0 1 2 2v1h-4"></path><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"></path>'
              '<path d="M8 4a2 2 0 0 0-2 2v11"></path><path d="M10 9h4M10 12h4"></path>',
    "bell": '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"></path><path d="M10 20a2 2 0 0 0 4 0"></path>',
    "flag": '<path d="M5 21V4M5 4h11l-2 4 2 4H5"></path>',
    "circlechev": '<circle cx="12" cy="12" r="9.5"></circle><path d="M8 10.5l4 4 4-4"></path>',
})


def turn_arrow(rot, size=24, color=None):
    return (f'<span style="display: inline-flex; transform: rotate({rot}); transition: transform 0.2s ease">'
            f'{icon("circlechev", size, color or C["text"], 1.6)}</span>')


def tri(down, size=16, color=None):
    d = "M4 7h16l-8 12z" if down else "M4 17h16L12 5z"
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" aria-hidden="true" style="flex-shrink: 0">'
            f'<path d="{d}" fill="{color or C["hp"]}" stroke="{color or C["hp"]}" stroke-width="1.5" stroke-linejoin="round"></path></svg>')


def tag(href, inner, style):
    return f'<a href="{href}" style="{style}; {LINK}">{inner}</a>' if href else f'<div style="{style}">{inner}</div>'


def note(t):
    return f'<p style="margin: 0; font-size: 12px; color: {C["muted"]}">{t}</p>'


# ---------------------------------------------------------------- temporary hit points (item 1)
def hp_bar2(hp, hpmax, temp, h=8):
    total = max(hpmax, hp + temp)
    red, green = 100 * hp / total, 100 * temp / total
    return (f'<div style="height: {h}px; border-radius: {h // 2}px; background: {C["track"]}; flex-grow: 1; display: flex; overflow: hidden">'
            f'<span style="width: {red:.1f}%; background: {C["hp"]}"></span><span style="width: {green:.1f}%; background: {TEMP}"></span></div>')


def dock_temp(hp=12, hpmax=12, temp=5):
    html = gen9.dock("Main")
    old_num = f'12 <span style="font-size: 13px; font-weight: 500; color: {C["muted"]}">/ 12</span>'
    new_num = (f'{hp} <span style="font-size: 13px; font-weight: 500; color: {C["muted"]}">/ {hpmax}</span> '
               f'<span style="color: {TEMP}">+{temp}</span>')
    old_bar = gen9.hp_bar(8)
    assert old_num in html and old_bar in html
    html = html.replace(old_num, new_num).replace(old_bar, hp_bar2(hp, hpmax, temp))
    old_lbl = 'letter-spacing: 0.06em">Hit points</span>'
    assert old_lbl in html
    html = html.replace(old_lbl, 'letter-spacing: 0.06em">HP</span>')
    return html.replace('<span style="font-size: 18px; font-weight: 700">', '<span style="font-size: 18px; font-weight: 700; white-space: nowrap">')


def temp_sheet():
    return page("Sheet with temporary hit points", gen9.header() + gen6.sheet_main_content() + dock_temp() + gen8.dice_fab())


def keypad():
    seg = "".join(f'<span style="flex-grow: 1; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 9px; '
                  + (f'background: {C["surface"]}; font-weight: 700; color: {TEMP}; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12)' if t == "Temp HP" else f'color: {C["muted"]}')
                  + f'">{t}</span>' for t in ["Damage", "Heal", "Temp HP"])
    keys = "".join(f'<button style="height: 52px; {CARD}; font-size: 22px; font-weight: 700">{k}</button>'
                   for k in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"])
    inner = (f'<div style="display: flex; padding: 3px; border-radius: 12px; background: {C["soft"]}">{seg}</div>'
             f'<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px">'
             f'<span style="color: {C["muted"]}">12 / 12 → 12 / 12 <b style="color: {TEMP}">+5</b></span>'
             f'<span style="font-size: 44px; font-weight: 800; line-height: 1; color: {TEMP}">5</span></div>'
             f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{keys}</div>'
             f'{pbtn("Add 5 temporary HP", f("TempHP"))}')
    return page("Damage, heal and temporary HP pad", gen9.under() + gen9.half(inner, f("Sheet"), 470))


# ---------------------------------------------------------------- six places for the level (item 2)
def level_mark(kind, level="1"):
    tk = f'<a href="{f("Token")}" aria-label="Portrait and token" style="display: flex; {LINK}">{token(44, "I")}</a>'
    lu = f'href="{f("LevelUp")}" aria-label="Level {level}, level up"'
    pos = "position: absolute; display: flex; align-items: center; justify-content: center; font-weight: 800; text-decoration: none"
    if kind == "A":
        mark = (f'<a {lu} style="{pos}; right: -6px; bottom: -6px; width: 22px; height: 22px; border-radius: 50%; background: {C["surface"]}; '
                f'border: 2px solid {C["strong"]}; color: {C["text"]}; font-size: 12px">{level}</a>')
    elif kind == "B":
        mark = (f'<a {lu} style="{pos}; left: 50%; bottom: -9px; transform: translateX(-50%); height: 18px; padding: 0 7px; border-radius: 9px; '
                f'background: {C["surface"]}; border: 1.5px solid {C["strong"]}; color: {C["text"]}; font-size: 10px; letter-spacing: 0.06em; '
                f'white-space: nowrap">LV {level}</a>')
    elif kind == "C":
        r, c = 26, 2 * 3.14159 * 26
        tk = (f'<a href="{f("Token")}" aria-label="Portrait and token" style="display: flex; padding: 4px; {LINK}">{token(44, "I", "thin")}</a>'
              f'<svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true" style="position: absolute; left: -2px; top: -2px; transform: rotate(-90deg)">'
              f'<circle cx="28" cy="28" r="{r}" fill="none" stroke="{C["track"]}" stroke-width="3"></circle>'
              f'<circle cx="28" cy="28" r="{r}" fill="none" stroke="{C["strong"]}" stroke-width="3" stroke-linecap="round" '
              f'stroke-dasharray="{0.4 * c:.1f} {c:.1f}"></circle></svg>')
        mark = (f'<a {lu} style="{pos}; left: 50%; bottom: -8px; transform: translateX(-50%); width: 20px; height: 20px; border-radius: 50%; '
                f'background: {C["strong"]}; color: {C["onStrong"]}; font-size: 11px">{level}</a>')
    elif kind == "D":
        ribbon = (f'<svg viewBox="0 0 52 16" width="52" height="16" aria-hidden="true" style="position: absolute; left: 0; top: 0">'
                  f'<path d="M0 0h52l-5 8 5 8H0l5-8z" fill="{C["strong"]}"></path></svg>')
        mark = (f'<a {lu} style="{pos}; left: 50%; bottom: -7px; transform: translateX(-50%); width: 52px; height: 16px; color: {C["onStrong"]}; '
                f'font-size: 10px; letter-spacing: 0.08em">{ribbon}<span style="position: relative">LV {level}</span></a>')
    elif kind == "E":
        hexagon = (f'<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" style="position: absolute; left: 0; top: 0">'
                   f'<path d="M12 1.5l9.5 5.5v10L12 22.5 2.5 17V7z" fill="{C["surface"]}" stroke="{C["strong"]}" stroke-width="2"></path></svg>')
        mark = (f'<a {lu} style="{pos}; left: -8px; top: -6px; width: 24px; height: 24px; color: {C["text"]}; font-size: 12px">'
                f'{hexagon}<span style="position: relative">{level}</span></a>')
    else:  # F: a band across the bottom of the token
        tk = (f'<a href="{f("Token")}" aria-label="Portrait and token" style="display: flex; {LINK}">'
              f'<span style="width: 46px; height: 46px; border-radius: 50%; overflow: hidden; position: relative; background: {C["strong"]}; '
              f'box-shadow: 0 0 0 2px {C["surface"]}, 0 0 0 4px {C["strong"]}; display: flex; justify-content: center; color: {C["onStrong"]}">'
              f'<span style="font-family: {SERIF}; font-weight: 700; font-size: 21px; margin-top: 5px">I</span></span></a>')
        mark = (f'<a {lu} style="{pos}; left: 0; bottom: 0; width: 46px; height: 17px; border-radius: 0 0 23px 23px; background: {C["surface"]}; '
                f'border: 1px solid {C["strong"]}; box-sizing: border-box; color: {C["text"]}; font-size: 10px; letter-spacing: 0.06em">LV {level}</a>')
    return f'<span style="position: relative; display: flex; margin: 0 12px 0 4px">{tk}{mark}</span>'


LEVEL_KINDS = [("A", "a round badge on the token's corner"), ("B", "a small tab under the token"),
               ("C", "a ring that fills with XP, the level at its foot"), ("D", "a ribbon under the token"),
               ("E", "a six-sided crest on the token's top corner"), ("F", "a band across the token's bottom")]


def header_level(kind):
    html = gen9.header()
    start = html.index(f'<a href="{f("Token")}"')
    end = html.index("</a>", start) + len("</a>")
    html = html[:start] + level_mark(kind) + html[end:]
    chip_start = html.index(f'<a href="{f("LevelUp")}" aria-label="Level up"')
    chip_end = html.index("</a>", chip_start) + len("</a>")
    return html[:chip_start] + html[chip_end:]


def level_option(kind, text):
    caption = (f'<div style="position: absolute; left: 12px; right: 84px; top: 452px; padding: 8px 12px; border-radius: 10px; '
               f'background: {C["warnBg"]}; color: {C["warnText"]}; font-size: 13px; z-index: 3">Option {kind}: {text}. Tap the level to level up.</div>')
    return page(f"Level option {kind}", header_level(kind) + gen6.sheet_main_content() + gen9.dock("Main") + gen8.dice_fab() + caption)


# ---------------------------------------------------------------- making a character: triangles (item 7), feats (item 9)
def step(t, sub, open_=False, details="", href=None, key=None):
    box = f'<div style="padding: 0 14px 12px 50px; font-size: 14px; display: flex; flex-direction: column; gap: 4px">{details}</div>'
    if key:
        body = f'<sc-if value="{{{{open_{key}}}}}" hint-placeholder-val="{{{{ {"true" if open_ else "false"} }}}}">{box}</sc-if>'
        arrow = (f'<button onClick="{{{{toggle_{key}}}}}" aria-label="Show or hide" style="width: 40px; height: 40px; border: 0; background: transparent; '
                 f'display: flex; align-items: center; justify-content: center">{turn_arrow("{{rot_" + key + "}}")}</button>')
    else:
        body = box if open_ else ""
        arrow = (f'<span aria-label="{"Hide" if open_ else "Show"}" style="width: 40px; height: 40px; display: flex; align-items: center; '
                 f'justify-content: center">{turn_arrow("180deg" if open_ else "0deg")}</span>')
    return (f'<section style="{CARD}; overflow: hidden; flex-shrink: 0"><div style="min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 6px 8px 6px 14px">'
            f'<span style="width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; '
            f'align-items: center; justify-content: center">{icon("check", 14)}</span><span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">'
            f'<b>{t}</b><span style="font-size: 12px; color: {C["muted"]}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span></span>'
            f'<span style="font-size: 13px; font-weight: 600">Change</span>{arrow}</div>{body}</section>')


def create():
    ab = (f'<span>Method: <b>Reroll-a-1 4d6</b> <a href="{f("Roller")}" style="font-weight: 600; {LINK}">· roll calculator</a></span>'
          f'<span style="color: {C["muted"]}">Rolled 15 14 13 11 · 2 more to place</span>')
    feat = (f'<span>Origin feat: <b>Savage Attacker</b> {badge("2024")}</span>'
            f'<a href="{f("Feats")}" style="font-weight: 600; {LINK}">Choose another from the library</a>')
    body = (topbar("New character", f("Characters"), f'<span style="font-size: 13px; color: {C["muted"]}; margin-right: 14px">Saved</span>')
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 8px">'
            + step("Rules", "2024 rules · SRD 2024 · feats: + optional", False,
                   f'<span>2024 rules · SRD 2024</span><span style="color: {C["muted"]}">Mixing editions: off · Feats: + 2014 optional</span>', None, "rules")
            + step("Species", "Human", False, f'<span>Human · 2024</span><span style="color: {C["muted"]}">Skill: Insight · Origin feat: Alert</span>', None, "species")
            + step("Class", "Fighter 1 · Defense", False, f'<span>Fighter 1</span><span style="color: {C["muted"]}">Fighting style: Defense</span>', None, "cls")
            + step("Background", "Soldier", True, feat, None, "bg")
            + step("Abilities", "4 of 6 placed", True, ab, None, "ab")
            + step("Equipment", "Chain mail, greatsword", False, f'<span style="color: {C["muted"]}">Chain mail, greatsword (sample)</span>', None, "eq")
            + note("Tap a circle arrow: it turns, and the step opens or closes.")
            + "</main>"
            + f'<div style="padding: 10px 16px 16px; border-top: 1px solid {C["line"]}; background: {C["surface"]}">{pbtn("Open the sheet", f("Sheet"))}</div>')
    keys = {"rules": False, "species": False, "cls": False, "bg": True, "ab": True, "eq": False}
    js = ("""constructor(props) {
    super(props);
    this.state = """ + json.dumps(keys).replace("false", "false").replace("true", "true") + """;
  }
  renderVals() {
    const s = this.state;
    const out = {};
    for (const k of Object.keys(s)) {
      out['open_' + k] = s[k];
      out['rot_' + k] = s[k] ? '180deg' : '0deg';
      out['toggle_' + k] = () => this.setState({ [k]: !s[k] });
    }
    return out;
  }""")
    return page("New character, turning arrows", body, js)


def roller():
    rolls = [15, 14, 13, 11, 10, 9]
    placed = {15: "STR", 14: "CON", 13: "DEX", 11: "WIS"}
    bonus = {"STR": 2, "CON": 1}
    total = sum(rolls)
    by_ab = {a: r for r, a in placed.items()}
    rows = "".join(
        f'<div style="height: 44px; display: flex; border-radius: 10px; overflow: hidden; border: 1px solid {C["line"]}; background: {C["surface"]}">'
        f'<span style="width: 52px; flex-shrink: 0; background: {C["strong"]}; color: {C["onStrong"]}; display: flex; align-items: center; '
        f'justify-content: center; font-size: 18px; font-weight: 800">{r}</span>'
        f'<span style="flex-grow: 1; display: flex; align-items: center; padding: 0 12px; '
        + (f'font-weight: 600">{dict((ab[0], ab[1]) for ab in ABILITIES)[placed[r]]}' if r in placed else f'color: {C["muted"]}">Choose ability')
        + f'</span><span style="display: flex; align-items: center; padding-right: 10px; transform: rotate(90deg)">{icon("chev", 14, C["muted"])}</span></div>'
        for r in rolls)
    cols = ""
    for code, _name, _ in ABILITIES:
        r = by_ab.get(code)
        b = bonus.get(code, 0)
        score = r + b if r is not None else None
        mod = (score - 10) // 2 if score is not None else None
        cell = lambda v, strong=False: (f'<span style="height: 26px; display: flex; align-items: center; justify-content: center; '
                                        + ("font-weight: 800; font-size: 16px" if strong else f"color: {C['muted']}; font-size: 14px") + f'">{v}</span>')
        cols += (f'<div style="flex-grow: 1; flex-basis: 0; border-radius: 12px; background: {C["soft"]}; padding: 8px 0; display: flex; flex-direction: column; gap: 2px">'
                 f'<span style="text-align: center; font-size: 12px; font-weight: 700">{code}</span>'
                 + cell(r if r is not None else "—") + cell(f"+{b}" if b else "—") + cell(score if score is not None else "—", True)
                 + cell((f"+{mod}" if mod >= 0 else f"−{-mod}") if mod is not None else "—", True) + "</div>")
    legend = "".join(f'<span style="height: 26px; display: flex; align-items: center">{t}</span>' for t in ["", "Rolled", "Bonus", "Score", "Mod"])
    body = (topbar("Roll calculator", f("Create"))
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; align-items: center; gap: 8px; font-size: 14px">Method: <b>Reroll-a-1 4d6</b>'
            f'<a href="{f("Methods")}" style="margin-left: auto; font-weight: 600; {LINK}">Change</a></div>'
            f'<div style="height: 44px; border-radius: 10px; background: {C["soft"]}; display: flex; align-items: center; justify-content: center; '
            f'font-size: 16px">Total: <b style="margin-left: 6px">{total}</b></div>'
            + pbtn("Reroll", None, False)
            + rows
            + f'<div style="display: flex; gap: 4px; margin-top: 4px"><div style="width: 44px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px; '
            f'padding: 8px 0; font-size: 11px; color: {C["muted"]}">{legend}</div>{cols}</div>'
            + "</main>"
            + f'<div style="padding: 10px 16px 16px; border-top: 1px solid {C["line"]}; background: {C["surface"]}; display: flex; flex-direction: column; gap: 6px">'
            f'<div style="height: 48px; border-radius: 12px; background: {C["soft"]}; color: {C["muted"]}; display: flex; align-items: center; '
            f'justify-content: center; font-weight: 600">Apply to abilities</div>'
            + note("Turns on when all six are rolled by the method and placed. 2 left. Sample roll; Soldier gives STR +2, CON +1.") + "</div>")
    return page("Roll calculator", body)


def feats():
    seg = "".join(f'<span style="flex-grow: 1; flex-basis: 0; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 9px; '
                  f'font-size: 13px; text-align: center; '
                  + (f'background: {C["surface"]}; font-weight: 700; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12)' if on else f'color: {C["muted"]}')
                  + f'">{t}</span>' for t, on in [("2024 only", False), ("+ 2014 optional", True), ("All (homebrew)", False)])
    filters = "".join(gen9.chip(t, on, True) for t, on in [("Origin", True), ("Level 4+", False), ("Species", True), ("Fighting style", False), ("Epic boon", False)])

    def fc(name, sub, src, href=None):
        return gen12.card(name, sub, "", "", src, href).replace(gen12.icon("spark", 16, C["muted"]), icon("flag", 16, C["muted"]))
    body = (topbar("Choose a feat", f("Create"))
            + f'<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px">'
            f'<span style="font-size: 12px; color: {C["muted"]}">Feats allowed (rules option)</span>'
            f'<div style="display: flex; padding: 3px; border-radius: 12px; background: {C["soft"]}">{seg}</div>'
            f'<label style="height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 12px; background: {C["soft"]}; '
            f'color: {C["muted"]}">{icon("search", 18)}<input aria-label="Search feats" placeholder="Search feats" style="flex-grow: 1; min-width: 0; '
            f'border: 0; background: transparent; font-size: 16px; outline: none"></label>'
            f'<div style="display: flex; gap: 6px; overflow: hidden">{filters}</div></div>'
            f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 4px 16px">'
            + gen12.group_head("Origin feats")
            + fc("Alert", "Origin", "2024") + fc("Magic Initiate", "Origin", "2024") + fc("Savage Attacker", "Origin · from Soldier", "2024", f("Create"))
            + fc("Skilled", "Origin", "2024")
            + gen12.group_head("Species feats")
            + fc("Tidecaller", "Species · Stormcoast Additions", "Pack")
            + note("This is the library's Feats list. Sample list.") + "</main>")
    return page("Choose a feat", body)


def conflict():
    under = (topbar("New character", f("Characters"))
             + f'<main style="flex-grow: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 8px">'
             + step("Rules", "2024 rules · mixing on") + step("Race", "Hill Dwarf · 2014") + step("Class", "Fighter 1")
             + step("Background", "Soldier · 2024") + "</main>")

    def box(key, title, sub):
        return (f'<button onClick="{{{{toggle_{key}}}}}" style="min-height: 64px; display: flex; align-items: center; gap: 12px; padding: 8px 14px; {CARD}; '
                f'text-align: left; width: 100%"><span style="width: 24px; height: 24px; flex-shrink: 0; box-sizing: border-box; border-radius: 6px; '
                f'border: 2px solid {C["strong"]}; background: {{{{bg_{key}}}}}; color: {C["onStrong"]}; display: flex; align-items: center; '
                f'justify-content: center">{icon("check", 14)}</span><span style="display: flex; flex-direction: column; gap: 2px"><b>{title}</b>'
                f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span></button>')
    inner = (f'{serif(22, "Two sources raise your abilities")}'
             f'<span style="font-size: 14px; color: {C["muted"]}">The 2014 race and the 2024 background both give ability bonuses. Use:</span>'
             + box("race", "Race · Hill Dwarf · 2014", "CON +2, WIS +1")
             + box("bg", "Background · Soldier · 2024", "STR +2, CON +1")
             + f'<sc-if value="{{{{both}}}}" hint-placeholder-val="{{{{ true }}}}"><div style="padding: 10px 12px; border-radius: 10px; background: {C["warnBg"]}; '
             f'color: {C["warnText"]}; font-size: 14px">Both are on. Each ruleset expects only one of them. You can keep both.</div></sc-if>'
             + note("In a campaign, the DM decides: one, or both.")
             + pbtn("Apply", f("Create")))
    js = """constructor(props) {
    super(props);
    this.state = { race: true, bg: true };
  }
  renderVals() {
    const s = this.state;
    const on = '""" + C["strong"] + """';
    const off = 'transparent';
    return {
      both: s.race && s.bg,
      bg_race: s.race ? on : off,
      bg_bg: s.bg ? on : off,
      toggle_race: () => this.setState({ race: !s.race || !s.bg ? true : false }),
      toggle_bg: () => this.setState({ bg: !s.bg || !s.race ? true : false }),
    };
  }"""
    return page("Ability bonus conflict", under + gen9.half(inner, f("Create"), 470), js)


# ---------------------------------------------------------------- the DM (items 11-14)
def tile(href, ic, title, sub="", count=None, size="big", pad=14, fs=None):
    cnt = (f'<span style="position: absolute; top: 10px; right: 10px; min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 11px; '
           f'background: {C["hp"]}; color: #FFFFFF; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center">{count}</span>'
           if count else "")
    h = 128 if size == "big" else 92
    inner = (f'{icon(ic, 30 if size == "big" else 24)}{cnt}<span style="font-weight: 700; font-size: {fs or (16 if size == "big" else 14)}px">{title}</span>'
             + (f'<span style="font-size: 12px; color: {C["muted"]}">{sub}</span>' if sub else ""))
    return tag(href, inner, f'position: relative; height: {h}px; {CARD}; border-radius: 16px; padding: {pad}px; box-sizing: border-box; display: flex; '
                            f'flex-direction: column; justify-content: flex-end; gap: 4px')


PLAYER_TILES = [("Characters", "users", "2 of 3", "Characters"), ("Sources", "book", "SRD 5.1 · SRD 5.2.1 · 1 pack", "Sources"),
                ("Library", "search", "10 topics", "Library"), ("Dice roll", "d20", "a real table roll", "Dice"),
                ("Quick rules", "scroll", "every SRD rule", "QuickRules"), ("Bookmarks", "bookmark", "4 saved", None)]


def player():
    tiles = "".join(tile(f(h) if h else None, ic, t, s) for t, ic, s, h in PLAYER_TILES)
    body = (topbar("Player", f("Start"), gen6.ibtn("sliders", "Settings"))
            + f'<main style="flex-grow: 1; padding: 0 16px 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-content: start">'
            f'{tiles}</main><div style="padding: 0 16px 20px">{note("Sample counts.")}</div>')
    return page("Player v3, six sections", body)


def dm_home():
    dm = (tile(f("Approvals"), "bell", "Approvals", "2 waiting", 2, "big", 10, 14) + tile(f("Actor"), "users", "Actors", "PC, NPC, enemy", None, "big", 10, 14)
          + tile(None, "map", "Campaigns", "1 of 1", None, "big", 10, 14))
    same = "".join(tile(f(h) if h else None, ic, t, "", None, "small", 10) for t, ic, s, h in PLAYER_TILES)
    body = (topbar("Game master", f("Start"), gen6.ibtn("sliders", "Settings"))
            + f'<main style="flex-grow: 1; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<div>{label("Only the DM")}</div>'
            f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{dm}</div>'
            f'<div>{label("Everything a player has")}</div>'
            f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{same}</div>'
            + note("The DM can do everything a player can, and more. Sample counts.") + "</main>")
    return page("Game master home", body)


def lv_token(letter, change, size=40):
    return (f'<span style="position: relative; display: flex; margin-right: 6px">{token(size, letter)}'
            f'<span style="position: absolute; left: 50%; bottom: -9px; transform: translateX(-50%); height: 18px; padding: 0 6px; border-radius: 9px; '
            f'background: {C["surface"]}; border: 1.5px solid {C["strong"]}; font-size: 10px; font-weight: 800; white-space: nowrap; display: flex; '
            f'align-items: center">{change}</span></span>')


def approvals():
    def row(letter, name, cls, what, when, href=None):
        inner = (f'{token(40, letter)}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><b>{name} '
                 f'<span style="font-weight: 500; color: {C["muted"]}">· {cls}</span></b><span style="font-size: 13px; color: {C["muted"]}">{what} · {when}</span></span>'
                 f'{icon("chev", 18, C["muted"])}')
        return tag(href, inner, f'min-height: 72px; {CARD}; padding: 10px 14px; display: flex; align-items: center; gap: 12px')
    title = (f'<span style="display: flex; align-items: center; gap: 8px; flex-grow: 1">{serif(28, "Approvals")}'
             f'<span style="min-width: 24px; height: 24px; padding: 0 7px; box-sizing: border-box; border-radius: 12px; background: {C["hp"]}; color: #FFFFFF; '
             f'font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center">2</span></span>')
    body = (f'<header style="height: 60px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 4px">'
            f'{gen6.ibtn_link(f("DMHome"), "back", "Back")}{title}</header>'
            + f'<main style="flex-grow: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 10px">'
            + row("M", "Mira", "Wizard 3 → 4", "5 changes", "2 min ago", f("DMReview"))
            + row("I", "Iren", "Fighter 1", "1 change: +3 arrows", "today")
            + note("Sample names and numbers. The count on the DM's home is this list.") + "</main>")
    return page("Approvals", body)


def dm_review():
    line = lambda t, extra="": (f'<div style="min-height: 40px; display: flex; align-items: center; gap: 8px; border-top: 1px solid {C["line"]}; font-size: 15px">'
                                f'<span style="flex-grow: 1">{t}</span>{extra}'
                                f'<span aria-label="Edit" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center">{icon("pen", 16, C["muted"])}</span></div>')
    gold = (f'<div style="min-height: 48px; display: flex; align-items: center; gap: 8px; border-top: 1px solid {C["line"]}; font-size: 15px">'
            f'<sc-if value="{{{{edited}}}}" hint-placeholder-val="{{{{ true }}}}"><div style="display: flex; align-items: center; gap: 8px; width: 100%"><span style="flex-grow: 1; display: flex; align-items: center; gap: 6px; white-space: nowrap">'
            f'<s style="color: {C["muted"]}">+24</s>→ +<span style="width: 56px; height: 34px; box-sizing: border-box; border-radius: 8px; border: 2px solid {C["strong"]}; '
            f'display: flex; align-items: center; padding: 0 8px; font-weight: 700">34</span>gold</span>'
            f'<button onClick="{{{{toggle}}}}" style="border: 0; background: transparent; font-size: 13px; font-weight: 600; white-space: nowrap">Undo edit</button></div></sc-if>'
            f'<sc-if value="{{{{plain}}}}" hint-placeholder-val="{{{{ false }}}}"><div style="display: flex; align-items: center; gap: 8px; width: 100%"><span style="flex-grow: 1">+24 gold</span>'
            f'<button onClick="{{{{toggle}}}}" aria-label="Edit" style="width: 32px; height: 32px; border: 0; background: transparent; display: flex; align-items: center; '
            f'justify-content: center">{icon("pen", 16)}</button></div></sc-if></div>')
    card = (f'<section style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; align-items: center; gap: 10px; padding-bottom: 6px">{token(40, "M")}'
            f'<span style="flex-grow: 1; display: flex; align-items: baseline; gap: 6px"><b style="font-size: 17px">Mira</b>'
            f'<span style="color: {C["muted"]}">Wizard 3 → 4</span></span></div>'
            f'<div>{line("Level 3 → 4")}{line("HP 6 → 12")}{gold}{line("+12 silver")}{line(chr(39) + "Added spell " + chr(34) + "Shield" + chr(34))}</div>'
            f'<div style="font-weight: 700">Approve changes?</div>'
            f'<div style="display: flex; gap: 8px">{pbtn("Yes", None, True, True)}{pbtn("No", None, False, True)}</div></section>')
    card = card.replace(chr(39) + "Added", "Added")
    js = """constructor(props) {
    super(props);
    this.state = { edited: true };
  }
  renderVals() {
    const e = this.state.edited;
    return { edited: e, plain: !e, toggle: () => this.setState({ edited: !e }) };
  }"""
    body = (topbar("Changes to approve", f("Approvals"))
            + f'<main style="flex-grow: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 10px">{card}'
            + note("The DM's value replaces the player's: +34 gold, not +24. Sample names and numbers.") + "</main>")
    return page("DM review, edit before approving", body, js)


def actor():
    types = "".join(gen9.chip(t, t == "NPC") for t in ["PC", "NPC", "Enemy", "+ New type"])
    field = lambda k, v, ph=False, tall=False: (f'<label style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; color: {C["muted"]}">{k}</span>'
                                    f'<span style="{"min-height: 88px; align-items: flex-start; padding: 12px 14px" if tall else "height: 48px; align-items: center; padding: 0 14px"}; box-sizing: border-box; '
                                    f'border-radius: 12px; border: 1px solid {C["line"]}; background: {C["surface"]}; display: flex; font-size: 16px{"; color: " + C["muted"] if ph else ""}">{v}</span></label>')
    body = (topbar("New actor", f("DMHome"))
            + f'<main style="flex-grow: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 14px">'
            f'<div style="display: flex; align-items: center; gap: 14px">{token(64, "V", "double")}<span style="font-size: 14px; font-weight: 600">Add a picture</span></div>'
            + field("Name", "Captain Vey")
            + f'<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; color: {C["muted"]}">Type</span>'
            f'<div style="display: flex; flex-wrap: wrap; gap: 8px">{types}</div></div>'
            + field("Notes", "Harbour master. Owes the party a favour.", True, True)
            + note("Types are a list the DM can add to. Sample actor.") + "</main>"
            + f'<div style="padding: 10px 16px 16px; border-top: 1px solid {C["line"]}; background: {C["surface"]}">{pbtn("Create actor", f("DMHome"))}</div>')
    return page("New actor", body)


# ---------------------------------------------------------------- start (items 15, 16)
def systems():
    def row(title, sub, href=None, later=False):
        inner = (f'{icon("book", 24)}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><b style="font-size: 17px">{title}</b>'
                 f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span></span>' + (badge("Later") if later else icon("chev", 18, C["muted"])))
        return tag(href, inner, f'min-height: 68px; {CARD}; padding: 10px 16px; display: flex; align-items: center; gap: 14px'
                                + (f"; color: {C['muted']}" if later else ""))
    body = (f'<header style="height: 56px; flex-shrink: 0; display: flex; justify-content: flex-end; padding: 0 4px">{gen6.ibtn("sliders", "Settings")}</header>'
            f'<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; text-align: center">'
            f'{serif(54, "Grimoire")}<span style="color: {C["muted"]}">Tabletop characters, rules and dice</span></div>'
            f'<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; padding: 0 16px 36px">'
            f'<div>{label("Choose your game system")}</div>'
            + row("5E compatible", "2014 and 2024 rules", f("Start"))
            + row("Another system", "its on-screen name is checked first", None, True)
            + row("Another system", "systems never mix", None, True)
            + "</div>")
    return page("Choose the system", body)


def start():
    def square(href, ic, title, sub):
        return (f'<a href="{href}" style="flex-grow: 1; flex-basis: 0; aspect-ratio: 1 / 1.1; {CARD}; border-radius: 20px; padding: 16px; box-sizing: border-box; '
                f'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; {LINK}">'
                f'<span style="width: 72px; height: 72px; border-radius: 50%; background: {C["soft"]}; display: flex; align-items: center; justify-content: center">'
                f'{icon(ic, 40)}</span>{serif(28, title)}<span style="font-size: 12px; color: {C["muted"]}">{sub}</span></a>')
    body = (f'<header style="height: 56px; flex-shrink: 0; display: flex; align-items: center; padding: 0 4px">'
            f'{gen6.ibtn_link(f("Systems"), "back", "Choose the system")}<span style="flex-grow: 1"></span>{gen6.ibtn("sliders", "Settings")}</header>'
            f'<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px; text-align: center">'
            f'{serif(54, "Grimoire")}<a href="{f("Systems")}" style="height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid {C["muted"]}; display: flex; '
            f'align-items: center; font-size: 13px; color: {C["muted"]}; {LINK}">5E compatible · 2014 and 2024 rules</a></div>'
            f'<div style="flex-shrink: 0; display: flex; gap: 12px; padding: 0 16px 48px">'
            + square(f("Player"), "shield", "Player", "Characters, sources, library, dice")
            + square(f("DMHome"), "crown", "DM", "All a player has, plus campaigns, actors, approvals")
            + "</div>")
    return page("Start v3, two squares", body)


# ---------------------------------------------------------------- the spell's window (items 4-6)
def entry():
    ib = lambda ic, lbl, href=None: tag(href, icon(ic, 20), f'width: 38px; height: 38px; display: flex; align-items: center; justify-content: center')
    prop = lambda k, v: (f'<div style="display: flex; flex-direction: column; gap: 0; padding: 6px 10px"><span style="font-size: 11px; color: {C["muted"]}; '
                         f'text-transform: uppercase; letter-spacing: 0.05em">{k}</span><span style="font-size: 14px; font-weight: 600">{v}</span></div>')
    dice = lambda t: (f'<span style="padding: 0 4px; border-radius: 5px; background: {C["soft"]}; font-weight: 700; text-decoration: underline; '
                      f'text-decoration-style: dashed; text-underline-offset: 3px">{t}</span>')
    term = lambda t: f'<span style="text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; font-weight: 600">{t}</span>'
    window = (f'<a href="{f("Library")}" aria-label="Close" style="position: absolute; inset: 0; background: rgba(20, 20, 22, 0.45)"></a>'
              f'<section style="position: absolute; left: 0; right: 0; top: 56px; bottom: 0; box-sizing: border-box; padding: 8px 16px 16px; '
              f'background: {C["surface"]}; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.2); display: flex; flex-direction: column; '
              f'gap: 10px; overflow: hidden">'
              f'<div style="width: 40px; height: 4px; border-radius: 2px; background: {C["line"]}; align-self: center"></div>'
              f'<div style="display: flex; align-items: flex-start; gap: 2px"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px">'
              f'{serif(28, "Fire Bolt")}<span style="font-size: 14px; color: {C["muted"]}">[Russian name, when the glossary has it]</span></span>'
              f'{ib("share", "Share")}{ib("bookmark", "Bookmark")}{ib("more", "Homebrew copy, edit")}{ib("close", "Close", f("Library"))}</div>'
              f'<div style="border-radius: 12px; background: {C["soft"]}; overflow: hidden">'
              f'<div style="height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border-bottom: 1px solid {C["line"]}">'
              f'<i style="flex-grow: 1">Cantrip, Evocation</i>{badge("SRD 2024")}</div>'
              f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr))">'
              f'{prop("Casting time", "Action")}{prop("Range", "120 feet")}{prop("Duration", "Instantaneous")}{prop("Components", "V, S")}</div></div>'
              f'<div style="font-size: 16px; line-height: 25px">[SRD text.] Make a {term("ranged spell attack")}; on a hit the target takes '
              f'{dice("1d10")} fire damage.</div>'
              f'<div style="font-size: 16px; line-height: 25px"><b>Cantrip upgrade.</b> [SRD text.] {dice("2d10")} at level 5, {dice("3d10")} at 11, '
              f'{dice("4d10")} at 17.</div>'
              f'<div style="padding: 8px 12px; border-radius: 10px; background: {C["soft"]}; font-size: 13px; color: {C["muted"]}">'
              f'On your sheet this spell shows the dice for your level, and updates after a level-up.</div>'
              f'<div style="font-size: 15px; line-height: 24px"><b>Classes:</b> {term("Sorcerer")} {badge("2014")} {badge("2024")} · '
              f'{term("Wizard")} {badge("2014")} {badge("2024")}<br><b>Subclasses:</b> <span style="color: {C["muted"]}">none in these books</span></div>'
              f'<div style="font-size: 13px; color: {C["muted"]}">Also its own entry: {term("Fire Bolt")} {badge("SRD 2014")} · sample values</div>'
              f'</section>')
    under = topbar("Spells", f("Player")) + gen12.controls() + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 4px 16px">{gen12.list_body(False, "Fire Bolt")}</main>'
    return page("Library entry, small top", under + window)


# ---------------------------------------------------------------- Quick rules (item 18)
TOPICS = ["Move", "Action", "Bonus action", "Reaction", "Combat", "Other actions", "Environment", "Damage and attack",
          "Hit points, death and rest", "Abilities and skills", "Origins", "Conditions and diseases", "Active class features",
          "Spells", "Multiclassing"]


def search_field(t):
    return (f'<label style="height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 12px; background: {C["soft"]}; '
            f'color: {C["muted"]}">{icon("search", 18)}<input aria-label="{t}" placeholder="{t}" style="flex-grow: 1; min-width: 0; '
            f'border: 0; background: transparent; font-size: 16px; outline: none"></label>')


def topic_list(link=True):
    return "".join(tag(f("QuickRule") if link and t == "Action" else None,
                       f'<b style="flex-grow: 1; font-size: 16px">{t}</b>{icon("chev", 18, C["muted"])}',
                       f'height: 50px; {CARD}; padding: 0 14px; display: flex; align-items: center; margin-bottom: 6px') for t in TOPICS)


def quick_rules():
    body = (topbar("Quick rules", f("Player"))
            + f'<div style="padding: 0 16px 8px">{search_field("Search every rule")}</div>'
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px">{topic_list()}</main>')
    return page("Quick rules", body)


def quick_rule():
    term = lambda t: f'<span style="text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; font-weight: 600">{t}</span>'
    ib = lambda ic, href=None: tag(href, icon(ic, 20), "width: 38px; height: 38px; display: flex; align-items: center; justify-content: center")
    rules = [("zap", "Attack"), ("flag", "Dash"), ("back2", "Disengage"), ("shield", "Dodge"), ("users", "Help"), ("search", "Hide")]
    cards = "".join(
        f'<div style="height: 54px; {CARD}; display: flex; align-items: center; gap: 12px; padding: 0 12px; margin-bottom: 6px">'
        f'<span style="width: 34px; height: 34px; border-radius: 50%; background: {C["soft"]}; display: flex; align-items: center; justify-content: center">'
        f'{icon(ic, 18)}</span><b style="flex-grow: 1">{n}</b>{badge("SRD 2024")}</div>' for ic, n in rules)
    topic = (f'<a href="{f("QuickRules")}" aria-label="Close" style="position: absolute; inset: 0; background: rgba(20, 20, 22, 0.35)"></a>'
             f'<section style="position: absolute; left: 0; right: 0; top: 40px; bottom: 0; box-sizing: border-box; padding: 8px 16px; background: {C["surface"]}; '
             f'border-radius: 20px 20px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; gap: 8px; overflow: hidden">'
             f'<div style="width: 40px; height: 4px; border-radius: 2px; background: {C["line"]}; align-self: center"></div>'
             f'<div style="display: flex; align-items: center">{serif(28, "Action", "; flex-grow: 1")}{ib("share")}{ib("bookmark")}{ib("close", f("QuickRules"))}</div>'
             f'<div style="font-size: 15px; line-height: 23px; color: {C["muted"]}">[SRD text: what you can do with your action.]</div>'
             f'<div>{cards}</div></section>')
    rule = (f'<div style="position: absolute; inset: 0; background: rgba(20, 20, 22, 0.55)"></div>'
            f'<section style="position: absolute; left: 0; right: 0; top: 380px; bottom: 0; box-sizing: border-box; padding: 8px 16px 16px; background: {C["surface"]}; '
            f'border-radius: 20px 20px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.22); display: flex; flex-direction: column; gap: 10px">'
            f'<div style="width: 40px; height: 4px; border-radius: 2px; background: {C["line"]}; align-self: center"></div>'
            f'<div style="display: flex; align-items: center">{serif(26, "Disengage", "; flex-grow: 1")}{ib("bookmark")}{ib("close", f("QuickRule"))}</div>'
            f'<div style="height: 34px; border-radius: 10px; background: {C["soft"]}; display: flex; align-items: center; gap: 8px; padding: 0 10px; font-size: 14px">'
            f'<i>Topic:</i> {term("Action")}<span style="flex-grow: 1"></span>{badge("SRD 2024")}</div>'
            f'<i style="font-size: 15px">Move away safely this turn.</i>'
            f'<div style="font-size: 16px; line-height: 25px">[SRD text.] Your movement doesn\'t provoke {term("Opportunity Attacks")} for the rest of the turn.</div>'
            f'<div style="margin-top: auto; padding: 10px 12px; border-radius: 10px; background: {C["warnBg"]}; color: {C["warnText"]}; font-size: 13px">'
            f'Dotted words open their own rule over this one, in every text: "concentration" in a spell opens Concentration.</div></section>')
    under = (topbar("Quick rules", f("Player")) + f'<div style="padding: 0 16px 8px">{search_field("Search every rule")}</div>'
             + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 0 16px">{topic_list(False)}</main>')
    return page("Quick rules: a topic and a rule", under + topic + rule)


# ---------------------------------------------------------------- canvas
SCREENS = [
    # name, title, fn, col, row
    ("Player", "Player: six sections (ADR 013)", player, 0, 0),
    ("Entry", "A spell's window: small top part, no Damage dice list (ADR 013)", entry, 3, 0),
    ("QuickRules", "Quick rules: every SRD rule by topic (ADR 013)", quick_rules, 4, 0),
    ("QuickRule", "Quick rules: a topic, then a rule over it (ADR 013)", quick_rule, 5, 0),
    ("Keypad", "Damage / Heal / Temp HP pad (ADR 013)", keypad, 3, 1),
    ("TempHP", "Temporary HP: green number and bar part (ADR 013)", temp_sheet, 7, 1),
    ("Create", "New character: turning circle arrows, feat from the library (ADR 013)", create, 0, 2),
    ("Roller", "Roll calculator (ADR 013)", roller, 2, 2),
    ("Feats", "Choose a feat: the library's Feats list with filters (ADR 013)", feats, 3, 2),
    ("Conflict", "Race and background both raise abilities (ADR 013)", conflict, 4, 2),
    ("Systems", "Later: choose the game system (ADR 013)", systems, 0, 5),
    ("Start", "Start: Player and DM squares (ADR 013)", start, 1, 5),
    ("DMHome", "DM home: approvals with a count, actors (ADR 013)", dm_home, 2, 5),
    ("Approvals", "Approvals: characters waiting (ADR 013)", approvals, 3, 5),
    ("DMReview", "DM review: edit a value, Wizard 3 → 4 on the class line (ADR 013)", dm_review, 4, 5),
    ("Actor", "New actor with a type (ADR 013)", actor, 5, 5),
]

NOTES = {"v3-0": "Player page, library and Quick rules (ADR 010, 012, 013)",
         "v3-2": "Making a character (ADR 010, 013)",
         "v3-5": "Start and the DM's side (ADR 013)",
}


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    for key, text in NOTES.items():
        row = int(key.split("-")[1])
        canvas["notes"][key] = {"x": 0, "y": row * 1180, "text": text, "kind": "title1", "maxW": 2960, "page": "ours-v3"}
    written = []
    for name, title, fn, col, row in SCREENS:
        fname = f(name)
        with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as fh:
            fh.write(fn())
        canvas["boards"][fname] = {"x": col * 440, "y": 260 + row * 1180, "w": W, "h": H, "title": title, "page": "ours-v3", "is_interactive": True}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
        written.append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    with open(os.path.join(tempfile.gettempdir(), "gen13-written.json"), "w", encoding="utf-8") as fh:
        json.dump(written, fh)
    print(len(written), "boards written")


if __name__ == "__main__":
    run(sys.argv[1])
