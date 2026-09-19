# Keeping displayed prices and charged prices in step

`src/catalog.js` is the price authority. The artifact's displayed prices were
generated from it, so the two agree to the centavo. They can drift if you edit
either alone.

When you change prices, change `src/catalog.js` first, then regenerate the
artifact's copy:

1. The artifact keeps its prices in the minified `Wh` shop map, as
   `price:<pesos>` keyed by product name.
2. The product price formatter is `$h`, which renders `₱` with two decimals.
   A second formatter, `tg`, renders company financials in trillions of yen —
   leave that one alone.
3. Convert each catalog `amount` (centavos) to pesos by dividing by 100 and
   write it into the matching `Wh` entry.

Check afterwards by putting a known basket in the cart and comparing the
drawer subtotal against what the server computes for the same basket:

```js
const c = await import("./src/catalog.js");
const li = c.buildLineItems([{id:"toyota:3",quantity:1}], "php");
li.reduce((s,l) => s + l.price_data.unit_amount * l.quantity, 0);  // centavos
```

They must match exactly. If they do not, a customer is being charged something
other than the number they read.
