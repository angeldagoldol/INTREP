import express from "express";
import Stripe from "stripe";
import { config } from "./src/config.js";
import { checkoutRouter } from "./src/routes/checkout.js";
import { webhookRouter } from "./src/routes/webhook.js";
import { cors } from "./src/cors.js";

const stripe = new Stripe(config.stripe.secretKey);
const app = express();

app.disable("x-powered-by");

// ORDER MATTERS. The webhook needs the raw request body for signature
// verification, so it is mounted before the JSON parser below.
app.use("/api", webhookRouter(stripe));

app.use(express.json({ limit: "64kb" }));
// CORS applies only to the browser-facing API, never the webhook above.
app.use("/api", cors, checkoutRouter(stripe));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use(express.static("public", { extensions: ["html"] }));

app.listen(config.port, () => {
  console.log(`\n  ${config.brand.name} — store running at ${config.baseUrl}`);
  console.log(`  Currency:        ${config.currency.toUpperCase()}`);
  console.log(`  Ships to:        ${config.shipTo.join(", ")}`);
  console.log(`  Orders notify:   ${config.email.notify}`);
  console.log(`  Stripe mode:     ${config.stripe.secretKey.startsWith("sk_live") ? "LIVE — real money" : "test"}`);
  console.log(`\n  Local webhooks:  npm run stripe:listen\n`);
});
