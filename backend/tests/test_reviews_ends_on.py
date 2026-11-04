"""Tests for reviews, ends_on, to-review, highlights endpoints."""
import os
import time
import datetime
import pytest
import requests

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=", 1)[1].strip().strip('"')
    except FileNotFoundError:
        pass
    return os.environ.get("REACT_APP_BACKEND_URL", "")


BASE_URL = _load_frontend_env().rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = BASE_URL + "/api"

ADMIN = {"email": "admin@tinysvouchers.com.au", "password": "TinyAdmin!2026"}
MEMBER = {"email": "member@tinysvouchers.com.au", "password": "Member!2026"}
BUSINESS = {"email": "business@tinysvouchers.com.au", "password": "Business!2026"}


def login(session, creds):
    r = session.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def admin():
    s = requests.Session()
    login(s, ADMIN)
    return s


@pytest.fixture
def member():
    s = requests.Session()
    login(s, MEMBER)
    return s


@pytest.fixture
def business():
    s = requests.Session()
    login(s, BUSINESS)
    return s


@pytest.fixture
def anon():
    return requests.Session()


# ---------- ends_on tests ----------
def _admin_find_business_user_id(admin_sess):
    r = admin_sess.get(f"{API}/admin/users", params={"role": "business"})
    assert r.status_code == 200, r.text
    for b in r.json():
        if b.get("email") == BUSINESS["email"]:
            return b["id"]
    pytest.skip("seed business not found via admin")


def _create_deal(admin_sess, biz_id, ends_on=None, title_suffix=""):
    payload = {
        "title": f"TEST Deal {title_suffix}{int(time.time()*1000)}",
        "business_name": "TEST Shop",
        "suburb": "Richmond",
        "category": "cafes",
        "offer": "10% off",
        "discount_label": "10% off",
        "description": "A test deal description",
        "image_url": "",
        "partner_id": biz_id,
    }
    if ends_on is not None:
        payload["ends_on"] = ends_on
    r = admin_sess.post(f"{API}/admin/deals", json=payload)
    assert r.status_code == 200, r.text
    deal = r.json()
    # approve
    r2 = admin_sess.post(f"{API}/admin/deals/{deal['id']}/status", json={"status": "approved"})
    assert r2.status_code == 200, r2.text
    return deal["id"]


@pytest.fixture
def created_deal_ids():
    return []


@pytest.fixture(autouse=True)
def _cleanup_deals(created_deal_ids):
    yield
    s = requests.Session()
    try:
        login(s, ADMIN)
        for did in created_deal_ids:
            s.delete(f"{API}/admin/deals/{did}")
    except Exception:
        pass


class TestEndsOn:
    def test_ends_on_future_shows_in_list(self, admin, created_deal_ids):
        biz_id = _admin_find_business_user_id(admin)
        future = (datetime.date.today() + datetime.timedelta(days=5)).isoformat()
        did = _create_deal(admin, biz_id, ends_on=future, title_suffix="ENDING_SOON_")
        created_deal_ids.append(did)

        r = requests.get(f"{API}/deals")
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        assert did in ids
        # detail
        r2 = requests.get(f"{API}/deals/{did}")
        assert r2.status_code == 200
        assert r2.json().get("ended") is False
        assert r2.json().get("ends_on") == future

    def test_ends_on_past_hides_from_list_but_detail_shows_ended(self, admin, created_deal_ids):
        biz_id = _admin_find_business_user_id(admin)
        past = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        did = _create_deal(admin, biz_id, ends_on=past, title_suffix="ENDED_")
        created_deal_ids.append(did)

        r = requests.get(f"{API}/deals")
        ids = [d["id"] for d in r.json()]
        assert did not in ids

        r2 = requests.get(f"{API}/deals/{did}")
        assert r2.status_code == 200
        assert r2.json().get("ended") is True

    def test_ends_on_invalid_format_rejected(self, admin):
        biz_id = _admin_find_business_user_id(admin)
        r = admin.post(f"{API}/admin/deals", json={
            "title": "TEST bad ends", "business_name": "x", "suburb": "y", "category": "cafe",
            "offer": "1", "discount_label": "1", "description": "desc longer", "image_url": "", "partner_id": biz_id,
            "ends_on": "2025/01/01",
        })
        assert r.status_code == 422


