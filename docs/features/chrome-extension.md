# Chrome Extension — Source of Truth

> The in-X surface of the writing assistant: a real-time score orb + suggestion panel injected directly into X's own compose and reply boxes, plus AI reply targeting and generation on the timeline. Tier-0 runs fully client-side (zero backend cost); Tiers 1/2 call the dashboard API.
> **Status (2026-06-26):** Shipped and bundled. The assistant orb/panel/underlines run on X's Draft.js composers; Tier-0 is client-side; the extension shares the dashboard's TypeScript engine via an esbuild bundle (single source of truth — no hand-port). Open: in-X fuzzy underlines are not yet wired (deterministic-only today, by design), and the bundled engine ships only Tier-0 to X. Manifest version `1.3.0` (`chrome-extension/manifest.json:5`).

---

## 1. Role — the in-X surface (one engine, three skins)

The writing assistant renders into three skins from one pure TypeScript engine: the dashboard editor, the `/create` Write tab, and **this extension's in-X composer overlay**. The extension is the skin closest to the pivot's vision — it puts the assistant *inside X itself*, where the writer already lives, instead of asking them to come to the dashboard. See `docs/features/writing-assistant.md` for the engine itself.

The extension carries two distinct product surfaces, which must not be conflated:

1. **Writing assistant** (`assistant-ui.js`) — a Grammarly-style score orb + panel + underlines on X's compose/reply boxes. Answers *"is this post good, and why not?"*
2. **Reply targeting + generation** (`content.js`) — the opportunity pill, the AI-reply button, the reply picker on timeline posts. Answers *"should I reply to this post, and what should I say?"* (`docs/guides/reply.md`).

This doc covers the in-X assistant in depth (§2–§5) and the reply/opportunity surface as a distinct touchpoint (§6).

---

## 2. Architecture

Manifest V3, content-script driven. The whole UI is injected client-side; the service worker (`background.js`) is the only thing that talks to the backend.

**Injected on `x.com` / `twitter.com`** (`manifest.json:22-28`), three content scripts in load order plus one stylesheet:

```
"js": ["assistant-engine.js", "assistant-ui.js", "content.js"],
"css": ["content.css"]
```

Load order matters: `assistant-engine.js` runs first and publishes `window.AFXAssistant`; `assistant-ui.js` bails immediately if that global is missing (`assistant-ui.js:21`). All three share the content-script isolated world.

**Injection targets:**

- **Assistant composer overlay** — `[data-testid^="tweetTextarea_"]` contenteditables, discovered by `scan()` (`assistant-ui.js:291-296`) and kept live by a `MutationObserver` on `document.body` (`assistant-ui.js:298-300`). One controller per composer; both the main post box and the reply-modal box match the same selector.
- **Timeline posts** — `article[data-testid="tweet"]`, processed by `processVisiblePosts()` (`content.js:2028-2031`) driven by a debounced `MutationObserver` on `document.body` (`content.js:2079-2100`) plus a scroll handler for infinite scroll (`content.js:2106-2110`).

**Two MutationObserver layers, by concern:**

| Observer | Scope | Purpose | Location |
|---|---|---|---|
| body observer (content) | `document.body` childList/subtree | discover new timeline `article`s | `content.js:2079` |
| body observer (assistant) | `document.body` childList/subtree | discover new composers | `assistant-ui.js:298` |
| per-composer observer | editor subtree, incl. `characterData` | catch every Draft.js keystroke → recompute score | `assistant-ui.js:145-146` |
| IntersectionObserver | viewport + 100px margin | score opportunity only for visible posts | `content.js:2044-2069` |

The per-composer observer is what makes the score track typing precisely; a 1s `setInterval` (`assistant-ui.js:159-163`) is only a slow safety net for missed mutations, cleanup, and repositioning.

**Service worker** (`background.js`) holds the API config (`apiUrl`, `authToken`, refresh token) in `chrome.storage.local` and is the single network egress (`background.js:10-18, 109-126`). Content scripts reach it via `chrome.runtime.sendMessage` (`content.js:202-207`).

---

## 3. Single-source engine — the esbuild bundle (no hand-port)

The extension does **not** carry a hand-ported copy of the analysis engine. `chrome-extension/build.js` runs esbuild over `src/engine-entry.ts`, which imports the dashboard's real TypeScript engine and bundles it (IIFE, `chrome109` target) to `dist/assistant-engine.js` (`build.js:21-30`). esbuild resolves the app's `@/...` alias to the repo's `src/` (`build.js:28`), so the extension consumes `src/lib/analysis/assistant` verbatim.

```ts
// chrome-extension/src/engine-entry.ts:10-17
import { runTier0 as tsRunTier0, CLASS_STYLE, SEVERITY_DECORATION,
         BAND_COLOR, scoreBand, type Tier0Input } from "@/lib/analysis/assistant";
```

