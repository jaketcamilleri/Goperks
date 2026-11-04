"""Stripe checkout for memberships and gifts."""
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, HTTPException, Request, Depends

from core import db, oid, now_iso, melb_today, MELB, STRIPE_WEBHOOK_SECRET, MEMBERSHIP_LOOKUP_KEY, GIFT_LOOKUP_KEY
from deps import current_user
from models import CheckoutIn
from services import mark_paid, attach_referrer, activate_membership

router = APIRouter()
MEMBERSHIP_PRICE_CENTS = 4900
REFERRAL_DISCOUNT_CENTS = 408  # one month off: A$49 -> A$44.92 for a referred friend's first year


def referral_coupon(currency: str) -> str:
    cid = f"gp_referral_month_{currency}"
    try:
        stripe.Coupon.retrieve(cid)
    except stripe.error.InvalidRequestError:
        stripe.Coupon.create(id=cid, amount_off=REFERRAL_DISCOUNT_CENTS, currency=currency, duration="once",
                             name="Friend referral: 1 month off")
    return cid


@router.post("/payments/checkout")
async def create_checkout(body: CheckoutIn, user=Depends(current_user)):
    is_gift = body.kind == "gift"
    if is_gift and not (body.gift_name and body.gift_email):
        raise HTTPException(400, "Please add the recipient's name and email")
    if is_gift and body.gift_send_date:
        try:
            sd = datetime.strptime(body.gift_send_date, "%Y-%m-%d").date().isoformat()
        except ValueError:
            raise HTTPException(400, "Please choose a valid delivery date")
        latest = (datetime.now(MELB).date() + timedelta(days=365)).isoformat()
        if sd < melb_today() or sd > latest:
            raise HTTPException(400, "Delivery date must be between today and 12 months from now")
    lookup = GIFT_LOOKUP_KEY if is_gift else MEMBERSHIP_LOOKUP_KEY
    if not is_gift and user.get("auto_renew"):
        raise HTTPException(400, "Your membership renews automatically each year, so there's nothing to pay now. You can manage this in My account.")
    if not is_gift and not user.get("can_renew", True):
        opens = datetime.fromisoformat(user["renew_opens_at"]).astimezone(MELB).strftime("%-d %B %Y")
        raise HTTPException(400, f"Your membership is active. You can renew from {opens}, 2 months before it ends.")
    referred = False
    if not is_gift and not await db.payment_transactions.find_one({"user_id": user["id"], "kind": "membership", "payment_status": "paid"}):
        await attach_referrer(user["id"], user["email"], body.ref)
        doc = await db.users.find_one({"_id": oid(user["id"])}, {"referred_by": 1, "referral_rewarded": 1})
        referred = bool(doc.get("referred_by")) and not doc.get("referral_rewarded")
    prices = stripe.Price.list(lookup_keys=[lookup], active=True, limit=1).data
    if not prices:
        raise HTTPException(500, "Membership price not configured")
    price = prices[0]
    amount = (price.unit_amount or 0) - (REFERRAL_DISCOUNT_CENTS if referred else 0)
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription" if price.recurring else "payment",
        success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}" + ("&kind=gift" if is_gift else ""),
        cancel_url=f"{body.origin_url}/payment/cancel",
        customer_email=user["email"],
        metadata={"user_id": user["id"], "lookup_key": lookup, "referral_discount": "yes" if referred else "no"},
    )
    if referred:
        kwargs["discounts"] = [{"coupon": referral_coupon(price.currency)}]
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
        "amount": float(amount / 100), "referral_discount": referred,
        "currency": price.currency, "status": "initiated", "payment_status": "pending",
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id, "amount": float(amount / 100), "referral_discount": referred}


