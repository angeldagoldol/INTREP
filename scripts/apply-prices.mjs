// Apply prices from a CSV to BOTH the server catalog and the storefront
// bundle, then verify the two agree.
//
//   node scripts/apply-prices.mjs prices.csv
//   node scripts/apply-prices.mjs prices.csv --dry-run
//
// The two files must never be edited independently: if they drift, customers
// are charged a number other than the one they read.
import { readFileSync, writeFileSync } from "node:fs";

const [, , csvPath, ...flags] = process.argv;
const DRY = flags.includes("--dry-run");
if (!csvPath) {
  console.error("usage: node scripts/apply-prices.mjs <prices.csv> [--dry-run]");
  process.exit(1);
}

const CATALOG = "src/catalog.js";
const BUNDLE = "storefront/index.html";

/** Minimal CSV reader: handles quoted fields and embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const header = rows.shift().map((h) => h.trim().toLowerCase());
const col = (n) => {
  const i = header.indexOf(n);
  if (i === -1) {
    console.error(`CSV is missing a "${n}" column.\n  Found: ${header.join(", ")}\n` +
      `  Regenerate a valid template with: npm run prices:export`);
    process.exit(1);
  }
  return i;
};
const iId = col("id"), iPrice = col("price_php");
const iName = header.indexOf("name");

const wanted = new Map();
const problems = [];
for (const [n, r] of rows.entries()) {
  const id = r[iId]?.trim();
  const raw = (r[iPrice] ?? "").trim().replace(/[₱,\s]/g, "");
  const line = n + 2;
  if (!id) { problems.push(`line ${line}: missing id`); continue; }
  if (raw === "") { problems.push(`line ${line}: ${id} has no price`); continue; }
  const pesos = Number(raw);
  if (!Number.isFinite(pesos) || pesos <= 0) { problems.push(`line ${line}: ${id} price "${r[iPrice]}" is not a positive number`); continue; }
  const centavos = Math.round(pesos * 100);
  // Compare with a tolerance: 4362.4 * 100 is 436239.99999999994 in binary
  // floating point, so an exact check cries wolf on perfectly good prices.
  if (Math.abs(pesos * 100 - centavos) > 1e-6) {
    problems.push(`line ${line}: ${id} price ${pesos} has sub-centavo precision; rounded to ${centavos / 100}`);
  }
  if (wanted.has(id)) { problems.push(`line ${line}: ${id} appears twice`); continue; }
  wanted.set(id, { centavos, name: iName >= 0 ? r[iName]?.trim() : undefined });
}

let catalog = readFileSync(CATALOG, "utf8");
const catalogIds = [...catalog.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);

for (const id of wanted.keys()) if (!catalogIds.includes(id)) problems.push(`unknown product id: ${id}`);
for (const id of catalogIds) if (!wanted.has(id)) problems.push(`missing from CSV: ${id}`);

const hard = problems.filter((p) => !p.includes("sub-centavo"));
if (hard.length) {
  console.error("Refusing to apply — fix these first:\n" + hard.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
problems.filter((p) => p.includes("sub-centavo")).forEach((p) => console.warn("  warning: " + p));

// --- rewrite the catalog -----------------------------------------------
const changes = [];
catalog = catalog.replace(/(\{ id: "([^"]+)"[^}]*?amount: )(\d+)/g, (full, head, id, oldAmt) => {
  const next = wanted.get(id).centavos;
  if (Number(oldAmt) !== next) changes.push({ id, from: Number(oldAmt), to: next });
  return head + next;
});

// --- rewrite the storefront bundle -------------------------------------
let bundle = readFileSync(BUNDLE, "utf8");
const nameToPesos = new Map();
for (const [id, v] of wanted) {
  const m = new RegExp(`\\{ id: "${id.replace(/[:.]/g, "\\$&")}", name: "([^"]+)"`).exec(catalog);
  if (m) nameToPesos.set(m[1], v.centavos / 100);
}

const whStart = bundle.search(/\bWh\s*=\s*\{/);
let braceAt = bundle.indexOf("{", whStart), depth = 0, whEnd = braceAt;
for (let k = braceAt; k < bundle.length; k++) {
  if (bundle[k] === "{") depth++;
  else if (bundle[k] === "}") { depth--; if (depth === 0) { whEnd = k + 1; break; } }
}
let wh = bundle.slice(braceAt, whEnd);
let bundleChanges = 0;
let renotated = 0;
wh = wh.replace(
  /(?:"([^"]+)"|([A-Za-z][\w$]*)|`([^`]+)`)\s*:\s*\{(buy:[^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
  (full, q, bare, tick, body) => {
    const name = q || bare || tick;
    if (!nameToPesos.has(name)) return full;
    const next = nameToPesos.get(name);
    // Write plain decimal notation. An earlier pass emitted scientific
    // notation (price:1.976e+06) which JS reads correctly but nobody can.
    const before = Number(/price:([0-9.e+]+)/.exec(body)?.[1]);
    const updated = body.replace(/price:[0-9.e+]+/, `price:${next.toFixed(2).replace(/\.00$/, "")}`);
    if (Math.abs(before - next) > 0.005) bundleChanges++;
    else if (updated !== body) renotated++;
    return full.replace(body, updated);
  }
);
bundle = bundle.slice(0, braceAt) + wh + bundle.slice(whEnd);

if (DRY) {
  console.log(`DRY RUN — ${changes.length} catalog changes, ${bundleChanges} bundle price changes` +
    (renotated ? `, ${renotated} reformatted to plain decimals` : ""));
} else {
  writeFileSync(CATALOG, catalog);
  writeFileSync(BUNDLE, bundle);
  console.log(`Applied: ${changes.length} catalog changes, ${bundleChanges} bundle price updates` +
    (renotated ? `, ${renotated} reformatted to plain decimals` : ""));
}

for (const c of changes.slice(0, 40)) {
  console.log(`  ${c.id.padEnd(20)} ₱${(c.from / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} -> ₱${(c.to / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
}
if (changes.length > 40) console.log(`  ... and ${changes.length - 40} more`);
console.log(`\nNow run: node scripts/verify-prices.mjs`);
