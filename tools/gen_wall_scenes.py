import os
import math
import svg_lib_n64 as s

WALL_SCENES = {}

def scene(slug):
    def deco(fn):
        WALL_SCENES[slug] = fn
        return fn
    return deco

# ---------------------------------------------------------------------------
# Small local helpers (subset borrowed/adapted from gen_svg_scenes5.py so this
# file has no import dependency on it).

def hat_on(cx, cy):
    return s.wizard_hat(*s.head_top(cx, cy))

def golem(x, y, scale=1.0):
    body = f'<rect x="-38" y="-40" width="76" height="90" rx="8" fill="{s.STONE}" stroke="{s.INK}" stroke-width="6"/>'
    head = f'<rect x="-26" y="-92" width="52" height="46" rx="6" fill="{s.STONE}" stroke="{s.INK}" stroke-width="6"/>'
    eye1 = f'<circle cx="-10" cy="-70" r="4" fill="{s.INK}"/>'
    eye2 = f'<circle cx="10" cy="-70" r="4" fill="{s.INK}"/>'
    bolt1 = f'<circle cx="-38" cy="-10" r="5" fill="{s.AMBER}"/>'
    bolt2 = f'<circle cx="38" cy="-10" r="5" fill="{s.AMBER}"/>'
    arm1 = f'<line x1="-38" y1="-10" x2="-60" y2="20" stroke="{s.STONE_DARK}" stroke-width="8" stroke-linecap="round"/>'
    arm2 = f'<line x1="38" y1="-10" x2="60" y2="20" stroke="{s.STONE_DARK}" stroke-width="8" stroke-linecap="round"/>'
    leg1 = f'<line x1="-16" y1="50" x2="-22" y2="90" stroke="{s.STONE_DARK}" stroke-width="9" stroke-linecap="round"/>'
    leg2 = f'<line x1="16" y1="50" x2="22" y2="90" stroke="{s.STONE_DARK}" stroke-width="9" stroke-linecap="round"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{body}{head}{eye1}{eye2}{bolt1}{bolt2}{arm1}{arm2}{leg1}{leg2}</g>'

def glow(x, y, r=140, opacity=0.18, color=None):
    color = color or s.AMBER_LIGHT
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}" opacity="{opacity}"/>'

def banner(x, y, w=90, h=130, color=None, scale=1.0, rotate=0):
    color = color or s.AMBER_LIGHT
    body = f'<path d="M {-w/2},{-h/2} L {w/2},{-h/2} L {w/2},{h/2} L 0,{h/2-24} L {-w/2},{h/2} Z" fill="{color}" stroke="{s.INK}" stroke-width="5" stroke-linejoin="round"/>'
    return f'<g transform="translate({x},{y}) scale({scale}) rotate({rotate})">{body}</g>'

def gate(x, y, scale=1.0):
    b1 = f'<rect x="-40" y="-70" width="14" height="140" fill="{s.STONE_DARK}"/>'
    b2 = f'<rect x="26" y="-70" width="14" height="140" fill="{s.STONE_DARK}"/>'
    top = f'<rect x="-46" y="-82" width="92" height="16" fill="{s.STONE_DARK}"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{b1}{b2}{top}</g>'

def wagon(x, y, scale=1.0):
    bed = f'<rect x="-46" y="-30" width="92" height="34" rx="4" fill="{s.WOOD}" stroke="{s.INK}" stroke-width="5"/>'
    trim = f'<rect x="-46" y="-30" width="92" height="8" fill="{s.AMBER}"/>'
    w1 = f'<circle cx="-28" cy="8" r="16" fill="none" stroke="{s.WOOD_DARK}" stroke-width="6"/>'
    w2 = f'<circle cx="28" cy="8" r="16" fill="none" stroke="{s.WOOD_DARK}" stroke-width="6"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{bed}{trim}{w1}{w2}</g>'

def stall(x, y, scale=1.0, color=None):
    color = color or s.STAGE_RED
    top = f'<polygon points="-70,-60 70,-60 90,-30 -90,-30" fill="{color}" stroke="{s.INK}" stroke-width="5" stroke-linejoin="round"/>'
    counter = f'<rect x="-70" y="-30" width="140" height="20" fill="{s.WOOD}" stroke="{s.INK}" stroke-width="5"/>'
    leg1 = f'<line x1="-60" y1="-58" x2="-60" y2="-10" stroke="{s.WOOD_DARK}" stroke-width="6"/>'
    leg2 = f'<line x1="60" y1="-58" x2="60" y2="-10" stroke="{s.WOOD_DARK}" stroke-width="6"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{leg1}{leg2}{top}{counter}</g>'

def potion(x, y, scale=1.0, color=None):
    color = color or s.WATER
    body = f'<path d="M -14,-20 L -14,10 Q -26,40 0,44 Q 26,40 14,10 L 14,-20 Z" fill="{color}" stroke="{s.INK}" stroke-width="5" stroke-linejoin="round" opacity="0.9"/>'
    neck = f'<rect x="-8" y="-34" width="16" height="16" fill="{s.PAPER}" stroke="{s.INK}" stroke-width="4"/>'
    cork = f'<rect x="-6" y="-42" width="12" height="10" rx="2" fill="{s.WOOD_DARK}"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{body}{neck}{cork}</g>'

