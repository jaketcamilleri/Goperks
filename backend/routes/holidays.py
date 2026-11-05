"""Victorian government school holidays (from vic.gov.au term dates), used to show the School Holiday Picks row."""
from fastapi import APIRouter

from core import melb_today

router = APIRouter()

# Inclusive holiday periods between terms. Source: https://www.vic.gov.au/school-term-dates-and-holidays-victoria
# Add the next block when the Minister publishes new term dates (summer 2027-28 end assumed 26 Jan).
VIC_HOLIDAYS = [
    ("2025-12-20", "2026-01-26", "Summer holidays"),
    ("2026-04-03", "2026-04-19", "Autumn holidays"),
    ("2026-06-27", "2026-07-12", "Winter holidays"),
    ("2026-09-19", "2026-10-04", "Spring holidays"),
    ("2026-12-19", "2027-01-26", "Summer holidays"),
    ("2027-03-26", "2027-04-11", "Autumn holidays"),
    ("2027-06-26", "2027-07-11", "Winter holidays"),
    ("2027-09-18", "2027-10-03", "Spring holidays"),
    ("2027-12-18", "2028-01-26", "Summer holidays"),
]


def holiday_status(today: str | None = None) -> dict:
    today = today or melb_today()
    for start, end, name in VIC_HOLIDAYS:
        if start <= today <= end:
            return {"active": True, "name": name, "starts_on": start, "ends_on": end}
    nxt = next(((s, e, n) for s, e, n in VIC_HOLIDAYS if s > today), None)
    return {"active": False, "next": {"name": nxt[2], "starts_on": nxt[0], "ends_on": nxt[1]} if nxt else None}


@router.get("/school-holidays")
async def school_holidays():
    return holiday_status()
