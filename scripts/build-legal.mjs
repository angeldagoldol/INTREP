// Render the legal templates into public/legal/*.html.
//
// The identity facts live in .env, never in git: this repository is public,
// and a home address or TIN pushed into its history cannot be taken back.
//
// The script REFUSES to render while a required fact is missing. That is the
// whole point of it. A policy page that reads "TIN {{TIN}}" is worse than no
// page at all — it tells a customer, and the DTI, that nobody checked.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { config } from "../src/config.js";

const OUT = "public/legal";
const PAGES = [
  { file: "terms.md", slug: "terms", title: "Terms and Conditions" },
  { file: "refund-policy.md", slug: "refund-policy", title: "Refund and Returns Policy" },
  { file: "privacy-policy.md", slug: "privacy-policy", title: "Privacy Policy" },
];

// --- the facts -------------------------------------------------------------

const L = config.legal;

const REG_LABEL = { dti: "DTI Business Name Registration No.", sec: "SEC Registration No." }[L.regType] || "";

function countryNames() {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const list = config.shipTo.filter((c) => c !== "PH").map((c) => {
    try { return names.of(c) || c; } catch { return c; }
  });
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

function paymentProviders() {
  const out = [];
  if (config.paymongo.enabled) {
    const WALLET = { gcash: "GCash", paymaya: "Maya", card: "card" };
    const methods = config.paymongo.methods.map((m) => WALLET[m] || m).join(", ");
    out.push(`**PayMongo** (${methods})`);
  }
  if (config.stripe.enabled) out.push("**Stripe** (international cards)");
  return out;
}

function emailProvider() {
  if (config.email.resendApiKey) return "Resend";
  if (config.email.smtp.host) return config.email.smtp.host;
  return "";
}

const providers = paymentProviders();

const VALUES = {
  DATE: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: config.report.timezone }),
  TRADING_NAME: config.brand.name,
  LEGAL_BUSINESS_NAME: config.brand.legalName,
  REG_LABEL,
  REG_NO: L.regNo,
  TIN: L.tin,
  BUSINESS_ADDRESS: L.address,
  RETURN_ADDRESS: L.returnAddress,
  SUPPORT_EMAIL: config.brand.supportEmail,
  SUPPORT_PHONE: L.supportPhone,
  DPO_NAME: L.dpoName,
  JURISDICTION_CITY: L.jurisdictionCity,
  COURIERS: L.couriers.join(", "),
  COUNTRIES: countryNames(),
  VAT_LABEL: config.vat.label,
  RETURN_WINDOW: String(L.returnWindowDays),
  DELIVERY_PH: L.deliveryPh,
  DELIVERY_INTL: L.deliveryIntl,
  PAYMENT_PROVIDERS: providers.join(" and "),
  // The same providers without the parenthetical, for mid-sentence use.
  PAYMENT_PROVIDERS_SHORT: providers.map((p) => p.replace(/\s*\(.*\)/, "")).join(" and "),
  EMAIL_PROVIDER: emailProvider(),
};

// Everything a customer-facing page must not be published without. The
// environment variable is named so the message says what to actually go and do.
const REQUIRED = {
  LEGAL_BUSINESS_NAME: "LEGAL_BUSINESS_NAME — your registered DTI or SEC name",
  REG_LABEL: "BUSINESS_REG_TYPE — 'dti' for a sole proprietorship, 'sec' for a corporation",
  REG_NO: "BUSINESS_REG_NO — the number on your DTI certificate or SEC registration",
  TIN: "BUSINESS_TIN — your BIR Taxpayer Identification Number",
  BUSINESS_ADDRESS: "BUSINESS_ADDRESS — your full registered address",
  RETURN_ADDRESS: "RETURN_ADDRESS — where returns are sent (defaults to BUSINESS_ADDRESS)",
  SUPPORT_EMAIL: "SUPPORT_EMAIL — a monitored address",
  SUPPORT_PHONE: "SUPPORT_PHONE — a mobile number is normal and expected in PH",
  DPO_NAME: "DPO_NAME — the NAMED person responsible under RA 10173, not a role address",
  JURISDICTION_CITY: "JURISDICTION_CITY — the city whose courts hear a dispute",
  COURIERS: "COURIERS — who carries your parcels; RA 10173 needs them named",
  PAYMENT_PROVIDERS: "PAYMONGO_SECRET_KEY or STRIPE_SECRET_KEY — the page must say who takes the money",
  EMAIL_PROVIDER: "RESEND_API_KEY or SMTP_HOST — the page must name who handles your order mail",
};

const missing = Object.keys(REQUIRED).filter((k) => !VALUES[k]);
if (missing.length) {
  console.error(`\n  Refusing to build the legal pages — ${missing.length} fact${missing.length === 1 ? " is" : "s are"} missing.\n`);
  for (const k of missing) console.error(`    ${REQUIRED[k]}`);
  console.error(`\n  Put them in .env. They are deliberately NOT in git: this repository is\n  public, and an address or TIN in its history cannot be taken back.\n`);
  if (!VALUES.LEGAL_BUSINESS_NAME) {
    console.error("  If you are not registered yet, that is the real blocker, not this script.");
    console.error("  RA 11967 requires an online seller to be identifiable, and the BIR");
    console.error("  requires a receipt for every sale. Register first; these pages are");
    console.error("  ready for the day you do.\n");
  }
  process.exit(1);
}