def shield(x, y, scale=1.0, color=None):
    color = color or s.STONE
    body = f'<path d="M 0,-40 L 34,-26 L 34,10 Q 34,44 0,60 Q -34,44 -34,10 L -34,-26 Z" fill="{color}" stroke="{s.INK}" stroke-width="6" stroke-linejoin="round"/>'
    emblem = f'<circle cx="0" cy="0" r="12" fill="{s.AMBER}" stroke="{s.INK}" stroke-width="3"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{body}{emblem}</g>'

def puppet_strings(x, y, scale=1.0):
    bar = f'<line x1="-30" y1="-40" x2="30" y2="-40" stroke="{s.WOOD_DARK}" stroke-width="6"/>'
    l1 = f'<line x1="-24" y1="-40" x2="-16" y2="10" stroke="{s.INK}" stroke-width="2"/>'
    l2 = f'<line x1="24" y1="-40" x2="16" y2="10" stroke="{s.INK}" stroke-width="2"/>'
    return f'<g transform="translate({x},{y}) scale({scale})">{bar}{l1}{l2}</g>'

def GP(kind):
    return s.ground_plane(kind)

def V(backdrop, *elements):
    return GP(backdrop) + "".join(elements)

def fig(cls, x=400, y=640, arms="down", legs="stand", scale=1.0, flip=False, rotate=0):
    s.set_class(cls)
    return s.stick_figure(x, y, arms=arms, legs=legs, scale=scale, flip=flip, rotate=rotate)

# ===========================================================================
# 3D & Game Dev
# ===========================================================================

@scene("meshy")
def sc_meshy():
    return V("hall", glow(400, 420), golem(400, 600, scale=1.15), fig("wizard", 260, 660, arms="up", scale=0.75), hat_on(260, 660))

@scene("tripo-ai")
def sc_tripo_ai():
    return V("workshop", golem(420, 610, scale=0.95), fig("dwarf", 260, 660, arms="point_r", scale=0.85), s.gear(560, 500, r=40))

# ===========================================================================
# AI Assistants
# ===========================================================================

@scene("chatgpt")
def sc_chatgpt():
    return V("hall", glow(400, 400, r=180), s.crystal_ball(520, 560, scale=1.1), fig("wizard", 300, 660, arms="shrug"), hat_on(300, 660))

@scene("claude")
def sc_claude():
    return V("hall", s.book_closed(320, 560, scale=1.1, rotate=-8), s.book_closed(400, 590, scale=1.1, rotate=4), s.book_closed(470, 560, scale=1.1, rotate=10), fig("scribe", 400, 660, arms="hold_fwd"))

@scene("deepseek")
def sc_deepseek():
    return V("road", wagon(280, 660, scale=0.9), fig("ranger", 460, 660, arms="wave"), s.price_tag(560, 560, text="0"))

@scene("gemini")
def sc_gemini():
    return V("hall", fig("gnome", 260, 660, arms="hold_fwd2", scale=0.85), fig("scribe", 400, 660, arms="hold_fwd2", scale=0.85), fig("bard", 540, 660, arms="hold_fwd2", scale=0.85))

@scene("grok")
def sc_grok():
    return V("stage", s.speech_bubble(430, 480, w=200, text=""), fig("rogue", 380, 660, arms="point_r"))

@scene("meta-ai")
def sc_meta_ai():
    return V("tavern", s.round_table(400, 640, r=110), s.crystal_ball(330, 560, scale=0.7), s.crystal_ball(470, 560, scale=0.7), fig("merchant", 400, 660, arms="out", scale=0.75))

@scene("microsoft-copilot")
def sc_microsoft_copilot():
    return V("hall", fig("scribe", 400, 660, arms="up"), s.star(320, 500, scale=0.7), s.star(400, 460, scale=0.7), s.star(480, 500, scale=0.7))

@scene("mistral-le-chat")
def sc_mistral_le_chat():
    return V("hall", fig("wizard", 300, 660, arms="cross"), hat_on(300, 660), shield(500, 580, scale=0.8))

@scene("poe")
def sc_poe():
    return V("tavern", s.round_table(400, 640, r=120), fig("bard", 300, 660, arms="hold_fwd2", scale=0.8), fig("wizard", 500, 660, arms="hold_fwd2", scale=0.8), hat_on(500, 660))

# ===========================================================================
# AI Detection & Plagiarism
# ===========================================================================

@scene("gptzero")
def sc_gptzero():
    return V("hall", golem(400, 610), s.scroll_rolled(400, 500, scale=1.1), s.x_mark(460, 480, size=20))

@scene("originality-ai")
def sc_originality_ai():
    return V("workshop", fig("dwarf", 320, 660, arms="hold_fwd"), s.coin_stack(460, 640, n=3), s.check_mark(500, 560, size=20)

    )

@scene("quillbot")
def sc_quillbot():
    return V("hall", fig("scribe", 400, 660, arms="hold_fwd"), s.scroll_rolled(500, 560, scale=0.9, rotate=-10))

# ===========================================================================
# AI Phone Agents
# ===========================================================================

@scene("vapi")
def sc_vapi():
    return V("workshop", s.gear(320, 560, r=44), fig("gnome", 460, 660, arms="hold_fwd2"), s.speech_bubble(520, 500, w=140, text=""))

# ===========================================================================
# AI Search & Browsing
# ===========================================================================

