"""Owner-only editor for every email template, with custom copies of the two pitches."""
import secrets
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

import email_templates as et
from core import db, now_iso
from deps import require_role

router = APIRouter(prefix="/admin/email-templates")
owner = require_role("admin")


class TemplateIn(BaseModel):
    name: Optional[str] = Field(None, max_length=80)
    subject: str = Field(min_length=1, max_length=200)
    heading: str = Field(min_length=1, max_length=200)
    intro: str = Field("", max_length=3000)
    bullets: List[str] = Field(default_factory=list, max_length=12)
    outro: str = Field("", max_length=3000)
    button: str = Field(min_length=1, max_length=60)
    layout: str = "classic"
    banner_url: str = Field("", max_length=500)


class NewTemplateIn(BaseModel):
    base: str
    name: str = Field(min_length=1, max_length=80)


class PreviewIn(TemplateIn):
    key: str
    note: str = Field("", max_length=300)


async def refresh_templates():
    et.set_overrides(await db.email_templates.find({}, {"_id": 0}).to_list(500))


def public(key: str) -> dict:
    t = et.template(key)
    return {k: t[k] for k in ("key", "base", "custom", "edited", "name", "audience", "kind", "vars", "subject", "heading", "intro",
                              "bullets", "outro", "button", "layout", "banner_url")}


def check(body: TemplateIn):
    if body.layout not in et.LAYOUTS:
        raise HTTPException(400, "Unknown layout")
    if body.banner_url and not body.banner_url.startswith("https://"):
        raise HTTPException(400, "Banner image must be an https:// link")


@router.get("")
async def list_templates(_=Depends(owner)):
    custom = [r["key"] for r in await db.email_templates.find({"base": {"$exists": True}}, {"key": 1}).sort("created_at", 1).to_list(500)]
    return [public(k) for k in list(et.DEFAULTS) + custom]


@router.post("")
async def new_template(body: NewTemplateIn, _=Depends(owner)):
    if et.DEFAULTS.get(body.base, {}).get("kind") != "pitch":
        raise HTTPException(400, "You can only make extra versions of the member invite or partner pitch")
    key = f"{body.base}-{secrets.token_hex(3)}"
    src = et.template(body.base)
    await db.email_templates.insert_one({"key": key, "base": body.base, **{k: src[k] for k in et.EDITABLE}, "name": body.name.strip(),
                                         "created_at": now_iso(), "updated_at": now_iso()})
    await refresh_templates()
    return public(key)


@router.post("/preview")
async def preview_template(body: PreviewIn, _=Depends(owner)):
    check(body)
    if body.key not in et.DEFAULTS and body.key not in et._OVERRIDES:
        raise HTTPException(404, "Template not found")
    t = {**et.template(body.key), **body.model_dump(exclude={"key", "note", "name"})}
    subject, html = et.preview(body.key, t, body.note)
    return {"subject": subject, "html": html}


@router.put("/{key}")
async def save_template(key: str, body: TemplateIn, _=Depends(owner)):
    check(body)
    existing = et._OVERRIDES.get(key)
    if key not in et.DEFAULTS and not existing:
        raise HTTPException(404, "Template not found")
    data = body.model_dump(exclude_none=True)
    data["bullets"] = [b.strip() for b in data["bullets"] if b.strip()]
    if key in et.DEFAULTS:
        data.pop("name", None)
    await db.email_templates.update_one({"key": key}, {"$set": {**data, "updated_at": now_iso()}, "$setOnInsert": {"created_at": now_iso()}}, upsert=True)
    await refresh_templates()
    return public(key)


@router.delete("/{key}")
async def reset_or_delete(key: str, _=Depends(owner)):
    """Built-in templates go back to the original wording; extra versions are deleted."""
    await db.email_templates.delete_one({"key": key})
    await refresh_templates()
    return public(key) if key in et.DEFAULTS else {"deleted": True}
