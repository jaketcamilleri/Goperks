from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import asyncio
import hmac
import logging
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional, List

import bcrypt
import httpx
import jwt
import stripe
from html import escape
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import FileResponse
import wallet
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr
from starlette.middleware.cors import CORSMiddleware

from seed_data import SEED_DEALS, DEMO_BUSINESS_DEALS
from email_service import send_email, EMAIL_FROM_NAME
from email_templates import welcome_email, renewal_email, gift_email

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
MEMBERSHIP_LOOKUP_KEY = "membership_yearly_aud"
GIFT_LOOKUP_KEY = "membership_gift_aud"
TAX_MODE = "full"
JWT_ALGORITHM = "HS256"
CATEGORIES = ["cafes", "kids", "dining", "family-fun", "essentials", "travel"]

app = FastAPI()
api = APIRouter(prefix="/api")

# ---------- Models ----------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc) if doc else None

    def to_mongo(self):
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data

    def out(self):
        return self.model_dump(by_alias=False)


class User(BaseDocument):
    email: str
    name: str
    role: str = "member"
    business_name: Optional[str] = None
    membership_status: str = "inactive"
    membership_expires_at: Optional[str] = None
    member_code: Optional[str] = None
    created_at: str = Field(default_factory=lambda: now_iso())


class Deal(BaseDocument):
    title: str
    business_name: str
    category: str
    discount_label: str
    description: str
    terms: str = ""
    suburb: str = ""
    image_url: str = ""
    status: str = "approved"
    submitted_by: Optional[str] = None
    featured: bool = False
    est_saving: float = 0.0
    lat: Optional[float] = None
    lng: Optional[float] = None
    created_at: str = Field(default_factory=lambda: now_iso())


class Voucher(BaseDocument):
    user_id: str
    deal_id: str
    deal_title: str
    business_name: str
    discount_label: str
    code: str
    status: str = "active"
    expires_at: str
    partner_id: Optional[str] = None
    est_saving: float = 0.0
    amount_saved: Optional[float] = None
    redeemed_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: now_iso())


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    role: str = "member"
    business_name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class DealIn(BaseModel):
    title: str = Field(min_length=3)
    business_name: str = Field(min_length=2)
    category: str
    discount_label: str = Field(min_length=1)
    description: str = Field(min_length=5)
    terms: str = ""
    suburb: str = ""
    image_url: str = ""
    featured: bool = False
    est_saving: float = Field(0.0, ge=0, le=10000)


class StatusIn(BaseModel):
    status: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)


class CodeIn(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class RedeemIn(BaseModel):
    amount_saved: Optional[float] = Field(None, ge=0, le=10000)


class CheckoutIn(BaseModel):
    origin_url: str
    kind: str = "membership"
    gift_name: Optional[str] = Field(None, max_length=80)
    gift_email: Optional[EmailStr] = None
    gift_message: Optional[str] = Field(None, max_length=300)


class GiftRedeemIn(BaseModel):
    code: str = Field(min_length=6, max_length=30)


# ---------- Helpers ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(p):
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p, h):
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(user_id, kind, delta):
    payload = {"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str):
    response.set_cookie("access_token", make_token(user_id, "access", timedelta(minutes=15)),
                        httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", make_token(user_id, "refresh", timedelta(days=7)),
                        httponly=True, secure=True, samesite="none", max_age=604800, path="/")


def rand_code(n=8):
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(n))


def oid(value):
    if not ObjectId.is_valid(value):
        raise HTTPException(404, "Not found")
    return ObjectId(value)


def user_out(doc):
    u = User.from_mongo(doc)
    data = u.out()
    exp = data.get("membership_expires_at")
    if data["membership_status"] == "active" and exp and exp < now_iso():
        data["membership_status"] = "expired"
    return data


async def current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    doc = await db.users.find_one({"_id": oid(payload["sub"])})
    if not doc:
        raise HTTPException(401, "User not found")
    return user_out(doc)


def require_role(*roles):
    async def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Not allowed")
        return user
    return dep


