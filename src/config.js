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

const isSet = (k) => Boolean(process.env[k]) && !process.env[k].includes("replace_me");

// At least one payment provider must be configured, but not both: a
// Philippines-only seller may run PayMongo alone, and an international-only
// seller may run Stripe alone.
const hasStripe = isSet("STRIPE_SECRET_KEY") && isSet("STRIPE_WEBHOOK_SECRET");
const hasPayMongo = isSet("PAYMONGO_SECRET_KEY");

if (!hasStripe && !hasPayMongo) {
  console.error(
    "\nNo payment provider configured.\n" +
      "  Stripe   — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET\n" +
      "  PayMongo — set PAYMONGO_SECRET_KEY (and PAYMONGO_WEBHOOK_SECRET)\n" +
      "Copy .env.example to .env and fill one in. See README.md.\n"
  );
  process.exit(1);
}

if (!isSet("NOTIFY_EMAIL")) {
  console.error("\nMissing NOTIFY_EMAIL — there would be nowhere to send order alerts.\n");
  process.exit(1);
}

const PORT = Number(process.env.PORT || 3000);

export const config = {
  port: PORT,
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
  // Used to build the payment providers' success_url and cancel_url, so a
  // wrong value sends paying customers to a dead address. Default to the port
  // actually being listened on rather than a hardcoded 3000.
  baseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, ""),
  currency: (process.env.CURRENCY || "gbp").toLowerCase(),
  // Comma-separated list of origins allowed to call /api/*.
  // "*" is convenient locally and too loose for production.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  paymongo: {
    secretKey: process.env.PAYMONGO_SECRET_KEY || "",
    webhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET || "",
    // Which wallets/rails to offer. GCash and Maya are the point of this.
    methods: (process.env.PAYMONGO_METHODS || "gcash,paymaya,card")
      .split(",").map((m) => m.trim()).filter(Boolean),
    get enabled() {
      return Boolean(this.secretKey);
    },
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    get enabled() {
      return Boolean(this.secretKey && this.webhookSecret);
    },
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
      "        Meanwhile turn on your provider's own notifications so you are " +
      "not flying blind:\n" +
      (hasStripe ? "        Stripe:   Dashboard -> Settings -> Notifications -> Successful payments\n" : "") +
      (hasPayMongo ? "        PayMongo: Dashboard -> Settings -> Notifications\n" : "")
  );
}
