"""Partner portal: counter checks, deal submissions, business profile, photos and stats."""
import asyncio
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Response, Depends, UploadFile, File

import storage
from core import db, logger, oid, now_iso, rand_code, with_coords, hours_text, check_live_token, find_suburb, CATEGORIES, DAYS
from deps import user_out, require_partner, require_approved_business
from models import Deal, Voucher, DealIn, CodeIn, CardRedeemIn, ProfileIn, PhotoPathIn
from services import used_this_term, review_out

router = APIRouter()

LOGO_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
MAX_PHOTOS = 6


# ---------- Counter check ----------
async def find_partner_voucher(code: str, user: dict):
    """A business can only see and redeem vouchers for deals that belong to it right now."""
    v = await db.vouchers.find_one({"code": code.strip().upper()})
    if v and user["role"] not in ("admin", "staff"):
        deal = await db.deals.find_one({"_id": oid(v["deal_id"])}, {"submitted_by": 1})
        if not deal or deal.get("submitted_by") != user["id"]:
            v = None
    if not v:
        raise HTTPException(404, "No voucher with that code for your business")
    return v


@router.post("/partner/check")
async def partner_check(body: CodeIn, user=Depends(require_partner)):
    code = body.code.strip().upper()
    live = "typed"
    if code.startswith("GPL."):
        tcode, live = check_live_token(code)
        if live == "invalid":
            raise HTTPException(400, "This QR code isn't a genuine Go Perks card")
        code = tcode
    if code.startswith(("GP-", "LP-", "TV-")):
        m = await db.users.find_one({"member_code": code})
        if not m:
            raise HTTPException(404, "No member with that card number")
        info = user_out(m)
        q = {"status": "approved"} if user["role"] in ("admin", "staff") else {"status": "approved", "submitted_by": user["id"]}
        deals = await db.deals.find(q).sort("title", 1).to_list(200)
        rows = []
        for d in deals:
            used = await used_this_term(info, str(d["_id"]))
            rows.append({"deal_id": str(d["_id"]), "title": d["title"], "discount_label": d["discount_label"],
                         "used_this_term": bool(used), "used_at": (used or {}).get("redeemed_at")})
        return {"type": "member", "member_name": info["name"].split(" ")[0], "member_code": code, "live": live,
                "status": info["membership_status"], "expires_at": info["membership_expires_at"], "deals": rows}
    v = Voucher.from_mongo(await find_partner_voucher(code, user)).out()
    if v["status"] == "active" and v["expires_at"] < now_iso():
        v["status"] = "expired"
    member = await db.users.find_one({"_id": oid(v["user_id"])})
    return {"type": "voucher", "code": v["code"], "status": v["status"], "deal_title": v["deal_title"],
            "discount_label": v["discount_label"], "expires_at": v["expires_at"], "redeemed_at": v.get("redeemed_at"),
            "member_name": (member or {}).get("name", "Member").split(" ")[0]}


@router.post("/partner/redeem-card")
async def partner_redeem_card(body: CardRedeemIn, user=Depends(require_partner)):
    if body.live_token:
        tcode, state = check_live_token(body.live_token)
        if state != "live" or tcode != body.member_code.strip().upper():
            raise HTTPException(400, "This card code has expired — ask the member to show their live card and scan again")
    m = await db.users.find_one({"member_code": body.member_code.strip().upper()})
    if not m:
        raise HTTPException(404, "No member with that card number")
    member = user_out(m)
    if member["membership_status"] != "active":
        raise HTTPException(400, "This membership isn't active")
    deal = await db.deals.find_one({"_id": oid(body.deal_id), "status": "approved"})
    if not deal or (user["role"] not in ("admin", "staff") and deal.get("submitted_by") != user["id"]):
        raise HTTPException(404, "Deal not found for your business")
    if await used_this_term(member, body.deal_id):
        raise HTTPException(409, "This member has already used this deal in their current membership year")
    v = Voucher(user_id=member["id"], deal_id=body.deal_id, deal_title=deal["title"], business_name=deal["business_name"],
                discount_label=deal["discount_label"], code=f"CARD-{rand_code(6)}", status="redeemed",
                partner_id=deal.get("submitted_by"), est_saving=deal.get("est_saving", 0),
                amount_saved=deal.get("est_saving", 0), redeemed_at=now_iso(), expires_at=now_iso())
    await db.vouchers.insert_one({**v.to_mongo(), "redeemed_by": user["id"], "via": "card"})
    await db.vouchers.update_many({"user_id": member["id"], "deal_id": body.deal_id, "status": "active"},
                                  {"$set": {"status": "expired"}})
    return {"ok": True}


