"""Admin control room: moderation, people, payments, team and the activity log."""
import asyncio
import os
import secrets
from datetime import datetime
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends

from core import db, logger, oid, now_iso, hash_password, with_coords, month_start, month_range, MELB, CATEGORIES, JWT_ALGORITHM
from deps import user_out, require_role
from models import Deal, User, Activity, DealIn, StatusIn, HideIn, AdminCreateIn, AdminUserPatch, BulkIn, DecisionIn
from services import (log_activity, with_note, set_business_status, send_deal_decision, send_password_link, send_welcome,
                      send_partner_welcome, comp_membership, review_out, refresh_rating)

router = APIRouter(prefix="/admin")
team = require_role("admin", "staff")
owner = require_role("admin")

DEAL_FIELDS = {"title": "title", "submitted_by": "business", "category": "category", "discount_label": "offer",
               "description": "description", "terms": "terms", "suburb": "suburb", "image_url": "image",
               "featured": "featured", "est_saving": "estimated saving", "ends_on": "end date"}


def person_label(doc: dict) -> str:
    return doc.get("business_name") or doc.get("name") or doc.get("email", "")


# ---------- Deals ----------
@router.get("/deals")
async def admin_deals(status: Optional[str] = None, _=Depends(team)):
    query = {"status": status} if status else {}
    docs = await db.deals.find(query).sort("created_at", -1).to_list(500)
    return [Deal.from_mongo(d).out() for d in docs]


async def assign_partner(body: DealIn) -> dict:
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if not body.partner_id:
        raise HTTPException(400, "Please choose which business this deal belongs to")
    p = await db.users.find_one({"_id": oid(body.partner_id), "role": "business", "business_status": "approved"})
    if not p:
        raise HTTPException(400, "That business isn't an approved partner")
    data = body.model_dump(exclude={"partner_id"})
    data["business_name"] = p.get("business_name") or p.get("name")
    data["submitted_by"] = str(p["_id"])
    if not data.get("suburb") and p.get("suburb"):
        data["suburb"] = p["suburb"]
    return data


@router.post("/deals")
async def admin_create_deal(body: DealIn, user=Depends(team)):
    data = await assign_partner(body)
    d = Deal(**(await with_coords(data)), status="approved")
    res = await db.deals.insert_one(d.to_mongo())
    d.id = str(res.inserted_id)
    await log_activity(user, "deal.created", "deal", d.id, d.title, f"For {d.business_name} · live straight away")
    return d.out()


@router.post("/deals/bulk")
async def admin_deals_bulk(body: BulkIn, user=Depends(team)):
    if body.status == "deleted" and user["role"] != "admin":
        raise HTTPException(403, "Only the owner can delete deals")
    if body.status not in ("approved", "rejected", "pending", "deleted"):
        raise HTTPException(400, "Invalid status")
    ids = [oid(i) for i in body.ids]
    if body.status == "deleted":
        gone = await db.deals.find({"_id": {"$in": ids}}, {"title": 1, "business_name": 1}).to_list(200)
        res = await db.deals.delete_many({"_id": {"$in": ids}})
        for d in gone:
            await log_activity(user, "deal.deleted", "deal", d["_id"], d["title"], f"{d.get('business_name', '')} · bulk action")
        return {"updated": res.deleted_count}
    changed = await db.deals.find({"_id": {"$in": ids}, "status": {"$ne": body.status}}).to_list(200)
    await db.deals.update_many({"_id": {"$in": ids}}, {"$set": {"status": body.status}})
    for d in changed:
        await log_activity(user, f"deal.{body.status}", "deal", d["_id"], d["title"],
                           with_note(f"{d.get('business_name', '')} · bulk action", body.note))
        if body.status in ("approved", "rejected"):
            asyncio.create_task(send_deal_decision({**d, "status": body.status}, body.note or ""))
    return {"updated": len(changed)}


@router.put("/deals/{deal_id}")
async def admin_update_deal(deal_id: str, body: DealIn, user=Depends(team)):
    prev = await db.deals.find_one({"_id": oid(deal_id)})
    if not prev:
        raise HTTPException(404, "Deal not found")
    data = await with_coords(await assign_partner(body), prev)
    res = await db.deals.find_one_and_update({"_id": prev["_id"]}, {"$set": data}, return_document=True)
    changed = [label for k, label in DEAL_FIELDS.items() if (prev.get(k) or None) != (data.get(k) or None)]
    if changed:
        await log_activity(user, "deal.edited", "deal", prev["_id"], res["title"], "Changed " + ", ".join(dict.fromkeys(changed)))
    return Deal.from_mongo(res).out()


