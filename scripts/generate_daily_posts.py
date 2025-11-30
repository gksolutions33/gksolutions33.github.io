#!/usr/bin/env python3
"""
scripts/generate_daily_posts.py

Generates a Jekyll post under _posts/ and updates posts.json (site index).
Designed to run inside GitHub Actions (or locally for testing).
Dependencies: requests, python-frontmatter, python-dateutil
"""

import os
import json
import traceback
from pathlib import Path
from datetime import datetime
from dateutil import tz

import requests
import frontmatter

# -------------------------
# Configuration (editable)
# -------------------------
COINGECKO = "https://api.coingecko.com/api/v3/simple/price"
NEWSAPI = "https://newsapi.org/v2/everything"
ALPHAVANTAGE = "https://www.alphavantage.co/query"

CRYPTO = ["bitcoin", "ethereum", "dogecoin"]   # CoinGecko ids
STOCKS = ["AAPL", "TSLA", "RELIANCE.NS"]      # Change to your watchlist

POSTS_DIR = "_posts"
POSTS_JSON = "posts.json"
SITE_BASE = "https://gksolutions33.github.io"   # change if you use a custom domain

MAX_POSTS_IN_INDEX = 30

# -------------------------
# Helpers
# -------------------------
def slugify(s: str) -> str:
    """Simple slugify: keep only alnum, replace others with '-'"""
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")

def make_permalink_filename(title: str, dt: datetime):
    """
    Build permalink to match _config.yml: /:year/:month/:day/:title.html
    Returns (permalink, slug)
    """
    year = dt.strftime("%Y")
    month = dt.strftime("%m")
    day = dt.strftime("%d")
    slug = slugify(title)[:60]
    return f"/{year}/{month}/{day}/{slug}.html", slug

