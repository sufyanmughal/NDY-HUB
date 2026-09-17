# Step 2 of 3 — Create the Azure AD App Registration

**Goal of this step**: create the credentials that let NDYMAIL (already built and deployed) talk to your Microsoft 365 mailboxes. At the end of this step you'll have two values — a **Client ID** and a **Client Secret** — to send back to me.

**Requires**: Step 1 completed (a Microsoft 365 tenant must already exist).

**Time needed**: ~10 minutes.

**Important**: this step can be done in parallel with Step 3 (DNS) — it doesn't depend on `ndyhub.com` being verified yet. I can wire these credentials in and start testing the connection immediately once you send them, even before the DNS work is finished.

---

## 2.1 Open the App Registrations page

1. Go to **https://portal.azure.com** and sign in with the same Global Administrator account from Step 1.
2. In the top search bar, type **"App registrations"** and click it (it's part of what Microsoft now calls **Microsoft Entra ID**, formerly "Azure Active Directory" — same thing, just renamed).
3. Click **+ New registration**.

## 2.2 Fill in the registration form

| Field | What to enter |
|---|---|
| **Name** | `NDYHUB NDYMAIL Integration` (or any name you'll recognize later — this is just a label for you) |
| **Supported account types** | Select **"Accounts in this organizational directory only (NDJOYIT only — Single tenant)"** — the first option. NDYMAIL only ever needs to talk to your own organization's mailboxes, not anyone else's. |
| **Redirect URI** | Set the dropdown to **"Web"**, then paste this exact value into the box: |

```
https://ndyhub.com/api/ndy-mail/accounts/callback
```

**This must be typed/pasted exactly as shown above** — including `https://`, no trailing slash, exact spelling. This is the web address our deployed code is already listening on to receive Microsoft's response after someone connects a mailbox. If it doesn't match exactly, the connection will fail with an error from Microsoft.

Click **Register**.

## 2.3 Copy the Client ID

After registering, you'll land on the app's **Overview** page.

- Find **"Application (client) ID"** near the top — it looks like a long string of letters and numbers, e.g. `a1b2c3d4-e5f6-...`
- **Copy this value** — this is your **Client ID**. Save it somewhere (a note, a password manager) — you'll send it to me at the end.

## 2.4 Create the Client Secret

1. In the left-hand menu of the same app, click **Certificates & secrets**.
2. Click the **Client secrets** tab, then **+ New client secret**.
3. Description: anything, e.g. `NDYMAIL production key`.
4. Expires: choose **24 months** (or whatever your organization's policy prefers — just note the expiry date somewhere so it can be renewed before it lapses).
5. Click **Add**.
6. **Immediately copy the "Value" column** — not the "Secret ID" column, the **Value** one. This is your **Client Secret**.

⚠️ **This is the only time Microsoft will ever show you this value.** If you navigate away without copying it, you'll have to delete this secret and create a new one. Copy it now, before doing anything else.

## 2.5 Set the API permissions

1. In the left-hand menu, click **API permissions**.
2. You'll likely see one default permission already listed (`User.Read` under Microsoft Graph) — that's fine, keep it.
3. Click **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**.
4. Search for and check these three, one at a time (search box, tick the box, it stays selected as you search for the next one):
   - `Mail.Read`
   - `Mail.Send`
   - `offline_access`
5. Click **Add permissions** at the bottom.

Your permissions list should now show exactly these four:
- `User.Read`
- `Mail.Read`
- `Mail.Send`
- `offline_access`

**Do not add anything beyond these four** — the deployed code only ever requests these exact scopes, so anything extra granted here is unused and just widens what this app registration is capable of unnecessarily.

## 2.6 (Optional but recommended) Grant admin consent

Still on the **API permissions** page, click **Grant admin consent for NDJOYIT** and confirm. This pre-approves these four permissions for your whole organization, so individual users connecting their mailbox later won't see an extra consent prompt asking them to approve it themselves.

---

## What to send me after this step

Two values, together:

1. **Client ID** (from §2.3)
2. **Client Secret** — the *Value*, not the Secret ID (from §2.4)

Send these to me directly (not in a place anyone else can see them — they're credentials, treat them like a password). The moment I have both, I'll set them in production and we can start testing the connection to a real mailbox, even before Step 3's DNS work is finished.

## Common issues

- **"I can't find my Client Secret value anymore"** — this is normal if you navigated away before copying it. Go back to **Certificates & secrets**, delete the old one, and create a new one following §2.4 again — just copy the Value this time before clicking away.
- **Redirect URI error when testing later** — double-check the value in §2.2 was pasted exactly, with no extra spaces or a trailing slash. Even a small difference will cause Microsoft to reject the connection.