@scene("chatgpt-atlas")
def sc_chatgpt_atlas():
    return V("market", stall(420, 560, scale=0.9), fig("wizard", 300, 660, arms="point_r"), hat_on(300, 660))

@scene("kagi")
def sc_kagi():
    return V("camp", s.round_table(400, 660, r=60, scale=0.01), s.coin_purse(400, 620, scale=0.9), glow(400, 500, r=120, opacity=0.15))

@scene("manus")
def sc_manus():
    return V("workshop", golem(320, 600, scale=0.9), s.castle(560, 560, scale=0.55))

@scene("perplexity-comet")
def sc_perplexity_comet():
    return V("road", fig("ranger", 400, 660, arms="hold_fwd"), s.crystal_ball(400, 540, scale=0.9))

@scene("you-com")
def sc_you_com():
    return V("stage", fig("bard", 320, 660, arms="hold_fwd2", scale=0.85), fig("gnome", 480, 660, arms="hold_fwd2", scale=0.85), s.musical_note(400, 500, scale=1.4))

# ===========================================================================
# Accessibility
# ===========================================================================

@scene("alttext-ai")
def sc_alttext_ai():
    return V("hall", banner(400, 560, w=160, h=200), fig("bard", 400, 690, arms="point_r", scale=0.8), s.speech_bubble(560, 500, w=150, text=""))

@scene("rev")
def sc_rev():
    return V("hall", fig("scribe", 320, 660, arms="hold_fwd"), fig("scribe", 480, 660, arms="hold_fwd", flip=True), s.scroll_rolled(400, 560, scale=1.0))

# ===========================================================================
# Automation & Workflow
# ===========================================================================

@scene("lindy")
def sc_lindy():
    return V("hall", golem(400, 600), s.envelope(300, 540, scale=1.1, rotate=-10), s.clock_face(520, 520, r=40))

@scene("n8n")
def sc_n8n():
    return V("workshop", s.gear(300, 560, r=40), s.gear(400, 500, r=30), s.gear(500, 560, r=40), fig("gnome", 400, 680, arms="up", scale=0.7))

# ===========================================================================
# Bookkeeping & Finance
# ===========================================================================

@scene("cashflowy")
def sc_cashflowy():
    return V("hall", golem(300, 610, scale=0.9), fig("merchant", 480, 660, arms="hold_fwd"), s.coin_stack(400, 660, n=4))

@scene("lettuce")
def sc_lettuce():
    return V("hall", fig("scribe", 400, 660, arms="hold_fwd"), s.coin_stack(300, 660, n=3), s.scale_swap(500, 640, w=80))

# ===========================================================================
# CRM & Client Management
# ===========================================================================

@scene("attio")
def sc_attio():
    return V("hall", s.book_closed(400, 600, scale=1.4), s.speech_bubble(540, 500, w=150, text=""))

# ===========================================================================
# Career & Job Search
# ===========================================================================

@scene("jobscan")
def sc_jobscan():
    return V("hall", gate(400, 660, scale=1.1), golem(400, 560, scale=0.7), s.scroll_rolled(280, 640, scale=0.9))

@scene("rezi")
def sc_rezi():
    return V("hall", fig("scribe", 400, 660, arms="hold_fwd"), s.scroll_rolled(500, 560, scale=1.0, rotate=-6), s.price_tag(560, 480, text="$"))

@scene("teal")
def sc_teal():
    return V("hall", s.book_closed(400, 600, scale=1.2), fig("rogue", 280, 660, arms="hold_fwd2", scale=0.85))

# ===========================================================================
# Coding & Dev Tools
# ===========================================================================

@scene("amazon-q-developer")
def sc_amazon_q_developer():
    return V("sky", cloud_stack := s.cloud(400, 260, scale=1.3), fig("scribe", 400, 660, arms="point_r"), s.gear(540, 500, r=34))

@scene("bolt-new")
def sc_bolt_new():
    return V("workshop", s.castle(420, 560, scale=0.6), fig("gnome", 260, 660, arms="up", scale=0.8))

@scene("coderabbit")
def sc_coderabbit():
    return V("hall", s.owl(400, 560, scale=1.2), s.scroll_rolled(400, 660, scale=1.0))

@scene("devin")
def sc_devin():
    return V("workshop", golem(400, 600), wagon(260, 660, scale=0.7), s.check_mark(500, 540, size=22))

@scene("github-copilot")
def sc_github_copilot():
    return V("hall", fig("scribe", 320, 660, arms="hold_fwd"), fig("gnome", 480, 660, arms="hold_fwd2", flip=True, scale=0.85))

@scene("harness-ai")
def sc_harness_ai():
    return V("workshop", s.gear(400, 540, r=46), shield(400, 660, scale=0.9))

@scene("hugging-face")
def sc_hugging_face():
    return V("market", stall(300, 560, scale=0.8), stall(500, 560, scale=0.8), s.book_closed(400, 660, scale=1.0))

@scene("langchain")
def sc_langchain():
    return V("workshop", s.gear(300, 560, r=36), s.gear(400, 600, r=30), s.gear(500, 560, r=36), s.arrow(340, 560, 460, 560))

@scene("replit")
def sc_replit():
    return V("workshop", s.castle(400, 560, scale=0.6), wagon(560, 660, scale=0.6), s.gear(280, 620, r=30))

