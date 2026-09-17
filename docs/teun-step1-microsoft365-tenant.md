# Step 1 of 3 — Create the Microsoft 365 Tenant

**Goal of this step**: get NDJOYIT a real Microsoft 365 account (a "tenant") with at least one mailbox license. This is the foundation everything else in Steps 2 and 3 sits on top of.

**Time needed**: ~15 minutes, plus a payment method.

**Do this first** — Steps 2 and 3 both depend on this tenant existing.

---

## 1.1 Check if NDJOYIT already has a Microsoft 365 tenant

Before creating a new one, make sure one doesn't already exist (e.g. from a previous Office 365 subscription, a free trial someone signed up for, etc.).

- Go to **https://admin.microsoft.com**
- Try logging in with any email address that might already be associated with NDJOYIT
- If you get into an admin dashboard, you already have a tenant — **skip to §1.4** to just add a license instead of creating a new tenant.
- If login fails / no account exists, continue to §1.2.

## 1.2 Sign up for Microsoft 365 Business Basic

1. Go to **https://www.microsoft.com/microsoft-365/business/compare-all-microsoft-365-business-products**
2. Find **"Microsoft 365 Business Basic"** — this is the plan you want. It's the cheapest plan that includes a real Exchange Online mailbox (not just Office apps).
   - Don't pick a plan that only includes "Office apps" without email — you specifically need one with **Exchange Online** included. Business Basic has this.
3. Click **Buy now** (or "Try free" if a trial is offered — either works to start).
4. You'll be asked for:
   - **Business name**: NDJOYIT (or your registered company name)
   - **Number of users**: start with **1** — this covers the first mailbox (`NDY-CEO-000001@ndyhub.com`). You can add more later as more NDY IDs get their own mailboxes.
   - **A domain**: Microsoft will offer to set you up with a temporary `.onmicrosoft.com` domain first (e.g. `ndjoyit.onmicrosoft.com`) — accept this default. We add `ndyhub.com` as the *real* domain in Step 3, this temporary one is just to get the tenant created.
5. Create your **Global Administrator** account — this is the main login for managing everything (billing, users, security). Use an email address you personally control and will remember, not one that depends on this new tenant existing yet (e.g. your personal email or an existing company email).
6. Enter payment details and complete the purchase (or start the trial).

## 1.3 Confirm the tenant was created

- Go to **https://admin.microsoft.com** and log in with the Global Administrator account you just created.
- You should land on the Microsoft 365 admin center dashboard.
- If you see this, the tenant exists and Step 1 is done. ✅

## 1.4 If you already had a tenant (skipped from §1.1)

- In the admin center, go to **Billing → Purchase services**
- Search for **"Business Basic"**
- Purchase **1 license** (this is what lets you create a real mailbox for `NDY-CEO-000001@ndyhub.com` in a later step)

---

## What to send me after this step

Nothing yet — Steps 2 and 3 both happen *inside* this same admin center, so just confirm you've completed this step and move on to **Step 2 (Azure AD App Registration)**.

## Common issues

- **"This email is already associated with a Microsoft account"** — that email may already have a personal Microsoft account (Xbox, Outlook.com, etc.) unrelated to a business tenant. Use a different email for the Global Administrator, or sign in and check if it's actually a business tenant under **admin.microsoft.com**.
- **Can't decide between Business Basic and Business Standard** — Basic is enough for what we need (a mailbox NDYMAIL connects to via the API). Standard only adds desktop Outlook app access, which isn't required for NDYMAIL to work — you can always upgrade a specific user's license later if someone on your team wants desktop Outlook too.
