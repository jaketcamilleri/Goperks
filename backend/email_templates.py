"""Every email Go Perks sends, built from editable templates.

Each template has a subject, heading, intro, optional bullet list, outro, button label and one of four layouts.
The owner's edits live in Mongo (email_templates) and are cached here; anything not edited uses DEFAULTS below.
Live data (member cards, stats tables, codes, notes) is added by code as the template's "block".
"""
import os
import re
from html import escape
from typing import Optional

from email_service import EMAIL_FROM_NAME

LAYOUTS = ("classic", "banner", "letter", "dark")
EDITABLE = ("name", "subject", "heading", "intro", "bullets", "outro", "button", "layout", "banner_url")
_OVERRIDES: dict = {}

D = lambda name, audience, kind, vars_, subject, heading, intro, outro, button, path, bullets=(), style="list", sample=None: {
    "name": name, "audience": audience, "kind": kind, "vars": list(vars_), "subject": subject, "heading": heading, "intro": intro,
    "bullets": list(bullets), "outro": outro, "button": button, "path": path, "bullet_style": style, "layout": "classic",
    "banner_url": "", "sample": sample or {}}

DEFAULTS = {
    "invite": D("Member invite", "member", "pitch", ["first_name"], "A year of local deals for A$49. Join {brand}",
                "Your year of local perks starts here",
                "Hi {first_name}, we'd love to have you as a {brand} member. One membership gives you a full year of exclusive deals and discounts "
                "at local cafes, restaurants, kids' activities, family days out and everyday essentials.\n\n**How it works:**",
                "Every deal can be used once per membership year, and you can see how much you've saved in your account.", "Become a member", "/join",
                ["Join for A$49 a year.", "Browse the deals and find the ones near you.", "Show your live member card at the counter and save."],
                "numbers", {"first_name": "Tony"}),
    "pitch": D("Partner pitch", "business", "pitch", ["business", "sender_first"], "Free to join: put {business} in front of local {brand} members",
               "Become a local partner",
               "Hi {business} team,\n\nI'm {sender_first} from {brand}, a A$49-a-year membership that gives local people exclusive deals and discounts "
               "at cafes, restaurants, kids' activities, family days out and everyday essentials.\n\nWe'd love to have {business} on board as a partner:",
               "Tap below to create your partner account, or just reply to this email with any questions.", "Become a partner", "biz:/register",
               ["**It's free to join.**", "**We advertise your business** on {brand}, so local members can find you.",
                "**You choose the offer** you give members, and you can update it any time."], "list", {"business": "[Business name]", "sender_first": "Jake"}),
    "welcome": D("Welcome + member card", "member", "auto", ["first_name", "code", "expires"], "Welcome to {brand} — here's your member card", "You're in!",
                 "Hi {first_name}, your membership is active. Welcome to the club!",
                 "Show your member card or a voucher code at any partner counter to save. Your card is always in your account on your phone.",
                 "Browse the deals", "/deals", sample={"first_name": "Tony", "code": "GP-AB12CD", "expires": "4 November 2027"}),
    "renewal": D("Renewal reminder", "member", "auto", ["first_name", "expires", "savings_line"], "Your {brand} membership ends in 2 weeks", "Time flies!",
                 "Hi {first_name}, your membership ends on **{expires}** — that's about two weeks away.\n\n{savings_line}",
                 "Renew for another year at A$49 to keep every deal in the club. Renewing early adds 12 months on top of your current end date.",
                 "Renew my membership", "/join", sample={"first_name": "Tony", "expires": "18 November 2026", "code": "GP-AB12CD",
                                                         "savings_line": "So far you've saved $63.00 across 5 deals — your membership has more than paid for itself."}),
    "gift": D("Gift membership", "member", "auto", ["first_name", "giver", "code"], "{giver} gifted you a year of {brand}", "A gift for you!",
              "Hi {first_name}, {giver} has gifted you a full year of {brand} — exclusive deals at local cafes, kids activities, restaurants and days out.",
              "Tap the button to create your free account and start your 12 months. The code works once.", "Claim my membership",
              "/redeem-gift?code={code}", sample={"first_name": "Sam", "giver": "Tony", "code": "GIFT-AB12-CD34", "message": "Happy birthday!"}),
    "partner_welcome": D("Partner kit (approved)", "business", "auto", ["first_name", "business"], "Welcome to {brand} — your partner kit", "Your partner kit",
                         "Hi {first_name}, welcome to {brand}! {business} is now set up as a partner.\n\nHere's everything you need to get started:",
                         "Your portal also shows how many members claimed and redeemed your deals each month.", "Open my partner portal", "biz:/profile",
                         ["**Complete your business profile** — Log in to your partner portal and add your address, phone, opening hours, logo and a short description. Members see these on your deal pages.",
                          "**Submit your first deal** — Add an offer from your portal. We review it and put it live for members.",
                          "**Print your window sticker** — In your portal, tap “Window sticker” then “Print or save as PDF”. Stick it on your door or counter so members know to ask.",
                          "**Check codes at the counter** — Members show a QR code on their phone. In your portal tap “Scan” (or type the code) under “Check a code”.",
                          "**Redeem the deal** — For a voucher, tap “Mark as redeemed”. For a member card, pick the deal they're using. Each deal is one use per member per year."],
                         "steps", {"first_name": "Sue", "business": "Gigi's Gelato"}),
    "deal_approved": D("Deal approved", "business", "auto", ["first_name", "deal_title"], "Your deal is live on {brand}", "You're live!",
                       "Hi {first_name}, great news — your deal **“{deal_title}”** has been approved and is now live for members.",
                       "Members can find it in the deals directory and on the map. Scan their QR code at the counter to redeem it, and keep an eye on your monthly stats in the portal.",
                       "View my partner portal", "biz:", sample={"first_name": "Sue", "deal_title": "Free scoop with any cone", "note": ""}),
    "deal_rejected": D("Deal not approved", "business", "auto", ["first_name", "deal_title"], "Update on your {brand} deal", "About your deal",
                       "Hi {first_name}, thanks for submitting **“{deal_title}”**. Unfortunately we couldn't approve it this time.",
                       "You're welcome to adjust the offer and submit it again from your partner portal.", "Submit a new deal", "biz:",
                       sample={"first_name": "Sue", "deal_title": "Free scoop with any cone", "note": "Please add an end date."}),
    "business_rejected": D("Partner application declined", "business", "auto", ["first_name", "business"], "Your {brand} partner application",
                           "About your application",
                           "Hi {first_name}, thanks for your interest in listing {business} with {brand}. Unfortunately we can't approve your partner account at the moment.",
                           "If you think this is a mistake, just reply to this email.", "Visit Go Perks", "/",
                           sample={"first_name": "Sue", "business": "Gigi's Gelato", "note": ""}),
    "partner_report": D("Monthly partner report", "business", "auto", ["first_name", "business", "month", "used"],
                        "Your {month} {brand} report: {used} deals used", "Your monthly report",
                        "Hi {first_name}, here's how {business} went with {brand} members in **{month}**.",
                        "Your partner portal shows these numbers live, plus every review members leave.", "Open my partner portal", "biz:",
                        sample={"first_name": "Sue", "business": "Gigi's Gelato", "month": "October 2026", "used": "3"}),
    "referral_reward": D("Referral free month", "member", "auto", ["first_name", "friend", "reward_line"], "You've earned a free month of {brand}",
                         "A free month, on us", "Hi {first_name}, {friend} just joined {brand} with your code, so they got a month off their first year and you've earned a free month.\n\n{reward_line}",
                         "Keep sharing your code. You can earn up to 12 free months a year.", "Share my code", "/dashboard",
                         sample={"first_name": "Tony", "friend": "Sam", "reward_line": "It's saved on your account and added automatically when you next renew, so you get an extra month on your next year."}),
    "new_applicant": D("New partner application (to you)", "owner", "auto", ["business", "contact", "email"], "New partner application: {business}",
                       "New partner application", "A new business has applied to become a Go Perks partner and is waiting for your approval.",
                       "These buttons work once and expire after 14 days.", "Review applicants", "adm:/businesses",
                       sample={"business": "Gigi's Gelato", "contact": "Sue", "email": "sue@example.com"}),
    "weekly_digest": D("Monday summary (to you)", "owner", "auto", ["from", "to", "members", "revenue"],
                       "Your Go Perks week: {members} new members, A${revenue}", "Your Monday summary",
                       "Here's how Go Perks went from {from} to {to}.", "", "Open the control room", "adm:",
                       sample={"from": "Mon 27 Oct", "to": "Mon 3 Nov", "members": "4", "revenue": "196"}),
}