@router.post("/partner/redeem")
async def partner_redeem(body: CodeIn, user=Depends(require_partner)):
    v = await find_partner_voucher(body.code, user)
    if v["status"] != "active" or v["expires_at"] < now_iso():
        raise HTTPException(400, "This voucher has already been used or has expired")
    member = await db.users.find_one({"_id": oid(v["user_id"])})
    if member and await used_this_term(user_out(member), v["deal_id"], v["_id"]):
        raise HTTPException(409, "This member has already used this deal in their current membership year")
    await db.vouchers.update_one({"_id": v["_id"]}, {"$set": {
        "status": "redeemed", "redeemed_at": now_iso(), "amount_saved": v.get("est_saving", 0), "redeemed_by": user["id"]}})
    return {"ok": True}


# ---------- Deals ----------
@router.post("/business/deals")
async def submit_deal(body: DealIn, user=Depends(require_partner)):
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    data = body.model_dump(exclude={"featured", "partner_id"})
    data["business_name"] = user.get("business_name") or user["name"]
    data["suburb"] = data.get("suburb") or user.get("suburb") or ""
    data = await with_coords(data)
    d = Deal(**data, status="pending", submitted_by=user["id"])
    res = await db.deals.insert_one(d.to_mongo())
    d.id = str(res.inserted_id)
    return d.out()


@router.post("/deals/image")
async def upload_deal_image(file: UploadFile = File(...), user=Depends(require_partner)):
    """Photo for a deal card, used by partners and the admin team; returns the full image link."""
    path = await store_image(file, user, "deal", 5)
    return {"url": f"{os.environ['FRONTEND_URL'].rstrip('/')}/api/files/{path}"}


@router.get("/business/deals")
async def my_business_deals(user=Depends(require_partner)):
    docs = await db.deals.find({"submitted_by": user["id"]}).sort("created_at", -1).to_list(100)
    return [Deal.from_mongo(d).out() for d in docs]


@router.get("/business/reviews")
async def business_reviews(user=Depends(require_partner)):
    deals = {str(d["_id"]): d["title"] for d in await db.deals.find({"submitted_by": user["id"]}, {"title": 1}).to_list(500)}
    rows = await db.reviews.find({"deal_id": {"$in": list(deals)}, "hidden": {"$ne": True}}).sort("created_at", -1).to_list(200)
    return [review_out(r) | {"deal_title": deals.get(r["deal_id"])} for r in rows]


@router.get("/business/stats")
async def business_stats(user=Depends(require_partner)):
    deals = await db.deals.find({"submitted_by": user["id"]}).sort("created_at", -1).to_list(200)
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    rows, totals = [], {"claimed_month": 0, "redeemed_month": 0, "claimed_all": 0, "redeemed_all": 0, "saved_all": 0.0}
    for d in deals:
        did = str(d["_id"])
        vs = await db.vouchers.find({"deal_id": did}, {"created_at": 1, "redeemed_at": 1, "status": 1, "amount_saved": 1}).to_list(5000)
        row = {
            "deal_id": did, "title": d["title"], "status": d["status"], "discount_label": d["discount_label"],
            "claimed_month": sum(1 for v in vs if v["created_at"] >= month_start),
            "redeemed_month": sum(1 for v in vs if v.get("status") == "redeemed" and (v.get("redeemed_at") or "") >= month_start),
            "claimed_all": len(vs),
            "redeemed_all": sum(1 for v in vs if v.get("status") == "redeemed"),
            "saved_all": round(sum(v.get("amount_saved") or 0 for v in vs if v.get("status") == "redeemed"), 2),
        }
        for k in totals:
            totals[k] += row[k]
        rows.append(row)
    totals["saved_all"] = round(totals["saved_all"], 2)
    return {"month": datetime.now(timezone.utc).strftime("%B %Y"), "totals": totals, "deals": rows}


