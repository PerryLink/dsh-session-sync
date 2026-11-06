#!/usr/bin/env python3
"""Generate the README artwork for dsh-session-sync.

Outputs (idempotent overwrite, docs/assets/):
  dsh-session-sync-hero-{zh,en}-{light,dark}.webp   1440x576 banners
  dsh-session-sync-flow-v5-{light,dark}.svg         1100x660 structure diagram

The plugin's real shape drives both drawings:

  $DSH_HOME/sessions --byte mirror--> <repoDir>/sessions --commit--> push
        ^                                                                 |
        +---------------- restore <- three-way merge <- pull <-- remote -+

Divergence is resolved per file (base / ours / theirs): the local bytes stay
at the original path and the remote bytes are written to a fork file
``<basename>.remote-fork-<UTC14>-<device8>``. Fork files are never deleted or
overwritten and git is never force-pushed.  The hero is a two-device panel
under one owned remote with that fork drawn in the commit graph; the structure
diagram is a two-sided boundary (device A | owned git remote | device B) with
a keep-both fork zoom at the bottom -- deliberately not a row of equal boxes.

Run:  python scripts/gen-readme-assets.py
Requires: Pillow + numpy.  Chinese text must never render as tofu: the script
aborts loudly when the msyh fonts are missing.
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

HERO_W, HERO_H = 1440, 576
FLOW_W, FLOW_H = 1100, 660

# --- fonts ----------------------------------------------------------------
FONT_DIRS = [
    os.environ.get("DSH_README_FONT_DIR", ""),
    r"C:\Windows\Fonts",
    "/usr/share/fonts/truetype/msttcorefonts",
    "/usr/share/fonts/truetype/microsoft",
    "/System/Library/Fonts",
    os.path.expanduser("~/.fonts"),
]


def _font_file(*names: str) -> str:
    for folder in FONT_DIRS:
        if not folder:
            continue
        for name in names:
            path = os.path.join(folder, name)
            if os.path.exists(path):
                return path
    raise SystemExit(f"missing font {names[0]}; set DSH_README_FONT_DIR (msyh.ttc / msyhbd.ttc / consola.ttf required)")


F_CJK = _font_file("msyh.ttc", "MicrosoftYaHei.ttf")
F_CJK_BOLD = _font_file("msyhbd.ttc", "MicrosoftYaHei-Bold.ttf")
F_MONO = _font_file("consola.ttf", "Consolas.ttf")
F_MONO_BOLD = _font_file("consolab.ttf", "Consolas-Bold.ttf")

_FONT_CACHE: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def F(kind: str, size: int) -> ImageFont.FreeTypeFont:
    key = (kind, size)
    if key not in _FONT_CACHE:
        path = {"cjk": F_CJK, "cjkb": F_CJK_BOLD, "mono": F_MONO, "monob": F_MONO_BOLD}[kind]
        _FONT_CACHE[key] = ImageFont.truetype(path, size)
    return _FONT_CACHE[key]


def C(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def top_baseline(font: ImageFont.FreeTypeFont, text: str, top: float) -> float:
    """Baseline that puts the ink top of ``text`` at ``top`` (anchor 'ls')."""
    bbox = font.getbbox(text)
    ascent = font.getmetrics()[0]
    return top - bbox[1] + ascent


def text_width(font: ImageFont.FreeTypeFont, text: str) -> float:
    return float(font.getlength(text))


def tracked_width(font: ImageFont.FreeTypeFont, text: str, tracking: float) -> float:
    return sum(font.getlength(ch) for ch in text) + tracking * max(0, len(text) - 1)


def draw_text(draw: ImageDraw.ImageDraw, xy, text, font, fill, anchor="ls"):
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)


def draw_tracked(draw: ImageDraw.ImageDraw, xy, text, font, fill, tracking: float):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill, anchor="ls")
        x += font.getlength(ch) + tracking


# --- hero palette ---------------------------------------------------------
PAL = {
    "light": dict(
        bg1="#f9f6fd", bg2="#e4eaf8",
        ink="#1b2340", soft="#4c5676", muted="#5f6987",
        accent="#4B67B4", accent_deep="#3a5098",
        card="#ffffff", card_border="#d9d5ea",
        chip_bg="#eef0fa", chip_border="#c9cdec",
        shadow=(43, 51, 82, 26),
        grid="#4B67B4",
        glow=(75, 103, 180),
        stack="#4B67B4",
        hair="#4B67B4",
    ),
    "dark": dict(
        bg1="#131a2a", bg2="#0c1016",
        ink="#f1f4ff", soft="#c0c9e4", muted="#95a1c1",
        accent="#8496f5", accent_deep="#aab8ff",
        card="#181f30", card_border="#2e3a56",
        chip_bg="#1f2940", chip_border="#3a4770",
        shadow=(0, 0, 0, 105),
        grid="#8496f5",
        glow=(132, 150, 245),
        stack="#8496f5",
        hair="#8496f5",
    ),
}

HERO_TEXT = {
    "zh": dict(
        kicker="DSH 插件 · 会话存储同步",
        value1="把会话存储镜像成你的 git 仓库",
        value2="跨设备同步，分歧两边都留，绝不丢一轮",
        sub="append-only 三方合并 · keep-both + fork · 绝不强推",
        meta="Apache-2.0 · DSH ≥0.1.2 <0.3.0 · Node ^22.19 / ≥24.9 · 无云服务",
        remote_kicker="你的 git 远端",
        remote_title="你的仓库",
        branch="branch: main",
        noforce="绝不 force-push",
        dev_a="设备 A",
        dev_b="设备 B",
        store="$DSH_HOME/sessions",
        note_a="不透明字节 · 不解析",
        note_b="合并后恢复",
        mode_a="byte mirror · commit",
        mode_b="merge · restore",
        flow="推送 · 拉取",
        fork="fork 文件",
        fork_note="两边都留",
        footer="PerryLink · github.com/PerryLink/dsh-session-sync",
    ),
    "en": dict(
        kicker="DSH PLUGIN · SESSION SYNC",
        value1="Your session store, mirrored into git",
        value2="Cross-device sync; both sides kept",
        sub="Append-only three-way merge · keep-both + fork",
        meta="Apache-2.0 · DSH ≥0.1.2 <0.3.0 · Node ^22.19 / ≥24.9 · no cloud",
        remote_kicker="YOUR GIT REMOTE",
        remote_title="your repo",
        branch="branch: main",
        noforce="never force-push",
        dev_a="DEVICE A",
        dev_b="DEVICE B",
        store="$DSH_HOME/sessions",
        note_a="opaque bytes · never parsed",
        note_b="merged on pull",
        mode_a="byte mirror · commit",
        mode_b="merge · restore",
        flow="push · pull",
        fork="fork file",
        fork_note="both kept",
        footer="PerryLink · github.com/PerryLink/dsh-session-sync",
    ),
}


def _fit(name: str, width: float, limit: float) -> None:
    if width > limit:
        raise SystemExit(f"hero text overflow: {name!r} is {width:.0f}px wide (limit {limit:.0f})")


def gradient_background(top: str, bottom: str, size=(HERO_W, HERO_H)) -> Image.Image:
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = (xx / (w - 1)) * 0.58 + (yy / (h - 1)) * 0.42
    a = np.array(C(top)[:3], dtype=np.float32)
    b = np.array(C(bottom)[:3], dtype=np.float32)
    arr = a[None, None, :] * (1 - t[..., None]) + b[None, None, :] * t[..., None]
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")


def add_glow(img: Image.Image, center, rx: float, ry: float, rgb, strength: float) -> None:
    arr = np.asarray(img.convert("RGB"), dtype=np.float32).copy()
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = ((xx - center[0]) / rx) ** 2 + ((yy - center[1]) / ry) ** 2
    g = (np.exp(-1.7 * d) * strength)[..., None]
    col = np.array(rgb, dtype=np.float32)[None, None, :]
    arr = arr * (1 - g) + col * g
    img.paste(Image.fromarray(arr.clip(0, 255).astype(np.uint8)), (0, 0))


def card(img: Image.Image, box, radius: int, fill, outline, shadow, blur=18, dy=9, width=2) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((box[0] + 1, box[1] + dy, box[2] + 1, box[3] + dy), radius=radius, fill=shadow)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    img.alpha_composite(layer)


def pill(img: Image.Image, box, radius: int, fill, outline, width=1) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    img.alpha_composite(layer)


def bezier(p0, p1, p2, p3, steps=18):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0]
        y = u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]
        pts.append((x, y))
    return pts


def render_hero(lang: str, scheme: str) -> Image.Image:
    p = PAL[scheme]
    t = HERO_TEXT[lang]
    accent = C(p["accent"])
    accent_soft = C(p["accent"], 34)
    ink = C(p["ink"])
    soft = C(p["soft"])
    muted = C(p["muted"])

    img = gradient_background(p["bg1"], p["bg2"])
    add_glow(img, (1120, 90), 470, 270, p["glow"], 0.13 if scheme == "light" else 0.16)
    add_glow(img, (820, 540), 330, 230, p["glow"], 0.07 if scheme == "light" else 0.09)

    d = ImageDraw.Draw(img)
    # faint dotted grid behind the right-hand artwork
    for gx in range(774, 1432, 26):
        for gy in range(70, 532, 26):
            alpha = 20 if scheme == "light" else 26
            d.ellipse((gx, gy, gx + 2, gy + 2), fill=C(p["grid"], alpha))
    # two quiet rings
    d.ellipse((1002, 28, 1510, 536), outline=C(p["accent"], 20), width=1)
    d.ellipse((1082, 108, 1430, 456), outline=C(p["accent"], 13), width=1)

    # ------------------------------------------------------------------ left
    f_kick = F("cjkb", 17 if lang == "zh" else 16)
    tw = tracked_width(f_kick, t["kicker"], 1.2)
    pill_w = int(tw + 52)
    pill(img, (68, 48, 68 + pill_w, 86), 19, accent_soft, C(p["accent"], 80))
    d.ellipse((86, 62, 94, 70), fill=accent)
    draw_tracked(d, (106, 73), t["kicker"], f_kick, C(p["accent_deep"]), 1.2)

    f_title = F("cjkb", 80)
    title_w = text_width(f_title, "dsh-session-sync")
    _fit("title", 68 + title_w, 780)
    top = 112
    draw_text(d, (68, top_baseline(f_title, "dsh-session-sync", top)), "dsh-session-sync", f_title, ink)

    f_val = F("cjkb", 31 if lang == "zh" else 30)
    for i, key in enumerate(("value1", "value2")):
        _fit(key, 68 + text_width(f_val, t[key]), 786)
        top = 246 + i * 44
        draw_text(d, (68, top_baseline(f_val, t[key], top)), t[key], f_val, C(p["ink"], 255) if scheme == "light" else C("#e8ecff"))

    f_sub = F("cjk", 25)
    _fit("sub", 68 + text_width(f_sub, t["sub"]), 786)
    draw_text(d, (68, top_baseline(f_sub, t["sub"], 352)), t["sub"], f_sub, soft)

    f_meta = F("cjk", 20)
    _fit("meta", 68 + text_width(f_meta, t["meta"]), 786)
    draw_text(d, (68, top_baseline(f_meta, t["meta"], 400)), t["meta"], f_meta, muted)

    # hairline + footer
    d.line((68, 462, 662, 462), fill=C(p["hair"], 46), width=1)
    f_foot = F("cjk", 16)
    _fit("footer", 92 + text_width(f_foot, t["footer"]), 780)
    d.ellipse((68, 505, 78, 515), fill=accent)
    draw_text(d, (90, 518), t["footer"], f_foot, muted)

    # ---------------------------------------------------------------- remote
    remote = (790, 96, 1392, 286)
    card(img, remote, 22, C(p["card"], 246), C(p["card_border"]), p["shadow"], blur=20, dy=10)

    f_rk = F("cjkb", 15)
    if lang == "zh":
        draw_text(d, (818, 133), t["remote_kicker"], f_rk, C(p["accent_deep"]))
    else:
        draw_tracked(d, (818, 132), t["remote_kicker"], F("cjkb", 12), C(p["accent_deep"]), 2.0)
    f_rt = F("cjkb", 22)
    draw_text(d, (818, 166), t["remote_title"], f_rt, ink)
    f_branch = F("mono", 13)
    draw_text(d, (1364, 166), t["branch"], f_branch, C(p["soft"]), anchor="rs")

    # commit graph
    gx0, gx1, gy = 824, 1360, 220
    d.line((gx0, gy, gx1, gy), fill=C(p["accent"], 150), width=3)
    for cx in (868, 978, 1088, 1198, 1308):
        d.ellipse((cx - 7, gy - 7, cx + 7, gy + 7), fill=C(p["card"]), outline=accent, width=3)
    # the unique bit: a fork branch that keeps the remote lineage as a file
    fork_pts = bezier((1088, gy), (1088, gy + 20), (1104, gy + 28), (1124, gy + 28))
    d.line(fork_pts, fill=C(p["accent"], 200), width=3, joint="curve")
    d.rounded_rectangle((1112, gy + 17, 1138, gy + 41), radius=5,
                        fill=C(p["card"]), outline=accent, width=2)
    d.line((1119, gy + 26, 1131, gy + 26), fill=C(p["accent"], 190), width=2)
    d.line((1119, gy + 32, 1128, gy + 32), fill=C(p["accent"], 190), width=2)
    f_lbl = F("mono", 13) if lang == "en" else F("cjk", 13)
    draw_text(d, (1148, gy + 32), t["fork"], f_lbl, C(p["accent_deep"]))
    draw_text(d, (1148, gy + 50), t["fork_note"], F("cjk", 12), muted)

    # safety seal
    seal = (818, 252, 1016, 280)
    pill(img, seal, 14, C(p["chip_bg"], 230), C(p["chip_border"]))
    d.ellipse((834, 262, 842, 270), fill=accent)
    draw_text(d, (850, 272), t["noforce"], F("cjkb", 13), C(p["accent_deep"]))

    # ---------------------------------------------------------------- devices
    def device(box, title, note, mode):
        card(img, box, 20, C(p["card"], 242), C(p["card_border"]), p["shadow"], blur=16, dy=8)
        draw_text(d, (box[0] + 20, box[1] + 38), title, F("cjkb", 20), ink)
        # stack-of-files glyph
        sx = box[2] - 100
        for i in range(3):
            x0 = sx + i * 5
            y0 = box[1] + 28 + i * 14
            d.rounded_rectangle((x0, y0, x0 + 66, y0 + 9), radius=4,
                                fill=C(p["stack"], 26), outline=C(p["stack"], 80), width=1)
        draw_text(d, (box[0] + 20, box[1] + 88), t["store"], F("mono", 13), C(p["accent_deep"]))
        draw_text(d, (box[0] + 20, box[1] + 112), note, F("cjk", 13), soft)
        draw_text(d, (box[0] + 20, box[1] + 134), mode, F("mono", 11), muted)

    device((790, 346, 1060, 492), t["dev_a"], t["note_a"], t["mode_a"])
    device((1120, 346, 1392, 492), t["dev_b"], t["note_b"], t["mode_b"])

    # double-headed connector: either direction, confirm-gated in practice
    def connector(cx: float):
        y0, y1 = 296, 338
        d.line((cx, y0, cx, y1), fill=C(p["accent"], 150), width=3)
        d.polygon((cx - 6, y0 + 2, cx + 6, y0 + 2, cx, y0 - 8), fill=accent)
        d.polygon((cx - 6, y1 - 2, cx + 6, y1 - 2, cx, y1 + 8), fill=accent)
        draw_text(d, (cx + 14, 322), t["flow"], F("cjk", 12), C(p["accent_deep"]))

    connector(925)
    connector(1256)

    # rounded canvas corners
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, HERO_W - 1, HERO_H - 1), radius=28, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


# --- structure diagram (hand-written SVG) ---------------------------------
SVG_PAL = {
    "light": dict(
        bg1="#f9f6fd", bg2="#e4eaf8",
        panel="#ffffff", panel_op=".72", border="#d8d4e8",
        node="#ffffff", node_op=".78", node_border="#d8d4e8",
        ink="#1b2340", soft="#4d5777", muted="#66708d",
        accent="#4B67B4", accent_deep="#3a5098",
        accent_op=".10", chip="#f0eef9", chip_border="#d6d2e7",
        shadow="#2b3350", shadow_op=".10",
    ),
    "dark": dict(
        bg1="#131a2a", bg2="#0c1016",
        panel="#161e2e", panel_op=".90", border="#2c3852",
        node="#1b2436", node_op=".94", node_border="#33405e",
        ink="#eef1ff", soft="#c2cbe4", muted="#93a0c0",
        accent="#8496f5", accent_deep="#aebcff",
        accent_op=".12", chip="#202a40", chip_border="#3a4770",
        shadow="#000000", shadow_op=".38",
    ),
}


def esc(text: str) -> str:
    return (text.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def flow_svg(scheme: str) -> str:
    p = SVG_PAL[scheme]
    A = p["accent"]
    AD = p["accent_deep"]
    s: list[str] = []
    add = s.append

    add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{FLOW_W}" height="{FLOW_H}" viewBox="0 0 {FLOW_W} {FLOW_H}" role="img" aria-label="dsh-session-sync structure diagram">')
    add('<title>dsh-session-sync structure: byte mirror, owned git remote, keep-both fork</title>')
    add('<desc>Device A mirrors the session store as opaque bytes and commits; push crosses a confirmation gate into the git remote you own. Device B fetches, runs a per-file three-way merge (base, ours, theirs) and restores sessions. Divergent remote bytes become fork files at the original path, never overwritten and never force-pushed.</desc>')
    add('<defs>')
    add(f'<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{p["bg1"]}"/><stop offset="1" stop-color="{p["bg2"]}"/></linearGradient>')
    add(f'<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{A}" stop-opacity=".18"/><stop offset="1" stop-color="{A}" stop-opacity="0"/></radialGradient>')
    add(f'<filter id="soft" x="-15%" y="-15%" width="130%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="{p["shadow"]}" flood-opacity="{p["shadow_op"]}"/></filter>')
    add(f'<marker id="ar" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{A}"/></marker>')
    add(f'<marker id="ar-soft" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{p["muted"]}"/></marker>')
    add('</defs>')
    add('<style>')
    add(f'.h1{{font-family:\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif;font-size:26px;font-weight:700;fill:{p["ink"]}}}')
    add(f'.sub{{font-family:\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif;font-size:12.5px;fill:{p["soft"]}}}')
    add(f'.k{{font-family:\'Segoe UI\',system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;fill:{A}}}')
    add(f'.ptitle{{font-family:\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif;font-size:18px;font-weight:700;fill:{p["ink"]}}}')
    add(f'.pnote{{font-family:\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif;font-size:11px;fill:{p["muted"]}}}')
    add(f'.ctitle{{font-family:\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif;font-size:15px;font-weight:700;fill:{p["ink"]}}}')
    add(f'.mtitle{{font-family:\'Consolas\',ui-monospace,monospace;font-size:13.5px;font-weight:700;fill:{p["ink"]}}}')
    add(f'.note{{font-family:\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif;font-size:11px;fill:{p["soft"]}}}')
    add(f'.muted{{font-family:\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif;font-size:11px;fill:{p["muted"]}}}')
    add(f'.mono{{font-family:\'Consolas\',ui-monospace,monospace;font-size:11px;fill:{p["soft"]}}}')
    add(f'.mono-a{{font-family:\'Consolas\',ui-monospace,monospace;font-size:11px;fill:{AD}}}')
    add(f'.lbl{{font-family:\'Segoe UI\',system-ui,sans-serif;font-size:11px;font-weight:700;fill:{AD}}}')
    add(f'.foot{{font-family:\'Microsoft YaHei\',\'Segoe UI\',system-ui,sans-serif;font-size:11px;fill:{p["muted"]}}}')
    add('</style>')

    add(f'<rect width="{FLOW_W}" height="{FLOW_H}" rx="22" fill="url(#bg)"/>')
    add(f'<ellipse cx="960" cy="80" rx="300" ry="170" fill="url(#glow)"/>')
    add(f'<ellipse cx="150" cy="600" rx="260" ry="130" fill="url(#glow)" opacity=".55"/>')

    # ---------------------------------------------------------------- header
    add(f'<text x="48" y="52" class="k">DSH PLUGIN · SESSION SYNC</text>')
    add(f'<text x="47" y="86" class="h1">Byte mirror → owned remote → keep-both</text>')
    add(f'<text x="48" y="110" class="sub">Session files move as opaque bytes; divergent histories keep both sides as fork files.</text>')
    add(f'<line x1="48" y1="126" x2="1052" y2="126" stroke="{p["border"]}" stroke-width="1"/>')

    # ------------------------------------------------------------- left panel
    add(f'<rect x="48" y="140" width="332" height="338" rx="20" fill="{p["panel"]}" fill-opacity="{p["panel_op"]}" stroke="{p["border"]}" filter="url(#soft)"/>')
    add(f'<text x="68" y="166" class="k">DEVICE A · LOCAL</text>')
    add(f'<text x="68" y="192" class="ptitle">Byte mirror &amp; commit</text>')
    add(f'<text x="68" y="210" class="pnote">push path · manual writes confirm</text>')

    def left_card(y: int, title: str, n1: str, n2: str, mono_title: bool = True):
        add(f'<rect x="66" y="{y}" width="296" height="64" rx="18" fill="{p["node"]}" fill-opacity="{p["node_op"]}" stroke="{p["node_border"]}"/>')
        add(f'<text x="84" y="{y + 24}" class="{"mtitle" if mono_title else "ctitle"}">{esc(title)}</text>')
        add(f'<text x="84" y="{y + 42}" class="note">{esc(n1)}</text>')
        add(f'<text x="84" y="{y + 58}" class="muted">{esc(n2)}</text>')

    left_card(218, "$DSH_HOME/sessions", "opaque session bytes · JSONL/zstd untouched", "session.lock & migration temp files excluded")
    # arrow 1
    add(f'<line x1="120" y1="282" x2="120" y2="300" stroke="{A}" stroke-width="2" marker-end="url(#ar)"/>')
    add(f'<text x="134" y="299" class="lbl">byte mirror</text>')
    left_card(306, "<repoDir>/sessions", "dedicated git worktree · plaintext mirror", "symlinks refused · paths contained")
    # arrow 2
    add(f'<line x1="120" y1="370" x2="120" y2="388" stroke="{A}" stroke-width="2" marker-end="url(#ar)"/>')
    add(f'<text x="134" y="387" class="lbl">commit</text>')
    left_card(394, "local commit", "plugin identity (never your git identity)", "device.txt recorded for fork attribution")

    # ----------------------------------------------------------------- rail
    add(f'<rect x="420" y="140" width="260" height="338" rx="20" fill="{p["accent"]}" fill-opacity="{p["accent_op"]}" stroke="{A}" stroke-opacity=".34" filter="url(#soft)"/>')
    add(f'<rect x="421" y="162" width="6" height="296" rx="3" fill="{A}" fill-opacity=".55"/>')
    add(f'<text x="444" y="166" class="k">YOUR GIT REMOTE</text>')
    add(f'<text x="444" y="192" class="ptitle">your repo</text>')
    add(f'<text x="444" y="212" class="mono">branch: main</text>')

    spine_x = 480
    add(f'<line x1="{spine_x}" y1="242" x2="{spine_x}" y2="430" stroke="{A}" stroke-width="2.5"/>')
    for cy in (252, 296, 340, 384, 428):
        add(f'<circle cx="{spine_x}" cy="{cy}" r="5.5" fill="{p["node"]}" stroke="{A}" stroke-width="2.5"/>')
    add(f'<text x="512" y="302" class="note">never force-push,</text>')
    add(f'<text x="512" y="320" class="note">reset or rebase</text>')
    add(f'<text x="512" y="354" class="muted">backend: git | encrypted</text>')
    add(f'<text x="512" y="372" class="muted">age layer: *.age optional</text>')

    # ------------------------------------------------------------ right panel
    add(f'<rect x="720" y="140" width="332" height="338" rx="20" fill="{p["panel"]}" fill-opacity="{p["panel_op"]}" stroke="{p["border"]}" filter="url(#soft)"/>')
    add(f'<text x="740" y="166" class="k">DEVICE B · LOCAL</text>')
    add(f'<text x="740" y="192" class="ptitle">Pull, merge &amp; restore</text>')
    add(f'<text x="740" y="210" class="pnote">pull path · manual writes confirm</text>')

    add(f'<rect x="738" y="218" width="296" height="64" rx="18" fill="{p["node"]}" fill-opacity="{p["node_op"]}" stroke="{p["node_border"]}"/>')
    add(f'<text x="756" y="242" class="mtitle">fetch origin/main</text>')
    add(f'<text x="756" y="260" class="note">remote refs only · worktree untouched</text>')
    add(f'<text x="756" y="276" class="muted">three-way merge stays local</text>')
    add(f'<line x1="760" y1="282" x2="760" y2="300" stroke="{A}" stroke-width="2" marker-end="url(#ar)"/>')
    add(f'<text x="774" y="299" class="lbl">beginMerge</text>')

    add(f'<rect x="738" y="306" width="296" height="78" rx="18" fill="{p["node"]}" fill-opacity="{p["node_op"]}" stroke="{p["node_border"]}"/>')
    add(f'<text x="756" y="330" class="ctitle">three-way merge</text>')
    for i, (label, dx) in enumerate((("base", 0), ("ours", 78), ("theirs", 156))):
        add(f'<rect x="{756 + dx}" y="340" width="70" height="22" rx="7" fill="{p["chip"]}" stroke="{p["chip_border"]}"/>')
        add(f'<text x="{791 + dx}" y="355" class="mono" text-anchor="middle">{label}</text>')
    add(f'<text x="756" y="378" class="note">per-file byte compare · no parsing</text>')
    add(f'<line x1="760" y1="384" x2="760" y2="402" stroke="{A}" stroke-width="2" marker-end="url(#ar)"/>')
    add(f'<text x="774" y="401" class="lbl">keep-both</text>')

    add(f'<rect x="738" y="408" width="296" height="62" rx="18" fill="{p["node"]}" fill-opacity="{p["node_op"]}" stroke="{p["node_border"]}"/>')
    add(f'<text x="756" y="432" class="ctitle">merge commit + restore</text>')
    add(f'<text x="756" y="450" class="note">sessions resume on this device</text>')
    add(f'<text x="756" y="466" class="muted">fork files never deleted</text>')

    # ------------------------------------------------------------- crossing
    add(f'<line x1="380" y1="428" x2="472" y2="428" stroke="{A}" stroke-width="2.5" marker-end="url(#ar)"/>')
    add(f'<text x="382" y="418" class="lbl">push</text>')
    add(f'<line x1="484" y1="252" x2="730" y2="252" stroke="{A}" stroke-width="2.5" marker-end="url(#ar)"/>')
    add(f'<text x="690" y="243" class="lbl">pull</text>')

    # ----------------------------------------------------------- keep-both
    add(f'<rect x="48" y="492" width="1004" height="140" rx="20" fill="{p["panel"]}" fill-opacity="{p["panel_op"]}" stroke="{p["border"]}" filter="url(#soft)"/>')
    add(f'<text x="68" y="522" class="k">KEEP-BOTH · PER-FILE VERDICT</text>')
    add(f'<text x="68" y="550" class="ctitle">Never silently overwrite</text>')
    add(f'<text x="68" y="576" class="note">same bytes or ours-only → keep ours</text>')
    add(f'<text x="68" y="592" class="note">theirs-only → adopt the remote bytes</text>')
    add(f'<text x="68" y="608" class="note">both advanced / rewritten → keep ours + fork</text>')

    for i, label in enumerate(("base", "ours", "theirs")):
        x = 372 + i * 74
        add(f'<rect x="{x}" y="548" width="66" height="34" rx="10" fill="{p["chip"]}" stroke="{p["chip_border"]}"/>')
        add(f'<text x="{x + 33}" y="570" class="mono" text-anchor="middle">{label}</text>')
        add(f'<path d="M{x + 66} 565 C{x + 92} 565 {560 if i < 2 else 600} 550 634 556" fill="none" stroke="{A}" stroke-width="1.6" stroke-opacity=".72"/>')

    add(f'<path d="M640 565 L700 531 L760 565 L700 599 Z" fill="{p["accent"]}" fill-opacity=".14" stroke="{A}" stroke-width="1.8" stroke-linejoin="round"/>')
    add(f'<text x="700" y="562" class="lbl" text-anchor="middle">classify</text>')
    add(f'<text x="700" y="578" class="mono" text-anchor="middle">per file</text>')

    add(f'<path d="M760 565 C780 565 782 544 800 544" fill="none" stroke="{A}" stroke-width="1.8" marker-end="url(#ar)"/>')
    add(f'<path d="M760 565 C780 565 782 600 800 600" fill="none" stroke="{A}" stroke-width="1.8" marker-end="url(#ar)"/>')

    add(f'<rect x="800" y="520" width="228" height="46" rx="18" fill="{p["node"]}" fill-opacity="{p["node_op"]}" stroke="{p["node_border"]}"/>')
    add(f'<text x="816" y="540" class="lbl">ours</text>')
    add(f'<text x="816" y="556" class="note">kept at the original path</text>')
    add(f'<rect x="800" y="574" width="228" height="52" rx="18" fill="{p["accent"]}" fill-opacity=".10" stroke="{A}" stroke-width="1.5"/>')
    add(f'<text x="816" y="594" class="lbl">theirs → fork file</text>')
    add(f'<text x="816" y="610" class="mono">&lt;basename&gt;.remote-fork-</text>')
    add(f'<text x="816" y="624" class="mono">&lt;UTC14&gt;-&lt;device8&gt;</text>')

    add(f'<text x="550" y="652" class="foot" text-anchor="middle">Fork files are never deleted or overwritten · each device can push and pull · auto: on mount, turn end, every N minutes</text>')
    add('</svg>')
    return "\n".join(s) + "\n"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for lang in ("zh", "en"):
        for scheme in ("light", "dark"):
            img = render_hero(lang, scheme)
            path = os.path.join(OUT, f"dsh-session-sync-hero-{lang}-{scheme}.webp")
            img.save(path, "WEBP", quality=93, method=6)
            print(f"wrote {os.path.relpath(path, ROOT)} {img.width}x{img.height}")
    for scheme in ("light", "dark"):
        path = os.path.join(OUT, f"dsh-session-sync-flow-v5-{scheme}.svg")
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(scheme))
        print(f"wrote {os.path.relpath(path, ROOT)} {FLOW_W}x{FLOW_H}")


if __name__ == "__main__":
    main()
