"""P4 in three variations x three candidate palettes, on a second canvas page."""
import json
import os

from gen import (ABILITIES, MOD, PASSIVE, PROF, ROOT, SAVE, SAVE_PROF, SKILL, SKILL_PROF, SKILLS, HF,
                 icon, page, sg)

# Palette colours are the user's; text greys and lines marked "derived" are added for contrast.
PALETTES = {
    "Lavender": dict(
        swatch="3D52A0 · 7091E6 · 8697C4 · ADBBDA · EDE8F5",
        bg="#EDE8F5", surface="#FFFFFF", outer="#FFFFFF",
        barText="#23262F", barMuted="#5A6275", barHeading="#3D52A0", barLine="#ADBBDA", barActive="#3D52A0", barBtnBg="#3D52A0", barBtnText="#FFFFFF", barHp="#7091E6", barTrack="#ADBBDA",
        text="#23262F", muted="#5A6275", heading="#3D52A0", accent="#3D52A0", onAccent="#FFFFFF",
        bright="#3D52A0", track="#ADBBDA", hp="#7091E6", line="#ADBBDA", link="#3D52A0"),
    "Cream": dict(
        swatch="F7F5E6 · 333A56 · 52658F · E8E8E8",
        bg="#F7F5E6", surface="#FFFFFF", outer="#333A56",
        barText="#F7F5E6", barMuted="#C3C8D8", barHeading="#F7F5E6", barLine="#52658F", barActive="#F7F5E6", barBtnBg="#F7F5E6", barBtnText="#333A56", barHp="#F7F5E6", barTrack="#52658F",
        text="#333A56", muted="#5E6478", heading="#333A56", accent="#333A56", onAccent="#F7F5E6",
        bright="#52658F", track="#E8E8E8", hp="#52658F", line="#DAD7C5", link="#333A56"),
    "Sky": dict(
        swatch="E2F0F9 · B0DDE4 · 286FB4 · FFFFFF · DF4C73",
        bg="#FFFFFF", surface="#FFFFFF", outer="#E2F0F9",
        barText="#23262F", barMuted="#55606B", barHeading="#286FB4", barLine="#B0DDE4", barActive="#DF4C73", barBtnBg="#286FB4", barBtnText="#FFFFFF", barHp="#DF4C73", barTrack="#B0DDE4",
        text="#23262F", muted="#5A6470", heading="#286FB4", accent="#286FB4", onAccent="#FFFFFF",
        bright="#286FB4", track="#E2F0F9", hp="#DF4C73", line="#B0DDE4", link="#286FB4"),
}


# ---- contrast check (WCAG 2 formula) ----
def _lum(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a, b):
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


CHECKS = [("text", "bg", 4.5), ("muted", "bg", 4.5), ("heading", "bg", 3.0), ("text", "surface", 4.5),
          ("muted", "surface", 4.5), ("onAccent", "accent", 4.5), ("barText", "outer", 4.5),
          ("barMuted", "outer", 4.5), ("barHeading", "outer", 3.0), ("bright", "bg", 3.0),
          ("barActive", "outer", 3.0), ("barBtnText", "barBtnBg", 4.5), ("barHp", "barTrack", 1.0)]


def T_(p):
    t = dict(PALETTES[p])
    t["overlay"] = "rgba(0, 0, 0, 0.4)"
    return t


def badge(c, text):
    return (f'<span style="display: inline-flex; align-items: center; height: 20px; padding: 0 7px; '
            f'border: 1px solid {c}; border-radius: 6px; font-size: 12px; font-weight: 600; color: {c}; '
            f'letter-spacing: 0.02em; flex-shrink: 0">{text}</span>')


def dot(T, on, size=10):
    if on:
        return (f'<span style="width: {size}px; height: {size}px; border-radius: 50%; flex-shrink: 0; '
                f'background: {T["bright"]}"></span>')
    return (f'<span style="width: {size}px; height: {size}px; border-radius: 50%; flex-shrink: 0; '
            f'box-sizing: border-box; border: 1.5px solid {T["muted"]}"></span>')


