"""ADR 012: library list page and the floating entry window, on page 'Our design v3'."""
import json
import os
import sys

import gen6
import gen9
from gen import ICONS, ROOT
from gen5 import C, CARD, LINK, pbtn
from gen4 import badge, icon, label
from gen7 import SERIF, serif, page, topbar

f = gen9.f
ICONS.update({
    "filter": '<path d="M4 5h16l-6 8v6l-4-2v-4z"></path>',
    "shelf": '<path d="M5 4v16M9 4v16M13 5l4 15M4 20h16"></path>',
    "share": '<circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="6" r="2.5"></circle><circle cx="18" cy="18" r="2.5"></circle><path d="M8.2 11l7.6-4M8.2 13l7.6 4"></path>',
    "spark": '<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"></path>',
})

SPELLS = {
    "Cantrips": [("Fire Bolt", "Evocation", "V S", "", "2024"), ("Guidance", "Divination", "V S", "C", "2024"),
                 ("Light", "Evocation", "V M", "", "2014"), ("Mage Hand", "Conjuration", "V S", "", "2024")],
    "Level 1": [("Bless", "Enchantment", "V S M", "C", "2024"), ("Detect Magic", "Divination", "V S", "C R", "2024"),
                ("Stormcall", "Evocation", "V S", "", "Pack")],
}


def select(t):
    return (f'<span style="flex-grow: 1; flex-basis: 0; height: 40px; border-radius: 10px; border: 1px solid {C["line"]}; background: {C["surface"]}; '
            f'display: flex; align-items: center; gap: 6px; padding: 0 10px; font-size: 14px">{t}<span style="margin-left: auto; display: inline-flex; '
            f'transform: rotate(90deg)">{icon("chev", 14, C["muted"])}</span></span>')


def marker(t):
    return (f'<span style="min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 4px; border: 1px solid {C["muted"]}; '
            f'display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: {C["muted"]}">{t}</span>')


def group_head(t):
    return (f'<div style="display: flex; align-items: center; gap: 10px; margin: 8px 0 6px"><span style="flex-grow: 1; height: 1px; background: {C["line"]}"></span>'
            f'{serif(17, t)}<span style="flex-grow: 1; height: 1px; background: {C["line"]}"></span></div>')


def card(name, school, comps, flags, src, href=None, selected=False):
    tag_open, tag_close = (f'<a href="{href}" ', "</a>") if href else ("<div ", "</div>")
    fl = "".join(marker(x) for x in flags.split())
    border = f"border: 2px solid {C['strong']}" if selected else f"border: 1px solid {C['line']}"
    return (f'{tag_open}style="height: 60px; box-sizing: border-box; {border}; border-radius: 12px; background: {C["surface"]}; display: flex; '
            f'align-items: center; gap: 10px; padding: 0 12px; margin-bottom: 6px; {LINK}">'
            f'<span style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; background: {C["soft"]}; display: flex; align-items: center; '
            f'justify-content: center">{icon("spark", 16, C["muted"])}</span>'
            f'<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">'
            f'<span style="display: flex; align-items: center; gap: 6px"><b style="flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{name}</b>{badge(src)}</span>'
            f'<span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: {C["muted"]}"><span style="flex-grow: 1">{school}</span>'
            f'{fl}<span style="letter-spacing: 0.08em; font-weight: 600">{comps}</span></span></span>{tag_close}')


def list_body(link=True, selected=None):
    out = ""
    for grp, items in SPELLS.items():
        out += group_head(grp)
        for n, s, cps, fl, src in items:
            out += card(n, s, cps, fl, src, f("Entry") if link and n == "Fire Bolt" else None, n == selected)
    return out


def controls():
    ib = lambda ic, lbl: (f'<span aria-label="{lbl}" style="width: 44px; height: 44px; border-radius: 10px; border: 1px solid {C["line"]}; '
                          f'background: {C["surface"]}; display: flex; align-items: center; justify-content: center">{icon(ic, 20)}</span>')
    legend = "".join(f'<span style="display: flex; align-items: center; gap: 4px">{marker(m)}{t}</span>'
                     for m, t in [("C", "concentration"), ("R", "ritual"), ("V S M", "components")])
    return (f'<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px">'
            f'<label style="height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 12px; background: {C["soft"]}; '
            f'color: {C["muted"]}">{icon("search", 18)}<input aria-label="Search spells" placeholder="Search spells" style="flex-grow: 1; min-width: 0; '
            f'border: 0; background: transparent; font-size: 16px; outline: none"></label>'
            f'<div style="display: flex; gap: 8px"><span style="flex-grow: 1; height: 44px; border-radius: 10px; background: {C["strong"]}; color: {C["onStrong"]}; '
            f'display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700">{icon("filter", 18)}Filter</span>'
            f'{ib("shelf", "Sources")}{ib("share", "Export")}</div>'
            f'<div style="display: flex; gap: 8px">{select("Group: level")}{select("Sort: A–Z")}</div>'
            f'<div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: {C["muted"]}">{legend}</div></div>')


