"""Member area: live card, vouchers, savings, favourites and gifts."""
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends
from pymongo.errors import DuplicateKeyError

from core import db, oid, now_iso, rand_code, make_live_token
from deps import user_out, current_user
from models import Deal, Voucher, RedeemIn, GiftRedeemIn
from services import used_this_term, activate_membership, referral_months_this_year, REFERRAL_CAP
import os

router = APIRouter()

ONCE_PER_TERM = "You've already used this deal this membership year. It unlocks again when you renew."


@router.get("/me/live-card")
async def live_card(user=Depends(current_user)):
    if user["role"] != "member" or user.get("membership_status") != "active" or not user.get("member_code"):
        raise HTTPException(400, "No active member card")
    token, secs = make_live_token(user["member_code"])
    return {"token": token, "refresh_in": secs, "server_time": now_iso()}


@router.get("/me/to-review")
async def to_review(user=Depends(current_user)):
    if user["role"] != "member":
        return []
    used = await db.vouchers.find({"user_id": user["id"], "status": "redeemed"}, {"deal_id": 1, "deal_title": 1, "business_name": 1, "redeemed_at": 1}).sort("redeemed_at", -1).to_list(200)
    done = set(await db.reviews.distinct("deal_id", {"user_id": user["id"]}))
    seen, out = set(), []
    for v in used:
        if v["deal_id"] in done or v["deal_id"] in seen:
            continue
        seen.add(v["deal_id"])
        out.append({"deal_id": v["deal_id"], "deal_title": v.get("deal_title"), "business_name": v.get("business_name"), "redeemed_at": v.get("redeemed_at")})
    return out[:5]


@router.get("/deals/{deal_id}/my-status")
async def my_deal_status(deal_id: str, user=Depends(current_user)):
    used = await used_this_term(user, deal_id)
    active = await db.vouchers.find_one({"user_id": user["id"], "deal_id": deal_id, "status": "active",
                                         "expires_at": {"$gt": now_iso()}})
    return {"used_this_term": bool(used), "used_at": (used or {}).get("redeemed_at"),
            "active_voucher": Voucher.from_mongo(active).out() if active else None}


@router.post("/deals/{deal_id}/voucher")
async def claim_voucher(deal_id: str, user=Depends(current_user)):
    if user["membership_status"] != "active" and user["role"] != "admin":
        raise HTTPException(402, "An active membership is required to claim vouchers")
    deal = await db.deals.find_one({"_id": oid(deal_id), "status": "approved"})
    if not deal:
        raise HTTPException(404, "Deal not found")
    if await used_this_term(user, deal_id):
        raise HTTPException(409, ONCE_PER_TERM)
    existing = await db.vouchers.find_one({"user_id": user["id"], "deal_id": deal_id, "status": "active",
                                           "expires_at": {"$gt": now_iso()}})
    if existing:
        return Voucher.from_mongo(existing).out()
    v = Voucher(user_id=user["id"], deal_id=deal_id, deal_title=deal["title"], business_name=deal["business_name"],
                discount_label=deal["discount_label"], code=f"{rand_code(4)}-{rand_code(4)}",
                partner_id=deal.get("submitted_by"), est_saving=deal.get("est_saving", 0),
                expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat())
    res = await db.vouchers.insert_one(v.to_mongo())
    v.id = str(res.inserted_id)
    return v.out()


@router.get("/me/vouchers")
async def my_vouchers(user=Depends(current_user)):
    docs = await db.vouchers.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    out = []
    for d in docs:
        v = Voucher.from_mongo(d).out()
        if v["status"] == "active" and v["expires_at"] < now_iso():
            v["status"] = "expired"
        out.append(v)
    return out


@router.post("/me/vouchers/{voucher_id}/redeem")
async def redeem_voucher(voucher_id: str, body: RedeemIn = RedeemIn(), user=Depends(current_user)):
    v = await db.vouchers.find_one({"_id": oid(voucher_id), "user_id": user["id"], "status": "active"})
    if not v:
        raise HTTPException(404, "Voucher not found or already used")
    if await used_this_term(user, v["deal_id"], v["_id"]):
        raise HTTPException(409, ONCE_PER_TERM)
    saved = body.amount_saved if body.amount_saved is not None else v.get("est_saving", 0)
    await db.vouchers.update_one({"_id": v["_id"]}, {"$set": {"status": "redeemed", "redeemed_at": now_iso(), "amount_saved": saved}})
    return {"ok": True}