async def geocode(suburb: str):
    if not suburb or "multiple" in suburb.lower():
        return None, None
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.get("https://nominatim.openstreetmap.org/search",
                            params={"q": f"{suburb}, Australia", "format": "json", "limit": 1, "countrycodes": "au"},
                            headers={"User-Agent": "LocalPerks/1.0"})
        data = r.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        logger.warning("geocode failed for %s: %s", suburb, e)
    return None, None


async def with_coords(data: dict, previous: Optional[dict] = None) -> dict:
    if previous and previous.get("suburb") == data.get("suburb") and previous.get("lat") is not None:
        data["lat"], data["lng"] = previous["lat"], previous["lng"]
    else:
        data["lat"], data["lng"] = await geocode(data.get("suburb", ""))
    return data


def nice_date(iso: str) -> str:
    return datetime.fromisoformat(iso).strftime("%-d %B %Y")


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


async def activate_membership(user_id: str):
    doc = await db.users.find_one({"_id": oid(user_id)})
    if not doc:
        return
    base = datetime.now(timezone.utc)
    exp = doc.get("membership_expires_at")
    if doc.get("membership_status") == "active" and exp and exp > base.isoformat():
        base = datetime.fromisoformat(exp)
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {
        "membership_status": "active",
        "membership_expires_at": (base + timedelta(days=365)).isoformat(),
        "member_code": doc.get("member_code") or f"LP-{rand_code(6)}",
    }})
    asyncio.create_task(send_welcome(user_id))


async def mark_paid(session_id: str, extra: dict):
    res = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now_iso(), **extra}},
    )
    if res and res.get("kind") == "gift":
        await create_gift(res)
    elif res and res.get("user_id"):
        await activate_membership(res["user_id"])


async def create_gift(txn: dict):
    code = f"GIFT-{rand_code(4)}-{rand_code(4)}"
    await db.gifts.insert_one({
        "code": code, "session_id": txn["session_id"], "buyer_id": txn["user_id"],
        "recipient_name": txn["gift_name"], "recipient_email": txn["gift_email"],
        "message": txn.get("gift_message") or "", "status": "unredeemed", "created_at": now_iso()})
    try:
        buyer = await db.users.find_one({"_id": oid(txn["user_id"])})
        subject, html = gift_email(txn["gift_name"], (buyer or {}).get("name", "A friend"), txn.get("gift_message") or "", code)
        await send_email(to=txn["gift_email"], subject=subject, html=html)
        await db.gifts.update_one({"code": code}, {"$set": {"email_sent": True}})
    except Exception as e:
        logger.warning("gift email failed for %s: %s", code, e)


