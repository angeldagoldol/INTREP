import express from "express";
import { config } from "../config.js";
import { buildLineItems, listProducts, listPayable, listEnquiry, getProduct } from "../catalog.js";
import { createCheckoutSession as paymongoCheckout, MINIMUM_AMOUNT } from "../paymongo.js";

export function checkoutRouter(stripe) {
  const router = express.Router();

  // The storefront reads prices AND available providers from here, so the
  // page can never offer a wallet the server is not configured for.
  router.get("/products", (_req, res) => {
    res.json({
      currency: config.currency,
      products: listProducts(),      // everything, each carrying its mode
      payable: listPayable().map((p) => p.id),
      enquiry: listEnquiry().map((p) => p.id),
      providers: {
        stripe: config.stripe.enabled,
        paymongo: config.paymongo.enabled,
        paymongoMethods: config.paymongo.enabled ? config.paymongo.methods : [],
        minimumAmount: config.paymongo.enabled ? MINIMUM_AMOUNT : 0,
      },
    });
  });

  router.post("/checkout", async (req, res) => {
    // Philippines is the main market, so PayMongo is the default when both
    // are configured — it is the one that can take GCash and Maya.
    const requested = String(req.body?.provider || "").toLowerCase();
    const provider =
      requested === "stripe" || requested === "paymongo"
        ? requested
        : config.paymongo.enabled
        ? "paymongo"
        : "stripe";

    if (provider === "paymongo" && !config.paymongo.enabled) {
      return res.status(400).json({ error: "PayMongo is not configured on this server" });
    }
    if (provider === "stripe" && !config.stripe.enabled) {
      return res.status(400).json({ error: "Stripe is not configured on this server" });
    }

    // Price every row from the catalog. The browser's numbers are ignored.
    let lineItems;
    try {
      lineItems = buildLineItems(req.body?.cart, config.currency);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      if (provider === "paymongo") {
        const items = req.body.cart.map((row) => {
          const p = getProduct(row.id);
          return { name: p.name, amount: p.amount, quantity: Number(row.quantity), sku: p.sku };
        });
        const session = await paymongoCheckout({
          items,
          referenceNumber: `${config.brand.name}-${Date.now().toString(36)}`,
        });
        return res.status(200).json({ url: session.url, id: session.id, provider });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: `${config.baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.baseUrl}/cancel.html`,
        shipping_address_collection: { allowed_countries: config.shipTo },
        phone_number_collection: { enabled: true },
        customer_creation: "always",
      });
      return res.status(200).json({ url: session.url, id: session.id, provider });
    } catch (err) {
      console.error(`[checkout:${provider}]`, err?.message || err);

      // PayMongo's minimum is a customer-actionable message, so pass it
      // through. Everything else stays server-side.
      const isMinimum = /minimum payment/i.test(err?.message || "");
      return res.status(isMinimum ? 400 : 502).json({
        error: isMinimum ? err.message : "Could not start checkout. Please try again.",
      });
    }
  });

  return router;
}
