# Keeping displayed prices and charged prices in step

**This is now automated. Use the scripts.**

```bash
npm run prices:export     # prices.csv from the current catalog
$EDITOR prices.csv        # edit price_php only
npm run prices:apply      # updates src/catalog.js AND storefront/index.html
npm run prices:verify     # fails loudly if they disagree
```

`src/catalog.js` is the price authority; the storefront's displayed prices are
generated from it. Editing either alone is how they drift, and drift means
charging a number the customer did not agree to.

## What apply refuses

The whole file is rejected — never half-applied — if any product is missing
from the CSV, unknown, duplicated, blank, non-numeric or negative.

## What verify catches

- A displayed price that differs from the charged price
- A product missing from the storefront
- A payable product below PayMongo's ₱100 minimum
- A non-integer or non-positive amount

It exits non-zero, so put it in your deploy pipeline.

## Doing it by hand

If you must: prices live in the minified `Wh` shop map as `price:<pesos>`,
keyed by product name. The product formatter is `$h` (renders `₱`). A second
formatter, `tg`, renders company financials in trillions of yen — leave that
one alone. Write plain decimals, not scientific notation.
