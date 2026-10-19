#!/usr/bin/env python3
"""Maintenance pipeline for solosgems.com. Run from the repo root.

  python3 tools/site.py rerank              # recompute ranks, sync every derived file
  python3 tools/site.py add new_tools.json  # add tools (rows, wall tiles, comics, data), then rerank
  python3 tools/site.py remove "Tool Name"  # remove a dead tool everywhere, then rerank
  python3 tools/site.py graves              # after editing deathstack.html: sync homepage graves + counts

Source of truth for ranking: data/rankings.json (four sub-scores, basis, why).
Score = average of value, capability, ease, trial. Ties: tested first, then
capability, then name. See tools/MAINTAINING.md for the add_tools JSON format.
"""
import csv
import datetime
import html
import io
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))
TODAY = datetime.date.today().isoformat()
E = lambda t: html.escape(t, quote=True)
U = html.unescape


def fmt(x):
    return ("%.2f" % x).rstrip("0").rstrip(".")


def read(p):
    return open(p, encoding="utf-8").read()


def write(p, s):
    open(p, "w", encoding="utf-8").write(s)


def load_json(p):
    return json.load(open(p, encoding="utf-8"))


def dump_json(p, d):
    write(p, json.dumps(d, indent=2, ensure_ascii=False) + "\n")


def row_blocks(s):
    return re.findall(r'<a class="db-row" .*?</a>', s, re.S)


def row_name(b):
    return U(re.search(r"<h3>([^<]*)</h3>", b).group(1))


def wall_name(w):
    return U(re.search(r' title="([^"]*)"', w).group(1))


# ---------------------------------------------------------------- ranking
def compute_ranking():
    R = load_json("data/rankings.json")
    tools = R["tools"]
    for t in tools:
        t["score"] = round((t["value_score"] + t["capability_score"] + t["ease_score"] + t["trial_score"]) / 4, 2)
    tools.sort(key=lambda t: (-t["score"], t["basis"] != "tested", -t["capability_score"], t["name"].lower()))
    for i, t in enumerate(tools, 1):
        t["rank"] = i
    R["tools"] = [{"rank": t["rank"], **{k: v for k, v in t.items() if k != "rank"}} for t in tools]
    R["count"] = len(tools)
    R["last_updated"] = TODAY
    return R


def apply_ranking_to_index(R):
    by = {t["name"]: t for t in R["tools"]}
    s = read("index.html")

    def row_sub(m):
        b = m.group(0)
        name = row_name(b)
        t = by[name]
        if ' id="tool-' not in b:
            slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
            b = b.replace('<a class="db-row" ', '<a class="db-row" id="tool-%s" ' % slug, 1)
        b = re.sub(r'<div class="db-row-reviewed">.*?</div>', "", b, count=1, flags=re.S)
        b = re.sub(r'\s*<p class="db-rank-why">.*?</p>', "", b, flags=re.S)
        chip = ('<span class="db-basis-chip is-tested" title="Tested hands-on by Solos Gems">Tested</span>'
                if t["basis"] == "tested" else
                '<span class="db-basis-chip is-scouted" title="Scored from public pricing and features, not hands-on testing">Scouted</span>')
        badge = ('<div class="db-row-reviewed"><span class="db-rank-badge">#%d Ranked</span>'
                 '<span class="db-score-badge">%s/10</span>%s</div>' % (t["rank"], fmt(t["score"]), chip))
        b = re.sub(r"(<h3>[^<]*</h3>)", lambda mm: mm.group(1) + badge, b, count=1)
        why = '\n          <p class="db-rank-why"><strong>Why #%d:</strong> %s</p>' % (t["rank"], E(t["why"]))
        if '<p class="db-row-caption">' in b:
            b = b.replace('\n          <p class="db-row-caption">', why + '\n          <p class="db-row-caption">', 1)
        else:
            b = b.replace("\n        </div>", why + "\n        </div>", 1)
        return b

    s, n = re.subn(r'<a class="db-row" .*?</a>', row_sub, s, flags=re.S)
    assert n == len(by), "rows (%d) != rankings (%d)" % (n, len(by))

    def wall_sub(m):
        w = m.group(0)
        t = by[wall_name(w)]
        w = re.sub(r' data-rank="[^"]*" data-score="[^"]*" data-basis="[^"]*" data-why="[^"]*"', "", w)
        return w.replace(' title="', ' data-rank="%d" data-score="%s" data-basis="%s" data-why="%s" title="'
                         % (t["rank"], fmt(t["score"]), t["basis"], E(t["why"])), 1)

    s, n = re.subn(r'<a class="db-wall-item"[^\n]*?</a>', wall_sub, s)
    assert n == len(by), "wall tiles (%d) != rankings (%d)" % (n, len(by))

    ids = {U(h): i for i, h in re.findall(r'<a class="db-row"[^>]*id="tool-([^"]+)"[^>]*>.*?<h3>([^<]*)</h3>', s, flags=re.S)}
    lis = "".join(('      <li class="top">' if t["rank"] == 1 else "      <li>") +
                  '<a href="#tool-%s"><span class="rank-list-num">%d</span>%s</a></li>\n' % (ids[t["name"]], t["rank"], E(t["name"]))
                  for t in R["tools"])
    s = re.sub(r'(<ol class="rank-list"[^>]*>\n).*?(        </ol>)', lambda m: m.group(1) + lis + m.group(2), s, count=1, flags=re.S)
    s = recount_index(s)
    write("index.html", s)
    for t in R["tools"]:
        t["slug"] = ids[t["name"]]
    return ids


