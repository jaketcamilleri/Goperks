"""Shared business logic: memberships, gifts, emails, partner decisions, activity log and scheduled jobs."""
import asyncio
import os
import secrets
from datetime import datetime, timezone, timedelta
from html import escape
from typing import Optional

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from core import (db, logger, oid, now_iso, nice_date, melb_today, rand_code, make_token, MELB,
                  previous_month_start, month_range)
from deps import user_out
from models import Activity
from email_service import send_email, EMAIL_FROM_NAME
from email_templates import (welcome_email, renewal_email, gift_email, partner_welcome_email, deal_decision_email,
                             business_rejected_email, new_applicant_email, weekly_digest_email, partner_report_email, referral_reward_email)


# ---------- Activity log ----------
async def log_activity(actor: Optional[dict], action: str, target_type: str, target_id=None,
                       target_label: str = "", details: str = ""):
    """Record who did what. actor=None means the system (scheduled jobs)."""
    a = actor or {}
    entry = Activity(actor_id=a.get("id"), actor_name=a.get("name") or "System", actor_email=a.get("email"),
                     actor_role=a.get("role") or "system", action=action, target_type=target_type,
                     target_id=str(target_id) if target_id else None, target_label=target_label or "", details=details or "")
    try:
        await db.activity_log.insert_one(entry.to_mongo())
    except Exception as e:
        logger.warning("activity log failed for %s: %s", action, e)


def with_note(details: str, note: Optional[str]) -> str:
    return " · ".join(p for p in (details, f"Note: {note.strip()}" if note and note.strip() else "") if p)


# ---------- Memberships ----------
async def send_welcome(user_id: str):
    try:
        doc = await db.users.find_one({"_id": oid(user_id)})
        if not doc or doc.get("welcome_sent"):
            return
        subject, html = welcome_email(doc.get("name", ""), doc["member_code"], nice_date(doc["membership_expires_at"]))
        await send_email(to=doc["email"], subject=subject, html=html)
        await db.users.update_one({"_id": doc["_id"]}, {"$set": {"welcome_sent": True}})
    except Exception as e:
        logger.warning("welcome email failed for %s: %s", user_id, e)


async def activate_membership(user_id: str, paid: bool = False):
    doc = await db.users.find_one({"_id": oid(user_id)})
    if not doc:
        return
    base = datetime.now(timezone.utc)
    exp = doc.get("membership_expires_at")
    if doc.get("membership_status") == "active" and exp and exp > base.isoformat():
        base = datetime.fromisoformat(exp)
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {
        "membership_status": "active",
        "membership_expires_at": (base + timedelta(days=365 + (doc.get("bonus_days_pending") or 0))).isoformat(),
        "member_code": doc.get("member_code") or f"GP-{rand_code(6)}",
    }, "$unset": {"bonus_days_pending": ""}})
    if paid:
        await reward_referral(doc)
    asyncio.create_task(send_welcome(user_id))


# ---------- Referrals: the friend pays 11 months' price for their first year; the member gets a free month at their next renewal ----------
REFERRAL_DAYS = 30
REFERRAL_CAP = 12


async def attach_referrer(user_id, email: str, ref: Optional[str]):
    """Link a new or never-paid member to the member whose link they used."""
    if not ref:
        return
    referrer = await db.users.find_one({"referral_code": ref.strip().upper(), "role": "member"}, {"email": 1})
    if referrer and referrer["email"] != email.lower() and str(referrer["_id"]) != str(user_id):
        await db.users.update_one({"_id": oid(str(user_id)), "referred_by": {"$exists": False}, "role": "member"},
                                  {"$set": {"referred_by": str(referrer["_id"])}})


async def ensure_referral_code(user_id) -> str:
    """Return the member's referral code, creating a unique one the first time."""
    doc = await db.users.find_one({"_id": oid(str(user_id))}, {"referral_code": 1})
    code = doc.get("referral_code")
    while not code:
        try:
            await db.users.update_one({"_id": doc["_id"], "referral_code": {"$exists": False}}, {"$set": {"referral_code": f"REF{rand_code(6)}"}})
            code = (await db.users.find_one({"_id": doc["_id"]}, {"referral_code": 1})).get("referral_code")
        except DuplicateKeyError:
            continue
    return code


