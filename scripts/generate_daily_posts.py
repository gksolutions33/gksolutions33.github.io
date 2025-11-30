#!/usr/bin/env python3
import os, requests, frontmatter, traceback, json
from datetime import datetime

COINGECKO = "https://api.coingecko.com/api/v3/simple/price"
NEWSAPI = "https://newsapi.org/v2/everything"
ALPHAVANTAGE = "https://www.alphavantage.co/query"

CRYPTO = ["bitcoin", "ethereum", "dogecoin"]
STOCKS = ["AAPL", "TSLA", "RELIANCE.NS"]

POSTS_DIR = "_posts"

def slugify(s):
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")

def fetch_crypto():
    try:
        params = {"ids": ",".join(CRYPTO), "vs_currencies": "usd,INR", "include_24hr_change": "true"}
        r = requests.get(COINGECKO, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print("Error fetching CoinGecko:", e)
        return {}

def fetch_news():
    key = os.getenv("NEWSAPI_KEY")
    if not key:
        print("No NEWSAPI_KEY set; skipping news fetch.")
        return []
    try:
        params = {"q": "crypto OR bitcoin OR stock", "pageSize": 5, "language": "en", "sortBy": "publishedAt", "apiKey": key}
        r = requests.get(NEWSAPI, params=params, timeout=15)
        r.raise_for_status()
        return r.json().get("articles", [])
    except Exception as e:
        print("Error fetching NewsAPI:", e)
        return []

def fetch_stock(symbol):
    key = os.getenv("ALPHAVANTAGE_KEY")
    if not key:
        print("No ALPHAVANTAGE_KEY set; skipping stock fetch for", symbol)
        return None
    try:
        params = {"function": "GLOBAL_QUOTE", "symbol": symbol, "apikey": key}
        r = requests.get(ALPHAVANTAGE, params=params, timeout=15)
        r.raise_for_status()
        return r.json().get("Global Quote", {})
    except Exception as e:
        print(f"Error fetching AlphaVantage for {symbol}:", e)
        return None

def write_post(title, content, tags=None):
    try:
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        slug = slugify(title)[:60]
        filename = f"{POSTS_DIR}/{date_str}-{slug}.md"
        meta = {"layout":"post", "title":title, "date": now.isoformat(), "tags": tags or []}
        post = frontmatter.Post(content, **meta)
        os.makedirs(POSTS_DIR, exist_ok=True)
        with open(filename, "w", encoding="utf-8") as f:
            f.write(frontmatter.dumps(post))
        print("Wrote post:", filename)
        return filename
    except Exception as e:
        print("Error writing post:", e)
        traceback.print_exc()
        return None

def main():
    try:
        print("Starting generator at", datetime.utcnow().isoformat())
        crypto = fetch_crypto()
        news = fetch_news()
        stock_data = [fetch_stock(s) for s in STOCKS]

        title = f"Daily Market Update — {datetime.now().strftime('%b %d, %Y')}"

        content_lines = []
        content_lines.append("## Crypto Prices\n")
        if crypto:
            for coin, info in crypto.items():
                usd = info.get("usd", "N/A")
                inr = info.get("inr", "N/A")
                chg = info.get("usd_24h_change", 0.0)
                content_lines.append(f"**{coin.title()}**: ${usd} | ₹{inr} | 24h: {float(chg):.2f}%\n")
        else:
            content_lines.append("Crypto data not available.\n")

        content_lines.append("\n---\n\n## Stock Updates\n")
        any_stock = False
        for s in stock_data:
            if not s:
                continue
            any_stock = True
            symbol = s.get("01. symbol", "UNKNOWN")
            price = s.get("05. price", "N/A")
            cp = s.get("10. change percent", "N/A")
            content_lines.append(f"**{symbol}**: {price} (Change: {cp})\n")
        if not any_stock:
            content_lines.append("Stock data not available or ALPHAVANTAGE_KEY missing/limit reached.\n")

        content_lines.append("\n---\n\n## News Headlines\n")
        if news:
            for a in news:
                t = a.get("title", "No title")
                u = a.get("url", "")
                sname = a.get("source", {}).get("name", "")
                content_lines.append(f"- [{t}]({u}) — _{sname}_\n")
        else:
            content_lines.append("No news (NEWSAPI_KEY missing or no articles).\n")

        content_lines.append("\n---\n\n*This post was generated automatically.*\n")
        content = "\n".join(content_lines)

        written = write_post(title, content, tags=["crypto","stocks","daily"])
        if not written:
            print("No post was written.")
    except Exception as e:
        print("Unhandled exception in main():", e)
        traceback.print_exc()

if __name__ == "__main__":
    main()
