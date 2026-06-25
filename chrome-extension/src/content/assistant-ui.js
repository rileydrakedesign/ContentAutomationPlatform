/**
 * Writing-assistant UI for X's compose box (GRAMMARLY_PIVOT_UX.md §5, surface A).
 *
 * Injects a Grammarly-style score "orb" into the bottom-right of X's post
 * composer, plus a click-to-open panel of badges + deterministic suggestions, and
 * best-effort inline underlines for exact-match Tier-0 findings (the locked
 * "hybrid: deterministic-only on X" decision — fuzzy LLM findings would live in
 * the panel, not as in-box underlines).
 *
 * Robustness first: X's composer is a Draft.js contenteditable that re-renders
 * constantly. Every DOM operation here is wrapped so a failure degrades to "no
 * underline / no orb" and NEVER interferes with typing on X. The orb + panel
 * need only the text; the underlines are the one fragile part and fail soft.
 *
 * Tier-0 only (free, instant, client-side). A "voice check" button in the panel
 * reuses the extension's existing on-demand voice-check path for Tier-2.
 */
(function () {
  "use strict";

  if (!window.AFXAssistant) return; // engine must load first
  var A = window.AFXAssistant;
  var DEBOUNCE = 220;
  var ATTACHED = "afxAssistantAttached";

  // The user's authenticity dial, cached by the background's extension-status
  // fetch. Passed into Tier-0 so the in-X composer scores identically to the
  // dashboard (authenticity-first users get the soft reach nags quieted on both
  // surfaces) (#10). Null until loaded → Tier-0 treats it as 0 (not first).
  var assistantAuthenticity = null;
  function loadAuthenticity() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get("extensionStatus", function (res) {
        try {
          var a = res && res.extensionStatus && res.extensionStatus.assistant;
          if (a && typeof a.authenticity === "number") assistantAuthenticity = a.authenticity;
        } catch (e) {}
      });
      if (chrome.storage.onChanged && !loadAuthenticity._bound) {
        loadAuthenticity._bound = true;
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area === "local" && changes.extensionStatus) loadAuthenticity();
        });
      }
    } catch (e) {}
  }
  loadAuthenticity();

  // ── Editor text + offset mapping ──────────────────────────────────────────
  // Walk the contenteditable's blocks, joining with "\n", and record each text
  // node's flat start so we can map a Tier-0 offset back to a DOM Range.
  function mapEditor(editor) {
    var text = "";
    var segs = []; // { node, start, len }
    try {
      var blocks = editor.querySelectorAll('[data-block="true"]');
      var blockList = blocks.length ? Array.prototype.slice.call(blocks) : [editor];
      blockList.forEach(function (block, bi) {
        var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
        var n;
        while ((n = walker.nextNode())) {
          var data = n.nodeValue || "";
          segs.push({ node: n, start: text.length, len: data.length });
          text += data;
        }
        if (bi < blockList.length - 1) text += "\n";
      });
    } catch (e) {
      return { text: editor.textContent || "", locate: function () { return null; } };
    }
    function locate(offset) {
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (offset >= s.start && offset <= s.start + s.len) {
          return { node: s.node, offset: offset - s.start };
        }
      }
      return null;
    }
    return { text: text, locate: locate };
  }

  function rangeFor(map, start, end) {
    var a = map.locate(start);
    var b = map.locate(end);
    if (!a || !b) return null;
    try {
      var r = document.createRange();
      r.setStart(a.node, a.offset);
      r.setEnd(b.node, b.offset);
      return r;
    } catch (e) {
      return null;
    }
  }

  // ── Per-composer controller ───────────────────────────────────────────────
  function attach(editor) {
    if (editor.dataset[ATTACHED]) return;
    editor.dataset[ATTACHED] = "1";

    var overlay = document.createElement("div");
    overlay.className = "afx-asst-overlay";
    var orb = document.createElement("div");
    orb.className = "afx-asst-orb";
    var panel = document.createElement("div");
    panel.className = "afx-asst-panel afx-hidden";
    document.body.appendChild(overlay);
    document.body.appendChild(orb);
    document.body.appendChild(panel);

    var lastReport = null;
    var lastText = null;
    var timer = null;

    orb.addEventListener("click", function () {
      panel.classList.toggle("afx-hidden");
      if (!panel.classList.contains("afx-hidden")) renderPanel();
    });

    function cleanup() {
      if (!document.body.contains(editor)) {
        overlay.remove(); orb.remove(); panel.remove();
        clearInterval(poll);
        try { mo.disconnect(); } catch (e) {}
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onScroll);
        return true;
      }
      return false;
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(update, DEBOUNCE);
    }
    editor.addEventListener("input", schedule);
    editor.addEventListener("focus", schedule);

    // Event-driven recompute: a MutationObserver on the editor subtree catches
    // every Draft.js text change precisely (childList/characterData), so the
    // score tracks typing without a tight wall-clock poll. The interval below is
    // now only a slow safety net (missed mutations + cleanup + reposition).
    var mo = new MutationObserver(schedule);
    try { mo.observe(editor, { childList: true, subtree: true, characterData: true }); } catch (e) {}

    // Reposition underlines smoothly during scroll/resize via rAF, so they track
    // the glyphs instead of lagging a poll tick.
    var rafPending = false;
    function onScroll() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () { rafPending = false; position(); });
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);

    var poll = setInterval(function () {
      if (cleanup()) return;
      update();
      position();
    }, 1000);

    function update(force) {
      try {
        var map = mapEditor(editor);
        // Skip the recompute when the text hasn't changed (cheap no-op on poll).
        if (!force && map.text === lastText) return;
        lastText = map.text;
        var report = A.runTier0(map.text, { hasMedia: hasMediaNearby(editor), authenticity: assistantAuthenticity });
        lastReport = report;
        renderOrb(report);
        renderUnderlines(map, report);
        if (!panel.classList.contains("afx-hidden")) renderPanel();
      } catch (e) { /* never break typing */ }
    }

    function position() {
      try {
        var rect = editor.getBoundingClientRect();
        if (rect.width === 0) { orb.style.display = "none"; overlay.style.display = "none"; return; }
        orb.style.display = "flex";
        orb.style.left = rect.right - 44 + "px";
        orb.style.top = rect.bottom - 44 + "px";
        overlay.style.display = "block";
        overlay.style.left = rect.left + "px";
        overlay.style.top = rect.top + "px";
        overlay.style.width = rect.width + "px";
        overlay.style.height = rect.height + "px";
        panel.style.left = Math.max(8, rect.right - 280) + "px";
        panel.style.top = rect.bottom - 52 - panel.offsetHeight + "px";
        renderUnderlinePositions();
      } catch (e) {}
    }

    function renderOrb(report) {
      var band = A.scoreBand(report.reach);
      orb.style.borderColor = A.BAND_COLOR[band];
      orb.style.color = A.BAND_COLOR[band];
      orb.innerHTML =
        '<span class="afx-asst-orb-num">' + report.reach + "</span>" +
        (report.findings.length ? '<span class="afx-asst-orb-dot">' + report.findings.length + "</span>" : "");
      position();
    }

    // Keep finding→range pairs so we can reposition cheaply on scroll.
    var drawn = [];
    function renderUnderlines(map, report) {
      overlay.innerHTML = "";
      drawn = [];
      report.findings.forEach(function (f) {
        if (!f.span) return;
        var range = rangeFor(map, f.span.start, f.span.end);
        if (!range) return;
        drawn.push({ finding: f, range: range });
      });
      renderUnderlinePositions();
    }

    function renderUnderlinePositions() {
      try {
        overlay.innerHTML = "";
        var oRect = overlay.getBoundingClientRect();
        drawn.forEach(function (d) {
          var rects = d.range.getClientRects();
          for (var i = 0; i < rects.length; i++) {
            var r = rects[i];
            var u = document.createElement("div");
            u.className = "afx-asst-underline";
            u.style.left = r.left - oRect.left + "px";
            u.style.top = r.bottom - oRect.top - 2 + "px";
            u.style.width = r.width + "px";
            var style = A.CLASS_STYLE[d.finding.class];
            u.style.borderBottom = "2px " + A.SEVERITY_DECORATION[d.finding.severity] + " " + style.color;
            u.title = d.finding.title + " — " + d.finding.why;
            overlay.appendChild(u);
          }
        });
      } catch (e) {}
    }

    function renderPanel() {
      if (!lastReport) { panel.innerHTML = ""; return; }
      var r = lastReport;
      var html = '<div class="afx-asst-panel-h">Reach <b style="color:' + A.BAND_COLOR[A.scoreBand(r.reach)] + '">' + r.reach + "</b></div>";
      if (r.badges.length) {
        html += '<div class="afx-asst-badges">';
        r.badges.forEach(function (b) {
          var c = b.status === "good" ? "#4ADE80" : b.status === "caution" ? "#FBBF24" : "#818CF8";
          html += '<span class="afx-asst-badge" style="color:' + c + ';background:' + c + '1a" title="' + esc(b.detail || "") + '">' +
            (b.status === "good" ? "✓ " : b.status === "caution" ? "⚠ " : "· ") + esc(b.label) + "</span>";
        });
        html += "</div>";
      }
      var items = r.findings.concat(r.chips.map(function (c) {
        return { class: "reach", title: c.label, why: c.detail || "", chip: true };
      }));
      if (items.length) {
        html += '<div class="afx-asst-cards">';
        items.forEach(function (f) {
          var style = A.CLASS_STYLE[f.class] || { color: "#FBBF24", label: "Reach" };
          html += '<div class="afx-asst-card"><div class="afx-asst-card-h"><span style="background:' + style.color + '"></span>' +
            esc(f.title) + "</div><p>" + esc(f.why) + "</p></div>";
        });
        html += "</div>";
      } else {
        html += '<p class="afx-asst-empty">Nothing flagged. Looking sharp.</p>';
      }
      panel.innerHTML = html;
      position();
    }

    update();
  }

  function hasMediaNearby(editor) {
    try {
      var root = editor.closest('[role="dialog"]') || editor.closest('[data-testid="primaryColumn"]') || document;
      return !!root.querySelector('[data-testid="attachments"], [data-testid="tweetPhoto"]');
    } catch (e) { return false; }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ── Discover composers ────────────────────────────────────────────────────
  function scan() {
    try {
      var editors = document.querySelectorAll('[data-testid^="tweetTextarea_"] [contenteditable="true"], [contenteditable="true"][data-testid^="tweetTextarea_"]');
      editors.forEach(function (el) { attach(el); });
    } catch (e) {}
  }

  var obs = new MutationObserver(function () { scan(); });
  obs.observe(document.body, { childList: true, subtree: true });
  scan();
})();
