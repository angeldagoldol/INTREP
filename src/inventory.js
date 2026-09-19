// Stock levels, and the money that falls out of them.
//
// Stock lives in data/stock.json, keyed by product id. It is decremented when
// a payment is confirmed — never when a checkout session is created, because
// most sessions are never paid and reserving against them would show stock you
// still have.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { getProduct, listProducts } from "./catalog.js";
import { config } from "./config.js";

const FILE = join(config.dataDir, "stock.json");

function read() {
  if (!existsSync(FILE)) return {};
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(data) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

export function getStock() {
  return read();
}

export function setStock(productId, units) {
  const data = read();
  data[productId] = Math.max(0, Math.round(Number(units) || 0));
  write(data);
  return data[productId];
}

/**
 * Take paid units out of stock. Floors at zero rather than going negative:
 * a negative count is a data error that then propagates into every total,
 * and overselling is a fulfilment problem to notice, not arithmetic to keep.
 * @returns {Array<{id:string, from:number, to:number, short:number}>}
 */
export function decrement(items = []) {
  const data = read();
  const moved = [];
  for (const it of items) {
    const id = it.productId || it.id;
    if (!id || !getProduct(id)) continue;
    const qty = Math.max(0, Math.round(Number(it.quantity) || 0));
    if (!qty) continue;
    const from = Number(data[id] ?? 0);
    const to = Math.max(0, from - qty);
    data[id] = to;
    moved.push({ id, from, to, short: Math.max(0, qty - from) });
  }
  if (moved.length) write(data);
  return moved;
}

/**
 * Stock rows for the dashboard, with a status band per line.
 *
 * Every active line is listed, enquiry lines (the cars) included — they are
 * stock you are holding even though no checkout drains them. Listing only the
 * payable ones would let POST /api/admin/stock accept a car and then never
 * show it again, which reads as data loss.
 */
export function stockReport({ lowAt = 5 } = {}) {
  const data = read();
  return listProducts()
    .map((p) => {
      const units = Number(data[p.id] ?? 0);
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        mode: p.mode,
        units,
        // good / warning / critical — always paired with an icon and a word in
        // the UI, never carried by colour alone.
        status: units === 0 ? "critical" : units <= lowAt ? "warning" : "good",
        amount: p.amount,
      };
    })
    .sort((a, b) => a.units - b.units || a.name.localeCompare(b.name)); // scarcest first: that is the story
}
