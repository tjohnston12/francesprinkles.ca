# France & Sprinkles — Website

A bakery storefront: online ordering, a cart, Saturday-market pickup, and Stripe
checkout. Paid orders are saved to **Airtable**. Built to deploy on **Vercel**.

## What's in here

```
index.html                         The website (HTML + CSS + JS, one file)
success.html                       "Order confirmed" page shown after payment
package.json                       Declares the Stripe dependency for Vercel
api/create-checkout-session.js     Creates the Stripe Checkout Session
api/webhook.js                     Saves each PAID order to Airtable + emails confirmations
README.md                          This file
```

The site ships in **demo mode** (`DEMO_MODE: true` in `index.html`) so you can
click through ordering with no real charge. Steps below switch it live.

---

## 1) Put it on GitHub

Create a new repository and add all of these files, keeping the `api/` folder
exactly as named. Commit and push.

## 2) Deploy to Vercel

1. At [vercel.com](https://vercel.com), **Add New → Project** and import the repo.
2. Framework preset: **Other**. No build command needed — Vercel serves
   `index.html` statically and turns each file in `/api` into a serverless
   function automatically. It installs `stripe` from `package.json` for you.
3. Deploy. You'll get a URL like `https://france-and-sprinkles.vercel.app`
   (add your custom domain `francesprinkles.ca` later under Settings → Domains).

## 3) Set up Airtable (your order database)

1. Create a base, e.g. **"France & Sprinkles"**, with a table named **`Orders`**.
2. Add these fields (names must match exactly — `typecast` handles types):

   | Field name      | Type              |
   |-----------------|-------------------|
   | `Status`        | Single select (`Paid`, `Picked up`) |
   | `Pickup Name`   | Single line text  |
   | `Email`         | Email             |
   | `Phone`         | Phone number      |
   | `Items`         | Long text         |
   | `Total (CAD)`   | Number (or Currency) |
   | `Stripe Session`| Single line text  |
   | `Ordered At`    | Date (include time) |

3. Create a **Personal Access Token** at
   <https://airtable.com/create/tokens> with scopes
   `data.records:write` (and `read`), granted access to this base.
4. Note your **Base ID** — it's the `appXXXXXXXX` part of the base URL.

## 4) Set up Stripe

1. In the [Stripe Dashboard](https://dashboard.stripe.com), grab your
   **Publishable** (`pk_…`) and **Secret** (`sk_…`) keys.
2. **Developers → Webhooks → Add endpoint**:
   - URL: `https://francesprinkles.ca/api/webhook`
   - Event to send: **`checkout.session.completed`**
   - After creating it, copy the endpoint's **Signing secret** (`whsec_…`).

## 5) Set up confirmation emails (Resend)

After payment, the webhook emails a branded confirmation to the customer and a
heads-up to you. We use [Resend](https://resend.com) (free tier is plenty to start).

1. Create a Resend account and **verify your domain** `francesprinkles.ca`
   (add the DNS records they give you). This lets you send from
   `orders@francesprinkles.ca`. *To test before the domain verifies, you can
   send from `onboarding@resend.dev`.*
2. Create an **API key**.

> Prefer the simplest possible option? Stripe can also email a plain payment
> receipt on its own — turn on **Settings → Customer emails → Successful
> payments** in the Stripe Dashboard and skip Resend. The branded email above is
> the nicer experience, though.

## 6) Add environment variables in Vercel

Project → **Settings → Environment Variables**:

| Variable                | Value                                   |
|-------------------------|-----------------------------------------|
| `STRIPE_SECRET_KEY`     | `sk_…`                                   |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…`                                |
| `AIRTABLE_TOKEN`        | your Airtable Personal Access Token      |
| `AIRTABLE_BASE_ID`      | `appXXXXXXXX`                            |
| `AIRTABLE_TABLE`        | `Orders` (optional — this is the default)|
| `SITE_URL`              | `https://francesprinkles.ca`            |
| `RESEND_API_KEY`        | your Resend API key                      |
| `RESEND_FROM`           | `France & Sprinkles <orders@francesprinkles.ca>` (optional) |
| `BAKERY_EMAIL`          | `france@francesprinkles.ca` (where order alerts go) |

Redeploy after adding them.

## 7) Flip the site to live mode

In `index.html`, edit the `CONFIG` block near the bottom:

```js
DEMO_MODE: false,
STRIPE_PUBLISHABLE_KEY: "pk_live_...your key...",
CHECKOUT_ENDPOINT: "/api/create-checkout-session"
```

Commit & push — Vercel redeploys automatically.

> **Test first.** Use Stripe **test mode** keys (`pk_test_…` / `sk_test_…`) and a
> test webhook secret, then pay with card `4242 4242 4242 4242` (any future
> expiry, any CVC). Confirm a row appears in Airtable before switching to live
> keys.

---

## How a real order flows
1. Customer fills their cart and clicks checkout.
2. `create-checkout-session.js` builds a Stripe Checkout Session using
   **server-side prices** (the browser can't tamper with amounts) and sends the
   customer to Stripe's secure hosted page.
3. Customer pays. Stripe redirects them to `success.html`.
4. Stripe calls `api/webhook.js`, which verifies the signature, reads the items
   and the customer's pickup name / email / phone, **writes the order into
   Airtable** with status `Paid`, and **emails** a branded confirmation to the
   customer plus an order alert to `france@francesprinkles.ca`.

## Customising
- **Menu & prices:** edit `PRODUCTS` in `index.html` **and** the matching
  `CATALOG` in `api/create-checkout-session.js` (prices in cents). They must
  agree — the server list is the one that actually charges.
- **Market details / hours / cut-off:** in the Saturday Market section of
  `index.html` and on `success.html`.
- **Contact:** footer of `index.html` (currently `france@francesprinkles.ca`).

### Note
Menu items, prices (CAD), and the market address/hours are placeholders — swap
in your real details before launch.
