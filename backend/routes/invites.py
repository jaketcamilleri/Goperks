"""Member invites: the owner sends a ready-made 'join Go Perks' message from their own email account; we track who was invited."""
import os
import re
from typing import List, Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, now_iso, JWT_ALGORITHM
from deps import require_role
from email_templates import invite_text, template
from models import BaseDocument
from services import log_activity

router = APIRouter()
owner = require_role("admin")
EMAIL_RX = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I)
SKIP_REASONS = {"invalid": "isn't a valid email", "duplicate": "is listed twice", "has_account": "already has an account",
                "already_invited": "was already invited", "unsubscribed": "asked not to be contacted"}


class Invite(BaseDocument):
    email: str
    name: str = ""
    note: str = ""
    template: str = "invite"
    status: str = "sent"
    error: Optional[str] = None
    sent_by: Optional[str] = None
    sent_at: Optional[str] = None
    followed_up_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Person(BaseModel):
    email: str = Field(max_length=200)
    name: str = Field("", max_length=80)


class InvitesIn(BaseModel):
    people: List[Person] = Field(min_length=1, max_length=200)
    note: str = Field("", max_length=300)
    template: str = Field("invite", max_length=40)


class InviteSentIn(Person):
    note: str = Field("", max_length=300)
    template: str = Field("invite", max_length=40)


class UnsubscribeIn(BaseModel):
    token: str = Field(min_length=10, max_length=600)


def invite_key(key: str, base: str = "invite") -> str:
    if template(key)["base"] != base:
        raise HTTPException(400, "Pick a member invite template" if base == "invite" else "Pick a follow-up template")
    return key


class FollowUpIn(BaseModel):
    note: str = Field("", max_length=300)
    template: str = Field("invite_followup", max_length=40)


class FollowUpSentIn(BaseModel):
    email: str = Field(max_length=200)


async def follow_up_candidates():
    """Invited people who haven't joined, haven't opted out and haven't had a follow-up yet."""
    rows = await db.invites.find({"status": "sent", "followed_up_at": None}).sort("sent_at", 1).to_list(2000)
    emails = [r["email"] for r in rows]
    joined = set(await db.users.distinct("email", {"email": {"$in": emails}}))
    opted = set(await db.email_optouts.distinct("email", {"email": {"$in": emails}}))
    return [Invite.from_mongo(r) for r in rows if r["email"] not in joined and r["email"] not in opted]


@router.get("/admin/invites/followup")
async def follow_up_count(_=Depends(owner)):
    return {"count": len(await follow_up_candidates())}


@router.post("/admin/invites/followup")
async def follow_up_drafts(body: FollowUpIn, user=Depends(owner)):
    """Ready-written follow-ups (a nudge after the first invite) for the owner to send from their own email."""
    key = invite_key(body.template, "invite_followup")
    drafts = []
    for r in (await follow_up_candidates())[:200]:
        subject, text = invite_text(r.name, body.note.strip(), user.get("name", ""), key)
        drafts.append({"id": r.email, "name": r.name or r.email, "to": r.email, "subject": subject, "body": text})
    return {"drafts": drafts, "skipped": [], "template": key}


@router.post("/admin/invites/followup-sent")
async def mark_follow_up_sent(body: FollowUpSentIn, user=Depends(owner)):
    email = body.email.strip().lower()
    res = await db.invites.update_one({"email": email, "status": "sent"}, {"$set": {"followed_up_at": now_iso()}})
    if not res.matched_count:
        raise HTTPException(404, "No invite for that email")
    await log_activity(user, "invites.followup", "invite", None, email, "Follow-up sent from your email")
    return {"ok": True}


@router.post("/admin/invites")
async def invite_drafts(body: InvitesIn, user=Depends(owner)):
    """Ready-written invites for the owner to send from their own email account (nothing is sent from here)."""
    key = invite_key(body.template)
    seen, drafts, skipped = set(), [], []
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
        elif await db.invites.find_one({"email": email, "status": "sent"}, {"_id": 1}):
            reason = "already_invited"
        seen.add(email)
        if reason:
            skipped.append({"email": email or p.email, "reason": SKIP_REASONS[reason]})
            continue
        subject, text = invite_text(name, body.note.strip(), user.get("name", ""), key)
        drafts.append({"id": email, "name": name or email, "to": email, "subject": subject, "body": text})
    return {"drafts": drafts, "skipped": skipped, "template": key}


@router.post("/admin/invites/sent")
async def mark_invite_sent(body: InviteSentIn, user=Depends(owner)):
    """The owner sent this invite from their own email: record it so they're not invited twice."""
    key = invite_key(body.template)
    email = body.email.strip().lower()
    if not EMAIL_RX.match(email):
        raise HTTPException(400, "That email isn't valid")
    doc = Invite(email=email, name=body.name.strip(), note=body.note.strip(), template=key, sent_by=user["id"], sent_at=now_iso()).to_mongo()
    await db.invites.update_one({"email": email}, {"$set": doc}, upsert=True)
    await log_activity(user, "invites.sent", "invite", None, email, "Sent from your email")
    return {"ok": True}


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
