# Reusable SVG component library, retro "N64-era low-poly 3D game" take on
# the D&D scenes: chunky flat-shaded blocky characters standing on a
# perspective ground-plane with a horizon and simple fog banding, like an
# early Ocarina-of-Time-ish screenshot. Hand-authored vector shapes, no AI
# generation, no risk of hallucinated text.

import math

INK = "#2b1f14"       # soft dark brown-black outline, less harsh than pure black
PAPER = "#ece0c0"      # generic "surface" tone for scrolls/books/dice/bubbles
AMBER = "#c98a2e"       # gold accent (tags, price tags, coins)
AMBER_LIGHT = "#e8b563"
SW = 6  # base stroke width

# ---- retro game environment palette --------------------------------------
SKY = "#7ec8e3"
SKY_FOG = "#dbead9"
GRASS = "#5a9450"
GRASS_DARK = "#3c6b3a"
STONE = "#a8a196"
STONE_DARK = "#7a7468"
WOOD = "#8a5a34"
WOOD_DARK = "#5e3b1f"
SAND = "#dcc487"
SAND_DARK = "#b89c5c"
WATER = "#4f9fc0"
WATER_DARK = "#356f8a"
NIGHT_SKY = "#26355c"
STAGE_RED = "#8f2d2d"
WALL_STONE = "#87837a"
WALL_WOOD = "#6b4527"
PURPLE = "#6b4c9a"
PURPLE_DARK = "#4a3269"

SKIN = "#e0ac7c"
SKIN_DARK = "#c08a5c"

# ---- character class palettes ---------------------------------------------
PALETTES = {
    "fighter": dict(skin=SKIN, hair="#5a3a22", torso="#8b8e94", torso_dark="#5f6266", legwear="#6b6e73", boot="#4a3320"),
    "wizard":  dict(skin=SKIN, hair="#b9b9b9", torso=PURPLE, torso_dark=PURPLE_DARK, legwear=PURPLE_DARK, boot="#3a2a1a"),
    "rogue":   dict(skin=SKIN, hair="#241d15", torso="#3f6b3c", torso_dark="#294a27", legwear="#4a3320", boot="#241d15"),
    "dwarf":   dict(skin="#dba06e", hair="#c9601f", torso="#a8492f", torso_dark="#7a3220", legwear="#5e3b1f", boot="#3a2a1a"),
    "elf":     dict(skin="#e7c49a", hair="#d8b64a", torso="#4c8a5c", torso_dark="#336240", legwear="#c9b57a", boot="#5e3b1f"),
    "gnome":   dict(skin=SKIN, hair="#e6e6e6", torso="#3f6fae", torso_dark="#2b4d7a", legwear="#a8492f", boot="#4a3320"),
    "bard":    dict(skin=SKIN, hair="#7a3c1d", torso="#a63f5c", torso_dark="#77293f", legwear="#4a3320", boot="#3a2a1a"),
    "druid":   dict(skin="#dba06e", hair="#6b4a24", torso="#5a7d3a", torso_dark="#3c5726", legwear="#6b4a24", boot="#3a2a1a"),
    "merchant":dict(skin=SKIN, hair="#4a3320", torso="#b0752f", torso_dark="#7d5220", legwear="#5e3b1f", boot="#3a2a1a"),
    "scribe":  dict(skin=SKIN, hair="#3a2a1a", torso="#3f6fae", torso_dark="#2b4d7a", legwear="#6b6e73", boot="#3a2a1a"),
    "ranger":  dict(skin="#dba06e", hair="#4a3320", torso="#4c6a3a", torso_dark="#334927", legwear="#5e4223", boot="#3a2a1a"),
}

_current_palette = ["fighter"]

def set_class(name):
    """Set the default character palette for subsequent chunky_figure() calls
    in the current scene (call once near the top of a scene function)."""
    _current_palette[0] = name if name in PALETTES else "fighter"

def _g(x, y, content, extra=""):
    return f'<g transform="translate({x},{y})" {extra}>{content}</g>'

def _thick_limb(x1, y1, x2, y2, width, color, shade=None):
    main = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>'
    if not shade:
        return main
    sx1, sy1, sx2, sy2 = x1 + 4, y1 + 3, x2 + 4, y2 + 3
    shadow = (f'<line x1="{sx1}" y1="{sy1}" x2="{sx2}" y2="{sy2}" stroke="{shade}" '
              f'stroke-width="{width*0.42:.1f}" stroke-linecap="round" opacity="0.55"/>')
    return main + shadow

