# Go Perks (formerly Local Perks / Tiny's Vouchers) — PRD

Rebrand 2 (2026-11-04): name "Go Perks"; logos in frontend/public/brand/: go-perks-logo-horizontal(-light).png (header/footer/member card), go-perks-logo-stacked(-light).png (window sticker), go-perks-mark.png — AI-edited from the user's Local Perks logo (lettering changed to Go Perks). New member codes GP-XXXXXX (LP-/TV- still accepted); share image static.prod-images…/ab4e2e87….jpeg (copy public/og-image.jpg).
Partner window sticker: /business/sticker (business/admin), print-only CSS, QR to /join.
Partner welcome kit: email sent on business registration (4-step guide: submit deal, print sticker, scan codes, redeem) with button to /business/sticker.
Deal decision emails: approve/reject (status change only) emails the submitting business; admin can add an optional reason on reject (included in email).
Super admin: SUPER_ADMIN_EMAIL=jaketcamilleri@gmail.com seeded/promoted at startup (role admin, super_admin true, no password).
Admin control room: stats (revenue, members, active, gifts, businesses, waiting businesses/deals, live deals, vouchers, redeemed) + sections Deals / Members / Businesses (/api/admin/users, /api/admin/businesses/{id}/status).
Business approval gate: new business accounts pending; require_partner blocks partner endpoints until approved; approval sends partner kit email, decline sends email with optional reason.

Rebrand (2026-11-04): name "Local Perks", user-supplied logo at frontend/public/brand/ (background removed), favicon/apple-touch icon, new member codes LP-XXXXXX (old TV- codes still accepted at partner checker), email sender name, wallet pass org, Stripe product renamed. Demo login emails unchanged.
Palette (2026-11-04): mint bg #EAF6F3 / #D3ECE7, deep teal ink #17434C / #0F3138, coral-deep #B9512E (buttons/accents), coral #EE8A63 (fills), lines #C2DEDA. Emails + wallet passes match.
Share/SEO: OG + Twitter tags with hosted share image (static.prod-images…/f452a3bd….jpeg, 1264x848, copy at public/og-image.jpg), Organization JSON-LD, noscript fallback, robots.txt, llms.txt. Canonical/og:url/sitemap omitted until production domain confirmed.

## Original problem statement
"creating a online year subscription program to give deals and discounts to everyday people, i have started a website if you want to have a look and get ideas https://voucher.thetinychef.com.au/, they sign up and get exclusive deals to cafes, kids activies, dining places and more"

User choices: online payment incl. Google & Apple Pay; email/password login; businesses submit deals for approval + admin dashboard; redemption via unique voucher code AND digital member card; AUD $49/year.

## Architecture
- FastAPI backend split (2026-11-04): `server.py` (app, routers, startup indexes + seed), `core.py` (env, db, helpers, live-card tokens, cron auth), `models.py` (documents + request bodies), `deps.py` (auth dependencies), `services.py` (memberships, gifts, emails, business decisions, activity log, scheduled jobs), `routes/{auth,deals,member,partner,admin,payments,cron,wallet}.py`. Seed in `seed_data.py`, Stripe catalog in `setup_stripe.py`. MongoDB (users, deals, vouchers, reviews, gifts, favorites, payment_transactions, activity_log, partner_reports, cron_runs, login_attempts)
- JWT httpOnly cookie auth (access 15m + refresh 7d), roles member/business/admin, brute-force lockout
- Stripe claimable sandbox (AU), yearly recurring price `membership_yearly_aud` (A$49), Stripe-managed tax mode; Checkout shows Apple/Google Pay automatically; status polling + webhook `/api/stripe/webhook` activate membership (365 days)
- React + Tailwind + framer-motion + lenis; Fraunces / Bricolage Grotesque / JetBrains Mono

## Personas
Members (local families), Business partners (cafes, play centres, restaurants), Admin (club owner)