@scene("tabnine")
def sc_tabnine():
    return V("hall", gate(400, 620, scale=1.0), fig("dwarf", 400, 690, arms="cross", scale=0.7))

@scene("windsurf")
def sc_windsurf():
    return V("river", fig("ranger", 400, 660, arms="hold_fwd"), s.stepping_stones(280, 700, n=4, scale=0.8))

# ===========================================================================
# Customer Support
# ===========================================================================

@scene("intercom-fin")
def sc_intercom_fin():
    return V("hall", golem(320, 610, scale=0.9), fig("merchant", 480, 660, arms="shrug"), s.speech_bubble(460, 500, w=150, text=""))

@scene("tidio")
def sc_tidio():
    return V("market", stall(400, 560), s.speech_bubble(540, 480, w=140, text=""))

@scene("eesel-ai")
def sc_eesel_ai():
    return V("hall", golem(400, 610), s.price_tag(520, 540, text="$"))

# ===========================================================================
# Cybersecurity
# ===========================================================================

@scene("astra-security")
def sc_astra_security():
    return V("hall", fig("fighter", 300, 660, arms="cross"), shield(300, 560, scale=0.8), fig("scribe", 480, 660, arms="hold_fwd", scale=0.85))

@scene("wiz")
def sc_wiz():
    return V("hall", s.castle(400, 560, scale=0.7), glow(400, 480, r=140, opacity=0.15))

# ===========================================================================
# Data & Analytics
# ===========================================================================

@scene("julius")
def sc_julius():
    return V("hall", fig("scribe", 400, 660, arms="hold_fwd"), s.scale_swap(500, 600, w=80), s.coin_stack(300, 660, n=3))

@scene("obviously-ai")
def sc_obviously_ai():
    return V("hall", s.crystal_ball(400, 560, scale=1.2), s.scroll_rolled(300, 660, scale=0.8))

@scene("rows")
def sc_rows():
    return V("hall", s.wall_of_holes(320, 560, cols=4, rows=2, scale=0.9), s.speech_bubble(560, 500, w=120, text=""))

# ===========================================================================
# E-commerce
# ===========================================================================

@scene("klevu")
def sc_klevu():
    return V("market", stall(400, 560), s.crystal_ball(300, 640, scale=0.6))

@scene("shopify-magic")
def sc_shopify_magic():
    return V("market", stall(320, 560), banner(500, 560, w=100, h=140), fig("merchant", 320, 690, arms="up", scale=0.6)

    )

# ===========================================================================
# Education & Tutoring
# ===========================================================================

@scene("khanmigo")
def sc_khanmigo():
    return V("hall", fig("wizard", 320, 660, arms="hold_fwd2", scale=0.85), hat_on(320, 660), fig("gnome", 480, 660, arms="up", scale=0.7))

@scene("magicschool-ai")
def sc_magicschool_ai():
    return V("hall", fig("scribe", 400, 660, arms="up"), s.book_closed(300, 600, scale=0.9, rotate=-8), s.book_closed(500, 600, scale=0.9, rotate=8))

@scene("quizlet")
def sc_quizlet():
    return V("sky", s.d20(400, 560, scale=1.1), fig("gnome", 280, 660, arms="hold_fwd2", scale=0.8))

# ===========================================================================
# Forms & Surveys
# ===========================================================================

@scene("chattermill")
def sc_chattermill():
    return V("hall", s.speech_bubble(300, 520, w=140, text=""), s.speech_bubble(460, 480, w=140, text=""), fig("scribe", 400, 680, arms="up", scale=0.8))

@scene("dovetail")
def sc_dovetail():
    return V("hall", s.book_closed(320, 600, scale=1.0, rotate=-6), s.book_closed(400, 610, scale=1.0), s.book_closed(480, 600, scale=1.0, rotate=6))

# ===========================================================================
# HR & Recruiting
# ===========================================================================

@scene("hirevue")
def sc_hirevue():
    return V("hall", banner(400, 540, w=140, h=180), fig("fighter", 400, 690, arms="cross", scale=0.75))

@scene("juicebox")
def sc_juicebox():
    return V("market", stall(400, 560), s.crystal_ball(300, 640, scale=0.6), fig("merchant", 500, 660, arms="point_l", scale=0.8))

@scene("paradox")
def sc_paradox():
    return V("hall", gate(400, 640, scale=1.0), fig("bard", 400, 700, arms="wave", scale=0.7))

@scene("recruiterflow")
def sc_recruiterflow():
    return V("hall", s.book_closed(320, 600, scale=1.0), s.scroll_rolled(480, 620, scale=0.9))

# ===========================================================================
# Health & Fitness
# ===========================================================================

@scene("calm")
def sc_calm():
    return V("sky", s.crystal_ball(400, 560, scale=1.0), s.star(300, 460, scale=0.6), s.star(500, 440, scale=0.6))

@scene("fitbod")
def sc_fitbod():
    return V("camp", fig("fighter", 400, 660, arms="cross"), s.sword(300, 620, scale=0.7))

@scene("myfitnesspal")
def sc_myfitnesspal():
    return V("hall", s.scale_swap(400, 620, w=90), s.crystal_ball(400, 500, scale=0.6))

@scene("noom")
def sc_noom():
    return V("hall", fig("druid", 300, 660, arms="hold_fwd2"), s.speech_bubble(500, 540, w=150, text=""))

