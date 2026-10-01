"""ADR 011: a spell card with 'See full description' open, added to page 'Our design v3'."""
import json
import os
import sys

import gen6
import gen9
from gen import ROOT
from gen5 import C, CARD, W, H, pbtn
from gen4 import badge, icon, label
from gen7 import serif, page

f = gen9.f


def spell_card():
    inner = (f'<div style="display: flex; align-items: baseline; justify-content: space-between">{serif(24, "Magic Missile")}{badge("2024")}</div>'
             f'<div style="font-size: 14px; color: {C["muted"]}">Level 1 · Evocation · short summary [from the SRD]</div>'
             f'<div style="{CARD}; overflow: hidden">'
             f'<div style="height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 14px; background: {C["soft"]}">'
             f'<b style="flex-grow: 1">See full description</b><span style="display: inline-flex; transform: rotate(-90deg)">{icon("chev", 18)}</span></div>'
             f'<div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 22px">'
             f'<span>[The exact spell text, as the source prints it.]</span>'
             f'<span style="color: {C["muted"]}"><b>At higher levels.</b> [As the source prints it.]</span>'
             f'<span style="font-size: 12px; color: {C["muted"]}; border-top: 1px solid {C["line"]}; padding-top: 8px">'
             f'Source: SRD 5.2.1 · CC-BY-4.0 · attribution as the license asks</span></div></div>'
             f'<div style="{CARD}; height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 14px">'
             f'<span style="flex-grow: 1"><b>Shield</b> <span style="font-size: 13px; color: {C["muted"]}">description closed</span></span>'
             f'<span style="display: inline-flex; transform: rotate(90deg)">{icon("chev", 18, C["muted"])}</span></div>'
             f'<div style="display: flex; gap: 8px">{pbtn("Cast", f("Cast"), True, True)}{pbtn("Damage", f("Roll"), False, True)}</div>')
    under_ = (gen9.header("Mira", "Wizard 3", gen9.MIRA_STATS, "M", "3") + gen6.sheet_main_content()
              + gen9.dock("Spells", "18", "18", f("Spells")))
    return page("Spell card, full description", under_ + gen9.half(inner, f("Spells"), 560))


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    fname = f("SpellCard")
    with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as fh:
        fh.write(spell_card())
    canvas["boards"][fname] = {"x": 3 * 440, "y": 260 + 2 * 1180, "w": W, "h": H,
                               "title": "Spell card: See full description (ADR 011)", "page": "ours-v3", "is_interactive": True}
    if fname not in canvas["order"]:
        canvas["order"].append(fname)
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    print("boards:", len(canvas["boards"]))


if __name__ == "__main__":
    run(sys.argv[1])
