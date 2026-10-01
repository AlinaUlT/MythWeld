"""Six retro / weird game-app looks for Iren's sheet, on a third canvas page."""
import json
import os
import sys

from gen import ABILITIES, MOD, PASSIVE, SAVE, SAVE_PROF, SKILL, SKILL_PROF, SKILLS, ROOT, sg

W, H = 360, 800
PROF_SKILLS = [n for n, _ in SKILLS if n in SKILL_PROF]


def ascii_sg(n):
    return f"+{n}" if n >= 0 else f"-{-n}"


def page(title, fonts, body, root_style):
    fam = "&amp;".join(f"family={f}" for f in fonts)
    link = f'<link href="https://fonts.googleapis.com/css2?{fam}&amp;display=swap" rel="stylesheet">' if fonts else ""
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
{link}
<style>
body{{margin:0;background:#000}}
button{{font-family:inherit;font-size:inherit;margin:0;cursor:pointer}}
</style>
</helmet>
<div style="width: {W}px; height: {H}px; box-sizing: border-box; position: relative; overflow: hidden; {root_style}">
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


# ---------------------------------------------------------------- 1. Win95 shareware
def win95():
    bevel = ("border: 2px solid; border-color: #ffffff #404040 #404040 #ffffff; "
             "box-shadow: inset -1px -1px 0 #808080, inset 1px 1px 0 #dfdfdf")
    sunken = ("border: 2px solid; border-color: #808080 #ffffff #ffffff #808080; "
              "box-shadow: inset 1px 1px 0 #404040")

    def btn(t, w=None):
        ws = f"width: {w}px; " if w else "padding: 0 8px; "
        return (f'<button style="{ws}height: 26px; background: #c0c0c0; color: #000; font-size: 12px; {bevel}">{t}</button>')

    def field(label, value, w=None):
        ws = f"width: {w}px; " if w else "flex-grow: 1; "
        return (f'<div style="display: flex; align-items: center; gap: 4px; {ws}"><span>{label}</span>'
                f'<span style="flex-grow: 1; height: 20px; line-height: 16px; padding: 0 4px; background: #fff; '
                f'box-sizing: border-box; {sunken}">{value}</span></div>')

    def fieldset(legend, inner, extra=""):
        return (f'<fieldset style="margin: 0; padding: 6px 8px 8px; border: 2px groove #ffffff; {extra}">'
                f'<legend style="padding: 0 3px">{legend}</legend>{inner}</fieldset>')

    tick = '<span style="display: inline-block; width: 11px; height: 11px; line-height: 10px; font-size: 11px; text-align: center; background: #fff; border: 1px solid #808080; box-sizing: border-box">{}</span>'
    rows = ""
    for ab, name, score in ABILITIES:
        rows += (f'<tr><td style="padding: 1px 4px">{name}</td><td style="text-align: center">{score}</td>'
                 f'<td style="text-align: center">{sg(MOD[ab])}</td><td style="text-align: center">{sg(SAVE[ab])}</td>'
                 f'<td style="text-align: center">{tick.format("✓" if ab in SAVE_PROF else "")}</td></tr>')
    table = (f'<table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; {sunken}">'
             f'<tr style="background: #c0c0c0"><th style="text-align: left; padding: 1px 4px; font-weight: 400; {bevel}">Ability</th>'
             f'<th style="font-weight: 400; {bevel}">Score</th><th style="font-weight: 400; {bevel}">Mod</th>'
             f'<th style="font-weight: 400; {bevel}">Save</th><th style="font-weight: 400; {bevel}">Prof</th></tr>{rows}</table>')
    items = ""
    for i, (n, ab) in enumerate(SKILLS):
        sel = n == "Athletics"
        st = "background: #000080; color: #fff; " if sel else ""
        items += (f'<div style="{st}height: 17px; line-height: 17px; padding: 0 4px; display: flex; gap: 6px">'
                  f'{tick.format("✓" if n in SKILL_PROF else "")}<span style="flex-grow: 1">{n} ({ab.title()})</span>'
                  f'<span>{sg(SKILL[n])}</span></div>')
    listbox = (f'<div style="display: flex; height: 170px; background: #fff; {sunken}">'
               f'<div style="flex-grow: 1; overflow: hidden; font-size: 12px">{items}</div>'
               f'<div style="width: 16px; background: repeating-conic-gradient(#c0c0c0 0 25%, #fff 0 50%) 0 0 / 2px 2px; display: flex; flex-direction: column; justify-content: space-between">'
               f'<span style="height: 16px; background: #c0c0c0; box-sizing: border-box; font-size: 8px; text-align: center; line-height: 12px; {bevel}">▲</span>'
               f'<span style="height: 40px; background: #c0c0c0; box-sizing: border-box; margin-top: -60px; {bevel}"></span>'
               f'<span style="height: 16px; background: #c0c0c0; box-sizing: border-box; font-size: 8px; text-align: center; line-height: 12px; {bevel}">▼</span></div></div>')
    hp_bar = (f'<div style="height: 18px; padding: 2px; background: #fff; box-sizing: border-box; {sunken}">'
              f'<div style="height: 10px; background: repeating-linear-gradient(90deg, #000080 0 8px, transparent 8px 10px)"></div></div>')
    body = f"""<div style="margin: 6px 6px 0; flex-grow: 1; display: flex; flex-direction: column; background: #c0c0c0; {bevel}; padding: 2px">
<div style="height: 20px; display: flex; align-items: center; gap: 4px; padding: 0 2px 0 4px; background: linear-gradient(90deg, #000080, #1084d0); color: #fff; font-weight: 700; font-size: 12px">
<span style="flex-grow: 1; white-space: nowrap; overflow: hidden">IREN.CHR - Character Sheet</span>
{btn('_', 16).replace('height: 26px', 'height: 14px; line-height: 6px; font-size: 10px')}{btn('□', 16).replace('height: 26px', 'height: 14px; line-height: 6px; font-size: 10px')}{btn('×', 16).replace('height: 26px', 'height: 14px; line-height: 6px; font-size: 11px')}
</div>
<div style="height: 20px; display: flex; gap: 12px; align-items: center; padding: 0 6px; font-size: 12px"><span><u>F</u>ile</span><span><u>E</u>dit</span><span><u>V</u>iew</span><span><u>R</u>oll</span><span><u>H</u>elp</span></div>
<div style="height: 32px; display: flex; gap: 3px; align-items: center; padding: 0 4px; border-top: 1px solid #808080; border-bottom: 1px solid #fff">{btn('Damage')}{btn('Heal')}{btn('Rest...')}{btn('Roll...')}</div>
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px; padding: 6px; font-size: 12px; overflow: hidden">
{fieldset('Character', '<div style="display: flex; gap: 6px; margin-bottom: 4px">' + field('Name:', 'Iren') + field('Level:', '1', 70) + '</div><div style="display: flex; gap: 6px">' + field('Class:', 'Fighter') + field('Species:', 'Human') + '</div>')}
{fieldset('Vital statistics', '<div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px"><span>HP:</span><div style="flex-grow: 1">' + hp_bar + '</div><span>12 / 12</span></div><div style="display: flex; gap: 6px">' + field('AC:', '17') + field('Init:', '+3') + field('Spd:', '30') + '</div>')}
{fieldset('Ability scores', table)}
{fieldset('Skills', listbox)}
</div>
<div style="height: 20px; display: flex; gap: 2px; font-size: 11px">
<span style="flex-grow: 1; padding: 0 4px; line-height: 16px; {sunken}">Ready</span><span style="padding: 0 4px; line-height: 16px; {sunken}">2024 rules</span><span style="padding: 0 4px; line-height: 16px; {sunken}">NUM</span>
</div>
</div>
<div style="height: 30px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 3px; margin-top: 6px; background: #c0c0c0; border-top: 2px solid #fff; font-size: 12px">
<button style="height: 22px; padding: 0 6px; background: #c0c0c0; font-weight: 700; font-size: 12px; {bevel}">Start</button>
<span style="height: 22px; flex-grow: 1; line-height: 18px; padding: 0 6px; box-sizing: border-box; font-weight: 700; {sunken}; background: repeating-conic-gradient(#c0c0c0 0 25%, #fff 0 50%) 0 0 / 2px 2px">IREN.CHR</span>
<span style="height: 22px; line-height: 18px; padding: 0 8px; box-sizing: border-box; {sunken}">12:00 PM</span>
</div>"""
    return page("Win95 shareware", [], body,
                "display: flex; flex-direction: column; background: #008080; color: #000; "
                "font-family: Tahoma, Verdana, 'MS Sans Serif', sans-serif")


# ---------------------------------------------------------------- 2. 16-bit RPG menu
FACE = ["..hhhh..", ".hhhhhh.", "hhsssshh", "hsessesh", ".ssssss.", ".ssmmss.", "..ssss..", ".aaaaaa."]
FACE_COL = {"h": "#6b3a1e", "s": "#f0c090", "e": "#202020", "m": "#c04040", "a": "#9aa4b0", ".": "transparent"}


def rpg():
    win = ("background: linear-gradient(180deg, #3050c8 0%, #182878 100%); border: 3px solid #f8f8f8; "
           "border-radius: 8px; box-shadow: 0 0 0 3px #000, inset 0 0 0 2px #0c1450; padding: 12px; box-sizing: border-box")
    px = "".join(f'<span style="background: {FACE_COL[c]}"></span>' for row in FACE for c in row)
    face = (f'<div style="width: 64px; height: 64px; flex-shrink: 0; display: grid; grid-template-columns: repeat(8, 8px); '
            f'grid-template-rows: repeat(8, 8px); background: #102060; border: 2px solid #f8f8f8">{px}</div>')
    stats = "".join(f'<div>{ab} <span style="color: #f8e060">{score:>2}</span> {sg(MOD[ab]).replace(chr(8722), "-")}</div>'
                    for ab, _, score in ABILITIES)
    pointer = ('<span style="display: inline-block; width: 0; height: 0; border-top: 6px solid transparent; '
               'border-bottom: 6px solid transparent; border-left: 9px solid #fff; margin-right: 8px; '
               'filter: drop-shadow(2px 2px 0 #000)"></span>')
    cmds = ""
    for i, c in enumerate(["FIGHT", "SKILL", "ITEM", "REST", "SAVE"]):
        p = pointer if i == 1 else '<span style="display: inline-block; width: 17px"></span>'
        cmds += f'<button style="display: flex; align-items: center; height: 26px; padding: 0; border: 0; background: transparent; color: #fff; text-shadow: 2px 2px 0 #000">{p}{c}</button>'
    skills = "".join(f'<div style="display: flex; justify-content: space-between"><span>{n.upper()[:12]}</span>'
                     f'<span style="color: #f8e060">{sg(SKILL[n])}</span></div>' for n in PROF_SKILLS)
    body = f"""<div style="{win}; display: flex; gap: 12px; align-items: center">
{face}
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px">
<div style="font-size: 14px">IREN</div>
<div>FIGHTER <span style="color: #f8e060">LV 1</span></div>
<div style="display: flex; align-items: center; gap: 6px">HP<div style="flex-grow: 1; height: 8px; border: 2px solid #f8f8f8; background: #000"><div style="width: 100%; height: 8px; background: #40e040"></div></div></div>
<div style="text-align: right">12/ 12</div>
</div>
</div>
<div style="{win}; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 8px">{stats}</div>
<div style="{win}; display: flex; justify-content: space-between"><span>AC <span style="color: #f8e060">17</span></span><span>INIT <span style="color: #f8e060">+3</span></span><span>SPD <span style="color: #f8e060">30</span></span></div>
<div style="display: flex; gap: 8px; flex-grow: 1; min-height: 0">
<div style="{win}; width: 124px; flex-shrink: 0; display: flex; flex-direction: column">{cmds}</div>
<div style="{win}; flex-grow: 1; display: flex; flex-direction: column; gap: 10px"><div style="color: #a8c8ff">SKILLS</div>{skills}<div style="display: flex; justify-content: space-between; margin-top: auto"><span>PASSIVE PER</span><span style="color: #f8e060">{PASSIVE}</span></div></div>
</div>
<div style="{win}; height: 96px; position: relative; line-height: 22px">WHAT WILL IREN DO?<br>SECOND WIND: 2/2<span style="position: absolute; right: 14px; bottom: 10px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 9px solid #fff"></span></div>"""
    return page("16-bit RPG menu", ["Press+Start+2P"], body,
                "display: flex; flex-direction: column; gap: 10px; padding: 12px; background: #000; color: #fff; "
                "font-family: 'Press Start 2P', monospace; font-size: 10px; line-height: 16px; text-shadow: 2px 2px 0 #000")


# ---------------------------------------------------------------- 3. green-screen terminal
def terminal():
    L = ["GRIMOIRE OS 1.0   640K RAM OK", "READY.", '> LOAD "IREN"', "LOADING............ DONE", "",
         "+------------------------------+",
         "| IREN    HUMAN FIGHTER  LV 01 |",
         "| RULES 2024   BKGD SOLDIER    |",
         "+------------------------------+",
         " HP [################] 12/12",
         " AC 17  INIT +3  SPD 30  PB +2", "",
         " ATTR  SCORE  MOD  SAVE"]
    for ab, _, score in ABILITIES:
        star = " *" if ab in SAVE_PROF else ""
        L.append(f" {ab}   {score:>5}  {ascii_sg(MOD[ab]):>3}  {ascii_sg(SAVE[ab]):>4}{star}")
    L += ["", " SKILLS  (* = PROFICIENT)"]
    for n in PROF_SKILLS:
        L.append(f" *{n.upper():.<20}{ascii_sg(SKILL[n]):.>4}")
    L += [f" PASSIVE PERCEPTION{str(PASSIVE):.>5}", "", "> ROLL ATHLETICS",
          f" D20 [14] {ascii_sg(SKILL['Athletics'])} = 19   (SAMPLE)"]
    assert max(len(x) for x in L) <= 32, max(L, key=len)
    text = "\n".join(L).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    body = f"""<pre style="margin: 0; padding: 14px 14px 0; font-family: VT323, monospace; font-size: 20px; line-height: 19px; white-space: pre; color: #39ff6a; text-shadow: 0 0 5px rgba(57, 255, 106, 0.8)">{text}
&gt; <span style="background: #39ff6a; color: #031a08">_</span></pre>
<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 30px; display: flex; gap: 0; font-family: VT323, monospace; font-size: 18px; line-height: 30px">
<span style="flex-grow: 1; background: #39ff6a; color: #031a08; text-align: center">F1 HELP</span><span style="flex-grow: 1; background: #031a08; color: #39ff6a; text-align: center">F2 ROLL</span><span style="flex-grow: 1; background: #39ff6a; color: #031a08; text-align: center">F3 REST</span><span style="flex-grow: 1; background: #031a08; color: #39ff6a; text-align: center">F10 QUIT</span>
</div>
<div style="position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.28) 0px, rgba(0, 0, 0, 0.28) 1px, transparent 1px, transparent 3px)"></div>
<div style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.75) 100%)"></div>"""
    return page("Green-screen terminal", ["VT323"], body, "background: #031a08")


# ---------------------------------------------------------------- 4. parchment overload
def parchment():
    ink = "#3b2008"
    roman = {12: "XII", 17: "XVII", 30: "XXX"}
    shields = ""
    for ab, _, score in ABILITIES:
        shields += (f'<button style="height: 84px; display: flex; flex-direction: column; align-items: center; justify-content: center; '
                    f'border: 4px double {ink}; border-radius: 6px 6px 50% 50%; background: rgba(255, 244, 210, 0.45); color: {ink}; '
                    f"font-family: Almendra, serif\">"
                    f'<span style="font-family: \'Uncial Antiqua\', serif; font-size: 12px">{ab}</span>'
                    f'<span style="font-size: 26px; font-weight: 700; line-height: 28px">{score}</span>'
                    f'<span style="font-size: 14px">{sg(MOD[ab])}</span></button>')
    leaders = "".join(
        f'<div style="display: flex; align-items: baseline; gap: 4px"><span>{n}</span>'
        f'<span style="flex-grow: 1; border-bottom: 2px dotted {ink}; transform: translateY(-4px)"></span>'
        f'<span style="font-weight: 700">{sg(SKILL[n])}</span></div>' for n in PROF_SKILLS)
    body = f"""<div style="position: absolute; top: 14px; right: 14px; width: 62px; height: 62px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #e0503c, #8a1010 70%); box-shadow: 0 0 0 4px #9c1a14, 3px 4px 8px rgba(60, 10, 0, 0.6); display: flex; align-items: center; justify-content: center; font-family: 'Pirata One', serif; font-size: 36px; color: #f3c9a0; transform: rotate(-14deg)">G</div>
<div style="padding: 22px 20px 0; text-align: center">
<div style="font-family: UnifrakturMaguntia, serif; font-size: 64px; line-height: 64px; color: #7a0f0f; text-shadow: 1px 1px 0 #f6e7b8">Iren</div>
<div style="font-family: 'IM Fell English', serif; font-style: italic; font-size: 18px">Human Fighter of the First Level</div>
<div style="font-family: Papyrus, 'Uncial Antiqua', fantasy; font-size: 13px; margin-top: 2px">~ by the Rules of 2024 ~</div>
</div>
<div style="margin: 12px 20px 0; font-family: 'Uncial Antiqua', serif; font-size: 17px; text-align: center">⁂ Vital Signs ⁂</div>
<div style="margin: 6px 20px 0; font-family: 'IM Fell English', serif; font-size: 17px; line-height: 24px"><span style="float: left; font-family: UnifrakturMaguntia, serif; font-size: 50px; line-height: 44px; color: #7a0f0f; margin-right: 4px">H</span>it Points {roman[12]} of {roman[12]}. Armour Class {roman[17]}. Initiative +III. Speed {roman[30]} feet.</div>
<div style="display: flex; gap: 10px; margin: 12px 20px 0">
<button style="flex-grow: 1; height: 44px; border: 3px double {ink}; background: rgba(122, 15, 15, 0.85); color: #f6e7b8; font-family: Almendra, serif; font-size: 17px; font-weight: 700">Smite Thyself</button>
<button style="flex-grow: 1; height: 44px; border: 3px double {ink}; background: rgba(255, 244, 210, 0.5); color: {ink}; font-family: Almendra, serif; font-size: 17px; font-weight: 700">Mend Wounds</button>
</div>
<div style="margin: 14px 20px 0; font-family: 'Uncial Antiqua', serif; font-size: 17px; text-align: center">⁂ Ye Abilities ⁂</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 8px 20px 0">{shields}</div>
<div style="margin: 14px 20px 0; font-family: 'Uncial Antiqua', serif; font-size: 17px; text-align: center">⁂ Skills Most Fine ⁂</div>
<div style="margin: 4px 24px 0; font-family: 'IM Fell English', serif; font-size: 16px; line-height: 23px">{leaders}</div>
<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 52px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); background: linear-gradient(#5a3210, #2e1806); border-top: 3px double #c9a15a; font-family: 'Uncial Antiqua', serif; font-size: 11px; color: #f0d9a0; text-align: center; align-items: center"><span>Scrolls</span><span>Tome</span><span>Bones</span><span>Arcana</span></div>
<div style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 78% 64%, transparent 40px, rgba(110, 60, 15, 0.35) 42px, rgba(110, 60, 15, 0.12) 46px, transparent 49px), radial-gradient(circle at 12% 88%, rgba(90, 50, 10, 0.25), transparent 60px); box-shadow: inset 0 0 70px 18px rgba(96, 52, 12, 0.85)"></div>"""
    return page("Parchment overload",
                ["UnifrakturMaguntia", "Uncial+Antiqua", "IM+Fell+English:ital@0;1", "Almendra:wght@400;700", "Pirata+One"],
                body, f"color: {ink}; background: radial-gradient(ellipse at 30% 20%, #f6e7b8 0%, #ead190 45%, #c9a15a 100%)")


# ---------------------------------------------------------------- 5. wood and leather
def wood():
    rivet = ('<span style="position: absolute; width: 8px; height: 8px; border-radius: 50%; '
             'background: radial-gradient(circle at 35% 35%, #fff6c0, #8a6414 70%); {}"></span>')
    rivets = "".join(rivet.format(p) for p in ["top: 6px; left: 6px", "top: 6px; right: 6px",
                                                 "bottom: 6px; left: 6px", "bottom: 6px; right: 6px"])
    leather = ("position: relative; background: radial-gradient(ellipse at 30% 20%, #8a3322, #4e160c 80%); "
               "border-radius: 14px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15); "
               "outline: 2px dashed #e0b070; outline-offset: -7px; padding: 14px 16px; color: #f3dfc0")

    def glossy(t, top, mid, low):
        return (f'<button style="flex-grow: 1; height: 44px; border: 1px solid rgba(0, 0, 0, 0.6); border-radius: 12px; '
                f'background: linear-gradient({top}, {mid} 50%, {low} 51%, {mid}); color: #fff; font-family: Georgia, serif; '
                f'font-size: 17px; font-weight: 700; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.6); '
                f'box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 2px 3px rgba(0, 0, 0, 0.5)">{t}</button>')
    coins = ""
    for ab, _, score in ABILITIES:
        coins += (f'<button style="width: 88px; height: 88px; justify-self: center; border-radius: 50%; border: 3px solid #6d5210; '
                  f'background: radial-gradient(circle at 35% 30%, #fff3b0, #d9a93a 45%, #8a6414 90%); color: #3a2804; '
                  f'box-shadow: 0 3px 6px rgba(0, 0, 0, 0.6), inset 0 0 0 4px rgba(255, 240, 180, 0.35); display: flex; '
                  f'flex-direction: column; align-items: center; justify-content: center; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6)">'
                  f'<span style="font-family: Rye, serif; font-size: 12px">{ab}</span>'
                  f'<span style="font-family: Rye, serif; font-size: 26px; line-height: 28px">{score}</span>'
                  f'<span style="font-size: 13px; font-weight: 700">{sg(MOD[ab])}</span></button>')
    felt = "".join(f'<div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.15); padding: 4px 0">'
                   f'<span>{n}</span><span style="font-weight: 700">{sg(SKILL[n])}</span></div>' for n in PROF_SKILLS[:4])
    tabs = "".join(f'<span style="display: flex; flex-direction: column; align-items: center; gap: 2px; color: {"#fff" if i == 0 else "#9aa0a8"}">'
                   f'<span style="width: 22px; height: 22px; border-radius: 6px; background: {"linear-gradient(#7fb8ff, #1a64d0)" if i == 0 else "linear-gradient(#6a6f78, #3a3e44)"}; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5)"></span>{t}</span>'
                   for i, t in enumerate(["Characters", "Library", "Dice", "Settings"]))
    body = f"""<div style="position: relative; margin: 12px 12px 0; height: 64px; border-radius: 6px; background: linear-gradient(180deg, #f7e08a, #c9982f 48%, #b8862b 52%, #f0d070); box-shadow: 0 3px 6px rgba(0, 0, 0, 0.6), inset 0 1px 0 #fff8d0; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: Rye, serif; color: #4a2f08; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7)">{rivets}<span style="font-size: 30px">IREN</span><span style="font-size: 13px">FIGHTER · LV 1</span></div>
<div style="{leather}; margin: 12px 12px 0">
<div style="display: flex; justify-content: space-between; font-family: Rye, serif; font-size: 14px"><span>HIT POINTS</span><span>12 / 12</span></div>
<div style="height: 16px; margin: 8px 0 12px; border-radius: 8px; background: linear-gradient(#ff8a7a, #d0301f 50%, #a01f10 51%, #e04a38); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.5)"></div>
<div style="display: flex; gap: 10px">{glossy('Damage', '#ff9a8a', '#c0301f', '#a01f10')}{glossy('Heal', '#9be08a', '#3c9a2a', '#2a7a1c')}</div>
</div>
<div style="{leather}; margin: 12px 12px 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">{coins}</div>
<div style="position: relative; margin: 12px 12px 0; padding: 12px 16px; border-radius: 12px; background: radial-gradient(ellipse at center, #1f7a3a, #0c3f1c 90%); outline: 2px dashed #d8c890; outline-offset: -6px; color: #f4ecd0; font-family: Georgia, serif; font-size: 15px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6)"><div style="font-family: Rye, serif; font-size: 14px; margin-bottom: 4px">SKILLS</div>{felt}</div>
<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 56px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: center; justify-items: center; background: linear-gradient(#4a4e56, #1c1e22 50%, #0c0d10 51%, #22252a); border-top: 1px solid #6a6f78; font-family: Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 700">{tabs}</div>"""
    return page("Wood and leather", ["Rye"], body,
                "font-family: Georgia, serif; background-color: #6b3f1d; background-image: "
                "repeating-linear-gradient(92deg, rgba(0, 0, 0, 0.18) 0px, rgba(0, 0, 0, 0) 3px, rgba(255, 220, 160, 0.08) 7px, rgba(0, 0, 0, 0.12) 11px, rgba(0, 0, 0, 0) 16px), "
                "linear-gradient(90deg, #6b3f1d, #82502a 30%, #5e3517 60%, #7a4a24)")


# ---------------------------------------------------------------- 6. early homepage
def homepage():
    rainbow = ["#ff2020", "#ff9a00", "#ffee00", "#30ff30", "#20e0ff", "#4060ff", "#e040ff"]
    title = "".join(f'<span style="color: {rainbow[i % 7]}">{c}</span>' for i, c in enumerate("'S HOMEPAGE"))
    rows = "".join(
        f'<tr style="background: {"#ffff99" if i % 2 else "#ccffff"}"><td style="padding: 2px 6px; border: 2px inset #c0c0c0">{name}</td>'
        f'<td style="padding: 2px 6px; border: 2px inset #c0c0c0; text-align: center"><b>{score}</b></td>'
        f'<td style="padding: 2px 6px; border: 2px inset #c0c0c0; text-align: center">{sg(MOD[ab])}</td></tr>'
        for i, (ab, name, score) in enumerate(ABILITIES))
    links = " ".join(f'<a href="#" style="color: #4da6ff">{n} {sg(SKILL[n])}</a>' for n in PROF_SKILLS)
    hr = '<div style="height: 4px; margin: 10px 0; background: linear-gradient(90deg, #ff2020, #ff9a00, #ffee00, #30ff30, #20e0ff, #4060ff, #e040ff)"></div>'
    body = f"""<div style="text-align: center; padding: 14px 12px 0">
<div style="position: relative; display: inline-block"><span style="font-family: Monoton, cursive; font-size: 46px; line-height: 50px; color: #ff4fd8">IREN</span><span style="position: absolute; top: -4px; right: -52px; transform: rotate(18deg); background: #ff0000; color: #ffff00; font-family: Impact, 'Arial Black', sans-serif; font-size: 14px; padding: 1px 6px; border: 2px solid #ffff00">NEW!</span></div>
<div style="font-family: 'Comic Neue', 'Comic Sans MS', cursive; font-weight: 700; font-size: 26px; line-height: 30px">{title}</div>
<div style="font-family: Creepster, cursive; font-size: 28px; color: #7CFC00; margin-top: 6px; letter-spacing: 1px">WELCOME ADVENTURER!!!</div>
</div>
<div style="margin: 10px 0; height: 30px; display: flex; align-items: center; justify-content: center; background: repeating-linear-gradient(45deg, #000 0px, #000 12px, #ffd400 12px, #ffd400 24px); font-family: Impact, 'Arial Black', sans-serif; font-size: 18px; color: #fff; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000">UNDER CONSTRUCTION</div>
<div style="padding: 0 12px">
<p style="margin: 0 0 8px; font-family: 'Comic Neue', 'Comic Sans MS', cursive; font-size: 16px; color: #fff">Hi!! This is my FIGHTER!! Level 1 with <b style="color: #ff4040">12 HP</b> and <b style="color: #40c0ff">AC 17</b>. Initiative +3!!</p>
<table style="width: 100%; border-collapse: separate; border: 4px outset #c0c0c0; background: #c0c0c0; font-family: 'Times New Roman', Times, serif; font-size: 16px; color: #000">
<tr style="background: #000080; color: #ffff00"><th style="padding: 2px 6px">MY STATS</th><th>SCORE</th><th>MOD</th></tr>{rows}</table>
{hr}
<p style="margin: 0; font-family: 'Times New Roman', Times, serif; font-size: 17px; color: #fff; line-height: 24px"><b style="color: #ffee00">MY SKILLZ:</b> {links}</p>
{hr}
<div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-family: 'Times New Roman', serif; font-size: 14px; color: #fff">You are visitor #<span style="background: #000; border: 2px inset #808080; padding: 0 4px; font-family: VT323, monospace; font-size: 22px; color: #ff2020; letter-spacing: 2px">0000042</span></div>
<p style="margin: 8px 0 0; text-align: center; font-family: 'Times New Roman', serif; font-size: 14px; color: #fff"><a href="#" style="color: #4da6ff">Sign my guestbook!</a> · <a href="#" style="color: #c080ff">&lt;&lt; Prev</a> | Fighter Webring | <a href="#" style="color: #c080ff">Next &gt;&gt;</a></p>
<p style="margin: 6px 0 0; text-align: center; font-family: Arial, sans-serif; font-size: 11px; color: #aaa">Best viewed at 800x600</p>
</div>"""
    return page("Early homepage", ["Monoton", "Comic+Neue:wght@400;700", "Creepster", "VT323"], body,
                "background-color: #000018; background-image: radial-gradient(#ffffff 1px, transparent 1.6px), "
                "radial-gradient(#ffee88 1px, transparent 1.6px); background-size: 41px 41px, 67px 67px; "
                "background-position: 0 0, 22px 31px; color: #fff")


STYLES = [("Retro-Win95.dc.html", "Win95 shareware", win95),
          ("Retro-RPG.dc.html", "16-bit RPG menu", rpg),
          ("Retro-Terminal.dc.html", "Green-screen terminal", terminal),
          ("Retro-Parchment.dc.html", "Parchment overload", parchment),
          ("Retro-Wood.dc.html", "Wood and leather", wood),
          ("Retro-Homepage.dc.html", "Early homepage", homepage)]


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as f:
        canvas = json.load(f)
    pages = canvas.get("pages") or []
    if not any(p["id"] == "retro" for p in pages):
        pages.append({"id": "retro", "name": "Retro and weird"})
    canvas["pages"] = pages
    canvas["launch"] = {"view": "canvas", "page": "retro"}
    canvas["notes"]["retro-title"] = {"x": 0, "y": 0, "text": "Retro and weird: old game-app looks",
                                      "kind": "title1", "maxW": 1160, "page": "retro"}
    for i, (fname, title, fn) in enumerate(STYLES):
        with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as f:
            f.write(fn())
        canvas["boards"][fname] = {"x": (i % 3) * 440, "y": 260 + (i // 3) * 920, "w": W, "h": H,
                                   "title": title, "page": "retro"}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(canvas, f, indent=1, ensure_ascii=False)
    print("pages:", [p["id"] for p in canvas["pages"]], "boards:", len(canvas["boards"]))


if __name__ == "__main__":
    run(sys.argv[1])
