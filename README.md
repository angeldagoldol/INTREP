# INTREP Store — Stripe checkout with order notifications

A small, dependency-light Node server that takes real card payments through
Stripe Checkout and emails you the moment an order is paid.

Built because a published Claude artifact is a static page: it has no server
and nowhere safe to keep a secret key, so it cannot take payments or send mail.
This can.

```
Browser ──POST /api/checkout──▶ Server ──▶ Stripe Checkout (hosted, PCI on Stripe)
                                                  │
                                            customer pays
                                                  │
              order email ◀── Server ◀──POST /api/stripe/webhook (signed)
```

## Why it is built this way

**Prices live on the server.** The browser sends only product ids and
quantities; `src/catalog.js` supplies every price. If the client could send an
amount, anyone could buy a £329 item for 1p from devtools. Try it — the extra
field is simply never read.

**Fulfilment happens on the webhook, never the redirect.** A customer can open
`/success.html` directly, or close the tab before it loads. Only Stripe's
server-to-server call is proof of payment, and it is signature-verified, so a
stranger cannot forge "you got paid" emails.

**Webhooks are deduplicated.** Stripe retries. Without `src/orders.js` tracking
event ids, one payment could email you four times.

**An order is never lost to a flaky API call.** Fetching line items is a second
Stripe request; if it fails, the order is still recorded and emailed with a note
telling you to check the Dashboard.

**An email failure never fails the webhook.** Returning non-2xx would make
Stripe retry a payment already handled. Failures are logged loudly instead, and
the order is safe in `data/orders.jsonl`.

## Setup

```bash
npm install
cp .env.example .env     # then fill it in
npm start
```

### 1. Stripe keys
Dashboard → Developers → API keys. Use `sk_test_…` until you are ready.
Put it in `STRIPE_SECRET_KEY`.

### 2. Webhook secret
Locally:
```bash
npm install -g stripe    # or: brew install stripe/stripe-cli/stripe
stripe login
npm run stripe:listen    # prints whsec_… → STRIPE_WEBHOOK_SECRET
```
In production: Dashboard → Developers → Webhooks → **Add endpoint** →
`https://yourdomain.com/api/stripe/webhook`, event `checkout.session.completed`.
Copy that endpoint's signing secret — it differs from the CLI one.

### 3. Order emails
Pick one:

- **Resend** (easiest): sign up, create an API key, set `RESEND_API_KEY`. The
  default `EMAIL_FROM=onboarding@resend.dev` sends to your own address with no
  domain setup. To send from your own domain, verify it in Resend first.
- **SMTP / Gmail**: set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`,
  `SMTP_USER=you@gmail.com`, `SMTP_PASS=<App Password>`. Gmail requires an
  [App Password](https://myaccount.google.com/apppasswords) with 2-Step
  Verification on — your normal password will not work.

If neither is set the server still runs and records orders; it just warns.

**Do this too, it is free:** Stripe Dashboard → Settings → Notifications →
enable "Successful payments". That emails you per order with no code at all,
and is a good backstop if this server is ever down.

### 4. Your catalog
Edit `src/catalog.js`. Amounts are in the **smallest currency unit** —
`32900` is £329.00. Set your real SKUs and agreed reseller prices.

### 5. Legal pages
Fill in every `[BRACKETED]` field in `legal/`, then serve and link them.
They are drafts, not legal advice — have them reviewed.

## Testing

```bash
npm start
npm run stripe:listen     # separate terminal
```
Open http://localhost:3000, add an item, pay with `4242 4242 4242 4242`,
any future expiry, any CVC. You should get an email and a line in
`data/orders.jsonl`.

Other test cards: `4000 0000 0000 9995` declines, `4000 0025 0000 3155`
requires 3D Secure.

## Going live

- [ ] Swap `sk_test_…` for `sk_live_…` and use the **live** webhook secret
- [ ] Serve over HTTPS and set `PUBLIC_BASE_URL` to the real domain
- [ ] Set real prices and SKUs in `src/catalog.js`
- [ ] Complete every legal page and link them from the footer and checkout
- [ ] Confirm your reseller agreement covers online sale of these brands
- [ ] Move orders from `data/orders.jsonl` to a real database
- [ ] Keep `.env` out of git (already in `.gitignore`)
- [ ] Configure tax — Stripe Tax, or your own rates
- [ ] Decide shipping countries in `src/routes/checkout.js`

## Layout

```
server.js                    Express app. Webhook mounts BEFORE express.json()
src/config.js                Env loading + fail-fast validation
src/catalog.js               Server-side price authority
src/orders.js                Order log + webhook idempotency
src/email.js                 Resend or SMTP
src/templates/orderEmail.js  Email rendering (pure, testable)
src/routes/checkout.js       Creates Checkout Sessions
src/routes/webhook.js        Verifies signature, records order, emails you
public/                      Minimal reference storefront
legal/                       Policy templates to complete
```

## Security notes

- `.env` is gitignored. Never commit keys. If one leaks, roll it in the
  Dashboard immediately.
- The webhook route uses `express.raw` and is mounted before `express.json()`.
  Reversing that order breaks signature verification.
- Stripe errors are logged server-side and never returned to the browser.
- `data/` is gitignored — it holds customer names and addresses.
