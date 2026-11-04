"""Stripe checkout for memberships and gifts."""
from datetime import datetime, timedelta

import stripe
from fastapi import APIRouter, HTTPException, Request, Depends

from core import db, now_iso, melb_today, MELB, STRIPE_WEBHOOK_SECRET, MEMBERSHIP_LOOKUP_KEY, GIFT_LOOKUP_KEY
from deps import current_user
from models import CheckoutIn
from services import mark_paid

router = APIRouter()


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
    return {"status": "ok"}
