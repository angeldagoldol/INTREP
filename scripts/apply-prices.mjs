// Apply prices from a CSV to BOTH the server catalog and the storefront
// bundle, then verify the two agree.
//
//   node scripts/apply-prices.mjs prices.csv
//   node scripts/apply-prices.mjs prices.csv --dry-run
//
// The two files must never be edited independently: if they drift, customers
// are charged a number other than the one they read.
import { readFileSync, writeFileSync } from "node:fs";
import { priceFromCost } from "../src/pricing.js";
import { landedCost, marginAtPrice } from "../src/landedCost.js";

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
const iId = col("id");
const iName = header.indexOf("name");

// Two ways to price. Forward (cost + markup -> VAT -> shelf price) wins when
// both columns are present; otherwise price_php is taken as given.
// Parallel imports: cost is COMPUTED from the source-market price plus the
// freight, duty and VAT of getting it here — not typed in as a wholesale
// figure that does not exist.
const iJpy = header.indexOf("jp_price_jpy");
const iFreight = header.indexOf("freight_php");
const iWeight = header.indexOf("weight_kg");
const iVolume = header.indexOf("volume_cm3");
const iMode = header.indexOf("freight_mode");
const iRate = header.indexOf("freight_rate");
const iHandling = header.indexOf("handling_php");
const iDuty = header.indexOf("duty_pct");
const iFx = header.indexOf("fx_rate");
const LANDED = iJpy !== -1 && (iFreight !== -1 || iWeight !== -1);

const iCost = header.indexOf("cost_php");
const iMarkup = header.indexOf("markup_pct");
const iSrp = header.indexOf("srp_php");
const FORWARD = (iCost !== -1 || LANDED) && iMarkup !== -1;
const iPrice = FORWARD ? header.indexOf("price_php") : col("price_php");
if (FORWARD) {
  console.log(LANDED
    ? "  pricing forward; cost from landed import where jp_price_jpy is given\n"
    : "  pricing forward from cost_php + markup_pct\n");
}

const wanted = new Map();
const problems = [];
for (const [n, r] of rows.entries()) {
  const id = r[iId]?.trim();
  const line = n + 2;
  if (!id) { problems.push(`line ${line}: missing id`); continue; }

  const num = (i) => Number((r[i] ?? "").trim().replace(/[₱,%\s]/g, ""));
  let pesos, derived = null;

  if (FORWARD) {
    let cost = iCost !== -1 ? num(iCost) : NaN;
    let landed = null;

    // A source-market price wins over a typed cost: it is the real basis.
    if (LANDED && Number.isFinite(num(iJpy)) && num(iJpy) > 0) {
      const fx = iFx !== -1 && num(iFx) > 0 ? num(iFx) : 0.41;
      try {
        const mode = iMode !== -1 ? (r[iMode] || "").trim().toLowerCase() || "sea" : "sea";
        landed = landedCost({
          jpyPrice: num(iJpy),
          fxRate: fx,
          // Weight beats a flat per-unit figure: consolidators bill per kilo,
          // and for apparel the volumetric weight usually decides it.
          weightKg: iWeight !== -1 && Number.isFinite(num(iWeight)) ? num(iWeight) : 0,
          volumeCm3: iVolume !== -1 && Number.isFinite(num(iVolume)) ? num(iVolume) : 0,
          mode,
          ratePerKg: iRate !== -1 && Number.isFinite(num(iRate)) ? num(iRate) : 0,
          handlingPhp: iHandling !== -1 && Number.isFinite(num(iHandling)) ? num(iHandling) : 0,
          freightPhp: iWeight !== -1 ? 0 : (Number.isFinite(num(iFreight)) ? num(iFreight) : 0),
          dutyPct: iDuty !== -1 && Number.isFinite(num(iDuty)) ? num(iDuty) : 15,
        });
        cost = landed.landedIncl / 100;
      } catch (e) { problems.push(`line ${line}: ${id} ${e.message}`); continue; }
    }

    const markup = num(iMarkup);
    if (!Number.isFinite(cost) || cost <= 0) { problems.push(`line ${line}: ${id} cost_php "${r[iCost]}" is not a positive number`); continue; }
    if (!Number.isFinite(markup) || markup < 0) { problems.push(`line ${line}: ${id} markup_pct "${r[iMarkup]}" is not a non-negative number`); continue; }
    const srpForCap = iSrp !== -1 ? num(iSrp) : 0;
    try {
      derived = priceFromCost({
        costInclVat: Math.round(cost * 100),
        markupPct: markup,
        capAt: Number.isFinite(srpForCap) && srpForCap > 0 ? Math.round(srpForCap * 100) : 0,
      });
    } catch (e) { problems.push(`line ${line}: ${id} ${e.message}`); continue; }
    if (landed) derived.landed = landed;
    pesos = derived.price / 100;

    // A parallel import can land above the price the brand's own local stores
    // charge. Selling there loses money on every unit, so say so loudly.
    if (landed && iSrp !== -1) {
      const srp = num(iSrp);
      if (Number.isFinite(srp) && srp > 0) {
        const m = marginAtPrice({ landedNet: landed.landedNet, shelfPrice: Math.round(srp * 100) });
        if (!m.viable) {
          problems.push(
            `line ${line}: ${id} lands at ₱${(landed.landedNet / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} net ` +
            `but the market sells it at ₱${srp.toLocaleString("en-US", { minimumFractionDigits: 2 })} — ` +
            `every sale would lose ₱${Math.abs(m.profit / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}. ` +
            `Drop the line, or set active:false in src/catalog.js`
          );
          continue;
        }
      }
    }

    // The whole point of the guard: never price above the market.
    if (iSrp !== -1) {
      const srp = num(iSrp);
      if (Number.isFinite(srp) && srp > 0 && derived.price > Math.round(srp * 100)) {
        problems.push(
          `line ${line}: ${id} computes to ₱${pesos.toLocaleString("en-US", { minimumFractionDigits: 2 })} ` +
          `which is ABOVE its market SRP of ₱${srp.toLocaleString("en-US", { minimumFractionDigits: 2 })} — ` +
          `lower the markup or renegotiate the cost`
        );
        continue;
      }
    }
  } else {
    const raw = (r[iPrice] ?? "").trim().replace(/[₱,\s]/g, "");
    if (raw === "") { problems.push(`line ${line}: ${id} has no price`); continue; }
    pesos = Number(raw);
  }
  if (!Number.isFinite(pesos) || pesos <= 0) { problems.push(`line ${line}: ${id} price "${r[iPrice]}" is not a positive number`); continue; }
  const centavos = Math.round(pesos * 100);
  // Compare with a tolerance: 4362.4 * 100 is 436239.99999999994 in binary
  // floating point, so an exact check cries wolf on perfectly good prices.
  if (Math.abs(pesos * 100 - centavos) > 1e-6) {
    problems.push(`line ${line}: ${id} price ${pesos} has sub-centavo precision; rounded to ${centavos / 100}`);
  }
  if (wanted.has(id)) { problems.push(`line ${line}: ${id} appears twice`); continue; }
  wanted.set(id, { centavos, name: iName >= 0 ? r[iName]?.trim() : undefined, derived });
}