## Implemented (2026-11-04)
- Landing: masked line hero, parallax arch photo, 3D tilt member card, rotating badge, slow marquee, 12-col category bento, sticky how-it-works, featured deals, ticket pricing, testimonials, business CTA
- Deals directory (category filter + search), deal detail with voucher code generation
- Join/checkout (Stripe), payment success/cancel pages, member dashboard (live member card, vouchers, mark as used)
- Business portal (register as business, submit deals, see status)
- Admin control room (stats, approve/reject, create/edit/delete deals)

## Implemented (2026-11-04, iteration 2)
- Partner code checker (business portal + admin): verify voucher codes (own deals only) or member card numbers, mark vouchers redeemed
- Password reset by email (Emergent managed Resend, 1-hour single-use link, 2-min resend throttle)
- Suburb filter + list/map toggle on deals (Leaflet/OpenStreetMap; deals auto-geocoded from suburb via Nominatim)
- Savings tracker on member dashboard (each deal has a typical member saving; progress towards $49)

## Implemented (2026-11-04, iteration 3)
- Member favourites (heart on every deal card + detail page, "Saved favourites" grid on account page)
- Welcome email with member card number sent once when membership is first activated
- Renewal reminder email (platform cron daily 9am Melbourne -> /api/cron/renewal-reminders) for memberships ending within 14 days, includes savings so far; one reminder per expiry date
- Apple Wallet (.pkpass storeCard, QR) + Google Wallet (generic pass save link) code built; buttons appear on account page only once secrets are set: APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_P12_BASE64, APPLE_PASS_P12_PASSWORD, GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_JSON. Signing verified only with a self-signed test cert.

## Implemented (2026-11-04, iteration 4)
- Partner stats on business portal: claimed/redeemed this month, all-time redeemed, member savings, per-deal table (/api/business/stats)
- Gift a membership: /gift form (recipient name, email, note) -> Stripe one-time A$49 (lookup membership_gift_aud) -> gift code emailed to recipient + shown to buyer; /redeem-gift claims it and activates 12 months