# -------------------------
# Fetchers
# -------------------------
def fetch_crypto():
    try:
        params = {
            "ids": ",".join(CRYPTO),
            "vs_currencies": "usd,INR",
            "include_24hr_change": "true"
        }
        r = requests.get(COINGECKO, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print("Error fetching CoinGecko:", e)
        return {}

def fetch_news(page_size=6):
    key = os.getenv("NEWSAPI_KEY")
    if not key:
        print("No NEWSAPI_KEY set; skipping news fetch.")
        return []
    try:
        params = {
            "q": "crypto OR bitcoin OR stock",
            "pageSize": page_size,
            "language": "en",
            "sortBy": "publishedAt",
            "apiKey": key
        }
        r = requests.get(NEWSAPI, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        return data.get("articles", [])
    except Exception as e:
        print("Error fetching NewsAPI:", e)
        return []

def fetch_stock(symbol: str):
    key = os.getenv("ALPHAVANTAGE_KEY")
    if not key:
        print(f"No ALPHAVANTAGE_KEY set; skipping stock fetch for {symbol}")
        return None
    try:
        params = {"function": "GLOBAL_QUOTE", "symbol": symbol, "apikey": key}
        r = requests.get(ALPHAVANTAGE, params=params, timeout=15)
        r.raise_for_status()
        return r.json().get("Global Quote", {})
    except Exception as e:
        print(f"Error fetching AlphaVantage for {symbol}:", e)
        return None

# -------------------------
# Post writer + index
# -------------------------
def write_post_and_index(title: str, content: str, tags=None):
    """
    - Writes a Jekyll markdown file under _posts/YYYY-MM-DD-slug.md
    - Computes the public permalink and updates posts.json (prepends newest)
    Returns: (post_filename, index_item) or (None, None) on error
    """
    try:
        now = datetime.now(tz=tz.tzlocal())
        iso = now.isoformat()
        date_prefix = now.strftime("%Y-%m-%d")
        slug = slugify(title)[:50]
        post_filename = f"{POSTS_DIR}/{date_prefix}-{slug}.md"

        meta = {
            "layout": "post",
            "title": title,
            "date": iso,
            "tags": tags or []
        }
        post = frontmatter.Post(content, **meta)
        os.makedirs(POSTS_DIR, exist_ok=True)
        with open(post_filename, "w", encoding="utf-8") as f:
            f.write(frontmatter.dumps(post))
        print("Wrote post:", post_filename)

        # Compute public permalink
        permalink, _ = make_permalink_filename(title, now)
        public_url = SITE_BASE.rstrip("/") + permalink

        # Build small excerpt (first ~220 chars of plain content)
        excerpt = content.replace("\n", " ")
        excerpt = ' '.join(excerpt.split())
        excerpt = excerpt[:220] + ("…" if len(excerpt) > 220 else "")

        # Update posts.json
        posts_path = Path(POSTS_JSON)
        posts_list = []
        if posts_path.exists():
            try:
                with open(posts_path, "r", encoding="utf-8") as f:
                    posts_list = json.load(f)
            except Exception as e:
                print("Warning: could not parse existing posts.json:", e)
                posts_list = []

        new_item = {
            "title": title,
            "url": public_url,
            "permalink": permalink,
            "date": now.strftime("%Y-%m-%dT%H:%M:%S"),
            "excerpt": excerpt
        }

        # Remove any existing item with same url (avoid duplicates), then prepend
        posts_list = [p for p in posts_list if p.get("url") != new_item["url"]]
        posts_list.insert(0, new_item)
        posts_list = posts_list[:MAX_POSTS_IN_INDEX]

        with open(posts_path, "w", encoding="utf-8") as f:
            json.dump(posts_list, f, ensure_ascii=False, indent=2)
        print("Updated posts index:", POSTS_JSON)

        return post_filename, new_item

    except Exception as e:
        print("Error in write_post_and_index:", e)
        traceback.print_exc()
        return None, None

# -------------------------
# Compose content
# -------------------------
def build_content(crypto_data, stock_data_list, news_articles):
    lines = []

    lines.append("## Crypto snapshot\n")
    if crypto_data:
        for coin, info in crypto_data.items():
            usd = info.get("usd", "N/A")
            inr = info.get("inr", "N/A")
            chg = info.get("usd_24h_change", 0.0)
            try:
                chg_f = float(chg)
            except Exception:
                chg_f = 0.0
            lines.append(f"**{coin.title()}** — ${usd} / ₹{inr} (24h change: {chg_f:.2f}%)\n")
    else:
        lines.append("Crypto data not available.\n")

    lines.append("\n---\n\n## Stock snapshot\n")
    any_stock = False
    for s in stock_data_list:
        if not s:
            continue
        any_stock = True
        symbol = s.get("01. symbol", "UNKNOWN")
        price = s.get("05. price", "N/A")
        change = s.get("09. change", "N/A")
        change_percent = s.get("10. change percent", "N/A")
        lines.append(f"**{symbol}** — {price} (Δ {change_percent})\n")
    if not any_stock:
        lines.append("Stock data not available or ALPHAVANTAGE_KEY missing/limit reached.\n")

    lines.append("\n---\n\n## Top headlines\n")
    if news_articles:
        for a in news_articles:
            published = a.get("publishedAt", "")[:10]
            source = a.get("source", {}).get("name", "")
            title = a.get("title", "No title")
            url = a.get("url", "")
            lines.append(f"- {published} — [{title}]({url}) — _{source}_\n")
    else:
        lines.append("No news available (NEWSAPI_KEY missing or no articles).\n")

    lines.append("\n---\n\n*This post was generated automatically.*\n")
    return "\n".join(lines)

# -------------------------
# Main
# -------------------------
def main():
    try:
        print("Generator started at", datetime.utcnow().isoformat())

        crypto = fetch_crypto()
        news = fetch_news()
        stocks = [fetch_stock(s) for s in STOCKS]

        title = f"Daily Market Update — {datetime.now().strftime('%b %d, %Y')}"
        content = build_content(crypto, stocks, news)

        post_file, item = write_post_and_index(title, content, tags=["crypto", "stocks", "daily"])
        if post_file:
            print("SUCCESS: created post:", post_file)
            print("Index item:", json.dumps(item, indent=2))
        else:
            print("No post created.")

    except Exception as e:
        print("Unhandled exception in main():", e)
        traceback.print_exc()

if __name__ == "__main__":
    main()
