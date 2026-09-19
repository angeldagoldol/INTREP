// Prove the storefront shows exactly what the server charges.
// Exits non-zero on any mismatch, so it can gate a deploy.
//
//   node scripts/verify-prices.mjs
import { readFileSync } from "node:fs";
import { listProducts, getProduct } from "../src/catalog.js";
import { formatMoney } from "../src/money.js";

const html = readFileSync("storefront/index.html", "utf8");

// Pull the Wh shop map out of the bundle.
const start = html.search(/\bWh\s*=\s*\{/);
let brace = html.indexOf("{", start), depth = 0, end = brace;
for (let k = brace; k < html.length; k++) {
  if (html[k] === "{") depth++;
  else if (html[k] === "}") { depth--; if (depth === 0) { end = k + 1; break; } }
}
const wh = html.slice(brace, end);

const shown = new Map();
for (const m of wh.matchAll(
  /(?:"([^"]+)"|([A-Za-z][\w$]*)|`([^`]+)`)\s*:\s*\{(buy:[^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g
)) {
  const name = m[1] || m[2] || m[3];
  const price = /price:([0-9.e+]+)/.exec(m[4]);
  const buy = /buy:`([^`]+)`/.exec(m[4]);
  if (price && buy && buy[1] === "cart") shown.set(name, Number(price[1]));
}

let bad = 0, checked = 0, drift = 0;
for (const p of listProducts()) {
  const displayed = shown.get(p.name);
  if (displayed === undefined) {
    console.error(`  MISSING from storefront: ${p.name}`);
    bad++; drift++;
    continue;
  }
  checked++;
  if (Math.abs(displayed - p.amount / 100) > 0.005) {
    console.error(
      `  MISMATCH ${p.name.padEnd(30)} storefront ₱${displayed} vs server ${formatMoney(p.amount, "php")}`
    );
    bad++; drift++;
  }
}

// PayMongo will not take an order below its floor; catching it here beats a
// customer discovering it at checkout.
const MIN = 10000;
for (const p of listProducts()) {
  if (p.mode === "checkout" && p.amount < MIN) {
    console.error(`  BELOW PAYMONGO MINIMUM: ${p.name} at ${formatMoney(p.amount, "php")} (floor ₱100)`);
    bad++;
  }
  if (!Number.isInteger(p.amount) || p.amount <= 0) {
    console.error(`  INVALID AMOUNT: ${p.name} = ${p.amount}`);
    bad++;
  }
}

console.log(`  compared ${checked}/${listProducts().length} products`);
if (bad) {
  console.error(
    `\n  ${bad} problem(s) — do not deploy.` +
      (drift ? `\n  ${drift} of them are price drift: the storefront shows something other than what is charged.` : "")
  );
  process.exit(1);
}
console.log("  OK — every displayed price equals the charged price.");