@router.post("/deals/{deal_id}/status")
async def admin_set_status(deal_id: str, body: StatusIn, user=Depends(team)):
    if body.status not in ("approved", "rejected", "pending"):
        raise HTTPException(400, "Invalid status")
    prev = await db.deals.find_one_and_update({"_id": oid(deal_id)}, {"$set": {"status": body.status}})
    if not prev:
        raise HTTPException(404, "Deal not found")
    res = await db.deals.find_one({"_id": prev["_id"]})
    if prev["status"] != body.status:
        await log_activity(user, f"deal.{body.status}", "deal", prev["_id"], prev["title"], with_note(prev.get("business_name", ""), body.note))
        if body.status in ("approved", "rejected"):
            asyncio.create_task(send_deal_decision(res, body.note or ""))
    return Deal.from_mongo(res).out()


@router.delete("/deals/{deal_id}")
async def admin_delete_deal(deal_id: str, user=Depends(owner)):
    d = await db.deals.find_one_and_delete({"_id": oid(deal_id)})
    if d:
        await log_activity(user, "deal.deleted", "deal", d["_id"], d["title"], d.get("business_name", ""))
    return {"ok": True}


# ---------- Reviews ----------
@router.get("/reviews")
async def admin_reviews(_=Depends(team)):
    rows = await db.reviews.find({}).sort("created_at", -1).to_list(2000)
    titles = {str(d["_id"]): d for d in await db.deals.find({}, {"title": 1, "business_name": 1}).to_list(2000)}
    return [review_out(r) | {"deal_title": titles.get(r["deal_id"], {}).get("title"), "business_name": titles.get(r["deal_id"], {}).get("business_name")} for r in rows]


@router.post("/reviews/{review_id}/hide")
async def admin_hide_review(review_id: str, body: HideIn, user=Depends(team)):
    r = await db.reviews.find_one_and_update({"_id": oid(review_id)}, {"$set": {"hidden": body.hidden}})
    if not r:
        raise HTTPException(404, "Review not found")
    await refresh_rating(r["deal_id"])
    if bool(r.get("hidden")) != body.hidden:
        deal = await db.deals.find_one({"_id": oid(r["deal_id"])}, {"title": 1}) or {}
        await log_activity(user, "review.hidden" if body.hidden else "review.shown", "review", r["_id"],
                           f"{r['rating']}\u2605 review of {deal.get('title', 'a deal')}", (r.get("comment") or "")[:120])
    return {"ok": True}


# ---------- Dashboard numbers ----------
@router.get("/stats")
async def admin_stats(user=Depends(team)):
    if user["role"] == "staff":
        return {
            "businesses": await db.users.count_documents({"role": "business", "business_status": "approved"}),
            "pending_businesses": await db.users.count_documents({"role": "business", "business_status": "pending"}),
            "pending_deals": await db.deals.count_documents({"status": "pending"}),
            "live_deals": await db.deals.count_documents({"status": "approved"}),
            "vouchers": await db.vouchers.count_documents({}),
            "redeemed": await db.vouchers.count_documents({"status": "redeemed"}),
        }
    paid = await db.payment_transactions.find({"payment_status": "paid"}, {"amount": 1, "kind": 1}).to_list(100000)
    return {
        "members": await db.users.count_documents({"role": "member"}),
        "active_members": await db.users.count_documents({"role": "member", "membership_status": "active", "membership_expires_at": {"$gt": now_iso()}}),
        "businesses": await db.users.count_documents({"role": "business", "business_status": "approved"}),
        "pending_businesses": await db.users.count_documents({"role": "business", "business_status": "pending"}),
        "pending_deals": await db.deals.count_documents({"status": "pending"}),
        "live_deals": await db.deals.count_documents({"status": "approved"}),
        "vouchers": await db.vouchers.count_documents({}),
        "redeemed": await db.vouchers.count_documents({"status": "redeemed"}),
        "revenue": round(sum(p.get("amount") or 0 for p in paid), 2),
        "gifts_sold": sum(1 for p in paid if p.get("kind") == "gift"),
    }


@router.get("/top-deals")
async def admin_top_deals(month: Optional[str] = None, _=Depends(team)):
    start = month_start(month)
    rows = await db.vouchers.aggregate([
        {"$match": {"status": "redeemed", "redeemed_at": month_range(start)}},
        {"$group": {"_id": "$deal_id", "redeemed": {"$sum": 1}, "saved": {"$sum": {"$ifNull": ["$amount_saved", 0]}},
                    "title": {"$first": "$deal_title"}, "business": {"$first": "$business_name"}}},
        {"$sort": {"redeemed": -1, "saved": -1}}, {"$limit": 5}]).to_list(5)
    return {"month": start.strftime("%Y-%m"), "deals": [
        {"deal_id": r["_id"], "title": r.get("title"), "business_name": r.get("business"),
         "redeemed": r["redeemed"], "saved": round(r["saved"], 2)} for r in rows]}


