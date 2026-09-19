import express from "express";
import { config } from "../config.js";
import { constructEvent } from "../paymongo.js";
import { buildOrderEmail } from "../templates/orderEmail.js";
import { sendOrderNotification } from "../email.js";
import { recordOrder, alreadyProcessed, markProcessed } from "../orders.js";

// Events that mean "the customer actually paid". Anything else is noise.
const PAID_EVENTS = new Set(["checkout_session.payment.paid", "payment.paid"]);

/**
 * PayMongo nests resources as { data: { attributes: {...} } } at every level,
 * and the useful fields sit in slightly different places depending on whether
 * the event carries a checkout session or a bare payment. Dig defensively and
 * fall back rather than throwing — losing an order to a shape mismatch would
 * be worse than an email with a couple of blanks.
 */
function normaliseOrder(event) {
  const ev = event?.data?.attributes || {};
  const resource = ev.data || {};
  const attrs = resource.attributes || {};

  // A checkout session carries its payments; a payment event is already one.
  const payment =
    attrs.payments?.[0]?.attributes ||
    (ev.type === "payment.paid" ? attrs : null) ||
    {};

  const billing = payment.billing || attrs.billing || {};
  const lineItems = attrs.line_items || [];

  const amountTotal =
    payment.amount ??
    attrs.amount_total ??
    lineItems.reduce((s, li) => s + (li.amount || 0) * (li.quantity || 1), 0);

  const createdAt = ev.created_at || attrs.created_at || Math.floor(Date.now() / 1000);

  return {
    orderId: resource.id || ev.id || "unknown",
    provider: "paymongo",
    paymentIntent: attrs.payment_intent?.id || payment.payment_intent_id || null,
    amountTotal,
    currency: (payment.currency || attrs.currency || "PHP").toLowerCase(),
    customerName: billing.name || "",
    customerEmail: billing.email || "",
    customerPhone: billing.phone || "",
    // Which wallet they actually used — worth knowing for your PH mix.
    paymentMethod: payment.source?.type || payment.payment_method_used || "",
    shipping: billing.address ? { name: billing.name, address: billing.address } : null,
    items: lineItems.map((li) => ({
      description: li.name,
      quantity: li.quantity,
      unitAmount: li.amount ?? null,
      amountTotal: (li.amount || 0) * (li.quantity || 1),
    })),
    livemode: Boolean(ev.livemode),
    createdAt:
      new Date(Number(createdAt) * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC",
  };
}

export function paymongoWebhookRouter() {
  const router = express.Router();

  router.post(
    "/paymongo/webhook",
    // Raw body: the signature covers the exact bytes sent.
    express.raw({ type: "application/json" }),
    async (req, res) => {
      let event;
      try {
        event = constructEvent(
          req.body,
          req.headers["paymongo-signature"],
          config.paymongo.webhookSecret
        );
      } catch (err) {
        console.warn("[paymongo] signature verification failed:", err?.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Acknowledge immediately; PayMongo retries on a slow or failed response.
      res.status(200).json({ received: true });

      const type = event?.data?.attributes?.type;
      if (!PAID_EVENTS.has(type)) return;

      const eventId = event?.data?.id;
      if (eventId && alreadyProcessed(eventId)) {
        console.log(`[paymongo] duplicate ${eventId} ignored`);
        return;
      }
      if (eventId) markProcessed(eventId);

      try {
        const order = normaliseOrder(event);
        recordOrder(order);
        console.log(
          `[order] paymongo ${order.orderId} ${order.amountTotal} ${order.currency}` +
            (order.paymentMethod ? ` via ${order.paymentMethod}` : "")
        );

        const mail = buildOrderEmail(order);
        const result = await sendOrderNotification(mail);
        if (result.ok) console.log(`[email] notified ${config.email.notify} (${result.id})`);
        else console.error(`[email] FAILED for ${order.orderId}: ${result.reason}`);
      } catch (err) {
        console.error("[paymongo] fulfilment error:", err?.stack || err);
      }
    }
  );

  return router;
}