def stick_figure(cx, cy, scale=1.0, arms="down", legs="stand", head_r=36,
                  torso=100, rotate=0, flip=False, palette=None):
    """Chunky low-poly N64-style humanoid. cx,cy = hip/pelvis reference point.
    Kept the name `stick_figure` (aliased below as `chunky_figure` too) so
    existing scene-composition code that already calls s.stick_figure(...)
    with the same preset arm/leg vocabulary keeps working unmodified."""
    pal = PALETTES[palette or _current_palette[0]]
    hr = head_r
    neck_y = -torso
    head_cy = neck_y - hr - 2

    arm_presets = {
        "down":    [(-16, 68), (16, 68)],
        "up":      [(-55, -55), (55, -55)],
        "cross":   [(20, 5), (-20, 5)],
        "point_r": [(-14, 62), (78, -6)],
        "point_l": [(-78, -6), (14, 62)],
        "wave":    [(-18, 64), (60, -60)],
        "hold_fwd":[(38, -12), (52, 6)],
        "hold_fwd2":[(34, -6), (34, -6)],
        "shrug":   [(-45, -10), (45, -10)],
        "out":     [(-70, -10), (70, -10)],
    }
    leg_presets = {
        "stand":  [(-24, 92), (24, 92)],
        "walk":   [(-34, 86), (36, 96)],
        "sit":    [(-30, 40), (30, 40)],
        "kneel":  [(-26, 50), (30, 92)],
    }
    a1, a2 = arm_presets.get(arms, arm_presets["down"])
    l1, l2 = leg_presets.get(legs, leg_presets["stand"])
    shoulder_y = neck_y + 20

    parts = []
    # legs first (behind torso)
    for (lx, ly) in (l1, l2):
        parts.append(_thick_limb(0, 0, lx, ly, 32, pal["legwear"], pal["torso_dark"]))
        parts.append(f'<ellipse cx="{lx}" cy="{ly}" rx="15" ry="11" fill="{pal["boot"]}" stroke="{INK}" stroke-width="2"/>')
    # belt
    parts.append(f'<rect x="-26" y="-10" width="52" height="14" rx="3" fill="{pal["torso_dark"]}" stroke="{INK}" stroke-width="2"/>')
    # torso
    parts.append(_thick_limb(0, neck_y + hr * 0.5, 0, 0, 50, pal["torso"], pal["torso_dark"]))
    # arms (over torso)
    for (ax, ay) in (a1, a2):
        parts.append(_thick_limb(0, shoulder_y, ax, ay, 24, pal["torso"], pal["torso_dark"]))
        parts.append(f'<circle cx="{ax}" cy="{ay}" r="12" fill="{pal["skin"]}" stroke="{INK}" stroke-width="2.5"/>')
    # head + hair + face
    parts.append(f'<circle cx="0" cy="{head_cy}" r="{hr}" fill="{pal["skin"]}" stroke="{INK}" stroke-width="{SW}"/>')
    parts.append(f'<ellipse cx="0" cy="{head_cy - hr*0.55}" rx="{hr*0.98}" ry="{hr*0.6}" fill="{pal["hair"]}" stroke="{INK}" stroke-width="3"/>')
    parts.append(f'<circle cx="{-hr*0.32}" cy="{head_cy + hr*0.08}" r="{max(hr*0.1,3)}" fill="{INK}"/>')
    parts.append(f'<circle cx="{hr*0.32}" cy="{head_cy + hr*0.08}" r="{max(hr*0.1,3)}" fill="{INK}"/>')

    content = "".join(parts)
    tr = f'translate({cx},{cy}) scale({-scale if flip else scale},{scale}) rotate({rotate})'
    return f'<g transform="{tr}">{content}</g>'

chunky_figure = stick_figure

def head_top(cx, cy, torso=100, head_r=36):
    neck_y = -torso
    head_cy = neck_y - head_r - 2
    return (cx, cy + head_cy - head_r * 0.85)

def wizard_hat(x, y, scale=0.9, rotate=-8):
    p = (f'<polygon points="-30,4 30,4 5,-76 -5,-76" fill="{PURPLE}" stroke="{INK}" stroke-width="3"/>'
         f'<ellipse cx="0" cy="4" rx="34" ry="8" fill="{PURPLE_DARK}" stroke="{INK}" stroke-width="3"/>'
         f'<circle cx="-2" cy="-62" r="7" fill="{AMBER}" stroke="{INK}" stroke-width="2"/>')
    return f'<g transform="translate({x},{y}) scale({scale}) rotate({rotate})">{p}</g>'

def d20(x, y, scale=1.0, show_20=True):
    poly = f'<polygon points="0,-40 35,-20 35,20 0,40 -35,20 -35,-20" fill="{PAPER}" stroke="{INK}" stroke-width="6"/>'
    shade = f'<polygon points="0,-40 35,-20 35,20 0,40" fill="{STONE_DARK}" opacity="0.28"/>'
    lines = (f'<line x1="0" y1="-40" x2="0" y2="40" stroke="{INK}" stroke-width="3"/>'
             f'<line x1="-35" y1="-20" x2="35" y2="20" stroke="{INK}" stroke-width="3"/>'
             f'<line x1="35" y1="-20" x2="-35" y2="20" stroke="{INK}" stroke-width="3"/>')
    dot = f'<circle cx="0" cy="-2" r="6" fill="{AMBER}"/>' if show_20 else ""
    return f'<g transform="translate({x},{y}) scale({scale})">{poly}{shade}{lines}{dot}</g>'

def sword(x, y, scale=1.0, rotate=25):
    blade = f'<line x1="0" y1="60" x2="0" y2="-70" stroke="{STONE}" stroke-width="8" stroke-linecap="round"/>'
    blade_edge = f'<line x1="3" y1="55" x2="3" y2="-64" stroke="{PAPER}" stroke-width="2.5" stroke-linecap="round"/>'
    guard = f'<line x1="-22" y1="14" x2="22" y2="14" stroke="{AMBER}" stroke-width="8" stroke-linecap="round"/>'
    hilt = f'<line x1="0" y1="14" x2="0" y2="44" stroke="{WOOD_DARK}" stroke-width="10" stroke-linecap="round"/>'
    pommel = f'<circle cx="0" cy="48" r="7" fill="{AMBER}"/>'
    return f'<g transform="translate({x},{y}) rotate({rotate}) scale({scale})">{blade}{blade_edge}{guard}{hilt}{pommel}</g>'

