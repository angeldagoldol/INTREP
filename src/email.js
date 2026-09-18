// Order-notification email with two interchangeable backends.
// Resend is tried first; otherwise SMTP (which covers Gmail, SendGrid,
// Mailgun, Postmark and anything else that speaks SMTP).
import { config } from "./config.js";

let sender = null;

async function getSender() {
  if (sender) return sender;

  if (config.email.resendApiKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(config.email.resendApiKey);
    sender = async ({ to, subject, html, text }) => {
      const { data, error } = await resend.emails.send({
        from: config.email.from,
        to: [to],
        subject,
        html,
        text,
      });
      if (error) throw new Error(`Resend: ${error.message || JSON.stringify(error)}`);
      return data?.id || "sent";
    };
    return sender;
  }

  if (config.email.smtp.host) {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.port === 465,
      auth: config.email.smtp.user
        ? { user: config.email.smtp.user, pass: config.email.smtp.pass }
        : undefined,
    });
    sender = async ({ to, subject, html, text }) => {
      const info = await transport.sendMail({
        from: config.email.from || config.email.smtp.user,
        to,
        subject,
        html,
        text,
      });
      return info.messageId;
    };
    return sender;
  }

  return null; // nothing configured
}

/**
 * Send one notification. Never throws — an email failure must not make the
 * webhook return non-2xx, or Stripe will retry a payment we already handled.
 * @returns {Promise<{ok:boolean, id?:string, reason?:string}>}
 */
export async function sendOrderNotification({ subject, html, text }) {
  try {
    const send = await getSender();
    if (!send) return { ok: false, reason: "no email provider configured" };
    const id = await send({ to: config.email.notify, subject, html, text });
    return { ok: true, id };
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  }
}