The entry adapts the engine's object return into the flat `{ reach, charCount, overLimit }` shape the UI expects so `assistant-ui.js` needs no changes (`engine-entry.ts:22-32`), then publishes `window.AFXAssistant = { runTier0, CLASS_STYLE, SEVERITY_DECORATION, BAND_COLOR, scoreBand }` (`engine-entry.ts:34, 42`).

**Why this matters:** the in-X surface and the dashboard can never drift — there is one engine, one calibration, one place to fix a bug. This explicitly **replaces** the old hand-ported `assistant-engine.js` and its parity test (`engine-entry.ts:5-6`). The committed `dist/assistant-engine.js` is build output, not source — never edit it by hand; edit `src/lib/analysis/assistant` and rebuild.

> Note: only **Tier-0** is bundled to X today. The engine entry exports `runTier0` plus palette/banding helpers — not L2/L3. The in-X assistant is therefore deterministic, free, and offline; Tier-2 is reachable only via the panel's voice-check button, which routes through the backend (§7).

A second formula is mirrored, not bundled: the opportunity score's `weightedEngagement` (replies ×5, retweets ×4, likes/bookmarks ×3, impressions ×0.001) is hand-kept in `content.js:120-127` to match the server's `src/lib/utils/engagement.ts`, so the extension's opportunity number is the same signal the server ranks reply targets by.

---

## 4. UI components

### 4.1 Score orb (`assistant-ui.js`)

A 36px circular badge (`content.css:861`) pinned to the bottom-right corner of the compose box, positioned with `getBoundingClientRect` against the live editor and re-positioned on scroll/resize via rAF (`assistant-ui.js:149-157, 179-195`). It shows the banded **Reach** number, colored by `scoreBand` → `BAND_COLOR`, with a small dot overlay carrying the findings count (`assistant-ui.js:197-205`). Click toggles the panel (`assistant-ui.js:117-120`). When the editor has zero width (collapsed), the orb hides itself (`assistant-ui.js:182`).

### 4.2 Panel (`assistant-ui.js:243-272`)

A 272px card (`content.css:895`) anchored to the box. Renders the **Reach** header, a **badge** row (good/caution/neutral status colors), and **suggestion cards** built from `findings` + `chips`. Empty state: "Nothing flagged. Looking sharp." All strings escaped via `esc()` (`assistant-ui.js:284-288`).

### 4.3 Underlines / overlay (`assistant-ui.js:209-241`)

A `position:fixed` overlay (`content.css:893`) sized over the editor draws a `<div>` per `Range.getClientRects()` rect for each finding that carries a `span`. Border-bottom style comes from `CLASS_STYLE[finding.class].color` + `SEVERITY_DECORATION[finding.severity]`; multi-line spans get one underline per rect.

### 4.4 Hover-to-explain

Each underline div sets `u.title = finding.title + " — " + finding.why` (`assistant-ui.js:236`) — a native tooltip on hover. The panel cards carry the same title + explanation, so the explanation is reachable whether the user hovers the span or opens the panel. (Lightweight by design; no custom popover.)

### 4.5 Authenticity passthrough

`runTier0` is called with `{ hasMedia, authenticity: assistantAuthenticity }` (`assistant-ui.js:171`). `assistantAuthenticity` is hydrated from `chrome.storage.local.extensionStatus.assistant.authenticity` (`assistant-ui.js:31-48`), which the background fills from `/api/extension/status` (§7). This is what makes the in-X composer score **identically** to the dashboard for authenticity-first users (soft reach nags quieted on both surfaces). Null until loaded → Tier-0 treats it as 0.

**Robustness contract:** X's composer is a Draft.js contenteditable that re-renders constantly. Every DOM op in `assistant-ui.js` is wrapped in try/catch and degrades to "no underline / no orb" — it must **never** interfere with typing (`assistant-ui.js:11-13, 165-177`). The orb + panel need only the text; underlines are the one fragile part and fail soft.

---

## 5. In-X decoration reality (Draft.js)

X's compose box is a **Draft.js** editor — a model-backed contenteditable we don't own. Two consequences shape the whole surface:

**(a) Text/offset mapping.** `mapEditor()` walks `[data-block="true"]` blocks with a `TreeWalker`, joins with `\n`, and records each text node's flat start offset so a Tier-0 character offset can be resolved back to a DOM `Range` (`assistant-ui.js:53-96`). On any failure it falls back to `editor.textContent` with a no-op locator — score still works, underlines just don't draw.

**(b) Writing into the box (reply injection).** Native `execCommand('insertText')` desyncs from Draft.js's own model (leaving a "ghost" double that only deletes halfway), so reply text is injected by driving **Draft.js's own paste pipeline**: focus, `selectAll`, then dispatch a synthetic `ClipboardEvent('paste')` with a `DataTransfer` payload; verify the text landed; fall back to `insertText` only if the synthetic paste carried no usable clipboardData (`content.js:1805-1862`). This is the model-driven path that re-renders cleanly with no orphan nodes.

