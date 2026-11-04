"""Prospects: businesses the owner might sign up as partners. A private list only; nothing is emailed from here."""
import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, oid, now_iso, CATEGORIES
from deps import require_role
from models import BaseDocument

router = APIRouter(prefix="/admin/prospects")
owner = require_role("admin")
STATUSES = ("new", "contacted", "interested", "joined", "not_interested")
SEED_FILE = Path(__file__).parent.parent / "prospects_seed.json"


class Prospect(BaseDocument):
    business_name: str
    category: str = "essentials"
    suburb: str = ""
    website: str = ""
    email: str = ""
    phone: str = ""
    source_url: str = ""
    status: str = "new"
    notes: str = ""
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class ProspectIn(BaseModel):
    business_name: str = Field(min_length=1, max_length=120)
    category: str = "essentials"
    suburb: str = Field("", max_length=80)
    website: str = Field("", max_length=200)
    email: str = Field("", max_length=200)
    phone: str = Field("", max_length=30)
    status: str = "new"
    notes: str = Field("", max_length=1000)


class ProspectPatch(BaseModel):
    business_name: Optional[str] = Field(None, min_length=1, max_length=120)
    category: Optional[str] = None
    suburb: Optional[str] = Field(None, max_length=80)
    website: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=30)
    status: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=1000)


def check(data: dict):
    if "category" in data and data["category"] not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if "status" in data and data["status"] not in STATUSES:
        raise HTTPException(400, "Invalid status")
    if data.get("email") and "@" not in data["email"]:
        raise HTTPException(400, "That email doesn't look right")


async def seed_prospects():
    """Load the researched starter list once, when the list is empty."""
    if await db.prospects.count_documents({}) or not SEED_FILE.exists():
        return
    rows = json.loads(SEED_FILE.read_text())
    await db.prospects.insert_many([Prospect(**r).to_mongo() for r in rows])


@router.get("")
async def list_prospects(_=Depends(owner)):
    rows = await db.prospects.find({}).sort("business_name", 1).to_list(5000)
    return [Prospect.from_mongo(r).out() for r in rows]


@router.post("")
async def add_prospect(body: ProspectIn, _=Depends(owner)):
    data = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items()}
    check(data)
    p = Prospect(**data, source_url="Added by you")
    res = await db.prospects.insert_one(p.to_mongo())
    p.id = str(res.inserted_id)
    return p.out()


@router.patch("/{prospect_id}")
async def update_prospect(prospect_id: str, body: ProspectPatch, _=Depends(owner)):
    data = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    check(data)
    res = await db.prospects.find_one_and_update({"_id": oid(prospect_id)}, {"$set": {**data, "updated_at": now_iso()}}, return_document=True)
    if not res:
        raise HTTPException(404, "Prospect not found")
    return Prospect.from_mongo(res).out()


@router.delete("/{prospect_id}")
async def delete_prospect(prospect_id: str, _=Depends(owner)):
    await db.prospects.delete_one({"_id": oid(prospect_id)})
    return {"ok": True}
