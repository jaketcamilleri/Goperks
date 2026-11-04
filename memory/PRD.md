# Tiny's Vouchers — PRD

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

## Backlog
- P1: Forgot/reset password email; partner-side voucher verification screen; favourites
- P2: Suburb/location filter + map; savings tracker; email receipts/renewal reminders; image upload for deals

## Next tasks
Claim Stripe sandbox before going live; replace placeholder seed deals with real partners.
