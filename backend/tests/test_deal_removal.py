"""Deal removal requests (business -> admin decision) and owner-only account deletion.
Creates its own test_ accounts directly in the DB and removes everything afterwards."""
import asyncio
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
from core import db, hash_password, now_iso  # noqa: E402
from models import User  # noqa: E402

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
PW = "TestQA!2026"
TAG = uuid.uuid4().hex[:6]


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


async def make_user(role, tag="", **extra):
    email = f"test_rm_{role}{tag}_{TAG}@example.com"
    d = User(email=email, name=f"TEST {role}", role=role, business_name="TEST RM Cafe" if role == "business" else None).to_mongo()
    d["password_hash"] = hash_password(PW)
    d.update(extra)
    await db.users.insert_one(d)
    return email, str(d["_id"])


def login(email):
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": email, "password": PW}).status_code == 200
    return s


@pytest.fixture(scope="module")
def ctx():
    profile = {"business_status": "approved", "address": "1 Test St", "suburb": "Essendon", "phone": "0400000000",
               "about": "Test", "hours": {"mon": "9-5"}}
    biz_email, biz_id = run(make_user("business", **profile))
    other_email, other_id = run(make_user("business", "2", **profile))
    admin_email, _ = run(make_user("admin"))
    staff_email, _ = run(make_user("staff"))
    mem_email, mem_id = run(make_user("member"))
    deal = {"title": f"TEST RM Deal {TAG}", "business_name": "TEST RM Cafe", "category": "cafes", "discount_label": "2 for 1",
            "description": "x", "status": "approved", "submitted_by": biz_id, "created_at": now_iso()}
    deal_id = str(run(db.deals.insert_one(dict(deal))).inserted_id)
    pending_id = str(run(db.deals.insert_one({**deal, "title": f"TEST RM Pending {TAG}", "status": "pending"})).inserted_id)
    yield {"biz": login(biz_email), "other": login(other_email), "admin": login(admin_email), "staff": login(staff_email),
           "deal": deal_id, "pending": pending_id, "mem_id": mem_id, "biz_id": biz_id}
    run(db.deals.delete_many({"title": {"$regex": f"^TEST RM .*{TAG}"}}))
    ids = [u["_id"] for u in run(db.users.find({"email": {"$regex": f"^test_rm_.*_{TAG}@"}}).to_list(None))]
    run(db.activity_log.delete_many({"actor_id": {"$in": [str(i) for i in ids]}}))
    run(db.users.delete_many({"_id": {"$in": ids}}))


def test_business_cannot_delete_deals(ctx):
    assert ctx["biz"].delete(f"{API}/admin/deals/{ctx['deal']}").status_code == 403


def test_removal_request_rules(ctx):
    url = f"{API}/business/deals/{{}}/removal-request"
    assert ctx["other"].post(url.format(ctx["deal"]), json={"reason": "not mine"}).status_code == 404
    assert ctx["biz"].post(url.format(ctx["pending"]), json={"reason": "pending deal"}).status_code == 400
    r = ctx["biz"].post(url.format(ctx["deal"]), json={"reason": "Menu changed"})
    assert r.status_code == 200 and r.json()["removal_reason"] == "Menu changed" and r.json()["status"] == "approved"
    assert ctx["biz"].post(url.format(ctx["deal"]), json={"reason": "again"}).status_code == 400
    assert ctx["admin"].get(f"{API}/admin/stats").json()["removal_requests"] >= 1


def test_decline_then_approve(ctx):
    url = f"{API}/admin/deals/{ctx['deal']}/removal"
    r = ctx["admin"].post(url, json={"approve": False, "note": "Keep it"})
    assert r.status_code == 200 and r.json()["status"] == "approved" and not r.json()["removal_requested_at"]
    ctx["biz"].post(f"{API}/business/deals/{ctx['deal']}/removal-request", json={"reason": "Closing down"})
    r = ctx["admin"].post(url, json={"approve": True})
    assert r.status_code == 200 and r.json()["status"] == "removed"
    assert run(db.deals.find_one({"title": f"TEST RM Deal {TAG}"})) is not None  # history kept
    assert all(d["id"] != ctx["deal"] for d in requests.get(f"{API}/deals").json())


def test_only_owner_deletes_accounts(ctx):
    assert ctx["staff"].delete(f"{API}/admin/users/{ctx['mem_id']}").status_code == 403
    assert ctx["biz"].delete(f"{API}/admin/users/{ctx['mem_id']}").status_code == 403
    assert ctx["admin"].delete(f"{API}/admin/users/{ctx['mem_id']}").status_code == 200
    assert run(db.users.find_one({"email": {"$regex": f"^test_rm_member_{TAG}@"}})) is None
    assert ctx["admin"].delete(f"{API}/admin/users/{ctx['biz_id']}").status_code == 200
    assert run(db.deals.find_one({"title": f"TEST RM Pending {TAG}"}))["status"] == "removed"
