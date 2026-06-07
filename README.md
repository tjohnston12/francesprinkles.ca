# France & Sprinkles — Website

A bakery storefront: online ordering with a cart, Saturday-market pickup,
Stripe checkout, confirmation emails, and a photo gallery. Orders and gallery
photos live in **Airtable**. Built to deploy on **Vercel**.

## What's in here

```
index.html                         The website (HTML + CSS + JS, one file)
success.html                       "Order confirmed" page shown after payment
package.json                       Declares the Stripe dependency for Vercel
.env.example                       Template for your environment variables
.gitignore                         Keeps secrets / node_modules out of Git
README.md                          This file
brand/                             High-res transparent logo + badge PNGs
api/
  create-checkout-session.js       Builds the Stripe Checkout Session
  webhook.js                       Saves paid orders to Airtable + emails them
  gallery.js                       Serves gallery photos from Airtable
```

The site runs in **demo mode** (`DEMO_MODE: true` in `index.html`) so you can
click through ordering with no real charge. The steps below switch it live.

---

## 1) Put it on GitHub
Create a repo and add all of these files, keeping the `api/` folder exactly as
named. The included `.gitignore` keeps your real secrets out of the repo.

## 2) Deploy to Vercel
1. At [vercel.com](https://vercel.com), **Add New → Project** and import the repo.
2. Framework preset: **Other**. No build command — Vercel serves the static
   pages and turns each file in `/api` into a serverless function, installing
   `stripe` from `package.json` automatically.
3. Deploy, then add your domain (`francesprinkles.ca`) under Settings → Domains.

## 3) Airtable (orders + gallery share ONE base)
Create one base, then two tables:

**Orders** table:

| Field | Type |
|---|---|
| `Status` | Single select (`Paid`, `Picked up`) |
| `Pickup Name` | Single line text |
| `Email` | Email |
| `Phone` | Phone number |
| `Items` | Long text |
| `Total (CAD)` | Number / Currency |
| `Stripe Session` | Single line text |
| `Ordered At` | Date (with time) |

**Gallery** table:

| Field | Type |
|---|---|
| `Photo` | Attachment |
| `Category` | Single select (`Cupcakes`, `Cookies`, `Breads`) |
| `Name` | Single line text |

Then create a **Personal Access Token** at <https://airtable.com/create/tokens>
with `data.records:read` + `data.records:write`, scoped to this base, and note
your **Base ID** (`appXXXX…` in the base URL).

> Add a row to the Gallery table (photo + category + name) and it appears on the
> site automatically — no code edits. Note: Airtable attachment URLs are
> temporary, so the site fetches fresh ones each load; don't hard-save them.

## 4) Stripe
1. In the [Stripe Dashboard](https://dashboard.stripe.com), copy your
   **Publishable** (`pk_…`) and **Secret** (`sk_…`) keys.
2. **Developers → Webhooks → Add endpoint**:
   - URL: `https://francesprinkles.ca/api/webhook`
   - Event: **`checkout.session.completed`**
   - Copy the endpoint's **Signing secret** (`whsec_…`).

## 5) Resend (confirmation emails)
Create a [Resend](https://resend.com) account, **verify your domain**
`francesprinkles.ca` (add the DNS records) so you can send from
`orders@francesprinkles.ca`, and create an **API key**.
*(To test before the domain verifies, send from `onboarding@resend.dev`.)*

## 6) Environment variables
Copy `.env.example` to `.env.local` for local dev, and add the same values in
Vercel → **Settings → Environment Variables** (then redeploy).

**Required:**

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `AIRTABLE_TOKEN` | your Personal Access Token |
| `AIRTABLE_BASE_ID` | `appXXXX…` |
| `SITE_URL` | `https://francesprinkles.ca` |
| `RESEND_API_KEY` | `re_…` |

**Optional (defaults shown):**

| Variable | Default |
|---|---|
| `BAKERY_EMAIL` | `france@francesprinkles.ca` |
| `RESEND_FROM` | `France & Sprinkles <orders@francesprinkles.ca>` |
| `AIRTABLE_TABLE` | `Orders` |
| `AIRTABLE_GALLERY_TABLE` | `Gallery` |
| `GALLERY_PHOTO_FIELD` | `Photo` |
| `GALLERY_CATEGORY_FIELD` | `Category` |
| `GALLERY_NAME_FIELD` | `Name` |

`AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` are shared by orders **and** gallery —
add them once.

## 7) Go live
In `index.html`, edit the `CONFIG` block near the bottom:
```js
DEMO_MODE: false,
STRIPE_PUBLISHABLE_KEY: "pk_live_...your key...",
CHECKOUT_ENDPOINT: "/api/create-checkout-session"
```
Commit & push — Vercel redeploys automatically.

> **Test first** with Stripe test keys (`pk_test_…`/`sk_test_…`) and card
> `4242 4242 4242 4242` (any future expiry, any CVC). Confirm an order row
> appears in Airtable and a confirmation email arrives before going live.

---

## How a real order flows
1. Customer fills their cart and checks out.
2. `create-checkout-session.js` builds a Stripe session using **server-side
   prices** and sends them to Stripe's secure hosted page.
3. They pay; Stripe redirects to `success.html`.
4. Stripe calls `api/webhook.js`, which verifies the signature, **saves the
   order to Airtable** (status `Paid`) and **emails** the customer + you.

## Customising
- **Menu & prices:** edit `PRODUCTS` in `index.html` **and** the matching
  `CATALOG` in `api/create-checkout-session.js` (cents). They must agree — the
  server list is what actually charges.
- **Gallery:** add rows in the Airtable Gallery table. Until photos exist, the
  site shows friendly illustrated placeholders.
- **Market details / hours / contact:** in the Saturday Market section and
  footer of `index.html` (contact is `france@francesprinkles.ca`).

### Note
Menu items, prices (CAD), and the market address/hours are placeholders — swap
in your real details before launch.
