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
    assert admin.post(f"{API}/admin/prospects", json={"business_name": "X", "category": "nope"}).status_code == 400
    r = admin.patch(f"{API}/admin/prospects/{p['id']}", json={"status": "contacted", "notes": "Called Tue"}).json()
    assert r["status"] == "contacted" and r["notes"] == "Called Tue"
    assert admin.patch(f"{API}/admin/prospects/{p['id']}", json={"status": "bogus"}).status_code == 400
    assert admin.delete(f"{API}/admin/prospects/{p['id']}").status_code == 200
    assert all(x["id"] != p["id"] for x in admin.get(f"{API}/admin/prospects").json())