# ---------- Template store ----------
def set_overrides(rows: list):
    _OVERRIDES.clear()
    _OVERRIDES.update({r["key"]: r for r in rows})


def template(key: str) -> dict:
    """The template as it will be sent: defaults, then the owner's edits. Custom copies point at a built-in 'base'."""
    o = _OVERRIDES.get(key) or {}
    base = DEFAULTS.get(o.get("base") or key) or DEFAULTS["invite"]
    t = {**base, **{k: o[k] for k in EDITABLE if o.get(k) is not None}}
    return {**t, "key": key, "base": o.get("base") or key, "custom": bool(o.get("base")), "edited": bool(o)}


# ---------- Rendering ----------
def _app_url(path: str) -> str:
    if path.startswith("biz:"):
        return f"{os.environ['BUSINESS_URL'].rstrip('/')}{path[4:]}"
    if path.startswith("adm:"):
        return f"{os.environ['ADMIN_URL'].rstrip('/')}{path[4:]}"
    return f"{os.environ['FRONTEND_URL'].rstrip('/')}{path}"


def _fill(text: str, v: dict) -> str:
    """Escape the owner's text, drop in escaped values for {placeholders}, and turn **this** into bold."""
    out = re.sub(r"\{(\w+)\}", lambda m: escape(str(v[m.group(1)])) if m.group(1) in v else m.group(0), escape(text, quote=False))
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", out)


