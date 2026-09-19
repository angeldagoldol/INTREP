// Dump the current catalog as an editable CSV.
//   node scripts/export-prices.mjs > prices.csv
import { listProducts } from "../src/catalog.js";

const rows = [["id", "sku", "name", "brand", "mode", "price_php"]];
for (const p of listProducts()) {
  rows.push([p.id, p.sku, p.name, p.brand, p.mode, (p.amount / 100).toFixed(2)]);
}

const esc = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
console.log(rows.map((r) => r.map(esc).join(",")).join("\n"));
