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
- FastAPI (`/app/backend/server.py`, seed in `seed_data.py`, Stripe catalog in `setup_stripe.py`) + MongoDB (users, deals, vouchers, payment_transactions, login_attempts)
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

## Backlog
- P1: Favourites; member-entered actual saving amount
- P2: Map marker clustering; email receipts/renewal reminders; image upload for deals

## Next tasks
Claim Stripe sandbox before going live; replace placeholder seed deals with real partners.