def _p(text: str) -> str:
    return f'<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 12px">{text}</p>'


def _paras(text: str, v: dict) -> str:
    return "".join(_p(_fill(chunk.strip(), v).replace("\n", "<br>")) for chunk in re.split(r"\n\s*\n", text or "") if chunk.strip())


def _list(items: list, style: str, v: dict, dark: bool) -> str:
    items = [i for i in items if i.strip()]
    if not items:
        return ""
    if style == "steps":
        bubble = "#EE8A63"
        rows = "".join(
            f'<tr><td style="padding:10px 0;vertical-align:top;width:44px"><span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;'
            f'border-radius:16px;background:{bubble};color:#17434C;font-family:Georgia,serif;font-weight:bold">{n}</span></td>'
            f'<td style="padding:10px 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.5">{_fill(t, v)}</td></tr>' for n, t in enumerate(items, 1))
        return f'<table role="presentation" style="margin:8px 0 16px">{rows}</table>'
    tag = "ol" if style == "numbers" else "ul"
    lis = "".join(f'<li style="margin:0 0 6px">{_fill(t, v)}</li>' for t in items)
    return f'<{tag} style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 14px;padding-left:20px">{lis}</{tag}>'


def _note(text: str, label: str = "") -> str:
    if not text:
        return ""
    if label:
        return (f'<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;background:#FFFFFF;color:#17434C;border-left:3px solid #EE8A63;'
                f'padding:12px 14px;margin:16px 0"><b>{label}</b><br>{escape(text)}</p>')
    return (f'<p style="font-family:Georgia,serif;font-size:17px;font-style:italic;line-height:1.5;border-left:3px solid #EE8A63;padding-left:14px;margin:18px 0">'
            f'\u201c{escape(text)}\u201d</p>')


