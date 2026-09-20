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

  /* The page still carries copy from before it became a real storefront:
     prices described as Japanese yen list prices, and a checkout described as
     a demo. The first is false whatever the build, because the catalogue is
     in Philippine pesos now. The second is true only while STORE_ENDPOINT is
     empty.

     This is done by sweeping text nodes rather than by selector, because the
     same claims appear in the shop header, an FAQ answer and the cart. Each
     rule rewrites its own source text, so once applied it no longer matches
     and the pass is idempotent. */
  var COPY_ALWAYS = [
    ["at approximate Japanese list prices (tax included)",
     "at Philippine retail prices, VAT included"],
    ["They are approximate Japanese list prices in yen, with 10% consumption tax included, rounded from 2025 announcements.",
     "They are Philippine retail prices in pesos, VAT included."],
  ];
  var COPY_WHEN_LIVE = [
    ["Checkout here is a demo; each product links to its official store.",
     "Vehicles are sold by enquiry; everything else can be bought here."],
    ["You can fill a cart and go through checkout, but it is a demo: no payment details are asked for, nothing is charged and nothing is shipped.",
     "You can fill a cart and check out for real: payment is taken by card, GCash or Maya on a secure page, and we ship the item."],
    [" No payment details are asked for and nothing is charged or shipped.",
     " Payment is taken on a secure page; this site never handles your card or wallet details."],
  ];

  function fixStaleCopy() {
    var rules = STORE_ENDPOINT ? COPY_ALWAYS.concat(COPY_WHEN_LIVE) : COPY_ALWAYS;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue;
      if (!text || text.length < 12) continue;
      var next = text;
      for (var i = 0; i < rules.length; i++) {
        if (next.indexOf(rules[i][0]) !== -1) next = next.split(rules[i][0]).join(rules[i][1]);
      }
      if (next !== text) node.nodeValue = next;
    }
  }

  /* The sweep walks every text node, so it is debounced rather than run on
     each mutation: React re-renders this page constantly. */
  var copyTimer = null;
  function scheduleCopyFix() {
    if (copyTimer) return;
    copyTimer = setTimeout(function () { copyTimer = null; fixStaleCopy(); }, 250);
  }

  /* ---- Scorecard detail -------------------------------------------------

     The scorecard prints five numbers — Funds 92, Supply 90 — and says only
     "Editorial scores out of 100". A number with no reasoning behind it is
     decoration; the reader cannot tell why Nissan scores 30 on income and
     Toyota 88.

     The page already answers that. Every company carries a paragraph for
     Funds, Supply, Demand and Marketing, and full revenue/operating/net
     figures for Income. It is all rendered in the Dossier, a long way from
     the scores it explains. The build lifts that data out of the bundle into
     SCORE_DETAIL below, and this puts it one tap from the number.

     A dialog rather than an inline expander: the scorecard sits in a bento
     card with overflow:hidden, which would clip the panel, and on a phone the
     card is too small for 300 words anyway. */
  var SCORE_DETAIL = {};

  var METRICS = ["funds", "supply", "demand", "income", "marketing"];
  var METRIC_LABEL = {
    funds: "Funds", supply: "Supply", demand: "Demand",
    income: "Income", marketing: "Marketing",
  };
  /* The one piece of text here that is not the page's own: a plain line
     saying what each score is measuring, which the page never states. */
  var METRIC_MEANS = {
    funds: "What the company is worth and how it pays for things.",
    supply: "How it gets parts, builds product and moves it.",
    demand: "Who is buying, where, and how hard.",
    income: "What it actually earns on what it sells.",
    marketing: "How the brand is built and spent.",
  };

  // The page's own formatters, so these figures read exactly as they do in
  // the Dossier: ¥48.0T, ¥836B-as-0.836T, and a real minus sign on a loss.
  function sign(v) { return v < 0 ? "−" : ""; }
  function tn(v) {
    if (v == null) return "n/a";
    var a = Math.abs(v);
    return sign(v) + "¥" + (a >= 10 ? a.toFixed(1) : a >= 1 ? a.toFixed(2) : a.toFixed(3)) + "T";
  }
  function pct(v) { return sign(v) + Math.abs(v * 100).toFixed(1) + "%"; }

  function companyFromCard(scoresEl) {
    // The grid that holds the scorecard also holds a "Shop <name>" button.
    // That name is the only identifier rendered anywhere near it.
    var host = scoresEl.closest(".card-grid") || scoresEl.parentElement;
    var btn = host && host.querySelector(".g-shop-btn");
    if (!btn) return null;
    var name = btn.textContent.replace(/^\s*Shop\s+/, "").trim();
    for (var id in SCORE_DETAIL) {
      if (SCORE_DETAIL[id].name === name) return SCORE_DETAIL[id];
    }
    return null;
  }

  function incomeHtml(co) {
    var i = co.income || {};
    var rows = [["Revenue", i.revenue], ["Operating income", i.operating], ["Net income", i.net]];
    var margins = i.operating == null
      ? "Net margin " + pct(i.net / i.revenue) +
        ". An investment holding company does not report a headline operating profit; " +
        "its results swing with the value of what it owns."
      : "Operating margin " + pct(i.operating / i.revenue) +
        ", net margin " + pct(i.net / i.revenue) + ".";
    var figs = rows.map(function (r) {
      return '<div class="fh-fig"><strong>' + esc(tn(r[1])) + "</strong><span>" + esc(r[0]) + "</span></div>";
    }).join("");
    return '<div class="fh-figs">' + figs + "</div><p>" + esc(co.fy) + ". " + esc(margins) + "</p>";
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* Styled from the page's own tokens, so the dialog follows its light/dark
     toggle without knowing anything about it. Every value has a fallback in
     case a token is renamed. */
  var SCORE_CSS = [
    ".fh-score-row{cursor:pointer;border-radius:6px;transition:background-color .12s}",
    ".fh-score-row:hover{background:var(--surface-sunken,#f2f1ed)}",
    ".fh-score-row:focus-visible{outline:2px solid var(--accent,#1b4d3e);outline-offset:2px}",

    ".fh-score-dlg{border:1px solid var(--border,#e4e2dc);border-radius:var(--radius-lg,16px);",
      "background:var(--surface,#fff);color:var(--text,#14140f);font-family:var(--font-sans,system-ui,sans-serif);",
      "padding:0;width:min(560px,calc(100vw - 32px));max-height:min(82vh,720px);overflow:hidden;",
      "display:flex;flex-direction:column;box-shadow:0 24px 60px #00000038}",
    ".fh-score-dlg::backdrop{background:#0b0b0acc}",

    ".fh-dlg-close-form{margin:0;position:absolute;top:10px;right:10px;z-index:2}",
    ".fh-dlg-close{min-width:40px;min-height:40px;border-radius:999px;border:1px solid var(--border,#e4e2dc);",
      "background:var(--surface,#fff);color:inherit;font-size:20px;line-height:1;cursor:pointer}",
    ".fh-dlg-close:focus-visible{outline:2px solid var(--accent,#1b4d3e);outline-offset:2px}",

    ".fh-dlg-body{padding:26px 24px 20px;overflow:auto;-webkit-overflow-scrolling:touch;flex:1 1 auto;min-height:0}",
    ".fh-dlg-co{margin:0 0 2px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.62}",
    ".fh-dlg-h{margin:0 0 4px;font-size:26px;line-height:1.15;font-weight:640}",
    ".fh-dlg-means{margin:0 0 16px;font-size:14px;opacity:.72}",
    ".fh-dlg-body p{font-size:15px;line-height:1.62;margin:0 0 14px}",

    ".fh-dlg-score{display:flex;align-items:center;gap:14px;margin:0 0 18px}",
    ".fh-dlg-bar{flex:1;height:8px;border-radius:999px;background:var(--surface-sunken,#f2f1ed);overflow:hidden}",
    ".fh-dlg-bar>span{display:block;height:100%;border-radius:999px;background:var(--accent,#1b4d3e)}",
    ".fh-dlg-score>strong{font-size:22px;font-weight:660;font-variant-numeric:tabular-nums}",
    ".fh-dlg-of{font-size:13px;font-weight:400;opacity:.55}",

    ".fh-figs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 14px}",
    ".fh-fig{background:var(--surface-sunken,#f2f1ed);border-radius:var(--radius-sm,6px);padding:10px}",
    ".fh-fig strong{display:block;font-size:17px;font-variant-numeric:tabular-nums}",
    ".fh-fig span{display:block;font-size:11px;opacity:.66;margin-top:2px}",

    ".fh-dlg-foot{font-size:12px!important;opacity:.6;margin:16px 0 0!important}",

    ".fh-dlg-nav{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;",
      "padding:12px 16px;border-top:1px solid var(--border,#e4e2dc);background:var(--surface,#fff)}",
    ".fh-dlg-nav button{min-height:40px;padding:0 14px;border-radius:999px;cursor:pointer;",
      "border:1px solid var(--border,#e4e2dc);background:var(--surface,#fff);color:inherit;font:inherit;font-size:14px}",
    ".fh-dlg-nav button:hover{background:var(--surface-sunken,#f2f1ed)}",
    ".fh-dlg-nav button:focus-visible{outline:2px solid var(--accent,#1b4d3e);outline-offset:2px}",
    ".fh-dlg-pos{font-size:12px;opacity:.6;font-variant-numeric:tabular-nums}",

    /* On a phone it reads as a bottom sheet: more width, thumb-reachable nav. */
    "@media (max-width:520px){",
      /* width:100vw counts the scrollbar and overflows the page sideways.
         Auto width with zero inline margins fills the viewport exactly. */
      ".fh-score-dlg{width:auto;max-width:none;max-height:88dvh;",
        "border-radius:16px 16px 0 0;border-bottom:0;margin:auto 0 0}",
      ".fh-dlg-body{padding:22px 18px 16px}",
      ".fh-dlg-h{font-size:22px}",
      ".fh-figs{grid-template-columns:1fr;gap:8px}",
      ".fh-fig{display:flex;align-items:baseline;justify-content:space-between}",
      ".fh-fig span{margin-top:0}",
    "}",
    "@media (prefers-reduced-motion:reduce){.fh-score-row{transition:none}}",
    "@media (forced-colors:active){",
      ".fh-score-dlg{border:1px solid CanvasText}",
      ".fh-dlg-bar>span{background:Highlight}",
      ".fh-fig{border:1px solid CanvasText}",
    "}",
  ].join("");

  function injectScoreCss() {
    if (document.getElementById("fh-score-css")) return;
    var st = document.createElement("style");
    st.id = "fh-score-css";
    st.textContent = SCORE_CSS;
    document.head.appendChild(st);
  }

  var dlg = null, lastTrigger = null, current = { co: null, metric: null };

  function buildDialog() {
    if (dlg) return dlg;
    injectScoreCss();
    dlg = document.createElement("dialog");
    dlg.className = "fh-score-dlg";
    dlg.innerHTML =
      '<form method="dialog" class="fh-dlg-close-form">' +
        '<button value="close" class="fh-dlg-close" aria-label="Close">×</button>' +
      "</form>" +
      '<div class="fh-dlg-body"></div>' +
      '<nav class="fh-dlg-nav">' +
        '<button type="button" data-step="-1">← Previous</button>' +
        '<span class="fh-dlg-pos" aria-live="polite"></span>' +
        '<button type="button" data-step="1">Next →</button>' +
      "</nav>";
    document.body.appendChild(dlg);

    dlg.querySelectorAll("[data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = METRICS.indexOf(current.metric);
        var next = METRICS[(i + Number(b.dataset.step) + METRICS.length) % METRICS.length];
        fillDialog(current.co, next);
      });
    });
    dlg.addEventListener("close", function () {
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    });
    // Clicking the backdrop closes it; clicking the panel must not.
    dlg.addEventListener("click", function (ev) { if (ev.target === dlg) dlg.close(); });
    return dlg;
  }

  function fillDialog(co, metric) {
    current = { co: co, metric: metric };
    var score = co.scores[metric];
    var body = dlg.querySelector(".fh-dlg-body");
    body.innerHTML =
      '<p class="fh-dlg-co">' + esc(co.name) + "</p>" +
      '<h2 class="fh-dlg-h">' + esc(METRIC_LABEL[metric]) + "</h2>" +
      '<p class="fh-dlg-means">' + esc(METRIC_MEANS[metric]) + "</p>" +
      '<div class="fh-dlg-score"><div class="fh-dlg-bar"><span style="width:' + score + '%"></span></div>' +
        "<strong>" + score + '<span class="fh-dlg-of">/100</span></strong></div>' +
      (metric === "income" ? incomeHtml(co) : "<p>" + esc(co[metric]) + "</p>") +
      '<p class="fh-dlg-foot">Editorial score out of 100, for comparing the five companies.</p>';
    dlg.querySelector(".fh-dlg-pos").textContent =
      (METRICS.indexOf(metric) + 1) + " of " + METRICS.length;
    if (!dlg.open) {
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    }
    body.scrollTop = 0;
  }

  function openDetail(co, metric, trigger) {
    lastTrigger = trigger || null;
    buildDialog();
    fillDialog(co, metric);
  }

  function enhanceScorecards() {
    var cards = document.querySelectorAll(".g-scores");
    for (var c = 0; c < cards.length; c++) {
      var card = cards[c];
      var co = companyFromCard(card);
      if (!co) continue;               // company not matched: leave it alone

      var rows = card.querySelectorAll(".score");
      for (var r = 0; r < rows.length; r++) {
        (function (row) {
          var key = (row.querySelector("dt") || {}).textContent || "";
          var metric = null;
          for (var m = 0; m < METRICS.length; m++) {
            if (METRIC_LABEL[METRICS[m]].toLowerCase() === key.trim().toLowerCase()) metric = METRICS[m];
          }
          if (!metric || co.scores[metric] == null) return;

          // Refreshed on every pass, not just the first: the dossier swaps
          // company without necessarily replacing these nodes, and a label
          // still reading "92 for Toyota" over Nissan's row would be worse
          // than no label at all.
          row.setAttribute("role", "button");
          row.setAttribute("tabindex", "0");
          row.setAttribute("aria-haspopup", "dialog");
          row.setAttribute("aria-label",
            METRIC_LABEL[metric] + " " + co.scores[metric] + " out of 100 for " + co.name + ". Open the detail.");
          row.classList.add("fh-score-row");

          if (row.dataset.fhBound === "1") return;   // one set of listeners only
          row.dataset.fhBound = "1";

          // Resolved at CLICK time, never captured here. If this card is ever
          // reused for another company, a captured value would open the wrong
          // company's text beside the right company's number.
          var open = function (ev) {
            var live = companyFromCard(row.closest(".g-scores") || card);
            if (!live || live.scores[metric] == null) return;
            ev.preventDefault();
            openDetail(live, metric, row);
          };
          row.addEventListener("click", open);
          row.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") open(ev);
          });
        })(rows[r]);
      }

      var note = card.querySelector(".g-note");
      if (note && note.dataset.fhHint !== "1") {
        note.dataset.fhHint = "1";
        note.textContent = "Editorial scores out of 100. Tap any row for the full detail.";
      }
    }
  }

  /* Photo credits for the seller's own photographs.

     The build rewrites those entries to point at the `#photo` sentinel, which
     is already truthful on its own ("dagoldol · own photograph"). This tidies
     it to a plain line with no links, since there is no licence page to link
     to for a photo you took yourself. */
  function fixOwnPhotoCredits() {
    var anchors = document.querySelectorAll('.credit a[href$="#photo"]');
    for (var i = 0; i < anchors.length; i++) {
      var span = anchors[i].closest(".credit");
      if (!span || span.dataset.ownPhoto === "1") continue;
      span.dataset.ownPhoto = "1";
      span.textContent = "Photo: " + BRAND;
    }
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

  function applyBranding() { brandTitle(); brandDisclaimer(); brandFooter(); brandLegal(); brandWordmark(); fixOwnPhotoCredits(); enhanceScorecards(); scheduleCopyFix(); }
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
