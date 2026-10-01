"""Level up moves into the sheet's "⋯" menu; the old level chip leaves every v3 screen."""
import json
import os
import re
import sys
import tempfile

from gen import ROOT
import gen9
import gen13
from gen5 import C, LINK
from gen4 import icon
from gen7 import page

f = gen9.f
CHIP = re.compile(r'<a href="V3-LevelUp\.dc\.html" aria-label="Level up"[^>]*>Lv \d+<svg.*?</svg></a>', re.S)
LEVELS = [f"V3-Level{k}.dc.html" for k in "ABCDEF"]


def actions():
    rows = [("up", "Level up", "Fighter 1 → 2 · in a campaign, waits for the DM", f("LevelUp")),
            ("link", "Link for the DM", "share with your DM's table", None),
            ("file", "Export", "file or PDF", None),
            ("copy", "Copy", "", None),
            ("send", "Transfer", "move to another device", None),
            ("sliders", "Rules options", "editions mixed, feats allowed", None),
            ("back2", "Change history", "undo any change", None),
            ("trash", "Delete", "Undo stays available for a moment", None)]
    items = ""
    for ic, t, sub, href in rows:
        colour = C["danger"] if t == "Delete" else C["text"]
        inner = (f'{icon(ic, 22)}<span style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-weight: {800 if href else 600}">{t}</span>'
                 + (f'<span style="font-size: 13px; color: {C["muted"]}">{sub}</span>' if sub else "") + "</span>")
        style = (f'min-height: 48px; display: flex; align-items: center; gap: 14px; padding: 2px 4px; border-bottom: 1px solid {C["line"]}; '
                 f'color: {colour}; text-decoration: none')
        items += f'<a href="{href}" style="{style}">{inner}</a>' if href else f'<div style="{style}">{inner}</div>'
    inner = (f'<span style="display: flex; align-items: baseline; gap: 8px"><span style="font-size: 20px; font-weight: 800">Iren</span>'
             f'<span style="color: {C["muted"]}">Fighter 1</span></span>{items}'
             f'<p style="margin: 0; font-size: 12px; color: {C["muted"]}">Rest and Edit stay as buttons in the header.</p>')
    return page("Actions v3", gen9.under() + gen9.half(inner, f("Sheet"), 620))


def run(canvas_src):
    with open(canvas_src, encoding="utf-8") as fh:
        canvas = json.load(fh)
    for name in LEVELS:
        canvas["boards"].pop(name, None)
        if name in canvas["order"]:
            canvas["order"].remove(name)
        path = os.path.join(ROOT, name)
        if os.path.exists(path):
            os.remove(path)
    canvas["notes"].pop("v3-6", None)
    canvas["boards"][f("Actions")]["title"] = "Actions (⋯): Level up first (ADR 013)"
    canvas["boards"][f("Sheet")]["title"] = "Sheet: the class line is the level"
    tmp = os.path.join(tempfile.gettempdir(), "canvas-tmp.json")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(canvas, fh, indent=1, ensure_ascii=False)
    gen13.run(tmp)  # rewrites the ADR 013 boards with the header that has no chip
    with open(os.path.join(ROOT, f("Actions")), "w", encoding="utf-8") as fh:
        fh.write(actions())
    changed = set(json.load(open(os.path.join(tempfile.gettempdir(), "gen13-written.json"))))
    changed.add(f("Actions"))
    for name in os.listdir(ROOT):
        if name.startswith("V3-") and name.endswith(".dc.html"):
            path = os.path.join(ROOT, name)
            html = open(path, encoding="utf-8").read()
            new = CHIP.sub("", html)
            if new != html:
                open(path, "w", encoding="utf-8").write(new)
                changed.add(name)
    with open(os.path.join(tempfile.gettempdir(), "gen14-files.json"), "w", encoding="utf-8") as fh:
        files = {f"project/{n}": f"project/{n}" for n in sorted(changed)}
        files.update({f"project/{n}": None for n in LEVELS})
        json.dump(files, fh)
    print(len(changed), "changed;", "chips left:", sum(1 for n in os.listdir(ROOT) if n.startswith("V3-") and 'aria-label="Level up"' in open(os.path.join(ROOT, n), encoding="utf-8").read()))


if __name__ == "__main__":
    run(sys.argv[1])
