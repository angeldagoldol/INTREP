import express from "express";
import { config } from "../config.js";
import { getProduct } from "../catalog.js";
import { buildEnquiryEmail } from "../templates/enquiryEmail.js";
import { sendOrderNotification } from "../email.js";
import { recordEnquiry } from "../orders.js";

const MAX = { name: 120, email: 200, phone: 40, message: 2000, items: 10, qty: 5 };

// This endpoint is public and its whole job is to send you an email, which
// makes it a spam vector. A sliding window per client keeps it from becoming
// an open relay into your inbox.
//
// Behind a proxy (Railway, Fly, nginx) set `app.set("trust proxy", 1)` in
// server.js so req.ip is the real client and not the load balancer.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

// Deliberately permissive: the goal is to catch typos and obvious junk, not
// to adjudicate RFC 5322. A real address that this rejects is a lost sale.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function enquiryRouter() {
  const router = express.Router();

  router.post("/enquiry", async (req, res) => {
    const name = clean(req.body?.name, MAX.name);
    const email = clean(req.body?.email, MAX.email);
    const phone = clean(req.body?.phone, MAX.phone);
    const message = clean(req.body?.message, MAX.message);

    if (!name) return res.status(400).json({ error: "Please give your name." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please give a valid email address." });

    const rows = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rows.length === 0) return res.status(400).json({ error: "Please choose at least one vehicle." });
    if (rows.length > MAX.items) return res.status(400).json({ error: "Too many items in one enquiry." });

    const items = [];
    for (const row of rows) {
      const product = getProduct(row?.id);
      if (!product) return res.status(400).json({ error: `Unknown product: ${String(row?.id)}` });
      // Enquiry-only by definition; a payable item belongs in checkout.
      if (product.mode !== "enquiry") {
        return res.status(400).json({ error: `${product.name} can be bought online — use checkout instead.` });
      }
      const quantity = Number(row?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX.qty) {
        return res.status(400).json({ error: `Invalid quantity for ${product.name}.` });
      }
      // Price from the catalog, as everywhere else. Indicative, but still ours.
      items.push({ id: product.id, name: product.name, sku: product.sku, amount: product.amount, quantity });
    }

    // Rate limit only AFTER validation passes. A rejected request sends no
    // email, so it is not a spam vector — and counting it would lock out a
    // customer who simply mistyped their address a few times.
    if (rateLimited(req.ip || "unknown")) {
      return res.status(429).json({ error: "Too many enquiries. Please try again later." });
    }

    const enquiry = {
      ref: `ENQ-${Date.now().toString(36).toUpperCase()}`,
      name, email, phone, message, items,
      currency: config.currency,
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
    };

    // Save before emailing: a mail failure must not lose the lead.
    recordEnquiry(enquiry);
    console.log(`[enquiry] ${enquiry.ref} ${name} <${email}> ${items.map((i) => i.name).join(", ")}`);

    const result = await sendOrderNotification(buildEnquiryEmail(enquiry));
    if (!result.ok) console.error(`[enquiry] email FAILED for ${enquiry.ref}: ${result.reason}`);

    // The customer's experience does not depend on our mail provider.
    return res.status(200).json({ ok: true, ref: enquiry.ref });
  });

  return router;
}
