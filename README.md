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

### Parallel imports

A parallel importer buys at RETAIL in the source market, not wholesale, so a
typed `cost_php` is fiction. Give `jp_price_jpy`, `freight_php`, `duty_pct` and
`fx_rate` instead and `src/landedCost.js` computes the real cost through
Japanese tax-free export, FX, freight, PH duty and import VAT.

It also refuses to price a line that lands above what the brand's own local
stores charge:

```
line 21: fastretailing:3 lands at ₱1,848.26 net but the market sells it at
₱1,490.00 — every sale would lose ₱517.90. Drop the line, or set
active:false in src/catalog.js
```

That is not a pricing problem and no markup fixes it. See PRICING.md.

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

## Legal pages

Three policies — Terms, Refunds and Returns, Privacy — written for a
Philippine seller shipping worldwide. They are **templates**: your identity
facts live in `.env` and never in git, because this repository is public and
an address or TIN in its history cannot be taken back.

```bash
npm run legal:build      # -> public/legal/*.html, served at /legal/terms etc.
```

**The build refuses to run while a required fact is blank**, and names each
one. A page that reads `TIN {{TIN}}` is worse than no page: it tells a
customer, and the DTI, that nobody checked.

Everything the pages say about the store itself — who takes the money, which
countries you ship to, the VAT rate, the return window — is read from your
config, so a policy cannot drift from what the code actually does.

Once built, the storefront footer links them automatically (whenever
`STORE_ENDPOINT` is set in `public/store-bridge.js`).

**If you are not registered yet, that is the blocker, not the wording.**
RA 11967 requires an online merchant to be identifiable; the BIR requires a
receipt for every sale. See `legal/README.md`.

## Stock, sales and funds

A dashboard at `/admin.html`, behind a bearer token. Set one first:

```bash
ADMIN_TOKEN=$(openssl rand -hex 24)      # put it in .env
```

Then open `http://localhost:3000/admin.html?token=YOUR_ADMIN_TOKEN` once. The
page moves the token into `sessionStorage` and scrubs it out of the address
bar, so it is not left sitting in your browser history — but it is still in
that first request line, so treat any access log as holding a secret, and
roll the token if one leaks.

**Three questions, three charts.**

| | reads | moved by |
|---|---|---|
| Funds | running total, **net of VAT** | confirmed payments |
| Sales | revenue per day, VAT-inclusive | confirmed payments |
| Stock | units on hand per line | payments, and you |

Funds is **net of VAT but gross of cost of goods — it is not profit.** The
order log does not carry what you paid for the item, so the dashboard cannot
know your margin and does not guess at one. For margin, use
`npm run prices:breakdown`.

Days are **Asia/Manila** days, not UTC ones — set `REPORT_TIMEZONE` to change
that. On UTC every sale made before 8am local would be filed under the day
before.

### Setting stock

Nothing knows what you have until you say so:

```bash
curl -X POST http://localhost:3000/api/admin/stock \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":"sony:0","units":4}'
```

From then on a **confirmed payment** takes units out — never a checkout
session, because most sessions are never paid and reserving against them
would hide stock that is still on the shelf. Stock floors at zero and logs
`[stock] OVERSOLD ...` rather than going negative, so an oversell shows up as
something to go and fix instead of quietly poisoning every total after it.

Cars are listed too, at `0` until you set them. They are enquiry lines, so no
checkout ever drains them — move those by hand.

Stock lives in `data/stock.json`, which is gitignored along with the rest of
`data/`.

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

For the dashboard, set `ADMIN_TOKEN`, POST a few stock lines, then put a test
order through. The funds line, the day's revenue and that product's stock
should all move together. Until the first paid order the charts say so rather
than drawing a flat line at zero.

## Deploying

Two halves, two hosts, and the split is not arbitrary.

| | Where | Why |
|---|---|---|
| Storefront | **Vercel** | A 2.8MB static file. A CDN is exactly what it wants. |
| API + dashboard + legal pages | **Render or Railway** | Needs a **disk**. See below. |

### Why the API cannot go on Vercel

Orders, enquiries, stock levels and the record of which webhooks were already
handled are all files. Vercel runs each request on a serverless instance whose
filesystem is read-only apart from `/tmp`, and `/tmp` is private to that
instance and wiped when it recycles.

That is not a cosmetic problem. Two orders paid seconds apart land on two
instances, and neither one can see the other's:

```
  instance A: recorded cs_alpha, stock set to 4
  instance B: recorded cs_beta,  stock set to 9
  instance A: sees 1 order, stock sony:0 = 4
  instance B: sees 1 order, stock sony:0 = 9
```

Worse, `processed-events.json` is what stops a retried webhook being handled
twice. Lose it and one payment can email you repeatedly and decrement stock
more than once.

If you ever do want everything on Vercel, the fix is a database, not a config
flag: `src/orders.js` and `src/inventory.js` are the only two files that
touch storage, which is why they are that small.

### 1. The API first — it has the URL everything else needs

**Render**: New → Blueprint → pick this repo. It reads `render.yaml`, which
asks for a 1GB disk mounted at `/var/data` and sets `DATA_DIR` to match.

> Render's **free** tier has no disks, so the blueprint asks for Starter.
> Railway's free tier does have volumes — mount one and set `DATA_DIR` to its
> mount path. Any host works as long as `DATA_DIR` points at a real disk.

