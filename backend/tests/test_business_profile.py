"""Tests for the new business profile / logo / require_partner profile gate."""
import io
import os
import struct
import uuid
import zlib
from datetime import datetime, timedelta, timezone

import jwt
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
JWT_SECRET = "b7f3c1e9a24d58f06e3b9c71d2a4f8e05c6b13d9e7a2f4c80b5d1e3a9c7f2b64"


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


@pytest.fixture(scope="module")
def admin_s():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def member_s():
    return _login(*MEMBER)


@pytest.fixture(scope="module")
def biz_s():
    return _login(*BUSINESS)


# ---------- Locked portal when profile incomplete ----------
class TestProfileGate:
    def test_me_has_profile_complete_field(self, biz_s):
        me = biz_s.get(f"{API}/auth/me", timeout=15).json()
        assert me["role"] == "business"
        assert me.get("business_status") == "approved"
        assert "profile_complete" in me

    def test_partner_endpoints_blocked_when_incomplete(self, biz_s):
        me = biz_s.get(f"{API}/auth/me", timeout=15).json()
        if me.get("profile_complete"):
            pytest.skip("Seed business profile already completed; cannot test gate")
        for path, kwargs in [
            (f"{API}/business/stats", {}),
            (f"{API}/business/deals", {}),
        ]:
            r = biz_s.get(path, timeout=15, **kwargs)
            assert r.status_code == 403, f"{path} -> {r.status_code}"
            assert "profile" in r.text.lower()
        r = biz_s.post(f"{API}/partner/check", json={"code": "ABCD1234"}, timeout=15)
        assert r.status_code == 403

    def test_member_cannot_put_profile(self, member_s):
        r = member_s.put(f"{API}/business/profile", json={
            "business_name": "x", "address": "1 Street", "suburb": "xx",
            "phone": "123456", "hours": {"mon": {"open": "09:00", "close": "17:00"}},
            "about": "1234567890"
        }, timeout=15)
        assert r.status_code == 403


# ---------- Complete profile and unlock ----------
class TestCompleteProfile:
    def test_put_profile_and_unlock(self, biz_s):
        body = {
            "business_name": "Tiny's Test Cafe",
            "address": "1 Test Lane",
            "suburb": "Melbourne",
            "phone": "0400000000",
            "website": "testcafe.example.com",
            "instagram": "@tinytest",
            "hours": {d: {"open": "09:00", "close": "17:00"} for d in ("mon", "tue", "wed", "thu", "fri")},
            "about": "A lovely test cafe for regression runs."
        }
        r = biz_s.put(f"{API}/business/profile", json=body, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("profile_complete") is True
        assert data.get("website", "").startswith("https://")
        assert data.get("instagram") == "tinytest"
        # Now partner endpoints work
        assert biz_s.get(f"{API}/business/stats", timeout=15).status_code == 200
        assert biz_s.get(f"{API}/business/deals", timeout=15).status_code == 200

    def test_short_about_rejected(self, biz_s):
        r = biz_s.put(f"{API}/business/profile", json={
            "business_name": "x", "address": "1", "suburb": "y",
            "phone": "1", "hours": {"mon": {"open": "09:00", "close": "17:00"}}, "about": "short"
        }, timeout=15)
        assert r.status_code == 422


# ---------- Logo upload ----------
class TestLogo:
    def test_upload_logo_png(self, biz_s):
        png = _make_png()
        r = biz_s.post(f"{API}/business/logo",
                       files={"file": ("logo.png", png, "image/png")}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("logo_url", "").startswith("/api/files/")
        # publicly served
        img = requests.get(f"{BASE_URL}{data['logo_url']}", timeout=20)
        assert img.status_code == 200
        assert img.headers.get("content-type", "").startswith("image/")
        assert len(img.content) > 50

    def test_upload_non_image_rejected(self, biz_s):
        r = biz_s.post(f"{API}/business/logo",
                       files={"file": ("x.txt", b"hello", "text/plain")}, timeout=15)
        assert r.status_code == 400

    def test_member_cannot_upload_logo(self, member_s):
        r = member_s.post(f"{API}/business/logo",
                          files={"file": ("x.png", _make_png(), "image/png")}, timeout=15)
        assert r.status_code == 403


# ---------- Pending business cannot edit profile ----------
class TestPendingBusiness:
    def test_pending_blocked_from_profile_put(self):
        email = f"test_pbiz_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!x", "name": "TEST Pending",
            "role": "business", "business_name": "TEST Pending Co"
        }, timeout=20)
        assert r.status_code == 200
        assert r.json()["business_status"] == "pending"
        # profile_complete should be false
        assert r.json().get("profile_complete") is False
        r2 = s.put(f"{API}/business/profile", json={
            "business_name": "x", "address": "1", "suburb": "x",
            "phone": "1", "hours": {"mon": {"open": "09:00", "close": "17:00"}}, "about": "1234567890"
        }, timeout=15)
        assert r2.status_code == 403


# ---------- Partner card on approved deal ----------
class TestPartnerCardOnDeal:
    def test_submit_deal_approve_shows_partner(self, biz_s, admin_s):
        # Ensure profile complete (previous test class did it, but safe re-apply)
        biz_s.put(f"{API}/business/profile", json={
            "business_name": "Tiny's Test Cafe",
            "address": "1 Test Lane",
            "suburb": "Melbourne",
            "phone": "0400000000",
            "website": "https://testcafe.example.com",
            "instagram": "tinytest",
            "hours": {d: {"open": "09:00", "close": "17:00"} for d in ("mon", "tue", "wed", "thu", "fri")},
            "about": "A lovely test cafe for regression runs."
        }, timeout=20)
        payload = {
            "title": f"TEST Deal {uuid.uuid4().hex[:6]}",
            "description": "Partner card check deal",
            "category": "dining",
            "business_name": "Tiny's Test Cafe",
            "suburb": "Melbourne",
            "original_price": 20.0,
            "member_price": 10.0,
            "discount_label": "50% off",
        }
        r = biz_s.post(f"{API}/business/deals", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        deal_id = r.json()["id"]
        # Admin approve
        ra = admin_s.post(f"{API}/admin/deals/{deal_id}/status",
                          json={"status": "approved"}, timeout=20)
        if ra.status_code == 404:
            ra = admin_s.patch(f"{API}/admin/deals/{deal_id}",
                               json={"status": "approved"}, timeout=20)
        assert ra.status_code in (200, 204), f"approve -> {ra.status_code} {ra.text}"
        # Fetch deal, expect partner block
        rd = requests.get(f"{API}/deals/{deal_id}", timeout=15)
        assert rd.status_code == 200, rd.text
        d = rd.json()
        assert "partner" in d
        p = d["partner"]
        assert p["business_name"] == "Tiny's Test Cafe"
        assert p["address"] == "1 Test Lane"
        assert p["suburb"] == "Melbourne"
        assert p["about"].startswith("A lovely")
        assert p.get("logo_url", "").startswith("/api/files/") or p.get("logo_url") is None
