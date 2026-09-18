# Storefront

`index.html` is the published **Five Houses of Japan** page, as deployed, with
two additions already injected at the end of the document:

- **dagoldol branding** — header wordmark and footer. Always active.
- **Store bridge** — connects the cart to the checkout server in `../`.
  Inactive until you set `STORE_ENDPOINT`.

## Important: this is a build, not source

It is a 2.8 MB single file containing a minified React 19 + three.js r186 +
GSAP 3.15 + framer-motion bundle. The original project source (components,
JSX, the Vite config) was never in this repository, so this file is the only
copy that exists. **Do not lose it**, and prefer additive changes appended at
the end of the document over editing the bundle.

The 28 product photographs live in the published artifact's own file store,
not here. They are Wikimedia Commons images; every one carries its
photographer, licence and source page inside the bundle's data.

## Turning on real checkout

1. Deploy the server in the repository root and note its URL.
2. In this file find `var STORE_ENDPOINT = "";` near the bottom.
3. Set it: `var STORE_ENDPOINT = "https://store.yourdomain.com";`
4. Re-publish the file as the artifact.

The cart's wording changes itself: "Place demo order" becomes "Pay by card",
and the demo notice becomes a line about being taken to Stripe. Leave the
endpoint empty and the cart stays a demo that charges nothing.

## Layout note

The added footer lines sit above `.site-dock`, which is `position: fixed`.
The bridge sets a `padding-bottom` on the footer to clear it, including the
safe-area inset on phones. If you add more footer content, check it on a
phone-width viewport.