def dragon(x, y, scale=1.0, flip=False):
    body = (f'<path d="M -60,20 Q -20,-40 40,-10 Q 70,0 80,-20 Q 60,10 40,20 Q 10,40 -30,35 Q -55,32 -60,20 Z" '
            f'fill="{GRASS}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>')
    belly = f'<path d="M -40,25 Q 0,38 40,15 Q 10,30 -40,25 Z" fill="{SAND}" opacity="0.8"/>'
    wing = f'<path d="M -10,-15 Q 10,-55 45,-40 Q 20,-30 15,-8 Z" fill="{GRASS_DARK}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    head = f'<path d="M 40,-10 Q 60,-25 78,-18 Q 68,-10 66,0 Q 55,-2 40,-10 Z" fill="{GRASS}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    horn = f'<line x1="70" y1="-20" x2="76" y2="-32" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>'
    eye = f'<circle cx="62" cy="-12" r="2.5" fill="{AMBER}"/>'
    scale_tr = f'scale({-scale if flip else scale},{scale})'
    return f'<g transform="translate({x},{y}) {scale_tr}">{body}{belly}{wing}{head}{horn}{eye}</g>'

def owl(x, y, scale=1.0):
    body = f'<ellipse cx="0" cy="10" rx="46" ry="52" fill="#8a6a44" stroke="{INK}" stroke-width="6"/>'
    belly = f'<ellipse cx="0" cy="24" rx="26" ry="30" fill="{SAND}" opacity="0.85"/>'
    ear1 = f'<path d="M -30,-40 L -38,-64 L -14,-46 Z" fill="#8a6a44" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    ear2 = f'<path d="M 30,-40 L 38,-64 L 14,-46 Z" fill="#8a6a44" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    eye1 = f'<circle cx="-16" cy="-4" r="13" fill="{PAPER}" stroke="{INK}" stroke-width="5"/><circle cx="-16" cy="-4" r="4" fill="{INK}"/>'
    eye2 = f'<circle cx="16" cy="-4" r="13" fill="{PAPER}" stroke="{INK}" stroke-width="5"/><circle cx="16" cy="-4" r="4" fill="{INK}"/>'
    beak = f'<path d="M -6,14 L 6,14 L 0,26 Z" fill="{AMBER}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
    feet = f'<line x1="-10" y1="60" x2="-14" y2="74" stroke="{AMBER}" stroke-width="5" stroke-linecap="round"/><line x1="10" y1="60" x2="14" y2="74" stroke="{AMBER}" stroke-width="5" stroke-linecap="round"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{body}{belly}{ear1}{ear2}{eye1}{eye2}{beak}{feet}</g>'

def fox(x, y, scale=1.0, flip=False):
    head = f'<path d="M -40,10 Q -46,-30 0,-34 Q 46,-30 40,10 Q 20,36 0,36 Q -20,36 -40,10 Z" fill="#d97a2e" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
    cheeks = f'<path d="M -30,10 Q 0,32 30,10 Q 0,44 -30,10 Z" fill="{PAPER}" opacity="0.9"/>'
    ear1 = f'<path d="M -30,-28 L -42,-64 L -8,-40 Z" fill="#d97a2e" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    ear2 = f'<path d="M 30,-28 L 42,-64 L 8,-40 Z" fill="#d97a2e" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    snout = f'<path d="M -10,20 Q 0,34 10,20 Q 4,30 0,30 Q -4,30 -10,20 Z" fill="{INK}"/>'
    eye1 = f'<circle cx="-14" cy="0" r="3" fill="{INK}"/>'
    eye2 = f'<circle cx="14" cy="0" r="3" fill="{INK}"/>'
    scale_tr = f'scale({-scale if flip else scale},{scale})'
    return f'<g transform="translate({x},{y}) {scale_tr}">{head}{cheeks}{ear1}{ear2}{snout}{eye1}{eye2}</g>'

def koala(x, y, scale=1.0):
    head = f'<circle cx="0" cy="0" r="40" fill="#8f8f8f" stroke="{INK}" stroke-width="6"/>'
    ear1 = f'<circle cx="-38" cy="-24" r="16" fill="#8f8f8f" stroke="{INK}" stroke-width="5"/>'
    ear2 = f'<circle cx="38" cy="-24" r="16" fill="#8f8f8f" stroke="{INK}" stroke-width="5"/>'
    nose = f'<ellipse cx="0" cy="14" rx="12" ry="8" fill="{INK}"/>'
    eye1 = f'<circle cx="-14" cy="-6" r="3" fill="{INK}"/>'
    eye2 = f'<circle cx="14" cy="-6" r="3" fill="{INK}"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{head}{ear1}{ear2}{nose}{eye1}{eye2}</g>'

def gear(x, y, r=34, scale=1.0, teeth=8):
    pts = []
    for i in range(teeth * 2):
        ang = i * (360 / (teeth * 2))
        rad = r if i % 2 == 0 else r * 0.72
        rr = math.radians(ang)
        pts.append(f"{rad*math.cos(rr):.1f},{rad*math.sin(rr):.1f}")
    poly = f'<polygon points="{" ".join(pts)}" fill="{STONE}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    hole = f'<circle cx="0" cy="0" r="{r*0.32}" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{poly}{hole}</g>'

