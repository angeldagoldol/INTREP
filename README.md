# dagoldol — store

Authorised reseller. Based in the Philippines, shipping worldwide.

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


## Payments: two providers, by design

Your main market is the Philippines, and that drives the split.

| Market | Provider | Methods |
|---|---|---|
| **Philippines** (default) | **PayMongo** | GCash, Maya, card |
| International | Stripe | Visa, Mastercard, Amex |

**Why both:** Stripe works in the Philippines but does not reliably support
GCash, Maya or QR Ph — and that is where local volume is (GCash ~76M users,
Maya ~47M). A PH store on cards alone loses a large share of customers at
checkout. PayMongo covers the wallets; Stripe covers the rest of the world.

Either can run alone. Set only `PAYMONGO_SECRET_KEY` and the server boots
PayMongo-only; set only the Stripe pair and it boots Stripe-only. It refuses
to start with neither. `/api/products` reports which are live, so the
storefront only ever offers a provider the server can process.

### PayMongo setup

1. Dashboard → Developers → API Keys. Copy the **secret** key into
   `PAYMONGO_SECRET_KEY` (start with `sk_test_`).
2. Register the webhook — PayMongo shows the secret **once**, so save it:

```bash
curl https://api.paymongo.com/v1/webhooks \
  -u "$PAYMONGO_SECRET_KEY:" \
  -H "Content-Type: application/json" \
  -d '{"data":{"attributes":{
        "url":"https://yourdomain.com/api/paymongo/webhook",
        "events":["checkout_session.payment.paid"]}}}'
```

3. Put the returned `secret_key` into `PAYMONGO_WEBHOOK_SECRET`.

PayMongo's minimum charge is **₱100**. Orders below it are rejected locally,
before the API call, with a message the customer can act on.

### A caveat on the PayMongo request shape

This sandbox blocks `api.paymongo.com` and `docs.paymongo.com`, so the
outbound call has **never been run against the live API**. The auth scheme,
the `{data:{attributes}}` envelope and the webhook signature algorithm were
taken from PayMongo's own Node SDK and are verified. The Checkout Session
*field names* come from secondary sources.

**Run one test-mode order before trusting it.** If a field name is wrong the
API returns a 400 naming it, and `src/paymongo.js` logs the detail verbatim.

### Pricing from cost (cost -> markup -> VAT)

`prices.csv` can price forward instead of taking `price_php` as given. Fill in
`cost_php` (what you pay the supplier, VAT inclusive) and `markup_pct`, and the
shelf price is computed:

```
cost_incl  --/1.12-->  cost_net  --x(1+markup)-->  sell_net  --x1.12-->  shelf
```

VAT comes off the cost before margin is applied — otherwise you earn margin on
the government's tax — and goes back on once, at the end.

**`cost_php` is your wholesale cost and this repository is public, so
`prices.csv` is gitignored.** `prices.example.csv` is the committed template,
with the cost column blank. `npm run prices:export` preserves any costs already
in your local file rather than wiping them.

**Markup is not margin**, and the two are routinely confused:

```
cost 100, sell 140   ->  markup 40%   ( profit / cost )
                         margin 28.6% ( profit / selling price )
```

The CSV takes markup; every report shows the resulting margin beside it.

**The SRP guard.** Put the market price in `srp_php` and a markup that computes
above it is refused outright:

```
line 12: sony:0 computes to ₱46,333.00 which is ABOVE its market SRP of
₱40,032.00 — lower the markup or renegotiate the cost
```

Only a sub-peso rounding overshoot is absorbed silently. Anything larger
surfaces, because quietly clamping a 25% markup down to 8% would hand back a
price that looks right while earning a third of what was asked for.

Shelf prices snap to whole pesos, so the chain cannot leave you selling a car
at ₱5,757,999.99.

```bash
npm run prices:breakdown    # price, net of VAT, VAT, cost, profit, margin
```

### VAT

Catalog prices are **VAT-inclusive shelf prices**, which is what Philippine
price tags are expected to show — the number the customer actually pays.

So VAT is **extracted** from a price, never added to one. Adding 12% to an SRP
would both double-count the tax and put you above the price a competitor
charges: a PS5 at ₱40,032 already contains ₱4,289.14 of VAT.

```bash
npm run prices:breakdown          # per-item table
node scripts/price-breakdown.mjs --csv   # for your accountant
```

The order and enquiry emails carry the split. It reconciles exactly: the net
is rounded and the VAT taken as the remainder, so the two always add back to
the amount charged — verified across 200,000 amounts. Rounding each half
independently leaves invoices a centavo out, which BIR paperwork notices.

**Export sales are zero-rated**, so an order shipping outside the Philippines
gets a zero-rated note instead of a VAT line. Confirm that treatment with your
accountant before filing on it.

Settings: `VAT_RATE` (default `0.12`, set `0` to switch the breakdown off),
`PRICES_INCLUDE_VAT` (default `true`), `VAT_LABEL` (default `VAT 12%`).

**Where your margin is.** It is not added here. You buy at wholesale below
SRP, sell at or near SRP, and the gap is your margin. Pricing above the
published SRP does not create margin, it just loses the sale.

### Changing prices

Never edit `src/catalog.js` and `storefront/index.html` separately. If they
drift, customers are charged a number other than the one they read.

```bash
npm run prices:export     # writes prices.csv from the current catalog
$EDITOR prices.csv        # edit the price_php column only
npm run prices:apply      # updates BOTH files
npm run prices:verify     # refuses to pass if they disagree
```

`prices.csv` has one row per product with `id, sku, name, brand, mode,
price_php`. Only `price_php` is read; the rest is there so the file is
readable. Pesos, not centavos — `27995.00` means ₱27,995.00. Currency symbols
and thousands separators are tolerated, so `"₱27,995.00"` works.

