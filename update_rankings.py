import json, re, os

# Site root = one directory up from this script (works wherever the folder is unzipped)
ROOT_DEFAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GEM_SVG_MINI = '''<svg class="gem-icon-mini" viewBox="0 0 32 32" width="14" height="14" aria-hidden="true">
<polygon points="16,2 27,12 16,30 5,12" fill="#ffd76a" stroke="#1a1a18" stroke-width="1.5"/>
<polygon points="16,2 27,12 21,12" fill="#fff3cf"/>
<polygon points="16,2 5,12 11,12" fill="#ffe9a8"/>
</svg>'''

GEM_CORNER_SVG = '''<svg class="gem-corner" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
<polygon points="16,2 27,12 16,30 5,12" fill="#ffd76a" stroke="#1a1a18" stroke-width="1.5"/>
<polygon points="16,2 27,12 21,12" fill="#fff3cf"/>
<polygon points="16,2 5,12 11,12" fill="#ffe9a8"/>
<polygon points="5,12 11,12 16,30" fill="#c98a1f"/>
<polygon points="27,12 21,12 16,30" fill="#8a5a12"/>
</svg>'''

def delta_html(rank, previous_rank):
    if previous_rank is None:
        return '<span class="rank-delta new">NEW</span>'
    if previous_rank == rank:
        return '<span class="rank-delta flat">-</span>'
    if previous_rank > rank:
        return f'<span class="rank-delta up">&#9650;{previous_rank - rank}</span>'
    return f'<span class="rank-delta down">&#9660;{rank - previous_rank}</span>'

def strip_index_card(block):
    block = re.sub(r'<span class="rank-badge">#\d+</span>', '', block)
    block = re.sub(r'\s*<span class="rank-delta[^"]*">.*?</span>', '', block, flags=re.S)
    block = re.sub(r'<svg class="gem-corner".*?</svg>\n?', '', block, flags=re.S)
    return block

def strip_review_ldjson(content):
    content = re.sub(
        r'<script type="application/ld\+json">\s*\{\s*"@context": "https://schema\.org",\s*"@type": "Review".*?</script>\n?',
        '', content, flags=re.S
    )
    return content

def strip_review_markup(content):
    content = re.sub(r'\s*<div class="rank-line">.*?</div>\n', '\n', content, count=1, flags=re.S)
    content = re.sub(
        r'<div class="spec-item"><div class="spec-label">Overall rank</div>.*?</div></div>\n\s*',
        '', content, count=1, flags=re.S
    )
    content = strip_review_ldjson(content)
    return content

def strip_index_ldjson(content):
    content = re.sub(
        r'<script type="application/ld\+json">\s*\{\s*"@context": "https://schema\.org",\s*"@type": "ItemList".*?</script>\n?',
        '', content, flags=re.S
    )
    return content

def inject_last_updated(content, date):
    block = f'  <p class="rank-meta">Last updated {date}. Rankings shift as reviews are added or rescored.</p>\n'
    pattern = re.compile(r'  <p class="rank-meta">.*?</p>\n')
    if pattern.search(content):
        return pattern.sub(block, content, count=1)
    anchor = re.search(r'<h2 class="section-heading">Ranked #1.*?</h2>\n.*?</p>\n', content, re.S)
    assert anchor, "could not find Ranked heading + section-sub paragraph to anchor last-updated line"
    return content[:anchor.end()] + block + content[anchor.end():]

def build_sidebar_list(tools_sorted):
    items = []
    for t in tools_sorted:
        cls = ' class="top"' if t["rank"] == 1 else ""
        items.append(
            f'      <li{cls}><a href="reviews/{t["slug"]}.html">'
            f'<span class="rank-list-num">{t["rank"]}</span>{t["name"]}</a></li>'
        )
    return "\n".join(items)