def castle(x, y, scale=1.0):
    base = f'<rect x="-70" y="-30" width="140" height="90" fill="{STONE}" stroke="{INK}" stroke-width="6"/>'
    base_shade = f'<rect x="0" y="-30" width="70" height="90" fill="{STONE_DARK}" opacity="0.35"/>'
    crenel = "".join(f'<rect x="{-70+i*20}" y="-50" width="14" height="22" fill="{STONE}" stroke="{INK}" stroke-width="5"/>' for i in range(8))
    tower = f'<rect x="-20" y="-90" width="40" height="60" fill="{STONE}" stroke="{INK}" stroke-width="6"/>'
    roof = f'<polygon points="-24,-90 24,-90 0,-130" fill="{STAGE_RED}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    door = f'<rect x="-14" y="20" width="28" height="40" rx="12" fill="{WOOD_DARK}"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{base}{base_shade}{crenel}{tower}{roof}{door}</g>'

def hourglass(x, y, scale=1.0, sand_level=0.5):
    outline = f'<path d="M -34,-56 L 34,-56 L 6,0 L 34,56 L -34,56 L -6,0 Z" fill="{PAPER}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
    top_cap = f'<rect x="-40" y="-64" width="80" height="10" rx="4" fill="{WOOD_DARK}"/>'
    bot_cap = f'<rect x="-40" y="54" width="80" height="10" rx="4" fill="{WOOD_DARK}"/>'
    sand_top = f'<polygon points="-20,-50 20,-50 6,-6 -6,-6" fill="{AMBER_LIGHT}" opacity="0.85"/>'
    sand_bot = f'<polygon points="-22,50 22,50 8,{8+ (44*(1-sand_level))} -8,{8+(44*(1-sand_level))}" fill="{AMBER_LIGHT}" opacity="0.85"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{outline}{sand_top}{sand_bot}{top_cap}{bot_cap}</g>'

def coin_purse(x, y, scale=1.0):
    body = f'<path d="M -30,10 Q -34,50 0,54 Q 34,50 30,10 Q 30,-14 0,-14 Q -30,-14 -30,10 Z" fill="{AMBER_LIGHT}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
    tie = f'<path d="M -14,-14 Q 0,-30 14,-14" fill="none" stroke="{WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>'
    knot = f'<circle cx="0" cy="-16" r="6" fill="{WOOD_DARK}"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{body}{tie}{knot}</g>'

def coin_stack(x, y, n=4, scale=1.0):
    els = []
    for i in range(n):
        els.append(f'<ellipse cx="0" cy="{-i*14}" rx="26" ry="10" fill="{AMBER_LIGHT}" stroke="{INK}" stroke-width="4"/>')
    return f'<g transform="translate({x},{y}) scale({scale})">{"".join(els)}</g>'

def book_closed(x, y, scale=1.0, rotate=0):
    cover = f'<rect x="-40" y="-28" width="80" height="56" rx="4" fill="#3f6fae" stroke="{INK}" stroke-width="6"/>'
    spine = f'<line x1="0" y1="-28" x2="0" y2="28" stroke="{INK}" stroke-width="4"/>'
    band = f'<rect x="-40" y="-6" width="80" height="8" fill="{AMBER}"/>'
    return f'<g transform="translate({x},{y}) rotate({rotate}) scale({scale})">{cover}{spine}{band}</g>'

def envelope(x, y, scale=1.0, rotate=0):
    body = f'<rect x="-32" y="-22" width="64" height="44" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>'
    flap = f'<path d="M -32,-22 L 0,4 L 32,-22" fill="none" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    seal = f'<circle cx="0" cy="-4" r="6" fill="{AMBER}"/>'
    return f'<g transform="translate({x},{y}) rotate({rotate}) scale({scale})">{body}{flap}{seal}</g>'

def table(x, y, w=140, h=6, leg_h=50):
    top = f'<rect x="{-w/2}" y="0" width="{w}" height="{h}" fill="{WOOD_DARK}"/>'
    leg1 = f'<line x1="{-w/2+10}" y1="{h}" x2="{-w/2+10}" y2="{h+leg_h}" stroke="{WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>'
    leg2 = f'<line x1="{w/2-10}" y1="{h}" x2="{w/2-10}" y2="{h+leg_h}" stroke="{WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>'
    return f'<g transform="translate({x},{y})">{top}{leg1}{leg2}</g>'

def round_table(x, y, r=90, scale=1.0):
    top = f'<ellipse cx="0" cy="0" rx="{r}" ry="{r*0.36}" fill="{WOOD}" stroke="{INK}" stroke-width="6"/>'
    leg1 = f'<line x1="{-r*0.5}" y1="{r*0.14}" x2="{-r*0.5}" y2="{r*0.14+50}" stroke="{WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>'
    leg2 = f'<line x1="{r*0.5}" y1="{r*0.14}" x2="{r*0.5}" y2="{r*0.14+50}" stroke="{WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{leg1}{leg2}{top}</g>'

def cloud(x, y, scale=1.0, storm=False):
    body = f'<path d="M -60,10 Q -70,-30 -30,-30 Q -20,-56 20,-46 Q 60,-50 60,-14 Q 80,-10 70,16 L -60,16 Q -76,14 -60,10 Z" fill="#e8eef2" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
    bolt = f'<polygon points="0,20 -14,50 0,46 -10,80 24,40 8,44 18,20" fill="{AMBER}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>' if storm else ""
    return f'<g transform="translate({x},{y}) scale({scale})">{body}{bolt}</g>'

