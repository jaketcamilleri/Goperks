"""Auth dependencies: who is calling and what they're allowed to do."""
import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import HTTPException, Request, Depends

from core import db, oid, now_iso, logo_url, JWT_ALGORITHM, PROFILE_REQUIRED, DAYS
from models import User


def user_out(doc):
    data = User.from_mongo(doc).out()
    data["logo_url"] = logo_url(data.pop("logo_path", None))
    data["photos"] = [{"path": p, "url": logo_url(p)} for p in data.get("photos") or []]
    if data["role"] == "business":
        data["profile_complete"] = all((data.get(k) or "").strip() for k in PROFILE_REQUIRED) and \
            any((data.get("hours") or {}).get(d) for d in DAYS)
    exp = data.get("membership_expires_at")
    if data["membership_status"] == "active" and exp and exp < now_iso():
        data["membership_status"] = "expired"
    # Members can renew from 2 months before their membership ends.
    data["renew_opens_at"] = renew_opens_at(data)
    data["can_renew"] = not data.get("auto_renew") and (data["renew_opens_at"] is None or data["renew_opens_at"] <= now_iso())
    data["has_password"] = bool(doc.get("password_hash"))
    return data


RENEW_WINDOW_DAYS = 61


def renew_opens_at(data) -> Optional[str]:
    exp = data.get("membership_expires_at")
    if data.get("membership_status") != "active" or not exp:
        return None
    return (datetime.fromisoformat(exp) - timedelta(days=RENEW_WINDOW_DAYS)).isoformat()


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


async def optional_user(request: Request) -> Optional[dict]:
    try:
        return await current_user(request)
    except HTTPException:
        return None


def require_role(*roles):
    async def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Not allowed")
        return user
    return dep


async def require_partner(user=Depends(current_user)):
    if user["role"] in ("admin", "staff"):
        return user
    if user["role"] != "business":
        raise HTTPException(403, "Not allowed")
    if user.get("business_status") != "approved":
        raise HTTPException(403, "Your business account is waiting for approval")
    if not user.get("profile_complete"):
        raise HTTPException(403, "Please complete your business profile first")
    return user


async def require_approved_business(user=Depends(current_user)):
    if user["role"] != "business" or user.get("business_status") != "approved":
        raise HTTPException(403, "Only approved partners can edit a business profile")
    return user