def _wrap(t: dict, heading: str, body: str, button: str, url: str, footer: str) -> str:
    layout = t["layout"] if t["layout"] in LAYOUTS else "classic"
    safety = f'<p style="font-family:Arial,sans-serif;font-size:12px;opacity:.75">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>'
    if layout == "letter":
        return ('<div style="max-width:560px;font-family:Arial,sans-serif;font-size:15px;color:#222222;line-height:1.6">'
                f'<p style="font-size:18px;margin:0 0 14px"><b>{heading}</b></p>{body}'
                f'<p style="margin:22px 0"><a href="{escape(url)}" style="color:#B9512E;font-weight:bold">{escape(button)} \u2192</a></p>'
                f'{safety}{footer}</div>')
    dark = layout == "dark"
    bg, fg = ("#17434C", "#EAF6F3") if dark else ("#EAF6F3", "#17434C")
    size = "36px" if dark else "28px"
    banner = ""
    if layout == "banner":
        src = t.get("banner_url") or f"{os.environ['FRONTEND_URL'].rstrip('/')}/email/banner.jpg"
        banner = f'<img src="{escape(src)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:18px;margin:0 0 22px">'
    return (f'<table role="presentation" width="100%" style="background:{bg}"><tr><td style="padding:32px;color:{fg}">{banner}'
            f'<p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:{"#EE8A63" if dark else "#9A4024"};margin:0 0 12px">{escape(EMAIL_FROM_NAME)}</p>'
            f'<h1 style="font-family:Georgia,serif;font-size:{size};line-height:1.15;margin:0 0 18px;color:{fg}">{heading}</h1>{body}'
            f'<p style="margin:28px 0"><a href="{escape(url)}" style="background:#B9512E;color:#FFFFFF;padding:14px 26px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">{escape(button)}</a></p>'
            f'{safety}{footer}</td></tr></table>')


def render(key: str, v: dict, block: str = "", footer: str = "", t: Optional[dict] = None):
    """(subject, html) for a template. v holds the placeholder values; block is live HTML placed after the bullets."""
    t = t or template(key)
    v = {"brand": EMAIL_FROM_NAME, **v}
    body = _paras(t["intro"], v) + _list(t["bullets"], t["bullet_style"], v, t["layout"] == "dark") + block + _paras(t["outro"], v)
    url = _app_url(_fill(t["path"], v).replace("&amp;", "&"))
    subject = re.sub(r"\{(\w+)\}", lambda m: str(v.get(m.group(1), m.group(0))), t["subject"])
    return subject, _wrap(t, _fill(t["heading"], v), body, _fill(t["button"], v), url, footer)


def _unsub(url: str, lead: str) -> str:
    return f'<p style="font-family:Arial,sans-serif;font-size:12px;opacity:.75">{lead} <a href="{escape(url)}" style="color:inherit">Unsubscribe</a> and we won\'t email you again.</p>'


# ---------- Live blocks ----------
def _card(name: str, code: str, expires: str) -> str:
    return ('<table role="presentation" style="background:#17434C;border:1px solid #2E6470;border-radius:18px;margin:20px 0;width:100%;max-width:420px"><tr>'
            '<td style="padding:22px;font-family:Arial,sans-serif;color:#EAF6F3">'
            '<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#EE8A63">Go Perks member card</p>'
            f'<p style="margin:10px 0 4px;font-family:Georgia,serif;font-size:22px">{escape(name)}</p>'
            f'<p style="margin:0;font-family:Courier New,monospace;font-size:20px;font-weight:bold;letter-spacing:3px">{escape(code)}</p>'
            f'<p style="margin:8px 0 0;font-size:12px;color:#C2DEDA">Valid until {escape(expires)}</p></td></tr></table>')


def _code_box(label: str, code: str) -> str:
    return ('<table role="presentation" style="background:#17434C;border:1px solid #2E6470;border-radius:18px;margin:20px 0;width:100%;max-width:420px"><tr><td style="padding:22px;font-family:Arial,sans-serif;color:#EAF6F3">'
            f'<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#EE8A63">{label}</p>'
            f'<p style="margin:10px 0 0;font-family:Courier New,monospace;font-size:22px;font-weight:bold;letter-spacing:3px">{escape(code)}</p></td></tr></table>')


