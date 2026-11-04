import asyncio
import os
from datetime import datetime, timezone, timedelta

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Request, Response, Depends

from core import db, now_iso, oid, hash_password, verify_password, make_token, set_auth_cookies, JWT_ALGORITHM
from deps import user_out, current_user
from models import User, RegisterIn, LoginIn, GoogleSessionIn, ForgotIn, ResetIn
from services import send_applicant_alert, send_password_link

router = APIRouter(prefix="/auth")


@router.post("/register")
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
        asyncio.create_task(send_applicant_alert(str(res.inserted_id), body.name, body.business_name, email))
    return user_out(await db.users.find_one({"_id": res.inserted_id}))


@router.post("/login")
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


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    response.delete_cookie("refresh_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@router.post("/google")
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


@router.post("/forgot-password")
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
    await send_password_link(doc)
    return generic


@router.post("/reset-password")
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


@router.get("/me")
async def me(user=Depends(current_user)):
    return user


@router.post("/refresh")
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
