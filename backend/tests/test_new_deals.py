"""'New deals near you' picks: within 15 km of the member's suburb, closest first; everything when the suburb is unknown."""
from core import find_suburb
from services import deals_near, km_between


def test_radius_and_order():
    es, mi = find_suburb("Essendon"), find_suburb("Mildura")
    deals = [
        {"title": "far", "lat": mi["lat"], "lng": mi["lng"]},
        {"title": "moonee", "lat": -37.765, "lng": 144.92},
        {"title": "here", "lat": es["lat"], "lng": es["lng"]},
        {"title": "no pin", "lat": None, "lng": None},
    ]
    assert [d["title"] for d in deals_near(deals, es)] == ["here", "moonee"]
    assert [d["title"] for d in deals_near(deals, mi)] == ["far"]
    assert len(deals_near(deals, None)) == 4


def test_distance():
    es, mi = find_suburb("Essendon"), find_suburb("Mildura")
    assert 400 < km_between(es["lat"], es["lng"], mi["lat"], mi["lng"]) < 500