def _btn(label: str, url: str, bg: str, fg: str) -> str:
    return (f'<a href="{escape(url)}" style="display:inline-block;background:{bg};color:{fg};padding:14px 26px;border-radius:999px;'
            f'text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;margin:0 8px 8px 0">{escape(label)}</a>')


def _stat(label: str, value) -> str:
    return ('<td style="padding:14px;background:#FFFFFF;border-radius:14px;width:33%;vertical-align:top">'
            f'<p style="margin:0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5E7F84">{label}</p>'
            f'<p style="margin:6px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:bold;color:#17434C">{escape(str(value))}</p></td>')


def _stats(*rows) -> str:
    return ('<table role="presentation" cellspacing="8" style="width:100%;max-width:520px;margin:8px -8px 12px">'
            + "".join("<tr>" + "".join(_stat(k, v) for k, v in r) + "</tr>" for r in rows) + "</table>")


def _first(name: str, fallback: str = "there") -> str:
    return name.split(" ")[0] if name else fallback


# ---------- Emails (called by the app) ----------
def welcome_email(name: str, code: str, expires: str):
    return render("welcome", {"first_name": _first(name), "code": code, "expires": expires}, _card(name, code, expires))


def renewal_email(name: str, code: str, expires: str, saved: float, used: int):
    line = (f"So far you've saved ${saved:,.2f} across {used} deal{'s' if used != 1 else ''} — "
            + ("your membership has more than paid for itself." if saved >= 49 else "and there's plenty more to unlock.")) if used else \
        "You still have plenty of deals to try before your year is up."
    return render("renewal", {"first_name": _first(name), "expires": expires, "code": code, "savings_line": line}, _card(name, code, expires))


def gift_email(recipient: str, giver: str, message: str, code: str):
    return render("gift", {"first_name": _first(recipient), "giver": _first(giver, "A friend"), "code": code},
                  _note(message) + _code_box("Your gift code", code))


def partner_welcome_email(name: str, business: str):
    return render("partner_welcome", {"first_name": _first(name), "business": business})


def deal_decision_email(name: str, title: str, approved: bool, note: str):
    return render("deal_approved" if approved else "deal_rejected", {"first_name": _first(name), "deal_title": title},
                  _note(note, "Note from the Go Perks team:"))


def business_rejected_email(name: str, business: str, note: str):
    return render("business_rejected", {"first_name": _first(name), "business": business}, _note(note, "Note from the Go Perks team:"))


def new_applicant_email(name: str, business: str, email: str, token: str):
    row = lambda k, v: (f'<tr><td style="padding:6px 16px 6px 0;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5E7F84">{k}</td>'
                        f'<td style="padding:6px 0;font-family:Arial,sans-serif;font-size:15px;color:#17434C"><b>{escape(v)}</b></td></tr>')
    block = ('<table role="presentation" style="background:#FFFFFF;border-radius:14px;padding:12px 16px;margin:16px 0">'
             + row("Business", business) + row("Contact", name) + row("Email", email) + '</table>'
             + _p("They can't submit deals until you approve them. Decide straight from here (you'll confirm on the next screen):")
             + '<p style="margin:18px 0 6px">' + _btn("Approve", _app_url(f"adm:/decide?token={token}&action=approve"), "#4E7A58", "#FFFFFF")
             + _btn("Reject", _app_url(f"adm:/decide?token={token}&action=reject"), "#FDF0EC", "#9A4024") + '</p>')
    return render("new_applicant", {"business": business, "contact": name, "email": email}, block)


def weekly_digest_email(s: dict):
    pending = "".join(f'<li style="margin:0 0 6px">{escape(b)}</li>' for b in s["pending_names"][:10])
    pending_html = (_p(f"<b>{s['pending_businesses']} partner{'s' if s['pending_businesses'] != 1 else ''} waiting for approval:</b>")
                    + f'<ul style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;margin:0 0 12px">{pending}</ul>') \
        if s["pending_businesses"] else _p("No partners are waiting for approval. You're all caught up.")
    block = _stats((("New members", s["members"]), ("Gifts sold", s["gifts"]), ("Revenue", f"A${s['revenue']:,.0f}")),
                   (("Sign-ups", s["signups"]), ("Deals redeemed", s["redeemed"]), ("Deals to review", s["pending_deals"]))) + pending_html
    return render("weekly_digest", {"from": s["from"], "to": s["to"], "members": s["members"], "revenue": f"{s['revenue']:,.0f}"}, block)