// --- a deliberately small markdown renderer --------------------------------
// Only the subset these three documents use. A dependency here would be more
// risk than it removes, and anything it did not support would fail silently.

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inline = (s) =>
  esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

function render(md) {
  const lines = md.split("\n");
  const out = [];
  let para = [], list = null, table = null;

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`); list = null; } };
  const flushTable = () => {
    if (!table) return;
    const [head, ...body] = table;
    out.push(`<table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>` +
      `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    table = null;
  };
  const flushAll = () => { flushPara(); flushList(); flushTable(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushAll(); continue; }

    if (/^#{1,3} /.test(line)) {
      flushAll();
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+ /, ""))}</h${level}>`);
      continue;
    }
    if (/^\s*[-*] /.test(line)) {
      flushPara(); flushTable();
      (list ||= []).push(line.replace(/^\s*[-*] /, ""));
      continue;
    }
    // A wrapped continuation line belongs to the list item above it. Treating
    // it as a new paragraph splits a bullet mid-sentence.
    if (list && /^\s+\S/.test(raw)) {
      list[list.length - 1] += " " + line.trim();
      continue;
    }
    if (/^\|/.test(line)) {
      flushPara(); flushList();
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;   // the --- separator row
      (table ||= []).push(cells);
      continue;
    }
    flushList(); flushTable();
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}

// --- the page shell --------------------------------------------------------

const CSS = `
:root{color-scheme:light dark;
  --surface:#fcfcfb;--panel:#fff;--border:#e4e2dc;--ink:#0b0b0b;--ink-2:#52514e;--link:#1d4ed8}
@media (prefers-color-scheme:dark){:root{
  --surface:#1a1a19;--panel:#222220;--border:#343430;--ink:#f5f4ef;--ink-2:#c3c2b7;--link:#8ab0ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--surface);color:var(--ink);padding:32px 16px 72px;
  font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto}
nav{max-width:720px;margin:0 auto 28px;display:flex;gap:16px;flex-wrap:wrap;font-size:14px}
nav a,a{color:var(--link)}
nav a[aria-current]{color:var(--ink-2);text-decoration:none;font-weight:600}
h1{font-size:28px;line-height:1.25;margin:0 0 20px}
h2{font-size:18px;margin:32px 0 8px}
h3{font-size:15px;margin:22px 0 6px}
p,li{color:var(--ink-2)}
strong{color:var(--ink)}
ul{padding-left:22px}
li{margin:4px 0}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:15px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:top}
th{color:var(--ink);font-size:13px}
footer{max-width:720px;margin:44px auto 0;padding-top:18px;border-top:1px solid var(--border);
  color:var(--ink-2);font-size:13px}
:focus-visible{outline:2px solid var(--link);outline-offset:2px}
@media (forced-colors:active){th,td,footer{border-color:CanvasText}}
`;

function page({ title, slug, body }) {
  const nav = PAGES.map((p) => p.slug === slug
    ? `<a href="./${p.slug}.html" aria-current="page">${p.title}</a>`
    : `<a href="./${p.slug}.html">${p.title}</a>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)} — ${esc(config.brand.name)}</title>
<meta name="description" content="${esc(title)} for ${esc(config.brand.name)}, ${esc(config.brand.legalName)}.">
<style>${CSS}</style>
</head>
<body>
<nav aria-label="Legal pages">${nav}</nav>
<main>
${body}
</main>
<footer>
  ${esc(config.brand.legalName)} · ${esc(REG_LABEL)} ${esc(L.regNo)} · TIN ${esc(L.tin)}<br>
  ${esc(config.brand.supportEmail)} · ${esc(L.supportPhone)}
</footer>
</body>
</html>
`;
}

// --- build -----------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
for (const { file, slug, title } of PAGES) {
  let md = readFileSync(`legal/${file}`, "utf8");
  md = md.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => {
    if (!(key in VALUES)) throw new Error(`${file}: unknown placeholder ${m}`);
    return VALUES[key];
  });

  const html = page({ title, slug, body: render(md) });

  // Nothing unfilled may reach a customer. Belt and braces over the check
  // above, which only knows about the placeholders it was told to require.
  const leftover = html.match(/\{\{[^}]*\}\}|\[[A-Z][A-Z /—-]*\]/g);
  if (leftover) throw new Error(`${file}: unfilled placeholder(s) ${[...new Set(leftover)].join(", ")}`);

  writeFileSync(`${OUT}/${slug}.html`, html, "utf8");
  console.log(`  ${OUT}/${slug}.html`);
}
console.log(`\n  Built ${PAGES.length} pages for ${config.brand.legalName}.`);
console.log(`  They are gitignored — they carry your address and TIN.\n`);