## Business rules
- Each deal can be redeemed once per member per membership year (term = membership_expires_at - 365 days). Enforced on claim, member self-redeem, partner voucher redeem and partner card redeem (/api/partner/redeem-card); deal page shows "used this year" state.
- Auth: email/password + Emergent Google sign-in (/api/auth/google exchanges session_id, matches by email, issues same JWT cookies). Refresh cookie 30 days.
- Gifts: optional delivery date (today..+12 months, Melbourne date). Future gifts stored with send_on/email_sent=false; cron gift-deliveries 7am Melbourne -> /api/cron/gift-deliveries.
- Member card + vouchers show real QR codes (qrcode.react); partner checker has camera Scan button (html5-qrcode) that fills and checks the code.
- 2026-11-04: New business applicant alert email to SUPER_ADMIN_EMAIL (jaketcamilleri@gmail.com) on business registration. Admin control room has a last-6-months chart (GET /api/admin/monthly: new paid memberships, gifts, revenue per Melbourne month).
- 2026-11-04: Applicant email has Approve/Reject buttons -> /admin/decide?token (signed 14-day biz_decision JWT, confirm step, one-time: only works while pending; GET/POST /api/admin/decision). Top 5 most-redeemed deals leaderboard per month (GET /api/admin/top-deals?month=YYYY-MM). Weekly owner digest email Mondays 8am Melbourne (cron weekly-digest -> /api/cron/weekly-digest): new members, gifts, revenue, sign-ups, redemptions, deals to review, pending partners.
- 2026-11-04: Business area split from members site. Frontend lib/site.js: hostname starting with 'business.' serves the partner area at root (API same-origin); otherwise partner area lives at /business. REACT_APP_BUSINESS_URL (frontend) and BUSINESS_URL (backend, used in partner emails + business password resets) point to the partner area; when it's a different origin, main-site /business/* redirects there. Main /login & /register are member-only with 'Own a business?' links. Partner navbar (BizNavbar). After approval businesses must complete a profile (address, suburb, phone, website, instagram, opening hours, about, logo via Emergent object storage) before any partner tools (require_partner checks profile_complete). Profile shown on deal pages (PartnerCard) and admin Businesses tab. PENDING: user to connect custom domain + business.<domain>, then set REACT_APP_BUSINESS_URL/BUSINESS_URL to https://business.<domain>.
- 2026-11-04: Partner photo gallery (max 6, /api/business/photos, remove via /api/business/photos/remove) and structured opening hours (hours dict per day, opening_hours text generated) with 'Open now' badges (Melbourne time) on deal cards and deal pages.
- 2026-11-04: Separate admin area (frontend/src/admin/*): side menu shell, Overview, Deals, Businesses, Members, Payments, Check a code; DataTable with search/sort/filters/bulk/CSV. Hostname admin.* serves it at root; otherwise /admin. REACT_APP_ADMIN_URL / ADMIN_URL (backend, used in admin emails + admin password resets). New endpoints: POST /api/admin/users (add customer/business, optional comp membership + invite link), PATCH /api/admin/users/{id} (name, expires_on, membership activate/deactivate), /resend-card, /password-link, POST /api/admin/deals/bulk, /api/admin/businesses/bulk, GET /api/admin/payments.
- 2026-11-04: Deals auto-assigned to submitting partner (business name locked = profile name; profile rename updates their deals). Admin deal create/edit requires partner_id dropdown of approved businesses. 9 old seed deals are 'Unassigned' until edited.
- 2026-11-04: Deals Near Me (/deals 'Near me' button, browser location, open-now first then distance, distance chip; lib/nearby.js). Admin team roles: role 'staff' added by owner on /admin/team (POST /api/admin/users role staff, DELETE /api/admin/team/{id}); staff can access Overview (no money stats), Deals, Businesses, Check a code; owner-only: Members, Payments, Team, revenue chart, deal deletion, adding users, password links.
- 2026-11-04: Live card anti-screenshot: member dashboard card QR rotates every 30s (GET /api/me/live-card -> signed token GPL.<code>.<step>.<hmac>), ticking clock strip + moving sheen. Partner checker: scanned live token -> 'Live card verified'; token older than ~60s -> 'looks like a screenshot' and redeem blocked (redeem-card also re-checks live_token); invalid signature -> rejected; typed/wallet plain code -> caution note. Staff now treated like admin in code checks.
- 2026-11-04: Refresh + new features: new hero with search, category tiles with live counts, New this week / Ending soon / Top rated rows (landing + deals page), redesigned deal cards (offer tag, flags New / N days left / Member favourite, rating chip), deals page client-side filtering (search, category chips with counts, Near me, Open now, suburb, sort), optional deal end date (ends_on; expired deals hidden, page shows ended), member reviews (only after redeeming; one per member per deal; avg/count stored on deal; /api/deals/{id}/reviews, /api/me/to-review, /api/reviews/highlights, /api/business/reviews, /api/admin/reviews + hide), dashboard 'How were your visits?', admin Reviews page, partner Member reviews, FAQ, phone bottom tab bar, lighter animations. Removed Bento/Featured/Marquee/Testimonials. Join page payment text removed (visual edit).

- 2026-11-04: Admin activity log: owner-only Admin > Activity page (filters, search, CSV) backed by GET /api/admin/activity; logs deal add/edit (changed fields)/approve/reject/back-to-review/delete (single + bulk), business approve/reject (control room, bulk, email quick-link), review hide/show, account create/edit, membership activate/end-date/deactivate, card resend, password link, staff removal, and automatic partner report runs.
- 2026-11-04: Monthly partner report email: cron `partner-reports` runs daily 9am Melbourne and only acts on the 1st (?force=true with the cron secret runs it any day); emails each approved partner with a live deal last month's deals used, member savings, different members, new reviews, average rating, all-time uses + per-deal table; once per partner per month (partner_reports unique), failed sends are removed so they can retry. Partner portal stats show a note about the monthly email.
- 2026-11-04: Tests: iteration_6 passed 114/1 skipped (incl. new tests/test_activity_reports.py). Test records cleaned up afterwards.
- 2026-11-04: Email editor (owner only, Admin > Emails): every email (member invite, partner pitch, welcome, renewal, gift, partner kit, deal approved/not approved, application declined, monthly partner report, new applicant alert, Monday summary) is an editable template: subject, heading, opening text, bullet points, closing text, button text, and layout (Classic card, Photo banner with optional custom https image, Plain letter, Bold dark). Fill-ins like {first_name} {business}, **bold**, live preview with sample data. Built-ins can be reset to the original; extra named versions of the invite and pitch can be made and chosen when sending (template dropdown in the Invites composer and the pitch dialog). Edits are stored in email_templates and cached in memory (refreshed on startup and on save). Default banner photo: frontend/public/email/banner.jpg (Unsplash). Tested iteration_10: all passed; backend 126 passed.
- 2026-11-04: Prospects upgrades: Victorian suburb + postcode picker (3,483 suburbs from backend/data/vic_suburbs.json, served at /api/places/vic-suburbs) on the business profile (postcode now required there) and the prospect form; prospects have street address + map pin (52 of 65 exact, 13 at suburb centre); List/Map view; 'Time to chase up' panel + Chase up filter for prospects Contacted over 7 days ago; partner pitch email to selected prospects (free to join, we advertise you, you choose and can update your offer), replies go to the owner's email, unsubscribe link, skips no-email/unsubscribed/already-pitched, marks New prospects as Contacted. Tested iteration_9: all passed.
- 2026-11-04: Prospects (owner only): Admin > Prospects page listing 65 researched businesses across Melbourne's west (Yarraville, Seddon, Footscray, West Footscray, Williamstown, Altona, Newport, Werribee, Point Cook, Tarneit, Sunshine, Maidstone, Derrimut, Manor Lakes): cafes/food, dining, kids & family, everyday services & shops. Each has the email the business lists publicly on its own website or its Visit Werribee listing, plus the page it came from. Status (new/contacted/interested/joined/not interested), notes, add/edit/remove, search, filters, CSV. Nothing is sent from this page. Data: backend/prospects_seed.json (loaded on startup when the list is empty), built by backend/scripts/find_prospect_emails.py + build_prospects_seed.py. Tested iteration_8: 120 passed.
- 2026-11-04: Member invites (owner only): Admin > Invites page; paste one or many 'Name, email' lines plus an optional note (300 chars); sends the ready-made join email (routes/invites.py, invite_email) in the background; skips invalid, duplicates, existing accounts, already invited and unsubscribed; failed sends show 'Not sent' with a Retry button; the table shows Sent/Joined/Unsubscribed; every email has an unsubscribe link to /unsubscribe (signed token, email_optouts collection); sends are logged in Activity. Tested iteration_7: 117 passed.
- 2026-11-04: One-off marketing email to customer Tony (Tiny@thetinychef.com.au) approved by owner (subject 'A year of local deals for A$49. Join Go Perks', 'Hi Tony', CTA -> /join). NOT SENT YET: tiny@thetinychef.com has no mail records (rejected); .com.au attempt blocked by email service rate limit (429). Owner asked to wait; retry when they next message.

## Backlog
- P0: Connect own web addresses for main site, business area and admin area (needs addresses from owner)
- P1: Tony's invite to tiny@thetinychef.com.au was SENT by the owner; a second one to tony@thetinychef.com.au shows 'Not sent'
- P1: Favourites; member-entered actual saving amount
- P2: Map marker clustering; email receipts/renewal reminders; image upload for deals

## Next tasks
Claim Stripe sandbox before going live; replace placeholder seed deals with real partners.
