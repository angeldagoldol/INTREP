import { formatMoney, splitVat } from "../money.js";
import { config } from "../config.js";

// Builds the order notification. Plain data in, {subject, html, text} out —
// no I/O here, so it is trivially testable.

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

export { formatMoney } from "../money.js";

function addressLines(addr) {
  if (!addr) return [];
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean);
}

export function buildOrderEmail(order) {
  const {
    orderId, amountTotal, currency, customerName, customerEmail,
    items = [], shipping, createdAt, livemode,
    provider, paymentMethod, cardBrand, cardLast4, customerPhone,
  } = order;

  // "gcash" -> "GCash", "paymaya" -> "Maya", "card" -> "Card"
  const WALLETS = {
    gcash: "GCash", paymaya: "Maya", maya: "Maya", grab_pay: "GrabPay",
    qrph: "QR Ph", card: "Card", billease: "BillEase", dob: "Online banking",
    brankas_bdo: "BDO", brankas_landbank: "Landbank", brankas_metrobank: "Metrobank",
    link: "Link", paypal: "PayPal",
  };
  const method = paymentMethod ? (WALLETS[paymentMethod] || paymentMethod) : "";
  // A card without its brand and last four is hard to match against a payout
  // line, which is the one moment you actually need this.
  const cardTail = [cardBrand ? cardBrand.replace(/^./, (c) => c.toUpperCase()) : "", cardLast4 ? `\u2022\u2022${cardLast4}` : ""]
    .filter(Boolean).join(" ");
  const paidWith = [method, cardTail].filter(Boolean).join(" \u00b7 ");

  const PROVIDER_NAME = { paymongo: "PayMongo", stripe: "Stripe" };
  const via = PROVIDER_NAME[provider] || (provider === "paymongo" ? "PayMongo" : "Stripe");

  const mode = livemode ? "" : "[TEST] ";
  const subject = `${mode}${config.brand.name}: new order ${orderId} — ${formatMoney(amountTotal, currency)}`;

  const itemsNote = order.itemsError
    ? "Line items could not be retrieved from Stripe — open the order in the Stripe Dashboard."
    : "";

  // Philippine VAT applies to domestic sales. Export sales are zero-rated, so
  // an order shipping outside PH gets no VAT line rather than a wrong one.
  // Confirm the treatment with your accountant before filing on it.
  const shipCountry = (shipping?.address?.country || "").toUpperCase();
  const domestic = !shipCountry || shipCountry === "PH";
  const vatApplies = config.vat.rate > 0 && config.vat.inclusive && domestic;
  const vat = vatApplies ? splitVat(amountTotal, config.vat.rate) : null;

  const rows = items.map((it) => {
    const line = it.amountTotal ?? (it.unitAmount || 0) * (it.quantity || 1);
    return { ...it, line };
  });

  const textLines = [
    `${mode}New order`,
    ``,
    `Order:    ${orderId}`,
    `Placed:   ${createdAt}`,
    `Total:    ${formatMoney(amountTotal, currency)}${vat ? " (VAT inclusive)" : ""}`,
    ...(vat
      ? [`  net of VAT   ${formatMoney(vat.net, currency)}`,
         `  ${config.vat.label.padEnd(12)} ${formatMoney(vat.vat, currency)}`]
      : []),
    ...(!domestic && config.vat.rate > 0
      ? [`  (export sale to ${shipCountry} — zero-rated for PH VAT)`]
      : []),
    `Customer: ${customerName || "(not given)"} <${customerEmail || "no email"}>`,
    ...(customerPhone ? [`Phone:    ${customerPhone}`] : []),
    ...(paidWith ? [`Paid with: ${paidWith} (${via})`] : [`Paid with: (not reported by ${via})`]),
    ``,
    `Items`,
    ...(rows.length
      ? rows.map((r) => `  ${r.quantity} x ${r.description} — ${formatMoney(r.line, currency)}`)
      : [`  (${itemsNote || "no line items"})`]),
  ];
  const ship = addressLines(shipping?.address);
  if (ship.length) {
    textLines.push(``, `Ship to`, `  ${shipping?.name || ""}`.trimEnd(), ...ship.map((l) => `  ${l}`));
  }
  if (!livemode) {
    textLines.push(``, `This is a ${via} TEST order. No real money moved.`);
  }

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f4;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14140f">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e2dc;border-radius:10px;padding:24px">
    ${livemode ? "" : `<p style="margin:0 0 16px;padding:8px 12px;background:#fff6e0;border:1px solid #e8d08a;border-radius:6px;font-size:13px">
      <strong>TEST order.</strong> ${via} test mode — no real money moved.</p>`}
    <h1 style="margin:0 0 4px;font-size:19px">New order</h1>
    <p style="margin:0 0 20px;color:#5b5951;font-size:13px">${escapeHtml(orderId)} &middot; ${escapeHtml(createdAt)}</p>

    <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tbody>
        ${itemsNote ? `<tr><td colspan="2" style="padding:8px 0;color:#b3261e;font-size:13px">${escapeHtml(itemsNote)}</td></tr>` : ""}
        ${(rows.length ? rows : []).map((r) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0efeb">
            <strong>${escapeHtml(r.description)}</strong>
            <span style="color:#5b5951"> &times; ${escapeHtml(r.quantity)}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f0efeb;text-align:right;white-space:nowrap">
            ${escapeHtml(formatMoney(r.line, currency))}
          </td>
        </tr>`).join("")}
        <tr>
          <td style="padding:12px 0;font-weight:600">Total${vat ? " <span style=\"font-weight:400;color:#5b5951;font-size:12px\">VAT inclusive</span>" : ""}</td>
          <td style="padding:12px 0;text-align:right;font-weight:600">${escapeHtml(formatMoney(amountTotal, currency))}</td>
        </tr>
        ${vat ? `<tr>
          <td style="padding:2px 0;color:#5b5951;font-size:13px">net of VAT</td>
          <td style="padding:2px 0;text-align:right;color:#5b5951;font-size:13px">${escapeHtml(formatMoney(vat.net, currency))}</td>
        </tr>
        <tr>
          <td style="padding:2px 0 8px;color:#5b5951;font-size:13px">${escapeHtml(config.vat.label)}</td>
          <td style="padding:2px 0 8px;text-align:right;color:#5b5951;font-size:13px">${escapeHtml(formatMoney(vat.vat, currency))}</td>
        </tr>` : ""}
        ${!domestic && config.vat.rate > 0 ? `<tr>
          <td colspan="2" style="padding:2px 0 8px;color:#5b5951;font-size:12px">
            Export sale to ${escapeHtml(shipCountry)} &mdash; zero-rated for PH VAT.</td>
        </tr>` : ""}
      </tbody>
    </table>

    <h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5b5951">Customer</h2>
    <p style="margin:0 0 16px">
      ${escapeHtml(customerName || "(name not given)")}<br>
      ${customerEmail ? `<a href="mailto:${escapeHtml(customerEmail)}">${escapeHtml(customerEmail)}</a>` : "(no email)"}
      ${customerPhone ? `<br>${escapeHtml(customerPhone)}` : ""}
    </p>
    <h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5b5951">Paid with</h2>
    <p style="margin:0 0 16px;padding:8px 12px;background:#f2f1ed;border-radius:6px;display:inline-block;font-size:14px">
      ${paidWith
        ? `<strong>${escapeHtml(paidWith)}</strong> <span style="color:#5b5951;font-size:12px">via ${escapeHtml(via)}</span>`
        : `<span style="color:#5b5951">Not reported by ${escapeHtml(via)} &mdash; check the dashboard for this order.</span>`}</p>

    ${ship.length ? `<h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5b5951">Ship to</h2>
    <p style="margin:0 0 16px">${[shipping?.name, ...ship].filter(Boolean).map(escapeHtml).join("<br>")}</p>` : ""}

    <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e4e2dc;color:#5b5951;font-size:12px">
      ${escapeHtml(config.brand.name)} &middot; sent automatically when ${escapeHtml(via)} confirmed payment.
    </p>
  </div>
</body></html>`;

  return { subject, html, text: textLines.join("\n") };
}
