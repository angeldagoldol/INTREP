# Where these prices came from

**They are placeholders.** Realistic for the Philippine market, but not your
agreed reseller prices. Replace them before selling — see "Changing prices" in
the README.

Checked in September 2026. Car prices in particular move with every model year.

## Grounded in a published PH price (12)

| Product | Price | Source |
|---|---|---|
| PlayStation 5 | ₱40,032 | Official Sony PH SRP from 1 May 2026, up from ₱30,790 |
| WH-1000XM5 | ₱16,999 | Authorised sellers list ₱15,999–₱16,999 |
| HEATTECH crew neck | ₱590 | Uniqlo PH shelf price |
| Ultra Light Down | ₱3,990 | Uniqlo PH shelf price |
| UT graphic tee | ₱790 | Uniqlo PH shelf price |
| Fleece full-zip | ₱1,490 | Uniqlo PH shelf price |
| Round Mini Shoulder Bag | ₱990 | Uniqlo PH shelf price |
| Corolla Altis | ₱1,213,000 | Base 1.8 E CVT; range runs to ₱1,761,000 |
| RAV4 | ₱2,183,000 | Base 2.5 Adventure HEV CVT; range to ₱2,499,000 |
| Land Cruiser LC300 | ₱5,758,000 | Base variant; top variant ₱5,773,000 |
| Honda Civic | ₱1,600,000 | Base V Turbo CVT Sensing; range to ₱2,010,000 |
| Nissan X-Trail | ₱2,290,000 | e-Power, single variant |

## Market estimates (13)

Either not sold in the Philippines, or no single published SRP. Treat these as
ballpark and replace them first.

| Product | Price | Basis |
|---|---|---|
| PlayStation 5 Pro | ₱56,990 | Scaled from the PS5 SRP at the US $699/$499 ratio |
| DualSense controller | ₱3,990 | Typical PH authorised-retailer price |
| Alpha α7 series | ₱144,999 | a7 IV body only, PH retail band |
| BRAVIA | ₱54,999 | Mid-range 55-inch 4K, PH retail band |
| Prius | ₱2,650,000 | Not currently in the Toyota PH line-up |
| bZ4X | ₱3,190,000 | PH launch pricing band |
| Mirai | ₱4,850,000 | Not sold in PH; import-indicative |
| N-BOX | ₱950,000 | Kei car, not sold in PH; import-indicative |
| Vezel | ₱1,550,000 | Sold in PH as the HR-V |
| Super Cub C125 | ₱169,000 | PH retail |
| Sakura | ₱1,250,000 | Kei EV, not sold in PH; import-indicative |
| Note e-POWER | ₱1,350,000 | Not currently in the Nissan PH line-up |
| Serena | ₱2,150,000 | Not currently in the Nissan PH line-up |

## Notes

Vehicles are **enquiry-only**, so their prices are never charged — they appear
as "indicative" in the form and the enquiry email. Only the 11 payable items
are billed, and those are the ones to get exactly right.

Cars are shown at their lowest trim, which is what the page already says.

None of these include registration, insurance or freight.

## Uniqlo: parallel import, and two lines dropped

Uniqlo is parallel imported, so there is no wholesale price. The cost basis is
Japanese retail plus the cost of getting it here — computed in
`src/landedCost.js`, not typed in:

```
JP shelf price (incl. 10% consumption tax)
  less that tax, reclaimed on tax-free export
  x FX 0.41/yen (buying rate; mid-market was 0.3986)
  + freight and handling          = CIF
  + 15% PH customs duty           = landed, pre-VAT
  + 12% PH VAT                    = landed cost
```

| Line | JP | Landed net | Shelf | Margin | |
|---|---|---|---|---|---|
| Line | JP | Weight | Freight | Landed net | Shelf | Margin |
|---|---|---|---|---|---|---|
| HEATTECH | ¥590 | 0.15 kg | ₱22.50 | ₱416.77 | ₱590 | **20.9%** |
| Ultra Light Down | ¥5,990 | 0.30 kg | ₱45.00 | ₱2,757.29 | ₱3,990 | **22.6%** |
| Round Mini Shoulder Bag | ¥1,500 | 0.25 kg | ₱37.50 | ₱824.08 | ₱990 | **6.8%** |
| UT | ¥1,500 | 0.18 kg | — | ₱812.00 | ₱790 | **−15.1%** dropped |
| Fleece | ¥3,990 | 0.45 kg | — | ₱1,925.88 | ₱1,490 | **−44.8%** dropped |

Sea consolidated at ₱150/kg actual weight plus ₱120/unit handling (brokerage,
documentation, warehousing, last mile).

**Freight mode is the business decision, not a detail.** By air at ₱550/kg
with volumetric weight, four of the five lose money — HEATTECH drops to
−4.2%, Fleece to −86.5%. Only Ultra Light Down survives, at 15.2%. Sea takes
40–60 days and needs you to hold stock; air does not, and there is no margin
left to pay for it.

**The Shoulder Bag at 6.8% is thin enough to be FX risk, not profit.** The yen
moved between ₱0.3949 and ₱0.48135 over 52 weeks:

| FX | Margin |
|---|---|
| 0.3949 | 9.4% |
| 0.4100 | 6.8% |
| 0.4400 | 1.4% |
| 0.4814 | **−5.9%** |

**UT and Fleece are set `active: false`.** Uniqlo runs its own stores in the
Philippines and prices below what a parallel import can land at. Fleece lost
₱517.90 a unit; it would need ₱2,957 for a 30% margin against a ₱1,490 shelf
price, so it cannot be priced out of the loss. Both now link to uniqlo.com
instead of offering a cart button.

Three things stop a dropped line being sold: the shop offers no add-to-cart,
the app filters it out of a cart it finds in storage, and `buildLineItems()`
rejects it at checkout.

Re-activate only if the landed cost changes — cheaper freight, a weaker yen, or
buying on Japanese sale. `npm run prices:apply` refuses a loss-making active
line and prints the shortfall.

## VAT and margin

These are **VAT-inclusive** shelf prices — the 12% is already inside them.
`npm run prices:breakdown` shows the split per item. A PS5 at ₱40,032 is
₱35,742.86 net plus ₱4,289.14 VAT.

Your margin is not added on top. You buy below SRP and sell at or near it, and
the gap is the margin. Adding 12% and a markup to an SRP would double-count
the tax and price you above the shelf, which loses the sale rather than
earning anything.

Export sales are zero-rated for PH VAT, so overseas orders show no VAT line.
