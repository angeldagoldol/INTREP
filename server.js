import express from "express";
import Stripe from "stripe";
import { config } from "./src/config.js";
import { checkoutRouter } from "./src/routes/checkout.js";
import { webhookRouter } from "./src/routes/webhook.js";
import { paymongoWebhookRouter } from "./src/routes/paymongoWebhook.js";
import { cors } from "./src/cors.js";
import { enquiryRouter } from "./src/routes/enquiry.js";

// Stripe is optional now — a Philippines-only seller may run PayMongo alone.
const stripe = config.stripe.enabled ? new Stripe(config.stripe.secretKey) : null;
const app = express();

app.disable("x-powered-by");
// Behind a proxy (Railway, Fly, nginx) this makes req.ip the real client,
// which the enquiry rate limiter depends on.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

// ORDER MATTERS. The webhook needs the raw request body for signature
// verification, so it is mounted before the JSON parser below.
// Both webhooks need the RAW body for signature verification, so they mount
// before express.json() below. Order matters.
if (config.stripe.enabled) app.use("/api", webhookRouter(stripe));
if (config.paymongo.enabled) app.use("/api", paymongoWebhookRouter());

app.use(express.json({ limit: "64kb" }));
// CORS applies only to the browser-facing API, never the webhook above.
app.use("/api", cors, checkoutRouter(stripe));
app.use("/api", cors, enquiryRouter());

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use(express.static("public", { extensions: ["html"] }));

app.listen(config.port, () => {
  console.log(`\n  ${config.brand.name} — store running at ${config.baseUrl}`);
  console.log(`  Currency:        ${config.currency.toUpperCase()}`);
  console.log(`  Ships to:        ${config.shipTo.join(", ")}`);
  console.log(`  Orders notify:   ${config.email.notify}`);
  const providers = [];
  if (config.paymongo.enabled)
    providers.push(`PayMongo (${config.paymongo.methods.join(", ")}) ${config.paymongo.secretKey.startsWith("sk_live") ? "LIVE" : "test"}`);
  if (config.stripe.enabled)
    providers.push(`Stripe ${config.stripe.secretKey.startsWith("sk_live") ? "LIVE" : "test"}`);
  console.log(`  Payments:        ${providers.join("  |  ")}`);
  console.log(`\n  Local webhooks:  npm run stripe:listen\n`);
});
