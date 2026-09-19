// Write prices.csv from the current catalog, preserving any cost and markup
// columns already there.
//
//   node scripts/export-prices.mjs          -> prices.csv (in place)
//   node scripts/export-prices.mjs --stdout -> print instead
//
// prices.csv is gitignored: cost_php is your wholesale cost and this repo is
// public. Never commit it.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { listProducts } from "../src/catalog.js";

const FILE = "prices.csv";
const toStdout = process.argv.includes("--stdout");

// Keep whatever the existing file knows that the catalog does not.
const keep = new Map();
if (existsSync(FILE)) {
  const lines = readFileSync(FILE, "utf8").trim().split("\n");
  const head = lines.shift().split(",").map((h) => h.trim().toLowerCase());
  const iId = head.indexOf("id");
  const iCost = head.indexOf("cost_php");
  const iMarkup = head.indexOf("markup_pct");
  const iSrp = head.indexOf("srp_php");
  if (iId !== -1) {
    for (const l of lines) {
      const f = l.split(",");
      keep.set(f[iId]?.trim(), {
        cost: iCost !== -1 ? f[iCost] : "",
        markup: iMarkup !== -1 ? f[iMarkup] : "",
        srp: iSrp !== -1 ? f[iSrp] : "",
      });
    }
  }
}

const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const rows = [["id", "sku", "name", "brand", "mode", "cost_php", "markup_pct", "srp_php", "price_php"]];
for (const p of listProducts()) {
  const prev = keep.get(p.id) || {};
  rows.push([p.id, p.sku, p.name, p.brand, p.mode,
    prev.cost ?? "", prev.markup ?? "", prev.srp ?? "", (p.amount / 100).toFixed(2)]);
}

const csv = rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
if (toStdout) {
  process.stdout.write(csv);
} else {
  writeFileSync(FILE, csv);
  const kept = [...keep.values()].filter((v) => v.cost).length;
  console.log(`  wrote ${FILE} (${rows.length - 1} products)` +
    (kept ? `, preserving ${kept} cost figures` : ""));
  console.log("  reminder: prices.csv is gitignored — it holds your wholesale costs.");
}
