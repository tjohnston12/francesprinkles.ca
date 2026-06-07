// =====================================================================
//  /api/create-checkout-session.js   —  France & Sprinkles
//  Turns a cart into a Stripe Checkout Session.
//  This is the ONLY place your Stripe *secret* key is used, so it can
//  never be seen by customers. The actual order is written to Airtable
//  by the webhook (api/webhook.js) once payment succeeds.
//
//  Vercel: this file lives at /api/create-checkout-session.js and is
//  reachable at  https://your-site/api/create-checkout-session
// =====================================================================

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SITE_URL = process.env.SITE_URL || "https://francesprinkles.ca";

// Prices live here on the SERVER, never trusted from the browser.
// Keep in sync with PRODUCTS in index.html. Amounts are in CENTS (CAD).
const CATALOG = {
  cupcake: { name: "Funfetti Cupcake",     amount: 400 },
  bread:   { name: "Sourdough Loaf",       amount: 800 },
  cookies: { name: "Sprinkle Cookies (6)", amount: 900 },
  macaron: { name: "Macaron Box (6)",      amount: 1500 }
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { items = [] } = req.body || {};

    const line_items = items
      .filter((i) => CATALOG[i.id] && i.qty > 0)
      .map((i) => ({
        price_data: {
          currency: "cad",
          product_data: { name: CATALOG[i.id].name },
          unit_amount: CATALOG[i.id].amount
        },
        quantity: Math.min(parseInt(i.qty, 10) || 1, 50)
      }));

    if (line_items.length === 0) {
      res.status(400).json({ error: "Cart is empty or invalid" });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      phone_number_collection: { enabled: true },
      custom_fields: [
        {
          key: "pickup_name",
          label: { type: "custom", custom: "Name for pickup" },
          type: "text"
        }
      ],
      custom_text: {
        submit: {
          message:
            "Orders are bagged for pickup Saturday 8am–1pm at Boyce Farmers Market, Stall #14."
        }
      },
      metadata: { fulfilment: "saturday-market-pickup" },
      success_url: SITE_URL + "/success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: SITE_URL + "/?canceled=1"
    });

    res.status(200).json({ id: session.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create checkout session" });
  }
};
