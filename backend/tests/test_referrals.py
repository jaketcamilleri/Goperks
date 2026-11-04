"""Referrals: a free month for the member and their friend once the friend pays (max 12 a year for the member)."""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
LOOP = asyncio.new_event_loop()  # one loop for every in-process call, since the app's database client binds to it


def login(email, password):
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": email, "password": password}).status_code == 200
    return s


def pay(user_id):
    from services import mark_paid
    sid = f"test_ref_{uuid.uuid4().hex[:8]}"
    DB.payment_transactions.insert_one({"session_id": sid, "user_id": user_id, "kind": "membership", "payment_status": "pending", "amount": 49.0})

    async def run():
        await mark_paid(sid, {})
        await mark_paid(sid, {})  # a repeat webhook must not reward twice
    LOOP.run_until_complete(run())
    return sid


def days_from_now(iso):
    return (datetime.fromisoformat(iso) - datetime.now(timezone.utc)).days


def test_referral_flow_and_cap():
    member = login("member@tinysvouchers.com.au", "Member!2026")
    me = DB.users.find_one({"email": "member@tinysvouchers.com.au"})
    original_exp = me["membership_expires_at"]
    info = member.get(f"{API}/me/referral").json()
    assert info["link"].endswith(f"/join?ref={info['code']}") and info["cap"] == 12
    assert requests.get(f"{API}/referrals/{info['code']}").json()["first_name"] == "Demo"
    assert requests.get(f"{API}/referrals/NOPE123").status_code == 404
    made, sids = [], []
    try:
        email = f"test_ref_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Test!2026", "name": "Sam Friend", "ref": info["code"]})
        friend = DB.users.find_one({"email": email})
        made.append(friend["_id"])
        assert r.status_code == 200 and friend["referred_by"] == str(me["_id"])
        biz = f"test_refbiz_{uuid.uuid4().hex[:6]}@example.com"
        requests.post(f"{API}/auth/register", json={"email": biz, "password": "Test!2026", "name": "B", "role": "business", "business_name": "TEST_ B", "ref": info["code"]})
        b = DB.users.find_one({"email": biz})
        made.append(b["_id"])
        assert "referred_by" not in b

        # The friend's month off is a price discount at checkout; their membership is the normal 12 months.
        price = requests.Session()
        price.post(f"{API}/auth/login", json={"email": email, "password": "Test!2026"})
        assert price.get(f"{API}/payments/my-price").json() == {"amount": 44.92, "referral_discount": True}
        assert member.get(f"{API}/payments/my-price").json()["amount"] == 49.0
        co = price.post(f"{API}/payments/checkout", json={"origin_url": "https://example.com"})
        assert co.status_code == 200, co.text
        assert co.json()["amount"] == 44.92 and co.json()["referral_discount"] is True
        import stripe
        stripe.api_key = ENV["STRIPE_SECRET_KEY"]
        assert stripe.checkout.Session.retrieve(co.json()["session_id"]).amount_total == 4492
        sids.append(co.json()["session_id"])

        sids.append(pay(str(friend["_id"])))
        friend = DB.users.find_one({"_id": friend["_id"]})
        assert friend["membership_status"] == "active" and 363 <= days_from_now(friend["membership_expires_at"]) <= 365
        # The member's free month is saved for their next renewal, not added now.
        me_now = DB.users.find_one({"_id": me["_id"]})
        after = me_now["membership_expires_at"]
        assert after == original_exp and me_now["bonus_days_pending"] == 30
        assert DB.referral_rewards.count_documents({"friend_id": str(friend["_id"])}) == 1
        info2 = member.get(f"{API}/me/referral").json()
        assert info2["months_this_year"] == info["months_this_year"] + 1 and info2["friends"][0] == {**info2["friends"][0], "first_name": "Sam", "paid": True}

        # At the cap the friend still gets their discount but the member doesn't get another month.
        fillers = DB.referral_rewards.insert_many([{"referrer_id": str(me["_id"]), "friend_id": "test_filler", "referrer_granted": True,
                                                    "created_at": datetime.now(timezone.utc).isoformat()} for _ in range(12)]).inserted_ids
        email2 = f"test_ref_{uuid.uuid4().hex[:6]}@example.com"
        requests.post(f"{API}/auth/register", json={"email": email2, "password": "Test!2026", "name": "Kim", "ref": info["code"]})
        f2 = DB.users.find_one({"email": email2})
        made.append(f2["_id"])
        sids.append(pay(str(f2["_id"])))
        assert 363 <= days_from_now(DB.users.find_one({"_id": f2["_id"]})["membership_expires_at"]) <= 365
        assert DB.users.find_one({"_id": me["_id"]})["bonus_days_pending"] == 30
        DB.referral_rewards.delete_many({"_id": {"$in": fillers}})
    finally:
        DB.users.update_one({"_id": me["_id"]}, {"$set": {"membership_expires_at": original_exp}, "$unset": {"bonus_days_pending": ""}})
        DB.referral_rewards.delete_many({"referrer_id": str(me["_id"])})
        DB.users.delete_many({"_id": {"$in": made}})
        DB.payment_transactions.delete_many({"session_id": {"$in": sids}})