@scene("whoop")
def sc_whoop():
    return V("camp", fig("ranger", 300, 660, arms="cross"), s.clock_face(520, 560, r=44))

# ===========================================================================
# Image Generation
# ===========================================================================

@scene("adobe-firefly")
def sc_adobe_firefly():
    return V("workshop", fig("wizard", 400, 660, arms="up"), hat_on(400, 660), s.candle(300, 640, scale=0.9), s.candle(500, 640, scale=0.9))

@scene("flux")
def sc_flux():
    return V("workshop", s.gear(320, 560, r=40), fig("dwarf", 480, 660, arms="hold_fwd"), s.sword(560, 560, scale=0.6)

    )

@scene("freepik-ai")
def sc_freepik_ai():
    return V("market", stall(300, 560, scale=0.9), stall(500, 560, scale=0.9), banner(400, 640, w=90, h=120))

@scene("ideogram")
def sc_ideogram():
    return V("hall", banner(400, 540, w=150, h=190), fig("scribe", 400, 690, arms="point_r", scale=0.7))

@scene("krea-ai")
def sc_krea_ai():
    return V("workshop", fig("wizard", 400, 660, arms="hold_fwd2"), hat_on(400, 660), glow(400, 540, r=100, opacity=0.2))

@scene("leonardo-ai")
def sc_leonardo_ai():
    return V("workshop", shield(320, 600, scale=0.8), s.sword(480, 560, scale=0.8), fig("dwarf", 400, 690, arms="up", scale=0.7))

@scene("recraft")
def sc_recraft():
    return V("hall", banner(300, 560, w=100, h=140), banner(500, 560, w=100, h=140), fig("scribe", 400, 690, arms="hold_fwd", scale=0.7))

@scene("stable-diffusion")
def sc_stable_diffusion():
    return V("workshop", s.book_closed(400, 620, scale=1.4), glow(400, 500, r=130, opacity=0.18))

# ===========================================================================
# Interior Design
# ===========================================================================

@scene("interior-ai")
def sc_interior_ai():
    return V("hall", s.table(400, 620, w=160), fig("bard", 280, 690, arms="hold_fwd2", scale=0.7))

@scene("myarchitectai")
def sc_myarchitectai():
    return V("hall", s.castle(400, 560, scale=0.65), fig("scribe", 260, 690, arms="hold_fwd", scale=0.7))

@scene("remodelai")
def sc_remodelai():
    return V("hall", s.table(320, 620, w=120), s.candle(480, 600, scale=1.0), banner(560, 540, w=70, h=100))

# ===========================================================================
# Investing & Markets
# ===========================================================================

@scene("composer")
def sc_composer():
    return V("hall", s.scale_swap(400, 620, w=90), fig("merchant", 260, 690, arms="hold_fwd2", scale=0.75))

@scene("danelfin")
def sc_danelfin():
    return V("hall", s.crystal_ball(400, 560, scale=1.0), s.tag(500, 500, text="7", color=s.AMBER))

@scene("seeking-alpha-premium")
def sc_seeking_alpha_premium():
    return V("hall", s.book_closed(320, 600, scale=1.0), s.book_closed(400, 610, scale=1.0), s.book_closed(480, 600, scale=1.0), s.scroll_rolled(400, 660, scale=0.8))

# ===========================================================================
# Legal
# ===========================================================================

@scene("docusign")
def sc_docusign():
    return V("hall", s.scroll_rolled(400, 600, scale=1.3), s.check_mark(460, 560, size=22))

@scene("ironclad")
def sc_ironclad():
    return V("hall", golem(400, 610, scale=0.9), s.scroll_rolled(300, 660, scale=0.8), s.scroll_rolled(500, 660, scale=0.8))

@scene("legesgpt")
def sc_legesgpt():
    return V("hall", fig("scribe", 320, 660, arms="hold_fwd"), s.scale_swap(500, 620, w=80))

@scene("luminance")
def sc_luminance():
    return V("hall", s.book_closed(300, 600, scale=0.9, rotate=-8), s.book_closed(370, 610, scale=0.9, rotate=-2), s.book_closed(440, 600, scale=0.9, rotate=4), s.book_closed(510, 610, scale=0.9, rotate=10))

@scene("pandadoc")
def sc_pandadoc():
    return V("hall", s.scroll_rolled(320, 620, scale=1.0), s.price_tag(480, 560, text="$"), s.check_mark(540, 600, size=18))

@scene("robin-ai")
def sc_robin_ai():
    return V("hall", fig("fox", 400, 660, scale=1.0) if False else s.fox(400, 620, scale=1.1), s.scroll_rolled(400, 700, scale=0.9))

@scene("spellbook")
def sc_spellbook():
    return V("hall", s.book_closed(400, 610, scale=1.5), s.star(460, 540, scale=0.6))

# ===========================================================================
# Local Business
# ===========================================================================

@scene("birdeye")
def sc_birdeye():
    return V("market", stall(400, 560), s.star(320, 500, scale=0.6), s.star(480, 500, scale=0.6), s.price_tag(560, 620, text="$$$")

    )

@scene("podium")
def sc_podium():
    return V("market", stall(400, 560), s.speech_bubble(300, 500, w=130, text=""), s.envelope(520, 620, scale=0.9)

    )

