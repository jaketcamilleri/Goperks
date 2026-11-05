"""Launch-week offer: half price first year for new members between admin-set dates (Melbourne time)."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db, now_iso, melb_today
from deps import require_role
from services import log_activity

router = APIRouter()
owner = require_role("admin")
LAUNCH_DISCOUNT_CENTS = 2450  # A$49 -> A$24.50


class LaunchIn(BaseModel):
    enabled: bool
    starts_on: date
    ends_on: date


async def launch_settings() -> dict:
    doc = await db.settings.find_one({"_id": "launch"}) or {}
    return {"enabled": bool(doc.get("enabled")), "starts_on": doc.get("starts_on", ""), "ends_on": doc.get("ends_on", "")}


async def active_launch() -> dict | None:
    s = await launch_settings()
    if s["enabled"] and s["starts_on"] <= melb_today() <= s["ends_on"]:
        return s
    return None


@router.get("/launch-offer")
async def public_launch_offer():
    s = await active_launch()
    if not s:
        return {"active": False}
    return {"active": True, "ends_on": s["ends_on"], "price": 24.5, "full_price": 49}


async def launch_signups() -> dict:
    paid = {"kind": "membership", "launch_offer": True, "payment_status": "paid"}
    rows = await db.payment_transactions.aggregate([
        {"$match": paid}, {"$group": {"_id": None, "n": {"$sum": 1}, "revenue": {"$sum": "$amount"}}},
    ]).to_list(1)
    r = rows[0] if rows else {}
    return {"signups": r.get("n", 0), "revenue": round(r.get("revenue", 0), 2)}


@router.get("/admin/launch-offer")
async def get_launch_offer(_=Depends(owner)):
    s = await launch_settings()
    return {**s, "live": bool(await active_launch()), **await launch_signups()}


@router.put("/admin/launch-offer")
async def set_launch_offer(body: LaunchIn, user=Depends(owner)):
    if body.ends_on < body.starts_on:
        raise HTTPException(400, "The end date must be on or after the start date")
    data = {"enabled": body.enabled, "starts_on": body.starts_on.isoformat(), "ends_on": body.ends_on.isoformat()}
    await db.settings.update_one({"_id": "launch"}, {"$set": {**data, "updated_at": now_iso()}}, upsert=True)
    await log_activity(user, "settings.launch_offer", "settings", None, "Launch offer",
                       f"{'On' if body.enabled else 'Off'}: {data['starts_on']} to {data['ends_on']}")
    return {**data, "live": bool(await active_launch()), **await launch_signups()}
