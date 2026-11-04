import os
from html import escape

from email_service import EMAIL_FROM_NAME


def _app_url(path: str) -> str:
    return f"{os.environ['FRONTEND_URL'].rstrip('/')}{path}"


def _layout(heading: str, body_html: str, cta_label: str, cta_path: str) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#FBF8F3"><tr><td style="padding:32px;color:#1E2229">'
        '<p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#B63F18;margin:0 0 12px">'
        f'{escape(EMAIL_FROM_NAME)}</p>'
        f'<h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 18px">{heading}</h1>'
        f'{body_html}'
        f'<p style="margin:28px 0"><a href="{escape(_app_url(cta_path))}" style="background:#D95329;color:#FBF8F3;padding:14px 26px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">{escape(cta_label)}</a></p>'
        f'<p style="font-family:Arial,sans-serif;font-size:12px;color:#818C9C">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>'
        '</td></tr></table>'
    )


def _p(text: str) -> str:
    return f'<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 12px">{text}</p>'


def _card(name: str, code: str, expires: str) -> str:
    return (
        '<table role="presentation" style="background:#1E2229;border-radius:18px;margin:20px 0;width:100%;max-width:420px"><tr>'
        '<td style="padding:22px;font-family:Arial,sans-serif;color:#FBF8F3">'
        '<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#F3A72E">Tiny\'s Club member card</p>'
        f'<p style="margin:10px 0 4px;font-family:Georgia,serif;font-size:22px">{escape(name)}</p>'
        f'<p style="margin:0;font-family:Courier New,monospace;font-size:20px;font-weight:bold;letter-spacing:3px">{escape(code)}</p>'
        f'<p style="margin:8px 0 0;font-size:12px;color:#E5DEC9">Valid until {escape(expires)}</p>'
        '</td></tr></table>'
    )


def welcome_email(name: str, code: str, expires: str):
    first = escape(name.split(" ")[0] if name else "there")
    body = (_p(f"Hi {first}, your membership is active. Welcome to the club!")
            + _card(name, code, expires)
            + _p("Show your member card or a voucher code at any partner counter to save. Your card is always in your account on your phone."))
    return f"Welcome to {EMAIL_FROM_NAME} — here's your member card", _layout("You're in!", body, "Browse the deals", "/deals")


def gift_email(recipient: str, giver: str, message: str, code: str):
    first = escape(recipient.split(" ")[0] if recipient else "there")
    giver_first = escape(giver.split(" ")[0] if giver else "A friend")
    note = (f'<p style="font-family:Georgia,serif;font-size:18px;font-style:italic;line-height:1.5;border-left:3px solid #F3A72E;padding-left:14px;margin:18px 0">“{escape(message)}”</p>' if message else "")
    body = (_p(f"Hi {first}, {giver_first} has gifted you a full year of {escape(EMAIL_FROM_NAME)} — exclusive deals at local cafes, kids activities, restaurants and days out.")
            + note
            + '<table role="presentation" style="background:#1E2229;border-radius:18px;margin:20px 0;width:100%;max-width:420px"><tr><td style="padding:22px;font-family:Arial,sans-serif;color:#FBF8F3">'
            '<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#F3A72E">Your gift code</p>'
            f'<p style="margin:10px 0 0;font-family:Courier New,monospace;font-size:22px;font-weight:bold;letter-spacing:3px">{escape(code)}</p>'
            '</td></tr></table>'
            + _p("Tap the button to create your free account and start your 12 months. The code works once."))
    return f"{giver_first} gifted you a year of {EMAIL_FROM_NAME}", _layout("A gift for you!", body, "Claim my membership", f"/redeem-gift?code={code}")


def renewal_email(name: str, code: str, expires: str, saved: float, used: int):
    first = escape(name.split(" ")[0] if name else "there")
    saved_line = (f"So far you've saved <b>${saved:,.2f}</b> across {used} deal{'s' if used != 1 else ''} — "
                  + ("your membership has more than paid for itself." if saved >= 49 else "and there's plenty more to unlock.")) if used else \
        "You still have plenty of deals to try before your year is up."
    body = (_p(f"Hi {first}, your membership ends on <b>{escape(expires)}</b> — that's about two weeks away.")
            + _p(saved_line)
            + _card(name, code, expires)
            + _p("Renew for another year at A$49 to keep every deal in the club. Renewing early adds 12 months on top of your current end date."))
    return f"Your {EMAIL_FROM_NAME} membership ends in 2 weeks", _layout("Time flies!", body, "Renew my membership", "/join")