def main(root=ROOT_DEFAULT):
    DATA = os.path.join(root, "data", "rankings.json")
    data = json.load(open(DATA, encoding="utf-8"))
    tools = data["tools"]
    tools_sorted = sorted(tools, key=lambda t: t["score"], reverse=True)
    for i, t in enumerate(tools_sorted, start=1):
        t["rank"] = i
    by_slug = {t["slug"]: t for t in tools_sorted}
    total = len(tools_sorted)

    # ---------------- reviews.html ----------------
    p = os.path.join(root, "reviews.html")
    content = open(p, encoding="utf-8").read()
    content = strip_index_ldjson(content)
    content = inject_last_updated(content, data["last_updated"])

    grid_m = re.search(r'(<div class="grid">\n)(.*?)(\n  </div>)', content, re.S)
    grid_open, grid_body, grid_close = grid_m.group(1), grid_m.group(2), grid_m.group(3)

    card_pattern = re.compile(r'<a class="card" href="reviews/([\w-]+)\.html">.*?</a>', re.S)
    cards = {m.group(1): strip_index_card(m.group(0)) for m in card_pattern.finditer(grid_body)}

    missing = set(by_slug.keys()) - set(cards.keys())
    extra = set(cards.keys()) - set(by_slug.keys())
    assert not missing, f"rankings.json has slugs with no homepage card: {missing}"
    assert not extra, f"homepage has cards with no rankings.json entry: {extra}"

    new_cards = []
    for t in tools_sorted:
        block = cards[t["slug"]]
        rank_badge = f'<span class="rank-badge">#{t["rank"]}</span>'
        block = block.replace('<div class="card-head">', f'<div class="card-head">{rank_badge}', 1)
        delta = delta_html(t["rank"], t["previous_rank"])
        block = re.sub(r'(<span class="cat">.*?</span>)', r'\1 ' + delta, block, count=1)
        if t["rank"] == 1:
            block = re.sub(r'(<div class="card-thumb">.*?)(</div>)', r'\1' + GEM_CORNER_SVG + r'\2', block, count=1, flags=re.S)
        new_cards.append(block)

    new_grid_body = "\n\n".join("    " + c for c in new_cards)
    content = content[:grid_m.start()] + grid_open + new_grid_body + grid_close + content[grid_m.end():]

    sidebar_m = re.search(r'(<ol class="rank-list">\n)(.*?)(\s*</ol>)', content, re.S)
    assert sidebar_m, "sidebar <ol class=\"rank-list\"> not found in index.html"
    new_sidebar_body = build_sidebar_list(tools_sorted)
    content = (
        content[:sidebar_m.start()]
        + sidebar_m.group(1) + new_sidebar_body + "\n    </ol>"
        + content[sidebar_m.end():]
    )

    itemlist = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListOrder": "https://schema.org/ItemListOrderDescending",
        "numberOfItems": total,
        "itemListElement": [
            {"@type": "ListItem", "position": t["rank"], "name": t["name"],
             "url": f"https://solosgems.com/reviews/{t['slug']}.html"}
            for t in tools_sorted
        ]
    }
    script = '<script type="application/ld+json">\n' + json.dumps(itemlist, indent=2) + '\n</script>\n</head>'
    content = content.replace("</head>", script, 1)

    open(p, "w", encoding="utf-8").write(content)

    # ---------------- review pages ----------------
    for t in tools_sorted:
        p = os.path.join(root, "reviews", f"{t['slug']}.html")
        content = open(p, encoding="utf-8").read()
        content = strip_review_markup(content)

        delta = delta_html(t["rank"], t["previous_rank"])
        top_pick = ""
        if t["rank"] == 1:
            top_pick = f' <span class="top-pick-badge">{GEM_SVG_MINI} Top pick</span>'
        rank_line_html = f'    <div class="rank-line">Ranked #{t["rank"]} of {total} {delta}{top_pick}</div>\n'

        content = re.sub(
            r'(<nav class="breadcrumb"[^>]*>.*?</nav>\n)',
            lambda m: m.group(1) + rank_line_html,
            content, count=1
        )

        rank_spec_item = (
            f'<div class="spec-item"><div class="spec-label">Overall rank</div>'
            f'<div class="spec-value">#{t["rank"]} of {total}</div></div>\n        '
        )
        content = content.replace('<div class="spec-grid">\n        <div class="spec-item">',
                                   '<div class="spec-grid">\n        ' + rank_spec_item + '<div class="spec-item">', 1)

        review_ld = {
            "@context": "https://schema.org",
            "@type": "Review",
            "itemReviewed": {
                "@type": "SoftwareApplication",
                "name": t["name"],
                "applicationCategory": t["category"]
            },
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": t["score"],
                "bestRating": 10,
                "worstRating": 1
            },
            "author": {"@type": "Person", "name": "Solos Gems"},
            "publisher": {"@type": "Organization", "name": "Solos Gems"},
            "datePublished": data["last_updated"]
        }
        script = '<script type="application/ld+json">\n' + json.dumps(review_ld, indent=2) + '\n</script>\n</head>'
        content = content.replace("</head>", script, 1)

        open(p, "w", encoding="utf-8").write(content)

    for t in data["tools"]:
        t["previous_rank"] = by_slug[t["slug"]]["rank"]
        del by_slug[t["slug"]]["rank"]
    json.dump(data, open(DATA, "w", encoding="utf-8"), indent=2)
    print(f"Ranked {total} tools. #1: {tools_sorted[0]['name']}")

if __name__ == "__main__":
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT_DEFAULT)
