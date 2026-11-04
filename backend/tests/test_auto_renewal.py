"""Automatic yearly renewal: Stripe renewal invoices extend the membership once; members can turn auto-renew off and on."""
import hmac
import json
import os
import time
import uuid
from datetime import datetime, timezone, timedelta
from hashlib import sha256

import requests
import stripe
from dotenv import dotenv_values
from pymongo import MongoClient

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
stripe.api_key = ENV["STRIPE_SECRET_KEY"]


def signed_post(event: dict):
    body = json.dumps(event)
    ts = int(time.time())
    sig = hmac.new(ENV["STRIPE_WEBHOOK_SECRET"].encode(), f"{ts}.{body}".encode(), sha256).hexdigest()
    return requests.post(f"{API}/stripe/webhook", data=body, headers={"stripe-signature": f"t={ts},v1={sig}", "Content-Type": "application/json"})


def test_auto_renewal_flow():
    email = f"test_renew_{uuid.uuid4().hex[:6]}@example.com"
    s = requests.Session()
    assert s.post(f"{API}/auth/register", json={"name": "TEST Renew", "email": email, "password": "Passw0rd!", "role": "member"}).status_code == 200
    price = stripe.Price.list(lookup_keys=["membership_yearly_aud"], active=True, limit=1).data[0]
    cust = stripe.Customer.create(email=email, payment_method="pm_card_visa", invoice_settings={"default_payment_method": "pm_card_visa"})
    sub = stripe.Subscription.create(customer=cust.id, items=[{"price": price.id}])
    exp = (datetime.now(timezone.utc) + timedelta(days=20)).isoformat()
    DB.users.update_one({"email": email}, {"$set": {"stripe_subscription_id": sub.id, "auto_renew": True,
                                                   "membership_status": "active", "membership_expires_at": exp}})
    try:
        me = s.get(f"{API}/auth/me").json()
        assert me["auto_renew"] is True and me["can_renew"] is False
        # No second subscription while auto-renew is on
        r = s.post(f"{API}/payments/checkout", json={"origin_url": "https://example.com"})
        assert r.status_code == 400 and "renews automatically" in r.text

        info = s.get(f"{API}/me/subscription").json()
        assert info["has_subscription"] and info["auto_renew"] and info["renews_on"]
        assert s.post(f"{API}/me/subscription/cancel").json()["auto_renew"] is False
        assert stripe.Subscription.retrieve(sub.id).cancel_at_period_end is True
        assert s.get(f"{API}/auth/me").json()["can_renew"] is True  # within 2 months and auto-renew off
        assert s.post(f"{API}/me/subscription/resume").json()["auto_renew"] is True

        # Stripe's yearly charge extends the membership by a year, exactly once
        inv_id = f"in_test_{uuid.uuid4().hex[:10]}"
        event = {"id": f"evt_{uuid.uuid4().hex[:10]}", "object": "event", "type": "invoice.paid",
                 "data": {"object": {"id": inv_id, "object": "invoice", "billing_reason": "subscription_cycle", "amount_paid": 4900,
                                     "currency": "aud", "parent": {"subscription_details": {"subscription": sub.id}}}}}
        assert signed_post(event).status_code == 200
        after = DB.users.find_one({"email": email})["membership_expires_at"]
        assert 364 <= (datetime.fromisoformat(after) - datetime.fromisoformat(exp)).days <= 366
        assert signed_post(event).status_code == 200
        assert DB.users.find_one({"email": email})["membership_expires_at"] == after
        assert DB.payment_transactions.count_documents({"session_id": inv_id, "payment_status": "paid"}) == 1
        assert any(p["amount"] == 49 for p in s.get(f"{API}/me/payments").json())

        # Turning it off in Stripe (e.g. cancelled there) is reflected on the account
        assert signed_post({"id": "evt_x", "object": "event", "type": "customer.subscription.updated",
                            "data": {"object": {"id": sub.id, "status": "active", "cancel_at_period_end": True}}}).status_code == 200
        assert DB.users.find_one({"email": email})["auto_renew"] is False
    finally:
        stripe.Subscription.cancel(sub.id)
        DB.payment_transactions.delete_many({"email": email})
        DB.users.delete_one({"email": email})