@router.get("/monthly")
async def admin_monthly(_=Depends(owner)):
    today = datetime.now(MELB).date().replace(day=1)
    months = []
    y, m = today.year, today.month
    for _i in range(6):
        months.insert(0, f"{y:04d}-{m:02d}")
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    rows = {k: {"month": k, "members": 0, "gifts": 0, "revenue": 0.0} for k in months}
    paid = await db.payment_transactions.find(
        {"payment_status": "paid"}, {"amount": 1, "kind": 1, "created_at": 1, "updated_at": 1}).to_list(100000)
    for p in paid:
        when = datetime.fromisoformat(p.get("updated_at") or p["created_at"]).astimezone(MELB)
        r = rows.get(when.strftime("%Y-%m"))
        if not r:
            continue
        r["gifts" if p.get("kind") == "gift" else "members"] += 1
        r["revenue"] = round(r["revenue"] + (p.get("amount") or 0), 2)
    return [rows[k] for k in months]


@router.get("/payments")
async def admin_payments(_=Depends(owner)):
    txns = await db.payment_transactions.find({}, {"_id": 0, "session_id": 1, "email": 1, "kind": 1, "amount": 1, "currency": 1,
                                                   "payment_status": 1, "created_at": 1, "gift_name": 1, "gift_email": 1}).sort("created_at", -1).to_list(5000)
    gifts = {g["session_id"]: g for g in await db.gifts.find({}, {"_id": 0}).to_list(5000)}
    for t in txns:
        g = gifts.get(t["session_id"])
        if g:
            t["gift"] = {"code": g["code"], "status": g.get("status"), "send_on": g.get("send_on"), "email_sent": g.get("email_sent")}
    return txns


@router.get("/activity")
async def admin_activity(_=Depends(owner)):
    rows = await db.activity_log.find({}).sort("created_at", -1).to_list(2000)
    return [Activity.from_mongo(r).out() for r in rows]


# ---------- People ----------
@router.get("/users")
async def admin_users(role: Optional[str] = None, user=Depends(team)):
    if user["role"] == "staff" and role != "business":
        raise HTTPException(403, "Not allowed")
    q = {"role": {"$in": ["staff", "admin"]}} if role == "team" else {"role": role} if role else {}
    docs = await db.users.find(q).sort("created_at", -1).to_list(2000)
    out = []
    for d in docs:
        u = user_out(d)
        u["auth_provider"] = d.get("auth_provider", "email")
        if u["role"] == "business":
            u["deal_count"] = await db.deals.count_documents({"submitted_by": u["id"]})
        else:
            u["redeemed_count"] = await db.vouchers.count_documents({"user_id": u["id"], "status": "redeemed"})
        out.append(u)
    return out


@router.post("/users")
async def admin_create_user(body: AdminCreateIn, user=Depends(owner)):
    if body.role not in ("member", "business", "staff"):
        raise HTTPException(400, "Role must be member, business or staff")
    if body.role == "business" and not (body.business_name or "").strip():
        raise HTTPException(400, "Business name is required")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "An account with this email already exists")
    doc = User(email=email, name=body.name.strip(), role=body.role,
               business_name=(body.business_name or "").strip() or None).to_mongo()
    doc["password_hash"] = hash_password(body.password or secrets.token_urlsafe(24))
    doc["created_by_admin"] = True
    if body.role == "business":
        doc["business_status"] = "approved"
    res = await db.users.insert_one(doc)
    created = await db.users.find_one({"_id": res.inserted_id})
    if body.role == "member" and body.activate:
        await comp_membership(created)
        created = await db.users.find_one({"_id": res.inserted_id})
    extras = [f"Added as {body.role}", "membership activated" if body.role == "member" and body.activate else "",
              "invite emailed" if body.send_invite else ""]
    await log_activity(user, "user.created", body.role, res.inserted_id, person_label(created), " · ".join(e for e in extras if e))
    if body.send_invite:
        try:
            await send_password_link(created, invite=True)
        except Exception as e:
            logger.warning("invite email failed for %s: %s", email, e)
    if body.role == "business":
        asyncio.create_task(send_partner_welcome(email, created.get("name", ""), created.get("business_name") or "Your business"))
    elif body.activate:
        asyncio.create_task(send_welcome(str(res.inserted_id)))
    return user_out(created)