def library():
    topics = "".join(gen9.chip(t, t == "Spells", True) for t in ["Armor", "Backgrounds", "Classes", "Encounter templates", "Feats", "Items", "Monsters", "Species", "Spells", "Weapons"])
    body = (topbar("Spells", f("Player"))
            + f'<div style="display: flex; gap: 6px; overflow: hidden; padding: 0 16px 8px">{topics}</div>'
            + controls()
            + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 4px 16px">{list_body()}'
            f'<p style="margin: 4px 0 0; font-size: 12px; color: {C["muted"]}">Sample list. Tap Fire Bolt.</p></main>')
    return page("Library", body)


def entry():
    ib = lambda ic, lbl, href=None: (f'<{"a href=" + chr(34) + href + chr(34) if href else "span"} aria-label="{lbl}" style="width: 40px; height: 40px; '
                                     f'display: flex; align-items: center; justify-content: center; {LINK}">{icon(ic, 20)}</{"a" if href else "span"}>')
    prop = lambda k, v: (f'<div style="display: flex; flex-direction: column; gap: 1px"><b style="font-size: 13px">{k}</b>'
                         f'<span style="font-size: 15px">{v}</span></div>')
    link = lambda t: f'<span style="text-decoration: underline; text-underline-offset: 3px; font-weight: 600">{t}</span>'
    dmg = "".join(f'<span>Level {lv}: {d} fire</span>' for lv, d in [(1, "1d10"), (5, "2d10"), (11, "3d10"), (17, "4d10")])
    window = (f'<a href="{f("Library")}" aria-label="Close" style="position: absolute; inset: 0; background: rgba(20, 20, 22, 0.45)"></a>'
              f'<section style="position: absolute; left: 0; right: 0; top: 70px; bottom: 0; box-sizing: border-box; padding: 8px 16px 16px; '
              f'background: {C["surface"]}; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.2); display: flex; flex-direction: column; '
              f'gap: 10px; overflow: hidden">'
              f'<div style="width: 40px; height: 4px; border-radius: 2px; background: {C["line"]}; align-self: center"></div>'
              f'<div style="display: flex; align-items: flex-start; gap: 4px"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px">'
              f'{serif(26, "Fire Bolt")}<span style="font-size: 13px; color: {C["muted"]}">[Russian name, when the glossary has it]</span></span>'
              f'{ib("share", "Share")}{ib("copy", "Homebrew copy")}{ib("pen", "Edit")}{ib("close", "Close", f("Library"))}</div>'
              f'<div style="display: flex; gap: 6px">{badge("SRD 2024")}{badge("Cantrip")}<span style="font-size: 12px; color: {C["muted"]}; margin-left: auto">sample values</span></div>'
              f'<div style="padding: 8px 12px; border-radius: 10px; background: {C["soft"]}; font-style: italic">Cantrip, Evocation</div>'
              f'<div style="{CARD}; padding: 10px 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">'
              f'{prop("Casting time", "Action")}{prop("Range", "120 feet")}{prop("Components", "V, S")}{prop("Duration", "Instantaneous")}</div>'
              f'<div style="font-size: 15px; line-height: 23px">[Full text from the SRD.] Terms such as {link("creature")} and '
              f'{link("saving throw")} open their rule; dice such as {link("1d10")} roll when tapped.</div>'
              f'<div style="font-size: 15px; line-height: 23px"><b>Cantrip upgrade.</b> [From the SRD.]</div>'
              f'<div style="{CARD}; overflow: hidden"><button onClick="{{{{toggle}}}}" style="width: 100%; height: 44px; display: flex; align-items: center; gap: 10px; '
              f'padding: 0 12px; border: 0; background: transparent; text-align: left"><span style="display: inline-flex; transform: {{{{arrow}}}}">'
              f'{icon("chev", 16)}</span><b>Damage dice</b></button><sc-if value="{{{{open}}}}" hint-placeholder-val="{{{{ true }}}}">'
              f'<div style="padding: 0 12px 10px 38px; display: flex; flex-direction: column; gap: 3px; font-size: 14px; border-left: 2px solid {C["line"]}; '
              f'margin: 0 0 10px 18px">{dmg}</div></sc-if></div>'
              f'<div style="font-size: 14px">Classes: {link("Sorcerer")} {badge("2024")} {link("Wizard")} {badge("2024")}</div>'
              f'</section>')
    js = """constructor(props) {
    super(props);
    this.state = { open: true };
  }
  renderVals() {
    const open = this.state.open;
    return {
      open: open,
      arrow: open ? 'rotate(-90deg)' : 'rotate(90deg)',
      toggle: () => this.setState({ open: !open }),
    };
  }"""
    under = topbar("Spells", f("Player")) + controls() + f'<main style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 4px 16px">{list_body(False, "Fire Bolt")}</main>'
    return page("Library entry", under + window, js)


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    for name, title, fn in [("Library", "Library: search, filter, groups, legend (ADR 012)", library),
                            ("Entry", "An entry: floating window over the list (ADR 012)", entry)]:
        fname = f(name)
        with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as fh:
            fh.write(fn())
        canvas["boards"][fname]["title"] = title
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    print("ok")


if __name__ == "__main__":
    run(sys.argv[1])