let catalog = readFileSync(CATALOG, "utf8");
// Only ACTIVE products need a price. A deactivated line is not for sale, so
// demanding a row for it would block every apply until someone re-added a
// price nobody is going to charge.
const catalogIds = [...catalog.matchAll(/\{ id: "([^"]+)"[^}]*?active: (true|false)/g)]
  .filter((m) => m[2] === "true")
  .map((m) => m[1]);
const inactiveIds = [...catalog.matchAll(/\{ id: "([^"]+)"[^}]*?active: false/g)].map((m) => m[1]);
for (const id of inactiveIds) {
  if (wanted.has(id)) {
    console.warn(`  note: ${id} is inactive (not for sale); its row is ignored`);
    wanted.delete(id);
  }
}

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
  const row = wanted.get(id);
  if (!row) return full;              // inactive, or simply not in this CSV
  if (Number(oldAmt) !== row.centavos) changes.push({ id, from: Number(oldAmt), to: row.centavos });
  return head + row.centavos;
});

// --- rewrite the storefront bundle -------------------------------------
let bundle = readFileSync(BUNDLE, "utf8");
const nameToPesos = new Map();
for (const [id, v] of wanted) {
  const m = new RegExp(`\\{ id: "${id.replace(/[:.]/g, "\\$&")}", name: ("(?:[^"\\\\]|\\\\.)*")`).exec(catalog);
  if (!m) continue;
  // The catalog stores names with JS escapes ("Alpha \\u03b17 series") while the
  // bundle holds the literal character ("Alpha α7 series"). Decode before
  // matching, or every non-ASCII product silently fails to update.
  let name;
  try { name = JSON.parse(m[1]); } catch { name = m[1].slice(1, -1); }
  nameToPesos.set(name, v.centavos / 100);
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
const touched = new Set();
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
    touched.add(name);
    if (Math.abs(before - next) > 0.005) bundleChanges++;
    else if (updated !== body) renotated++;
    return full.replace(body, updated);
  }
);
bundle = bundle.slice(0, braceAt) + wh + bundle.slice(whEnd);

const unmatched = [...nameToPesos.keys()].filter((n) => !touched.has(n));
if (unmatched.length) {
  console.error(
    "\nRefusing to write — these products were not found in the storefront bundle:\n" +
      unmatched.map((n) => `  ${n}`).join("\n") +
      "\nApplying anyway would leave the storefront showing a different price " +
      "from the one charged."
  );
  process.exit(1);
}

if (DRY) {
  console.log(`DRY RUN — ${changes.length} catalog changes, ${bundleChanges} bundle price changes` +
    (renotated ? `, ${renotated} reformatted to plain decimals` : ""));
} else {
  writeFileSync(CATALOG, catalog);
  writeFileSync(BUNDLE, bundle);
  console.log(`Applied: ${changes.length} catalog changes, ${bundleChanges} bundle price updates` +
    (renotated ? `, ${renotated} reformatted to plain decimals` : ""));
}

if (FORWARD) {
  console.log("\n  cost -> markup -> VAT -> shelf price");
  for (const [id, v] of wanted) {
    if (!v.derived) continue;
    const d = v.derived;
    console.log(
      `    ${id.padEnd(18)} cost ₱${(d.costIncl / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }).padStart(13)}` +
      `  +${String(d.markupPct).padStart(5)}%  ->  ₱${(d.price / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }).padStart(13)}` +
      (d.landed ? `  [${d.landed.mode} ${d.landed.billedKg.toFixed(2)}kg` +
        ` freight ₱${(d.landed.freight/100).toFixed(2)}]` : "") +
      `   (margin ${d.marginPct.toFixed(1)}%` +
      (Math.abs(d.effectiveMarkupPct - d.requestedMarkupPct) > 0.05
        ? `, markup ${d.effectiveMarkupPct.toFixed(2)}% after rounding)` : ")")
    );
  }
  console.log();
}

for (const c of changes.slice(0, 40)) {
  console.log(`  ${c.id.padEnd(20)} ₱${(c.from / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} -> ₱${(c.to / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
}
if (changes.length > 40) console.log(`  ... and ${changes.length - 40} more`);
console.log(`\nNow run: node scripts/verify-prices.mjs`);
