"""Prospects: businesses the owner might sign up as partners, with follow-ups, a map and an optional partner pitch email."""
import asyncio
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, logger, oid, now_iso, find_suburb, geocode_street, CATEGORIES
from deps import require_role
from email_service import send_email
from email_templates import partner_pitch_email
from models import BaseDocument
from routes.invites import unsubscribe_url
from services import log_activity

router = APIRouter(prefix="/admin/prospects")
owner = require_role("admin")
STATUSES = ("new", "contacted", "interested", "joined", "not_interested")
FOLLOW_UP_DAYS = 7
SEED_FILE = Path(__file__).parent.parent / "prospects_seed.json"
LOCATION_FIELDS = ("address", "suburb", "postcode")


class Prospect(BaseDocument):
    business_name: str
    category: str = "essentials"
    address: str = ""
    suburb: str = ""
    postcode: str = ""
    website: str = ""
    email: str = ""
    phone: str = ""
    source_url: str = ""
    status: str = "new"
    notes: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    located: str = "none"
    contacted_at: Optional[str] = None
    pitch_status: Optional[str] = None
    pitched_at: Optional[str] = None
    pitch_error: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class ProspectIn(BaseModel):
    business_name: str = Field(min_length=1, max_length=120)
    category: str = "essentials"
    address: str = Field("", max_length=200)
    suburb: str = Field("", max_length=80)
    postcode: str = Field("", max_length=4)
    website: str = Field("", max_length=200)
    email: str = Field("", max_length=200)
    phone: str = Field("", max_length=30)
    status: str = "new"
    notes: str = Field("", max_length=1000)


class ProspectPatch(BaseModel):
    business_name: Optional[str] = Field(None, min_length=1, max_length=120)
    category: Optional[str] = None
    address: Optional[str] = Field(None, max_length=200)
    suburb: Optional[str] = Field(None, max_length=80)
    postcode: Optional[str] = Field(None, max_length=4)
    website: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=30)
    status: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=1000)


class PitchIn(BaseModel):
    ids: List[str] = Field(min_length=1, max_length=200)
    note: str = Field("", max_length=300)


def check(data: dict):
    if "category" in data and data["category"] not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if "status" in data and data["status"] not in STATUSES:
        raise HTTPException(400, "Invalid status")
    if data.get("email") and "@" not in data["email"]:
        raise HTTPException(400, "That email doesn't look right")
    if data.get("suburb") and not find_suburb(data["suburb"], data.get("postcode") or None):
        raise HTTPException(400, "Please pick the suburb and postcode from the list")


async def locate(data: dict) -> dict:
    """Pin at the street address when there is one, otherwise at the suburb centre."""
    place = find_suburb(data.get("suburb", ""), data.get("postcode") or None)
    if place:
        data["suburb"], data["postcode"] = place["name"], place["postcode"]
    lat = lng = None
    if data.get("address") and place:
        lat, lng = await geocode_street(data["address"], place["name"], place["postcode"])
    if lat is not None:
        data.update(lat=lat, lng=lng, located="exact")
    elif place:
        data.update(lat=place["lat"], lng=place["lng"], located="suburb")
    else:
        data.update(lat=None, lng=None, located="none")
    return data


def out(doc: dict) -> dict:
    p = Prospect.from_mongo(doc).out()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=FOLLOW_UP_DAYS)).isoformat()
    p["follow_up"] = p["status"] == "contacted" and bool(p["contacted_at"]) and p["contacted_at"] < cutoff
    return p


async def seed_prospects():
    """Load the researched starter list when empty; fill in map details on older copies of it."""
    if not SEED_FILE.exists():
        return
    rows = json.loads(SEED_FILE.read_text())
    if not await db.prospects.count_documents({}):
        await db.prospects.insert_many([Prospect(**r).to_mongo() for r in rows])
        return
    for r in rows:
        await db.prospects.update_one({"business_name": r["business_name"], "postcode": {"$exists": False}}, {"$set": {
            k: r.get(k) for k in ("address", "postcode", "lat", "lng", "located")}})


@router.get("")
async def list_prospects(_=Depends(owner)):
    rows = await db.prospects.find({}).sort("business_name", 1).to_list(5000)
    return [out(r) for r in rows]


