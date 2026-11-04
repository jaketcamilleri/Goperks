"""Manage account: update details, change password, payment history."""
import os
import uuid

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
FRONT = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env"))
API = FRONT["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]


def test_manage_account():
    email = f"test_acct_{uuid.uuid4().hex[:6]}@example.com"
    new_email = email.replace("test_acct_", "test_acct2_")
    s = requests.Session()
    try:
        r = s.post(f"{API}/auth/register", json={"name": "TEST Acct", "email": email, "password": "Passw0rd!", "role": "member"})
        assert r.status_code == 200 and r.json()["has_password"] is True
        # Name / phone change needs no password
        u = s.patch(f"{API}/me", json={"name": "TEST Renamed", "email": email, "phone": "0400 111 222"}).json()
        assert u["name"] == "TEST Renamed" and u["phone"] == "0400 111 222"
        # Email change needs the current password and a free address
        assert s.patch(f"{API}/me", json={"name": "TEST Renamed", "email": new_email}).status_code == 400
        assert s.patch(f"{API}/me", json={"name": "TEST Renamed", "email": "member@tinysvouchers.com.au", "current_password": "Passw0rd!"}).status_code == 400
        assert s.patch(f"{API}/me", json={"name": "TEST Renamed", "email": new_email, "current_password": "Passw0rd!"}).json()["email"] == new_email
        # Password change
        assert s.post(f"{API}/me/password", json={"current_password": "wrong", "new_password": "NewPassw0rd!"}).status_code == 400
        assert s.post(f"{API}/me/password", json={"current_password": "Passw0rd!", "new_password": "short"}).status_code == 422
        assert s.post(f"{API}/me/password", json={"current_password": "Passw0rd!", "new_password": "NewPassw0rd!"}).status_code == 200
        assert requests.post(f"{API}/auth/login", json={"email": new_email, "password": "NewPassw0rd!"}).status_code == 200
        assert s.get(f"{API}/me/payments").json() == []
        assert requests.get(f"{API}/me/payments").status_code == 401
    finally:
        DB.users.delete_many({"email": {"$in": [email, new_email]}})
