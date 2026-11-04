"""Find publicly listed contact emails on each candidate business's own website.

Reads scripts/prospect_candidates.json, writes scripts/prospect_results.json. Sends nothing.
Usage: python scripts/find_prospect_emails.py
"""
import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

HERE = Path(__file__).parent
EMAIL_RX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
LINK_RX = re.compile(r'href=["\']([^"\'#]+)["\']', re.I)
CF_RX = re.compile(r'data-cfemail="([0-9a-f]+)"', re.I)
CONTACT_WORDS = ("contact", "about", "enquir", "find-us", "visit", "party", "parties", "book", "hire", "info")
BAD = ("example.", "sentry", "wixpress", "domain.com", "email.com", "yourname", "@2x", "godaddy", "squarespace",
       "shopify", "w3.org", "schema.org", "png", "jpg", "jpeg", "gif", "svg", "webp", "wordpress", "mailchimp", "fresha")
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}


def cf_decode(hexstr: str) -> str:
    key = int(hexstr[:2], 16)
    return "".join(chr(int(hexstr[i:i + 2], 16) ^ key) for i in range(2, len(hexstr), 2))


def emails_in(html: str) -> list:
    found = EMAIL_RX.findall(html.replace("%40", "@")) + [cf_decode(h) for h in CF_RX.findall(html)]
    out = []
    for e in found:
        e = e.strip(".").lower()
        if any(b in e for b in BAD) or e in out:
            continue
        out.append(e)
    return out


def rank(email: str, site_host: str) -> int:
    dom = email.split("@")[1]
    host = site_host.removeprefix("www.")
    score = 0 if dom == host or host.endswith(dom) or dom.endswith(host) else 1
    local = email.split("@")[0]
    return score * 10 + (0 if local in ("hello", "info", "contact", "enquiries", "admin", "bookings") else 1)


async def fetch(c: httpx.AsyncClient, url: str):
    try:
        r = await c.get(url)
        if r.status_code < 400 and "html" in r.headers.get("content-type", "html"):
            return str(r.url), r.text
    except Exception:
        pass
    return None, ""


async def scan(c: httpx.AsyncClient, cand: dict) -> dict:
    site = cand["website"].rstrip("/")
    final, html = await fetch(c, site)
    result = {**cand, "email": None, "source": None, "site_ok": bool(final)}
    if not final:
        return result
    host = urlparse(final).netloc.lower()
    pages = [(final, html)]
    links = []
    for href in LINK_RX.findall(html):
        u = urljoin(final, href)
        if urlparse(u).netloc.lower() == host and any(w in u.lower() for w in CONTACT_WORDS) and u not in links:
            links.append(u)
    for extra in ("/contact", "/contact-us"):
        u = urljoin(final, extra)
        if u not in links:
            links.append(u)
    for u in links[:5]:
        f, h = await fetch(c, u)
        if f:
            pages.append((f, h))
    best = None
    for url, h in pages:
        for e in emails_in(h):
            cand_rank = rank(e, host)
            if best is None or cand_rank < best[0]:
                best = (cand_rank, e, url)
    if best:
        result["email"], result["source"] = best[1], best[2]
    return result


async def main():
    cands = json.loads((HERE / "prospect_candidates.json").read_text())
    sem = asyncio.Semaphore(8)
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers=HEADERS) as c:
        async def one(x):
            async with sem:
                return await scan(c, x)
        results = await asyncio.gather(*(one(x) for x in cands))
    (HERE / "prospect_results.json").write_text(json.dumps(results, indent=1))
    for r in results:
        print(f"{'OK ' if r['email'] else '-- '}{r['name']:<34} {r['email'] or ('site down' if not r['site_ok'] else 'no email')}  {r['source'] or ''}")
    print(sum(1 for r in results if r["email"]), "of", len(results), "with email")


if __name__ == "__main__":
    asyncio.run(main())
