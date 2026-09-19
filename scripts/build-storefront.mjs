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
writeFileSync(`${OUT_DIR}/index.html`, out, "utf8");

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

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(`\n  ${OUT_DIR}/index.html  ${kb(out.length)}`);
console.log(`  bridge re-inlined from ${BRIDGE} (${kb(bridge.length)})`);
console.log(`  ${copied} product photos copied to ${OUT_DIR}/products/`);
if (endpoint) {
  console.log(`  checkout -> ${endpoint}`);
  console.log(`  legal    -> ${endpoint}/legal/terms.html\n`);
} else {
  console.log(`\n  STORE_API_URL is not set, so this build takes NO payments.`);
  console.log(`  That is the safe default: a page must never claim to charge`);
  console.log(`  while pointing at nothing. Set it in your Vercel project to`);
  console.log(`  switch checkout on.\n`);
}