def candle(x, y, scale=1.0, h=60):
    body = f'<rect x="-10" y="{-h}" width="20" height="{h}" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>'
    wick = f'<line x1="0" y1="{-h}" x2="0" y2="{-h-8}" stroke="{INK}" stroke-width="3"/>'
    flame = f'<path d="M 0,{-h-8} Q 10,{-h-26} 0,{-h-40} Q -10,{-h-26} 0,{-h-8} Z" fill="{AMBER_LIGHT}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{body}{wick}{flame}</g>'

def star(x, y, scale=1.0, fill=None):
    fill = fill or AMBER_LIGHT
    pts = "0,-20 5,-5 20,0 5,5 0,20 -5,5 -20,0 -5,-5"
    return f'<g transform="translate({x},{y}) scale({scale})"><polygon points="{pts}" fill="{fill}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/></g>'

def firefly(x, y, scale=1.0):
    glow = f'<circle cx="0" cy="0" r="14" fill="{AMBER_LIGHT}" opacity="0.55"/>'
    body = f'<circle cx="0" cy="0" r="5" fill="{AMBER}" stroke="{INK}" stroke-width="2"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{glow}{body}</g>'

def bee(x, y, scale=1.0):
    body = f'<ellipse cx="0" cy="0" rx="16" ry="11" fill="{AMBER_LIGHT}" stroke="{INK}" stroke-width="4"/>'
    stripe1 = f'<rect x="-4" y="-11" width="5" height="22" fill="{INK}"/>'
    stripe2 = f'<rect x="6" y="-11" width="5" height="22" fill="{INK}"/>'
    wing = f'<ellipse cx="-4" cy="-14" rx="10" ry="7" fill="{PAPER}" stroke="{INK}" stroke-width="2" opacity="0.85"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{wing}{body}{stripe1}{stripe2}</g>'

def chess_piece(x, y, scale=1.0):
    base = f'<rect x="-12" y="10" width="24" height="8" rx="2" fill="{INK}"/>'
    body = f'<path d="M -8,10 Q -10,-14 0,-24 Q 10,-14 8,10 Z" fill="{PAPER}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    top = f'<circle cx="0" cy="-26" r="6" fill="{INK}"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{base}{body}{top}</g>'

def crystal_ball(x, y, scale=1.0):
    stand = f'<path d="M -20,30 Q 0,44 20,30 L 24,40 Q 0,54 -24,40 Z" fill="{WOOD_DARK}"/>'
    ball = f'<circle cx="0" cy="0" r="38" fill="{WATER}" stroke="{INK}" stroke-width="6" opacity="0.9"/>'
    shine = f'<circle cx="-12" cy="-14" r="8" fill="{PAPER}" stroke="{INK}" stroke-width="2" opacity="0.7"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{stand}{ball}{shine}</g>'

def scroll_rolled(x, y, scale=1.0, rotate=0):
    tube = f'<rect x="-42" y="-10" width="84" height="20" rx="10" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>'
    cap1 = f'<circle cx="-42" cy="0" r="10" fill="{WOOD}" stroke="{INK}" stroke-width="5"/>'
    cap2 = f'<circle cx="42" cy="0" r="10" fill="{WOOD}" stroke="{INK}" stroke-width="5"/>'
    ribbon = f'<rect x="-4" y="-12" width="8" height="24" fill="{AMBER}"/>'
    return f'<g transform="translate({x},{y}) rotate({rotate}) scale({scale})">{cap1}{cap2}{tube}{ribbon}</g>'

def lever(x, y, scale=1.0, pulled=False):
    base = f'<rect x="-20" y="20" width="40" height="14" rx="4" fill="{STONE_DARK}"/>'
    angle = -50 if pulled else -80
    stick = f'<line x1="0" y1="20" x2="0" y2="-60" stroke="{STONE}" stroke-width="8" stroke-linecap="round" transform="rotate({angle if pulled else 0})"/>'
    knob = f'<circle cx="0" cy="-60" r="9" fill="{AMBER}"/>' if not pulled else ""
    return f'<g transform="translate({x},{y}) scale({scale})">{base}{stick}</g>'

def clock_face(x, y, r=60, scale=1.0):
    face = f'<circle cx="0" cy="0" r="{r}" fill="{PAPER}" stroke="{INK}" stroke-width="6"/>'
    ticks = "".join(
        f'<line x1="{0.82*r*math.cos(math.radians(a))}" y1="{0.82*r*math.sin(math.radians(a))}" '
        f'x2="{0.95*r*math.cos(math.radians(a))}" y2="{0.95*r*math.sin(math.radians(a))}" '
        f'stroke="{INK}" stroke-width="3"/>' for a in range(0, 360, 30)
    )
    h1 = f'<line x1="0" y1="0" x2="0" y2="{-r*0.5}" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
    h2 = f'<line x1="0" y1="0" x2="{r*0.7}" y2="0" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{face}{ticks}{h1}{h2}</g>'