def recount_index(s):
    walls = re.findall(r'<a class="db-wall-item"[^\n]*?data-category="([^"]*)" data-tier="([a-z]+)"[^\n]*?data-new="(\d)"', s)
    total = len(walls)
    bycat = Counter(c for c, _, _ in walls)
    bytier = Counter(t for _, t, _ in walls)
    newn = sum(1 for *_, n in walls if n == "1")
    for cat, n in bycat.items():
        s = re.sub(r'(<option value="' + re.escape(cat) + r'">[^<]*\()\d+(\)</option>)', r"\g<1>%d\2" % n, s)
        sid = re.search(r'<section class="db-section" id="([^"]+)" data-category="' + re.escape(cat) + '"', s).group(1)
        s = re.sub(r'(<a href="#' + sid + r'"[^>]*>.*?<span class="db-nav-count">)\d+(</span>)', r"\g<1>%d\2" % n, s, count=1)
        s = re.sub(r'(<section class="db-section" id="' + sid + r'"[^>]*>\s*<h2[^>]*>.*?<span class="db-count">\()\d+(\)</span>)',
                   r"\g<1>%d\2" % n, s, count=1, flags=re.S)
    for t in ("free", "paid", "unlisted"):
        s = re.sub(r'(<option value="%s">[^(]*\()\d+' % t, r"\g<1>%d" % bytier[t], s)
    for pat in [r"All categories \(\d+\)", r"Any pricing \(\d+\)", r"Showing all \d+", r"Search \d+ tools",
                r"\d+ weapons racked", r"database of \d+ AI tools"]:
        s = re.sub(pat, lambda mm: re.sub(r"\d+", str(total), mm.group(0), count=1), s)
    s = re.sub(r'<span class="db-wall-new-flag">\d+ added this week\.</span>',
               '<span class="db-wall-new-flag">%d added this week.</span>' % newn, s)
    return s


