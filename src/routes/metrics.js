import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";
import { getProduct } from "../catalog.js";
import { splitVat } from "../money.js";
import { stockReport, setStock } from "../inventory.js";

/**
 * Read the order log. It is append-only JSONL, so a half-written final line
 * after a crash is possible — skip it rather than failing the whole dashboard.
 */
const ORDERS_FILE = join(config.dataDir, "orders.jsonl");

function readOrders() {
  if (!existsSync(ORDERS_FILE)) return [];
  const out = [];
  for (const line of readFileSync(ORDERS_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* truncated tail */ }
  }
  return out;
}

// Orders are logged as "2026-09-19 01:23 UTC". A Philippine seller thinks in
// Manila days, and Manila is UTC+8 — bucketing on the UTC prefix would file
// every sale made before 8am local under the previous day.
const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: config.report.timezone,
  year: "numeric", month: "2-digit", day: "2-digit",
});

/** "2026-09-19 01:23 UTC" -> the local report day, or null if unparseable. */
function dayOf(order) {
  const s = String(order.createdAt || "").trim();
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s);
  if (!m) return /^(\d{4}-\d{2}-\d{2})/.test(s) ? s.slice(0, 10) : null;
  const t = new Date(`${m[1]}T${m[2]}:00Z`);
  return Number.isNaN(t.getTime()) ? null : dayFmt.format(t);
}

/** The last n report days, oldest first, in the reporting timezone. */
function reportDays(n) {
  const days = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) days.push(dayFmt.format(new Date(now - i * 86400000)));
  return days;
}

export function metricsRouter() {
  const router = express.Router();

  // Business numbers are not public. A bearer token is the minimum; put this
  // behind your own auth if the dashboard is ever exposed beyond you.
  router.use((req, res, next) => {
    const want = config.admin.token;
    if (!want) {
      return res.status(503).json({ error: "ADMIN_TOKEN is not set on this server" });
    }
    const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.query.token;
    if (got !== want) return res.status(401).json({ error: "Unauthorized" });
    next();
  });

  router.get("/admin/metrics", (req, res) => {
    const windowDays = Math.min(180, Math.max(7, Number(req.query.days) || 30));
    const rate = config.vat.rate;
    const orders = readOrders();
    const days = reportDays(windowDays);
    const byDay = new Map(days.map((d) => [d, { revenue: 0, net: 0, units: 0, orders: 0 }]));
    const first = days[0];

    // All-time and in-window are tracked separately and labelled separately on
    // the dashboard. One number standing in for the other is how a dashboard
    // ends up quietly wrong.
    const all = { revenue: 0, vat: 0, units: 0, orders: 0 };
    const win = { revenue: 0, vat: 0, units: 0, orders: 0 };
    let openingNet = 0;                 // net of VAT banked before the window
    const perProduct = new Map();

    for (const o of orders) {
      const day = dayOf(o);
      const amount = Number(o.amountTotal) || 0;
      const { net, vat } = splitVat(amount, rate);
      const units = (o.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);

      all.revenue += amount; all.vat += vat; all.units += units; all.orders += 1;

      const bucket = day && byDay.get(day);
      if (bucket) {
        // The day's net is the SUM of each order's net, never the net of the
        // day's total: round once per order in both places or the funds line
        // and the funds tile disagree by a centavo on a busy day.
        bucket.revenue += amount; bucket.net += net; bucket.units += units; bucket.orders += 1;
        win.revenue += amount; win.vat += vat; win.units += units; win.orders += 1;
      } else if (day && day < first) {
        openingNet += net;              // ISO dates sort lexicographically
      }

      for (const i of o.items || []) {
        const key = i.description || "unknown";
        const prev = perProduct.get(key) || { units: 0, revenue: 0 };
        prev.units += Number(i.quantity) || 0;
        prev.revenue += Number(i.amountTotal) || 0;
        perProduct.set(key, prev);
      }
    }

    const stock = stockReport({ lowAt: Number(req.query.lowAt) || 5 });
    const stockUnits = stock.reduce((s, r) => s + r.units, 0);
    const stockRetail = stock.reduce((s, r) => s + r.units * r.amount, 0);

    // The funds line is a running balance, so it starts at what was already
    // banked before the window rather than dropping to zero mid-history.
    let running = openingNet;
    const series = days.map((d) => {
      const b = byDay.get(d);
      running += b.net;
      return { day: d, revenue: b.revenue, units: b.units, orders: b.orders, fundsNet: running };
    });

    res.json({
      currency: config.currency,
      timezone: config.report.timezone,
      windowDays,
      generatedAt: new Date().toISOString(),
      // Funds: cash in, less the VAT that is not yours to keep. Cost of goods
      // is not in the order log, so this is gross of COGS and labelled as such
      // — calling it profit would be a lie the dashboard repeats daily.
      funds: {
        revenueGross: all.revenue,
        vatCollected: all.vat,
        netOfVat: all.revenue - all.vat,
        openingNet,
        note: "Net of VAT, gross of cost of goods. Not profit.",
      },
      window: {
        revenueGross: win.revenue,
        vatCollected: win.vat,
        netOfVat: win.revenue - win.vat,
        orders: win.orders,
        units: win.units,
      },
      sales: { series, totalOrders: all.orders, totalUnits: all.units },
      stock: { rows: stock, totalUnits: stockUnits, retailValue: stockRetail },
      topProducts: [...perProduct.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
    });
  });

  // express.json() is already mounted globally, so the body is parsed by the
  // time this runs.
  router.post("/admin/stock", (req, res) => {
    const { productId, units } = req.body || {};
    if (!getProduct(productId)) return res.status(400).json({ error: `Unknown product: ${productId}` });
    const n = Number(units);
    if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: "units must be a non-negative integer" });
    res.json({ ok: true, productId, units: setStock(productId, n) });
  });

  return router;
}
