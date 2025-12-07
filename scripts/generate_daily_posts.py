#!/usr/bin/env python3
"""
Generates daily market updates.

- Fetches crypto prices (CoinGecko, no key)
- Fetches news (NewsAPI, optional)
- Fetches stocks (AlphaVantage, optional)
- Writes Markdown post into market_posts/YYYY-MM-DD-slug.md
- Updates posts.json index used by market.html
"""

import os
import json
import traceback
from datetime import datetime
from dateutil import tz

import requests

# -------------------------
# Config
# -------------------------
COINGECKO = "https://api.coingecko.com/api/v3/simple/price"
NEWSAPI = "https://newsapi.org/v2/everything"
ALPHAVANTAGE = "https://www.alphavantage.co/query"

CRYPTO = ["bitcoin", "ethereum", "dogecoin"]
STOCKS = ["AAPL", "TSLA", "RELIANCE.NS"]

MARKET_POSTS_DIR = "market_posts"
POSTS_JSON = "posts.json"
SITE_BASE = "https://gksolutions33.github.io"
MAX_POSTS_IN_INDEX = 30


# -------------------------
# Helpers
# -------------------------
def slugify(s: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")


def fetch_crypto():
    try:
        params = {
            "ids": ",".join(CRYPTO),
            "vs_currencies": "usd,INR",
            "include_24hr_change": "true",
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
            "apiKey": key,
        }
        r = requests.get(NEWSAPI, params=params, timeout=15)
        r.raise_for_status()
        return r.json().get("articles", [])
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
# Content builder
# -------------------------
def build_markdown(title, crypto_data, stock_data_list, news_articles):
    lines = []
    lines.append(f"# {title}\n")
    lines.append("")
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
            lines.append(
                f"**{coin.title()}** — ${usd} / ₹{inr} (24h change: {chg_f:.2f}%)"
            )
    else:
        lines.append("Crypto data not available.")

    lines.append("\n---\n")
    lines.append("## Stock snapshot\n")

    any_stock = False
    for s in stock_data_list:
        if not s:
            continue
        any_stock = True
        symbol = s.get("01. symbol", "UNKNOWN")
        price = s.get("05. price", "N/A")
        change_percent = s.get("10. change percent", "N/A")
        lines.append(f"**{symbol}** — {price} (Δ {change_percent})")

    if not any_stock:
        lines.append("Stock data not available or AlphaVantage limit reached.")

    lines.append("\n---\n")
    lines.append("## Top headlines\n")

    if news_articles:
        for a in news_articles:
            published = (a.get("publishedAt", "") or "")[:10]
            source = a.get("source", {}).get("name", "")
            t = a.get("title", "No title")
            u = a.get("url", "")
            lines.append(f"- {published} — [{t}]({u}) — _{source}_")
    else:
        lines.append("No news available (API key missing or 0 results).")

    lines.append("\n---\n")
    lines.append("*This post was generated automatically.*\n")

    return "\n".join(lines)


# -------------------------
# Writer + index
# -------------------------
def write_post_and_index(title: str, md_content: str):
    try:
        now = datetime.now(tz=tz.tzlocal())
        iso = now.isoformat()
        date_prefix = now.strftime("%Y-%m-%d")
        slug = slugify(title)[:60]
        filename = f"{date_prefix}-{slug}.md"

        os.makedirs(MARKET_POSTS_DIR, exist_ok=True)
        full_path = os.path.join(MARKET_POSTS_DIR, filename)

        with open(full_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        print("Wrote markdown post:", full_path)

        # This is what the browser will fetch
        permalink = f"/{MARKET_POSTS_DIR}/{filename}"
        public_url = SITE_BASE.rstrip("/") + permalink

        # Build excerpt
        plain = md_content.replace("\n", " ")
        plain = " ".join(plain.split())
        excerpt = plain[:220] + ("…" if len(plain) > 220 else "")

        # Load / update posts.json
        posts_list = []
        if os.path.exists(POSTS_JSON):
            try:
                with open(POSTS_JSON, "r", encoding="utf-8") as f:
                    posts_list = json.load(f)
            except Exception as e:
                print("Warning: could not parse existing posts.json:", e)
                posts_list = []

        new_item = {
            "title": title,
            "url": public_url,
            "permalink": permalink,
            "date": iso,
            "excerpt": excerpt,
        }

        # De-duplicate
        posts_list = [p for p in posts_list if p.get("url") != new_item["url"]]
        posts_list.insert(0, new_item)
        posts_list = posts_list[:MAX_POSTS_IN_INDEX]

        with open(POSTS_JSON, "w", encoding="utf-8") as f:
            json.dump(posts_list, f, ensure_ascii=False, indent=2)

        print("Updated posts index:", POSTS_JSON)
        return full_path, new_item

    except Exception as e:
        print("Error in write_post_and_index:", e)
        traceback.print_exc()
        return None, None


# -------------------------
# Main
# -------------------------
def main():
    try:
        print("Generator started at", datetime.utcnow().isoformat())

        crypto = fetch_crypto()
        news = fetch_news()
        stocks = [fetch_stock(s) for s in STOCKS]

def build_seo_title():
    # adjust these if your variable names differ
    try:
        crypto_names = [c.title() for c in CRYPTO]  # or CRYPTO_LIST if that's your list
    except NameError:
        crypto_names = []

    try:
        stock_names = STOCK_SYMBOLS
    except NameError:
        stock_names = []

    top_cryptos = ", ".join(crypto_names[:2]) or "Crypto"
    top_stocks = ", ".join(stock_names[:2]) or "Stocks"

    date_str = datetime.now().strftime("%b %d, %Y")
    return f"Crypto & Stock Market Today ({date_str}) – {top_cryptos} & {top_stocks} Price Update"

# later, where you previously had:
# title = f"Daily Market Update — {datetime.now().strftime('%b %d, %Y')}"
    def build_seo_title():
    # adjust these if your variable names differ
    try:
        crypto_names = [c.title() for c in CRYPTO]  # or CRYPTO_LIST if that's your list
    except NameError:
        crypto_names = []

    try:
        stock_names = STOCK_SYMBOLS
    except NameError:
        stock_names = []

    top_cryptos = ", ".join(crypto_names[:2]) or "Crypto"
    top_stocks = ", ".join(stock_names[:2]) or "Stocks"

    date_str = datetime.now().strftime("%b %d, %Y")
    return f"Crypto & Stock Market Today ({date_str}) – {top_cryptos} & {top_stocks} Price Update"

# later, where you previously had:
# title = f"Daily Market Update — {datetime.now().strftime('%b %d, %Y')}"
title = build_seo_title()


if __name__ == "__main__":
    main()
