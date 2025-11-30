#!/usr/bin/env python3
import os, requests, frontmatter
from datetime import datetime
from dateutil import tz

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
NEWSAPI_BASE = "https://newsapi.org/v2"
ALPHAVANTAGE_BASE = "https://www.alphavantage.co/query"

# Edit these lists to your preference:
CRYPTO_LIST = ["bitcoin", "ethereum", "dogecoin"]
STOCK_SYMBOLS = ["AAPL", "TSLA", "RELIANCE.NS"]

POSTS_DIR = "_posts"

def slugify(s):
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")

def fetch_crypto_prices(ids):
    url = f"{COINGECKO_BASE}/simple/price"
    params = {"ids": ",".join(ids), "vs_currencies": "usd,INR", "include_24hr_change":"true"}
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    return r.json()

def fetch_news(q="crypto OR bitcoin OR stock", page_size=5):
    key = os.getenv("NEWSAPI_KEY")
    if not key:
        return []
    params = {"q": q, "pageSize": page_size, "language":"en", "apiKey": key, "sortBy":"publishedAt"}
    r = requests.get(f"{NEWSAPI_BASE}/everything", params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    return data.get("articles", [])

def fetch_stock_quote_alpha(symbol):
    key = os.getenv("ALPHAVANTAGE_KEY")
    if not key:
        return None
    params = {"function":"GLOBAL_QUOTE", "symbol": symbol, "apikey": key}
    r = requests.get(ALPHAVANTAGE_BASE, params=params, timeout=15)
    if r.status_code != 200:
        return None
    data = r.json().get("Global Quote", {})
    return {
        "symbol": symbol,
        "price": data.get("05. price"),
        "change": data.get("09. change"),
        "change_percent": data.get("10. change percent")
    }

def make_post(title, content, tags=None, categories=None, layout="post"):
    dt = datetime.now(tz=tz.tzlocal())
    date_str = dt.strftime("%Y-%m-%d")
    slug = slugify(title)[:50]
    filename = f"{POSTS_DIR}/{date_str}-{slug}.md"
    meta = {
        "layout": layout,
        "title": title,
        "date": dt.isoformat(),
        "tags": tags or [],
        "categories": categories or []
    }
    post = frontmatter.Post(content, **meta)
    os.makedirs(POSTS_DIR, exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        f.write(frontmatter.dumps(post))
    print("Wrote", filename)
    return filename

def summarize_crypto(prices):
    lines = []
    for coin, info in prices.items():
        usd = info.get("usd")
        inr = info.get("inr")
        chg = info.get("usd_24h_change") or 0.0
        lines.append(f"**{coin.title()}** — ${usd} / ₹{inr} (24h change: {chg:.2f}%)")
    return "\n\n".join(lines)

def main():
    prices = fetch_crypto_prices(CRYPTO_LIST)
    crypto_summary = summarize_crypto(prices)

    stocks = []
    for s in STOCK_SYMBOLS:
        q = fetch_stock_quote_alpha(s)
        if q:
            stocks.append(q)
    stock_lines = []
    for s in stocks:
        stock_lines.append(f"**{s['symbol']}** — {s.get('price')} (Δ {s.get('change_percent')})")
    stock_summary = "\n\n".join(stock_lines) if stock_lines else "Stock API key not provided or limit reached."

    articles = fetch_news(page_size=6)
    news_md = ""
    for a in articles:
        published = a.get("publishedAt", "")[:10]
        source = a.get("source",{}).get("name","")
        title = a.get("title","")
        url = a.get("url","")
        news_md += f"- {published} — [{title}]({url}) — _{source}_\n"

    title = f"Daily Market Update — {datetime.now().strftime('%b %d, %Y')}"
    content = f"## Crypto snapshot\n\n{crypto_summary}\n\n---\n\n## Stock snapshot\n\n{stock_summary}\n\n---\n\n## Top headlines\n\n{news_md}\n\n---\n\n*This post generated automatically.*"
    make_post(title, content, tags=["crypto","stocks","daily"], categories=["market-update"])

if __name__ == "__main__":
    main()