def icon_btn(name, label, color):
    return (f'<button aria-label="{label}" style="width: 44px; height: 44px; flex-shrink: 0; display: flex; '
            f'align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; '
            f'color: {color}">{icon(name, 22)}</button>')


def name_row(T):
    return f"""<div style="height: 56px; box-sizing: border-box; display: flex; align-items: center; gap: 4px; padding: 0 4px 0 16px">
<div style="flex-grow: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px">
<h1 style="margin: 0; {HF}; font-size: 28px; font-weight: 700; line-height: 34px; color: {T['barHeading']}">Iren</h1>
<span style="font-size: 15px; color: {T['barText']}; white-space: nowrap">Fighter 1</span>
{badge(T['barMuted'], '2024')}
</div>
<button aria-label="1 choice to make" style="height: 44px; min-width: 44px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent"><span style="height: 24px; padding: 0 8px; border-radius: 12px; display: flex; align-items: center; background: {T['barBtnBg']}; color: {T['barBtnText']}; font-size: 13px; font-weight: 700">!1</span></button>
{icon_btn('lock', 'Play mode: the sheet is locked', T['barText'])}
</div>"""


def buttons(T, on_bar, grow=False):
    g = "flex-grow: 1; " if grow else ""
    if on_bar:
        dmg = f"background: {T['barBtnBg']}; color: {T['barBtnText']}"
        heal = f"border: 1px solid {T['barMuted']}; color: {T['barText']}"
    else:
        dmg = f"background: {T['accent']}; color: {T['onAccent']}"
        heal = f"border: 1px solid {T['muted']}; color: {T['text']}"
    return (f'<button style="{g}height: 44px; padding: 0 14px; border: 0; border-radius: 10px; {dmg}; font-weight: 600">Damage</button>'
            f'<button style="{g}height: 44px; padding: 0 14px; border-radius: 10px; background: transparent; {heal}; font-weight: 600">Heal</button>')


def hp_row(T, on_bar=True):
    tx, mu = (T["barText"], T["barMuted"]) if on_bar else (T["text"], T["muted"])
    track = T["barTrack"] if on_bar else T["track"]
    fill = T["barHp"] if on_bar else T["hp"]
    return f"""<div style="height: 72px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 16px">
<div style="flex-grow: 1; min-width: 0">
<div style="display: flex; justify-content: space-between; align-items: baseline">
<span style="font-size: 12px; color: {mu}; text-transform: uppercase; letter-spacing: 0.06em">Hit points</span>
<span style="font-size: 20px; font-weight: 700; color: {tx}">12 <span style="font-size: 14px; font-weight: 500; color: {mu}">/ 12</span></span>
</div>
<div style="height: 8px; border-radius: 4px; background: {track}; margin-top: 6px"><div style="width: 100%; height: 8px; border-radius: 4px; background: {fill}"></div></div>
</div>
{buttons(T, on_bar)}
</div>"""


STATS = [("17", "AC"), ("+3", "Initiative"), ("30 ft", "Speed"), ("+2", "Proficiency")]


def stats_row(T):
    cells = "".join(
        f'<button style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; '
        f'padding: 0; border: 0; background: transparent; color: {T["barText"]}">'
        f'<span style="font-size: 21px; font-weight: 700; line-height: 26px">{v}</span>'
        f'<span style="font-size: 12px; color: {T["barMuted"]}">{l}</span></button>' for v, l in STATS)
    return (f'<div style="height: 64px; box-sizing: border-box; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); '
            f'border-top: 1px solid {T["barLine"]}">{cells}</div>')


