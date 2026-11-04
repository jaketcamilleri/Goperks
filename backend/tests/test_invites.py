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

    def test_drafts_skip_dedupe_and_mark_sent(self):
        admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
        email = f"test_inv_{uuid.uuid4().hex[:8]}@example.com"
        r = admin.post(f"{API}/admin/invites", json={"people": [
            {"email": email, "name": "Test Person"}, {"email": email.upper()},
            {"email": "member@tinysvouchers.com.au"}, {"email": "nope"}], "note": "Hi from the team"}).json()
        [d] = r["drafts"]
        assert d["to"] == email and "Hi Test," in d["body"] and "Hi from the team" in d["body"] and "/join" in d["body"]
        assert sorted(s["reason"] for s in r["skipped"]) == ["already has an account", "is listed twice", "isn't a valid email"]
        # Nothing recorded until the owner sends it from their own email
        assert all(x["email"] != email for x in admin.get(f"{API}/admin/invites").json())
        assert admin.post(f"{API}/admin/invites/sent", json={"email": email, "name": "Test Person", "note": "Hi from the team"}).status_code == 200
        row = next(x for x in admin.get(f"{API}/admin/invites").json() if x["email"] == email)
        assert row["name"] == "Test Person" and row["status"] == "sent" and row["joined"] is False
        again = admin.post(f"{API}/admin/invites", json={"people": [{"email": email}]}).json()
        assert again["drafts"] == [] and again["skipped"][0]["reason"] == "was already invited"
        from pymongo import MongoClient
        MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]].invites.delete_one({"email": email})

    def test_unsubscribe_blocks_future_invites(self):
        from core import make_token
        email = f"test_unsub_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/invites/unsubscribe", json={"token": make_token(email, "unsubscribe", timedelta(days=1))})
        assert r.status_code == 200 and r.json()["email"] == email
        assert requests.post(f"{API}/invites/unsubscribe", json={"token": make_token(email, "access", timedelta(days=1))}).status_code == 400
        assert requests.post(f"{API}/invites/unsubscribe", json={"token": "not-a-real-token"}).status_code == 400
        admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
        res = admin.post(f"{API}/admin/invites", json={"people": [{"email": email}]}).json()
        assert res["drafts"] == [] and res["skipped"][0]["reason"] == "asked not to be contacted"



def test_invite_follow_up():
    from pymongo import MongoClient
    db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
    admin = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
    email = f"test_fu_{uuid.uuid4().hex[:8]}@example.com"
    try:
        assert admin.post(f"{API}/admin/invites/sent", json={"email": email, "name": "Fran Test"}).status_code == 200
        before = admin.get(f"{API}/admin/invites/followup").json()["count"]
        assert before >= 1
        assert admin.post(f"{API}/admin/invites/followup", json={"template": "invite"}).status_code == 400
        r = admin.post(f"{API}/admin/invites/followup", json={"note": "TEST nudge"}).json()
        d = next(x for x in r["drafts"] if x["to"] == email)
        assert "Hi Fran," in d["body"] and "following up" in d["body"] and "TEST nudge" in d["body"] and "/join" in d["body"]
        assert admin.post(f"{API}/admin/invites/followup-sent", json={"email": email}).status_code == 200
        assert admin.get(f"{API}/admin/invites/followup").json()["count"] == before - 1
        assert all(x["to"] != email for x in admin.post(f"{API}/admin/invites/followup", json={}).json()["drafts"])
        row = next(x for x in admin.get(f"{API}/admin/invites").json() if x["email"] == email)
        assert row["followed_up_at"]
    finally:
        db.invites.delete_one({"email": email})