# ---------- Profile ----------
@router.put("/business/profile")
async def update_profile(body: ProfileIn, user=Depends(require_approved_business)):
    data = {k: (v.strip() if isinstance(v, str) else v) for k, v in body.model_dump(exclude={"hours"}).items()}
    hours = {d: (body.hours.get(d).model_dump() if body.hours.get(d) else None) for d in DAYS}
    if not any(hours.values()):
        raise HTTPException(400, "Add your opening hours for at least one day")
    if any(h and h["open"] == h["close"] for h in hours.values()):
        raise HTTPException(400, "Opening and closing times can't be the same")
    place = find_suburb(data["suburb"], data["postcode"])
    if not place:
        raise HTTPException(400, "Please pick your suburb and postcode from the list")
    data["suburb"] = place["name"]
    data["hours"], data["opening_hours"] = hours, hours_text(hours)
    if data.get("website") and not data["website"].startswith(("http://", "https://")):
        data["website"] = "https://" + data["website"]
    if data.get("instagram"):
        data["instagram"] = data["instagram"].lstrip("@").split("instagram.com/")[-1].strip("/")
    await db.users.update_one({"_id": oid(user["id"])}, {"$set": data})
    await db.deals.update_many({"submitted_by": user["id"]}, {"$set": {"business_name": data["business_name"]}})
    return user_out(await db.users.find_one({"_id": oid(user["id"])}))


async def store_image(file: UploadFile, user: dict, kind: str, max_mb: int) -> str:
    ext = LOGO_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Please upload a PNG, JPG or WebP image")
    data = await file.read()
    if len(data) > max_mb * 1024 * 1024:
        raise HTTPException(400, f"Image must be under {max_mb} MB")
    path = f"{storage.APP_NAME}/{kind}s/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(storage.put_object, path, data, file.content_type)
    except Exception as e:
        logger.warning("%s upload failed: %s", kind, e)
        raise HTTPException(502, "Upload failed, please try again")
    await db.files.insert_one({"storage_path": result["path"], "owner_id": user["id"], "kind": kind, "content_type": file.content_type,
                               "original_filename": file.filename, "size": result.get("size"), "is_deleted": False, "created_at": now_iso()})
    return result["path"]


@router.post("/business/logo")
async def upload_logo(file: UploadFile = File(...), user=Depends(require_approved_business)):
    old = (await db.users.find_one({"_id": oid(user["id"])}, {"logo_path": 1})).get("logo_path")
    path = await store_image(file, user, "logo", 3)
    if old:
        await db.files.update_one({"storage_path": old}, {"$set": {"is_deleted": True}})
    await db.users.update_one({"_id": oid(user["id"])}, {"$set": {"logo_path": path}})
    return user_out(await db.users.find_one({"_id": oid(user["id"])}))


@router.post("/business/photos")
async def upload_photo(file: UploadFile = File(...), user=Depends(require_approved_business)):
    if len(user.get("photos") or []) >= MAX_PHOTOS:
        raise HTTPException(400, f"You can add up to {MAX_PHOTOS} photos. Remove one to add another.")
    path = await store_image(file, user, "photo", 5)
    res = await db.users.update_one({"_id": oid(user["id"]), f"photos.{MAX_PHOTOS - 1}": {"$exists": False}}, {"$push": {"photos": path}})
    if not res.modified_count:
        await db.files.update_one({"storage_path": path}, {"$set": {"is_deleted": True}})
        raise HTTPException(400, f"You can add up to {MAX_PHOTOS} photos. Remove one to add another.")
    return user_out(await db.users.find_one({"_id": oid(user["id"])}))


@router.post("/business/photos/remove")
async def remove_photo(body: PhotoPathIn, user=Depends(require_approved_business)):
    await db.users.update_one({"_id": oid(user["id"])}, {"$pull": {"photos": body.path}})
    await db.files.update_one({"storage_path": body.path, "owner_id": user["id"]}, {"$set": {"is_deleted": True}})
    return user_out(await db.users.find_one({"_id": oid(user["id"])}))


@router.get("/files/{path:path}")
async def get_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "kind": {"$in": ["logo", "photo", "banner", "deal"]}, "is_deleted": False})
    if not rec:
        raise HTTPException(404, "File not found")
    try:
        data, _ct = await asyncio.to_thread(storage.get_object, path)
    except Exception:
        raise HTTPException(404, "File not found")
    return Response(content=data, media_type=rec["content_type"], headers={"Cache-Control": "public, max-age=86400"})