# ===========================================================================
# Marketing & Social Media
# ===========================================================================

@scene("buffer")
def sc_buffer():
    return V("market", banner(400, 560, w=100, h=140), s.clock_face(300, 640, r=40))

@scene("hootsuite")
def sc_hootsuite():
    return V("market", banner(300, 560, w=80, h=120), banner(400, 540, w=80, h=140), banner(500, 560, w=80, h=120))

@scene("ocoya")
def sc_ocoya():
    return V("market", banner(400, 560, w=100, h=140), s.speech_bubble(540, 500, w=130, text=""))

@scene("storychief")
def sc_storychief():
    return V("hall", s.scroll_rolled(320, 620, scale=1.0), banner(460, 560, w=90, h=130), s.envelope(560, 640, scale=0.8))

# ===========================================================================
# Meetings & Transcription
# ===========================================================================

@scene("fathom")
def sc_fathom():
    return V("hall", fig("scribe", 400, 660, arms="hold_fwd"), s.round_table(400, 700, r=100, scale=0.01))

@scene("grain")
def sc_grain():
    return V("hall", s.scroll_rolled(400, 620, scale=1.2), s.x_mark(500, 560, size=16), s.check_mark(560, 600, size=18))

@scene("granola")
def sc_granola():
    return V("hall", s.round_table(400, 660, r=110), fig("scribe", 560, 700, arms="hold_fwd", scale=0.6))

@scene("jamie")
def sc_jamie():
    return V("hall", s.round_table(400, 660, r=110), s.speech_bubble(400, 500, w=40, text="")

    )

# ===========================================================================
# No-code / Database
# ===========================================================================

@scene("ai2sql")
def sc_ai2sql():
    return V("hall", s.wall_of_holes(320, 560, cols=4, rows=2, scale=0.9), s.speech_bubble(560, 480, w=130, text=""))

@scene("vanna-ai")
def sc_vanna_ai():
    return V("hall", golem(400, 610), s.wall_of_holes(300, 700, cols=3, rows=1, scale=0.6))

# ===========================================================================
# Personal Finance
# ===========================================================================

@scene("cleo")
def sc_cleo():
    return V("hall", s.coin_purse(400, 620, scale=1.1), s.speech_bubble(520, 540, w=140, text=""))

@scene("copilot-money")
def sc_copilot_money():
    return V("hall", s.coin_stack(320, 660, n=4), s.coin_stack(480, 660, n=3), fig("merchant", 400, 690, arms="up", scale=0.6))

@scene("monarch-money")
def sc_monarch_money():
    return V("hall", s.scale_swap(400, 620, w=100))

@scene("rocket-money")
def sc_rocket_money():
    return V("hall", s.coin_purse(400, 620, scale=1.1), s.x_mark(500, 560, size=16), s.x_mark(540, 600, size=16), s.x_mark(480, 600, size=16))

# ===========================================================================
# Podcasting & Video Editing
# ===========================================================================

@scene("auphonic")
def sc_auphonic():
    return V("stage", fig("bard", 400, 660, arms="hold_fwd2"), s.musical_note(320, 560, scale=1.2), s.musical_note(480, 540, scale=0.8))

@scene("cleanvoice")
def sc_cleanvoice():
    return V("stage", fig("bard", 400, 660, arms="hold_fwd2"), s.x_mark(320, 560, size=16), s.x_mark(480, 540, size=16))

# ===========================================================================
# Presentations & Design
# ===========================================================================

@scene("beautiful-ai")
def sc_beautiful_ai():
    return V("hall", banner(400, 560, w=160, h=200), s.star(500, 480, scale=0.6))

@scene("looka")
def sc_looka():
    return V("hall", banner(400, 560, w=140, h=180), s.star(400, 470, scale=0.7))

@scene("plus-ai")
def sc_plus_ai():
    return V("hall", s.book_closed(400, 610, scale=1.3), banner(500, 540, w=70, h=100))

@scene("uizard")
def sc_uizard():
    return V("hall", s.castle(400, 560, scale=0.55), fig("scribe", 260, 690, arms="point_r", scale=0.7))

# ===========================================================================
# Productivity & Notes
# ===========================================================================

@scene("mem")
def sc_mem():
    return V("hall", s.book_closed(320, 610, scale=1.0, rotate=-10), s.book_closed(400, 620, scale=1.0), s.book_closed(480, 610, scale=1.0, rotate=10))

@scene("reflect")
def sc_reflect():
    return V("hall", s.book_closed(320, 600, scale=0.9), s.book_closed(480, 600, scale=0.9), s.arrow(360, 600, 440, 600))

@scene("tana")
def sc_tana():
    return V("hall", s.wall_of_holes(320, 560, cols=3, rows=2, scale=0.85))

# ===========================================================================
# Real Estate
# ===========================================================================

@scene("epique-ai")
def sc_epique_ai():
    return V("hall", s.castle(400, 560, scale=0.6), s.envelope(560, 660, scale=0.9))

@scene("virtual-staging-ai")
def sc_virtual_staging_ai():
    return V("hall", s.table(400, 640, w=140), s.candle(320, 620, scale=0.9))

# ===========================================================================
# Research & Knowledge
# ===========================================================================

@scene("anara")
def sc_anara():
    return V("hall", s.owl(400, 560, scale=1.2), s.book_closed(300, 660, scale=0.9), s.book_closed(500, 660, scale=0.9))