def wall_of_holes(x, y, cols=4, rows=2, scale=1.0):
    els = []
    for r in range(rows):
        for c in range(cols):
            cx = c * 46
            cy = r * 46
            els.append(f'<rect x="{cx}" y="{cy}" width="36" height="36" fill="{PAPER}" stroke="{INK}" stroke-width="4"/>')
    return f'<g transform="translate({x},{y}) scale({scale})">{"".join(els)}</g>'

def musical_note(x, y, scale=1.0):
    stem = f'<line x1="10" y1="-40" x2="10" y2="10" stroke="{INK}" stroke-width="5"/>'
    head = f'<ellipse cx="0" cy="12" rx="11" ry="8" fill="{INK}" transform="rotate(-15 0 12)"/>'
    flag = f'<path d="M 10,-40 Q 26,-32 10,-18" fill="none" stroke="{INK}" stroke-width="5"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{stem}{head}{flag}</g>'

def scale_swap(x, y, w=90, scale=1.0):
    post = f'<line x1="0" y1="-70" x2="0" y2="20" stroke="{INK}" stroke-width="6"/>'
    beam = f'<line x1="{-w/2}" y1="-70" x2="{w/2}" y2="-70" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>'
    l1 = f'<line x1="{-w/2}" y1="-70" x2="{-w/2}" y2="-46" stroke="{INK}" stroke-width="3"/>'
    l2 = f'<line x1="{w/2}" y1="-70" x2="{w/2}" y2="-46" stroke="{INK}" stroke-width="3"/>'
    pan1 = f'<path d="M {-w/2-16},-46 Q {-w/2},-30 {-w/2+16},-46" fill="none" stroke="{INK}" stroke-width="4"/>'
    pan2 = f'<path d="M {w/2-16},-46 Q {w/2},-30 {w/2+16},-46" fill="none" stroke="{INK}" stroke-width="4"/>'
    base = f'<line x1="-24" y1="20" x2="24" y2="20" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{post}{beam}{l1}{l2}{pan1}{pan2}{base}</g>'

def stepping_stones(x, y, n=4, scale=1.0):
    els = []
    for i in range(n):
        els.append(f'<ellipse cx="{i*44}" cy="{(i%2)*10}" rx="20" ry="10" fill="{STONE}" stroke="{INK}" stroke-width="4"/>')
    return f'<g transform="translate({x},{y}) scale({scale})">{"".join(els)}</g>'

def label(x, y, text, size=26, weight="bold", anchor="middle", rotate=0, color=None, family=None):
    color = color or INK
    family = family or "'Trebuchet MS', 'Arial Black', sans-serif"
    esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{family}" '
            f'font-size="{size}" font-weight="{weight}" fill="{color}" '
            f'transform="rotate({rotate} {x} {y})">{esc}</text>')

def tag(x, y, text, color=None, scale=1.0, rotate=0):
    color = color or AMBER
    body = f'<rect x="-30" y="-16" width="60" height="32" rx="6" fill="{color}" stroke="{INK}" stroke-width="4"/>'
    hole = f'<circle cx="-20" cy="0" r="4" fill="{PAPER}" stroke="{INK}" stroke-width="2"/>'
    txt = label(4, 8, text, size=18, color=PAPER)
    return f'<g transform="translate({x},{y}) scale({scale}) rotate({rotate})">{body}{hole}{txt}</g>'

def speech_bubble(x, y, w=140, h=80, text="", tail="bl", size=22, scale=1.0):
    tails = {
        "bl": f'<polygon points="{-w*0.28},{h*0.42} {-w*0.44},{h*0.42+34} {-w*0.06},{h*0.42}" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>',
        "br": f'<polygon points="{w*0.28},{h*0.42} {w*0.44},{h*0.42+34} {w*0.06},{h*0.42}" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>',
    }
    tail_svg = tails.get(tail, tails["bl"])
    body = f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="18" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>'
    txt = label(0, 8, text, size=size) if text else ""
    return f'<g transform="translate({x},{y}) scale({scale})">{tail_svg}{body}{txt}</g>'

def thought_bubble(x, y, w=130, h=76, text="", scale=1.0):
    body = f'<ellipse cx="0" cy="0" rx="{w/2}" ry="{h/2}" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>'
    b1 = f'<circle cx="{-w*0.3}" cy="{h*0.55}" r="12" fill="{PAPER}" stroke="{INK}" stroke-width="4"/>'
    b2 = f'<circle cx="{-w*0.42}" cy="{h*0.78}" r="7" fill="{PAPER}" stroke="{INK}" stroke-width="3"/>'
    txt = label(0, 8, text, size=22) if text else ""
    return f'<g transform="translate({x},{y}) scale({scale})">{body}{b1}{b2}{txt}</g>'

def x_mark(x, y, size=18, scale=1.0, color=None):
    color = color or INK
    return (f'<g transform="translate({x},{y}) scale({scale})">'
            f'<line x1="{-size}" y1="{-size}" x2="{size}" y2="{size}" stroke="{color}" stroke-width="6" stroke-linecap="round"/>'
            f'<line x1="{size}" y1="{-size}" x2="{-size}" y2="{size}" stroke="{color}" stroke-width="6" stroke-linecap="round"/></g>')

def check_mark(x, y, size=18, scale=1.0, color=None):
    color = color or AMBER
    return (f'<g transform="translate({x},{y}) scale({scale})">'
            f'<polyline points="{-size},{0} {-size*0.2},{size*0.8} {size},{-size*0.8}" '
            f'fill="none" stroke="{color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>')

