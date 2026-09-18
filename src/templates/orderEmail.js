// Builds the order notification. Plain data in, {subject, html, text} out —
// no I/O here, so it is trivially testable.

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

export function formatMoney(amountMinor, currency) {
  const major = (Number(amountMinor) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: String(currency || "GBP").toUpperCase(),
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${String(currency).toUpperCase()}`;
  }
}

function addressLines(addr) {
  if (!addr) return [];
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean);
}

export function buildOrderEmail(order) {
  const {
    orderId, amountTotal, currency, customerName, customerEmail,
    items = [], shipping, createdAt, livemode,
  } = order;

  const mode = livemode ? "" : "[TEST] ";
  const subject = `${mode}New order ${orderId} — ${formatMoney(amountTotal, currency)}`;

  const itemsNote = order.itemsError
    ? "Line items could not be retrieved from Stripe — open the order in the Stripe Dashboard."
    : "";

  const rows = items.map((it) => {
    const line = it.amountTotal ?? (it.unitAmount || 0) * (it.quantity || 1);
    return { ...it, line };
  });

  const textLines = [
    `${mode}New order`,
    ``,
    `Order:    ${orderId}`,
    `Placed:   ${createdAt}`,
    `Total:    ${formatMoney(amountTotal, currency)}`,
    `Customer: ${customerName || "(not given)"} <${customerEmail || "no email"}>`,
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
    textLines.push(``, `This is a Stripe TEST order. No real money moved.`);
  }

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f4;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14140f">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e2dc;border-radius:10px;padding:24px">
    ${livemode ? "" : `<p style="margin:0 0 16px;padding:8px 12px;background:#fff6e0;border:1px solid #e8d08a;border-radius:6px;font-size:13px">
      <strong>TEST order.</strong> Stripe test mode — no real money moved.</p>`}
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
          <td style="padding:12px 0;font-weight:600">Total</td>
          <td style="padding:12px 0;text-align:right;font-weight:600">${escapeHtml(formatMoney(amountTotal, currency))}</td>
        </tr>
      </tbody>
    </table>

    <h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5b5951">Customer</h2>
    <p style="margin:0 0 16px">
      ${escapeHtml(customerName || "(name not given)")}<br>
      ${customerEmail ? `<a href="mailto:${escapeHtml(customerEmail)}">${escapeHtml(customerEmail)}</a>` : "(no email)"}
    </p>

    ${ship.length ? `<h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5b5951">Ship to</h2>
    <p style="margin:0 0 16px">${[shipping?.name, ...ship].filter(Boolean).map(escapeHtml).join("<br>")}</p>` : ""}

    <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e4e2dc;color:#5b5951;font-size:12px">
      Sent automatically when Stripe confirmed payment.
    </p>
  </div>
</body></html>`;

  return { subject, html, text: textLines.join("\n") };
}