def tabs(T, pills=False):
    names = ["Main", "Combat", "Spells", "Equipment", "Features", "Notes"]
    out = ""
    for i, t in enumerate(names):
        if pills:
            if i == 0:
                st = f"background: {T['barBtnBg']}; color: {T['barBtnText']}; font-weight: 600"
            else:
                st = f"background: transparent; color: {T['barMuted']}"
            out += (f'<button style="flex-shrink: 0; height: 32px; padding: 0 14px; border: 0; border-radius: 16px; '
                    f'{st}; white-space: nowrap">{t}</button>')
        elif i == 0:
            out += (f'<button style="flex-shrink: 0; height: 44px; box-sizing: border-box; padding: 0 12px; border: 0; '
                    f'border-bottom: 2px solid {T["barActive"]}; background: transparent; color: {T["barText"]}; '
                    f'font-weight: 600; white-space: nowrap">{t}</button>')
        else:
            out += (f'<button style="flex-shrink: 0; height: 44px; padding: 0 12px; border: 0; background: transparent; '
                    f'color: {T["barMuted"]}; white-space: nowrap">{t}</button>')
    align = "align-items: center; gap: 4px; padding-left: 12px" if pills else "padding-left: 4px"
    return (f'<nav aria-label="Sheet tabs" style="height: 44px; box-sizing: border-box; display: flex; '
            f'border-top: 1px solid {T["barLine"]}"><div style="flex-grow: 1; min-width: 0; display: flex; overflow: hidden; '
            f'{align}">{out}</div>{icon_btn("dots", "Tab menu: Edit switch", T["barMuted"])}</nav>')


def bottom_bar(T):
    items = [("Characters", "user"), ("Library", "book"), ("Dice", "dice"), ("Settings", "sliders")]
    out = ""
    for i, (label, ic) in enumerate(items):
        on = i == 0
        out += (f'<button style="display: flex; flex-direction: column; align-items: center; justify-content: center; '
                f'gap: 3px; padding: 0; border: 0; background: transparent; '
                f'color: {T["barText"] if on else T["barMuted"]}; font-size: 12px; font-weight: {600 if on else 500}">'
                f'{icon(ic, 24, T["barActive"] if on else "currentColor")}<span>{label}</span></button>')
    return (f'<nav aria-label="Main" style="height: 64px; flex-shrink: 0; box-sizing: border-box; display: grid; '
            f'grid-template-columns: repeat(4, minmax(0, 1fr)); background: {T["outer"]}; '
            f'border-top: 1px solid {T["barLine"]}">{out}</nav>')


def bar(T, inner, top=True):
    side = "bottom" if top else "top"
    return (f'<div style="flex-shrink: 0; background: {T["outer"]}; border-{side}: 1px solid {T["barLine"]}">'
            f'{inner}</div>')


def h2(T, text, mb=8):
    return (f'<h2 style="margin: 0 0 {mb}px; height: 28px; {HF}; font-size: 20px; font-weight: 700; '
            f'line-height: 28px; color: {T["heading"]}">{text}</h2>')


def main(inner, gap=24):
    return (f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; box-sizing: border-box; '
            f'padding: 16px 16px 24px; display: flex; flex-direction: column; gap: {gap}px">{inner}</main>')


def card(T, extra=""):
    return (f"box-sizing: border-box; border: 1px solid {T['line']}; border-radius: 12px; "
            f"background: {T['surface']}; color: {T['text']}{extra}")


def skills_list(T, n=18):
    rows = ""
    for name, ab in SKILLS[:n]:
        rows += (f'<button style="width: 100%; height: 40px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; '
                 f'padding: 0; border: 0; border-bottom: 1px solid {T["line"]}; background: transparent; color: {T["text"]}; '
                 f'text-align: left">{dot(T, name in SKILL_PROF)}<span style="flex-grow: 1">{name}</span>'
                 f'<span style="font-size: 12px; color: {T["muted"]}; width: 32px">{ab}</span>'
                 f'<span style="font-weight: 600; width: 28px; text-align: right">{sg(SKILL[name])}</span></button>')
    return rows


def passive(T):
    return (f'<div style="height: 48px; display: flex; align-items: center; padding: 0 12px; margin-bottom: 8px; '
            f'{card(T)}"><span style="flex-grow: 1">Passive Perception</span>'
            f'<span style="font-size: 20px; font-weight: 700">{PASSIVE}</span></div>')


