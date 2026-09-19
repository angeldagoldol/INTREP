/* ===========================================================================
   Store bridge — connects this page's cart to a real Stripe checkout.

   HOW TO TURN IT ON
   -----------------
   Set STORE_ENDPOINT below to your deployed store server, with no trailing
   slash, e.g. "https://store.yourdomain.com".

   While it is empty the CART behaves EXACTLY as it does today: a demo that
   charges nothing. That is deliberate — a page must never claim to take
   payment while pointing at nothing.

   The dagoldol branding below is NOT gated: it applies either way.

   The server is the price authority. This script sends only product ids and
   quantities; every amount is looked up server-side. Editing prices here, or
   in devtools, changes nothing about what is charged.
   =========================================================================== */
(function () {
  "use strict";

  var STORE_ENDPOINT = "";           // <-- your server, e.g. "https://store.example.com"
  var BRAND = "dagoldol";
  var TAGLINE = "Authorised reseller \u00b7 ships from the Philippines worldwide";

  /* -- 1. Branding. Runs always, with or without a checkout endpoint. ------ */
  function brandFooter() {
    var inner = document.querySelector(".footer-inner");
    if (!inner || inner.dataset.branded === "1") return;
    inner.dataset.branded = "1";

    var line = document.createElement("p");
    line.style.cssText = "margin:0;width:100%;order:99";
    var strong = document.createElement("strong");
    strong.textContent = BRAND;
    line.appendChild(strong);
    line.appendChild(document.createTextNode(" \u00b7 " + TAGLINE));
    inner.appendChild(line);

    // .site-dock is position:fixed at the bottom of the viewport, so extra
    // footer lines land underneath it. Clear it, allowing for the safe area
    // on phones with a home indicator.
    var footer = inner.closest("footer") || inner.parentElement;
    if (footer) {
      footer.style.paddingBottom =
        "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)";
    }

    var small = document.createElement("p");
    small.style.cssText = "margin:0;width:100%;order:100;font-size:var(--text-xs)";
    small.textContent =
      "\u00a9 " + new Date().getFullYear() + " " + BRAND +
      ". Product names and logos are the property of their respective owners " +
      "and are used for identification only.";
    inner.appendChild(small);
  }

  function brandWordmark() {
    var wm = document.querySelector(".wordmark");
    if (!wm || wm.dataset.branded === "1") return;
    wm.dataset.branded = "1";
    var by = document.createElement("span");
    by.className = "wordmark-by";
    by.style.cssText =
      "margin-left:var(--space-2);padding-left:var(--space-2);" +
      "border-left:1px solid var(--border);color:var(--text-muted);" +
      "font-weight:var(--weight-body);font-size:var(--text-sm)";
    by.textContent = BRAND;
    wm.appendChild(by);
  }

  function applyBranding() { brandFooter(); brandWordmark(); }
  applyBranding();
  new MutationObserver(applyBranding).observe(document.documentElement, {
    childList: true, subtree: true,
  });

  /* -- 2. Checkout bridge. Only with an endpoint configured. --------------- */
  if (!STORE_ENDPOINT) return;       // demo mode: cart stays exactly as it is

  var CART_KEY = "fivehouses.cart";
  var busy = false;
  var providers = null;          // filled from /api/products
  var chosen = null;             // provider id the shopper picked

  // Ask the server which providers it can actually process, so the page never
  // offers a wallet that is not configured.
  fetch(STORE_ENDPOINT + "/api/products")
    .then(function (r) { return r.json(); })
    .then(function (d) { providers = d.providers || {}; renderPicker(); })
    .catch(function () { providers = {}; });

  var WALLETS = { gcash: "GCash", paymaya: "Maya", grab_pay: "GrabPay", qrph: "QR Ph", card: "card" };

  function options() {
    if (!providers) return [];
    var out = [];
    if (providers.paymongo) {
      out.push({
        id: "paymongo",
        label: "Philippines",
        hint: (providers.paymongoMethods || []).map(function (m) { return WALLETS[m] || m; }).join(", "),
      });
    }
    if (providers.stripe) {
      out.push({ id: "stripe", label: "International card", hint: "Visa, Mastercard, Amex" });
    }
    return out;
  }

  // Insert a provider picker above the review step's buttons.
  function renderPicker() {
    var actions = document.querySelector(".drawer-actions");
    if (!actions || actions.dataset.picker === "1") return;
    var opts = options();
    if (opts.length === 0) return;
    actions.dataset.picker = "1";

    if (opts.length === 1) { chosen = opts[0].id; return; }
    if (!chosen) chosen = opts[0].id;

    var wrap = document.createElement("div");
    wrap.style.cssText =
      "display:flex;gap:var(--space-4);flex-wrap:wrap;margin-bottom:var(--space-3);width:100%";

    opts.forEach(function (o) {
      var label = document.createElement("label");
      label.style.cssText =
        "display:flex;align-items:center;gap:var(--space-2);min-height:44px;cursor:pointer;font-size:var(--text-sm)";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "fh-provider";
      input.value = o.id;
      input.checked = o.id === chosen;
      input.style.cssText = "width:20px;height:20px;accent-color:var(--accent)";
      input.addEventListener("change", function () { chosen = o.id; });
      var span = document.createElement("span");
      span.innerHTML = "";
      span.appendChild(document.createTextNode(o.label));
      var small = document.createElement("small");
      small.style.cssText = "display:block;color:var(--text-faint)";
      small.textContent = o.hint;
      span.appendChild(small);
      label.appendChild(input);
      label.appendChild(span);
      wrap.appendChild(label);
    });

    actions.parentNode.insertBefore(wrap, actions);
  }

  function readCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY));
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(function (r) { return r && typeof r.id === "string" && r.qty > 0; })
        .map(function (r) { return { id: r.id, quantity: Math.min(9, Math.max(1, r.qty | 0)) }; });
    } catch (e) {
      return [];
    }
  }

  // The review step is rendered fresh each time the drawer opens, so find the
  // live nodes on demand rather than caching references.
  function reviewCta() {
    var actions = document.querySelector(".drawer-actions");
    if (!actions) return null;
    return actions.querySelector(".btn-primary");
  }

  function setNotice(text, isError) {
    var note = document.querySelector(".demo-notice");
    if (!note) return;
    note.textContent = text;
    note.style.color = isError ? "var(--danger)" : "";
  }

  // Swap the demo wording for real-checkout wording whenever the review step
  // appears. Runs on every mutation because framer-motion remounts the drawer.
  function relabel() {
    var cta = reviewCta();
    if (cta && cta.dataset.storeBridge !== "1") {
      cta.dataset.storeBridge = "1";
      cta.textContent = "Pay by card";
    }
    var note = document.querySelector(".demo-notice");
    if (note && note.dataset.storeBridge !== "1") {
      note.dataset.storeBridge = "1";
      note.textContent =
        "You will be taken to a secure payment page. Card and wallet details " +
        "are never handled by this site.";
    }
    renderPicker();
  }

  new MutationObserver(relabel).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Capture phase so we run before React's own handler and can stop it.
  document.addEventListener(
    "click",
    function (ev) {
      var cta = reviewCta();
      if (!cta || !ev.target || !cta.contains(ev.target)) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (busy) return;

      var cart = readCart();
      if (!cart.length) {
        setNotice("Your cart is empty.", true);
        return;
      }

      busy = true;
      var original = cta.textContent;
      cta.textContent = "Contacting Stripe…";
      cta.disabled = true;

      fetch(STORE_ENDPOINT + "/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: cart, provider: chosen || undefined }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || "Server returned " + res.status);
            return data;
          });
        })
        .then(function (data) {
          if (!data.url) throw new Error("No checkout URL returned");
          window.location.assign(data.url);    // Stripe-hosted payment page
        })
        .catch(function (err) {
          busy = false;
          cta.disabled = false;
          cta.textContent = original;
          setNotice("Could not start checkout: " + err.message, true);
        });
    },
    true
  );
})();
