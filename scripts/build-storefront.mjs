// Build the deployable storefront for a static host (Vercel).
//
// Two things happen here, and the second is the reason this script exists
// rather than a hand-edit:
//
//   1. STORE_ENDPOINT is stamped in from the environment, so the bundle in git
//      stays a harmless demo that charges nothing and the deployed one points
//      at your API.
//   2. The bridge is RE-INLINED from public/store-bridge.js. The bundle holds
//      a copy of it, and a copy drifts — this one was already a version behind
//      and would have shipped a storefront with no links to the legal pages.
//
// Everything else in the 2.8MB bundle is left byte-for-byte alone.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const SRC = "storefront/index.html";
const BRIDGE = "public/store-bridge.js";
const OUT_DIR = process.env.STOREFRONT_OUT || "dist";

// Vercel exposes the deployment URL, but the API lives elsewhere, so this is
// always explicit. Empty is allowed and means "publish the demo as a demo".
const endpoint = (process.env.STORE_API_URL || "").trim().replace(/\/+$/, "");

// http is allowed for localhost only, so you can check a build before you
// ship it. Anywhere else a page served over https cannot call an http API —
// the browser blocks it as mixed content, and the failure looks like "checkout
// does nothing" rather than anything that names the cause.
const isLocal = /^http:\/\/localhost(:\d+)?$/.test(endpoint);
if (endpoint && !isLocal && !/^https:\/\//.test(endpoint)) {
  throw new Error(
    `STORE_API_URL must be an https:// origin, got "${endpoint}".\n` +
    `A storefront served over https cannot call an http API — the browser blocks it.`
  );
}

const html = readFileSync(SRC, "utf8");
let bridge = readFileSync(BRIDGE, "utf8");

// The bridge is about to be embedded in an HTML document. A literal </script>
// anywhere in it would close the tag early and spill code into the page.
if (/<\/script/i.test(bridge)) {
  throw new Error(`${BRIDGE} contains a literal </script> — it cannot be inlined safely.`);
}

// Test for the declaration separately: when STORE_API_URL is unset the
// replacement is byte-identical to the original, so "unchanged" would be the
// wrong way to detect "not found".
const DECL = /var STORE_ENDPOINT = "[^"]*";/;
if (!DECL.test(bridge)) {
  throw new Error(`Could not find the STORE_ENDPOINT declaration in ${BRIDGE}.`);
}
bridge = bridge.replace(DECL, `var STORE_ENDPOINT = ${JSON.stringify(endpoint)};`);

const companies = extractCompanies(html);
{
  const DECL = /var SCORE_DETAIL = \{\};/;
  if (!DECL.test(bridge)) throw new Error(`Could not find the SCORE_DETAIL declaration in ${BRIDGE}.`);
  bridge = bridge.replace(DECL, `var SCORE_DETAIL = ${JSON.stringify(companies)};`);
}
// Both bridge rewrites must land BEFORE it is embedded in `out` below.
// Mutating `bridge` afterwards changes a string nothing reads again.

// Replace the contents of <script id="store-bridge">…</script>, not the tag.
const open = html.indexOf('<script id="store-bridge">');
if (open === -1) throw new Error(`${SRC} has no <script id="store-bridge"> block to replace.`);
const bodyStart = html.indexOf(">", open) + 1;
const bodyEnd = html.indexOf("</script>", bodyStart);
if (bodyEnd === -1) throw new Error(`${SRC}: unterminated store-bridge script block.`);

let out = html.slice(0, bodyStart) + "\n" + bridge + "\n" + html.slice(bodyEnd);

// The bundle ships no <title> — React renders one at runtime, so a crawler
// that does not execute JS sees an untitled page, and a shared link has no
// name. Stamp the real tags into the static head. The bridge also sets
// document.title, because React's hoisted <title> wins in a live browser.
const TITLE = process.env.STOREFRONT_TITLE || "dagoldol — Japanese electronics and apparel";
const DESC = process.env.STOREFRONT_DESCRIPTION ||
  "Japanese electronics and apparel, shipped from the Philippines worldwide. " +
  "Prices in Philippine pesos, VAT included. Vehicles by enquiry.";
const attr = (v) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const headTags =
  `<title>${attr(TITLE)}</title>` +
  `<meta name="description" content="${attr(DESC)}">` +
  `<meta property="og:title" content="${attr(TITLE)}">` +
  `<meta property="og:description" content="${attr(DESC)}">` +
  `<meta property="og:site_name" content="dagoldol">` +
  `<meta property="og:type" content="website">` +
  `<meta name="twitter:card" content="summary">`;

const headClose = out.indexOf("</head>");
if (headClose === -1) throw new Error(`${SRC} has no </head> to stamp metadata into.`);
out = out.slice(0, headClose) + headTags + out.slice(headClose);

mkdirSync(OUT_DIR, { recursive: true });

