"""Go Perks API: app setup, routers, startup indexes and seed data. Routes live in routes/*."""
import asyncio
import os
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core import db, client, logger, hash_password, rand_code  # first: loads backend/.env
import storage
from models import User
from routes import auth, deals, member, partner, admin, payments, cron, wallet, invites, prospects, templates

app = FastAPI()
api = APIRouter(prefix="/api")
for module in (auth, deals, member, partner, admin, payments, cron, wallet, invites, prospects, templates):
    api.include_router(module.router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ["FRONTEND_URL"], "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.deals.create_index([("status", 1), ("category", 1)])
    await db.vouchers.create_index([("user_id", 1), ("deal_id", 1)])
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token")
    await db.vouchers.create_index("code")
    await db.users.create_index("member_code")
    await db.users.create_index("referral_code", unique=True, sparse=True)
    await db.users.create_index("referred_by")
    await db.referral_rewards.create_index([("referrer_id", 1), ("created_at", 1)])
    await db.favorites.create_index([("user_id", 1), ("deal_id", 1)], unique=True)
    await db.gifts.create_index("code", unique=True)
    await db.gifts.create_index("buyer_id")
    await db.vouchers.create_index("deal_id")
    await db.activity_log.create_index("created_at")
    await db.partner_reports.create_index([("partner_id", 1), ("month", 1)], unique=True)
    await db.invites.create_index("email")
    await db.email_optouts.create_index("email", unique=True)
    await db.email_templates.create_index("key", unique=True)


async def seed():
    seeds = [
        (os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Admin", "admin", None, False),
        ("member@tinysvouchers.com.au", "Member!2026", "Demo Member", "member", None, True),
        ("business@tinysvouchers.com.au", "Business!2026", "Demo Business", "business", "Demo Corner Cafe", False),
    ]
    for email, pw, name, role, biz, active in seeds:
        if not await db.users.find_one({"email": email}):
            doc = User(email=email, name=name, role=role, business_name=biz).to_mongo()
            doc["password_hash"] = hash_password(pw)
            if active:
                doc.update(membership_status="active", member_code=f"GP-{rand_code(6)}",
                           membership_expires_at=(datetime.now(timezone.utc) + timedelta(days=365)).isoformat())
            await db.users.insert_one(doc)
    await db.users.update_many({"role": "business", "business_status": {"$exists": False}}, {"$set": {"business_status": "approved"}})
    super_email = os.environ.get("SUPER_ADMIN_EMAIL", "").lower()
    if super_email:
        existing = await db.users.find_one({"email": super_email})
        if not existing:
            await db.users.insert_one(User(email=super_email, name="Jake Camilleri", role="admin", super_admin=True).to_mongo())
        elif existing.get("role") != "admin" or not existing.get("super_admin"):
            await db.users.update_one({"_id": existing["_id"]}, {"$set": {"role": "admin", "super_admin": True}})


@app.on_event("startup")
async def startup():
    try:
        await asyncio.to_thread(storage.init_storage)
    except Exception as e:
        logger.error("Storage init failed: %s", e)
    await create_indexes()
    await seed()
    await prospects.seed_prospects()
    await templates.refresh_templates()


@app.on_event("shutdown")
async def shutdown():
    client.close()
