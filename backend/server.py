from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import asyncio
import hmac
from zoneinfo import ZoneInfo
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
from email_templates import welcome_email, renewal_email, gift_email, partner_welcome_email, deal_decision_email, business_rejected_email, new_applicant_email

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
    business_status: Optional[str] = None
    super_admin: bool = False
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
    note: Optional[str] = Field(None, max_length=500)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)


class CodeIn(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class CardRedeemIn(BaseModel):
    member_code: str = Field(min_length=4, max_length=20)
    deal_id: str


class GoogleSessionIn(BaseModel):
    session_id: str = Field(min_length=4, max_length=500)


class RedeemIn(BaseModel):
    amount_saved: Optional[float] = Field(None, ge=0, le=10000)


class CheckoutIn(BaseModel):
    origin_url: str
    kind: str = "membership"
    gift_name: Optional[str] = Field(None, max_length=80)
    gift_email: Optional[EmailStr] = None
    gift_message: Optional[str] = Field(None, max_length=300)
    gift_send_date: Optional[str] = Field(None, max_length=10)


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
    response.set_cookie("refresh_token", make_token(user_id, "refresh", timedelta(days=30)),
                        httponly=True, secure=True, samesite="none", max_age=2592000, path="/")


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


async def require_partner(user=Depends(current_user)):
    if user["role"] == "admin":
        return user
    if user["role"] != "business":
        raise HTTPException(403, "Not allowed")
    if user.get("business_status") != "approved":
        raise HTTPException(403, "Your business account is waiting for approval")
    return user


async def geocode(suburb: str):
    if not suburb or "multiple" in suburb.lower():
        return None, None
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.get("https://nominatim.openstreetmap.org/search",
                            params={"q": f"{suburb}, Australia", "format": "json", "limit": 1, "countrycodes": "au"},
                            headers={"User-Agent": "GoPerks/1.0"})
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


async def send_partner_welcome(email: str, name: str, business: str):
    try:
        subject, html = partner_welcome_email(name, business)
        await send_email(to=email, subject=subject, html=html)
        await db.users.update_one({"email": email}, {"$set": {"partner_kit_sent": True}})
    except Exception as e:
        logger.warning("partner welcome failed for %s: %s", email, e)


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
        "member_code": doc.get("member_code") or f"GP-{rand_code(6)}",
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


def melb_today() -> str:
    return datetime.now(ZoneInfo("Australia/Melbourne")).date().isoformat()


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
    if body.role == "business":
        await db.users.update_one({"_id": res.inserted_id}, {"$set": {"business_status": "pending"}})
        asyncio.create_task(send_applicant_alert(body.name, body.business_name, email))
    return user_out(await db.users.find_one({"_id": res.inserted_id}))


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= 5 and attempt.get("locked_until", "") > now_iso():
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    doc = await db.users.find_one({"email": email})
    if not doc or not doc.get("password_hash") or not verify_password(body.password, doc["password_hash"]):
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


@api.post("/auth/google")
async def google_login(body: GoogleSessionIn, response: Response):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                        headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Google sign-in failed, please try again")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(401, "Google sign-in failed, please try again")
    doc = await db.users.find_one({"email": email})
    if not doc:
        u = User(email=email, name=data.get("name") or email.split("@")[0], role="member")
        res = await db.users.insert_one({**u.to_mongo(), "picture": data.get("picture"), "auth_provider": "google"})
        doc = await db.users.find_one({"_id": res.inserted_id})
    elif data.get("picture") and not doc.get("picture"):
        await db.users.update_one({"_id": doc["_id"]}, {"$set": {"picture": data["picture"]}})
    set_auth_cookies(response, str(doc["_id"]))
    return user_out(doc)


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
def term_start(user: dict) -> str:
    exp = user.get("membership_expires_at")
    return (datetime.fromisoformat(exp) - timedelta(days=365)).isoformat() if exp else ""


async def used_this_term(user: dict, deal_id: str, exclude_id=None):
    q = {"user_id": user["id"], "deal_id": deal_id, "status": "redeemed", "redeemed_at": {"$gte": term_start(user)}}
    if exclude_id is not None:
        q["_id"] = {"$ne": exclude_id}
    return await db.vouchers.find_one(q)


ONCE_PER_TERM = "You've already used this deal this membership year. It unlocks again when you renew."


@api.get("/deals/{deal_id}/my-status")
async def my_deal_status(deal_id: str, user=Depends(current_user)):
    used = await used_this_term(user, deal_id)
    active = await db.vouchers.find_one({"user_id": user["id"], "deal_id": deal_id, "status": "active",
                                         "expires_at": {"$gt": now_iso()}})
    return {"used_this_term": bool(used), "used_at": (used or {}).get("redeemed_at"),
            "active_voucher": Voucher.from_mongo(active).out() if active else None}


@api.post("/deals/{deal_id}/voucher")
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
    if await used_this_term(user, v["deal_id"], v["_id"]):
        raise HTTPException(409, ONCE_PER_TERM)
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
async def partner_check(body: CodeIn, user=Depends(require_partner)):
    code = body.code.strip().upper()
    if code.startswith(("GP-", "LP-", "TV-")):
        m = await db.users.find_one({"member_code": code})
        if not m:
            raise HTTPException(404, "No member with that card number")
        info = user_out(m)
        q = {"status": "approved"} if user["role"] == "admin" else {"status": "approved", "submitted_by": user["id"]}
        deals = await db.deals.find(q).sort("title", 1).to_list(200)
        rows = []
        for d in deals:
            used = await used_this_term(info, str(d["_id"]))
            rows.append({"deal_id": str(d["_id"]), "title": d["title"], "discount_label": d["discount_label"],
                         "used_this_term": bool(used), "used_at": (used or {}).get("redeemed_at")})
        return {"type": "member", "member_name": info["name"].split(" ")[0], "member_code": code,
                "status": info["membership_status"], "expires_at": info["membership_expires_at"], "deals": rows}
    v = Voucher.from_mongo(await find_partner_voucher(code, user)).out()
    if v["status"] == "active" and v["expires_at"] < now_iso():
        v["status"] = "expired"
    member = await db.users.find_one({"_id": oid(v["user_id"])})
    return {"type": "voucher", "code": v["code"], "status": v["status"], "deal_title": v["deal_title"],
            "discount_label": v["discount_label"], "expires_at": v["expires_at"], "redeemed_at": v.get("redeemed_at"),
            "member_name": (member or {}).get("name", "Member").split(" ")[0]}


@api.post("/partner/redeem-card")
async def partner_redeem_card(body: CardRedeemIn, user=Depends(require_partner)):
    m = await db.users.find_one({"member_code": body.member_code.strip().upper()})
    if not m:
        raise HTTPException(404, "No member with that card number")
    member = user_out(m)
    if member["membership_status"] != "active":
        raise HTTPException(400, "This membership isn't active")
    deal = await db.deals.find_one({"_id": oid(body.deal_id), "status": "approved"})
    if not deal or (user["role"] != "admin" and deal.get("submitted_by") != user["id"]):
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


@api.post("/partner/redeem")
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


# ---------- Business ----------
@api.post("/business/deals")
async def submit_deal(body: DealIn, user=Depends(require_partner)):
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    data = await with_coords(body.model_dump(exclude={"featured"}))
    d = Deal(**data, status="pending", submitted_by=user["id"])
    res = await db.deals.insert_one(d.to_mongo())
    d.id = str(res.inserted_id)
    return d.out()


@api.get("/business/stats")
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
async def my_business_deals(user=Depends(require_partner)):
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
    prev = await db.deals.find_one_and_update({"_id": oid(deal_id)}, {"$set": {"status": body.status}})
    if not prev:
        raise HTTPException(404, "Deal not found")
    res = await db.deals.find_one({"_id": prev["_id"]})
    if prev["status"] != body.status and body.status in ("approved", "rejected"):
        asyncio.create_task(send_deal_decision(res, body.note or ""))
    return Deal.from_mongo(res).out()


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


@api.delete("/admin/deals/{deal_id}")
async def admin_delete_deal(deal_id: str, _=Depends(require_role("admin"))):
    await db.deals.delete_one({"_id": oid(deal_id)})
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(_=Depends(require_role("admin"))):
    paid = await db.payment_transactions.find({"payment_status": "paid"}, {"amount": 1, "kind": 1}).to_list(100000)
    return {
        "members": await db.users.count_documents({"role": "member"}),
        "active_members": await db.users.count_documents({"membership_status": "active", "membership_expires_at": {"$gt": now_iso()}}),
        "businesses": await db.users.count_documents({"role": "business", "business_status": "approved"}),
        "pending_businesses": await db.users.count_documents({"role": "business", "business_status": "pending"}),
        "pending_deals": await db.deals.count_documents({"status": "pending"}),
        "live_deals": await db.deals.count_documents({"status": "approved"}),
        "vouchers": await db.vouchers.count_documents({}),
        "redeemed": await db.vouchers.count_documents({"status": "redeemed"}),
        "revenue": round(sum(p.get("amount") or 0 for p in paid), 2),
        "gifts_sold": sum(1 for p in paid if p.get("kind") == "gift"),
    }


@api.get("/admin/users")
async def admin_users(role: Optional[str] = None, _=Depends(require_role("admin"))):
    q = {"role": role} if role else {}
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


@api.post("/admin/businesses/{user_id}/status")
async def admin_business_status(user_id: str, body: StatusIn, _=Depends(require_role("admin"))):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(400, "Invalid status")
    prev = await db.users.find_one_and_update({"_id": oid(user_id), "role": "business"}, {"$set": {"business_status": body.status}})
    if not prev:
        raise HTTPException(404, "Business not found")
    if prev.get("business_status") != body.status:
        if body.status == "approved":
            asyncio.create_task(send_partner_welcome(prev["email"], prev.get("name", ""), prev.get("business_name") or "Your business"))
        else:
            asyncio.create_task(send_business_rejected(prev, body.note or ""))
    return user_out(await db.users.find_one({"_id": prev["_id"]}))


async def send_applicant_alert(name: str, business: str, email: str):
    try:
        subject, html = new_applicant_email(name, business, email)
        await send_email(to=os.environ["SUPER_ADMIN_EMAIL"], subject=subject, html=html)
    except Exception as e:
        logger.warning("applicant alert failed for %s: %s", email, e)


@api.get("/admin/monthly")
async def admin_monthly(_=Depends(require_role("admin"))):
    today = datetime.now(ZoneInfo("Australia/Melbourne")).date().replace(day=1)
    months = []
    y, m = today.year, today.month
    for _i in range(6):
        months.insert(0, f"{y:04d}-{m:02d}")
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    rows = {k: {"month": k, "members": 0, "gifts": 0, "revenue": 0.0} for k in months}
    paid = await db.payment_transactions.find(
        {"payment_status": "paid"}, {"amount": 1, "kind": 1, "created_at": 1, "updated_at": 1}).to_list(100000)
    for p in paid:
        when = datetime.fromisoformat(p.get("updated_at") or p["created_at"]).astimezone(ZoneInfo("Australia/Melbourne"))
        r = rows.get(when.strftime("%Y-%m"))
        if not r:
            continue
        r["gifts" if p.get("kind") == "gift" else "members"] += 1
        r["revenue"] = round(r["revenue"] + (p.get("amount") or 0), 2)
    return [rows[k] for k in months]


async def send_business_rejected(u: dict, note: str):
    try:
        subject, html = business_rejected_email(u.get("name", ""), u.get("business_name") or "your business", note)
        await send_email(to=u["email"], subject=subject, html=html)
    except Exception as e:
        logger.warning("business rejection email failed for %s: %s", u.get("email"), e)


# ---------- Payments ----------
@api.post("/payments/checkout")
async def create_checkout(body: CheckoutIn, user=Depends(current_user)):
    is_gift = body.kind == "gift"
    if is_gift and not (body.gift_name and body.gift_email):
        raise HTTPException(400, "Please add the recipient's name and email")
    if is_gift and body.gift_send_date:
        try:
            sd = datetime.strptime(body.gift_send_date, "%Y-%m-%d").date().isoformat()
        except ValueError:
            raise HTTPException(400, "Please choose a valid delivery date")
        latest = (datetime.now(ZoneInfo("Australia/Melbourne")).date() + timedelta(days=365)).isoformat()
        if sd < melb_today() or sd > latest:
            raise HTTPException(400, "Delivery date must be between today and 12 months from now")
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
        "gift_send_date": body.gift_send_date if is_gift else None,
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


def verify_cron(request: Request):
    auth = request.headers.get("Authorization", "")
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(401, "Unauthorized")


@api.post("/cron/gift-deliveries")
async def cron_gift_deliveries(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    verify_cron(request)
    try:
        envelope = await request.json()
    except Exception:
        envelope = None
    if envelope is not None and not isinstance(envelope, dict):
        raise HTTPException(400, "Invalid body")
    run_id = request.headers.get("X-Webhook-Id") or (envelope or {}).get("run_id") or now_iso()
    try:
        await db.cron_runs.insert_one({"_id": f"gifts:{run_id}", "created_at": now_iso()})
    except Exception:
        return {"status": "duplicate"}
    asyncio.create_task(run_gift_deliveries())
    return {"status": "accepted"}


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
                    headers={"Content-Disposition": f'attachment; filename="go-perks-card-{member["member_code"]}.pkpass"'})


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
                doc.update(membership_status="active", member_code=f"GP-{rand_code(6)}",
                           membership_expires_at=(datetime.now(timezone.utc) + timedelta(days=365)).isoformat())
            await db.users.insert_one(doc)
    if await db.deals.count_documents({}) == 0:
        await db.deals.insert_many([Deal(**d).to_mongo() for d in SEED_DEALS])
    for d in SEED_DEALS:
        await db.deals.update_one({"title": d["title"], "lat": {"$exists": False}},
                                  {"$set": {"lat": d["lat"], "lng": d["lng"], "est_saving": d["est_saving"]}})
    await db.users.update_many({"role": "business", "business_status": {"$exists": False}}, {"$set": {"business_status": "approved"}})
    super_email = os.environ.get("SUPER_ADMIN_EMAIL", "").lower()
    if super_email:
        existing = await db.users.find_one({"email": super_email})
        if not existing:
            await db.users.insert_one({**User(email=super_email, name="Jake Camilleri", role="admin", super_admin=True).to_mongo()})
        elif existing.get("role") != "admin" or not existing.get("super_admin"):
            await db.users.update_one({"_id": existing["_id"]}, {"$set": {"role": "admin", "super_admin": True}})
    demo_biz = await db.users.find_one({"email": "business@tinysvouchers.com.au"})
    if demo_biz:
        await db.deals.update_many({"business_name": {"$in": DEMO_BUSINESS_DEALS}, "submitted_by": None},
                                   {"$set": {"submitted_by": str(demo_biz["_id"])}})


@app.on_event("shutdown")
async def shutdown():
    client.close()
