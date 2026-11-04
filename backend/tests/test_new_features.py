"""Tests for new Go Perks features: hours object, photo gallery, open_now badge,
admin partner-assigned deals, admin members/businesses CRUD, admin bulk & payments."""
import io
import os
import struct
import uuid
import zlib
from datetime import datetime, timedelta, timezone

import pytest
import requests


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        with open(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN = ("admin@tinysvouchers.com.au", "TinyAdmin!2026")
MEMBER = ("member@tinysvouchers.com.au", "Member!2026")
BUSINESS = ("business@tinysvouchers.com.au", "Business!2026")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"{email}: {r.status_code} {r.text}"
    return s


def _make_png(w=2, h=2):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


BIZ_PROFILE_BODY = {
    "business_name": "Tiny's Test Cafe",
    "address": "1 Test Lane",
    "suburb": "Melbourne",
    "postcode": "3000",
    "phone": "0400000000",
    "website": "https://testcafe.example.com",
    "instagram": "tinytest",
    "hours": {d: {"open": "09:00", "close": "17:00"} for d in ("mon", "tue", "wed", "thu", "fri")},
    "about": "A lovely test cafe for regression runs.",
}


@pytest.fixture(scope="module")
def admin_s():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def biz_s():
    s = _login(*BUSINESS)
    r = s.put(f"{API}/business/profile", json=BIZ_PROFILE_BODY, timeout=20)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def member_s():
    return _login(*MEMBER)


# ---------- Hours editor backend behaviour ----------
class TestHoursEditor:
    def test_requires_at_least_one_open_day(self, biz_s):
        body = {**BIZ_PROFILE_BODY, "hours": {d: None for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}}
        r = biz_s.put(f"{API}/business/profile", json=body, timeout=20)
        assert r.status_code == 400
        assert "at least one day" in r.text.lower() or "open" in r.text.lower()

    def test_same_open_close_rejected(self, biz_s):
        body = {**BIZ_PROFILE_BODY, "hours": {"mon": {"open": "09:00", "close": "09:00"}}}
        r = biz_s.put(f"{API}/business/profile", json=body, timeout=20)
        assert r.status_code == 400

    def test_overnight_hours_allowed(self, biz_s):
        body = {**BIZ_PROFILE_BODY, "hours": {"fri": {"open": "18:00", "close": "02:00"}}}
        r = biz_s.put(f"{API}/business/profile", json=body, timeout=20)
        assert r.status_code == 200, r.text
        assert "Fri" in r.json().get("opening_hours", "")

    def test_bad_time_format_rejected(self, biz_s):
        body = {**BIZ_PROFILE_BODY, "hours": {"mon": {"open": "9am", "close": "5pm"}}}
        r = biz_s.put(f"{API}/business/profile", json=body, timeout=20)
        assert r.status_code == 422

    def test_hours_text_formats_range(self, biz_s):
        r = biz_s.put(f"{API}/business/profile", json=BIZ_PROFILE_BODY, timeout=20)
        assert r.status_code == 200
        text = r.json().get("opening_hours", "")
        # Mon-Fri 9am-5pm expected
        assert "Mon" in text and "Fri" in text
        assert "9am" in text and "5pm" in text


# ---------- Venue photo gallery ----------
class TestPhotos:
    def _reset_photos(self, biz_s):
        me = biz_s.get(f"{API}/auth/me", timeout=15).json()
        for p in me.get("photos") or []:
            path = p["path"] if isinstance(p, dict) else p
            biz_s.post(f"{API}/business/photos/remove", json={"path": path}, timeout=15)

    def test_upload_and_remove(self, biz_s):
        self._reset_photos(biz_s)
        r = biz_s.post(f"{API}/business/photos",
                       files={"file": ("p.png", _make_png(), "image/png")}, timeout=30)
        assert r.status_code == 200, r.text
        photos = r.json().get("photos") or []
        assert len(photos) == 1
        p0 = photos[0]
        assert p0["url"].startswith("/api/files/")
        # Publicly served
        img = requests.get(f"{BASE_URL}{p0['url']}", timeout=20)
        assert img.status_code == 200
        assert img.headers.get("content-type", "").startswith("image/")
        # Remove
        r2 = biz_s.post(f"{API}/business/photos/remove",
                        json={"path": p0["path"]}, timeout=15)
        assert r2.status_code == 200
        assert (r2.json().get("photos") or []) == []
        # Removed file -> 404
        assert requests.get(f"{BASE_URL}{p0['url']}", timeout=20).status_code == 404

    def test_max_six_photos(self, biz_s):
        self._reset_photos(biz_s)
        for _ in range(6):
            r = biz_s.post(f"{API}/business/photos",
                           files={"file": ("p.png", _make_png(), "image/png")}, timeout=30)
            assert r.status_code == 200, r.text
        # 7th should fail
        r7 = biz_s.post(f"{API}/business/photos",
                        files={"file": ("p.png", _make_png(), "image/png")}, timeout=30)
        assert r7.status_code == 400
        assert "6" in r7.text or "up to" in r7.text.lower()
        self._reset_photos(biz_s)

    def test_member_cannot_upload_photo(self, member_s):
        r = member_s.post(f"{API}/business/photos",
                          files={"file": ("p.png", _make_png(), "image/png")}, timeout=15)
        assert r.status_code == 403

    def test_non_image_rejected(self, biz_s):
        r = biz_s.post(f"{API}/business/photos",
                       files={"file": ("x.txt", b"hello", "text/plain")}, timeout=15)
        assert r.status_code == 400


# ---------- open_now badge on /api/deals ----------
class TestOpenNow:
    def test_deals_list_includes_open_now(self, biz_s, admin_s):
        # ensure profile with hours covering 24/7 so open_now=True
        body = {**BIZ_PROFILE_BODY, "hours": {d: {"open": "00:00", "close": "23:59"} for d in
                                               ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}}
        r = biz_s.put(f"{API}/business/profile", json=body, timeout=20)
        assert r.status_code == 200

        # submit a new deal and approve
        payload = {
            "title": f"TEST OpenNow {uuid.uuid4().hex[:6]}",
            "description": "Open now badge test",
            "category": "dining",
            "business_name": "Tiny's Test Cafe",
            "suburb": "Melbourne",
            "original_price": 20.0, "member_price": 10.0, "discount_label": "50% off",
        }
        rd = biz_s.post(f"{API}/business/deals", json=payload, timeout=20)
        assert rd.status_code == 200, rd.text
        deal_id = rd.json()["id"]
        admin_s.post(f"{API}/admin/deals/{deal_id}/status", json={"status": "approved"}, timeout=20)

        # Fetch list
        lst = requests.get(f"{API}/deals", timeout=15).json()
        mine = [d for d in lst if d["id"] == deal_id]
        assert mine, "approved deal not in /api/deals list"
        assert mine[0].get("open_now") is True, f"expected open_now True, got {mine[0].get('open_now')}"

        # Fetch single deal, partner block exposes open_now via partner too
        single = requests.get(f"{API}/deals/{deal_id}", timeout=15).json()
        assert single["partner"]["business_name"] == "Tiny's Test Cafe"
        # cleanup
        admin_s.delete(f"{API}/admin/deals/{deal_id}", timeout=15)

    def test_open_now_closed_hours(self, biz_s, admin_s):
        # Pick today's weekday in Melbourne and set a 1-minute window at 00:00-00:01
        from zoneinfo import ZoneInfo
        today_key = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][
            datetime.now(ZoneInfo("Australia/Melbourne")).weekday()
        ]
        body = {**BIZ_PROFILE_BODY, "hours": {today_key: {"open": "00:00", "close": "00:01"}}}
        rp = biz_s.put(f"{API}/business/profile", json=body, timeout=20)
        assert rp.status_code == 200, rp.text
        payload = {
            "title": f"TEST ClosedNow {uuid.uuid4().hex[:6]}",
            "description": "Closed deal for the open-now negative test case",
            "category": "dining",
            "business_name": "x", "suburb": "Melbourne",
            "original_price": 20.0, "member_price": 10.0, "discount_label": "50% off",
        }
        rd = biz_s.post(f"{API}/business/deals", json=payload, timeout=20)
        deal_id = rd.json()["id"]
        admin_s.post(f"{API}/admin/deals/{deal_id}/status", json={"status": "approved"}, timeout=20)
        lst = requests.get(f"{API}/deals", timeout=15).json()
        mine = [d for d in lst if d["id"] == deal_id]
        assert mine and mine[0].get("open_now") is False
        admin_s.delete(f"{API}/admin/deals/{deal_id}", timeout=15)
        # restore profile for other tests
        biz_s.put(f"{API}/business/profile", json=BIZ_PROFILE_BODY, timeout=20)


