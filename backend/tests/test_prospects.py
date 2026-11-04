"""Prospects list (owner only, nothing emailed)."""
import os

import requests
from dotenv import dotenv_values

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


def login(email, password):
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": email, "password": password}).status_code == 200
    return s


def test_owner_only():
    assert requests.get(f"{API}/admin/prospects").status_code == 401
    assert login("member@tinysvouchers.com.au", "Member!2026").get(f"{API}/admin/prospects").status_code == 403


def test_seeded_list_has_emails_and_sources():
    rows = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"]).get(f"{API}/admin/prospects").json()
    seeded = [r for r in rows if r["source_url"].startswith("http")]
    assert len(seeded) >= 60
    assert all("@" in r["email"] and r["suburb"] for r in seeded)


def test_add_edit_delete():
    admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
    p = admin.post(f"{API}/admin/prospects", json={"business_name": "TEST_ Prospect", "category": "kids", "suburb": "Sunshine",
                                                  "email": "test_prospect@example.com"}).json()
    assert p["status"] == "new" and p["source_url"] == "Added by you"
    assert p["postcode"] == "3020" and p["located"] == "suburb" and p["lat"] < -37
    assert admin.post(f"{API}/admin/prospects", json={"business_name": "X", "category": "nope"}).status_code == 400
    assert admin.post(f"{API}/admin/prospects", json={"business_name": "X", "suburb": "Narnia"}).status_code == 400
    r = admin.patch(f"{API}/admin/prospects/{p['id']}", json={"status": "contacted", "notes": "Called Tue"}).json()
    assert r["status"] == "contacted" and r["notes"] == "Called Tue" and r["contacted_at"] and r["follow_up"] is False
    assert admin.patch(f"{API}/admin/prospects/{p['id']}", json={"status": "bogus"}).status_code == 400
    moved = admin.patch(f"{API}/admin/prospects/{p['id']}", json={"suburb": "Yarraville", "postcode": "3013"}).json()
    assert moved["suburb"] == "Yarraville" and abs(moved["lng"] - p["lng"]) > 0.01
    assert admin.delete(f"{API}/admin/prospects/{p['id']}").status_code == 200
    assert all(x["id"] != p["id"] for x in admin.get(f"{API}/admin/prospects").json())


def test_pitch_preview_and_skips():
    admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
    prev = admin.get(f"{API}/admin/prospects/pitch-preview", params={"note": "Loved your coffee"}).json()
    assert "Free to join" in prev["subject"] and "Loved your coffee" in prev["html"] and "Unsubscribe" in prev["html"]
    no_email = admin.post(f"{API}/admin/prospects", json={"business_name": "TEST_ NoEmail", "suburb": "Footscray"}).json()
    ok = admin.post(f"{API}/admin/prospects", json={"business_name": "TEST_ Pitch", "suburb": "Footscray", "email": "test_pitch@example.com"}).json()
    r = admin.post(f"{API}/admin/prospects/pitch", json={"ids": [no_email["id"], ok["id"]]}).json()
    assert r["queued"] == 1 and r["skipped"] == [{"business_name": "TEST_ NoEmail", "reason": "has no email"}]
    again = admin.post(f"{API}/admin/prospects/pitch", json={"ids": [ok["id"]]}).json()
    assert again["queued"] == 1 or again["skipped"][0]["reason"] == "was already sent a pitch"
    for x in (no_email, ok):
        admin.delete(f"{API}/admin/prospects/{x['id']}")


def test_business_profile_needs_listed_suburb():
    biz = login("business@tinysvouchers.com.au", "Business!2026")
    body = {"business_name": "Tiny's Test Cafe", "address": "1 Test Lane", "suburb": "Narnia", "postcode": "3999", "phone": "0400000000",
            "about": "A friendly test cafe for members.", "hours": {"mon": {"open": "08:00", "close": "16:00"}}}
    assert biz.put(f"{API}/business/profile", json=body).status_code == 400
    assert biz.put(f"{API}/business/profile", json={**body, "suburb": "Seddon", "postcode": "3011"}).status_code == 200
    assert requests.get(f"{API}/places/vic-suburbs").json()[0].keys() == {"name", "postcode"}