# ---- V1 Classic: everything pinned on top, ability tiles ----
def v1(T):
    tiles = ""
    for ab, _, score in ABILITIES:
        tiles += (f'<button style="height: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; '
                  f'gap: 2px; padding: 0; {card(T)}">'
                  f'<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: {T["muted"]}">{ab}</span>'
                  f'<span style="font-size: 30px; font-weight: 700; line-height: 34px">{score}</span>'
                  f'<span style="min-width: 36px; height: 22px; box-sizing: border-box; padding: 0 8px; border: 1px solid {T["line"]}; '
                  f'border-radius: 11px; font-size: 14px; font-weight: 600; line-height: 20px">{sg(MOD[ab])}</span></button>')
    saves = ""
    for ab, name, _ in ABILITIES:
        saves += (f'<button style="height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0; '
                  f'border: 0; border-bottom: 1px solid {T["line"]}; background: transparent; color: {T["text"]}; text-align: left">'
                  f'{dot(T, ab in SAVE_PROF)}<span style="flex-grow: 1">{name}</span>'
                  f'<span style="font-weight: 600">{sg(SAVE[ab])}</span></button>')
    content = (f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{tiles}</div>'
               f'<section>{h2(T, "Saving throws")}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); '
               f'column-gap: 16px; grid-auto-flow: column; grid-template-rows: repeat(3, 44px)">{saves}</div></section>'
               f'<section>{h2(T, "Skills")}{passive(T)}<div>{skills_list(T, 6)}</div></section>')
    head = bar(T, name_row(T) + f'<div style="border-top: 1px solid {T["barLine"]}">{hp_row(T)}</div>' + stats_row(T) + tabs(T))
    return head + main(content) + bottom_bar(T)


# ---- V2 Cards: small pinned header, hit points and stats as cards ----
def v2(T):
    hp = f"""<section style="{card(T, '; padding: 14px')}">
<div style="display: flex; justify-content: space-between; align-items: baseline">
<span style="font-size: 12px; color: {T['muted']}; text-transform: uppercase; letter-spacing: 0.06em">Hit points</span>
<span style="font-size: 28px; font-weight: 700; line-height: 34px">12 <span style="font-size: 16px; font-weight: 500; color: {T['muted']}">/ 12</span></span>
</div>
<div style="height: 10px; border-radius: 5px; background: {T['track']}; margin: 8px 0 12px"><div style="width: 100%; height: 10px; border-radius: 5px; background: {T['hp']}"></div></div>
<div style="display: flex; gap: 8px">{buttons(T, False, grow=True)}</div>
</section>"""
    stats = "".join(
        f'<button style="height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; '
        f'gap: 2px; padding: 0; {card(T)}"><span style="font-size: 20px; font-weight: 700; line-height: 24px">{v}</span>'
        f'<span style="font-size: 12px; color: {T["muted"]}">{l}</span></button>' for v, l in STATS)
    abil = ""
    for ab, name, score in ABILITIES:
        abil += (f'<button style="height: 68px; display: flex; align-items: center; gap: 8px; padding: 0 12px; {card(T)}; text-align: left">'
                 f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px">'
                 f'<span style="font-size: 13px; font-weight: 600">{name}</span>'
                 f'<span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: {T["muted"]}">'
                 f'{dot(T, ab in SAVE_PROF, 8)}Save {sg(SAVE[ab])}</span></span>'
                 f'<span style="display: flex; flex-direction: column; align-items: flex-end">'
                 f'<span style="font-size: 26px; font-weight: 700; line-height: 30px">{sg(MOD[ab])}</span>'
                 f'<span style="font-size: 12px; color: {T["muted"]}">{score}</span></span></button>')
    content = (hp + f'<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px">{stats}</div>'
               f'<section>{h2(T, "Abilities and saves")}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); '
               f'gap: 8px">{abil}</div></section>'
               f'<section>{h2(T, "Skills")}{passive(T)}<div>{skills_list(T, 6)}</div></section>')
    head = bar(T, name_row(T) + tabs(T, pills=True))
    return head + main(content, 16) + bottom_bar(T)