# ---------- Auth ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if body.role not in ("member", "business"):
        raise HTTPException(400, "Invalid role")
    if body.role == "business" and not body.business_name:
        raise HTTPException(400, "Business name is required")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "An account with this email already exists")
    user = User(email=email, name=body.name, role=body.role, business_name=body.business_name)
    doc = user.to_mongo()
    doc["password_hash"] = hash_password(body.password)
    res = await db.users.insert_one(doc)
    set_auth_cookies(response, str(res.inserted_id))
    return user_out(await db.users.find_one({"_id": res.inserted_id}))


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= 5 and attempt.get("locked_until", "") > now_iso():
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    doc = await db.users.find_one({"email": email})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {
            "count": count, "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    set_auth_cookies(response, str(doc["_id"]))
    return user_out(doc)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    response.delete_cookie("refresh_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn):
    email = body.email.lower()
    doc = await db.users.find_one({"email": email})
    generic = {"ok": True, "message": "If that email has an account, a reset link is on its way."}
    if not doc:
        return generic
    recent = await db.password_reset_tokens.find_one(
        {"user_id": str(doc["_id"]), "created_at": {"$gt": datetime.now(timezone.utc) - timedelta(minutes=2)}})
    if recent:
        return generic
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": str(doc["_id"]), "used": False,
        "created_at": datetime.now(timezone.utc), "expires_at": datetime.now(timezone.utc) + timedelta(hours=1)})
    link = f"{os.environ['FRONTEND_URL'].rstrip('/')}/reset-password?token={token}"
    html = (
        '<table role="presentation" width="100%" style="background:#EAF6F3"><tr><td style="padding:32px;font-family:Georgia,serif;color:#17434C">'
        f'<h1 style="font-size:26px;margin:0 0 16px">Reset your password</h1>'
        f'<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">Hi {escape(doc.get("name", "there"))}, we received a request to reset the password for your {escape(EMAIL_FROM_NAME)} account.</p>'
        f'<p style="margin:28px 0"><a href="{escape(link)}" style="background:#B9512E;color:#EAF6F3;padding:14px 26px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">Choose a new password</a></p>'
        '<p style="font-family:Arial,sans-serif;font-size:13px;color:#3D5E65">This link expires in 1 hour and can only be used once. If you didn\'t ask for this, you can ignore this email.</p>'
        f'<p style="font-family:Arial,sans-serif;font-size:12px;color:#5E7F84">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>'
        '</td></tr></table>')
    await send_email(to=email, subject=f"Reset your {EMAIL_FROM_NAME} password", html=html)
    return generic


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    exp = rec.get("expires_at") if rec else None
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if not rec or exp < datetime.now(timezone.utc):
        raise HTTPException(400, "This reset link is invalid or has expired")
    await db.users.update_one({"_id": oid(rec["user_id"])}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid token type")
    response.set_cookie("access_token", make_token(payload["sub"], "access", timedelta(minutes=15)),
                        httponly=True, secure=True, samesite="none", max_age=900, path="/")
    return {"ok": True}


# ---------- Public deals ----------
@api.get("/deals")
async def list_deals(category: Optional[str] = None, q: Optional[str] = None, suburb: Optional[str] = None):
    query = {"status": "approved"}
    if category and category != "all":
        query["category"] = category
    if suburb:
        query["suburb"] = suburb
    if q:
        query["$or"] = [{f: {"$regex": q, "$options": "i"}} for f in ("title", "business_name", "suburb", "description")]
    docs = await db.deals.find(query).sort([("featured", -1), ("created_at", -1)]).to_list(200)
    return [Deal.from_mongo(d).out() for d in docs]


@api.get("/deals/{deal_id}")
async def get_deal(deal_id: str):
    doc = await db.deals.find_one({"_id": oid(deal_id), "status": "approved"})
    if not doc:
        raise HTTPException(404, "Deal not found")
    return Deal.from_mongo(doc).out()


@api.get("/suburbs")
async def list_suburbs():
    subs = await db.deals.distinct("suburb", {"status": "approved"})
    return sorted(s for s in subs if s)


@api.get("/stats")
async def stats():
    deals = await db.deals.count_documents({"status": "approved"})
    suburbs = await db.deals.distinct("suburb", {"status": "approved"})
    return {"live_deals": deals, "suburbs": len([s for s in suburbs if s]), "price": 49.0, "currency": "AUD"}


# ---------- Member ----------
@api.post("/deals/{deal_id}/voucher")
async def claim_voucher(deal_id: str, user=Depends(current_user)):
    if user["membership_status"] != "active" and user["role"] != "admin":
        raise HTTPException(402, "An active membership is required to claim vouchers")
    deal = await db.deals.find_one({"_id": oid(deal_id), "status": "approved"})
    if not deal:
        raise HTTPException(404, "Deal not found")
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


@api.get("/me/vouchers")
async def my_vouchers(user=Depends(current_user)):
    docs = await db.vouchers.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    out = []
    for d in docs:
        v = Voucher.from_mongo(d).out()
        if v["status"] == "active" and v["expires_at"] < now_iso():
            v["status"] = "expired"
        out.append(v)
    return out


@api.post("/me/vouchers/{voucher_id}/redeem")
async def redeem_voucher(voucher_id: str, body: RedeemIn = RedeemIn(), user=Depends(current_user)):
    v = await db.vouchers.find_one({"_id": oid(voucher_id), "user_id": user["id"], "status": "active"})
    if not v:
        raise HTTPException(404, "Voucher not found or already used")
    saved = body.amount_saved if body.amount_saved is not None else v.get("est_saving", 0)
    await db.vouchers.update_one({"_id": v["_id"]}, {"$set": {"status": "redeemed", "redeemed_at": now_iso(), "amount_saved": saved}})
    return {"ok": True}


@api.get("/me/savings")
async def my_savings(user=Depends(current_user)):
    docs = await db.vouchers.find({"user_id": user["id"], "status": "redeemed"}).to_list(1000)
    total = round(sum(d.get("amount_saved") or 0 for d in docs), 2)
    by_business = {}
    for d in docs:
        by_business[d["business_name"]] = round(by_business.get(d["business_name"], 0) + (d.get("amount_saved") or 0), 2)
    return {"total_saved": total, "redeemed_count": len(docs), "membership_price": 49.0,
            "net": round(total - 49.0, 2), "by_business": [{"business_name": k, "saved": v} for k, v in by_business.items()]}


# ---------- Partner counter check ----------
async def find_partner_voucher(code: str, user: dict):
    v = await db.vouchers.find_one({"code": code.strip().upper()})
    if not v or (user["role"] != "admin" and v.get("partner_id") != user["id"]):
        raise HTTPException(404, "No voucher with that code for your business")
    return v


@api.post("/partner/check")
async def partner_check(body: CodeIn, user=Depends(require_role("business", "admin"))):
    code = body.code.strip().upper()
    if code.startswith(("LP-", "TV-")):
        m = await db.users.find_one({"member_code": code})
        if not m:
            raise HTTPException(404, "No member with that card number")
        info = user_out(m)
        return {"type": "member", "member_name": info["name"].split(" ")[0], "member_code": code,
                "status": info["membership_status"], "expires_at": info["membership_expires_at"]}
    v = Voucher.from_mongo(await find_partner_voucher(code, user)).out()
    if v["status"] == "active" and v["expires_at"] < now_iso():
        v["status"] = "expired"
    member = await db.users.find_one({"_id": oid(v["user_id"])})
    return {"type": "voucher", "code": v["code"], "status": v["status"], "deal_title": v["deal_title"],
            "discount_label": v["discount_label"], "expires_at": v["expires_at"], "redeemed_at": v.get("redeemed_at"),
            "member_name": (member or {}).get("name", "Member").split(" ")[0]}


@api.post("/partner/redeem")
async def partner_redeem(body: CodeIn, user=Depends(require_role("business", "admin"))):
    v = await find_partner_voucher(body.code, user)
    if v["status"] != "active" or v["expires_at"] < now_iso():
        raise HTTPException(400, "This voucher has already been used or has expired")
    await db.vouchers.update_one({"_id": v["_id"]}, {"$set": {
        "status": "redeemed", "redeemed_at": now_iso(), "amount_saved": v.get("est_saving", 0), "redeemed_by": user["id"]}})
    return {"ok": True}


# ---------- Business ----------
@api.post("/business/deals")
async def submit_deal(body: DealIn, user=Depends(require_role("business", "admin"))):
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    data = await with_coords(body.model_dump(exclude={"featured"}))
    d = Deal(**data, status="pending", submitted_by=user["id"])
    res = await db.deals.insert_one(d.to_mongo())
    d.id = str(res.inserted_id)
    return d.out()


@api.get("/business/stats")
async def business_stats(user=Depends(require_role("business", "admin"))):
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


# ---------- Gifts ----------
@api.get("/me/gifts")
async def my_gifts(user=Depends(current_user)):
    docs = await db.gifts.find({"buyer_id": user["id"]}, {"_id": 0, "session_id": 0}).sort("created_at", -1).to_list(100)
    return docs


@api.get("/gifts/{code}")
async def gift_info(code: str):
    g = await db.gifts.find_one({"code": code.strip().upper()})
    if not g:
        raise HTTPException(404, "Gift code not found")
    buyer = await db.users.find_one({"_id": oid(g["buyer_id"])})
    return {"recipient_name": g["recipient_name"], "from_name": (buyer or {}).get("name", "A friend").split(" ")[0],
            "message": g.get("message", ""), "status": g["status"]}


@api.post("/gifts/redeem")
async def redeem_gift(body: GiftRedeemIn, user=Depends(current_user)):
    g = await db.gifts.find_one_and_update(
        {"code": body.code.strip().upper(), "status": "unredeemed"},
        {"$set": {"status": "redeemed", "redeemed_by": user["id"], "redeemed_at": now_iso()}})
    if not g:
        raise HTTPException(400, "This gift code is invalid or has already been used")
    await activate_membership(user["id"])
    return user_out(await db.users.find_one({"_id": oid(user["id"])}))


@api.get("/business/deals")
async def my_business_deals(user=Depends(require_role("business", "admin"))):
    docs = await db.deals.find({"submitted_by": user["id"]}).sort("created_at", -1).to_list(100)
    return [Deal.from_mongo(d).out() for d in docs]


# ---------- Admin ----------
@api.get("/admin/deals")
async def admin_deals(status: Optional[str] = None, _=Depends(require_role("admin"))):
    query = {"status": status} if status else {}
    docs = await db.deals.find(query).sort("created_at", -1).to_list(500)
    return [Deal.from_mongo(d).out() for d in docs]


@api.post("/admin/deals")
async def admin_create_deal(body: DealIn, user=Depends(require_role("admin"))):
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    d = Deal(**(await with_coords(body.model_dump())), status="approved", submitted_by=user["id"])
    res = await db.deals.insert_one(d.to_mongo())
    d.id = str(res.inserted_id)
    return d.out()


@api.put("/admin/deals/{deal_id}")
async def admin_update_deal(deal_id: str, body: DealIn, _=Depends(require_role("admin"))):
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    prev = await db.deals.find_one({"_id": oid(deal_id)})
    if not prev:
        raise HTTPException(404, "Deal not found")
    data = await with_coords(body.model_dump(), prev)
    res = await db.deals.find_one_and_update({"_id": prev["_id"]}, {"$set": data}, return_document=True)
    return Deal.from_mongo(res).out()


@api.post("/admin/deals/{deal_id}/status")
async def admin_set_status(deal_id: str, body: StatusIn, _=Depends(require_role("admin"))):
    if body.status not in ("approved", "rejected", "pending"):
        raise HTTPException(400, "Invalid status")
    res = await db.deals.find_one_and_update({"_id": oid(deal_id)}, {"$set": {"status": body.status}}, return_document=True)
    if not res:
        raise HTTPException(404, "Deal not found")
    return Deal.from_mongo(res).out()


@api.delete("/admin/deals/{deal_id}")
async def admin_delete_deal(deal_id: str, _=Depends(require_role("admin"))):
    await db.deals.delete_one({"_id": oid(deal_id)})
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(_=Depends(require_role("admin"))):
    return {
        "members": await db.users.count_documents({"role": "member"}),
        "active_members": await db.users.count_documents({"membership_status": "active", "membership_expires_at": {"$gt": now_iso()}}),
        "businesses": await db.users.count_documents({"role": "business"}),
        "pending_deals": await db.deals.count_documents({"status": "pending"}),
        "live_deals": await db.deals.count_documents({"status": "approved"}),
        "vouchers": await db.vouchers.count_documents({}),
    }


# ---------- Payments ----------
@api.post("/payments/checkout")
async def create_checkout(body: CheckoutIn, user=Depends(current_user)):
    is_gift = body.kind == "gift"
    if is_gift and not (body.gift_name and body.gift_email):
        raise HTTPException(400, "Please add the recipient's name and email")
    lookup = GIFT_LOOKUP_KEY if is_gift else MEMBERSHIP_LOOKUP_KEY
    prices = stripe.Price.list(lookup_keys=[lookup], active=True, limit=1).data
    if not prices:
        raise HTTPException(500, "Membership price not configured")
    price = prices[0]
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription" if price.recurring else "payment",
        success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}" + ("&kind=gift" if is_gift else ""),
        cancel_url=f"{body.origin_url}/payment/cancel",
        customer_email=user["email"],
        metadata={"user_id": user["id"], "lookup_key": lookup},
    )
    try:
        session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError as e:
        msg = (e.user_message or str(e)).lower()
        if "managed" in msg or "ineligible" in msg:
            session = stripe.checkout.Session.create(**kwargs, automatic_tax={"enabled": True},
                                                     billing_address_collection="required")
        else:
            raise HTTPException(400, e.user_message or "Checkout failed")
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user["id"], "email": user["email"],
        "lookup_key": lookup, "kind": "gift" if is_gift else "membership",
        "gift_name": body.gift_name if is_gift else None,
        "gift_email": body.gift_email.lower() if is_gift else None,
        "gift_message": body.gift_message if is_gift else None,
        "amount": float((price.unit_amount or 0) / 100),
        "currency": price.currency, "status": "initiated", "payment_status": "pending",
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(404, "Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await mark_paid(session_id, {"stripe_subscription_id": s.subscription,
                                             "stripe_payment_intent_id": s.payment_intent})
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"], "payment_status": record["payment_status"]}


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, request.headers.get("stripe-signature", ""), STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if obj.get("payment_status") == "paid" or obj.get("status") == "complete":
            await mark_paid(obj["id"], {"stripe_subscription_id": obj.get("subscription"),
                                        "stripe_payment_intent_id": obj.get("payment_intent")})
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one({"session_id": obj["id"]}, {"$set": {"status": "failed", "payment_status": "failed"}})
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"]}, {"$set": {"status": "expired", "payment_status": "expired"}})
    elif t == "charge.refunded":
        await db.payment_transactions.update_one({"stripe_payment_intent_id": obj.get("payment_intent")},
                                                 {"$set": {"status": "refunded", "payment_status": "refunded"}})
    return {"status": "ok"}