# ---------- Business submit uses own name (ignores sent business_name) ----------
class TestBusinessDealLockedName:
    def test_server_uses_partner_business_name(self, biz_s):
        biz_s.put(f"{API}/business/profile", json=BIZ_PROFILE_BODY, timeout=20)
        payload = {
            "title": f"TEST Lock {uuid.uuid4().hex[:6]}",
            "description": "Deal description long enough for validation",
            "category": "dining",
            "business_name": "SOMEONE ELSE",  # should be ignored
            "suburb": "",  # should default from profile suburb
            "original_price": 20.0, "member_price": 10.0, "discount_label": "50% off",
        }
        r = biz_s.post(f"{API}/business/deals", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["business_name"] == "Tiny's Test Cafe"
        assert d["suburb"] == "Melbourne"
        # cleanup via admin
        a = _login(*ADMIN)
        a.delete(f"{API}/admin/deals/{d['id']}", timeout=15)


# ---------- Admin deal requires partner_id ----------
class TestAdminDealPartner:
    def test_create_without_partner_fails(self, admin_s):
        payload = {
            "title": "TEST no-partner", "description": "no partner",
            "category": "dining", "business_name": "whatever", "suburb": "Melbourne",
            "original_price": 10.0, "member_price": 5.0, "discount_label": "x",
        }
        r = admin_s.post(f"{API}/admin/deals", json=payload, timeout=20)
        assert r.status_code == 400
        assert "business" in r.text.lower() or "partner" in r.text.lower()

    def test_create_with_partner_assigns_business(self, admin_s):
        # find approved business id
        users = admin_s.get(f"{API}/admin/users", params={"role": "business"}, timeout=20).json()
        approved = next((u for u in users if u.get("business_status") == "approved"), None)
        assert approved, "no approved business to assign"
        payload = {
            "title": f"TEST adm-assigned {uuid.uuid4().hex[:6]}",
            "description": "admin created",
            "category": "dining", "business_name": "ignored", "suburb": "",
            "original_price": 10.0, "member_price": 5.0, "discount_label": "50% off",
            "partner_id": approved["id"],
        }
        r = admin_s.post(f"{API}/admin/deals", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["business_name"] == (approved.get("business_name") or approved.get("name"))
        assert d["status"] == "approved"
        admin_s.delete(f"{API}/admin/deals/{d['id']}", timeout=15)

    def test_update_with_bad_partner_fails(self, admin_s):
        payload = {
            "title": "TEST bad-partner update",
            "description": "Description long enough for validation",
            "category": "dining", "business_name": "x", "suburb": "Melbourne",
            "original_price": 10.0, "member_price": 5.0, "discount_label": "x",
            "partner_id": "000000000000000000000000",
        }
        r = admin_s.post(f"{API}/admin/deals", json=payload, timeout=20)
        assert r.status_code == 400


# ---------- Admin members (add/update/activate/deactivate/password-link) ----------
class TestAdminMembers:
    created_ids = []

    def test_create_member_activate(self, admin_s):
        email = f"test_member_{uuid.uuid4().hex[:8]}@example.com"
        r = admin_s.post(f"{API}/admin/users", json={
            "role": "member", "name": "TEST Member", "email": email,
            "activate": True, "send_invite": False,
        }, timeout=20)
        assert r.status_code == 200, r.text
        u = r.json()
        self.created_ids.append(u["id"])
        assert u["role"] == "member"
        assert u["membership_status"] == "active"
        assert u.get("member_code")

    def test_patch_name_and_expiry(self, admin_s):
        assert self.created_ids, "need created member"
        uid = self.created_ids[0]
        future = (datetime.utcnow() + timedelta(days=200)).strftime("%Y-%m-%d")
        r = admin_s.patch(f"{API}/admin/users/{uid}", json={
            "name": "TEST Member Renamed", "expires_on": future
        }, timeout=20)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["name"] == "TEST Member Renamed"
        assert u["membership_status"] == "active"
        assert u["membership_expires_at"].startswith(future[:4])

    def test_deactivate(self, admin_s):
        uid = self.created_ids[0]
        r = admin_s.patch(f"{API}/admin/users/{uid}", json={"membership": "deactivate"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["membership_status"] in ("inactive", "expired")

    def test_activate_again(self, admin_s):
        uid = self.created_ids[0]
        r = admin_s.patch(f"{API}/admin/users/{uid}", json={"membership": "activate"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["membership_status"] == "active"

    def test_expiry_past_rejected(self, admin_s):
        uid = self.created_ids[0]
        r = admin_s.patch(f"{API}/admin/users/{uid}", json={"expires_on": "2000-01-01"}, timeout=20)
        assert r.status_code == 400

    def test_password_link(self, admin_s):
        uid = self.created_ids[0]
        r = admin_s.post(f"{API}/admin/users/{uid}/password-link", timeout=20)
        # 503 is acceptable when the shared email provider is rate limited
        assert r.status_code in (200, 503), r.text

    def test_resend_card(self, admin_s):
        uid = self.created_ids[0]
        r = admin_s.post(f"{API}/admin/users/{uid}/resend-card", timeout=20)
        assert r.status_code == 200

    def test_create_business_approved(self, admin_s):
        email = f"test_biz_{uuid.uuid4().hex[:8]}@example.com"
        r = admin_s.post(f"{API}/admin/users", json={
            "role": "business", "name": "TEST Biz Owner", "email": email,
            "business_name": "TEST Admin-Added Biz", "send_invite": False,
        }, timeout=20)
        assert r.status_code == 200, r.text
        u = r.json()
        self.created_ids.append(u["id"])
        assert u["role"] == "business"
        assert u["business_status"] == "approved"
        assert u["business_name"] == "TEST Admin-Added Biz"

    def test_duplicate_email_rejected(self, admin_s):
        r = admin_s.post(f"{API}/admin/users", json={
            "role": "member", "name": "dup", "email": MEMBER[0], "send_invite": False
        }, timeout=20)
        assert r.status_code == 400


# ---------- Admin payments & stats ----------
class TestAdminMisc:
    def test_payments_list(self, admin_s):
        r = admin_s.get(f"{API}/admin/payments", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stats_shape(self, admin_s):
        r = admin_s.get(f"{API}/admin/stats", timeout=20)
        assert r.status_code == 200
        s = r.json()
        for k in ("members", "active_members", "businesses", "pending_businesses",
                  "pending_deals", "live_deals", "vouchers", "redeemed", "revenue"):
            assert k in s

    def test_member_forbidden_on_admin(self, member_s):
        r = member_s.get(f"{API}/admin/stats", timeout=20)
        assert r.status_code == 403


# ---------- Bulk business approve ----------
class TestBulkBusinesses:
    def test_bulk_approve(self, admin_s):
        # Create a TEST pending biz by registering, then bulk-approve just that id
        email = f"test_pbiz_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!x", "name": "TEST Pending Bulk",
            "role": "business", "business_name": "TEST Pending Bulk Co"
        }, timeout=20)
        assert r.status_code == 200
        me = s.get(f"{API}/auth/me", timeout=15).json()
        uid = me["id"]
        r2 = admin_s.post(f"{API}/admin/businesses/bulk",
                          json={"ids": [uid], "status": "approved", "note": ""}, timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("updated") >= 1
