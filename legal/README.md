# Legal pages — TEMPLATES, NOT LEGAL ADVICE

Drafts for a **Philippines-based seller shipping worldwide**. Have a Philippine
lawyer read the built pages before you take a real payment.

## How these work

The three `.md` files here are **templates**. Your identity facts live in
`.env`, and `npm run legal:build` renders them into `public/legal/*.html`,
which the store serves at `/legal/terms`, `/legal/refund-policy` and
`/legal/privacy-policy`.

Nothing identifying is committed. This repository is **public**, and a home
address or TIN pushed into its history cannot be taken back — so the rendered
pages are gitignored and only the templates are tracked.

**The build refuses to run while a required fact is blank.** That is the point
of it: a page reading `TIN {{TIN}}` tells a customer, and the DTI, that nobody
checked.

```bash
npm run legal:build
```

## What you must put in `.env`

| Variable | What goes there |
|---|---|
| `LEGAL_BUSINESS_NAME` | Registered name (DTI sole proprietorship, or SEC corporation) |
| `BUSINESS_REG_TYPE` | `dti` or `sec` — picks the right label on the page |
| `BUSINESS_REG_NO` | DTI Business Name certificate no., or SEC registration no. |
| `BUSINESS_TIN` | BIR Taxpayer Identification Number |
| `BUSINESS_ADDRESS` | Full registered address |
| `RETURN_ADDRESS` | Where goods come back to (defaults to the above) |
| `SUPPORT_EMAIL` | A monitored address |
| `SUPPORT_PHONE` | Mobile is normal and expected in PH |
| `DPO_NAME` | Your Data Protection Officer — a **named person**, not a role address |
| `JURISDICTION_CITY` | Whose courts hear a dispute. Normally where you are registered |
| `COURIERS` | Who carries your parcels. RA 10173 needs them named |

Everything else the pages need — which payment providers take the money, which
countries you ship to, the VAT rate, the return window — is already in your
config, and the build reads it from there so the pages cannot drift from what
the store actually does.

## Register first

If you are not registered yet, **that is the blocker, not the wording.**

- **RA 11967** (Internet Transactions Act of 2023) requires an online merchant
  to be identifiable. A page that cannot name its seller does not comply.
- **BIR** requires an official receipt or sales invoice for every sale. You
  cannot issue one without a TIN and registered receipts.
- Taking money before either is a problem no policy page fixes.

DTI registration for a sole proprietorship is quick and cheap
(bnrs.dti.gov.ph). BIR registration follows it.

## Philippine law these drafts assume

- **RA 7394** — Consumer Act of the Philippines. Defective goods, warranties
  and deceptive sales practices.
- **RA 11967** — Internet Transactions Act of 2023. Online merchants must be
  identifiable and disclose terms clearly; the DTI can act against
  non-compliant sellers.
- **RA 8792** — E-Commerce Act, gives electronic contracts legal effect.
- **RA 10173** — Data Privacy Act of 2012, enforced by the **National Privacy
  Commission**. If you process personal data of a meaningful number of people
  you may need to register your DPO with the NPC.
- **BIR rules** — an official receipt or sales invoice for every sale, kept
  10 years.

## Two choices already made in these drafts

**One return window for everyone: 14 days.** Philippine law gives no general
change-of-mind right for online purchases; the EU and UK give 14 days. Matching
the highest means one policy instead of two, and it is a selling point rather
than a cost. Change it with `RETURN_WINDOW_DAYS`.

**Parallel imports are disclosed.** Where you buy genuine goods abroad rather
than through a brand's Philippine distributor, that distributor is not obliged
to service them. The Terms and the Refund Policy say so and commit **you** to
honouring the equivalent warranty. Selling a parallel import while implying
local warranty cover is exactly the kind of misdescription RA 7394 is about.

## Still to do yourself

- Have a Philippine lawyer review the built pages.
- Check the delivery estimates against a courier quote — `DELIVERY_ESTIMATE_PH`
  and `DELIVERY_ESTIMATE_INTL` are placeholders until you have one.
- Pick a **domestic** courier. `COURIERS` currently names international
  carriers only, and the main market is the Philippines.
- Confirm your reseller agreements cover online sale of each brand you list.