// The product photos are separate files the page loads from ./products/. Only
// the small gallery thumbnails are inlined as data URIs, so a build that emits
// index.html alone looks fine in every automated check and shows a shop full
// of empty cards to an actual customer. Copy them, and refuse to build if one
// the page asks for is not there.
const PRODUCT_SRC = "storefront/products";
const wanted = [...new Set([...out.matchAll(/file:`([^`]+)`/g)].map((m) => m[1]))].sort();
const missing = wanted.filter((f) => !existsSync(`${PRODUCT_SRC}/${f}`));
if (missing.length) {
  throw new Error(
    `${missing.length} product image(s) the page references are missing from ${PRODUCT_SRC}/:\n` +
    missing.map((f) => `  ${f}`).join("\n") +
    `\nThe shop would render empty cards. Add them before deploying.`
  );
}
mkdirSync(`${OUT_DIR}/products`, { recursive: true });
let copied = 0;
for (const f of wanted) { copyFileSync(`${PRODUCT_SRC}/${f}`, `${OUT_DIR}/products/${f}`); copied++; }

// The scorecard in the page shows five numbers and nothing else. The page
// already holds a paragraph explaining each one — it is rendered in the
// Dossier section and nowhere near the scores. Lift that data out here so the
// bridge can put it behind the scores where someone reading them will look.
//
// Parsed from the bundle rather than duplicated by hand: if the artifact's
// prose ever changes, this follows it instead of quietly going stale.
function extractCompanies(source) {
  const start = source.indexOf("wh=[{id:`toyota`");
  if (start === -1) throw new Error("Could not find the company data in the bundle.");
  const end = source.indexOf("}];", start);
  if (end === -1) throw new Error("Company data in the bundle is unterminated.");
  const records = source.slice(start, end).split(/,?\{id:`/).slice(1);

  const field = (rec, key) => {
    const m = new RegExp("[,{]" + key + ":`((?:[^`\\\\]|\\\\.)*)`").exec("," + rec);
    return m ? m[1] : null;
  };
  const obj = (rec, key) => {
    const m = new RegExp(key + ":\\{([^}]*)\\}").exec(rec);
    if (!m) return {};
    return Object.fromEntries(m[1].split(",").map((pair) => {
      const [k, v] = pair.split(":");
      return [k, v === "null" ? null : Number(v)];
    }));
  };

  const out = {};
  for (const raw of records) {
    const id = raw.slice(0, raw.indexOf("`"));
    out[id] = {
      name: field(raw, "name"),
      fy: field(raw, "fy"),
      scores: obj(raw, "scores"),
      income: obj(raw, "income"),
      funds: field(raw, "funds"),
      supply: field(raw, "supply"),
      demand: field(raw, "demand"),
      marketing: field(raw, "marketing"),
    };
  }

  // A half-parsed record would show a customer an empty panel, so fail here
  // instead. Every company needs its five scores and its four paragraphs.
  const PROSE = ["funds", "supply", "demand", "marketing"];
  for (const [id, c] of Object.entries(out)) {
    if (!c.name || !c.fy) throw new Error(`Company ${id}: missing name or fiscal year.`);
    if (Object.keys(c.scores).length !== 5) throw new Error(`Company ${id}: expected 5 scores, got ${Object.keys(c.scores).length}.`);
    if (c.income.revenue == null) throw new Error(`Company ${id}: missing revenue.`);
    const thin = PROSE.filter((k) => !c[k] || c[k].length < 80);
    if (thin.length) throw new Error(`Company ${id}: no usable text for ${thin.join(", ")}.`);
  }
  if (Object.keys(out).length < 2) throw new Error("Parsed fewer than two companies — the bundle shape has changed.");
  return out;
}

// Which of these are the seller's own photographs?
//
// The stock photos are Wikimedia Commons images under CC BY-SA or CC0, and the
// page prints each one's author and licence beneath it. Swap in your own photo
// and that line would credit a stranger for your work and claim a Creative
// Commons licence over it — a false attribution, and the opposite of what the
// licence is for. So: a file whose hash no longer matches the recorded stock
// hash is yours, and its stock credit is removed.
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const stockDb = JSON.parse(readFileSync(`${PRODUCT_SRC}/stock-photos.json`, "utf8")).photos;

const own = [];
for (const f of wanted) {
  const known = stockDb[f];
  if (!known || sha(`${PRODUCT_SRC}/${f}`) !== known.sha256) own.push(f);
}

// Rewrite the credit data for the seller's own photos. `#photo` is a sentinel
// the bridge looks for to render a plain "Photo: <brand>" with no links; even
// if the bridge never runs, what remains is still truthful.
const BRAND = process.env.BRAND_NAME || "dagoldol";
for (const f of own) {
  const slug = stockDb[f]?.slug;
  if (!slug) continue;
  const entry = new RegExp(
    `("${slug}":\\{file:\`${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\`,)` +
    "credit:`[^`]*`,license:`[^`]*`,licenseUrl:`[^`]*`,page:`[^`]*`");
  const before = out;
  out = out.replace(entry, `$1credit:\`${BRAND}\`,license:\`own photograph\`,licenseUrl:\`#photo\`,page:\`#photo\``);
  if (out === before) throw new Error(`Could not rewrite the photo credit for ${f} (slug ${slug}).`);
}

// Written LAST, after every rewrite above. Writing it earlier silently
// dropped the photo-credit changes made below it.
writeFileSync(`${OUT_DIR}/index.html`, out, "utf8");

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(`\n  ${OUT_DIR}/index.html  ${kb(out.length)}`);
console.log(`  bridge re-inlined from ${BRIDGE} (${kb(bridge.length)})`);
console.log(`  ${copied} product photos copied to ${OUT_DIR}/products/`);
console.log(`  ${own.length} of them are your own; ${copied - own.length} still stock Wikimedia photos`);
if (own.length) console.log(`    stock credit removed from: ${own.join(", ")}`);
if (endpoint) {
  console.log(`  checkout -> ${endpoint}`);
  console.log(`  legal    -> ${endpoint}/legal/terms.html\n`);
} else {
  console.log(`\n  STORE_API_URL is not set, so this build takes NO payments.`);
  console.log(`  That is the safe default: a page must never claim to charge`);
  console.log(`  while pointing at nothing. Set it in your Vercel project to`);
  console.log(`  switch checkout on.\n`);
}
