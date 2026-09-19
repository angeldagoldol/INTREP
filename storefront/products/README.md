# Product photos

Drop your own photograph in here **using the same filename** and run
`npm run storefront:build`. Nothing else to change.

## What happens when you replace one

`stock-photos.json` records the sha256 of every photo shipped with this
storefront. A file whose hash no longer matches is **yours**, and the build
removes the stock photographer's credit from it automatically.

That matters. These are Wikimedia Commons images under CC BY-SA or CC0, and
the page prints each one's author and licence beneath it. Leave that in place
under your own photograph and you are crediting a stranger for your work and
claiming a Creative Commons licence over it. The build will not let that
happen, and there is no list to keep in step by hand.

- Replace a photo → its credit becomes `Photo: dagoldol`
- Put the stock file back → the original attribution returns

The build also refuses to run if a photo the page asks for is missing, so you
cannot ship a shop full of empty cards by accident.

## Specifications

- **Format:** JPEG, keeping the same filename as the one you replace
- **Width:** 1280px or more — the shipped set is 1280px wide
- **Size:** under 500KB each. All 28 load on a phone, often on mobile data
- **Framing:** the product filling the frame on a plain background

## Worth replacing first

4 of the shipped photos are over 500KB, and one is not what its name
says:

- `sony-ps5.jpg` — 1030KB, and is actually a PNG file despite the .jpg name
- `fr-fleece.jpg` — 988KB
- `fr-heattech.jpg` — 541KB
- `sony-wh1000x.jpg` — 510KB

Browsers sniff image content, so the mislabelled one renders correctly
everywhere tested. Replacing it with a real JPEG removes both problems at once.

## The photos

| File | What it shows | Size | Weight |
|---|---|---|---|
| `fr-bag.jpg` | Round Mini Shoulder Bags in several colours on a Uniqlo store wall | 1×1 | 350KB |
| `fr-down.jpg` | Rows of Uniqlo down jackets in a store | 1280×960 | 381KB |
| `fr-fleece.jpg` | Fluffy Uniqlo fleece jackets on hangers | 1280×1700 | 988KB ⚠️ |
| `fr-heattech.jpg` | HEATTECH socks on a rack in a Uniqlo store | 1280×2123 | 541KB ⚠️ |
| `fr-ut.jpg` | A UT vending machine selling T-shirts packed in cans | 1280×1707 | 496KB |
| `honda-civic.jpg` | A white eleventh-generation Honda Civic hatchback | 1×1 | 324KB |
| `honda-hondajet.jpg` | A silver HondaJet taxiing at Hamburg Airport | 1×1 | 163KB |
| `honda-nbox.jpg` | A pale blue third-generation Honda N-BOX at a dealer | 1×1 | 344KB |
| `honda-supercub.jpg` | A blue and white Honda Super Cub C125 on display | 1×1 | 225KB |
| `honda-vezel.jpg` | A white second-generation Honda HR-V, sold in Japan as the Vezel | 1×1 | 230KB |
| `nissan-gtr.jpg` | A grey Nissan GT-R R35, 2017 facelift | 1×1 | 377KB |
| `nissan-note.jpg` | A silver third-generation Nissan Note e-POWER | 1×1 | 168KB |
| `nissan-sakura.jpg` | A white Nissan Sakura electric kei car in a showroom | 1×1 | 178KB |
| `nissan-serena.jpg` | A white sixth-generation Nissan Serena e-POWER Highway Star | 1×1 | 187KB |
| `nissan-xtrail.jpg` | A copper-orange fourth-generation Nissan X-Trail | 1×1 | 317KB |
| `sony-alpha.jpg` | A Sony Alpha 7 IV camera with a lens attached | 1280×854 | 124KB |
| `sony-bravia.jpg` | A Sony BRAVIA television on display at CES | 1280×853 | 186KB |
| `sony-dualsense.jpg` | A white and black DualSense wireless controller | 1×1 | 85KB |
| `sony-ps5.jpg` | A PlayStation 5 console standing upright with its controller | 1280×2318 | 1030KB ⚠️ |
| `sony-ps5-pro.jpg` | A PlayStation 5 Pro console | 1280×1800 | 132KB |
| `sony-sensors.jpg` | Sony Exmor CMOS image sensors on display at a trade show | 1280×720 | 175KB |
| `sony-wh1000x.jpg` | Sony WH-1000XM3 headphones folded in their case, an earlier generation of the line | 1280×1707 | 510KB ⚠️ |
| `toyota-bz4x.jpg` | A silver Toyota bZ4X electric SUV | 1280×725 | 289KB |
| `toyota-corolla.jpg` | A white Toyota Corolla Hybrid hatchback | 1280×647 | 212KB |
| `toyota-land-cruiser.jpg` | A white Toyota Land Cruiser 300 | 1280×683 | 164KB |
| `toyota-mirai.jpg` | A blue second-generation Toyota Mirai | 1280×653 | 261KB |
| `toyota-prius.jpg` | A white fifth-generation Toyota Prius | 1280×688 | 255KB |
| `toyota-rav4.jpg` | A silver Toyota RAV4 plug-in hybrid | 1280×766 | 225KB |

`honda-hondajet.jpg`, `sony-sensors.jpg` and `nissan-gtr.jpg` are not sellable
products — they illustrate the company sections rather than the shop. Replace
them only if you want to.
