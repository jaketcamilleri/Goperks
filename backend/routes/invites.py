"""Member invites: the owner emails customers a ready-made 'join Go Perks' message; customers can unsubscribe."""
import asyncio
import os
import re
from datetime import timedelta
from typing import List, Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, logger, now_iso, make_token, JWT_ALGORITHM
from deps import require_role
from email_service import send_email
from email_templates import invite_email, template
from models import BaseDocument
from services import log_activity

router = APIRouter()
owner = require_role("admin")
EMAIL_RX = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I)
SKIP_REASONS = {"invalid": "isn't a valid email", "duplicate": "is listed twice", "has_account": "already has an account",
                "already_invited": "was already invited", "unsubscribed": "unsubscribed"}


class Invite(BaseDocument):
    email: str
    name: str = ""
    note: str = ""
    template: str = "invite"
    status: str = "queued"
    error: Optional[str] = None
    sent_by: Optional[str] = None
    sent_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Person(BaseModel):
    email: str = Field(max_length=200)
    name: str = Field("", max_length=80)


class InvitesIn(BaseModel):
    people: List[Person] = Field(min_length=1, max_length=200)
    note: str = Field("", max_length=300)
    template: str = Field("invite", max_length=40)


class UnsubscribeIn(BaseModel):
    token: str = Field(min_length=10, max_length=600)


def unsubscribe_url(email: str) -> str:
    token = make_token(email, "unsubscribe", timedelta(days=3650))
    return f"{os.environ['FRONTEND_URL'].rstrip('/')}/unsubscribe?token={token}"


async def deliver(invite_ids: list):
    """Send queued invites one by one so a slow or failing email doesn't hold up the request."""
    for iid in invite_ids:
        inv = await db.invites.find_one({"_id": iid, "status": "queued"})
        if not inv:
            continue
        if await db.email_optouts.find_one({"email": inv["email"]}):
            await db.invites.update_one({"_id": iid}, {"$set": {"status": "failed", "error": "Unsubscribed"}})
            continue
        try:
            subject, html = invite_email(inv.get("name", ""), inv.get("note", ""), unsubscribe_url(inv["email"]), inv.get("template") or "invite")
            await send_email(to=inv["email"], subject=subject, html=html)
            await db.invites.update_one({"_id": iid}, {"$set": {"status": "sent", "sent_at": now_iso(), "error": None}})
        except Exception as e:
            detail = getattr(e, "detail", None) or str(e)
            logger.warning("invite to %s failed: %s", inv["email"], detail)
            await db.invites.update_one({"_id": iid}, {"$set": {"status": "failed", "error": str(detail)[:200]}})


@router.post("/admin/invites")
async def send_invites(body: InvitesIn, user=Depends(owner)):
    if template(body.template)["base"] != "invite":
        raise HTTPException(400, "Pick a member invite template")
    seen, queued, skipped = set(), [], []
    for p in body.people:
        email, name = p.email.strip().lower(), p.name.strip()
        reason = None
        if not EMAIL_RX.match(email):
            reason = "invalid"
        elif email in seen:
            reason = "duplicate"
        elif await db.users.find_one({"email": email}, {"_id": 1}):
            reason = "has_account"
        elif await db.email_optouts.find_one({"email": email}):
            reason = "unsubscribed"
        elif await db.invites.find_one({"email": email, "status": {"$in": ["queued", "sent"]}}, {"_id": 1}):
            reason = "already_invited"
        seen.add(email)
        if reason:
            skipped.append({"email": email or p.email, "reason": SKIP_REASONS[reason]})
            continue
        doc = Invite(email=email, name=name, note=body.note.strip(), template=body.template, sent_by=user["id"]).to_mongo()
        prev = await db.invites.find_one_and_update({"email": email, "status": "failed"}, {"$set": {**doc, "error": None}})
        queued.append(prev["_id"] if prev else (await db.invites.insert_one(doc)).inserted_id)
    if queued:
        await log_activity(user, "invites.sent", "invite", None, f"{len(queued)} member invite{'s' if len(queued) != 1 else ''}",
                           " · ".join(x for x in (f"{len(skipped)} skipped" if skipped else "", f"Note: {body.note.strip()}" if body.note.strip() else "") if x))
        asyncio.create_task(deliver(queued))
    return {"queued": len(queued), "skipped": skipped}


@router.post("/admin/invites/retry")
async def retry_failed(user=Depends(owner)):
    rows = await db.invites.find({"status": "failed", "error": {"$ne": "Unsubscribed"}}, {"_id": 1, "email": 1}).to_list(1000)
    ids = []
    for r in rows:
        if not await db.users.find_one({"email": r["email"]}, {"_id": 1}):
            ids.append(r["_id"])
    if ids:
        await db.invites.update_many({"_id": {"$in": ids}}, {"$set": {"status": "queued", "error": None}})
        await log_activity(user, "invites.retried", "invite", None, f"{len(ids)} member invite{'s' if len(ids) != 1 else ''}", "Retried failed sends")
        asyncio.create_task(deliver(ids))
    return {"queued": len(ids)}


@router.get("/admin/invites")
async def list_invites(_=Depends(owner)):
    rows = await db.invites.find({}).sort("created_at", -1).to_list(5000)
    emails = [r["email"] for r in rows]
    joined = {u["email"]: u for u in await db.users.find({"email": {"$in": emails}}, {"email": 1, "membership_status": 1}).to_list(5000)}
    opted = set(await db.email_optouts.distinct("email", {"email": {"$in": emails}}))
    out = []
    for r in rows:
        item = Invite.from_mongo(r).out()
        u = joined.get(r["email"])
        item["joined"] = bool(u)
        item["member"] = bool(u and u.get("membership_status") == "active")
        item["unsubscribed"] = r["email"] in opted
        out.append(item)
    return out


@router.post("/invites/unsubscribe")
async def unsubscribe(body: UnsubscribeIn):
    try:
        payload = jwt.decode(body.token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(400, "This unsubscribe link isn't valid")
    if payload.get("type") != "unsubscribe":
        raise HTTPException(400, "This unsubscribe link isn't valid")
    email = payload["sub"].lower()
    await db.email_optouts.update_one({"email": email}, {"$setOnInsert": {"email": email, "created_at": now_iso()}}, upsert=True)
    return {"ok": True, "email": email}
