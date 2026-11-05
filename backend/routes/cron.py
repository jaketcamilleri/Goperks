"""Endpoints called by the platform scheduler (.emergent/crons.yml)."""
import asyncio
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from core import db, now_iso, verify_cron, MELB
from services import run_weekly_digest, run_gift_deliveries, run_renewal_reminders, run_partner_reports, run_new_deals

router = APIRouter(prefix="/cron")


async def accept(request: Request, kind: str, job) -> dict:
    """Validate the envelope, de-duplicate by run id and start the job in the background."""
    try:
        envelope = await request.json()
    except Exception:
        envelope = None
    if envelope is not None and not isinstance(envelope, dict):
        raise HTTPException(400, "Invalid body")
    run_id = request.headers.get("X-Webhook-Id") or (envelope or {}).get("run_id") or now_iso()
    try:
        await db.cron_runs.insert_one({"_id": f"{kind}:{run_id}", "created_at": now_iso()})
    except DuplicateKeyError:
        return {"status": "duplicate"}
    asyncio.create_task(job())
    return {"status": "accepted"}


@router.post("/weekly-digest")
async def cron_weekly_digest(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    verify_cron(request)
    return await accept(request, "digest", run_weekly_digest)


@router.post("/gift-deliveries")
async def cron_gift_deliveries(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    verify_cron(request)
    return await accept(request, "gifts", run_gift_deliveries)


@router.post("/renewal-reminders")
async def cron_renewal_reminders(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    verify_cron(request)
    return await accept(request, "renewal", run_renewal_reminders)


@router.post("/partner-reports")
async def cron_partner_reports(request: Request, force: bool = False):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    verify_cron(request)
    if not force and datetime.now(MELB).day != 1:
        return {"status": "skipped", "reason": "Partner reports go out on the 1st of each month"}
    return await accept(request, "reports", run_partner_reports)


@router.post("/new-deals")
async def cron_new_deals(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    verify_cron(request)
    return await accept(request, "newdeals", run_new_deals)
