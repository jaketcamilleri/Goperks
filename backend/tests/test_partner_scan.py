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
    # Every deal offered belongs to this business (other tests may add deals for it in parallel, so not equality).
    assert res["type"] == "member" and {d["deal_id"] for d in res["deals"]} <= own
    other = DB.deals.find_one({"status": "approved", "submitted_by": {"$ne": str(biz["_id"])}})
    if other:
        r = s.post(f"{API}/partner/redeem-card", json={"member_code": code, "deal_id": str(other["_id"])})
        assert r.status_code == 404



def test_voucher_codes_only_for_own_deals():
    """Typed voucher codes: another business's voucher can't be checked or redeemed, even if it once belonged to this business."""
    biz = DB.users.find_one({"email": "business@tinysvouchers.com.au"})
    member = DB.users.find_one({"email": "member@tinysvouchers.com.au"})
    other = DB.deals.find_one({"status": "approved", "submitted_by": {"$ne": str(biz["_id"])}})
    own = DB.deals.find_one({"status": "approved", "submitted_by": str(biz["_id"])})
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": "business@tinysvouchers.com.au", "password": "Business!2026"}).status_code == 200
    codes = []
    try:
        if other:
            # Stale partner_id pointing at this business must not matter: the deal's owner decides.
            DB.vouchers.insert_one({"code": "TESTV-OTHER1", "user_id": str(member["_id"]), "deal_id": str(other["_id"]), "partner_id": str(biz["_id"]),
                                    "status": "active", "expires_at": "2099-01-01T00:00:00+00:00", "deal_title": other["title"],
                                    "business_name": other.get("business_name", ""), "discount_label": other.get("discount_label", "")})
            codes.append("TESTV-OTHER1")
            assert s.post(f"{API}/partner/check", json={"code": "TESTV-OTHER1"}).status_code == 404
            assert s.post(f"{API}/partner/redeem", json={"code": "TESTV-OTHER1"}).status_code == 404
            assert DB.vouchers.find_one({"code": "TESTV-OTHER1"})["status"] == "active"
        if own:
            DB.vouchers.insert_one({"code": "TESTV-OWN001", "user_id": str(member["_id"]), "deal_id": str(own["_id"]), "partner_id": str(biz["_id"]),
                                    "status": "active", "expires_at": "2099-01-01T00:00:00+00:00", "deal_title": own["title"],
                                    "business_name": own.get("business_name", ""), "discount_label": own.get("discount_label", "")})
            codes.append("TESTV-OWN001")
            r = s.post(f"{API}/partner/check", json={"code": "TESTV-OWN001"})
            assert r.status_code == 200 and r.json()["type"] == "voucher"
    finally:
        DB.vouchers.delete_many({"code": {"$in": codes}})
