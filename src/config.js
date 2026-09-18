// Environment configuration, validated once at boot so a misconfigured
// deployment fails loudly at startup rather than silently at checkout.
import { readFileSync } from "node:fs";

// Minimal .env loader — avoids a dependency and never overwrites a real
// environment variable set by the host (Railway, Fly, Render, systemd...).
function loadDotEnv(path = ".env") {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return; // no .env is fine in production
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NOTIFY_EMAIL"];
const missing = required.filter((k) => !process.env[k] || process.env[k].includes("replace_me"));

if (missing.length) {
  console.error(
    `\nMissing required environment variables: ${missing.join(", ")}\n` +
      `Copy .env.example to .env and fill them in. See README.md.\n`
  );
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT || 3000),
  // Shown in the storefront, the order emails and the legal pages.
  brand: {
    name: process.env.BRAND_NAME || "dagoldol",
    legalName: process.env.LEGAL_BUSINESS_NAME || "",
    supportEmail: process.env.SUPPORT_EMAIL || process.env.NOTIFY_EMAIL || "",
  },
  // Where you will actually ship. PH first: it is the main market.
  shipTo: (process.env.SHIP_TO_COUNTRIES ||
    "PH,US,GB,JP,SG,MY,TH,ID,VN,AU,CA,AE,DE,FR,NL,ES,IT")
    .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
  baseUrl: (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  currency: (process.env.CURRENCY || "gbp").toLowerCase(),
  // Comma-separated list of origins allowed to call /api/*.
  // "*" is convenient locally and too loose for production.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  email: {
    notify: process.env.NOTIFY_EMAIL,
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    resendApiKey: process.env.RESEND_API_KEY || "",
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  },
};

// Warn, don't crash: a store that can take money but not email you is still
// better than a store that refuses to boot. The webhook logs every order.
if (!config.email.resendApiKey && !config.email.smtp.host) {
  console.warn(
    "[email] No RESEND_API_KEY and no SMTP_HOST configured — order emails " +
      "will be skipped. Orders are still recorded in data/orders.jsonl.\n" +
      "        Meanwhile, turn on Stripe Dashboard -> Notifications -> " +
      "'Successful payments' so you are not flying blind."
  );
}