# ---------- Reviews ----------
def _give_voucher_and_redeem(admin_sess, member_sess, deal_id):
    """Member claims voucher, member marks it as used."""
    r = member_sess.post(f"{API}/deals/{deal_id}/voucher")
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    r2 = member_sess.post(f"{API}/me/vouchers/{vid}/redeem")
    assert r2.status_code == 200, r2.text
    return vid


class TestReviews:
    def test_review_requires_redemption(self, admin, member, created_deal_ids):
        biz_id = _admin_find_business_user_id(admin)
        did = _create_deal(admin, biz_id, title_suffix="REVIEW_LOCK_")
        created_deal_ids.append(did)

        # member hasn't redeemed - should get 403
        r = member.post(f"{API}/deals/{did}/reviews", json={"rating": 5, "comment": "Nice"})
        assert r.status_code == 403

        # GET public reviews works
        r = requests.get(f"{API}/deals/{did}/reviews")
        assert r.status_code == 200
        body = r.json()
        assert body["reviews"] == []
        assert body.get("can_review") is False

    def test_review_flow_post_and_update(self, admin, member, created_deal_ids):
        biz_id = _admin_find_business_user_id(admin)
        did = _create_deal(admin, biz_id, title_suffix="REVIEW_OK_")
        created_deal_ids.append(did)
        _give_voucher_and_redeem(admin, member, did)

        # member/to-review should contain the deal
        r = member.get(f"{API}/me/to-review")
        assert r.status_code == 200
        assert any(x["deal_id"] == did for x in r.json())

        # post review
        r = member.post(f"{API}/deals/{did}/reviews", json={"rating": 5, "comment": "Really good TEST review 123"})
        assert r.status_code == 200, r.text
        rev = r.json()
        assert rev["rating"] == 5

        # deal rating updated
        d = requests.get(f"{API}/deals/{did}").json()
        assert d["rating_avg"] == 5.0
        assert d["rating_count"] == 1

        # update (same member) - rating changes
        r = member.post(f"{API}/deals/{did}/reviews", json={"rating": 4, "comment": "Updated TEST review text"})
        assert r.status_code == 200
        d2 = requests.get(f"{API}/deals/{did}").json()
        assert d2["rating_avg"] == 4.0
        assert d2["rating_count"] == 1  # still one review (upsert)

        # to-review now excludes it
        r = member.get(f"{API}/me/to-review")
        assert not any(x["deal_id"] == did for x in r.json())

        # Cleanup: hide to decrement count
        rows = admin.get(f"{API}/admin/reviews").json()
        rid = next(x["id"] for x in rows if x["deal_id"] == did)
        hr = admin.post(f"{API}/admin/reviews/{rid}/hide", json={"hidden": True})
        assert hr.status_code == 200
        d3 = requests.get(f"{API}/deals/{did}").json()
        assert d3["rating_count"] == 0

    def test_review_business_endpoint(self, admin, member, business, created_deal_ids):
        biz_id = _admin_find_business_user_id(admin)
        did = _create_deal(admin, biz_id, title_suffix="BIZ_REVIEW_")
        created_deal_ids.append(did)
        _give_voucher_and_redeem(admin, member, did)
        r = member.post(f"{API}/deals/{did}/reviews", json={"rating": 5, "comment": "Partner review listing test content"})
        assert r.status_code == 200

        # business needs approved+complete profile; seed is approved, maybe not complete
        r = business.get(f"{API}/business/reviews")
        # either forbidden due to incomplete profile, or 200
        assert r.status_code in (200, 403)

        # admin reviews should list it
        ar = admin.get(f"{API}/admin/reviews")
        assert ar.status_code == 200
        assert any(x["deal_id"] == did for x in ar.json())

        # cleanup hide
        rows = admin.get(f"{API}/admin/reviews").json()
        rid = next(x["id"] for x in rows if x["deal_id"] == did)
        admin.post(f"{API}/admin/reviews/{rid}/hide", json={"hidden": True})

    def test_highlights_endpoint(self, anon):
        r = anon.get(f"{API}/reviews/highlights")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_to_review_requires_auth(self, anon):
        r = anon.get(f"{API}/me/to-review")
        assert r.status_code == 401

    def test_admin_reviews_requires_admin(self, anon, member):
        r = anon.get(f"{API}/admin/reviews")
        assert r.status_code in (401, 403)
        r2 = member.get(f"{API}/admin/reviews")
        assert r2.status_code == 403