def partner_report_email(name: str, business: str, month: str, r: dict):
    cell = lambda v, align="left": f'<td style="padding:8px 10px;border-top:1px solid #D7E7E4;text-align:{align}">{v}</td>'
    deals_html = (
        '<table role="presentation" style="width:100%;max-width:520px;background:#FFFFFF;border-radius:14px;margin:8px 0 16px;'
        'font-family:Arial,sans-serif;font-size:14px;color:#17434C;border-collapse:collapse">'
        '<tr style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5E7F84">'
        '<td style="padding:10px">Deal</td><td style="padding:10px;text-align:right">Used</td><td style="padding:10px;text-align:right">Members saved</td></tr>'
        + "".join("<tr>" + cell(f"<b>{escape(d['title'])}</b>") + cell(d["redeemed"], "right") + cell(f"A${d['saved']:,.2f}", "right") + "</tr>" for d in r["deals"])
        + "</table>") if r["deals"] else _p(
        "No members used one of your deals last month. A window sticker by the door and a fresh, easy-to-use offer help members spot you.")
    block = _stats((("Deals used", r["redeemed"]), ("Members saved", f"A${r['saved']:,.0f}"), ("Different members", r["members"])),
                   (("New reviews", r["new_reviews"]), ("Average rating", f"{r['rating']:.1f} / 5" if r["rating"] else "—"), ("Used all time", r["all_redeemed"]))) + deals_html
    return render("partner_report", {"first_name": _first(name), "business": business, "month": month, "used": r["redeemed"]}, block)


def referral_reward_email(name: str, friend: str, reward_line: str):
    return render("referral_reward", {"first_name": _first(name), "friend": _first(friend, "A friend"), "reward_line": reward_line})


def invite_email(name: str, note: str, unsubscribe_url: str, template_key: str = "invite"):
    return render(template_key, {"first_name": _first(name)}, _note(note), _unsub(unsubscribe_url, "Don't want invites from us?"))


def partner_pitch_email(business: str, sender: str, note: str, unsubscribe_url: str, template_key: str = "pitch"):
    return render(template_key, {"business": business, "sender_first": _first(sender, "the team")}, _note(note),
                  _unsub(unsubscribe_url, "Rather not hear from us?"))


SAMPLE_BLOCKS = {
    "welcome": lambda s: _card("Tony Smith", s["code"], s["expires"]), "renewal": lambda s: _card("Tony Smith", s["code"], s["expires"]),
    "gift": lambda s: _note(s.get("message", "")) + _code_box("Your gift code", s["code"]),
    "deal_rejected": lambda s: _note(s.get("note", ""), "Note from the Go Perks team:"),
    "partner_report": lambda s: _stats((("Deals used", 3), ("Members saved", "A$43"), ("Different members", 2)),
                                       (("New reviews", 1), ("Average rating", "4.5 / 5"), ("Used all time", 9))),
    "new_applicant": lambda s: _p("[Applicant details and Approve / Reject buttons]"),
    "weekly_digest": lambda s: _stats((("New members", 4), ("Gifts sold", 1), ("Revenue", "A$196")), (("Sign-ups", 9), ("Deals redeemed", 12), ("Deals to review", 2))),
    "invite": lambda s: _note(s.get("note", "")), "pitch": lambda s: _note(s.get("note", "")),
}


def preview(key: str, t: dict, note: str = ""):
    """Render a (possibly unsaved) template with sample values, for the editor's live preview."""
    base = t.get("base") or key
    sample = {**DEFAULTS[base]["sample"], **({"note": note} if note else {})}
    block = SAMPLE_BLOCKS.get(base, lambda s: "")(sample)
    footer = _unsub("https://example.com/unsubscribe", "Don't want these emails?") if DEFAULTS[base]["kind"] == "pitch" else ""
    return render(key, sample, block, footer, t)