@router.get("/payments/my-price")
async def my_price(ref: Optional[str] = None, user=Depends(current_user)):
    """What this member pays at checkout: 11 months' price for a first year with a valid friend's code."""
    full = MEMBERSHIP_PRICE_CENTS / 100
    if await db.payment_transactions.find_one({"user_id": user["id"], "kind": "membership", "payment_status": "paid"}):
        return {"amount": full, "referral_discount": False}
    doc = await db.users.find_one({"_id": oid(user["id"])}, {"referred_by": 1, "email": 1})
    ok = bool(doc.get("referred_by"))
    if not ok and ref:
        r = await db.users.find_one({"referral_code": ref.strip().upper(), "role": "member"}, {"email": 1})
        ok = bool(r) and r["email"] != doc.get("email") and str(r["_id"]) != user["id"]
    return {"amount": (MEMBERSHIP_PRICE_CENTS - REFERRAL_DISCOUNT_CENTS) / 100 if ok else full, "referral_discount": ok}


@router.get("/payments/status/{session_id}")
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


@router.post("/stripe/webhook")
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
    elif t == "invoice.paid" and obj.get("billing_reason") == "subscription_cycle":
        await record_renewal(obj)
    elif t in ("customer.subscription.updated", "customer.subscription.deleted"):
        on = t.endswith("updated") and obj.get("status") in ("active", "trialing") and not obj.get("cancel_at_period_end")
        await db.users.update_one({"stripe_subscription_id": obj["id"]}, {"$set": {"auto_renew": bool(on)}})
    return {"status": "ok"}


def invoice_subscription(inv) -> Optional[str]:
    sub = inv.get("subscription")
    if not sub:
        sub = ((inv.get("parent") or {}).get("subscription_details") or {}).get("subscription")
    return sub if isinstance(sub, str) else (sub or {}).get("id")


async def record_renewal(inv):
    """Stripe charged the yearly renewal: record it once and add another year to the membership."""
    sub = invoice_subscription(inv)
    user = await db.users.find_one({"stripe_subscription_id": sub}, {"email": 1}) if sub else None
    if not user:
        return
    res = await db.payment_transactions.update_one({"session_id": inv["id"]}, {"$setOnInsert": {
        "session_id": inv["id"], "user_id": str(user["_id"]), "email": user["email"], "kind": "membership", "source": "auto_renewal",
        "amount": (inv.get("amount_paid") or 0) / 100, "currency": inv.get("currency") or "aud", "stripe_subscription_id": sub,
        "status": "completed", "payment_status": "paid", "created_at": now_iso(), "updated_at": now_iso()}}, upsert=True)
    if res.upserted_id:
        await activate_membership(str(user["_id"]), paid=True)


def period_end(sub) -> Optional[str]:
    end = sub.get("current_period_end")
    if not end:
        items = (sub.get("items") or {}).get("data") or []
        end = items[0].get("current_period_end") if items else None
    return datetime.fromtimestamp(end, timezone.utc).isoformat() if end else None


@router.get("/me/subscription")
async def my_subscription(user=Depends(current_user)):
    doc = await db.users.find_one({"_id": oid(user["id"])}, {"stripe_subscription_id": 1})
    sid = doc.get("stripe_subscription_id")
    if not sid:
        return {"has_subscription": False, "auto_renew": False, "renews_on": None}
    try:
        sub = stripe.Subscription.retrieve(sid)
    except stripe.error.StripeError:
        raise HTTPException(503, "Couldn't load your renewal details, please try again")
    live = sub.get("status") in ("active", "trialing", "past_due")
    auto = live and not sub.get("cancel_at_period_end")
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"auto_renew": bool(auto)}})
    return {"has_subscription": live, "auto_renew": bool(auto), "renews_on": period_end(sub) if live else None}


async def set_auto_renew(user, on: bool):
    doc = await db.users.find_one({"_id": oid(user["id"])}, {"stripe_subscription_id": 1})
    if not doc.get("stripe_subscription_id"):
        raise HTTPException(400, "Your membership doesn't renew automatically")
    try:
        stripe.Subscription.modify(doc["stripe_subscription_id"], cancel_at_period_end=not on)
    except stripe.error.InvalidRequestError:
        raise HTTPException(400, "This renewal has already ended. You can renew from the membership page when it's open.")
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"auto_renew": on}})
    return await my_subscription(user)


@router.post("/me/subscription/cancel")
async def cancel_auto_renew(user=Depends(current_user)):
    return await set_auto_renew(user, False)


@router.post("/me/subscription/resume")
async def resume_auto_renew(user=Depends(current_user)):
    return await set_auto_renew(user, True)
