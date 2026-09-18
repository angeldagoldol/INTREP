// The storefront artifact is served from a different origin to this server,
// so the browser will not let it call /api/* without these headers.
//
// The webhook route deliberately does NOT get CORS: Stripe calls it
// server-to-server, and no browser should ever reach it cross-origin.
import { config } from "./config.js";

export function cors(req, res, next) {
  const origin = req.headers.origin;
  const allowed = config.allowedOrigins;

  // "*" is for local testing only. In production list your real origins —
  // with credentials off this is not catastrophic, but an allowlist means
  // only your storefront can create Checkout Sessions on your Stripe account.
  const ok = allowed.includes("*") || (origin && allowed.includes(origin));

  if (ok && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (allowed.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    // Preflight. 204 with the headers above and no body.
    return res.status(ok || allowed.includes("*") ? 204 : 403).end();
  }

  if (origin && !ok) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  next();
}
