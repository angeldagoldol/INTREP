import express from "express";
import { config } from "../config.js";
import { buildLineItems, listProducts } from "../catalog.js";

export function checkoutRouter(stripe) {
  const router = express.Router();

  // The storefront reads prices from here so the page and Stripe can never
  // disagree — there is exactly one source of truth.
  router.get("/products", (_req, res) => {
    res.json({ currency: config.currency, products: listProducts() });
  });

  router.post("/checkout", async (req, res) => {
    let lineItems;
    try {
      lineItems = buildLineItems(req.body?.cart, config.currency);
    } catch (err) {
      // Client error — safe to echo, it contains no secrets.
      return res.status(400).json({ error: err.message });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: `${config.baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.baseUrl}/cancel.html`,
        // Collect what you need to actually ship the goods.
        shipping_address_collection: { allowed_countries: config.shipTo },
        phone_number_collection: { enabled: true },
        // Lets Stripe email the customer their receipt.
        customer_creation: "always",
      });

      // 303 keeps a form POST -> GET redirect correct; JSON clients use `url`.
      return res.status(200).json({ url: session.url, id: session.id });
    } catch (err) {
      console.error("[checkout] Stripe error:", err?.message || err);
      // Never leak Stripe internals to the browser.
      return res.status(502).json({ error: "Could not start checkout. Please try again." });
    }
  });

  return router;
}