# ---------- Favourites ----------
@api.get("/me/favorites")
async def my_favorites(user=Depends(current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}).sort("created_at", -1).to_list(500)
    ids = [f["deal_id"] for f in favs]
    docs = await db.deals.find({"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}, "status": "approved"}).to_list(500)
    by_id = {str(d["_id"]): Deal.from_mongo(d).out() for d in docs}
    return [by_id[i] for i in ids if i in by_id]


@api.get("/me/favorite-ids")
async def my_favorite_ids(user=Depends(current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}, {"deal_id": 1}).to_list(500)
    return [f["deal_id"] for f in favs]


@api.post("/me/favorites/{deal_id}")
async def toggle_favorite(deal_id: str, user=Depends(current_user)):
    if not await db.deals.find_one({"_id": oid(deal_id), "status": "approved"}):
        raise HTTPException(404, "Deal not found")
    res = await db.favorites.delete_one({"user_id": user["id"], "deal_id": deal_id})
    if res.deleted_count:
        return {"favorited": False}
    await db.favorites.update_one({"user_id": user["id"], "deal_id": deal_id},
                                  {"$setOnInsert": {"created_at": now_iso()}}, upsert=True)
    return {"favorited": True}


# ---------- Scheduled: renewal reminders ----------
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
        subject, html = renewal_email(u.get("name", ""), u.get("member_code", ""), nice_date(u["membership_expires_at"]), saved, len(redeemed))
        try:
            await send_email(to=u["email"], subject=subject, html=html)
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"reminder_sent_for": u["membership_expires_at"]}})
            sent += 1
        except Exception as e:
            logger.warning("renewal reminder failed for %s: %s", u["email"], e)
    logger.info("renewal reminders sent: %s", sent)