async def referral_months_this_year(referrer_id: str) -> int:
    since = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
    return await db.referral_rewards.count_documents({"referrer_id": referrer_id, "referrer_granted": True, "created_at": {"$gte": since}})


async def reward_referral(friend: dict):
    """Friend's first payment went through (their month off was taken at checkout). Save a free month for the referrer's next renewal."""
    if not friend.get("referred_by"):
        return
    if not await db.users.find_one_and_update({"_id": friend["_id"], "referral_rewarded": {"$ne": True}}, {"$set": {"referral_rewarded": True}}):
        return
    ref_id = friend["referred_by"]
    granted = await referral_months_this_year(ref_id) < REFERRAL_CAP
    referrer = await db.users.find_one({"_id": oid(ref_id)})
    await db.referral_rewards.insert_one({"referrer_id": ref_id, "friend_id": str(friend["_id"]), "referrer_granted": granted and bool(referrer),
                                          "created_at": now_iso()})
    if not granted or not referrer:
        return
    await db.users.update_one({"_id": referrer["_id"]}, {"$inc": {"bonus_days_pending": REFERRAL_DAYS}})
    line = "It's saved on your account and added automatically when you next renew, so you get an extra month on your next year."
    try:
        subject, html = referral_reward_email(referrer.get("name", ""), friend.get("name", ""), line)
        await send_email(to=referrer["email"], subject=subject, html=html)
    except Exception as e:
        logger.warning("referral email failed for %s: %s", referrer.get("email"), e)


async def comp_membership(doc: dict, expires_on: Optional[str] = None):
    """Make a member's account valid without payment (12 months, or until a chosen date)."""
    if expires_on:
        try:
            exp = datetime.strptime(expires_on, "%Y-%m-%d").replace(hour=23, minute=59, tzinfo=MELB).astimezone(timezone.utc)
        except ValueError:
            raise HTTPException(400, "Expiry must be a date like 2027-11-04")
        if exp <= datetime.now(timezone.utc):
            raise HTTPException(400, "Expiry date must be in the future")
    else:
        base = datetime.now(timezone.utc)
        cur = doc.get("membership_expires_at")
        if doc.get("membership_status") == "active" and cur and cur > base.isoformat():
            base = datetime.fromisoformat(cur)
        exp = base + timedelta(days=365)
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {
        "membership_status": "active", "membership_expires_at": exp.isoformat(),
        "member_code": doc.get("member_code") or f"GP-{rand_code(6)}", "comped_by_admin": True}})


def term_start(user: dict) -> str:
    exp = user.get("membership_expires_at")
    return (datetime.fromisoformat(exp) - timedelta(days=365)).isoformat() if exp else ""


async def used_this_term(user: dict, deal_id: str, exclude_id=None):
    q = {"user_id": user["id"], "deal_id": deal_id, "status": "redeemed", "redeemed_at": {"$gte": term_start(user)}}
    if exclude_id is not None:
        q["_id"] = {"$ne": exclude_id}
    return await db.vouchers.find_one(q)


async def mark_paid(session_id: str, extra: dict):
    res = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now_iso(), **extra}},
    )
    if res and res.get("kind") == "gift":
        await create_gift(res)
    elif res and res.get("user_id"):
        await activate_membership(res["user_id"], paid=True)


# ---------- Gifts ----------
async def send_gift_email(g: dict):
    try:
        buyer = await db.users.find_one({"_id": oid(g["buyer_id"])})
        subject, html = gift_email(g["recipient_name"], (buyer or {}).get("name", "A friend"), g.get("message") or "", g["code"])
        await send_email(to=g["recipient_email"], subject=subject, html=html)
        await db.gifts.update_one({"code": g["code"]}, {"$set": {"email_sent": True, "sent_at": now_iso()}})
    except Exception as e:
        logger.warning("gift email failed for %s: %s", g["code"], e)