Fill in the secrets Render marks as unset — payment keys, `NOTIFY_EMAIL`,
`ADMIN_TOKEN`, and the legal facts from `legal/README.md`. The build runs
`npm run legal:build`, so **a missing legal fact fails the deploy**, on
purpose.

Then set:

- `PUBLIC_BASE_URL` — your API's own https URL
- `ALLOWED_ORIGINS` — your Vercel URL, **not** `*`

Point your PayMongo webhook at `https://YOUR-API/api/paymongo/webhook`.

### Your own product photos

The storefront ships with Wikimedia Commons photos as placeholders. To use
your own, drop a JPEG into `storefront/products/` **with the same filename**
and rebuild — see `storefront/products/README.md` for the full list of 28 and
what each one shows.

The build works out which are yours by hash and **removes the stock
photographer's credit from those**. That is not cosmetic: the page prints each
photo's author and CC licence underneath it, and leaving that under your own
photograph credits a stranger for your work and claims a Creative Commons
licence over it. Replace a file and its credit becomes `Photo: dagoldol`; put
the stock file back and the original attribution returns. Nothing to maintain
by hand.

### 2. The storefront

Vercel → Add New → Project → import this repo. It reads `vercel.json` and runs
`npm run storefront:build`.

Set one environment variable:

- `STORE_API_URL` — the API URL from step 1, https only

Then redeploy. The build:

- re-inlines `public/store-bridge.js` into the bundle, so the copy embedded in
  `storefront/index.html` cannot drift out of date (it already had);
- stamps `STORE_ENDPOINT`, so the bundle in git stays a demo that charges
  nothing;
- stamps a real `<title>` and Open Graph tags — the bundle renders its title
  from React, so without this a crawler or a shared link sees an untitled page.

**Leave `STORE_API_URL` unset and the deploy takes no payments**, and the
page keeps its "the checkout is a demo" notice. Set it and the bridge replaces
that notice, because once checkout is live it is a false statement made to a
customer on the page where they pay.

### 3. Check it

```bash
curl https://YOUR-API/healthz                 # {"ok":true}
curl https://YOUR-API/legal/terms.html        # your real details, no [BRACKETS]
```

Open the Vercel URL, add something to the basket, and check the footer links
to your policies. Then put one real low-value order through and confirm the
email arrives, the dashboard moves, and stock goes down.

## Going live

- [ ] Swap `sk_test_…` for `sk_live_…` and use the **live** webhook secret
- [ ] Serve over HTTPS and set `PUBLIC_BASE_URL` to the real domain
- [ ] Set real prices and SKUs in `src/catalog.js`
- [ ] Set `ALLOWED_ORIGINS` to your storefront origin, not `*`
- [ ] Check `CURRENCY` against `src/money.js` — JPY is zero-decimal
- [ ] Register with DTI (or SEC), then BIR — nothing below works without it
- [ ] Fill the legal facts in `.env` and run `npm run legal:build`
- [ ] Have a Philippine lawyer review the built pages
- [ ] Confirm your reseller agreement covers online sale of these brands
- [ ] Run one PayMongo test order to confirm the Checkout Session fields
- [ ] Replace the placeholder PHP prices — they are a flat JPY conversion
- [ ] Move orders and enquiries from `data/*.jsonl` to a real database
- [ ] Set `ADMIN_TOKEN` to a random secret and set your opening stock levels
- [ ] Set `TRUST_PROXY=1` if deploying behind a load balancer
- [ ] Point `DATA_DIR` at a mounted disk, and confirm data survives a redeploy
- [ ] Keep `.env` out of git (already in `.gitignore`)
- [ ] Configure tax — Stripe Tax, or your own rates
- [ ] Decide shipping countries in `src/routes/checkout.js`

## Layout

```
server.js                    Express app. Webhook mounts BEFORE express.json()
src/config.js                Env loading + fail-fast validation
src/catalog.js               Server-side price authority (25 products, PHP)
src/money.js                 Zero-decimal currency handling + VAT split
src/pricing.js               cost -> markup -> VAT forward pricing
src/landedCost.js            parallel-import landed cost (JP retail -> PH shelf) (JPY!)
src/cors.js                  Cross-origin access for the storefront
src/orders.js                Order log + webhook idempotency
src/inventory.js             Stock levels; decremented on confirmed payment
src/email.js                 Resend or SMTP
src/templates/orderEmail.js  Email rendering (pure, testable)
src/routes/checkout.js       Creates Checkout Sessions
src/routes/webhook.js        Verifies signature, records order, emails you
src/routes/metrics.js        Dashboard API, bearer-token gated, no CORS
scripts/build-legal.mjs      Renders legal/*.md -> public/legal/*.html
scripts/build-storefront.mjs Builds dist/index.html for the static host
vercel.json                  Storefront build config (static host)
render.yaml                  API blueprint — the DISK is the point
public/                      Minimal reference storefront
public/store-bridge.js       Artifact cart -> this server (off by default)
public/admin.html            Stock / sales / funds dashboard
legal/                       Policy TEMPLATES; facts come from .env
public/legal/                Rendered policies — GITIGNORED, holds your address
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
- `data/` is gitignored — it holds customer names, addresses and stock levels.
- `/api/admin/*` needs `ADMIN_TOKEN` and is mounted **before** the CORS
  middleware, so no other origin can read your numbers. It returns 503 rather
  than serving anything if no token is set.
- The dashboard page itself is public; only the data behind it is gated. It
  carries `noindex`.
- The legal pages are rendered from `.env`, never committed. They carry your
  registered address and TIN, and this repository is public.
