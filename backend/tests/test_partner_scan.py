"""A business scanning a member card only sees, and can only redeem, its own deals."""
import os

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]


def test_scan_shows_only_own_deals():
    biz = DB.users.find_one({"email": "business@tinysvouchers.com.au"})
    code = DB.users.find_one({"email": "member@tinysvouchers.com.au"})["member_code"]
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": "business@tinysvouchers.com.au", "password": "Business!2026"}).status_code == 200
    res = s.post(f"{API}/partner/check", json={"code": code}).json()
    own = {str(d["_id"]) for d in DB.deals.find({"status": "approved", "submitted_by": str(biz["_id"])}, {"_id": 1})}
    assert res["type"] == "member" and {d["deal_id"] for d in res["deals"]} == own
    other = DB.deals.find_one({"status": "approved", "submitted_by": {"$ne": str(biz["_id"])}})
    if other:
        r = s.post(f"{API}/partner/redeem-card", json={"member_code": code, "deal_id": str(other["_id"])})
        assert r.status_code == 404
