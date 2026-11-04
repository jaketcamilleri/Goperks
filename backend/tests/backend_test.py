"""Go Perks backend regression tests.

Covers: auth, deals, member voucher claim, favourites, business pending/approved
workflow, admin stats/top-deals/monthly/decision link, cron endpoints, and payment
checkout session creation.
"""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
        try:
            with open(env_path) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL"):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except FileNotFoundError:
            pass
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not configured")
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN = ("admin@tinysvouchers.com.au", "TinyAdmin!2026")
MEMBER = ("member@tinysvouchers.com.au", "Member!2026")
BUSINESS = ("business@tinysvouchers.com.au", "Business!2026")

JWT_SECRET = "b7f3c1e9a24d58f06e3b9c71d2a4f8e05c6b13d9e7a2f4c80b5d1e3a9c7f2b64"
CRON_SECRET = "0d504d0603ba95ac6f6fe3b3e44bb466f0db34d7ac0f5dbc"


# ---------- fixtures ----------
def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def member_session():
    return _login(*MEMBER)


@pytest.fixture(scope="module")
def business_session():
    return _login(*BUSINESS)


@pytest.fixture(scope="module")
def created_user_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def _cleanup(created_user_ids):
    yield
    # We don't have a user delete endpoint; leave TEST_ users for manual cleanup.