# ---- V3 Thumb: hit points and tabs pinned at the bottom, near the thumb ----
def v3(T):
    top = bar(T, name_row(T) + stats_row(T))
    tiles = ""
    for ab, _, score in ABILITIES:
        tiles += (f'<button style="height: 76px; display: flex; flex-direction: column; align-items: center; justify-content: center; '
                  f'gap: 1px; padding: 0; {card(T)}">'
                  f'<span style="font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: {T["muted"]}">{ab}</span>'
                  f'<span style="font-size: 22px; font-weight: 700; line-height: 28px">{sg(MOD[ab])}</span>'
                  f'<span style="font-size: 12px; color: {T["muted"]}">{score}</span></button>')
    chips = ""
    for ab, _, _ in ABILITIES:
        chips += (f'<button style="height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0; '
                  f'{card(T)}"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: {T["muted"]}">{ab}</span>'
                  f'{dot(T, ab in SAVE_PROF, 8)}<span style="font-weight: 700">{sg(SAVE[ab])}</span></button>')
    rows = ""
    for name, _ in SKILLS:
        p = name in SKILL_PROF
        rows += (f'<button style="height: 40px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0; '
                 f'border: 0; border-bottom: 1px solid {T["line"]}; background: transparent; color: {T["text"]}; text-align: left; '
                 f'font-size: 14px">{dot(T, p, 8)}<span style="flex-grow: 1; white-space: nowrap; overflow: hidden">{name}</span>'
                 f'<span style="font-weight: {700 if p else 500}">{sg(SKILL[name])}</span></button>')
    skills_head = (f'<div style="display: flex; align-items: baseline; justify-content: space-between">{h2(T, "Skills")}'
                   f'<span style="font-size: 13px; color: {T["muted"]}">Passive Perception '
                   f'<span style="font-size: 15px; font-weight: 700; color: {T["text"]}">{PASSIVE}</span></span></div>')
    content = (f'<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px">{tiles}</div>'
               f'<section>{h2(T, "Saving throws")}<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); '
               f'gap: 8px">{chips}</div></section>'
               f'<section>{skills_head}<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 14px; '
               f'grid-auto-flow: column; grid-template-rows: repeat(9, 40px)">{rows}</div></section>')
    dock = bar(T, hp_row(T) + tabs(T), top=False)
    return top + main(content, 20) + dock + bottom_bar(T)


VARIANTS = [("V1", "Classic", v1), ("V2", "Cards", v2), ("V3", "Thumb", v3)]


def run():
    for p in PALETTES:
        t = PALETTES[p]
        for a, b, need in CHECKS:
            r = ratio(t[a], t[b])
            print(f"{p:9} {a:>10} on {b:<8} {r:5.2f} {'ok' if r >= need else 'FAIL (needs ' + str(need) + ')'}")

    path = os.path.join(ROOT, "canvas.json")
    with open(path, encoding="utf-8") as f:
        canvas = json.load(f)
    canvas["pages"] = [{"id": "first-look", "name": "First look"}, {"id": "p4-palettes", "name": "P4 · 3 palettes"}]
    canvas["launch"] = {"view": "canvas", "page": "p4-palettes"}
    y = 0
    for p in PALETTES:
        canvas["notes"][f"pal-{p.lower()}"] = {"x": 0, "y": y, "text": f"{p}: {PALETTES[p]['swatch']}",
                                               "kind": "title1", "maxW": 1160, "page": "p4-palettes"}
        for i, (vid, vname, fn) in enumerate(VARIANTS):
            fname = f"P4-{p}-{vid}.dc.html"
            html = page(f"Sheet, {p}, {vname}", 800, fn(T_(p)), T_(p), "EB Garamond")
            with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as f:
                f.write(html)
            canvas["boards"][fname] = {"x": i * 440, "y": y + 260, "w": 360, "h": 800,
                                       "title": f"{p} · {vid} {vname}", "page": "p4-palettes"}
            if fname not in canvas["order"]:
                canvas["order"].append(fname)
        y += 260 + 800 + 120
    with open(path, "w", encoding="utf-8") as f:
        json.dump(canvas, f, indent=1, ensure_ascii=False)
    print(sorted(k for k in canvas["boards"] if k.startswith("P4-")))


if __name__ == "__main__":
    run()
