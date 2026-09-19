// Append-only order log + webhook idempotency, backed by plain files.
//
// Deliberately dependency-free so this runs anywhere. For real volume, swap
// both functions for your database — the interface is only three calls.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const ORDERS_FILE = "data/orders.jsonl";
const ENQUIRIES_FILE = "data/enquiries.jsonl";
const EVENTS_FILE = "data/processed-events.json";
const MAX_REMEMBERED_EVENTS = 5000;

function ensureDir(file) {
  mkdirSync(dirname(file), { recursive: true });
}

export function recordOrder(order) {
  ensureDir(ORDERS_FILE);
  appendFileSync(ORDERS_FILE, JSON.stringify(order) + "\n", "utf8");
}

export function recordEnquiry(enquiry) {
  ensureDir(ENQUIRIES_FILE);
  appendFileSync(ENQUIRIES_FILE, JSON.stringify(enquiry) + "\n", "utf8");
}

function readEvents() {
  if (!existsSync(EVENTS_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(EVENTS_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt file: prefer a possible duplicate email over a crash
  }
}

/**
 * Stripe retries webhooks (and can deliver the same event more than once).
 * Without this, one payment can send you several emails.
 * @returns {boolean} true if this event has already been handled
 */
export function alreadyProcessed(eventId) {
  return readEvents().includes(eventId);
}

export function markProcessed(eventId) {
  ensureDir(EVENTS_FILE);
  const events = readEvents();
  if (events.includes(eventId)) return;
  events.push(eventId);
  writeFileSync(
    EVENTS_FILE,
    JSON.stringify(events.slice(-MAX_REMEMBERED_EVENTS)),
    "utf8"
  );
}