def sync_derived(R, ids):
    by = {t["name"]: t for t in R["tools"]}
    N = len(R["tools"])
    dump_json("data/rankings.json", R)
    d = load_json("data/tools.json")
    names = {t["name"] for t in d["tools"]}
    assert names == set(by), "tools.json names differ from rankings.json: %s" % (names ^ set(by))
    for t in d["tools"]:
        r = by[t["name"]]
        t["rank"] = r["rank"]
        t["score"] = float("%.2f" % r["score"])
        t["rank_basis"] = r["basis"]
        t["rank_why"] = r["why"]
        t["reviewed_on_solosgems"] = r["basis"] == "tested"
    d["tools"].sort(key=lambda t: t["name"].lower())
    d["count"] = N
    d["generated"] = TODAY
    dump_json("data/tools.json", d)
    f = ["name", "domain", "category", "description", "cool_fact", "url", "reviewed_on_solosgems", "pricing",
         "date_added", "rank", "score", "rank_basis", "rank_why"]
    b = io.StringIO()
    w = csv.DictWriter(b, fieldnames=f, lineterminator="\r\n", extrasaction="ignore")
    w.writeheader()
    for t in d["tools"]:
        r = dict(t)
        r["reviewed_on_solosgems"] = "yes" if t["reviewed_on_solosgems"] else "no"
        w.writerow(r)
    open("data/tools.csv", "w", newline="", encoding="utf-8").write(b.getvalue())
    # llms.txt ranked list
    t = read("llms.txt")
    a, bb = t.index("## Ranked tools"), t.index("## Other pages")
    lines = ("## Ranked tools (#1-%d, every tool in the database, each links to its row)\n\n"
             "Tested = tested hands-on by Solos Gems. Scouted = scored from public pricing, docs, and features.\n\n" % N)
    for r in R["tools"]:
        lines += "- [%s](https://solosgems.com/#tool-%s): #%d, %s/10, %s. %s\n" % (
            r["name"], ids[r["name"]], r["rank"], fmt(r["score"]), "Tested" if r["basis"] == "tested" else "Scouted", r["why"])
    t = re.sub(r"Last updated: [0-9-]+\.", "Last updated: %s." % TODAY, t)
    write("llms.txt", t[:a] + lines + "\n" + t[bb:])
    # embed widget top 10
    lis = "".join('    <li><span class="rank-num">%d</span><a class="tool-link" href="https://solosgems.com/#tool-%s" '
                  'target="_blank" rel="noopener">%s</a><span class="tool-score">%s</span></li>\n'
                  % (r["rank"], ids[r["name"]], html.escape(r["name"]), fmt(r["score"])) for r in R["tools"][:10])
    p = "embed/top10.html"
    write(p, re.sub(r'(<ol class="top10">\n).*?(  </ol>)', lambda m: m.group(1) + lis + m.group(2), read(p), flags=re.S))
    # tool counts on other pages: targeted patterns only, never a blanket number replace
    COUNT = [r"(database of )\d+( AI tools)", r"(lists )\d+( AI tools)", r"(All )\d+( tools in a filterable)",
             r"(homepage</a> is the main event: )\d+( AI tools)", r"(the other )\d+( don)", r"(covers )\d+( tools)",
             r'(Tools in the full database</div><div class="spec-value">)\d+(<)', r"(Median score, all )\d+( tools)",
             r"(See all )\d+( ranked tools)", r"(Every one of the )\d+( tools)", r"(with )\d+( tools, all ranked)",
             r"(our database of )\d+(,)"]
    for p in ("about.html", "llms.txt", "submit.html", "state-of-ai-tools.html", "embed.html"):
        t = read(p)
        for pat in COUNT:
            t = re.sub(pat, lambda m: m.group(1) + str(N) + m.group(2), t)
        write(p, t)
    # news auto-tagging names in worker.js
    wk = read("worker.js")
    m = re.search(r"const TOOL_NAMES = (\[.*?\]);", wk)
    keep = set(json.loads(m.group(1)))
    wanted = (keep & {"NotebookLM", "Windsurf"}) | set(by)
    names = sorted(wanted, key=lambda n: (n[0].islower(), n))
    write("worker.js", wk[:m.start()] + "const TOOL_NAMES = " + json.dumps(names, ensure_ascii=False).replace('","', '", "') + ";" + wk[m.end():])
    # sitemap lastmod for the homepage
    write("sitemap.xml", re.sub(r"(<loc>https://solosgems.com/</loc><lastmod>)[0-9-]+", r"\g<1>" + TODAY, read("sitemap.xml")))


def rerank():
    R = compute_ranking()
    ids = apply_ranking_to_index(R)
    sync_derived(R, ids)
    print("ranked", len(R["tools"]), "tools; top 5:", [t["name"] for t in R["tools"][:5]])


