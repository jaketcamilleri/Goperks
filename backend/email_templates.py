import os
from html import escape

from email_service import EMAIL_FROM_NAME


def _app_url(path: str) -> str:
    return f"{os.environ['FRONTEND_URL'].rstrip('/')}{path}"


def _layout(heading: str, body_html: str, cta_label: str, cta_path: str) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#EAF6F3"><tr><td style="padding:32px;color:#17434C">'
        '<p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#9A4024;margin:0 0 12px">'
        f'{escape(EMAIL_FROM_NAME)}</p>'
        f'<h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 18px">{heading}</h1>'
        f'{body_html}'
        f'<p style="margin:28px 0"><a href="{escape(_app_url(cta_path))}" style="background:#B9512E;color:#EAF6F3;padding:14px 26px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">{escape(cta_label)}</a></p>'
        f'<p style="font-family:Arial,sans-serif;font-size:12px;color:#5E7F84">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>'
        '</td></tr></table>'
    )


def _p(text: str) -> str:
    return f'<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 12px">{text}</p>'


def _card(name: str, code: str, expires: str) -> str:
    return (
        '<table role="presentation" style="background:#17434C;border-radius:18px;margin:20px 0;width:100%;max-width:420px"><tr>'
        '<td style="padding:22px;font-family:Arial,sans-serif;color:#EAF6F3">'
        '<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#EE8A63">Go Perks member card</p>'
        f'<p style="margin:10px 0 4px;font-family:Georgia,serif;font-size:22px">{escape(name)}</p>'
        f'<p style="margin:0;font-family:Courier New,monospace;font-size:20px;font-weight:bold;letter-spacing:3px">{escape(code)}</p>'
        f'<p style="margin:8px 0 0;font-size:12px;color:#C2DEDA">Valid until {escape(expires)}</p>'
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
    note = (f'<p style="font-family:Georgia,serif;font-size:18px;font-style:italic;line-height:1.5;border-left:3px solid #EE8A63;padding-left:14px;margin:18px 0">“{escape(message)}”</p>' if message else "")
    body = (_p(f"Hi {first}, {giver_first} has gifted you a full year of {escape(EMAIL_FROM_NAME)} — exclusive deals at local cafes, kids activities, restaurants and days out.")
            + note
            + '<table role="presentation" style="background:#17434C;border-radius:18px;margin:20px 0;width:100%;max-width:420px"><tr><td style="padding:22px;font-family:Arial,sans-serif;color:#EAF6F3">'
            '<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#EE8A63">Your gift code</p>'
            f'<p style="margin:10px 0 0;font-family:Courier New,monospace;font-size:22px;font-weight:bold;letter-spacing:3px">{escape(code)}</p>'
            '</td></tr></table>'
            + _p("Tap the button to create your free account and start your 12 months. The code works once."))
    return f"{giver_first} gifted you a year of {EMAIL_FROM_NAME}", _layout("A gift for you!", body, "Claim my membership", f"/redeem-gift?code={code}")


def partner_welcome_email(name: str, business: str):
    first = escape(name.split(" ")[0] if name else "there")
    step = lambda n, t, d: (
        '<tr><td style="padding:10px 0;vertical-align:top;width:44px">'
        f'<span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:16px;background:#EE8A63;color:#17434C;font-family:Georgia,serif;font-weight:bold">{n}</span></td>'
        f'<td style="padding:10px 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#17434C"><b>{t}</b><br>{d}</td></tr>')
    body = (_p(f"Hi {first}, welcome to {escape(EMAIL_FROM_NAME)}! {escape(business)} is now set up as a partner.")
            + _p("Here's everything you need to get started:")
            + '<table role="presentation" style="margin:8px 0 16px">'
            + step(1, "Submit your first deal", "Open your partner portal and add an offer. We review it and put it live for members.")
            + step(2, "Print your window sticker", "In your portal, tap \u201cWindow sticker\u201d then \u201cPrint or save as PDF\u201d. Stick it on your door or counter so members know to ask.")
            + step(3, "Check codes at the counter", "Members show a QR code on their phone. In your portal tap \u201cScan\u201d (or type the code) under \u201cCheck a code\u201d.")
            + step(4, "Redeem the deal", "For a voucher, tap \u201cMark as redeemed\u201d. For a member card, pick the deal they're using. Each deal is one use per member per year.")
            + '</table>'
            + _p("Your portal also shows how many members claimed and redeemed your deals each month."))
    return f"Welcome to {EMAIL_FROM_NAME} \u2014 your partner kit", _layout("Your partner kit", body, "Get my window sticker", "/business/sticker")


def deal_decision_email(name: str, title: str, approved: bool, note: str):
    first = escape(name.split(" ")[0] if name else "there")
    t = escape(title)
    note_html = (f'<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;background:#FFFFFF;border-left:3px solid #EE8A63;padding:12px 14px;margin:16px 0">'
                 f'<b>Note from the Go Perks team:</b><br>{escape(note)}</p>') if note else ""
    if approved:
        body = (_p(f"Hi {first}, great news \u2014 your deal <b>\u201c{t}\u201d</b> has been approved and is now live for members.")
                + note_html
                + _p("Members can find it in the deals directory and on the map. Scan their QR code at the counter to redeem it, and keep an eye on your monthly stats in the portal."))
        return f"Your deal is live on {EMAIL_FROM_NAME}", _layout("You're live!", body, "View my partner portal", "/business")
    body = (_p(f"Hi {first}, thanks for submitting <b>\u201c{t}\u201d</b>. Unfortunately we couldn't approve it this time.")
            + note_html
            + _p("You're welcome to adjust the offer and submit it again from your partner portal."))
    return f"Update on your {EMAIL_FROM_NAME} deal", _layout("About your deal", body, "Submit a new deal", "/business")


def business_rejected_email(name: str, business: str, note: str):
    first = escape(name.split(" ")[0] if name else "there")
    note_html = (f'<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;background:#FFFFFF;border-left:3px solid #EE8A63;padding:12px 14px;margin:16px 0">'
                 f'<b>Note from the Go Perks team:</b><br>{escape(note)}</p>') if note else ""
    body = (_p(f"Hi {first}, thanks for your interest in listing {escape(business)} with {escape(EMAIL_FROM_NAME)}. Unfortunately we can't approve your partner account at the moment.")
            + note_html + _p("If you think this is a mistake, just reply to this email."))
    return f"Your {EMAIL_FROM_NAME} partner application", _layout("About your application", body, "Visit Go Perks", "/")


def new_applicant_email(name: str, business: str, email: str):
    row = lambda k, v: (f'<tr><td style="padding:6px 16px 6px 0;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5E7F84">{k}</td>'
                        f'<td style="padding:6px 0;font-family:Arial,sans-serif;font-size:15px;color:#17434C"><b>{escape(v)}</b></td></tr>')
    body = (_p("A new business has applied to become a Go Perks partner and is waiting for your approval.")
            + '<table role="presentation" style="background:#FFFFFF;border-radius:14px;padding:12px 16px;margin:16px 0">'
            + row("Business", business) + row("Contact", name) + row("Email", email) + '</table>'
            + _p("They can't submit deals until you approve them. Open the control room and go to the Businesses tab."))
    return f"New partner application: {business}", _layout("New partner application", body, "Review applicants", "/admin")


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