@api.post("/cron/renewal-reminders")
async def cron_renewal_reminders(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("Authorization", "")
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(401, "Unauthorized")
    try:
        envelope = await request.json()
    except Exception:
        envelope = None
    if envelope is not None and not isinstance(envelope, dict):
        raise HTTPException(400, "Invalid body")
    run_id = request.headers.get("X-Webhook-Id") or (envelope or {}).get("run_id") or now_iso()
    try:
        await db.cron_runs.insert_one({"_id": f"renewal:{run_id}", "created_at": now_iso()})
    except Exception:
        return {"status": "duplicate"}
    asyncio.create_task(run_renewal_reminders())
    return {"status": "accepted"}


# ---------- Phone wallet cards ----------
def wallet_member(user: dict) -> dict:
    if user["membership_status"] != "active" or not user.get("member_code"):
        raise HTTPException(402, "An active membership is required for a wallet card")
    return user


@api.get("/wallet/status")
async def wallet_status():
    return {"apple": wallet.apple_ready(), "google": wallet.google_ready()}


@api.get("/wallet/apple")
async def wallet_apple(user=Depends(current_user)):
    if not wallet.apple_ready():
        raise HTTPException(503, "Apple Wallet isn't set up yet")
    member = wallet_member(user)
    try:
        data = wallet.build_pkpass(member)
    except Exception as e:
        logger.error("pkpass build failed: %s", type(e).__name__)
        raise HTTPException(503, "Apple Wallet card is temporarily unavailable")
    return Response(content=data, media_type="application/vnd.apple.pkpass",
                    headers={"Content-Disposition": f'attachment; filename="local-perks-card-{member["member_code"]}.pkpass"'})


@api.get("/wallet/google")
async def wallet_google(user=Depends(current_user)):
    if not wallet.google_ready():
        raise HTTPException(503, "Google Wallet isn't set up yet")
    member = wallet_member(user)
    try:
        return {"url": wallet.google_save_url(member)}
    except Exception as e:
        logger.error("google wallet link failed: %s", type(e).__name__)
        raise HTTPException(503, "Google Wallet card is temporarily unavailable")


@api.get("/wallet/google-logo.png")
async def wallet_google_logo():
    return FileResponse(wallet.ASSETS / "google_logo.png", media_type="image/png")


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ["FRONTEND_URL"], "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.deals.create_index([("status", 1), ("category", 1)])
    await db.vouchers.create_index([("user_id", 1), ("deal_id", 1)])
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token")
    await db.vouchers.create_index("code")
    await db.users.create_index("member_code")
    await db.favorites.create_index([("user_id", 1), ("deal_id", 1)], unique=True)
    await db.gifts.create_index("code", unique=True)
    await db.gifts.create_index("buyer_id")
    await db.vouchers.create_index("deal_id")
    seeds = [
        (os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Admin", "admin", None, False),
        ("member@tinysvouchers.com.au", "Member!2026", "Demo Member", "member", None, True),
        ("business@tinysvouchers.com.au", "Business!2026", "Demo Business", "business", "Demo Corner Cafe", False),
    ]
    for email, pw, name, role, biz, active in seeds:
        if not await db.users.find_one({"email": email}):
            u = User(email=email, name=name, role=role, business_name=biz)
            doc = u.to_mongo()
            doc["password_hash"] = hash_password(pw)
            if active:
                doc.update(membership_status="active", member_code=f"LP-{rand_code(6)}",
                           membership_expires_at=(datetime.now(timezone.utc) + timedelta(days=365)).isoformat())
            await db.users.insert_one(doc)
    if await db.deals.count_documents({}) == 0:
        await db.deals.insert_many([Deal(**d).to_mongo() for d in SEED_DEALS])
    for d in SEED_DEALS:
        await db.deals.update_one({"title": d["title"], "lat": {"$exists": False}},
                                  {"$set": {"lat": d["lat"], "lng": d["lng"], "est_saving": d["est_saving"]}})
    demo_biz = await db.users.find_one({"email": "business@tinysvouchers.com.au"})
    if demo_biz:
        await db.deals.update_many({"business_name": {"$in": DEMO_BUSINESS_DEALS}, "submitted_by": None},
                                   {"$set": {"submitted_by": str(demo_biz["_id"])}})


@app.on_event("shutdown")
async def shutdown():
    client.close()
