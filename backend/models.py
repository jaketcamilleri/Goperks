"""Mongo document models and request bodies."""
from typing import Annotated, Optional, List

from bson import ObjectId
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr

from core import now_iso

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc) if doc else None

    def to_mongo(self):
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data

    def out(self):
        return self.model_dump(by_alias=False)


class User(BaseDocument):
    email: str
    name: str
    role: str = "member"
    business_name: Optional[str] = None
    membership_status: str = "inactive"
    membership_expires_at: Optional[str] = None
    bonus_days_pending: int = 0
    auto_renew: bool = False
    member_code: Optional[str] = None
    business_status: Optional[str] = None
    super_admin: bool = False
    address: Optional[str] = None
    suburb: Optional[str] = None
    postcode: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    opening_hours: Optional[str] = None
    hours: Optional[dict] = None
    photos: List[str] = Field(default_factory=list)
    about: Optional[str] = None
    logo_path: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Deal(BaseDocument):
    title: str
    business_name: str
    category: str
    discount_label: str
    description: str
    terms: str = ""
    suburb: str = ""
    image_url: str = ""
    status: str = "approved"
    submitted_by: Optional[str] = None
    featured: bool = False
    holiday_pick: bool = False
    est_saving: float = 0.0
    lat: Optional[float] = None
    lng: Optional[float] = None
    ends_on: Optional[str] = None
    rating_avg: float = 0.0
    rating_count: int = 0
    created_at: str = Field(default_factory=now_iso)


class Voucher(BaseDocument):
    user_id: str
    deal_id: str
    deal_title: str
    business_name: str
    discount_label: str
    code: str
    status: str = "active"
    expires_at: str
    partner_id: Optional[str] = None
    est_saving: float = 0.0
    amount_saved: Optional[float] = None
    redeemed_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Activity(BaseDocument):
    actor_id: Optional[str] = None
    actor_name: str = "System"
    actor_email: Optional[str] = None
    actor_role: str = "system"
    action: str
    target_type: str
    target_id: Optional[str] = None
    target_label: str = ""
    details: str = ""
    created_at: str = Field(default_factory=now_iso)


# ---------- Request bodies ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    role: str = "member"
    business_name: Optional[str] = None
    ref: Optional[str] = Field(None, max_length=20)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str = Field(min_length=4, max_length=500)
    ref: Optional[str] = Field(None, max_length=20)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)


class DealIn(BaseModel):
    title: str = Field(min_length=3)
    business_name: str = ""
    partner_id: Optional[str] = None
    category: str
    discount_label: str = Field(min_length=1)
    description: str = Field(min_length=5)
    terms: str = ""
    suburb: str = ""
    image_url: str = ""
    featured: bool = False
    holiday_pick: bool = False
    est_saving: float = Field(0.0, ge=0, le=10000)
    ends_on: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field("", max_length=500)


class HideIn(BaseModel):
    hidden: bool


class StatusIn(BaseModel):
    status: str
    note: Optional[str] = Field(None, max_length=500)


class CodeIn(BaseModel):
    code: str = Field(min_length=4, max_length=80)


class CardRedeemIn(BaseModel):
    member_code: str = Field(min_length=4, max_length=20)
    deal_id: str
    live_token: Optional[str] = Field(None, max_length=80)


class RedeemIn(BaseModel):
    amount_saved: Optional[float] = Field(None, ge=0, le=10000)


class CheckoutIn(BaseModel):
    origin_url: str
    kind: str = "membership"
    gift_name: Optional[str] = Field(None, max_length=80)
    gift_email: Optional[EmailStr] = None
    gift_message: Optional[str] = Field(None, max_length=300)
    gift_send_date: Optional[str] = Field(None, max_length=10)
    ref: Optional[str] = Field(None, max_length=20)


class GiftRedeemIn(BaseModel):
    code: str = Field(min_length=6, max_length=30)


class AccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    suburb: Optional[str] = Field(default=None, max_length=80)
    postcode: Optional[str] = Field(default=None, max_length=4)
    current_password: Optional[str] = Field(default=None, max_length=200)


class PasswordChangeIn(BaseModel):
    current_password: Optional[str] = Field(default=None, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class EmailSettingsIn(BaseModel):
    reply_to: EmailStr


class AdminGiftIn(BaseModel):
    months: int = Field(ge=1, le=12)
    quantity: int = Field(default=1, ge=1, le=200)
    recipient_name: Optional[str] = Field(default=None, max_length=100)
    recipient_email: Optional[EmailStr] = None
    message: Optional[str] = Field(default=None, max_length=500)
    note: Optional[str] = Field(default=None, max_length=200)


class DayHours(BaseModel):
    open: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    close: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class ProfileIn(BaseModel):
    business_name: str = Field(min_length=1, max_length=120)
    address: str = Field(min_length=3, max_length=200)
    suburb: str = Field(min_length=2, max_length=80)
    postcode: str = Field(pattern=r"^3\d{3}$")
    phone: str = Field(min_length=6, max_length=30)
    website: Optional[str] = Field(None, max_length=200)
    instagram: Optional[str] = Field(None, max_length=60)
    hours: dict[str, Optional[DayHours]]
    about: str = Field(min_length=10, max_length=600)


class PhotoPathIn(BaseModel):
    path: str


class AdminCreateIn(BaseModel):
    role: str
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    business_name: Optional[str] = Field(None, max_length=120)
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    activate: bool = False
    send_invite: bool = True


class AdminUserPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    business_name: Optional[str] = Field(None, min_length=1, max_length=120)
    membership: Optional[str] = None
    expires_on: Optional[str] = None


class BulkIn(BaseModel):
    ids: List[str] = Field(min_length=1, max_length=200)
    status: str
    note: Optional[str] = Field(None, max_length=500)


class DecisionIn(BaseModel):
    token: str
    action: str
    note: Optional[str] = Field(None, max_length=500)
