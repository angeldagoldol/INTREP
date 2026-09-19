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
  // Kept in step with STOREFRONT_TITLE in scripts/build-storefront.mjs.
  var PAGE_TITLE = "dagoldol \u2014 Japanese electronics and apparel";

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

  /* The page ships with a learning-demo disclaimer that says the checkout
     charges nothing. Once STORE_ENDPOINT is set that sentence is false, and
     it is false to a customer on the page where they hand over money. Rewrite
     it, keeping the parts that stay true.

     React owns this node and re-renders it, so this re-applies on every
     mutation. It writes only when the text differs, so the observer settles
     instead of looping. */
  var LIVE_NOTE =
    "Company figures on this page are rounded from public sources and may have " +
    "changed, and nothing here is investment advice. Product prices and checkout " +
    "are live: you will be charged and the item will be shipped.";

  function brandDisclaimer() {
    if (!STORE_ENDPOINT) return;
    var note = document.querySelector(".footer-note");
    if (note && note.textContent !== LIVE_NOTE) note.textContent = LIVE_NOTE;
  }

  /* Policy links. Gated on STORE_ENDPOINT for the same reason checkout is:
     while it is empty there is no server hosting the pages, and a footer link
     to a 404 is worse than no link. Build them with `npm run legal:build`. */
  function brandLegal() {
    if (!STORE_ENDPOINT) return;
    var inner = document.querySelector(".footer-inner");
    if (!inner || inner.dataset.legal === "1") return;
    inner.dataset.legal = "1";

    var row = document.createElement("p");
    row.style.cssText = "margin:0;width:100%;order:101;font-size:var(--text-xs);" +
      "display:flex;gap:1rem;flex-wrap:wrap";

    [["Terms", "terms"], ["Refunds & returns", "refund-policy"], ["Privacy", "privacy-policy"]]
      .forEach(function (pair) {
        var a = document.createElement("a");
        a.href = STORE_ENDPOINT + "/legal/" + pair[1] + ".html";
        a.textContent = pair[0];
        a.rel = "noopener";
        // 24px minimum target, per WCAG 2.2 SC 2.5.8, without changing the
        // footer's own type scale.
        a.style.cssText = "color:inherit;display:inline-flex;align-items:center;min-height:24px";
        row.appendChild(a);
      });
    inner.appendChild(row);
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

  function renderEnquiry() {
    var actions = document.querySelector(".drawer-actions");
    if (!actions || !enquiryIds.length) return;

    var split = splitCart();
    var existing = document.getElementById("fh-enquiry");
    if (!split.enquiry.length) {           // nothing enquiry-only in the cart
      if (existing) existing.remove();
      return;
    }
    if (existing) return;                  // already rendered for this view

    var names = split.enquiry.map(function (r) {
      var p = catalogue[r.id];
      return (p ? p.name : r.id) + (r.quantity > 1 ? " \u00d7 " + r.quantity : "");
    }).join(", ");

    var total = split.enquiry.reduce(function (sum, r) {
      var p = catalogue[r.id];
      return sum + (p ? p.amount * r.quantity : 0);
    }, 0);

    var box = document.createElement("div");
    box.id = "fh-enquiry";
    box.style.cssText =
      "width:100%;margin-bottom:var(--space-3);padding:var(--space-3);" +
      "border:var(--border-hairline) solid var(--border);border-radius:var(--radius-md);" +
      "background:var(--surface-sunken)";
    box.innerHTML =
      '<p style="margin:0 0 var(--space-2);font-size:var(--text-sm)">' +
        "<strong>Vehicles are enquiry only.</strong> " + names +
        " cannot be bought through online checkout. Leave your details and we will " +
        "come back with availability, the final price including registration and " +
        "delivery, and how to pay.</p>" +
      '<p style="margin:0 0 var(--space-3);font-size:var(--text-xs);color:var(--text-faint)">' +
        "Indicative " + money(total) + "</p>" +
      '<div style="display:grid;gap:var(--space-2)">' +
        '<input id="fh-e-name"  type="text"  placeholder="Your name" maxlength="120" autocomplete="name">' +
        '<input id="fh-e-email" type="email" placeholder="Email" maxlength="200" autocomplete="email">' +
        '<input id="fh-e-phone" type="tel"   placeholder="Mobile (optional)" maxlength="40" autocomplete="tel">' +
        '<textarea id="fh-e-msg" rows="2" placeholder="Anything else? (optional)" maxlength="2000"></textarea>' +
      "</div>" +
      '<p id="fh-e-msgout" style="margin:var(--space-2) 0 0;font-size:var(--text-sm)" hidden></p>' +
      '<button id="fh-e-send" type="button" class="btn btn-primary" ' +
        'style="width:100%;margin-top:var(--space-3)">Send enquiry</button>';

    Array.prototype.forEach.call(box.querySelectorAll("input,textarea"), function (el) {
      el.style.cssText =
        "width:100%;min-height:44px;padding:var(--space-2);font:inherit;" +
        "font-size:var(--text-sm);border:var(--border-hairline) solid var(--border);" +
        "border-radius:var(--radius-sm);background:var(--surface);color:var(--text)";
    });

    box.querySelector("#fh-e-send").addEventListener("click", function () {
      sendEnquiry(split.enquiry, box);
    });

    actions.parentNode.insertBefore(box, actions);

    // Only offer payment if something in the cart can actually be paid for.
    var payBtn = reviewCta();
    if (payBtn) {
      if (split.payable.length) {
        payBtn.textContent = "Pay for the other " + split.payable.length +
          (split.payable.length === 1 ? " item" : " items");
      } else {
        payBtn.style.display = "none";
      }
    }
  }

  function sendEnquiry(items, box) {
    var out = box.querySelector("#fh-e-msgout");
    var btn = box.querySelector("#fh-e-send");
    var body = {
      name:  box.querySelector("#fh-e-name").value,
      email: box.querySelector("#fh-e-email").value,
      phone: box.querySelector("#fh-e-phone").value,
      message: box.querySelector("#fh-e-msg").value,
      items: items,
    };
    btn.disabled = true;
    btn.textContent = "Sending\u2026";
    out.hidden = true;

    fetch(STORE_ENDPOINT + "/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || "Server returned " + r.status);
        return d;
      }); })
      .then(function (d) {
        out.textContent = "Thank you \u2014 your enquiry is with us (" + d.ref +
          "). We will be in touch by email.";
        out.style.color = "";
        out.hidden = false;
        box.querySelector("[style*=grid]").style.display = "none";
        btn.style.display = "none";
      })
      .catch(function (err) {
        out.textContent = err.message;
        out.style.color = "var(--danger)";
        out.hidden = false;
        btn.disabled = false;
        btn.textContent = "Send enquiry";
      });
  }

  /* The page renders its own <title> from React, which replaces whatever the
     static head carried. Reassert ours — cheaply, since this runs on every
     mutation. The build stamps the same title statically for crawlers. */
  function brandTitle() {
    if (document.title !== PAGE_TITLE) document.title = PAGE_TITLE;
  }

  function applyBranding() { brandTitle(); brandDisclaimer(); brandFooter(); brandLegal(); brandWordmark(); }
  applyBranding();
  new MutationObserver(applyBranding).observe(document.documentElement, {
    childList: true, subtree: true,
  });

  /* -- 2. Checkout bridge. Only with an endpoint configured. --------------- */
  if (!STORE_ENDPOINT) return;       // demo mode: cart stays exactly as it is

  var CART_KEY = "fivehouses.cart";
  var busy = false;
  var providers = null;          // filled from /api/products
  var enquiryIds = [];           // products that cannot be bought online
  var catalogue = {};            // id -> product, for names and prices
  var currency = "php";
  var chosen = null;             // provider id the shopper picked

  // Ask the server which providers it can actually process, so the page never
  // offers a wallet that is not configured.
  fetch(STORE_ENDPOINT + "/api/products")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      providers = d.providers || {};
      enquiryIds = d.enquiry || [];
      catalogue = {};
      (d.products || []).forEach(function (p) { catalogue[p.id] = p; });
      currency = d.currency || "php";
      renderPicker();
      renderEnquiry();
    })
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

  function splitCart() {
    var cart = readCart();
    var enquiry = [], payable = [];
    cart.forEach(function (row) {
      (enquiryIds.indexOf(row.id) !== -1 ? enquiry : payable).push(row);
    });
    return { enquiry: enquiry, payable: payable };
  }

  function money(centavos) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: currency.toUpperCase(),
      }).format(centavos / 100);
    } catch (e) {
      return centavos / 100 + " " + currency.toUpperCase();
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
        "Prices include VAT. You will be taken to a secure payment page; card " +
        "and wallet details are never handled by this site.";
    }
    renderPicker();
    renderEnquiry();
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

      var cart = splitCart().payable;      // vehicles go through the form
      if (!cart.length) {
        setNotice("Nothing in your cart can be bought online.", true);
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