@router.get("/me/savings")
async def my_savings(user=Depends(current_user)):
    docs = await db.vouchers.find({"user_id": user["id"], "status": "redeemed"}).to_list(1000)
    total = round(sum(d.get("amount_saved") or 0 for d in docs), 2)
    by_business = {}
    for d in docs:
        by_business[d["business_name"]] = round(by_business.get(d["business_name"], 0) + (d.get("amount_saved") or 0), 2)
    return {"total_saved": total, "redeemed_count": len(docs), "membership_price": 49.0,
            "net": round(total - 49.0, 2), "by_business": [{"business_name": k, "saved": v} for k, v in by_business.items()]}


# ---------- Favourites ----------
@router.get("/me/favorites")
async def my_favorites(user=Depends(current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}).sort("created_at", -1).to_list(500)
    ids = [f["deal_id"] for f in favs]
    docs = await db.deals.find({"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}, "status": "approved"}).to_list(500)
    by_id = {str(d["_id"]): Deal.from_mongo(d).out() for d in docs}
    return [by_id[i] for i in ids if i in by_id]


@router.get("/me/favorite-ids")
async def my_favorite_ids(user=Depends(current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}, {"deal_id": 1}).to_list(500)
    return [f["deal_id"] for f in favs]


@router.post("/me/favorites/{deal_id}")
async def toggle_favorite(deal_id: str, user=Depends(current_user)):
    if not await db.deals.find_one({"_id": oid(deal_id), "status": "approved"}):
        raise HTTPException(404, "Deal not found")
    res = await db.favorites.delete_one({"user_id": user["id"], "deal_id": deal_id})
    if res.deleted_count:
        return {"favorited": False}
    await db.favorites.update_one({"user_id": user["id"], "deal_id": deal_id},
                                  {"$setOnInsert": {"created_at": now_iso()}}, upsert=True)
    return {"favorited": True}


# ---------- Referrals ----------
@router.get("/me/referral")
async def my_referral(user=Depends(current_user)):
    if user["role"] != "member":
        raise HTTPException(403, "Only members have a referral link")
    doc = await db.users.find_one({"_id": oid(user["id"])}, {"referral_code": 1, "bonus_days_pending": 1})
    code = doc.get("referral_code")
    while not code:
        try:
            candidate = f"REF{rand_code(6)}"
            await db.users.update_one({"_id": doc["_id"], "referral_code": {"$exists": False}}, {"$set": {"referral_code": candidate}})
            code = (await db.users.find_one({"_id": doc["_id"]}, {"referral_code": 1})).get("referral_code")
        except DuplicateKeyError:
            continue
    friends = await db.users.find({"referred_by": user["id"]}, {"name": 1, "created_at": 1, "referral_rewarded": 1}).sort("created_at", -1).to_list(200)
    return {"code": code, "link": f"{os.environ['FRONTEND_URL'].rstrip('/')}/join?ref={code}",
            "months_this_year": await referral_months_this_year(user["id"]), "cap": REFERRAL_CAP,
            "pending_days": doc.get("bonus_days_pending") or 0,
            "friends": [{"first_name": (f.get("name") or "Friend").split(" ")[0], "joined_at": f.get("created_at"),
                         "paid": bool(f.get("referral_rewarded"))} for f in friends]}


@router.get("/referrals/{code}")
async def referral_info(code: str):
    r = await db.users.find_one({"referral_code": code.strip().upper(), "role": "member"}, {"name": 1})
    if not r:
        raise HTTPException(404, "This invite link isn't valid")
    return {"first_name": (r.get("name") or "A friend").split(" ")[0]}


# ---------- Gifts ----------
@router.get("/me/gifts")
async def my_gifts(user=Depends(current_user)):
    return await db.gifts.find({"buyer_id": user["id"]}, {"_id": 0, "session_id": 0}).sort("created_at", -1).to_list(100)


@router.get("/gifts/{code}")
async def gift_info(code: str):
    g = await db.gifts.find_one({"code": code.strip().upper()})
    if not g:
        raise HTTPException(404, "Gift code not found")
    buyer = await db.users.find_one({"_id": oid(g["buyer_id"])})
    return {"recipient_name": g["recipient_name"], "from_name": (buyer or {}).get("name", "A friend").split(" ")[0],
            "message": g.get("message", ""), "status": g["status"]}


@router.post("/gifts/redeem")
async def redeem_gift(body: GiftRedeemIn, user=Depends(current_user)):
    g = await db.gifts.find_one_and_update(
        {"code": body.code.strip().upper(), "status": "unredeemed"},
        {"$set": {"status": "redeemed", "redeemed_by": user["id"], "redeemed_at": now_iso()}})
    if not g:
        raise HTTPException(400, "This gift code is invalid or has already been used")
    await activate_membership(user["id"])
    return user_out(await db.users.find_one({"_id": oid(user["id"])}))
