"""Members with free months saved from referrals see it on their account and in the renewal reminder."""
import os
import sys

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]


def test_bonus_months_on_account():
    DB.users.update_one({"email": "member@tinysvouchers.com.au"}, {"$set": {"bonus_days_pending": 60}})
    try:
        s = requests.Session()
        assert s.post(f"{API}/auth/login", json={"email": "member@tinysvouchers.com.au", "password": "Member!2026"}).status_code == 200
        assert s.get(f"{API}/auth/me").json()["bonus_days_pending"] == 60
    finally:
        DB.users.update_one({"email": "member@tinysvouchers.com.au"}, {"$unset": {"bonus_days_pending": ""}})


def test_renewal_email_mentions_free_months():
    os.environ.update({k: v for k, v in ENV.items() if v is not None and k not in os.environ})
    from email_templates import renewal_email
    _, html = renewal_email("Sam Smith", "GP-ABC123", "1 December 2026", 10, 1, 60)
    assert "2 free months" in html and "14 months" in html
    _, plain = renewal_email("Sam Smith", "GP-ABC123", "1 December 2026", 10, 1)
    assert "free month" not in plain