`prices:apply` refuses the whole file rather than applying half of it if any
product is missing, unknown, duplicated, blank, non-numeric or negative.

`prices:verify` exits non-zero on any mismatch, so it can gate a deploy. It
also catches a payable product priced below PayMongo's ₱100 floor, which
would otherwise fail at checkout in front of a customer.

### Vehicles are enquiry-only

`src/catalog.js` gives every product a `mode`:

| mode | Products | Path |
|---|---|---|
| `checkout` | 11 — Sony, Uniqlo | Paid online |
| `enquiry` | 14 — Toyota, Honda, Nissan | Enquiry form |

A PHP 1.9M Land Cruiser is roughly twenty times a GCash wallet limit, and
nobody buys a car through a payment button. Vehicles collect a lead instead.

The rule is enforced at the price authority, not in the UI: `buildLineItems()`
throws on an `enquiry` product, so no crafted request can put a car through
checkout. `/api/products` publishes the split so both front-ends render the
right control.

`POST /api/enquiry` takes `{name, email, phone, message, items}`, prices the
items from the catalog, saves the lead to `data/enquiries.jsonl` **before**
emailing, and replies with a reference. It is public and its job is to email
you, so it is rate limited to 5 per 10 minutes per client — applied *after*
validation, so a customer mistyping their address does not burn the quota.
Behind a proxy set `TRUST_PROXY=1` or the limiter sees the load balancer.

In the cart: vehicles only → the pay button is hidden and the form shown;
mixed cart → both, as "Send enquiry" and "Pay for the other N items".

### Currency

The storefront and this server both show and charge **Philippine pesos**, and
the numbers are generated from the same source: `src/catalog.js` is the price
authority, and the artifact's displayed prices were derived from it, so the
subtotal a customer reads is the amount they are charged, to the centavo.

Only the product prices moved to PHP. Company financials stay in yen, because
they are facts about Japanese companies — Honda's ¥1.1tn buyback, Nissan's
¥671bn loss, the ¥1,900 fleece of 1998. The page has two formatters and only
the product one was changed.

If you re-price, change `src/catalog.js` and regenerate the artifact's prices
from it. Do not edit the two independently, or they will drift apart and
customers will be charged something other than what they read.

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

## Connecting the storefront artifact

`public/store-bridge.js` connects the published "Five Houses of Japan" artifact
cart to this server. It is **off by default**:

```js
var STORE_ENDPOINT = "";   // empty = the page stays a demo, untouched
```

Set it to your deployed server (no trailing slash) and re-publish the artifact:

```js
var STORE_ENDPOINT = "https://store.yourdomain.com";
```

While it is empty, nothing runs: the cart still says "Place demo order" and
"Nothing was charged". Once set, the review step relabels itself to "Pay by
card", and clicking it POSTs the cart to `/api/checkout` and forwards the
customer to Stripe.

It reads the cart from `localStorage["fivehouses.cart"]`, which the artifact
already writes on every change, so it needs no access to React internals. Cart
ids (`"toyota:3"`) are the same ids used in `src/catalog.js` — that is why the
two cannot drift apart.

**Set `ALLOWED_ORIGINS`** to the artifact's origin before going live. The
browser will not let a page call this API cross-origin without it, and an
allowlist means only your storefront can create Checkout Sessions on your
Stripe account.

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
- [ ] Set `ALLOWED_ORIGINS` to your storefront origin, not `*`
- [ ] Check `CURRENCY` against `src/money.js` — JPY is zero-decimal
- [ ] Complete every legal page and link them from the footer and checkout
- [ ] Confirm your reseller agreement covers online sale of these brands
- [ ] Run one PayMongo test order to confirm the Checkout Session fields
- [ ] Register the business with DTI (or SEC) and get your BIR receipts in order
- [ ] Replace the placeholder PHP prices — they are a flat JPY conversion
- [ ] Move orders and enquiries from `data/*.jsonl` to a real database
- [ ] Set `TRUST_PROXY=1` if deploying behind a load balancer
- [ ] Keep `.env` out of git (already in `.gitignore`)
- [ ] Configure tax — Stripe Tax, or your own rates
- [ ] Decide shipping countries in `src/routes/checkout.js`

## Layout

```
server.js                    Express app. Webhook mounts BEFORE express.json()
src/config.js                Env loading + fail-fast validation
src/catalog.js               Server-side price authority (25 products, PHP)
src/money.js                 Zero-decimal currency handling + VAT split
src/pricing.js               cost -> markup -> VAT forward pricing (JPY!)
src/cors.js                  Cross-origin access for the storefront
src/orders.js                Order log + webhook idempotency
src/email.js                 Resend or SMTP
src/templates/orderEmail.js  Email rendering (pure, testable)
src/routes/checkout.js       Creates Checkout Sessions
src/routes/webhook.js        Verifies signature, records order, emails you
public/                      Minimal reference storefront
public/store-bridge.js       Artifact cart -> this server (off by default)
legal/                       Policy templates to complete (Philippine law)
storefront/index.html        The published storefront, branded, bridge included
scripts/                     prices export / apply / verify / breakdown
prices.example.csv           Committed template (no costs)
prices.csv                   Your working file — GITIGNORED, holds costs
```

## Security notes

- `.env` is gitignored. Never commit keys. If one leaks, roll it in the
  Dashboard immediately.
- The webhook route uses `express.raw` and is mounted before `express.json()`.
  Reversing that order breaks signature verification.
- Stripe errors are logged server-side and never returned to the browser.
- `data/` is gitignored — it holds customer names and addresses.