async def create_gift(txn: dict):
    send_on = txn.get("gift_send_date") or melb_today()
    g = {
        "code": f"GIFT-{rand_code(4)}-{rand_code(4)}", "session_id": txn["session_id"], "buyer_id": txn["user_id"],
        "recipient_name": txn["gift_name"], "recipient_email": txn["gift_email"],
        "message": txn.get("gift_message") or "", "status": "unredeemed", "send_on": send_on,
        "email_sent": False, "created_at": now_iso()}
    await db.gifts.insert_one(dict(g))
    if send_on <= melb_today():
        await send_gift_email(g)


async def run_gift_deliveries():
    due = await db.gifts.find({"email_sent": False, "send_on": {"$lte": melb_today()}}).to_list(500)
    for g in due:
        await send_gift_email(g)
    logger.info("scheduled gifts processed: %s", len(due))


# ---------- Account emails ----------
async def send_password_link(doc: dict, invite: bool = False):
    token = secrets.token_urlsafe(32)
    hours = 72 if invite else 1
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": str(doc["_id"]), "used": False,
        "created_at": datetime.now(timezone.utc), "expires_at": datetime.now(timezone.utc) + timedelta(hours=hours)})
    base = {"business": os.environ["BUSINESS_URL"], "admin": os.environ["ADMIN_URL"], "staff": os.environ["ADMIN_URL"]}.get(doc.get("role"), os.environ["FRONTEND_URL"])
    link = f"{base.rstrip('/')}/reset-password?token={token}"
    heading = "Your account is ready" if invite else "Reset your password"
    intro = (f"we've set up a {escape(EMAIL_FROM_NAME)} account for you. Choose a password to log in." if invite
             else f"we received a request to reset the password for your {escape(EMAIL_FROM_NAME)} account.")
    html = (
        '<table role="presentation" width="100%" style="background:#EAF6F3"><tr><td style="padding:32px;font-family:Georgia,serif;color:#17434C">'
        f'<h1 style="font-size:26px;margin:0 0 16px">{heading}</h1>'
        f'<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">Hi {escape(doc.get("name", "there"))}, {intro}</p>'
        f'<p style="margin:28px 0"><a href="{escape(link)}" style="background:#B9512E;color:#EAF6F3;padding:14px 26px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">Choose a {"" if invite else "new "}password</a></p>'
        f'<p style="font-family:Arial,sans-serif;font-size:13px;color:#3D5E65">This link expires in {"3 days" if invite else "1 hour"} and can only be used once. If you didn\'t expect this, you can ignore this email.</p>'
        f'<p style="font-family:Arial,sans-serif;font-size:12px;color:#5E7F84">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>'
        '</td></tr></table>')
    await send_email(to=doc["email"], subject=f"{heading} — {EMAIL_FROM_NAME}", html=html)


async def send_partner_welcome(email: str, name: str, business: str):
    try:
        subject, html = partner_welcome_email(name, business)
        await send_email(to=email, subject=subject, html=html)
        await db.users.update_one({"email": email}, {"$set": {"partner_kit_sent": True}})
    except Exception as e:
        logger.warning("partner welcome failed for %s: %s", email, e)


async def send_applicant_alert(user_id: str, name: str, business: str, email: str):
    try:
        token = make_token(user_id, "biz_decision", timedelta(days=14))
        subject, html = new_applicant_email(name, business, email, token)
        await send_email(to=os.environ["SUPER_ADMIN_EMAIL"], subject=subject, html=html)
    except Exception as e:
        logger.warning("applicant alert failed for %s: %s", email, e)


async def send_deal_decision(deal: dict, note: str):
    try:
        owner = await db.users.find_one({"_id": oid(deal["submitted_by"])}) if deal.get("submitted_by") else None
        if not owner or owner.get("role") != "business":
            return
        subject, html = deal_decision_email(owner.get("name", ""), deal["title"], deal["status"] == "approved", note)
        await send_email(to=owner["email"], subject=subject, html=html)
        await db.deals.update_one({"_id": deal["_id"]}, {"$set": {"decision_emailed_at": now_iso()}})
    except Exception as e:
        logger.warning("deal decision email failed for %s: %s", deal.get("_id"), e)