### The design rule: hybrid — deterministic-only underlines on X

From `GRAMMARLY_PIVOT_UX.md §7` (the locked decision):

- **Underline only Tier-0 exact-match deterministic spans on X** (link, bait phrase, avoid-word, typo/filler) — these anchor trivially and reliably.
- **Route fuzzy LLM spans (voice drift) to the panel as quoted cards**, never as in-box underlines — sidesteps the LLM offset-miscount problem on the surface we control least.
- **When anchor confidence drops, hide the underline rather than risk drawing it wrong** — a misplaced underline is worse than none. In code, `rangeFor` returning `null` simply drops that finding's underline (`assistant-ui.js:212-217, 84-96`); the finding still appears in the panel.
- **Fail-soft everywhere** — any thrown error in `update()`/`renderUnderlines()` is swallowed so typing is never blocked (`assistant-ui.js:176, 240`).

Today this is realized by virtue of only Tier-0 being bundled: every finding the in-X UI draws is already a deterministic exact-match span. The dashboard modal (surface we fully own) is where the full fuzzy-underline experience lives.

---

## 6. The opportunity pill + reply generation (distinct surface)

This is **not** the writing assistant — it lives in `content.js` and answers a different question: *should I reply to this post at all, and what should I say?* See `docs/guides/reply.md`.

**Opportunity pill (`OPP_PILL` / `xgo-opp-pill`).** For each visible timeline post, `scoreAndDisplayOpportunity()` (`content.js:424-466`) extracts metrics, computes a traction score (canonical weighted engagement decayed by post age — `content.js:129-173`), normalizes to 0–100 against a rolling min/max window (`content.js:178-199`), and—if above the yellow threshold—inserts a banded "Opp N" pill into the post's action bar with a colored border (`content.js:471-504`). A `~` prefix marks proxy scores estimated without view counts. Clicking the pill triggers the AI-reply button on that post (`content.js:486-497`).

**Reply-eligibility gate.** Both the pill and the AI-reply button are suppressed when `isReplyRestricted()` positively detects X's "who can reply" restriction (native reply control absent **and** a restriction notice present — conservative, fails open to repliable) (`content.js:322-364, 429, 1949-1960`). Never flag an opportunity on a post the user can't reply to.

**AI reply button + picker.** A split button (robot emoji + tone dropdown, tones in `content.js:1060-1066`) calls `GENERATE_REPLY` through the background with the post text + rich context (parent post, quoted tweet, link card, media — extracted in `content.js:514-763`). The picker (`content.js:1120-1145`) shows the generated options, a collapsible "Context used" summary, per-option thumbs feedback, and an on-demand **Voice check (3 cr)** button (Tier-2, manual, never auto-fires — `content.js:1388-1424`). "Use this reply" clicks X's native reply control then injects via the Draft.js paste pipeline (§5b), and `attachReplySendLogger` logs the reply to the backend when the user actually clicks Post (`content.js:1876-1916`).

This surface reuses the **opportunity pill's fixed-positioning machinery** that the assistant orb also adopted, and is the older, more mature half of the extension (the original "Content Pipeline" save/reply feature, per `chrome-extension/README.md`).

---

## 7. Backend touchpoints

The content scripts never fetch directly; `background.js` owns auth + egress against `apiUrl` (default `https://app.agentsforx.com`).

| Endpoint | Trigger | Purpose | Route |
|---|---|---|---|
| `GET /api/extension/status` | install / periodic refresh | plan, usage limits, setup completeness, **assistant.authenticity** | `src/app/api/extension/status/route.ts` |
| `POST /api/extension/replies` | user clicks Post on an injected reply | log sent reply for consistency tracking → `extension_replies` table | `src/app/api/extension/replies/route.ts` |
| `POST /api/generate-reply` | AI-reply button | Tier-? LLM reply generation (honors `tone`) | (background `generateReply`, `background.js:244`) |
| `POST /api/voice/check` | "Voice check (3 cr)" in picker/panel | Tier-2 voice scoring (3 credits) | (background, `background.js:284`) |

**`/api/extension/status`** authenticates via Bearer token or session cookie (`status/route.ts:13-32`), then returns plan, usage (used/limit/remaining/unlimited), setup flags (`onboarding_completed`, `voice_configured`, `x_connected`), and crucially `assistant.authenticity` from `user_voice_settings.optimization_authenticity` (`status/route.ts:72-83`). The background caches this to `chrome.storage.local.extensionStatus`, which the assistant reads (§4.5).

**`/api/extension/replies`** uses `getDualAuthUser`, validates `reply_text` + `sent_at`, and inserts into `extension_replies` (`replies/route.ts:38-48`). Both routes set CORS headers and report to Sentry.

