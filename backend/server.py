"""Go Perks API: app setup, routers, startup indexes and seed data. Routes live in routes/*."""
import asyncio
import os

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core import db, client, logger  # first: loads backend/.env
import storage
from models import User
from routes import auth, deals, member, partner, admin, payments, cron, wallet, invites, prospects, templates, launch, holidays

app = FastAPI()
api = APIRouter(prefix="/api")
for module in (auth, deals, member, partner, admin, payments, cron, wallet, invites, prospects, templates, launch, holidays):
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


DEMO_EMAILS = ["admin@tinysvouchers.com.au", "member@tinysvouchers.com.au", "business@tinysvouchers.com.au"]
DEMO_LINKS = [("vouchers", "user_id"), ("vouchers", "partner_id"), ("deals", "partner_id"), ("reviews", "user_id"),
              ("payment_transactions", "user_id"), ("partner_reports", "partner_id"), ("favorites", "user_id")]


async def remove_demo_accounts():
    demo = await db.users.find({"email": {"$in": DEMO_EMAILS}}, {"_id": 1}).to_list(None)
    if not demo:
        return
    ids = [str(d["_id"]) for d in demo]
    for coll, field in DEMO_LINKS:
        await db[coll].delete_many({field: {"$in": ids}})
    await db.users.delete_many({"_id": {"$in": [d["_id"] for d in demo]}})
    logger.info("Removed %d demo accounts", len(demo))


async def seed():
    await remove_demo_accounts()
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
    await prospects.import_batch2()
    await templates.refresh_templates()


@app.on_event("shutdown")
async def shutdown():
    client.close()
