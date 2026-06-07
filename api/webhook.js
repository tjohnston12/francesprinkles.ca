// =====================================================================
//  /api/webhook.js   —  France & Sprinkles
//  Stripe calls this URL after a successful payment. We:
//    1. verify the signature,
//    2. save the PAID order into Airtable,
//    3. email a branded confirmation to the customer + a heads-up to you.
//
//  Vercel URL:  https://your-site/api/webhook
//  Stripe needs the RAW body to verify the signature, so the automatic
//  body parser is turned off below.
// =====================================================================

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports.config = { api: { bodyParser: false } };

// where order emails come from / go to
const FROM_EMAIL   = process.env.RESEND_FROM  || "France & Sprinkles <orders@francesprinkles.com>";
const BAKERY_EMAIL = process.env.BAKERY_EMAIL || "france@francesprinkles.com";

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ---- Airtable (built-in fetch, no extra dependency) ----
async function addOrderToAirtable(fields) {
  const base = process.env.AIRTABLE_BASE_ID;
  const table = encodeURIComponent(process.env.AIRTABLE_TABLE || "Orders");
  const res = await fetch(`https://api.airtable.com/v0/${base}/${table}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ records: [{ fields }], typecast: true })
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---- Resend email (built-in fetch, no extra dependency) ----
async function sendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set — skipping email to", to);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, reply_to: replyTo })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

const money = (cents) => "$" + ((cents || 0) / 100).toFixed(2);

function itemRows(lineItems) {
  return lineItems
    .map(
      (li) => `<tr>
        <td style="padding:8px 0;color:#34425e">${li.quantity}× ${li.description}</td>
        <td style="padding:8px 0;text-align:right;color:#213A6B;font-weight:700">${money(li.amount_total)}</td>
      </tr>`
    )
    .join("");
}

function customerEmail({ name, lineItems, total }) {
  return `
  <div style="background:#FBF6EA;padding:28px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#FFFDF7;border:1px solid #EFE2C4;border-radius:20px;padding:34px">
      <div style="text-align:center;font-size:40px">🌞🧁</div>
      <h1 style="text-align:center;color:#213A6B;font-size:24px;margin:8px 0 4px">Merci${name ? ", " + name : ""}! Your order's confirmed</h1>
      <p style="text-align:center;color:#34425e;margin:0 0 22px">We're already dusting off the sprinkles.</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px dashed #EFE2C4;border-bottom:1px dashed #EFE2C4">
        ${itemRows(lineItems)}
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:10px">
        <tr><td style="color:#213A6B;font-weight:800;font-size:18px">Total</td>
            <td style="text-align:right;color:#213A6B;font-weight:800;font-size:18px">${money(total)}</td></tr>
      </table>
      <div style="background:#FBF6EA;border:1px dashed #F9A826;border-radius:14px;padding:16px;margin-top:22px;color:#213A6B">
        <b>📍 Pickup — Saturday, 8:00am–1:00pm</b><br>
        Boyce Farmers Market · Stall #14<br>
        665 George St, Fredericton, NB<br>
        <span style="color:#34425e">Just give your name at the stall — look for the sunny banner!</span>
      </div>
      <p style="text-align:center;color:#9aa3b5;font-size:12px;margin-top:22px">
        Questions? Reply to this email or write to france@francesprinkles.com
      </p>
    </div>
  </div>`;
}

function bakeryEmail({ name, email, phone, lineItems, total }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#34425e">
    <h2 style="color:#213A6B">New order — ${money(total)}</h2>
    <p><b>Pickup name:</b> ${name || "—"}<br>
       <b>Email:</b> ${email || "—"}<br>
       <b>Phone:</b> ${phone || "—"}</p>
    <table style="border-collapse:collapse">${itemRows(lineItems)}</table>
    <p style="margin-top:8px"><b>Total: ${money(total)}</b></p>
  </div>`;
}

module.exports = async (req, res) => {
  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      raw,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Signature check failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // gather order details
    let lineItems = [];
    try {
      const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      lineItems = li.data;
    } catch (err) {
      console.error("Could not list line items:", err);
    }
    const itemsSummary = lineItems.map((li) => `${li.quantity}× ${li.description}`).join(", ");
    const pickupName =
      (session.custom_fields || []).find((f) => f.key === "pickup_name")?.text?.value || "";
    const email = session.customer_details?.email || "";
    const phone = session.customer_details?.phone || "";
    const total = session.amount_total || 0;

    // 1) Save to Airtable. If this fails, return 500 so Stripe retries.
    try {
      await addOrderToAirtable({
        "Status": "Paid",
        "Pickup Name": pickupName,
        "Email": email,
        "Phone": phone,
        "Items": itemsSummary,
        "Total (CAD)": total / 100,
        "Stripe Session": session.id,
        "Ordered At": new Date().toISOString()
      });
      console.log("Order saved to Airtable:", session.id);
    } catch (err) {
      console.error("Airtable save failed:", err);
      res.status(500).send("Failed to record order");
      return;
    }

    // 2) Send emails. NON-fatal — order is already saved, so never 500 here
    //    (a 500 would make Stripe retry and create a duplicate Airtable row).
    try {
      if (email) {
        await sendEmail({
          to: email,
          subject: "Your France & Sprinkles order is confirmed 🧁",
          html: customerEmail({ name: pickupName, lineItems, total }),
          replyTo: BAKERY_EMAIL
        });
      }
      await sendEmail({
        to: BAKERY_EMAIL,
        subject: `New order: ${pickupName || email || "customer"} — ${money(total)}`,
        html: bakeryEmail({ name: pickupName, email, phone, lineItems, total }),
        replyTo: email || undefined
      });
    } catch (err) {
      console.error("Email send failed (order still saved):", err);
    }
  }

  res.status(200).json({ received: true });
};
