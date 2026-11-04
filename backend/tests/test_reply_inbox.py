"""Reply inbox setting: owner only, validated, used as Reply-To on sends."""
import asyncio
import os

import requests
from dotenv import dotenv_values

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


def login(email, password):
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": email, "password": password}).status_code == 200
    return s


def test_reply_inbox_setting():
    admin = login("admin@tinysvouchers.com.au", "TinyAdmin!2026")
    before = admin.get(f"{API}/admin/email-settings").json()["reply_to"]
    try:
        assert admin.put(f"{API}/admin/email-settings", json={"reply_to": "nope"}).status_code == 422
        assert admin.put(f"{API}/admin/email-settings", json={"reply_to": "Replies@GoPerks.au"}).json() == {"reply_to": "replies@goperks.au"}
        assert admin.get(f"{API}/admin/email-settings").json() == {"reply_to": "replies@goperks.au"}
        member = login("member@tinysvouchers.com.au", "Member!2026")
        assert member.get(f"{API}/admin/email-settings").status_code == 403
        assert member.put(f"{API}/admin/email-settings", json={"reply_to": "x@goperks.au"}).status_code == 403
    finally:
        admin.put(f"{API}/admin/email-settings", json={"reply_to": before or "hello@goperks.au"})


def test_send_uses_reply_inbox():
    os.environ.update({k: v for k, v in ENV.items() if v is not None and k not in os.environ})
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    import email_service
    assert asyncio.run(email_service.reply_inbox()) == "hello@goperks.au"