def arrow(x1, y1, x2, y2, scale=1.0, color=None):
    color = color or INK
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
    head = (f'<g transform="translate({x2},{y2}) rotate({ang})">'
            f'<line x1="0" y1="0" x2="-16" y2="-9" stroke="{color}" stroke-width="5" stroke-linecap="round"/>'
            f'<line x1="0" y1="0" x2="-16" y2="9" stroke="{color}" stroke-width="5" stroke-linecap="round"/></g>')
    shaft = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="5" stroke-linecap="round"/>'
    return f'<g transform="scale({scale})">{shaft}{head}</g>'

def price_tag(x, y, text="$0", scale=1.0, rotate=0):
    body = f'<path d="M -34,0 L 0,-30 L 34,0 L 0,30 Z" fill="{AMBER_LIGHT}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
    hole = f'<circle cx="0" cy="-14" r="4" fill="{PAPER}" stroke="{INK}" stroke-width="2"/>'
    txt = label(0, 8, text, size=18)
    return f'<g transform="translate({x},{y}) scale({scale}) rotate({rotate})">{body}{hole}{txt}</g>'

# ---- N64-style ground-plane / horizon backdrop ----------------------------

_ENV = {
    # kind: (ground, ground_dark, back, fog_or_None)
    "forest":  (GRASS, GRASS_DARK, SKY, SKY_FOG),
    "camp":    (GRASS, GRASS_DARK, SKY, SKY_FOG),
    "road":    (SAND, SAND_DARK, SKY, SKY_FOG),
    "river":   (GRASS, GRASS_DARK, SKY, SKY_FOG),
    "market":  (STONE, STONE_DARK, SKY, SKY_FOG),
    "hall":    (STONE, STONE_DARK, WALL_STONE, None),
    "tavern":  (WOOD, WOOD_DARK, WALL_WOOD, None),
    "workshop":(WOOD, WOOD_DARK, WALL_WOOD, None),
    "stage":   (WOOD, WOOD_DARK, STAGE_RED, None),
    "sky":     (GRASS, GRASS_DARK, NIGHT_SKY, None),
}

def ground_plane(kind="plain"):
    """Full-canvas N64-style scenery: a flat-colored sky/wall band above a
    horizon line, and a perspective ground-plane trapezoid (with a simple
    fanning grid, like an early-3D-game floor) below it. Meant to be placed
    FIRST (behind the foreground gag)."""
    ground, ground_dark, back, fog = _ENV.get(kind, (STONE, STONE_DARK, SKY, SKY_FOG))
    horizon_y = 400
    base_y = 748
    half_w = 95
    vx = 384
    parts = []
    parts.append(f'<rect x="0" y="0" width="768" height="{horizon_y}" fill="{back}"/>')
    if fog:
        parts.append(f'<rect x="0" y="{horizon_y-28}" width="768" height="28" fill="{fog}" opacity="0.65"/>')
    parts.append(f'<polygon points="{vx-half_w},{horizon_y} {vx+half_w},{horizon_y} 768,{base_y} 0,{base_y}" fill="{ground}"/>')
    for frac in (0.2, 0.4, 0.6, 0.8):
        top_x = (vx - half_w) + frac * (half_w * 2)
        bot_x = 0 + frac * 768
        parts.append(f'<line x1="{top_x:.1f}" y1="{horizon_y}" x2="{bot_x:.1f}" y2="{base_y}" stroke="{ground_dark}" stroke-width="2" opacity="0.4"/>')
    for frac_y in (0.4, 0.7):
        y = horizon_y + frac_y * (base_y - horizon_y)
        left_x = (vx - half_w) + frac_y * (0 - (vx - half_w))
        right_x = (vx + half_w) + frac_y * (768 - (vx + half_w))
        parts.append(f'<line x1="{left_x:.1f}" y1="{y:.1f}" x2="{right_x:.1f}" y2="{y:.1f}" stroke="{ground_dark}" stroke-width="2" opacity="0.4"/>')
    parts.append(f'<line x1="0" y1="{horizon_y}" x2="768" y2="{horizon_y}" stroke="{ground_dark}" stroke-width="3" opacity="0.55"/>')

    if kind in ("forest", "camp"):
        parts.append(_hill_far(150, horizon_y, 260, 70))
        parts.append(_hill_far(620, horizon_y, 300, 90))
        parts.append(_tree_bg(120, base_y - 4, 1.1))
        parts.append(_tree_bg(690, base_y - 4, 0.9))
        parts.append(_tree_bg(70, horizon_y + 60, 0.55))
    elif kind == "road":
        parts.append(_hill_far(150, horizon_y, 240, 60))
        parts.append(_hill_far(640, horizon_y, 280, 80))
    elif kind == "river":
        parts.append(_river_band(horizon_y, base_y))
        parts.append(_reeds(60, base_y - 4))
        parts.append(_reeds(700, base_y - 4, 0.8))
    elif kind == "hall":
        parts.append(_arch(110, 60, 90, 220, WALL_STONE))
        parts.append(_arch(658, 60, 90, 220, WALL_STONE))
    elif kind == "tavern":
        parts.append(_beam(horizon_y * 0.28))
    elif kind == "workshop":
        parts.append(_beam(horizon_y * 0.28))
        parts.append(_tool_silhouette(384, horizon_y * 0.5))
    elif kind == "market":
        parts.append(_awning(160, 40, 180))
        parts.append(_awning(600, 40, 180))
    elif kind == "stage":
        parts.append(_curtain(60, 0, 420, False))
        parts.append(_curtain(708, 0, 420, True))
    elif kind == "sky":
        parts.append(_stars_moon(600, 120))

    return "".join(parts)