@scene("consensus")
def sc_consensus():
    return V("hall", s.scale_swap(400, 620, w=90), s.owl(400, 500, scale=0.8))

@scene("elicit")
def sc_elicit():
    return V("hall", s.book_closed(320, 600, scale=0.85, rotate=-8), s.book_closed(380, 610, scale=0.85, rotate=-2), s.book_closed(440, 600, scale=0.85, rotate=4), s.book_closed(500, 610, scale=0.85, rotate=10), s.owl(400, 500, scale=0.7))

# ===========================================================================
# SEO
# ===========================================================================

@scene("ahrefs")
def sc_ahrefs():
    return V("hall", s.book_closed(400, 610, scale=1.4), s.fox(500, 660, scale=0.7))

@scene("surfer-seo")
def sc_surfer_seo():
    return V("hall", s.scroll_rolled(320, 620, scale=1.0), s.tag(480, 560, text="A+", color=s.AMBER))

# ===========================================================================
# Sales & Prospecting
# ===========================================================================

@scene("clay")
def sc_clay():
    return V("market", stall(400, 560), s.wall_of_holes(300, 660, cols=3, rows=1, scale=0.6))

@scene("instantly-ai")
def sc_instantly_ai():
    return V("hall", s.envelope(320, 600, scale=1.0, rotate=-10), s.envelope(400, 610, scale=1.0), s.envelope(480, 600, scale=1.0, rotate=10))

# ===========================================================================
# Scheduling & Time
# ===========================================================================

@scene("reclaim-ai")
def sc_reclaim_ai():
    return V("hall", s.clock_face(400, 560, r=60), s.hourglass(500, 640, scale=0.7))

# ===========================================================================
# Translation & Localization
# ===========================================================================

@scene("deepl")
def sc_deepl():
    return V("hall", fig("scribe", 320, 660, arms="hold_fwd"), s.speech_bubble(500, 540, w=150, text=""))

@scene("lokalise")
def sc_lokalise():
    return V("market", banner(320, 560, w=70, h=110), banner(400, 540, w=70, h=130), banner(480, 560, w=70, h=110))

# ===========================================================================
# Video Generation
# ===========================================================================

@scene("capcut")
def sc_capcut():
    return V("stage", fig("bard", 400, 660, arms="hold_fwd2"), s.musical_note(320, 560, scale=1.0))

@scene("creatify")
def sc_creatify():
    return V("market", stall(400, 560), fig("merchant", 500, 660, arms="wave", scale=0.8))

@scene("d-id")
def sc_d_id():
    return V("hall", banner(400, 540, w=170, h=220), s.speech_bubble(560, 480, w=120, text=""))

@scene("heygen")
def sc_heygen():
    return V("hall", banner(400, 540, w=170, h=220), s.musical_note(560, 480, scale=0.8))

@scene("higgsfield")
def sc_higgsfield():
    return V("sky", cloud_a := s.cloud(300, 260, scale=1.1), cloud_b := s.cloud(500, 220, scale=0.9, storm=True))

@scene("kapwing")
def sc_kapwing():
    return V("stage", fig("bard", 400, 660, arms="hold_fwd2"), s.envelope(300, 560, scale=0.8), s.musical_note(500, 540, scale=0.8))

@scene("kling-ai")
def sc_kling_ai():
    return V("sky", s.dragon(400, 500, scale=1.1), s.price_tag(560, 620, text="$0"))

@scene("luma-dream-machine")
def sc_luma_dream_machine():
    return V("hall", s.castle(400, 560, scale=0.6), s.dragon(560, 480, scale=0.6))

@scene("pictory")
def sc_pictory():
    return V("hall", s.scroll_rolled(300, 620, scale=1.0), banner(480, 560, w=90, h=130))

@scene("pika")
def sc_pika():
    return V("sky", s.star(340, 300, scale=0.8), s.star(460, 260, scale=0.6), s.star(400, 340, scale=0.5))

@scene("pixverse")
def sc_pixverse():
    return V("stage", banner(400, 540, w=160, h=200), s.star(500, 460, scale=0.6))

@scene("rask-ai")
def sc_rask_ai():
    return V("stage", fig("bard", 400, 660, arms="hold_fwd2"), s.speech_bubble(300, 540, w=100, text=""), s.speech_bubble(500, 540, w=100, text=""))

@scene("veo")
def sc_veo():
    return V("hall", s.crystal_ball(320, 560, scale=0.9), s.crystal_ball(480, 560, scale=0.9), s.crystal_ball(400, 500, scale=0.9))

# ===========================================================================
# Voice & Music
# ===========================================================================

@scene("aiva")
def sc_aiva():
    return V("stage", fig("bard", 400, 660, arms="hold_fwd2"), s.musical_note(300, 540, scale=1.0), s.musical_note(500, 500, scale=0.8))

@scene("murf-ai")
def sc_murf_ai():
    return V("hall", fig("bard", 400, 660, arms="up"), s.speech_bubble(500, 540, w=140, text=""))

@scene("play-ht")
def sc_play_ht():
    return V("hall", fig("bard", 320, 660, arms="hold_fwd"), fig("bard", 480, 660, arms="hold_fwd", flip=True))

@scene("respeecher")
def sc_respeecher():
    return V("stage", fig("bard", 400, 660, arms="cross"), s.check_mark(500, 560, size=20))

