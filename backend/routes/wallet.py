"""Apple Wallet member cards."""
from fastapi import APIRouter, HTTPException, Response, Depends

import wallet
from core import logger
from deps import current_user

router = APIRouter(prefix="/wallet")


def wallet_member(user: dict) -> dict:
    if user["membership_status"] != "active" or not user.get("member_code"):
        raise HTTPException(402, "An active membership is required for a wallet card")
    return user


@router.get("/status")
async def wallet_status():
    return {"apple": wallet.apple_ready()}


@router.get("/apple")
async def wallet_apple(user=Depends(current_user)):
    if not wallet.apple_ready():
        raise HTTPException(503, "Apple Wallet isn't set up yet")
    member = wallet_member(user)
    try:
        data = wallet.build_pkpass(member)
    except Exception as e:
        logger.error("pkpass build failed: %s", type(e).__name__)
        raise HTTPException(503, "Apple Wallet card is temporarily unavailable")
    return Response(content=data, media_type="application/vnd.apple.pkpass",
                    headers={"Content-Disposition": f'attachment; filename="go-perks-card-{member["member_code"]}.pkpass"'})

