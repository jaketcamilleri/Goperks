"""Public deal browsing and member reviews."""
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, Depends

from core import db, oid, now_iso, logo_url, is_open_now, MELB, PROFILE_FIELDS, VIC_SUBURBS
from deps import current_user, optional_user
from models import Deal, ReviewIn
from services import review_out, refresh_rating

router = APIRouter()


@router.get("/deals")
async def list_deals(category: Optional[str] = None, q: Optional[str] = None, suburb: Optional[str] = None):
    today = datetime.now(MELB).date().isoformat()
    query = {"status": "approved", "$and": [{"$or": [{"ends_on": None}, {"ends_on": {"$gte": today}}]}]}
    if category and category != "all":
        query["category"] = category
    if suburb:
        query["suburb"] = suburb
    if q:
        rx = re.escape(q.strip()[:60])
        query["$and"].append({"$or": [{f: {"$regex": rx, "$options": "i"}} for f in ("title", "business_name", "suburb", "description")]})
    docs = await db.deals.find(query).sort([("featured", -1), ("created_at", -1)]).to_list(200)
    owner_ids = list({oid(d["submitted_by"]) for d in docs if d.get("submitted_by")})
    owners = {str(o["_id"]): o async for o in db.users.find(
        {"_id": {"$in": owner_ids}, "role": "business", "business_status": "approved"}, {"hours": 1})}
    out = []
    for d in docs:
        item = Deal.from_mongo(d).out()
        item["open_now"] = is_open_now((owners.get(d.get("submitted_by") or "") or {}).get("hours"))
        out.append(item)
    return out


@router.get("/deals/{deal_id}")
async def get_deal(deal_id: str):
    doc = await db.deals.find_one({"_id": oid(deal_id), "status": "approved"})
    if not doc:
        raise HTTPException(404, "Deal not found")
    out = Deal.from_mongo(doc).out()
    out["ended"] = bool(doc.get("ends_on") and doc["ends_on"] < datetime.now(MELB).date().isoformat())
    owner = await db.users.find_one({"_id": oid(doc["submitted_by"]), "role": "business"}) if doc.get("submitted_by") else None
    if owner and owner.get("business_status") == "approved":
        out["partner"] = {k: owner.get(k) for k in PROFILE_FIELDS} | {
            "photos": [logo_url(p) for p in owner.get("photos") or []], "open_now": is_open_now(owner.get("hours")),
            "business_name": owner.get("business_name"), "logo_url": logo_url(owner.get("logo_path"))}
    return out


@router.get("/suburbs")
async def list_suburbs():
    subs = await db.deals.distinct("suburb", {"status": "approved"})
    return sorted(s for s in subs if s)


@router.get("/places/vic-suburbs")
async def vic_suburbs(response: Response):
    response.headers["Cache-Control"] = "public, max-age=86400"
    return [{"name": s["name"], "postcode": s["postcode"]} for s in VIC_SUBURBS]


@router.get("/stats")
async def stats():
    deals = await db.deals.count_documents({"status": "approved"})
    suburbs = await db.deals.distinct("suburb", {"status": "approved"})
    return {"live_deals": deals, "suburbs": len([s for s in suburbs if s]), "price": 49.0, "currency": "AUD"}


async def has_redeemed(user_id: str, deal_id: str) -> bool:
    return bool(await db.vouchers.find_one({"user_id": user_id, "deal_id": deal_id, "status": "redeemed"}, {"_id": 1}))


@router.get("/deals/{deal_id}/reviews")
async def deal_reviews(deal_id: str, request: Request):
    rows = await db.reviews.find({"deal_id": deal_id, "hidden": {"$ne": True}}).sort("created_at", -1).to_list(200)
    user = await optional_user(request)
    mine = None
    can = False
    if user and user["role"] == "member":
        m = await db.reviews.find_one({"deal_id": deal_id, "user_id": user["id"]})
        mine = review_out(m) if m else None
        can = await has_redeemed(user["id"], deal_id)
    return {"reviews": [review_out(r) for r in rows], "mine": mine, "can_review": can}


@router.post("/deals/{deal_id}/reviews")
async def post_review(deal_id: str, body: ReviewIn, user=Depends(current_user)):
    if user["role"] != "member":
        raise HTTPException(403, "Only members can leave reviews")
    if not await db.deals.find_one({"_id": oid(deal_id)}, {"_id": 1}):
        raise HTTPException(404, "Deal not found")
    if not await has_redeemed(user["id"], deal_id):
        raise HTTPException(403, "You can review a deal after you've used it")
    now = now_iso()
    await db.reviews.update_one(
        {"deal_id": deal_id, "user_id": user["id"]},
        {"$set": {"rating": body.rating, "comment": body.comment.strip(), "user_name": user.get("name", ""), "updated_at": now},
         "$setOnInsert": {"created_at": now, "hidden": False}}, upsert=True)
    await refresh_rating(deal_id)
    return review_out(await db.reviews.find_one({"deal_id": deal_id, "user_id": user["id"]}))


@router.get("/reviews/highlights")
async def review_highlights():
    rows = await db.reviews.find({"hidden": {"$ne": True}, "rating": {"$gte": 4}, "comment": {"$regex": ".{20,}"}}).sort("created_at", -1).to_list(6)
    titles = {str(d["_id"]): d for d in await db.deals.find({"_id": {"$in": [oid(r["deal_id"]) for r in rows]}}, {"title": 1, "business_name": 1}).to_list(6)}
    return [review_out(r) | {"deal_title": titles.get(r["deal_id"], {}).get("title"), "business_name": titles.get(r["deal_id"], {}).get("business_name")}
            for r in rows if r["deal_id"] in titles]
