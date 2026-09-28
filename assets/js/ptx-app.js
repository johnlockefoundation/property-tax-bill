/* ==========================================================================
   NC Property Tax Bill — widget behaviour
   Refactored from the inline <script> in the live demo (property-tax-demo/index.html).

   The demo was a whole page: one set of #ids, one set of document-level
   globals, one implicit instance. Inside WordPress a shortcode can appear more
   than once on a page and the theme owns everything outside the shortcode, so
   this version scopes every lookup to its own root element and keeps selection
   state on the instance. Two widgets on one page are independent.

   Behaviour is otherwise identical: same endpoint, same queries, same
   residential filtering, same county inference, same candidate ordering and
   cap, same status strings, same three below-benchmark sentences, same receipt
   arithmetic (which lives in ptx-calc.js, the shared PT contract, unmodified).
   ========================================================================== */

(function (root) {
  "use strict";

  if (root.__PTX_BILL__) return;
  root.__PTX_BILL__ = true;

  var ONEMAP_QUERY = "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query";
  var RESULT_LIMIT = 40;   // OneMap resultRecordCount, as in the demo
  var MAX_CANDIDATES = 8;  // rows shown in the candidate list, as in the demo
  var SHOWN_CAP_NOTE = 8;

  var dataCache = {};

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  var fmtMoney = function (x) {
    return "$" + Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (x < 0 ? " less" : "");
  };

  function loadBenchmarks(url) {
    if (!dataCache[url]) {
      dataCache[url] = fetch(url)
        .then(function (r) { return r.json(); })
        .catch(function (e) {
          delete dataCache[url];
          console.error("benchmark load failed", e);
          return {};
        });
    }
    return dataCache[url];
  }

  function Bill(rootEl) {
    this.root = rootEl;
    this.src = rootEl.getAttribute("data-ptx-src") || "";
    this.benchmarks = {};
    this.selected = null;
    this.county = null;
    this.el = {
      select: rootEl.querySelector(".ptx-select"),
      input: rootEl.querySelector(".ptx-input"),
      button: rootEl.querySelector(".ptx-btn"),
      status: rootEl.querySelector(".ptx-status"),
      cands: rootEl.querySelector(".ptx-cands"),
      nores: rootEl.querySelector(".ptx-nores"),
      results: rootEl.querySelector(".ptx-results"),
      bill: rootEl.querySelector(".ptx-receipt"),
      below: rootEl.querySelector(".ptx-below"),
      brand: rootEl.querySelector(".ptx-receipt-brand"),
      instruction: rootEl.querySelector(".ptx-receipt-instruction"),
      addressBody: rootEl.querySelector(".ptx-address-body"),
      address: rootEl.querySelector(".ptx-receipt-addr"),
      meta: rootEl.querySelector(".ptx-receipt-meta"),
      paid: rootEl.querySelector(".ptx-amt-paid"),
      could: rootEl.querySelector(".ptx-amt-could"),
      saved: rootEl.querySelector(".ptx-amt-saved"),
      pct: rootEl.querySelector(".ptx-receipt-total-pct")
    };
  }

  Bill.prototype.setStatus = function (msg) {
    this.el.status.textContent = msg || "";
  };

  Bill.prototype.clearBill = function () {
    this.el.results.classList.remove("ptx-hidden");
    this.el.below.classList.add("ptx-hidden");
    this.el.bill.classList.remove("ptx-hidden");
    this.el.brand.classList.add("ptx-hidden");
    this.el.instruction.classList.remove("ptx-hidden");
    this.el.addressBody.classList.add("ptx-hidden");
  };

  Bill.prototype.selectCounty = function (key) {
    this.selected = key || null;
    this.county = key ? this.benchmarks[key] : null;
    this.clearBill();
  };

  Bill.prototype.clearAddress = function () {
    this.el.input.value = "";
    this.el.cands.innerHTML = "";
    this.el.nores.classList.add("ptx-hidden");
    this.setStatus("");
    this.clearBill();
  };

  Bill.prototype.populateCountySelect = function () {
    var self = this;
    Object.keys(this.benchmarks)
      .sort(function (a, b) { return self.benchmarks[a].label.localeCompare(self.benchmarks[b].label); })
      .forEach(function (k) {
        var opt = self.root.ownerDocument.createElement("option");
        opt.value = k;
        opt.textContent = self.benchmarks[k].label;
        self.el.select.appendChild(opt);
      });
  };

  Bill.prototype.load = function () {
    var self = this;
    return loadBenchmarks(this.src).then(function (data) {
      self.benchmarks = data || {};
      self.populateCountySelect();
    });
  };

  /* ---- address search -------------------------------------------------- */

  Bill.prototype.fetchAddressFeatures = function (q, cntyfips) {
    var where = PT.buildAddressWhere(q);
    if (!where) return Promise.resolve([]);

    var body = new URLSearchParams();
    body.append("where", cntyfips ? "(" + where + ") AND stcntyfips = '" + cntyfips + "'" : "(" + where + ") AND stcntyfips LIKE '37%'");
    body.append("outFields", "parno,siteadd,parval,parvaltype,parusecode,parusedesc,improvval,stcntyfips,cntyfips");
    body.append("f", "pjson");
    body.append("returnGeometry", "false");
    body.append("resultRecordCount", String(RESULT_LIMIT));

    return fetch(ONEMAP_QUERY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    })
      .then(function (resp) { return resp.text(); })
      .then(function (text) {
        var data = JSON.parse(text);
        if (data.error) throw new Error(data.error.message || "Service error");
        var feats = (data.features || []).map(function (f) { return f.attributes; });
        // Counties like Macon ship no land-use code OR description at all, so
        // there is nothing to classify by; there, fall back to "a building
        // stands on it" (improvement value > 0) so residences stay searchable.
        var hasUseData = feats.some(function (a) {
          return String(a.parusecode || "").trim() || String(a.parusedesc || "").trim();
        });
        if (!hasUseData) {
          return feats.filter(function (a) { return Number(a.improvval) > 0 && Number(a.parval) > 0; });
        }
        return feats.filter(PT.isUsableResidential);
      });
  };

  Bill.prototype.inferCountyKey = function (q) {
    var self = this;
    return this.fetchAddressFeatures(q, null).then(function (feats) {
      for (var i = 0; i < feats.length; i++) {
        var sfips = String(feats[i].stcntyfips || "");
        for (var k in self.benchmarks) {
          if (self.benchmarks[k].fips === sfips) return k;
        }
      }
      return null;
    });
  };

  Bill.prototype.searchAddress = function (query) {
    var self = this;
    var q = (query || "").trim();
    if (!q) { this.setStatus(""); return Promise.resolve(); }

    this.el.button.disabled = true;
    this.setStatus("Searching…");
    this.el.cands.innerHTML = "";
    this.el.nores.classList.add("ptx-hidden");
    this.clearBill();

    var done = function () { self.el.button.disabled = false; };

    return Promise.resolve()
      .then(function () {
        var where = PT.buildAddressWhere(q);
        if (!where) { self.setStatus(""); return; }

        return Promise.resolve(self.selected && self.benchmarks[self.selected] ? self.selected : null)
          .then(function (key) {
            if (key) return key;
            return self.inferCountyKey(q).then(function (inferred) {
              if (!inferred) {
                self.setStatus("No residential matches found. Try a street name or house number.");
                return null;
              }
              self.el.select.value = inferred;
              self.selectCounty(inferred);
              return inferred;
            });
          })
          .then(function (key) {
            if (!key) return;
            return self.fetchAddressFeatures(q, self.benchmarks[key].fips).then(function (feats) {
              if (feats.length === 0) {
                self.setStatus("");
                self.el.nores.classList.remove("ptx-hidden");
                return;
              }
              self.renderCandidates(feats);
              self.setStatus(
                feats.length + " residential match" + (feats.length > 1 ? "es" : "") +
                (feats.length > SHOWN_CAP_NOTE ? " (showing first " + SHOWN_CAP_NOTE + ")." : ".")
              );
            });
          });
      })
      .catch(function (err) {
        self.setStatus("Search failed (source unavailable). Please try again.");
        console.error(err);
      })
      .then(done, function (err) {
        console.error(err);
        done();
      });
  };

  Bill.prototype.renderCandidates = function (feats) {
    var self = this;
    var doc = this.root.ownerDocument;
    var list = this.el.cands;
    list.innerHTML = "";

    feats.slice(0, MAX_CANDIDATES).forEach(function (f) {
      var li = doc.createElement("li");
      var type = (f.parusedesc || f.parusecode || "").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      li.innerHTML =
        "<div>" + esc(f.siteadd || "No address") + "</div>" +
        "<div class=\"ptx-val\">$" + (f.parval || 0).toLocaleString() + " &middot; " + esc(type) + "</div>" +
        "<div class=\"ptx-pid\">Parcel " + esc(f.parno) + "</div>";
      li.addEventListener("click", function () { self.selectParcel(f); });
      list.appendChild(li);
    });
  };

  /* ---- bill ------------------------------------------------------------ */

  Bill.prototype.selectParcel = function (f) {
    this.el.address.textContent = f.siteadd || "No address";
    this.el.meta.innerHTML =
      "<div>Parcel " + esc(f.parno || "—") + "</div>" +
      "<div>Assessed value $" + Number(f.parval || 0).toLocaleString() + "</div>";

    var county = this.county;
    var showBelow = function (message) {
      this.el.below.textContent = message;
      this.el.below.classList.remove("ptx-hidden");
      this.el.bill.classList.add("ptx-hidden");
      this.el.results.classList.remove("ptx-hidden");
    }.bind(this);

    if (!county) {
      showBelow("The per-property comparison is unavailable for this county yet.");
      return;
    }

    var value = Number(f.parval);
    if (!county.x || !isFinite(value) || value < 0) {
      showBelow("The per-property comparison is unavailable for this parcel.");
      return;
    }

    // Paid is the FY2025-26 actual bill (assessed value x actual levy / taxable
    // base). The counted savings rate (Data(tax).csv column Q) is assumed to
    // extend to this property's bill: could-have = paid x (1 - savings rate) and
    // saved = paid x savings rate, so the percent saved always matches the
    // published figure.
    if (county.below_benchmark) {
      var nm = county.label.replace(/ County$/, "");
      showBelow("Property tax rate growth in " + nm + " County was below the maximum allowed under a levy limit, so this property would not have saved anything.");
      return;
    }

    var receipt = PT.computeReceipt(value, county);
    if (!receipt.ok) {
      showBelow("The per-property comparison is unavailable for this parcel.");
      return;
    }

    this.el.below.classList.add("ptx-hidden");
    this.el.bill.classList.remove("ptx-hidden");
    this.el.brand.innerHTML = "2026 " + county.label + "<br>Property Tax Receipt";
    this.el.brand.classList.remove("ptx-hidden");
    this.el.instruction.classList.add("ptx-hidden");
    this.el.addressBody.classList.remove("ptx-hidden");
    this.el.paid.textContent = fmtMoney(receipt.paid);
    this.el.could.textContent = fmtMoney(receipt.could_have);
    this.el.saved.textContent = fmtMoney(receipt.saved);
    this.el.pct.textContent = "OR " + Math.round(100 * receipt.rate) + "% lower";
    this.el.results.classList.remove("ptx-hidden");
  };

  /* ---- init ------------------------------------------------------------ */

  Bill.prototype.bind = function () {
    var self = this;
    var run = function () { self.searchAddress(self.el.input.value); };

    this.el.button.addEventListener("click", run);
    this.el.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") run();
    });
    this.el.select.addEventListener("change", function (e) {
      self.clearAddress();
      self.selectCounty(e.target.value || null);
    });

    this.load();
  };

  function boot() {
    var nodes = (root.document || document).querySelectorAll("[data-ptx]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute("data-ptx-ready") === "1") continue;
      el.setAttribute("data-ptx-ready", "1");
      new Bill(el).bind();
    }
  }

  if (typeof root.PT === "undefined") {
    console.error("ptx-calc.js must load before ptx-app.js");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof self !== "undefined" ? self : this);