**Tiers 1/2 via API:** the in-X assistant is Tier-0 only (client-side). Any heavier read (voice check) is an explicit, credit-costed, manual API call — there is no automatic per-keystroke server traffic. AI-generation limits return `code: 'AI_LIMIT'`, surfaced as an in-picker upgrade prompt (`content.js:1680-1685, 1514-1616`).

---

## 8. Build & load

```bash
cd chrome-extension
npm run build        # → node build.js
```

`build.js` (1) copies `manifest.json` to `dist/`, (2) esbuild-bundles `src/engine-entry.ts` → `dist/assistant-engine.js` (§3), (3) copies `assistant-ui.js`, `content.js`, `content.css`, `background.js`, popup files, and icons into `dist/` (`build.js:13-87`).

Load unpacked:

1. `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `chrome-extension/dist`
4. Click the extension icon → set dashboard URL + log in (popup writes `apiUrl` + tokens to `chrome.storage.local`).

To iterate: edit `src/` (or `src/lib/analysis/assistant` for the engine), rerun `npm run build`, reload the extension. Permissions: `storage`, `activeTab`; host permissions cover `x.com`, `twitter.com`, and `app.agentsforx.com` (`manifest.json:7-15`).

---

## 9. Key files

| File | Role |
|---|---|
| `chrome-extension/manifest.json` | MV3 manifest; content-script registration + host permissions |
| `chrome-extension/build.js` | esbuild bundle + dist assembly |
| `chrome-extension/src/engine-entry.ts` | imports `@/lib/analysis/assistant`, publishes `window.AFXAssistant` (Tier-0) |
| `chrome-extension/src/content/assistant-ui.js` | orb + panel + underlines + authenticity passthrough; per-composer controller |
| `chrome-extension/src/content/content.js` | timeline injection, opportunity pill, AI reply button/picker, Draft.js paste pipeline |
| `chrome-extension/src/content/content.css` | dark+light themes; `cp-*` (reply/opp) + `afx-asst-*` (assistant) styles |
| `chrome-extension/src/background/background.js` | service worker; auth + all API egress |
| `chrome-extension/dist/assistant-engine.js` | **build output** of engine-entry (do not edit) |
| `src/lib/analysis/assistant/` | the real engine (`tier0.ts`, `score.ts`, `spans.ts`, `palette.ts`, `types.ts`) |
| `src/app/api/extension/status/route.ts` | plan/usage/setup + authenticity for the extension |
| `src/app/api/extension/replies/route.ts` | logs sent replies |

---

## 10. Current state & gaps

- **In-X fuzzy underlines unwired (by design).** Only Tier-0 is bundled, so the in-X assistant shows only deterministic exact-match underlines today — exactly the locked hybrid rule. Wiring L2/L3 into X would require shipping panel-only quoted cards for fuzzy spans; the bundle currently exports just `runTier0` (`engine-entry.ts:10-17`).
- **Live-page underline hardening.** The Range-based overlay is best-effort against Draft.js re-renders/scroll. It fails soft, but cross-X-layout validation on the live page (composer vs reply modal vs quote-tweet box) is still open — flagged as deferred in `docs/features/writing-assistant.md`.
- **Assistant skin is dark-only.** The `afx-asst-*` orb/panel/cards use fixed dark colors (`content.css:861-918`); the older `cp-*` reply/opportunity UI has `prefers-color-scheme` light variants (`content.css:781`) but the assistant overlay does not yet.
- **Authenticity is best-effort.** If `/api/extension/status` hasn't loaded (logged out, offline), `assistantAuthenticity` stays null and Tier-0 treats it as 0 — the in-X score can briefly differ from the dashboard until status hydrates (`assistant-ui.js:31-48, 171`).
- **Reply-restriction detection is heuristic.** `isReplyRestricted` is deliberately conservative and DOM-text-based; X markup changes could weaken it (it fails open, so the cost is a stray pill on a non-repliable post, never a hidden one) (`content.js:322-364`).
- **No automated parity test for the engine bundle.** Single-source bundling removed the need for the old hand-port parity test, but there is no build-time assertion that `dist/assistant-engine.js` is in sync with source — it relies on rebuilding before load.

---

## 11. Related docs

- `docs/features/writing-assistant.md` — the engine itself (L0–L3, calibration, the three skins). The extension is skin #3.
- `docs/guides/reply.md` — the reply engine (find repliable high-traction posts, reply-voice generation, voice check) that powers §6.
- `GRAMMARLY_PIVOT_UX.md` §5 (score orb), §7 (in-X Draft.js underline decision), §8 (verbatim-quote anchoring rule) — the UX source for this surface.
- `chrome-extension/README.md` — thin install/usage quickstart (save + reply origins).
