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

// The server must never boot without a way to take money. Tooling that takes
// none — the email check — is a different question, and blocking it behind a
// payment key only teaches people to paste a fake one in to get past it.
// scripts/build-legal.mjs deliberately does NOT set this: a legal page has to
// name who takes the payment, so it needs a real provider configured.
const TOOLING = process.env.CONFIG_TOOLING === "1";

if (!hasStripe && !hasPayMongo && !TOOLING) {
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

// "*" is the convenient local default. In production it lets any site on the
// internet create Checkout Sessions against your payment account, so say so
// loudly rather than letting a deploy quietly ship it.
if (process.env.NODE_ENV === "production" && (process.env.ALLOWED_ORIGINS || "*").includes("*")) {
  console.warn(
    "\n  WARNING: ALLOWED_ORIGINS allows every origin in production.\n" +
    "  Set it to your storefront's real origin, e.g. https://dagoldol.vercel.app\n"
  );
}

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
  admin: {
    // Guards the metrics dashboard. Business numbers are not public.
    token: process.env.ADMIN_TOKEN || "",
  },
  // Where orders, enquiries, stock and the webhook idempotency record live.
  // Managed hosts mount a persistent disk at a path of their choosing; point
  // DATA_DIR at it. Leaving this default on a host WITHOUT a mounted disk
  // means the container's own filesystem, which is wiped on every deploy.
  dataDir: (process.env.DATA_DIR || "data").replace(/\/+$/, ""),

  // Identity facts for the legal pages. They are NOT committed: this repo is
  // public, and a home address and TIN in git history cannot be taken back.
  // scripts/build-legal.mjs refuses to render a page while any of them is
  // blank, so a policy that says "TIN [TIN]" can never reach a customer.
  legal: {
    // "dti" for a sole proprietorship, "sec" for a corporation or partnership.
    regType: (process.env.BUSINESS_REG_TYPE || "").trim().toLowerCase(),
    regNo: (process.env.BUSINESS_REG_NO || "").trim(),
    tin: (process.env.BUSINESS_TIN || "").trim(),
    address: (process.env.BUSINESS_ADDRESS || "").trim(),
    // Where returns come back to. Usually, but not always, the same place.
    returnAddress: (process.env.RETURN_ADDRESS || process.env.BUSINESS_ADDRESS || "").trim(),
    supportPhone: (process.env.SUPPORT_PHONE || "").trim(),
    // Under RA 10173 the DPO is a named person, not a role address.
    dpoName: (process.env.DPO_NAME || "").trim(),
    // Where disputes are heard. Normally the city you are registered in.
    jurisdictionCity: (process.env.JURISDICTION_CITY || "").trim(),
    couriers: (process.env.COURIERS || "")
      .split(",").map((c) => c.trim()).filter(Boolean),
    // One window for every market. PH law requires none; the EU and UK
    // require 14, so 14 is one policy instead of two.
    returnWindowDays: Number(process.env.RETURN_WINDOW_DAYS || 14),
    deliveryPh: process.env.DELIVERY_ESTIMATE_PH || "3–7 working days",
    deliveryIntl: process.env.DELIVERY_ESTIMATE_INTL || "7–21 working days",
  },
  report: {
    // Which day a sale belongs to. Manila by default: the main market is PH,
    // and on UTC every sale before 8am local would land on the day before.
    timezone: process.env.REPORT_TIMEZONE || "Asia/Manila",
  },
  vat: {
    // Philippine VAT. Set VAT_RATE=0 to switch the breakdown off entirely.
    rate: process.env.VAT_RATE === undefined ? 0.12 : Number(process.env.VAT_RATE),
    // Catalog amounts are shelf prices, so the tax is already inside them.
    inclusive: process.env.PRICES_INCLUDE_VAT !== "false",
    label: process.env.VAT_LABEL || "VAT 12%",
  },
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