async def send_business_rejected(u: dict, note: str):
    try:
        subject, html = business_rejected_email(u.get("name", ""), u.get("business_name") or "your business", note)
        await send_email(to=u["email"], subject=subject, html=html)
    except Exception as e:
        logger.warning("business rejection email failed for %s: %s", u.get("email"), e)


async def set_business_status(user_id: str, status: str, note: Optional[str], actor: Optional[dict],
                              only_pending: bool = False, via: str = ""):
    if status not in ("approved", "rejected"):
        raise HTTPException(400, "Invalid status")
    q = {"_id": oid(user_id), "role": "business", **({"business_status": "pending"} if only_pending else {})}
    prev = await db.users.find_one_and_update(q, {"$set": {"business_status": status}})
    if not prev:
        raise HTTPException(409 if only_pending else 404, "This link has already been used." if only_pending else "Business not found")
    if prev.get("business_status") != status:
        await log_activity(actor, f"business.{status}", "business", prev["_id"],
                           prev.get("business_name") or prev.get("name") or prev["email"], with_note(via, note))
        if status == "approved":
            asyncio.create_task(send_partner_welcome(prev["email"], prev.get("name", ""), prev.get("business_name") or "Your business"))
        else:
            asyncio.create_task(send_business_rejected(prev, note or ""))
    return user_out(await db.users.find_one({"_id": prev["_id"]}))


# ---------- Reviews ----------
def review_out(r: dict) -> dict:
    first = (r.get("user_name") or "Member").split(" ")
    name = first[0] + (f" {first[1][0]}." if len(first) > 1 and first[1] else "")
    return {"id": str(r["_id"]), "deal_id": r["deal_id"], "rating": r["rating"], "comment": r.get("comment", ""),
            "name": name, "created_at": r["created_at"], "updated_at": r.get("updated_at"), "hidden": r.get("hidden", False)}


async def refresh_rating(deal_id: str):
    rows = await db.reviews.aggregate([
        {"$match": {"deal_id": deal_id, "hidden": {"$ne": True}}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}}]).to_list(1)
    avg, n = (round(rows[0]["avg"], 2), rows[0]["n"]) if rows else (0.0, 0)
    await db.deals.update_one({"_id": oid(deal_id)}, {"$set": {"rating_avg": avg, "rating_count": n}})


# ---------- Scheduled jobs ----------
async def run_renewal_reminders():
    now = datetime.now(timezone.utc)
    window_end = (now + timedelta(days=14)).isoformat()
    cursor = db.users.find({"membership_status": "active", "membership_expires_at": {"$gt": now.isoformat(), "$lte": window_end}})
    sent = 0
    async for u in cursor:
        if u.get("reminder_sent_for") == u["membership_expires_at"]:
            continue
        redeemed = await db.vouchers.find({"user_id": str(u["_id"]), "status": "redeemed"}).to_list(1000)
        saved = round(sum(v.get("amount_saved") or 0 for v in redeemed), 2)
        subject, html = renewal_email(u.get("name", ""), u.get("member_code", ""), nice_date(u["membership_expires_at"]), saved, len(redeemed),
                                     u.get("bonus_days_pending") or 0)
        try:
            await send_email(to=u["email"], subject=subject, html=html)
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"reminder_sent_for": u["membership_expires_at"]}})
            sent += 1
        except Exception as e:
            logger.warning("renewal reminder failed for %s: %s", u["email"], e)
    logger.info("renewal reminders sent: %s", sent)


async def run_weekly_digest():
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    rng = {"$gte": start.isoformat(), "$lt": end.isoformat()}
    paid = await db.payment_transactions.find({"payment_status": "paid", "updated_at": rng}, {"amount": 1, "kind": 1}).to_list(100000)
    pending = await db.users.find({"role": "business", "business_status": "pending"}, {"business_name": 1, "name": 1}).to_list(500)
    s = {
        "from": start.astimezone(MELB).strftime("%a %-d %b"), "to": end.astimezone(MELB).strftime("%a %-d %b"),
        "members": sum(1 for p in paid if p.get("kind") != "gift"),
        "gifts": sum(1 for p in paid if p.get("kind") == "gift"),
        "revenue": round(sum(p.get("amount") or 0 for p in paid), 2),
        "signups": await db.users.count_documents({"created_at": rng}),
        "redeemed": await db.vouchers.count_documents({"status": "redeemed", "redeemed_at": rng}),
        "pending_deals": await db.deals.count_documents({"status": "pending"}),
        "pending_businesses": len(pending),
        "pending_names": [p.get("business_name") or p.get("name") or "Unnamed business" for p in pending],
    }
    subject, html = weekly_digest_email(s)
    try:
        await send_email(to=os.environ["SUPER_ADMIN_EMAIL"], subject=subject, html=html)
        logger.info("weekly digest sent")
    except Exception as e:
        logger.warning("weekly digest failed: %s", e)


