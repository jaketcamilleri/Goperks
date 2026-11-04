"""Tests for Team/Staff feature: admin can create/remove staff, staff has limited access."""
import os
import uuid
import pytest
import requests

def _backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    return url.rstrip("/")

BASE_URL = _backend_url()
API = f"{BASE_URL}/api"
ADMIN = ("admin@tinysvouchers.com.au", "TinyAdmin!2026")
MEMBER = ("member@tinysvouchers.com.au", "Member!2026")
STAFF_PASS = "Staff!2026"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def staff_user(admin_session):
    """Create a TEST_ staff user via admin, cleanup after."""
    email = f"test_staff_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "role": "staff",
        "name": "TEST Staff",
        "email": email,
        "password": STAFF_PASS,
        "send_invite": False,
    }
    r = admin_session.post(f"{API}/admin/users", json=payload, timeout=20)
    assert r.status_code == 200, f"create staff failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["role"] == "staff"
    assert data["email"] == email
    yield {"id": data["id"], "email": email, "password": STAFF_PASS}
    try:
        admin_session.delete(f"{API}/admin/team/{data['id']}", timeout=10)
    except Exception:
        pass


@pytest.fixture(scope="module")
def staff_session(staff_user):
    return _login(staff_user["email"], staff_user["password"])


class TestStaffCreation:
    def test_staff_created_and_appears_in_team_list(self, admin_session, staff_user):
        r = admin_session.get(f"{API}/admin/users", params={"role": "team"}, timeout=15)
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()]
        assert staff_user["email"] in emails
        # team list should include both admin and staff roles
        roles = {u["role"] for u in r.json()}
        assert "admin" in roles
        assert "staff" in roles

    def test_member_cannot_create_staff(self):
        s = _login(*MEMBER)
        r = s.post(f"{API}/admin/users", json={"role": "staff", "name": "X", "email": "x@x.com"}, timeout=15)
        assert r.status_code == 403


class TestStaffAccessDenied:
    """Staff should get 403 on owner-only endpoints."""

    def test_staff_cannot_list_members(self, staff_session):
        r = staff_session.get(f"{API}/admin/users", params={"role": "member"}, timeout=15)
        assert r.status_code == 403

    def test_staff_cannot_view_payments(self, staff_session):
        r = staff_session.get(f"{API}/admin/payments", timeout=15)
        assert r.status_code == 403

    def test_staff_cannot_view_monthly(self, staff_session):
        r = staff_session.get(f"{API}/admin/monthly", timeout=15)
        assert r.status_code == 403

    def test_staff_cannot_create_user(self, staff_session):
        r = staff_session.post(f"{API}/admin/users", json={"role": "member", "name": "X", "email": f"test_x_{uuid.uuid4().hex[:6]}@example.com"}, timeout=15)
        assert r.status_code == 403

    def test_staff_cannot_patch_user(self, staff_session, admin_session):
        # Need some user id; grab a business
        bs = admin_session.get(f"{API}/admin/users", params={"role": "business"}, timeout=15).json()
        assert bs, "need at least one business user for this test"
        uid = bs[0]["id"]
        r = staff_session.patch(f"{API}/admin/users/{uid}", json={"name": "Nope"}, timeout=15)
        assert r.status_code == 403

    def test_staff_cannot_bulk_delete_deals(self, staff_session, admin_session):
        # grab any deal id
        deals = admin_session.get(f"{API}/admin/deals", timeout=15).json()
        if not deals:
            pytest.skip("no deals")
        r = staff_session.post(f"{API}/admin/deals/bulk", json={"ids": [deals[0]["id"]], "status": "deleted"}, timeout=15)
        assert r.status_code == 403

    def test_staff_cannot_remove_staff(self, staff_session, staff_user):
        r = staff_session.delete(f"{API}/admin/team/{staff_user['id']}", timeout=15)
        assert r.status_code == 403


class TestStaffAllowedAccess:
    def test_staff_stats_no_revenue(self, staff_session):
        r = staff_session.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("revenue", "members", "active_members", "gifts_sold"):
            assert k not in data, f"staff stats should not expose {k}"
        assert "live_deals" in data
        assert "pending_deals" in data

    def test_staff_list_deals(self, staff_session):
        r = staff_session.get(f"{API}/admin/deals", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_staff_list_businesses(self, staff_session):
        r = staff_session.get(f"{API}/admin/users", params={"role": "business"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_staff_top_deals(self, staff_session):
        r = staff_session.get(f"{API}/admin/top-deals", timeout=15)
        assert r.status_code == 200

    def test_staff_can_change_deal_status(self, staff_session, admin_session):
        # create a TEST_ deal via admin to toggle
        # find a business
        bs = admin_session.get(f"{API}/admin/users", params={"role": "business"}, timeout=15).json()
        biz = next((b for b in bs if b.get("business_status") == "approved"), None)
        if not biz:
            pytest.skip("no approved business")
        payload = {
            "title": f"TEST_ staff toggle {uuid.uuid4().hex[:6]}",
            "description": "TEST staff toggle deal for status changes",
            "discount_label": "10% off",
            "category": "cafes",
            "suburb": "Melbourne",
            "partner_id": biz["id"],
        }
        r = admin_session.post(f"{API}/admin/deals", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        deal_id = r.json()["id"]
        try:
            r2 = staff_session.post(f"{API}/admin/deals/{deal_id}/status", json={"status": "approved"}, timeout=15)
            assert r2.status_code == 200
            # bulk reject also allowed
            r3 = staff_session.post(f"{API}/admin/deals/bulk", json={"ids": [deal_id], "status": "rejected"}, timeout=15)
            assert r3.status_code == 200
        finally:
            admin_session.post(f"{API}/admin/deals/bulk", json={"ids": [deal_id], "status": "deleted"}, timeout=15)


class TestRemoveStaff:
    def test_remove_staff_revokes_access(self, admin_session):
        # create a dedicated staff for removal
        email = f"test_staff_rm_{uuid.uuid4().hex[:8]}@example.com"
        r = admin_session.post(f"{API}/admin/users", json={
            "role": "staff", "name": "TEST RmStaff", "email": email, "password": STAFF_PASS, "send_invite": False
        }, timeout=20)
        assert r.status_code == 200
        uid = r.json()["id"]
        s = _login(email, STAFF_PASS)
        # confirms working
        assert s.get(f"{API}/admin/stats", timeout=15).status_code == 200
        # remove
        rd = admin_session.delete(f"{API}/admin/team/{uid}", timeout=15)
        assert rd.status_code == 200
        # Old session may still have a valid JWT until expiry, but /auth/me on removed user should 401
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code in (401, 403), f"expected removed staff session to fail, got {me.status_code}"

    def test_remove_nonexistent_staff(self, admin_session):
        r = admin_session.delete(f"{API}/admin/team/507f1f77bcf86cd799439011", timeout=15)
        assert r.status_code == 404
