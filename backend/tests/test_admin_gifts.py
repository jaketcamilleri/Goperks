"""Admin gift codes: create (batch or emailed), list, cancel; redeem gives the chosen length."""
import os
from datetime import datetime, timezone

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


def test_admin_gift_codes():
    admin = login("admin@tinysvouchers.com.au", "TinyAdmin!2026")
    email = "test_gift_member@example.com"
    codes = []
    try:
        assert admin.post(f"{API}/admin/gifts", json={"months": 2}).status_code == 400
        assert admin.post(f"{API}/admin/gifts", json={"months": 3, "quantity": 2, "recipient_name": "A", "recipient_email": "a@example.com"}).status_code == 400
        r = admin.post(f"{API}/admin/gifts", json={"months": 3, "quantity": 3, "note": "TEST batch"})
        assert r.status_code == 200, r.text
        codes = r.json()["codes"]
        assert len(codes) == 3 and len(set(codes)) == 3

        rows = {g["code"]: g for g in admin.get(f"{API}/admin/gifts").json()}
        assert rows[codes[0]]["months"] == 3 and rows[codes[0]]["source"] == "admin" and rows[codes[0]]["status"] == "unredeemed"
        info = requests.get(f"{API}/gifts/{codes[0]}").json()
        assert info["months"] == 3 and info["from_name"] == "Go Perks"

        # Member-only access
        member = login("member@tinysvouchers.com.au", "Member!2026")
        assert member.get(f"{API}/admin/gifts").status_code == 403

        # Redeem gives ~90 days to a new account
        s = requests.Session()
        assert s.post(f"{API}/auth/register", json={"name": "TEST Gift", "email": email, "password": "Passw0rd!", "role": "member"}).status_code == 200
        assert s.post(f"{API}/gifts/redeem", json={"code": codes[0]}).status_code == 200
        exp = datetime.fromisoformat(DB.users.find_one({"email": email})["membership_expires_at"])
        assert 88 <= (exp - datetime.now(timezone.utc)).days <= 90
        assert s.post(f"{API}/gifts/redeem", json={"code": codes[0]}).status_code == 400

        # Cancel an unused one; it can't be redeemed after
        assert admin.post(f"{API}/admin/gifts/{codes[1]}/cancel").status_code == 200
        assert admin.post(f"{API}/admin/gifts/{codes[1]}/cancel").status_code == 400
        assert s.post(f"{API}/gifts/redeem", json={"code": codes[1]}).status_code == 400
        assert requests.get(f"{API}/gifts/{codes[1]}").json()["status"] == "cancelled"
    finally:
        DB.gifts.delete_many({"code": {"$in": codes}})
        DB.users.delete_one({"email": email})
