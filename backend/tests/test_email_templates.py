"""Email template editor."""
import os

import requests
from dotenv import dotenv_values

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
T = f"{API}/admin/email-templates"


def login(email, password):
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": email, "password": password}).status_code == 200
    return s


def body_of(t, **kw):
    return {k: t[k] for k in ("subject", "heading", "intro", "bullets", "outro", "button", "layout", "banner_url")} | kw


def test_owner_only():
    assert requests.get(T).status_code == 401
    assert login("member@tinysvouchers.com.au", "Member!2026").get(T).status_code == 403


def test_list_preview_layouts():
    admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
    rows = {t["key"]: t for t in admin.get(T).json()}
    assert {"invite", "pitch", "welcome", "renewal", "gift", "partner_welcome", "deal_approved", "deal_rejected",
            "business_rejected", "partner_report", "new_applicant", "weekly_digest"} <= set(rows)
    for layout in ("classic", "banner", "letter", "dark"):
        p = admin.post(f"{T}/preview", json={"key": "welcome", **body_of(rows["welcome"], layout=layout)}).json()
        assert "GP-AB12CD" in p["html"] and p["subject"].startswith("Welcome to Go Perks")
    assert admin.post(f"{T}/preview", json={"key": "welcome", **body_of(rows["welcome"], layout="nope")}).status_code == 400


def test_edit_then_reset_builtin():
    admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
    t = next(x for x in admin.get(T).json() if x["key"] == "deal_approved")
    saved = admin.put(f"{T}/deal_approved", json=body_of(t, subject="TEST_ {deal_title} is live", layout="dark")).json()
    assert saved["edited"] and saved["layout"] == "dark"
    p = admin.post(f"{T}/preview", json={"key": "deal_approved", **body_of(saved)}).json()
    assert p["subject"] == "TEST_ Free scoop with any cone is live"
    back = admin.delete(f"{T}/deal_approved").json()
    assert not back["edited"] and back["subject"] == "Your deal is live on {brand}"


def test_custom_pitch_version_used_when_sending():
    admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
    assert admin.post(T, json={"base": "welcome", "name": "x"}).status_code == 400
    v = admin.post(T, json={"base": "pitch", "name": "TEST_ cafes"}).json()
    assert v["custom"] and v["base"] == "pitch" and v["key"].startswith("pitch-")
    admin.put(f"{T}/{v['key']}", json=body_of(v, name="TEST_ cafes", heading="TEST_ heading for cafes"))
    prev = admin.get(f"{API}/admin/prospects/pitch-preview", params={"template": v["key"]}).json()
    assert "TEST_ heading for cafes" in prev["html"]
    assert admin.get(f"{API}/admin/prospects/pitch-preview", params={"template": "invite"}).status_code == 400
    assert admin.post(f"{API}/admin/invites", json={"people": [{"email": "test_x@example.com"}], "template": v["key"]}).status_code == 400
    assert admin.delete(f"{T}/{v['key']}").json() == {"deleted": True}
    assert all(t["key"] != v["key"] for t in admin.get(T).json())
