"""Apple and Google Wallet member cards."""
from fastapi import APIRouter, HTTPException, Response, Depends
from fastapi.responses import FileResponse

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
    return {"apple": wallet.apple_ready(), "google": wallet.google_ready()}


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


@router.get("/google")
async def wallet_google(user=Depends(current_user)):
    if not wallet.google_ready():
        raise HTTPException(503, "Google Wallet isn't set up yet")
    member = wallet_member(user)
    try:
        return {"url": wallet.google_save_url(member)}
    except Exception as e:
        logger.error("google wallet link failed: %s", type(e).__name__)
        raise HTTPException(503, "Google Wallet card is temporarily unavailable")


@router.get("/google-logo.png")
async def wallet_google_logo():
    return FileResponse(wallet.ASSETS / "google_logo.png", media_type="image/png")
