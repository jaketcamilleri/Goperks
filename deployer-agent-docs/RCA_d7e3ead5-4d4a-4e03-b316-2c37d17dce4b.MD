# RCA — "Emails are missing on the live site" (goperks.au /admin/emails)

**Deployment:** localperks-club  |  **Active run:** d7e3ead5-4d4a-4e03-b316-2c37d17dce4b (redeploy, success)
**Frontend:** cloudflare  |  **URL:** https://localperks-club.emergent.host  |  **Prod DB:** localperks-club-test_database

## Verdict
The production **backend and the latest code are healthy and correct**. `GET /api/admin/email-templates` exists, returns **200**, and serves all **18 built-in templates (from code) + custom docs (from DB)**. The reported "fewer templates" is a **data gap**: the production `email_templates` collection holds only **1 custom doc**, whereas preview has more custom versions/overrides that were never copied to prod (redeploys do NOT migrate data). This is NOT a deploy, code, secret, or malformed-data problem.

## What I checked (evidence)

### (1) Is the latest code deployed? — YES
- Endpoint exists and is served by `backend/routes/templates.py` (`APIRouter(prefix="/admin/email-templates")`).
- Deployed source `backend/email_templates.py` `DEFAULTS` contains **exactly 18** built-in templates (grep count = 18: invite, invite_followup, pitch, welcome, renewal, auto_renewal, gift, partner_welcome, deal_approved, deal_rejected, deal_removed, removal_declined, removal_request, business_rejected, partner_report, referral_reward, new_applicant, weekly_digest).
- List logic always emits built-ins + custom:
  `return [public(k) for k in list(et.DEFAULTS) + custom]` — so the list can never be shorter than 18 from the backend.
- Live logs: `GET /api/admin/email-templates HTTP/1.1" 200 OK`, `POST /api/admin/email-templates/preview 200 OK` (×3), and `401 Unauthorized` only on an unauthenticated probe (expected auth wall). **No 4xx/5xx** on the endpoint for an authenticated admin. The admin even previewed templates successfully (POST /preview 200) — proving the list rendered and was clickable.

### (2) Production `email_templates` collection — 1 well-formed doc, no malformed fields
- `count = 1`. The single doc: `{ key: "invite-18d9e8", base: "invite", name: "Member invite reminder", subject: "...", created_at/updated_at: 2026-11-04 }`.
- No malformed fields; `base` present and valid. `template()` merges it cleanly over `DEFAULTS["invite"]`. No doc that could KeyError the list endpoint.
- No built-in content-override docs present (nothing keyed to built-in names). So built-ins all render at their default wording.

### (3) Startup / import errors — NONE related to email
- `Application startup complete.` / `Started server process` seen twice; no ImportError/ModuleNotFound/Traceback.
- `email_service.py` reads `EMERGENT_EMAIL_KEY` and `EMAIL_FROM_NAME` via `os.environ[...]` (required at import). Since `email_templates` imports `email_service`, and both the app and the endpoint are up (200), these env vars ARE set in production — no KeyError at import.
- `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO` are read with `.get()` (optional) — cannot break import.
- `refresh_templates()` runs at startup (server.py:89) and loaded the single override fine.
- The only ERROR lines in logs are unrelated: `google wallet link failed: KeyError` (wallet.py), not email.

## Root cause
Production serves 18 built-ins + the 1 custom doc that exists in the prod DB. Preview shows "18 + custom" where the custom set is larger because those custom template versions / built-in overrides were created in the **preview** database and **were never migrated to production** — data migration happens only on the INITIAL deploy, not on redeploys. Hence prod shows FEWER templates than preview.

A truly **empty/none** list in the browser (if observed) is not possible from the backend (it always returns ≥18 and returned 200) — that would be a stale cached frontend bundle or a client-side render issue, to confirm via hard-refresh/incognito + DevTools.

## Suggested fixes (do NOT require a redeploy of code)
1. **User — copy `email_templates` from preview → production** via DB Manager (or recreate the missing custom versions/overrides directly in prod /admin/emails). This restores the extra templates seen in preview. Redeploys will not do this automatically.
2. **User — if the page shows literally zero templates**, hard-refresh / open in incognito to clear a stale Cloudflare/browser bundle, and capture the `/api/admin/email-templates` response in DevTools; the backend returns 200 with 18+ items, so an empty UI is client-side.

No secret change and no code change are required — backend, env, and deployed code are all correct.
