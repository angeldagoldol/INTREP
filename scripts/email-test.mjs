// Send one realistic order notification, to prove email actually works before
// a real customer depends on it.
//
//   npm run email:test
//
// Nothing here touches payments or the order log. It builds the same email a
// paid order would, sends it through the same code path, and explains any
// failure in terms of what to go and change.
import { config } from "../src/config.js";
import { buildOrderEmail } from "../src/templates/orderEmail.js";
import { sendOrderNotification } from "../src/email.js";

const SAMPLE = {
  orderId: "cs_email_test",
  provider: "paymongo",
  paymentMethod: "gcash",
  amountTotal: 4801200,
  currency: config.currency,
  customerName: "Juan Dela Cruz (sample)",
  customerEmail: "sample.customer@example.com",
  customerPhone: "+63 917 000 0000",
  createdAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
  livemode: false,
  items: [
    { description: "PlayStation 5", quantity: 1, amountTotal: 4003200 },
    { description: "DualSense wireless controller", quantity: 2, amountTotal: 798000 },
  ],
  shipping: {
    name: "Juan Dela Cruz",
    address: { line1: "12 Mabini St", city: "Quezon City", postal_code: "1100", country: "PH" },
  },
};

const provider = config.email.resendApiKey ? "Resend"
  : config.email.smtp.host ? `SMTP (${config.email.smtp.host})`
  : null;

console.log(`\n  Provider: ${provider || "NONE CONFIGURED"}`);
console.log(`  From:     ${config.email.from}`);
console.log(`  To:       ${config.email.notify}\n`);

if (!provider) {
  console.error("  No email provider is configured, so nothing was sent.\n");
  console.error("  Resend is the quickest: create a key at resend.com/api-keys,");
  console.error("  then put it in .env as  RESEND_API_KEY=re_...\n");
  process.exit(1);
}

const mail = buildOrderEmail(SAMPLE);
const result = await sendOrderNotification(mail);

if (result.ok) {
  console.log(`  Sent. Message id: ${result.id}`);
  console.log(`  Subject: ${mail.subject}`);
  console.log(`\n  Check ${config.email.notify}. If it is not there in a minute,`);
  console.log(`  look in spam, then at the Resend dashboard's Emails tab —`);
  console.log(`  accepted-but-not-delivered shows up there, not here.\n`);
  process.exit(0);
}

// Translate the common failures into the thing to actually go and change.
const reason = String(result.reason || "");
console.error(`  FAILED: ${reason}\n`);

const HINTS = [
  [/only send testing emails to your own|403/i,
   `Resend's shared onboarding@resend.dev address can only send to the email\n` +
   `  that owns the Resend account. NOTIFY_EMAIL is ${config.email.notify} —\n` +
   `  either make that the account's own address, or verify your own domain in\n` +
   `  Resend and set EMAIL_FROM to something at that domain.`],
  [/API key is invalid|unauthorized|401/i,
   `The key was rejected. Copy it again from resend.com/api-keys — it is shown\n` +
   `  once, at creation, and a truncated paste is the usual cause.`],
  [/domain is not verified|not verified/i,
   `EMAIL_FROM (${config.email.from}) is on a domain Resend has not verified.\n` +
   `  Verify it under Domains at resend.com/domains` +
   (/@resend\.dev$/.test(config.email.from)
     ? `.`
     : `, or set EMAIL_FROM=onboarding@resend.dev\n  to send without a domain of your own.`)],
  [/ENOTFOUND|ECONNREFUSED|fetch failed|EAI_AGAIN|certificate/i,
   `That is a network failure, not a configuration one. This machine could not\n` +
   `  reach the provider — check egress rules or a proxy before changing keys.`],
  [/Invalid login|535|EAUTH/i,
   `SMTP rejected the credentials. For Gmail this must be an App Password with\n` +
   `  2-Step Verification on; a normal password will always fail.`],
];
const hint = HINTS.find(([re]) => re.test(reason));
console.error("  " + (hint ? hint[1] : "No specific hint for this one — the provider's message above is the lead."));
console.error("");
process.exit(1);
