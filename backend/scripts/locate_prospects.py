"""Add postcode, street address and map position to prospects_seed.json.

Looks each business up on OpenStreetMap (1 request a second, per its usage policy) and keeps a match only if it sits
within 3 km of its suburb. Otherwise the prospect is pinned at the suburb centre and flagged as approximate.
Usage: python scripts/locate_prospects.py            (OpenStreetMap lookup by name)
       python scripts/locate_prospects.py --websites (then: read street addresses off each business's own pages)
"""
import json
import math
import re
import sys
import time
from pathlib import Path

import httpx

BACKEND = Path(__file__).parent.parent
SEED = BACKEND / "prospects_seed.json"
SUBURBS = json.loads((BACKEND / "data" / "vic_suburbs.json").read_text())


def km(a, b):
    dlat, dlng = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlng / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def main():
    rows = json.loads(SEED.read_text())
    by_name = {}
    for s in SUBURBS:
        by_name.setdefault(s["name"].lower(), s)
    with httpx.Client(timeout=15, headers={"User-Agent": "GoPerks/1.0 (prospect mapping)"}) as c:
        for p in rows:
            sub = by_name.get(p["suburb"].lower())
            p["postcode"] = sub["postcode"] if sub else ""
            p["lat"], p["lng"], p["located"] = (sub["lat"], sub["lng"], "suburb") if sub else (None, None, "none")
            p.setdefault("address", "")
            try:
                res = c.get("https://nominatim.openstreetmap.org/search", params={
                    "q": f"{p['business_name']}, {p['suburb']}, Victoria, Australia", "format": "json", "addressdetails": 1,
                    "limit": 3, "countrycodes": "au"}).json()
            except Exception:
                res = []
            time.sleep(1.1)
            for hit in res:
                pt = (float(hit["lat"]), float(hit["lon"]))
                if sub and km(pt, (sub["lat"], sub["lng"])) > 3:
                    continue
                a = hit.get("address", {})
                street = " ".join(x for x in (a.get("house_number"), a.get("road")) if x)
                if street:
                    p["address"], (p["lat"], p["lng"]), p["located"] = street, pt, "exact"
                    break
            print(f"{p['located']:<7} {p['business_name']:<36} {p['address']}")
    SEED.write_text(json.dumps(rows, indent=1))
    print(sum(1 for r in rows if r["located"] == "exact"), "of", len(rows), "found with a street address")


def from_websites():
    """For prospects still pinned at the suburb centre, find '<number> <street>, <suburb>' on their pages and geocode it."""
    rows = json.loads(SEED.read_text())
    kinds = r"(?:St|Street|Rd|Road|Ave|Avenue|Pde|Parade|Pl|Place|Dr|Drive|Hwy|Highway|Cres|Crescent|Lane|Ln|Blvd|Boulevard|Way|Square|Sq|Tce|Terrace|Ct|Court)"
    with httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 Chrome/124"}) as web, \
            httpx.Client(timeout=15, headers={"User-Agent": "GoPerks/1.0 (prospect mapping)"}) as osm:
        for p in rows:
            if p.get("located") == "exact":
                continue
            sub = p["suburb"]
            rx = re.compile(r"((?:Shop |Unit )?[\d/\-A-Za-z]{0,6}\d+[A-Za-z]?\s+(?:[A-Z][a-z]+\s){1,3}" + kinds + r")\.?,?\s+" + re.escape(sub), re.I)
            street = None
            for url in dict.fromkeys(u for u in (p.get("source_url"), p.get("website")) if u and u.startswith("http")):
                try:
                    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", web.get(url).text))
                except Exception:
                    continue
                m = rx.search(text)
                if m:
                    street = m.group(1).strip()
                    break
            if not street:
                continue
            try:
                res = osm.get("https://nominatim.openstreetmap.org/search", params={
                    "street": re.sub(r"^(Shop|Unit)\s+\S+\s+", "", street, flags=re.I), "city": sub, "state": "Victoria",
                    "country": "Australia", "format": "json", "limit": 1}).json()
            except Exception:
                res = []
            time.sleep(1.1)
            p["address"] = street
            if res:
                p["lat"], p["lng"], p["located"] = float(res[0]["lat"]), float(res[0]["lon"]), "exact"
            print(f"{p['located']:<7} {p['business_name']:<36} {street}")
    SEED.write_text(json.dumps(rows, indent=1))
    print(sum(1 for r in rows if r["located"] == "exact"), "of", len(rows), "pinned at their street address")


if __name__ == "__main__":
    from_websites() if "--websites" in sys.argv else main()