@router.post("")
async def add_prospect(body: ProspectIn, _=Depends(owner)):
    data = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items()}
    check(data)
    if data["status"] == "contacted":
        data["contacted_at"] = now_iso()
    p = Prospect(**(await locate(data)), source_url="Added by you")
    res = await db.prospects.insert_one(p.to_mongo())
    return out(await db.prospects.find_one({"_id": res.inserted_id}))


@router.get("/pitch-preview")
async def pitch_preview(note: str = "", user=Depends(owner)):
    subject, html = partner_pitch_email("[Business name]", user.get("name", ""), note.strip()[:300], unsubscribe_url("preview@example.com"))
    return {"subject": subject, "html": html}


async def deliver_pitches(ids: list, sender: str, note: str):
    for pid in ids:
        p = await db.prospects.find_one({"_id": pid, "pitch_status": "queued"})
        if not p:
            continue
        try:
            subject, html = partner_pitch_email(p["business_name"], sender, note, unsubscribe_url(p["email"]))
            await send_email(to=p["email"], subject=subject, html=html, reply_to=os.environ["SUPER_ADMIN_EMAIL"])
            now = now_iso()
            sets = {"pitch_status": "sent", "pitched_at": now, "pitch_error": None, "updated_at": now}
            if p.get("status") == "new":
                sets.update(status="contacted", contacted_at=now)
            await db.prospects.update_one({"_id": pid}, {"$set": sets})
        except Exception as e:
            detail = str(getattr(e, "detail", None) or e)[:200]
            logger.warning("pitch to %s failed: %s", p["email"], detail)
            await db.prospects.update_one({"_id": pid}, {"$set": {"pitch_status": "failed", "pitch_error": detail}})


@router.post("/pitch")
async def send_pitch(body: PitchIn, user=Depends(owner)):
    queued, skipped = [], []
    for doc in await db.prospects.find({"_id": {"$in": [oid(i) for i in body.ids]}}).to_list(200):
        email = (doc.get("email") or "").strip().lower()
        reason = ("has no email" if "@" not in email
                  else "unsubscribed" if await db.email_optouts.find_one({"email": email})
                  else "was already sent a pitch" if doc.get("pitch_status") in ("queued", "sent") else None)
        if reason:
            skipped.append({"business_name": doc["business_name"], "reason": reason})
            continue
        await db.prospects.update_one({"_id": doc["_id"]}, {"$set": {"pitch_status": "queued", "pitch_error": None}})
        queued.append(doc["_id"])
    if queued:
        await log_activity(user, "pitch.sent", "prospect", None, f"{len(queued)} partner pitch{'es' if len(queued) != 1 else ''}",
                           " · ".join(x for x in (f"{len(skipped)} skipped" if skipped else "", f"Note: {body.note.strip()}" if body.note.strip() else "") if x))
        asyncio.create_task(deliver_pitches(queued, user.get("name", ""), body.note.strip()))
    return {"queued": len(queued), "skipped": skipped}


@router.patch("/{prospect_id}")
async def update_prospect(prospect_id: str, body: ProspectPatch, _=Depends(owner)):
    prev = await db.prospects.find_one({"_id": oid(prospect_id)})
    if not prev:
        raise HTTPException(404, "Prospect not found")
    data = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    merged = {**prev, **data}
    check({k: v for k, v in data.items() if k not in ("suburb", "postcode")})
    if "suburb" in data or "postcode" in data:
        check({"suburb": merged.get("suburb"), "postcode": merged.get("postcode")})
    if any(k in data and data[k] != (prev.get(k) or "") for k in LOCATION_FIELDS):
        data.update({k: v for k, v in (await locate({k: merged.get(k) or "" for k in LOCATION_FIELDS})).items()})
    if data.get("status") == "contacted" and prev.get("status") != "contacted":
        data["contacted_at"] = now_iso()
    res = await db.prospects.find_one_and_update({"_id": prev["_id"]}, {"$set": {**data, "updated_at": now_iso()}}, return_document=True)
    return out(res)


@router.delete("/{prospect_id}")
async def delete_prospect(prospect_id: str, _=Depends(owner)):
    await db.prospects.delete_one({"_id": oid(prospect_id)})
    return {"ok": True}