async def partner_month_stats(deals: list, rng: dict) -> dict:
    """One partner's numbers for a month: redemptions, member savings, members, reviews and a per-deal breakdown."""
    ids = [str(d["_id"]) for d in deals]
    titles = {str(d["_id"]): d["title"] for d in deals}
    used = await db.vouchers.find({"deal_id": {"$in": ids}, "status": "redeemed", "redeemed_at": rng},
                                  {"deal_id": 1, "user_id": 1, "amount_saved": 1}).to_list(100000)
    per = {}
    for v in used:
        row = per.setdefault(v["deal_id"], {"title": titles.get(v["deal_id"], "Deal"), "redeemed": 0, "saved": 0.0})
        row["redeemed"] += 1
        row["saved"] = round(row["saved"] + (v.get("amount_saved") or 0), 2)
    rated = [d for d in deals if d.get("rating_count")]
    count = sum(d["rating_count"] for d in rated)
    return {
        "redeemed": len(used),
        "saved": round(sum(v.get("amount_saved") or 0 for v in used), 2),
        "members": len({v["user_id"] for v in used}),
        "new_reviews": await db.reviews.count_documents({"deal_id": {"$in": ids}, "hidden": {"$ne": True}, "created_at": rng}),
        "rating": round(sum(d["rating_avg"] * d["rating_count"] for d in rated) / count, 1) if count else None,
        "all_redeemed": await db.vouchers.count_documents({"deal_id": {"$in": ids}, "status": "redeemed"}),
        "deals": sorted(per.values(), key=lambda r: (-r["redeemed"], -r["saved"]))[:5],
    }


async def run_partner_reports():
    """Email every approved partner with a live deal a summary of last month. Each partner gets each month once."""
    start = previous_month_start()
    key, label, rng = start.strftime("%Y-%m"), start.strftime("%B %Y"), month_range(start)
    partners = await db.users.find({"role": "business", "business_status": "approved"}).to_list(5000)
    sent = failed = 0
    for p in partners:
        pid = str(p["_id"])
        deals = await db.deals.find({"submitted_by": pid}, {"title": 1, "status": 1, "rating_avg": 1, "rating_count": 1}).to_list(500)
        if not any(d.get("status") == "approved" for d in deals):
            continue
        try:
            await db.partner_reports.insert_one({"partner_id": pid, "month": key, "status": "sending", "created_at": now_iso()})
        except DuplicateKeyError:
            continue
        try:
            stats = await partner_month_stats(deals, rng)
            subject, html = partner_report_email(p.get("name", ""), p.get("business_name") or "Your business", label, stats)
            await send_email(to=p["email"], subject=subject, html=html)
            await db.partner_reports.update_one({"partner_id": pid, "month": key}, {"$set": {
                "status": "sent", "sent_at": now_iso(), "redeemed": stats["redeemed"], "saved": stats["saved"]}})
            sent += 1
        except Exception as e:
            logger.warning("partner report failed for %s: %s", p.get("email"), e)
            await db.partner_reports.delete_one({"partner_id": pid, "month": key})
            failed += 1
    if sent or failed:
        await log_activity(None, "reports.sent", "system", key, f"{label} partner reports",
                           f"Emailed {sent} partner{'s' if sent != 1 else ''}" + (f" · {failed} couldn't be sent" if failed else ""))
    logger.info("partner reports for %s: sent %s, failed %s", key, sent, failed)
    return {"month": key, "sent": sent, "failed": failed}
