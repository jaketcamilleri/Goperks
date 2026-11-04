# Connecting business.goperks.au and admin.goperks.au

Go Perks will run on 3 web addresses: goperks.au for members, business.goperks.au for business partners and admin.goperks.au for the owner. This plan covers the steps needed to connect the 2 new addresses and check that they work.

## Who it's for
- **Owner (Jake):** does the domain steps in the Emergent Deployment panel and at Webcentral.
- **Business partners:** log in and manage deals at business.goperks.au.
- **Admin/staff:** manage Go Perks at admin.goperks.au.

## Why the links aren't working yet
- The addresses business.goperks.au and admin.goperks.au don't exist on the internet yet. A check showed they can't be found at all, while goperks.au loads fine.
- Each address has to be **added in the Deployment panel first**. Only then does the panel show the exact DNS record to put in at Webcentral. A record added at Webcentral before that has nothing to point to, which is why changing the domain settings on their own hasn't worked.
- The DNS record values are created for this app by the Deployment panel. They're always copied from there and never guessed.

## Core steps and experience
1. **Add the addresses in Emergent:** Deployment panel → Domains → Add domain → `business.goperks.au`. Then repeat for `admin.goperks.au`.
2. **Copy the records shown:** for each address, the panel shows a record to copy. It's usually a **CNAME** with a name (Host) and a target (Value), and sometimes also a TXT record used to prove you own the domain.
3. **Add them at Webcentral:**
   - Log in at theconsole.webcentral.au.
   - For a domain with no hosting plan: Products & Services → DNS → goperks.au → DNS Editor. For a domain with a hosting plan: Websites → your site → Domains → ⋯ → Manage → DNS records.
   - Click Add New Record (or Add record), choose the type shown in the panel (CNAME or TXT), and paste in the values.
   - In the **Name/Host** box, enter only `business` or `admin`, not the full address. Some Webcentral screens add ".goperks.au" for you.
   - Leave the time setting (TTL) as it is.
4. **Remove clashing records:** delete any existing A or CNAME records at Webcentral named `business` or `admin`, such as records from earlier attempts, so they don't block the new ones.
5. **Don't touch the existing records:** the records that make goperks.au and www.goperks.au work stay as they are. So do the Resend email records (resend._domainkey, send, rsend and the mail record). Optionally, add the `_dmarc` TXT record Resend suggests (`v=DMARC1; p=none;`) to help emails stay out of spam folders.
6. **Wait for verification:** the Deployment panel shows each address as verified with a secure padlock. This usually takes minutes, but can take up to a few hours.
7. **Update the 3 settings and re-publish:** Re-publish → Secrets tab → View & edit, then set:
   - `FRONTEND_URL` = `https://goperks.au`
   - `BUSINESS_URL` = `https://business.goperks.au`
   - `ADMIN_URL` = `https://admin.goperks.au`
   
   Check that `RESEND_API_KEY` is there, then click Save and Re-publish. Re-publishing also puts the latest app changes live: the separate business and admin addresses, pitches and invites sent from your own email, the saved free months note, and emails from hello@goperks.au.

## User flow after it's connected
- A member visits goperks.au. Clicking "For businesses" takes them to business.goperks.au, and admin staff use admin.goperks.au.
- Each address has its own login, which stays signed in. Links in emails (partner reports, approvals, gift codes) open on the right address.
- The old links goperks.au/business and goperks.au/admin keep working.

## UI/UX feel
- The app itself doesn't change. The 3 addresses share the same look and the same data.

## Implementation phases
- **Phase 1 (now):** the owner connects the 2 addresses using the steps above. Once both show as verified and the app is re-published, a live check is run on all 3 addresses: pages load with a secure padlock, logins work, links between the sites are correct and emails link to the right address. Anything found is fixed.
- **Phase 2:** the old goperks.au/business and goperks.au/admin links redirect to the new addresses, so there's just one address for each area.
- **Phase 3:** the DMARC setting is tightened from "monitor only" to "quarantine" once a few weeks of email reports look clean, for stronger protection against fake emails sent in the Go Perks name.

## Assumptions
- Webcentral manages the goperks.au DNS, as the owner said, and goperks.au itself is already connected and working (a check confirmed this).
- The exact record type and values come from the Deployment panel after pressing Add domain. A CNAME for each of `business` and `admin` is expected, but whatever the panel shows is used.
- No code changes are needed to connect the addresses. The app already detects them once they're live.
- The live check in phase 1 is run only after the owner says both addresses show as verified.
