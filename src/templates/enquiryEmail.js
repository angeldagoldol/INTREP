import { formatMoney, splitVat } from "../money.js";
import { config } from "../config.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * An enquiry is a sales lead, not an order: nothing is paid and nothing is
 * reserved. The email is written so you can reply to the customer directly.
 */
export function buildEnquiryEmail(enquiry) {
  const { ref, name, email, phone, message, items = [], currency, createdAt } = enquiry;

  const indicative = items.reduce((s, i) => s + (i.amount || 0) * (i.quantity || 1), 0);
  const vat = config.vat.rate > 0 && config.vat.inclusive ? splitVat(indicative, config.vat.rate) : null;
  const subject = `${config.brand.name}: vehicle enquiry from ${name || "a customer"} (${ref})`;

  const lines = [
    `New enquiry — nothing has been paid.`,
    ``,
    `Ref:      ${ref}`,
    `Received: ${createdAt}`,
    ``,
    `From:     ${name || "(no name)"}`,
    `Email:    ${email || "(none)"}`,
    ...(phone ? [`Phone:    ${phone}`] : []),
    ``,
    `Interested in`,
    ...items.map((i) => `  ${i.quantity} x ${i.name} — indicative ${formatMoney(i.amount * i.quantity, currency)}`),
    ``,
    `Indicative total: ${formatMoney(indicative, currency)}${vat ? " (VAT inclusive)" : ""}`,
    ...(vat
      ? [`  net of VAT   ${formatMoney(vat.net, currency)}`,
         `  ${config.vat.label.padEnd(12)} ${formatMoney(vat.vat, currency)}`]
      : []),
    ...(message ? [``, `Message`, ...message.split("\n").map((l) => `  ${l}`)] : []),
    ``,
    `Reply to ${email || "the customer"} to take it forward.`,
  ];

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f4;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14140f">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e2dc;border-radius:10px;padding:24px">
    <p style="margin:0 0 16px;padding:8px 12px;background:#eef4ff;border:1px solid #b9cdf2;border-radius:6px;font-size:13px">
      <strong>Enquiry, not an order.</strong> Nothing has been paid and nothing is reserved.</p>

    <h1 style="margin:0 0 4px;font-size:19px">Vehicle enquiry</h1>
    <p style="margin:0 0 20px;color:#5b5951;font-size:13px">${escapeHtml(ref)} &middot; ${escapeHtml(createdAt)}</p>

    <h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5b5951">From</h2>
    <p style="margin:0 0 20px">
      ${escapeHtml(name || "(no name given)")}<br>
      ${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : "(no email)"}
      ${phone ? `<br>${escapeHtml(phone)}` : ""}
    </p>

    <h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5b5951">Interested in</h2>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tbody>
        ${items.map((i) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0efeb">
            <strong>${escapeHtml(i.name)}</strong><span style="color:#5b5951"> &times; ${escapeHtml(i.quantity)}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f0efeb;text-align:right;white-space:nowrap">
            ${escapeHtml(formatMoney(i.amount * i.quantity, currency))}
          </td></tr>`).join("")}
        <tr><td style="padding:12px 0;font-weight:600">Indicative total</td>
            <td style="padding:12px 0;text-align:right;font-weight:600">${escapeHtml(formatMoney(indicative, currency))}</td></tr>
        ${vat ? `<tr><td style="padding:2px 0;color:#5b5951;font-size:13px">net of VAT</td>
            <td style="padding:2px 0;text-align:right;color:#5b5951;font-size:13px">${escapeHtml(formatMoney(vat.net, currency))}</td></tr>
        <tr><td style="padding:2px 0;color:#5b5951;font-size:13px">${escapeHtml(config.vat.label)}</td>
            <td style="padding:2px 0;text-align:right;color:#5b5951;font-size:13px">${escapeHtml(formatMoney(vat.vat, currency))}</td></tr>` : ""}
      </tbody>
    </table>

    ${message ? `<h2 style="margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#5b5951">Message</h2>
    <p style="margin:0 0 20px;white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}

    <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e4e2dc;color:#5b5951;font-size:12px">
      ${escapeHtml(config.brand.name)} &middot; prices are indicative and exclude registration, insurance and delivery.
    </p>
  </div>
</body></html>`;

  return { subject, html, text: lines.join("\n") };
}
