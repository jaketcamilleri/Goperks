"""Activity log + monthly partner report cron."""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
CRON = {"Authorization": f"Bearer {ENV['WEBHOOK_CRON_SECRET']}"}


def login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def admin():
    return login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])


class TestActivityLog:
    def test_deal_actions_are_logged(self, admin):
        biz = next(u for u in admin.get(f"{API}/admin/users", params={"role": "business"}).json() if u.get("business_status") == "approved")
        title = f"TEST_ log {uuid.uuid4().hex[:6]}"
        body = {"title": title, "partner_id": biz["id"], "category": "cafes", "discount_label": "10% off", "description": "Activity log test"}
        d = admin.post(f"{API}/admin/deals", json=body).json()
        admin.put(f"{API}/admin/deals/{d['id']}", json={**body, "discount_label": "15% off"})
        admin.post(f"{API}/admin/deals/{d['id']}/status", json={"status": "rejected", "note": "too vague"})
        admin.delete(f"{API}/admin/deals/{d['id']}")
        rows = [r for r in admin.get(f"{API}/admin/activity").json() if r["target_id"] == d["id"]]
        actions = [r["action"] for r in rows]
        assert actions == ["deal.deleted", "deal.rejected", "deal.edited", "deal.created"]
        assert all(r["actor_email"].lower() == ENV["ADMIN_EMAIL"].lower() for r in rows)
        assert "offer" in rows[2]["details"] and "too vague" in rows[1]["details"]

    def test_activity_is_owner_only(self):
        member = login("member@tinysvouchers.com.au", "Member!2026")
        assert member.get(f"{API}/admin/activity").status_code == 403
        assert requests.get(f"{API}/admin/activity").status_code == 401


class TestPartnerReportCron:
    def test_requires_secret(self):
        assert requests.post(f"{API}/cron/partner-reports").status_code == 401
        assert requests.post(f"{API}/cron/partner-reports", headers={"Authorization": "Bearer nope"}).status_code == 401

    def test_skips_unless_first_or_forced_and_dedupes(self):
        run = f"test-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/cron/partner-reports", headers=CRON, json={"run_id": run})
        assert r.status_code == 200 and r.json()["status"] in ("skipped", "accepted")
        r1 = requests.post(f"{API}/cron/partner-reports", params={"force": "true"}, headers={**CRON, "X-Webhook-Id": run + "f"}, json={})
        r2 = requests.post(f"{API}/cron/partner-reports", params={"force": "true"}, headers={**CRON, "X-Webhook-Id": run + "f"}, json={})
        assert r1.json()["status"] == "accepted" and r2.json()["status"] == "duplicate"

    def test_bad_body_rejected(self):
        r = requests.post(f"{API}/cron/partner-reports", params={"force": "true"}, headers={**CRON, "Content-Type": "application/json"}, data="[1,2]")
        assert r.status_code == 400
