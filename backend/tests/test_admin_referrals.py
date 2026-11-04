"""Admin referrals overview: every member's code with signed-up / paid counts; owner only."""
import os
import uuid

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]


def login(email, password):
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": email, "password": password}).status_code == 200
    return s


def test_admin_referrals_overview():
    member = login("member@tinysvouchers.com.au", "Member!2026")
    code = member.get(f"{API}/me/referral").json()["code"]
    email = f"test_refadm_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"name": "TEST Friend", "email": email, "password": "Passw0rd!", "role": "member", "ref": code})
    assert r.status_code == 200, r.text
    try:
        admin = login("admin@tinysvouchers.com.au", "TinyAdmin!2026")
        data = admin.get(f"{API}/admin/referrals").json()
        rows = {m["email"]: m for m in data["members"]}
        assert data["cap"] == 12
        assert all(m["code"] for m in data["members"])
        me = rows["member@tinysvouchers.com.au"]
        assert me["code"] == code and me["signed_up"] >= 1
        assert rows[email]["referred_by"] == "Demo Member"
        assert member.get(f"{API}/admin/referrals").status_code == 403
    finally:
        DB.users.delete_one({"email": email})
