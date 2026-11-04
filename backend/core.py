"""Shared config, database handle and small helpers used across all route modules."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import hmac
import hashlib
import logging
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

import bcrypt
import httpx
import jwt
import stripe
from bson import ObjectId
from fastapi import HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("goperks")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
MEMBERSHIP_LOOKUP_KEY = "membership_yearly_aud"
GIFT_LOOKUP_KEY = "membership_gift_aud"
JWT_ALGORITHM = "HS256"
CATEGORIES = ["cafes", "kids", "dining", "family-fun", "essentials", "travel"]
MELB = ZoneInfo("Australia/Melbourne")
PROFILE_REQUIRED = ("address", "suburb", "phone", "about")
PROFILE_FIELDS = PROFILE_REQUIRED + ("website", "instagram", "opening_hours", "hours")
DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
DAY_LABEL = dict(zip(DAYS, ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")))
LIVE_STEP = 30  # seconds per live card code


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def melb_today() -> str:
    return datetime.now(MELB).date().isoformat()


def nice_date(iso: str) -> str:
    return datetime.fromisoformat(iso).strftime("%-d %B %Y")


def month_start(month: Optional[str] = None) -> datetime:
    """Midnight on the 1st of a 'YYYY-MM' month (Melbourne time), or of the current month."""
    if month:
        try:
            return datetime.strptime(month, "%Y-%m").replace(tzinfo=MELB)
        except ValueError:
            raise HTTPException(400, "Month must look like 2026-11")
    return datetime.now(MELB).replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def previous_month_start() -> datetime:
    return (month_start() - timedelta(days=1)).replace(day=1)


def month_range(start: datetime) -> dict:
    end = (start + timedelta(days=32)).replace(day=1)
    return {"$gte": start.astimezone(timezone.utc).isoformat(), "$lt": end.astimezone(timezone.utc).isoformat()}


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


def logo_url(path: Optional[str]) -> Optional[str]:
    return f"/api/files/{path}" if path else None


# ---------- Opening hours ----------
def _fmt_time(t: str) -> str:
    h, m = map(int, t.split(":"))
    return f"{h % 12 or 12}{'' if m == 0 else f':{m:02d}'}{'am' if h < 12 else 'pm'}"


def hours_text(hours: dict) -> str:
    """Group consecutive days with the same times: 'Mon–Fri 7am–3pm\nSat Closed'."""
    rows, i = [], 0
    span = lambda d: f"{_fmt_time(d['open'])}\u2013{_fmt_time(d['close'])}" if d else "Closed"
    while i < 7:
        j = i
        while j + 1 < 7 and hours.get(DAYS[j + 1]) == hours.get(DAYS[i]):
            j += 1
        days = DAY_LABEL[DAYS[i]] + (f"\u2013{DAY_LABEL[DAYS[j]]}" if j > i else "")
        rows.append(f"{days} {span(hours.get(DAYS[i]))}")
        i = j + 1
    return "\n".join(rows)


def is_open_now(hours: Optional[dict]) -> Optional[bool]:
    if not hours or not any(hours.get(d) for d in DAYS):
        return None
    now = datetime.now(MELB)
    t = now.strftime("%H:%M")
    today, yesterday = DAYS[now.weekday()], DAYS[now.weekday() - 1]
    d = hours.get(today)
    if d and (d["open"] <= t < d["close"] or (d["close"] <= d["open"] and t >= d["open"])):
        return True
    y = hours.get(yesterday)
    return bool(y and y["close"] <= y["open"] and t < y["close"])


# ---------- Location ----------
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


# ---------- Live member card tokens ----------
def _live_sig(code: str, step: int) -> str:
    return hmac.new(os.environ["JWT_SECRET"].encode(), f"live:{code}:{step}".encode(), hashlib.sha256).hexdigest()[:12].upper()


def make_live_token(code: str) -> tuple:
    now = datetime.now(timezone.utc).timestamp()
    step = int(now // LIVE_STEP)
    return f"GPL.{code}.{step}.{_live_sig(code, step)}", LIVE_STEP - int(now % LIVE_STEP)


def check_live_token(token: str) -> tuple:
    """Returns (member_code, state) where state is 'live', 'stale' (old screenshot) or 'invalid'."""
    parts = token.strip().upper().split(".")
    if len(parts) != 4 or parts[0] != "GPL" or not parts[2].isdigit():
        return None, "invalid"
    code, step = parts[1], int(parts[2])
    if not hmac.compare_digest(_live_sig(code, step), parts[3]):
        return code, "invalid"
    age = int(datetime.now(timezone.utc).timestamp() // LIVE_STEP) - step
    return code, ("live" if 0 <= age <= 1 else "stale")


def verify_cron(request: Request):
    auth = request.headers.get("Authorization", "")
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(401, "Unauthorized")