@scene("soundraw")
def sc_soundraw():
    return V("stage", s.musical_note(320, 540, scale=1.2), s.musical_note(400, 500, scale=1.0), s.musical_note(480, 540, scale=1.2))

@scene("udio")
def sc_udio():
    return V("stage", fig("bard", 400, 660, arms="up"), s.musical_note(300, 520, scale=1.1), s.musical_note(500, 520, scale=1.1))

# ===========================================================================
# Voice Dictation
# ===========================================================================

@scene("superwhisper")
def sc_superwhisper():
    return V("workshop", fig("scribe", 400, 660, arms="hold_fwd2"), s.castle(560, 600, scale=0.35), s.speech_bubble(300, 540, w=120, text=""))

@scene("willow-voice")
def sc_willow_voice():
    return V("hall", fig("scribe", 400, 660, arms="hold_fwd2"), s.scroll_rolled(500, 620, scale=0.9))

# ===========================================================================
# Website & App Builders
# ===========================================================================

@scene("10web")
def sc_10web():
    return V("workshop", s.castle(400, 560, scale=0.6), fig("gnome", 260, 660, arms="up", scale=0.75))

@scene("webflow")
def sc_webflow():
    return V("hall", banner(400, 540, w=160, h=200), s.gear(540, 620, r=34))

@scene("wix")
def sc_wix():
    return V("hall", fig("gnome", 320, 660, arms="hold_fwd2"), s.castle(500, 580, scale=0.5))

# ===========================================================================
# Writing & Copywriting
# ===========================================================================

@scene("novelai")
def sc_novelai():
    return V("hall", fig("scribe", 320, 660, arms="hold_fwd"), banner(500, 560, w=90, h=130))

@scene("prowritingaid")
def sc_prowritingaid():
    return V("hall", s.book_closed(400, 610, scale=1.5), s.check_mark(480, 540, size=20))

@scene("rytr")
def sc_rytr():
    return V("hall", fig("scribe", 400, 660, arms="hold_fwd"), s.price_tag(500, 560, text="$"))

@scene("sudowrite")
def sc_sudowrite():
    return V("sky", fig("bard", 400, 660, arms="shrug"), s.clock_face(500, 300, r=40))

@scene("writesonic")
def sc_writesonic():
    return V("hall", fig("scribe", 400, 660, arms="up"), s.scroll_rolled(300, 640, scale=0.8), s.scroll_rolled(500, 640, scale=0.8))


# ===========================================================================
# August 19, 2026 database-growth pass (missing wall art/jokes fix)
# ===========================================================================

@scene("harvey")
def sc_harvey():
    return V("hall", s.scale_swap(400, 560, w=90), s.book_closed(260, 640, scale=1.1), s.price_tag(560, 520, text="$$$"))

@scene("linear")
def sc_linear():
    return V("hall", s.wall_of_holes(400, 480, cols=4, rows=2, scale=0.9), s.check_mark(400, 640, size=30))

@scene("sourcegraph-cody")
def sc_sourcegraph_cody():
    return V("hall", gate(400, 620, scale=1.0), s.price_tag(560, 520, text="$$$$"), s.book_closed(260, 640, scale=1.0))

@scene("zed")
def sc_zed():
    return V("workshop", s.sword(400, 580, scale=0.9, rotate=15), fig("dwarf", 260, 660, arms="hold_fwd"))

@scene("smartlead")
def sc_smartlead():
    return V("market", wagon(400, 640, scale=1.1), s.envelope(320, 560, scale=0.8, rotate=-10), s.envelope(460, 560, scale=0.8, rotate=8))

@scene("warmly")
def sc_warmly():
    return V("market", s.crystal_ball(400, 560, scale=1.0), s.price_tag(540, 500, text="$$$"))

@scene("sanebox")
def sc_sanebox():
    return V("hall", s.wall_of_holes(400, 480, cols=3, rows=2, scale=0.85), s.envelope(400, 640, scale=1.0))

@scene("missive")
def sc_missive():
    return V("hall", s.round_table(400, 630, r=90), s.envelope(400, 560, scale=0.9), s.speech_bubble(560, 520, w=140, text=""))

@scene("pitch")
def sc_pitch():
    return V("stage", banner(400, 540, w=150, h=190), fig("bard", 260, 690, arms="point_r", scale=0.75), fig("gnome", 540, 690, arms="up", scale=0.7, flip=True))

@scene("turnitin")
def sc_turnitin():
    return V("hall", golem(320, 610, scale=0.9), s.scale_swap(480, 560, w=90), s.scroll_rolled(500, 640, scale=0.9))

@scene("gong")
def sc_gong():
    return V("hall", s.speech_bubble(320, 560, w=140, text=""), s.scroll_rolled(480, 620, scale=1.0), s.price_tag(560, 500, text="?"))

assert len(WALL_SCENES) == 163, f"got {len(WALL_SCENES)} scenes"

if __name__ == "__main__":
    outdir = "svg-out-wall"
    os.makedirs(outdir, exist_ok=True)
    for slug, fn in WALL_SCENES.items():
        body = fn()
        svg = s.wrap(body)
        with open(os.path.join(outdir, f"{slug}.svg"), "w") as f:
            f.write(svg)
    print("wrote", len(WALL_SCENES), "svgs")