@router.patch("/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserPatch, user=Depends(owner)):
    doc = await db.users.find_one({"_id": oid(user_id)})
    if not doc:
        raise HTTPException(404, "User not found")
    sets = {k: v.strip() for k, v in (("name", body.name), ("business_name", body.business_name)) if v and v.strip() != doc.get(k)}
    if sets:
        await db.users.update_one({"_id": doc["_id"]}, {"$set": sets})
        await log_activity(user, "user.edited", doc.get("role", "member"), doc["_id"], person_label({**doc, **sets}),
                           " · ".join(f"{k.replace('_', ' ').capitalize()} was \u201c{doc.get(k) or '—'}\u201d" for k in sets))
    if body.membership == "activate" or body.expires_on:
        if doc.get("role") != "member":
            raise HTTPException(400, "Only member accounts have a membership")
        was_active = doc.get("membership_status") == "active"
        await comp_membership(doc, body.expires_on)
        await log_activity(user, "membership.expiry" if body.expires_on else "membership.activated", "member", doc["_id"],
                           person_label(doc), f"Ends {body.expires_on}" if body.expires_on else "12 months, no payment")
        if not was_active:
            asyncio.create_task(send_welcome(user_id))
    elif body.membership == "deactivate":
        await db.users.update_one({"_id": doc["_id"]}, {"$set": {"membership_status": "inactive"}})
        await log_activity(user, "membership.deactivated", "member", doc["_id"], person_label(doc))
    elif body.membership:
        raise HTTPException(400, "Invalid membership action")
    return user_out(await db.users.find_one({"_id": doc["_id"]}))


@router.post("/users/{user_id}/resend-card")
async def admin_resend_card(user_id: str, user=Depends(owner)):
    doc = await db.users.find_one({"_id": oid(user_id), "role": "member"})
    if not doc or doc.get("membership_status") != "active" or not doc.get("member_code"):
        raise HTTPException(400, "This member doesn't have an active card")
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"welcome_sent": False}})
    await send_welcome(user_id)
    await log_activity(user, "card.resent", "member", doc["_id"], person_label(doc), doc["email"])
    return {"ok": True}


@router.post("/users/{user_id}/password-link")
async def admin_password_link(user_id: str, user=Depends(owner)):
    doc = await db.users.find_one({"_id": oid(user_id)})
    if not doc:
        raise HTTPException(404, "User not found")
    await send_password_link(doc, invite=True)
    await log_activity(user, "password_link.sent", doc.get("role", "member"), doc["_id"], person_label(doc), doc["email"])
    return {"ok": True}


@router.delete("/team/{user_id}")
async def admin_remove_staff(user_id: str, user=Depends(owner)):
    doc = await db.users.find_one_and_delete({"_id": oid(user_id), "role": "staff"})
    if not doc:
        raise HTTPException(404, "Staff member not found")
    await log_activity(user, "staff.removed", "staff", doc["_id"], person_label(doc), doc["email"])
    return {"ok": True}


# ---------- Businesses ----------
@router.post("/businesses/bulk")
async def admin_businesses_bulk(body: BulkIn, user=Depends(team)):
    done = 0
    for i in body.ids:
        try:
            await set_business_status(i, body.status, body.note, user, via="Bulk action")
            done += 1
        except HTTPException:
            pass
    return {"updated": done}


@router.post("/businesses/{user_id}/status")
async def admin_business_status(user_id: str, body: StatusIn, user=Depends(team)):
    return await set_business_status(user_id, body.status, body.note, user)


async def decision_business(token: str) -> dict:
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(410, "This link has expired. Please decide from the control room instead.")
    except jwt.InvalidTokenError:
        raise HTTPException(400, "This link isn't valid.")
    if payload.get("type") != "biz_decision":
        raise HTTPException(400, "This link isn't valid.")
    doc = await db.users.find_one({"_id": oid(payload["sub"]), "role": "business"})
    if not doc:
        raise HTTPException(404, "This business no longer exists.")
    return doc


def decision_out(doc: dict) -> dict:
    return {"name": doc.get("name"), "email": doc["email"], "business_name": doc.get("business_name"),
            "business_status": doc.get("business_status"), "applied_at": doc.get("created_at")}


@router.get("/decision")
async def get_decision(token: str):
    return decision_out(await decision_business(token))


@router.post("/decision")
async def post_decision(body: DecisionIn):
    doc = await decision_business(body.token)
    if doc.get("business_status") != "pending":
        raise HTTPException(409, f"Already {doc.get('business_status')} — this link has been used.")
    status = {"approve": "approved", "reject": "rejected"}.get(body.action)
    if not status:
        raise HTTPException(400, "Invalid action")
    owner_doc = await db.users.find_one({"email": os.environ["SUPER_ADMIN_EMAIL"].lower()})
    actor = user_out(owner_doc) if owner_doc else {"name": "Owner", "email": os.environ["SUPER_ADMIN_EMAIL"], "role": "admin"}
    await set_business_status(str(doc["_id"]), status, body.note, actor, only_pending=True, via="From the email link")
    return decision_out(await db.users.find_one({"_id": doc["_id"]}))
