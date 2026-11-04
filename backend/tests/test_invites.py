"""Member invites + unsubscribe."""
import os
import sys
import uuid
from datetime import timedelta

import requests
from dotenv import dotenv_values

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


def login(email, password):
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": email, "password": password}).status_code == 200
    return s


class TestInvites:
    def test_owner_only(self):
        assert requests.get(f"{API}/admin/invites").status_code == 401
        member = login("member@tinysvouchers.com.au", "Member!2026")
        assert member.get(f"{API}/admin/invites").status_code == 403
        assert member.post(f"{API}/admin/invites", json={"people": [{"email": "x@example.com"}]}).status_code == 403

    def test_send_skips_and_dedupes(self):
        admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
        email = f"test_inv_{uuid.uuid4().hex[:8]}@example.com"
        r = admin.post(f"{API}/admin/invites", json={"people": [
            {"email": email, "name": "Test Person"}, {"email": email.upper()},
            {"email": "member@tinysvouchers.com.au"}, {"email": "nope"}], "note": "Hi from the team"}).json()
        assert r["queued"] == 1
        assert sorted(s["reason"] for s in r["skipped"]) == ["already has an account", "is listed twice", "isn't a valid email"]
        row = next(x for x in admin.get(f"{API}/admin/invites").json() if x["email"] == email)
        assert row["name"] == "Test Person" and row["note"] == "Hi from the team" and row["joined"] is False
        again = admin.post(f"{API}/admin/invites", json={"people": [{"email": email}]}).json()
        # A first send the email service rejected is allowed to be re-sent; otherwise it's skipped as a repeat.
        assert again["queued"] == 1 or again["skipped"][0]["reason"] == "was already invited"

    def test_unsubscribe_blocks_future_invites(self):
        from core import make_token
        email = f"test_unsub_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/invites/unsubscribe", json={"token": make_token(email, "unsubscribe", timedelta(days=1))})
        assert r.status_code == 200 and r.json()["email"] == email
        assert requests.post(f"{API}/invites/unsubscribe", json={"token": make_token(email, "access", timedelta(days=1))}).status_code == 400
        assert requests.post(f"{API}/invites/unsubscribe", json={"token": "not-a-real-token"}).status_code == 400
        admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
        res = admin.post(f"{API}/admin/invites", json={"people": [{"email": email}]}).json()
        assert res["queued"] == 0 and res["skipped"][0]["reason"] == "unsubscribed"