backdrop = ground_plane  # alias so any old call sites keep working

def _hill_far(x, y, w, h):
    return (f'<path d="M {x-w/2},{y} Q {x-w/4},{y-h} {x},{y-h} Q {x+w/4},{y-h} {x+w/2},{y} Z" '
            f'fill="{GRASS_DARK}" opacity="0.55"/>')

def _tree_bg(x, y, scale=1.0):
    trunk = f'<rect x="-6" y="-16" width="12" height="20" fill="{WOOD_DARK}"/>'
    tiers = "".join(
        f'<polygon points="-{26-i*5},{-14-i*22} {26-i*5},{-14-i*22} 0,{-48-i*22}" fill="{GRASS_DARK if i%2 else GRASS}" stroke="{INK}" stroke-width="2"/>'
        for i in range(3)
    )
    return f'<g transform="translate({x},{y}) scale({scale})">{trunk}{tiers}</g>'

def _river_band(horizon_y, base_y):
    mid_y = (horizon_y + base_y) / 2 + 30
    p1 = f'<path d="M 300,{horizon_y+10} Q 340,{mid_y} 260,{base_y}" fill="none" stroke="{WATER_DARK}" stroke-width="60" opacity="0.5"/>'
    p2 = f'<path d="M 300,{horizon_y+10} Q 340,{mid_y} 260,{base_y}" fill="none" stroke="{WATER}" stroke-width="42" opacity="0.8"/>'
    return p1 + p2

def _reeds(x, y, scale=1.0):
    blades = "".join(
        f'<path d="M {i*10},0 Q {i*10+6},-30 {i*10-4},-56" fill="none" stroke="{GRASS_DARK}" stroke-width="4"/>'
        for i in range(3)
    )
    return f'<g transform="translate({x},{y}) scale({scale})">{blades}</g>'

def _arch(x, y, w, h, color):
    return (f'<path d="M {x-w/2},{y+h} L {x-w/2},{y} Q {x-w/2},{y-h/2} {x},{y-h/2} '
            f'Q {x+w/2},{y-h/2} {x+w/2},{y} L {x+w/2},{y+h}" fill="none" stroke="{color}" stroke-width="10" opacity="0.7"/>')

def _beam(y):
    return (f'<line x1="20" y1="{y}" x2="748" y2="{y}" stroke="{WOOD_DARK}" stroke-width="14" opacity="0.7"/>'
            + "".join(f'<line x1="{px}" y1="{y}" x2="{px}" y2="{y+300}" stroke="{WOOD_DARK}" stroke-width="10" opacity="0.4"/>' for px in (140, 384, 630)))

def _tool_silhouette(x, y):
    return (f'<g transform="translate({x},{y})" opacity="0.6">'
            f'<line x1="-60" y1="0" x2="60" y2="0" stroke="{STONE_DARK}" stroke-width="6"/>'
            f'<line x1="-30" y1="0" x2="-30" y2="30" stroke="{STONE_DARK}" stroke-width="5"/>'
            f'<line x1="30" y1="0" x2="30" y2="30" stroke="{STONE_DARK}" stroke-width="5"/></g>')

def _awning(x, y, w):
    n = 6
    seg = w / n
    tris = "".join(
        f'<polygon points="{x-w/2+i*seg},{y} {x-w/2+(i+1)*seg},{y} {x-w/2+i*seg+seg/2},{y+26}" '
        f'fill="{STAGE_RED if i % 2 == 0 else PAPER}" stroke="{INK}" stroke-width="2"/>'
        for i in range(n)
    )
    bar = f'<line x1="{x-w/2}" y1="{y}" x2="{x+w/2}" y2="{y}" stroke="{WOOD_DARK}" stroke-width="4"/>'
    return bar + tris

def _curtain(x, y, h, flip):
    w = 100
    sgn = -1 if flip else 1
    return (f'<path d="M {x},{y} Q {x+sgn*w},{y+h*0.3} {x+sgn*w*0.4},{y+h} L {x},{y+h} Z" '
            f'fill="{STAGE_RED}" stroke="{INK}" stroke-width="3" opacity="0.9"/>')

def _stars_moon(x, y):
    moon = f'<path d="M 0,-24 A 24 24 0 1 0 0,24 A 18 18 0 1 1 0,-24 Z" fill="#f0e6c8" opacity="0.9" transform="translate({x},{y})"/>'
    pts = [(x-140, y+30), (x-90, y-20), (x-40, y+40), (x+60, y-10)]
    stars = "".join(
        f'<g transform="translate({sx},{sy}) scale(0.4)"><polygon points="0,-20 5,-5 20,0 5,5 0,20 -5,5 -20,0 -5,-5" '
        f'fill="#f0e6c8" opacity="0.8"/></g>' for sx, sy in pts
    )
    return moon + stars

def frame(width=768, height=768, extra=""):
    return (f'<rect x="0" y="0" width="{width}" height="{height}" fill="{PAPER}"/>{extra}')

def wrap(body, width=768, height=768):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">'
            f'<rect x="0" y="0" width="{width}" height="{height}" fill="{PAPER}"/>'
            f'{body}</svg>')