# ---------------------------------------------------------------- add / remove
def make_svg(slug, scene_src):
    import svg_lib_n64 as s
    import gen_wall_scenes as g
    env = {"s": s, "V": g.V, "fig": g.fig, "glow": g.glow, "golem": g.golem, "banner": g.banner,
           "wagon": g.wagon, "stall": g.stall, "gate": g.gate}
    if not scene_src:
        scene_src = 'V("hall", fig("wizard", 400, 680, arms="up", scale=0.8), s.crystal_ball(560, 560, scale=0.9), s.star(300, 470))'
    body = eval(scene_src, env)
    write("images/wall/%s.svg" % slug, s.wrap(body))


def add(path):
    new = load_json(path)
    s = read("index.html")
    existing = {wall_name(w).lower() for w in re.findall(r'<a class="db-wall-item"[^\n]*</a>', s)}
    s = s.replace(' data-new="1"', ' data-new="0"').replace('<span class="db-wall-new">NEW</span></a>', "</a>")
    d = load_json("data/tools.json")
    R = load_json("data/rankings.json")
    for t in new:
        assert t["name"].lower() not in existing, "already in database: " + t["name"]
        for k in ("slug", "name", "url", "domain", "category", "tier", "desc", "fact", "caption", "v", "c", "e", "t", "why"):
            assert k in t, "%s missing %s" % (t.get("name"), k)
        assert t["tier"] in ("free", "paid", "unlisted")
        acc = re.search(r'data-category="' + re.escape(t["category"]) + r'"[^>]*?--cat-accent:(#[0-9a-f]+)', s)
        assert acc, "unknown category %r (use an existing category name exactly)" % t["category"]
        acc = acc.group(1)
        make_svg(t["slug"], t.get("scene"))
        img = "images/wall/%s.svg" % t["slug"]
        logo = "https://www.google.com/s2/favicons?domain=%s&sz=128" % t["domain"]
        wall = ('      <a class="db-wall-item" href="%s" target="_blank" rel="noopener" data-name="%s" data-category="%s" '
                'data-tier="%s" data-date="%s" data-new="1" style="--cat-accent:%s" data-desc="%s" data-fact="%s" '
                'data-img="%s" data-caption="%s" title="%s"><img class="db-wall-logo" src="%s" alt="%s logo" width="28" '
                'height="28" loading="lazy"><span class="db-wall-new">NEW</span></a>'
                % (t["url"], E(t["name"].lower()), t["category"], t["tier"], TODAY, acc, E(t["desc"]), E(t["fact"]),
                   img, E(t["caption"]), E(t["name"]), logo, E(t["name"])))
        items = list(re.finditer(r'\n *<a class="db-wall-item"[^\n]*data-name="([^"]*)"[^\n]*</a>', s))
        after = None
        for it in items:
            if U(it.group(1)) < t["name"].lower():
                after = it
        pos = after.end() if after else items[0].start()
        s = s[:pos] + "\n" + wall + s[pos:]
        row = ('      <a class="db-row" id="tool-%s" href="%s" target="_blank" rel="noopener" data-name="%s" data-category="%s" '
               'data-tier="%s" style="--cat-accent:%s">\n'
               '        <img class="db-logo" src="%s" alt="%s logo" width="36" height="36" loading="lazy">\n'
               '        <div class="db-row-body">\n'
               '          <h3>%s</h3>\n'
               '          <p>%s</p>\n'
               '          <p class="db-cool"><strong>Cool fact:</strong> %s</p>\n'
               '          <p class="db-row-caption">%s</p>\n'
               '        </div>\n'
               '        <img class="db-row-comic" src="%s" alt="%s comic" loading="lazy">\n'
               '      </a>\n'
               % (t["slug"], t["url"], E(t["name"].lower()), t["category"], t["tier"], acc, logo, E(t["name"]),
                  E(t["name"]), E(t["desc"]), E(t["fact"]), E(t["caption"]), img, E(t["name"])))
        sec = re.search(r'<section class="db-section" id="[^"]+" data-category="' + re.escape(t["category"]) +
                        r'">.*?\n    </div>\n  </section>', s, re.S)
        end = sec.end() - len("    </div>\n  </section>")
        s = s[:end] + row + s[end:]
        d["tools"].append({"name": t["name"], "domain": t["domain"], "category": t["category"], "description": t["desc"],
                           "cool_fact": t["fact"], "url": t["url"], "reviewed_on_solosgems": False, "pricing": t["tier"],
                           "date_added": TODAY})
        R["tools"].append({"rank": 0, "slug": t["slug"], "name": t["name"], "category": t["category"], "score": 0,
                           "basis": "scouted", "value_score": t["v"], "capability_score": t["c"], "ease_score": t["e"],
                           "trial_score": t["t"], "previous_rank": None, "why": t["why"]})
        print("added", t["name"])
    write("index.html", s)
    dump_json("data/tools.json", d)
    dump_json("data/rankings.json", R)
    rerank()


