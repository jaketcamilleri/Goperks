"""School holiday window logic for the School Holiday Picks row."""
from routes.holidays import holiday_status


def test_inside_and_outside_holidays():
    assert holiday_status("2026-12-19")["active"] is True
    assert holiday_status("2027-01-26")["ends_on"] == "2027-01-26"
    out = holiday_status("2026-11-05")
    assert out["active"] is False and out["next"]["starts_on"] == "2026-12-19"
    assert holiday_status("2027-01-27")["active"] is False
