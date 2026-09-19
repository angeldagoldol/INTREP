// Per-item VAT breakdown for the whole catalog.
//   node scripts/price-breakdown.mjs           table
//   node scripts/price-breakdown.mjs --csv     for your accountant
import { listProducts } from "../src/catalog.js";
import { formatMoney, splitVat } from "../src/money.js";
import { config } from "../src/config.js";

const csv = process.argv.includes("--csv");
const rate = config.vat.rate;
const rows = listProducts().map((p) => {
  const v = splitVat(p.amount, rate);
  return { ...p, net: v.net, vat: v.vat };
});

if (csv) {
  console.log("id,sku,name,mode,price_incl_vat,net_of_vat,vat");
  for (const r of rows) {
    console.log([r.id, r.sku, JSON.stringify(r.name), r.mode,
      (r.amount / 100).toFixed(2), (r.net / 100).toFixed(2), (r.vat / 100).toFixed(2)].join(","));
  }
} else {
  console.log(`\n  Prices are VAT-INCLUSIVE shelf prices. ${config.vat.label} extracted, not added.\n`);
  const show = (label, list) => {
    if (!list.length) return;
    console.log(`  ${label}`);
    console.log("    " + "PRODUCT".padEnd(30) + "PRICE".padStart(15) + "NET OF VAT".padStart(16) + "VAT".padStart(14));
    let t = 0, n = 0, v = 0;
    for (const r of list) {
      console.log("    " + r.name.padEnd(30) +
        formatMoney(r.amount, config.currency).padStart(15) +
        formatMoney(r.net, config.currency).padStart(16) +
        formatMoney(r.vat, config.currency).padStart(14));
      t += r.amount; n += r.net; v += r.vat;
    }
    console.log("    " + "".padEnd(30, "-") + "".padStart(15, "-") + "".padStart(16, "-") + "".padStart(14, "-"));
    console.log("    " + "if one of each".padEnd(30) +
      formatMoney(t, config.currency).padStart(15) +
      formatMoney(n, config.currency).padStart(16) +
      formatMoney(v, config.currency).padStart(14) + "\n");
  };
  show("PAYABLE ONLINE", rows.filter((r) => r.mode === "checkout"));
  show("ENQUIRY ONLY (indicative)", rows.filter((r) => r.mode === "enquiry"));
  console.log("  Export sales are zero-rated for PH VAT; the order email omits the VAT");
  console.log("  line when an order ships outside the Philippines.\n");
}
