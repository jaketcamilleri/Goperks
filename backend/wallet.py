import base64
import hashlib
import io
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs7, pkcs12

ASSETS = Path(__file__).parent / "wallet_assets"
ORG = "Local Perks"
APPLE_KEYS = ("APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID", "APPLE_PASS_P12_BASE64", "APPLE_PASS_P12_PASSWORD")
GOOGLE_KEYS = ("GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON")


def apple_ready() -> bool:
    return all(os.environ.get(k) for k in APPLE_KEYS[:3])


def google_ready() -> bool:
    return all(os.environ.get(k) for k in GOOGLE_KEYS)


def _iso(iso: str) -> str:
    dt = datetime.fromisoformat(iso).astimezone(timezone.utc)
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")


def build_pkpass(user: dict) -> bytes:
    expires = _iso(user["membership_expires_at"])
    pass_json = {
        "formatVersion": 1,
        "passTypeIdentifier": os.environ["APPLE_PASS_TYPE_ID"],
        "serialNumber": user["member_code"],
        "teamIdentifier": os.environ["APPLE_TEAM_ID"],
        "organizationName": ORG,
        "description": f"{ORG} member card",
        "logoText": ORG,
        "foregroundColor": "rgb(234, 246, 243)",
        "labelColor": "rgb(238, 138, 99)",
        "backgroundColor": "rgb(23, 67, 76)",
        "expirationDate": expires,
        "sharingProhibited": True,
        "storeCard": {
            "primaryFields": [{"key": "member", "label": "MEMBER", "value": user["name"]}],
            "secondaryFields": [{"key": "code", "label": "MEMBER NO.", "value": user["member_code"]}],
            "auxiliaryFields": [{"key": "expiry", "label": "VALID UNTIL", "value": expires,
                                 "dateStyle": "PKDateStyleMedium", "timeStyle": "PKDateStyleNone"}],
            "backFields": [{"key": "how", "label": "How to use",
                            "value": "Show this card at any partner counter to get the member deal."}],
        },
        "barcodes": [{"format": "PKBarcodeFormatQR", "message": user["member_code"],
                      "messageEncoding": "iso-8859-1", "altText": user["member_code"]}],
    }
    files = {"pass.json": json.dumps(pass_json, separators=(",", ":")).encode()}
    for name in ("icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png"):
        files[name] = (ASSETS / name).read_bytes()
    manifest = json.dumps({n: hashlib.sha1(b).hexdigest() for n, b in files.items()}, sort_keys=True).encode()

    pw = os.environ.get("APPLE_PASS_P12_PASSWORD") or ""
    key, cert, _ = pkcs12.load_key_and_certificates(
        base64.b64decode(os.environ["APPLE_PASS_P12_BASE64"]), pw.encode() or None)
    wwdr = x509.load_pem_x509_certificate((ASSETS / "AppleWWDRCAG4.pem").read_bytes())
    signature = (pkcs7.PKCS7SignatureBuilder().set_data(manifest)
                 .add_signer(cert, key, hashes.SHA256()).add_certificate(wwdr)
                 .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature, pkcs7.PKCS7Options.Binary]))
    files.update({"manifest.json": manifest, "signature": signature})
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)
    return out.getvalue()


def google_save_url(user: dict) -> str:
    from google.auth import crypt, jwt

    info = json.loads(os.environ["GOOGLE_WALLET_SERVICE_ACCOUNT_JSON"])
    issuer = os.environ["GOOGLE_WALLET_ISSUER_ID"]
    class_id = f"{issuer}.tinys_membership_v1"
    frontend = os.environ["FRONTEND_URL"].rstrip("/")
    text = lambda v: {"defaultValue": {"language": "en-AU", "value": v}}
    obj = {
        "id": f"{issuer}.member_{user['member_code'].replace('-', '_')}",
        "classId": class_id,
        "state": "ACTIVE",
        "cardTitle": text(ORG),
        "header": text(user["name"]),
        "subheader": text("Member"),
        "hexBackgroundColor": "#17434C",
        "logo": {"sourceUri": {"uri": f"{frontend}/api/wallet/google-logo.png"}},
        "textModulesData": [
            {"id": "member_code", "header": "Member no.", "body": user["member_code"]},
            {"id": "valid_until", "header": "Valid until",
             "body": datetime.fromisoformat(user["membership_expires_at"]).strftime("%-d %b %Y")},
        ],
        "barcode": {"type": "QR_CODE", "value": user["member_code"], "alternateText": user["member_code"]},
        "validTimeInterval": {"end": {"date": _iso(user["membership_expires_at"])}},
    }
    claims = {
        "iss": info["client_email"], "aud": "google", "origins": [frontend], "typ": "savetowallet",
        "payload": {"genericClasses": [{"id": class_id}], "genericObjects": [obj]},
    }
    token = jwt.encode(crypt.RSASigner.from_service_account_info(info), claims)
    if isinstance(token, bytes):
        token = token.decode()
    return "https://pay.google.com/gp/v/save/" + quote(token, safe="")