def remove(name):
    s = read("index.html")
    key = E(name.lower())
    n0 = len(s)
    s = re.sub(r'\n *<a class="db-wall-item"[^\n]*data-name="' + re.escape(key) + r'"[^\n]*</a>', "", s, count=1)
    s = re.sub(r'\n *<a class="db-row"[^>]*data-name="' + re.escape(key) + r'"[^>]*>.*?</a>', "", s, count=1, flags=re.S)
    assert len(s) < n0, "not found on the homepage: " + name
    write("index.html", s)
    for p in ("data/tools.json", "data/rankings.json"):
        d = load_json(p)
        d["tools"] = [t for t in d["tools"] if t["name"] != name]
        dump_json(p, d)
    wk = read("worker.js")
    write("worker.js", wk.replace('"%s", ' % name, ""))
    print("removed", name)
    rerank()


# ---------------------------------------------------------------- deathstack
def graves():
    ds = read("deathstack.html")
    gr = []
    for m in re.finditer(r'<div class="grave-card" id="grave-([^"]+)">(.*?)<p class="grave-source">', ds, re.S):
        c = m.group(2)
        g = lambda pat: (re.search(pat, c).group(1) if re.search(pat, c) else "")
        gr.append({"id": m.group(1), "name": U(g(r'grave-name">([^<]*)')), "dates": U(g(r'grave-dates">([^<]*)')),
                   "cause": U(g(r'grave-tag cause">([^<]*)')), "img": g(r'<img class="review-hero" src="([^"]+)"'),
                   "caption": U(g(r'review-hero-caption">([^<]*)'))})
    n = len(gr)
    ds = re.sub(r'(<div class="ds-stat-value">)\d+(</div><div class="ds-stat-label">Bodies)', r"\g<1>%d\2" % n, ds)
    ds = re.sub(r'(content="|"description": "|&middot; )\d+( real AI tools)', r"\g<1>%d\2" % n, ds)
    write("deathstack.html", ds)
    s = read("index.html")
    s = re.sub(r'(<script type="application/json" id="herald-graves-data">).*?(</script>)',
               lambda m: m.group(1) + json.dumps(gr, ensure_ascii=False).replace("</", "<\\/") + m.group(2), s, count=1, flags=re.S)
    s = re.sub(r"\d+ fallen AI tools", "%d fallen AI tools" % n, s)
    write("index.html", s)
    for p, pat in (("about.html", r"(the graveyard: )\d+( real AI tools)"), ("llms.txt", r"(DeathStack\]\(https://solosgems.com/deathstack.html\): )\d+( real)")):
        write(p, re.sub(pat, lambda m: m.group(1) + str(n) + m.group(2), read(p)))
    write("sitemap.xml", re.sub(r"(<loc>https://solosgems.com/deathstack.html</loc><lastmod>)[0-9-]+", r"\g<1>" + TODAY, read("sitemap.xml")))
    print("graves", n)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "rerank":
        rerank()
    elif cmd == "add":
        add(sys.argv[2])
    elif cmd == "remove":
        remove(sys.argv[2])
    elif cmd == "graves":
        graves()
    else:
        print(__doc__)
        sys.exit(1)
