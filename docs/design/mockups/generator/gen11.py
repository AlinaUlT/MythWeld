"""Cast panel shows what is being cast (summary + See full description); the separate spell card is removed."""
import json
import os
import sys

import gen6
import gen9
from gen import ROOT
from gen5 import C, CARD, pbtn
from gen4 import badge, icon, label
from gen7 import serif, page

f = gen9.f


def cast():
    lv = "".join(gen9.chip(f"Level {i}", i == 1) for i in (1, 2, 3))
    check = (f'<label style="display: flex; align-items: center; gap: 12px; min-height: 44px"><span style="width: 24px; height: 24px; box-sizing: border-box; '
             f'border-radius: 6px; border: 2px solid {C["strong"]}"></span><span style="display: flex; flex-direction: column"><b>Don&#39;t use a spell slot</b>'
             f'<span style="font-size: 13px; color: {C["muted"]}">for a free cast from a feature or an item</span></span></label>')
    full = (f'<div style="padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 22px; border-top: 1px solid {C["line"]}">'
            f'<span>[The exact spell text, as the source prints it.]</span>'
            f'<span style="color: {C["muted"]}"><b>At higher levels.</b> [As the source prints it.]</span>'
            f'<span style="font-size: 12px; color: {C["muted"]}">Source: SRD 5.2.1 · CC-BY-4.0 · attribution as the license asks</span></div>')
    desc = (f'<div style="{CARD}; overflow: hidden">'
            f'<div style="padding: 10px 14px; font-size: 14px">[Short summary: what the spell does, from the SRD.]</div>'
            f'<button onClick="{{{{toggle}}}}" style="width: 100%; height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 0; '
            f'border-top: 1px solid {C["line"]}; background: {C["soft"]}; text-align: left"><b style="flex-grow: 1">See full description</b>'
            f'<span style="display: inline-flex; transform: {{{{arrow}}}}">{icon("chev", 18)}</span></button>'
            f'<sc-if value="{{{{open}}}}" hint-placeholder-val="{{{{ false }}}}">{full}</sc-if></div>')
    inner = (f'<div style="display: flex; align-items: baseline; justify-content: space-between">{serif(24, "Magic Missile")}{badge("2024")}</div>'
             f'<div style="font-size: 13px; color: {C["muted"]}">Level 1 · Evocation · slots left: level 1 3 of 4</div>'
             f'{desc}<div>{label("Slot level")}</div><div style="display: flex; gap: 6px">{lv}</div>{check}'
             f'<div style="display: flex; gap: 8px">{pbtn("Cast", f("Spells"), True, True)}{pbtn("Damage", f("Roll"), False, True)}</div>')
    under_ = (gen9.header("Mira", "Wizard 3", gen9.MIRA_STATS, "M", "3") + gen6.sheet_main_content()
              + gen9.dock("Spells", "18", "18", f("Spells")))
    js = """constructor(props) {
    super(props);
    this.state = { open: false };
  }
  renderVals() {
    const open = this.state.open;
    return {
      open: open,
      arrow: open ? 'rotate(-90deg)' : 'rotate(90deg)',
      toggle: () => this.setState({ open: !open }),
    };
  }"""
    return page("Cast a spell", under_ + gen9.half(inner, f("Spells"), 620), js)


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    old = f("SpellCard")
    canvas["boards"].pop(old, None)
    canvas["order"] = [x for x in canvas["order"] if x != old]
    p = os.path.join(ROOT, old)
    if os.path.exists(p):
        os.remove(p)
    fname = f("Cast")
    with open(os.path.join(ROOT, fname), "w", encoding="utf-8") as fh:
        fh.write(cast())
    canvas["boards"][fname]["title"] = "Cast: what you cast, See full description, Don't use a spell slot"
    with open(os.path.join(ROOT, "canvas.json"), "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    print("boards:", len(canvas["boards"]), "SpellCard" in json.dumps(canvas))


if __name__ == "__main__":
    run(sys.argv[1])