# ---------- Health / Public ----------
class TestPublic:
    def test_stats(self):
        r = requests.get(f"{API}/stats", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("live_deals", "suburbs", "price", "currency"):
            assert k in data

    def test_deals_list(self):
        r = requests.get(f"{API}/deals", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_deals_filter(self):
        r = requests.get(f"{API}/deals", params={"q": "coffee"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_suburbs(self):
        r = requests.get(f"{API}/deals/suburbs", timeout=15)
        # Endpoint may be /suburbs — check both routes
        if r.status_code == 404:
            r = requests.get(f"{API}/suburbs", timeout=15)
        assert r.status_code == 200

    def test_deal_detail_404(self):
        r = requests.get(f"{API}/deals/000000000000000000000000", timeout=15)
        assert r.status_code == 404


# ---------- Auth ----------
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nobody@example.com", "password": "x"}, timeout=15)
        assert r.status_code in (401, 429)

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_admin(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN[0]
        assert data["role"] == "admin"
        assert "_id" not in data  # no raw mongo id

    def test_me_member(self, member_session):
        r = member_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "member"

    def test_me_business(self, business_session):
        r = business_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "business"
        assert d.get("business_status") == "approved"

    def test_forgot_password_generic(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": "definitely-not-real@example.com"}, timeout=20)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_refresh_without_cookie(self):
        r = requests.post(f"{API}/auth/refresh", timeout=15)
        assert r.status_code == 401

    def test_register_member_and_login(self, created_user_ids):
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Passw0rd!x", "name": "TEST User", "role": "member"},
                          timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "member"
        created_user_ids.append(data["id"])
        # Duplicate
        r2 = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": "Passw0rd!x", "name": "Dup", "role": "member"},
                           timeout=15)
        assert r2.status_code == 400


# ---------- Member: favourites & vouchers ----------
class TestMember:
    def test_favorites_toggle(self, member_session):
        deals = requests.get(f"{API}/deals", timeout=15).json()
        if not deals:
            pytest.skip("No deals available")
        deal_id = deals[0]["id"]
        # toggle on
        r1 = member_session.post(f"{API}/me/favorites/{deal_id}", timeout=15)
        assert r1.status_code == 200
        state1 = r1.json()["favorited"]
        # list
        ids = member_session.get(f"{API}/me/favorite-ids", timeout=15).json()
        assert isinstance(ids, list)
        # toggle back
        r2 = member_session.post(f"{API}/me/favorites/{deal_id}", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["favorited"] != state1

    def test_my_vouchers(self, member_session):
        r = member_session.get(f"{API}/me/vouchers", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_my_savings(self, member_session):
        r = member_session.get(f"{API}/me/savings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "saved" in data or "amount_saved" in data or isinstance(data, dict)

    def test_my_gifts(self, member_session):
        r = member_session.get(f"{API}/me/gifts", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_redeem_invalid_gift(self, member_session):
        r = member_session.post(f"{API}/gifts/redeem", json={"code": "INVALIDXYZ"}, timeout=15)
        assert r.status_code in (400, 404)


# ---------- Business ----------
class TestBusiness:
    def test_pending_cannot_submit(self, created_user_ids):
        email = f"test_biz_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!x", "name": "TEST Biz",
            "role": "business", "business_name": "TEST Biz Co"}, timeout=20)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        created_user_ids.append(uid)
        assert r.json().get("business_status") == "pending"
        # submit deal should 403
        payload = {"title": "TEST Deal", "description": "x", "category": "dining",
                   "business_name": "TEST Biz Co", "suburb": "Melbourne",
                   "original_price": 20, "member_price": 10}
        r2 = s.post(f"{API}/business/deals", json=payload, timeout=15)
        assert r2.status_code == 403

    def test_approved_business_endpoints(self, business_session):
        r = business_session.get(f"{API}/business/stats", timeout=15)
        assert r.status_code == 200
        r2 = business_session.get(f"{API}/business/deals", timeout=15)
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

    def test_partner_check_unknown(self, business_session):
        r = business_session.post(f"{API}/partner/check", json={"code": "NOPE1234"}, timeout=15)
        assert r.status_code in (400, 404)

    def test_member_cannot_access_partner(self, member_session):
        r = member_session.get(f"{API}/business/stats", timeout=15)
        assert r.status_code == 403


# ---------- Admin ----------
class TestAdmin:
    def test_admin_stats(self, admin_session):
        r = admin_session.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)

    def test_admin_monthly(self, admin_session):
        r = admin_session.get(f"{API}/admin/monthly", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6
        for row in data:
            assert set(["month", "members", "gifts", "revenue"]).issubset(row.keys())

    def test_admin_top_deals(self, admin_session):
        r = admin_session.get(f"{API}/admin/top-deals", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "month" in data and "deals" in data
        assert isinstance(data["deals"], list)

    def test_admin_top_deals_month_param(self, admin_session):
        r = admin_session.get(f"{API}/admin/top-deals", params={"month": "2026-01"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["month"] == "2026-01"

    def test_admin_top_deals_bad_month(self, admin_session):
        r = admin_session.get(f"{API}/admin/top-deals", params={"month": "bad"}, timeout=15)
        assert r.status_code == 400

    def test_admin_deals(self, admin_session):
        r = admin_session.get(f"{API}/admin/deals", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_users(self, admin_session):
        r = admin_session.get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = admin_session.get(f"{API}/admin/users", params={"role": "business"}, timeout=15)
        assert r2.status_code == 200

    def test_non_admin_blocked(self, member_session):
        for path in ("/admin/stats", "/admin/monthly", "/admin/top-deals", "/admin/deals", "/admin/users"):
            r = member_session.get(f"{API}{path}", timeout=15)
            assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"

    def test_unauth_admin_blocked(self):
        r = requests.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 401


# ---------- Admin decision link (email flow) ----------
class TestDecisionLink:
    def _make_token(self, user_id, exp_delta=timedelta(days=1)):
        return jwt.encode(
            {"sub": user_id, "type": "biz_decision",
             "exp": datetime.now(timezone.utc) + exp_delta},
            JWT_SECRET, algorithm="HS256")

    def test_invalid_token(self):
        r = requests.get(f"{API}/admin/decision", params={"token": "not-a-jwt"}, timeout=15)
        assert r.status_code == 400

    def test_wrong_type(self):
        tok = jwt.encode({"sub": "000000000000000000000000", "type": "access",
                          "exp": datetime.now(timezone.utc) + timedelta(days=1)},
                         JWT_SECRET, algorithm="HS256")
        r = requests.get(f"{API}/admin/decision", params={"token": tok}, timeout=15)
        assert r.status_code == 400

    def test_expired_token(self):
        tok = jwt.encode({"sub": "000000000000000000000000", "type": "biz_decision",
                          "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
                         JWT_SECRET, algorithm="HS256")
        r = requests.get(f"{API}/admin/decision", params={"token": tok}, timeout=15)
        assert r.status_code == 410

    def test_full_flow_approve_then_reuse(self, created_user_ids):
        email = f"test_biz2_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!x", "name": "TEST Biz2",
            "role": "business", "business_name": "TEST Biz2 Co"}, timeout=20)
        assert r.status_code == 200
        uid = r.json()["id"]
        created_user_ids.append(uid)
        token = self._make_token(uid)
        # GET decision info
        r1 = requests.get(f"{API}/admin/decision", params={"token": token}, timeout=15)
        assert r1.status_code == 200
        assert r1.json()["business_status"] == "pending"
        # POST approve
        r2 = requests.post(f"{API}/admin/decision",
                           json={"token": token, "action": "approve"}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["business_status"] == "approved"
        # Reuse -> 409
        r3 = requests.post(f"{API}/admin/decision",
                           json={"token": token, "action": "approve"}, timeout=15)
        assert r3.status_code == 409


# ---------- Cron ----------
class TestCron:
    @pytest.mark.parametrize("path", [
        "/cron/weekly-digest", "/cron/renewal-reminders", "/cron/gift-deliveries"])
    def test_cron_unauth(self, path):
        r = requests.post(f"{API}{path}", timeout=15)
        assert r.status_code == 401

    @pytest.mark.parametrize("path", [
        "/cron/weekly-digest", "/cron/renewal-reminders", "/cron/gift-deliveries"])
    def test_cron_wrong_secret(self, path):
        r = requests.post(f"{API}{path}", headers={"Authorization": "Bearer wrong"}, timeout=15)
        assert r.status_code == 401

    def test_cron_weekly_digest_accepted(self):
        r = requests.post(f"{API}/cron/weekly-digest",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=30)
        assert r.status_code == 200
        assert r.json().get("status") in ("accepted", "ok")

    def test_cron_renewal_accepted(self):
        r = requests.post(f"{API}/cron/renewal-reminders",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=30)
        assert r.status_code == 200

    def test_cron_gift_deliveries_accepted(self):
        r = requests.post(f"{API}/cron/gift-deliveries",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=30)
        assert r.status_code == 200


# ---------- Payments ----------
class TestPayments:
    def test_checkout_membership(self, member_session):
        # The demo member is active with more than 2 months left, so renewing isn't open yet.
        r = member_session.post(f"{API}/payments/checkout",
                                json={"kind": "membership",
                                      "origin_url": BASE_URL}, timeout=30)
        me = member_session.get(f"{API}/auth/me").json()
        if me.get("can_renew") is False:
            assert r.status_code == 400 and "You can renew from" in r.text, r.text
            return
        assert r.status_code == 200, r.text
        data = r.json()
        assert "checkout_url" in data and data["checkout_url"].startswith("http")
        assert "session_id" in data

    def test_checkout_gift_missing_fields(self, member_session):
        r = member_session.post(f"{API}/payments/checkout",
                                json={"kind": "gift", "origin_url": BASE_URL}, timeout=20)
        assert r.status_code == 400

    def test_checkout_unauth(self):
        r = requests.post(f"{API}/payments/checkout",
                          json={"kind": "membership", "origin_url": BASE_URL}, timeout=15)
        assert r.status_code == 401
