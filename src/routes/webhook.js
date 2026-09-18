import express from "express";
import { config } from "../config.js";
import { buildOrderEmail } from "../templates/orderEmail.js";
import { sendOrderNotification } from "../email.js";
import { recordOrder, alreadyProcessed, markProcessed } from "../orders.js";

/**
 * The webhook is the ONLY trustworthy signal that an order was paid.
 *
 * Never fulfil on the success_url redirect: a customer can open that URL
 * directly, close the tab before it loads, or have payment fail after the
 * redirect. Stripe calls this endpoint server-to-server regardless.
 */
export function webhookRouter(stripe) {
  const router = express.Router();

  router.post(
    "/stripe/webhook",
    // Signature verification needs the EXACT bytes Stripe sent, so this route
    // must parse raw — and must be mounted before any express.json().
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          config.stripe.webhookSecret
        );
      } catch (err) {
        // Unsigned or tampered. Anyone can POST here, so this check is what
        // stops a stranger forging "you got paid" emails.
        console.warn("[webhook] signature verification failed:", err?.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Acknowledge fast. Stripe times out at ~10s and will retry, and slow
      // fulfilment work must not hold the response open.
      res.status(200).json({ received: true });

      if (event.type !== "checkout.session.completed") return;

      if (alreadyProcessed(event.id)) {
        console.log(`[webhook] duplicate ${event.id} ignored`);
        return;
      }
      markProcessed(event.id);

      try {
        const session = event.data.object;

        // A completed session can still be unpaid (e.g. a delayed method).
        if (session.payment_status !== "paid") {
          console.log(`[webhook] ${session.id} not paid (${session.payment_status}), skipping`);
          return;
        }

        // Line items are not included in the event payload, so they need a
        // second API call. That call is NOT allowed to lose the order: it is
        // the only fallible step before we have the sale on disk, and the
        // event is already marked processed, so a throw here would mean the
        // order vanishes and the retry is ignored too. Degrade instead.
        let items = [];
        let itemsError = null;
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
          items = lineItems.data.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitAmount: li.price?.unit_amount ?? null,
            amountTotal: li.amount_total,
          }));
        } catch (err) {
          itemsError = err?.message || String(err);
          console.error(`[webhook] could not fetch line items for ${session.id}: ${itemsError}`);
        }

        const order = {
          orderId: session.id,
          paymentIntent: session.payment_intent,
          amountTotal: session.amount_total,
          currency: session.currency,
          customerName: session.customer_details?.name || "",
          customerEmail: session.customer_details?.email || "",
          customerPhone: session.customer_details?.phone || "",
          shipping: session.collected_information?.shipping_details
            || session.shipping_details
            || null,
          items,
          itemsError,
          livemode: event.livemode,
          createdAt: new Date((session.created || Date.now() / 1000) * 1000)
            .toISOString()
            .replace("T", " ")
            .slice(0, 16) + " UTC",
        };

        recordOrder(order);
        console.log(`[order] ${order.orderId} ${order.amountTotal} ${order.currency}`);

        const mail = buildOrderEmail(order);
        const result = await sendOrderNotification(mail);
        if (result.ok) {
          console.log(`[email] notified ${config.email.notify} (${result.id})`);
        } else {
          // Loud, but the order is already safe on disk.
          console.error(`[email] FAILED for ${order.orderId}: ${result.reason}`);
        }
      } catch (err) {
        console.error("[webhook] fulfilment error:", err?.stack || err);
      }
    }
  );

  return router;
}
