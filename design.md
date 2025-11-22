# Rio Extension — Quick Design Doc

## 1) Summary

Rio is a Chrome extension that analyzes the current page/chat, extracts concepts, builds a **Concept DAG**, and renders it in a persistent **side-panel HUD**. The HUD hosts a React app with **CopilotKit** (for agent actions) and **React Flow** (for the graph). Content scripts handle scraping and anchoring; the background service worker brokers cross-origin fetches and storage. The side panel is an extension page, so it’s immune to site CSP/Trusted-Types. ([Chrome for Developers][1])

---

## 2) Goals / Non-Goals

**Goals**

* Modular, composable components that can be swapped/upgraded independently.
* Robust **anchoring** that survives DOM drift (quote + position + fuzzy matching).
* Fast iteration: mocked local pipelines first; optional server-side graph/LLM later.
* Nice UX: side panel with zoomable DAG, export (SVG/JSON), and Copilot chat.

**Non-Goals**

* Forking an entire annotation client UI (e.g., Hypothesis sidebar).
* Injecting complex UI into hostile pages; the **side panel** is our UI surface. ([Chrome for Developers][1])

---

## 3) Architecture (MV3)

**Processes**

* **Side Panel (React app)**: DAG HUD + CopilotKit chat.
* **Content Script**: scrape visible text, generate/select anchors, apply temporary highlights.
* **Background Service Worker**: orchestrates actions, does cross-origin `fetch()` to local/remote analyzers (allowed via **host_permissions**), persists settings. ([GitHub][2])

**Messaging**

* Content → Background: `{pageId, selection|transcript}`
* Background → Side Panel: `{dag, annotations, status}`
* Side Panel → Background: `{action: "analyze|refresh|export", params}`

**Permissions (minimal)**

* `"sidePanel"`, `"storage"`, plus `"host_permissions"` for sites to scrape and any analyzer endpoints (e.g., `http://localhost:7111/*`). ([Chrome for Developers][1])

---

## 4) Key Modules (swap-friendly)

1. **Scraper**

   * Pluggable per-site strategies (ChatGPT, Gemini, generic article).
   * Emits a **linearized text + DOM map** (offsets ↔ nodes).

2. **AnchorEngine** (built on standards + Hypothesis libs)

   * Creates & resolves selectors:

     * **TextQuoteSelector** (exact quote + prefix/suffix)
     * **TextPositionSelector** (start/end offsets)
   * **Fuzzy anchoring**: context-first match near a position hint, then suffix, then verify the exact quote. This is the proven Hypothesis approach. ([Hypothesis][3])
   * Use the small, battle-tested packages (not the whole client): `dom-anchor-text-quote` and its position counterpart to convert between **DOM Ranges** and selectors with optional context + offset hints. ([GitHub][4])
   * Store everything in the **W3C Web Annotation Data Model** so annotations are portable. ([W3C][5])

3. **AnalyzerAdapter**

   * Strategy interface for “how to get a DAG”:

     * `LocalMockAnalyzer` (no network; deterministic)
     * `RemoteLLMAnalyzer` (background `fetch()` → returns nodes/edges or server-rendered SVG)
   * Results normalized to `{nodes, edges, meta}` or pre-rendered `svg`.

4. **DAGRenderer**

   * Default: **React Flow** canvas for live editing and interaction (pan/zoom, selections, layout). ([React Flow][6])
   * Alternative: “static image mode” (server-rendered SVG), still with export.

5. **Copilot Layer (CopilotKit)**

   * Exposes safe, declarative **actions/tools** to the agent:

     * `analyzeCurrentPage`, `summarizeSelection`, `addAnnotation`, `exportGraph`.
   * Use CopilotKit’s action hooks (note: `useCopilotAction` works, but their docs suggest migrating toward newer specialized hooks like `useRenderToolCall` / `useFrontendTool` as they evolve). ([docs.copilotkit.ai][7])

6. **Exporter**

   * SVG/PNG from canvas; JSON (nodes/edges); W3C annotation JSON.

---

## 5) Data Model

**Annotation**

```json
{
  "target": {
    "source": "<url>",
    "selector": [
      { "type": "TextQuoteSelector", "exact": "...", "prefix": "...", "suffix": "..." },
      { "type": "TextPositionSelector", "start": 1234, "end": 1298 }
    ]
  },
  "body": { "type": "TextualBody", "value": "note / label / relation" },
  "motivation": "commenting"
}
```

* Store both selectors; resolve with quote-first fuzzy matching **near** the stored position; fall back to wider search if needed. ([Hypothesis][3])
* Keep the model W3C-compliant for future interop. ([W3C][5])

**Graph**

```json
{ "nodes":[{"id":"n1","label":"Topic","spans":[<annotationIds>], ...}], "edges":[{"id":"e1","source":"n1","target":"n2","label":"supports"}], "meta":{ "pageUrl":"...", "ts":123456 } }
```

---

## 6) UI/UX (Side Panel)

* **Modes**: “Graph”, “Annotations”, “Chat”.
* **Graph**: React Flow with toolbar (fit, zoom, layout, export). ([React Flow][6])
* **Annotations**: list with jump-to-anchor; hovering a list item temporarily highlights the anchored text via content script overlays.
* **Chat**: CopilotKit chat; actions show in the thread and route to Background. ([docs.copilotkit.ai][7])

---

## 7) Security & Privacy

* UI runs in the **side panel**; no page HTML injection needed. ([Chrome for Developers][1])
* Content script only reads visible text/positions and injects **ephemeral overlays** (no `innerHTML` sinks).
* Cross-origin calls happen in the background worker; scope with `"host_permissions"` and store minimal data in `chrome.storage`. ([GitHub][2])

---

## 8) Performance

* **Anchoring**: prefer quotes with prefix/suffix + position hints; guard against pathological short quotes (known perf issue in long docs) with timeouts/backoff. ([GitHub][8])
* **Graph**: virtualize node labels if needed; debounce layout; chunk large updates.

---

## 9) Testing & CI

* **Anchoring regression tests**: integrate Hypothesis-style datasets/harness (e.g., standalone demos/tests around `dom-anchor-text-quote`) to replay anchors across HTML/PDF text-layers; compare resolve rates and timing before merging updates. ([GitHub][9])
* **Contract tests** for AnalyzerAdapter and AnchorEngine interfaces.
* **E2E**: scripted pages (Playwright) to validate scraping → anchoring → jump.

---

## 10) Rollout Plan

1. **MVP**: Side panel + local mock analyzer + basic anchoring (quote+position), React Flow render, export SVG/JSON. ([Chrome for Developers][1])
2. **Actions**: Add CopilotKit tools for “analyze page,” “add note,” “export.” ([docs.copilotkit.ai][7])
3. **Remote analyzer** (optional): background `fetch()` to your server for LLM + server-rendered SVG; plug into AnalyzerAdapter. ([GitHub][2])
4. **Hardening**: anchoring perf tuning; regression suite; settings page.

---

## 11) Open Questions

* Do we want PDF support in v1 (requires PDF.js text-layer strategy)?
* Server-rendered SVG vs. client layout: which is primary for large graphs?
* Hosting of user data (local only vs. sync)?

---

### TL;DR

Use **Chrome Side Panel** + MV3 for a robust UI surface, **Hypothesis-style anchoring** via `TextQuote`/`TextPosition` with fuzzy matching, **CopilotKit actions** to orchestrate work, and **React Flow** for the DAG. Keep everything modular so you can swap analyzers or renderers without touching anchoring or UI scaffolding. ([Chrome for Developers][1])

If you want, I can turn this into a repo skeleton (folders, manifest, stubbed modules, and a tiny end-to-end test) so you can start dropping in code immediately.

[1]: https://developer.chrome.com/docs/extensions/reference/api/sidePanel?utm_source=chatgpt.com "chrome.sidePanel | API | Chrome for Developers"
[2]: https://github.com/GoogleChrome/developer.chrome.com/blob/main/site/en/docs/extensions/mv3/declare_permissions/index.md?utm_source=chatgpt.com "developer.chrome.com/site/en/docs/extensions/mv3/declare_permissions ..."
[3]: https://web.hypothes.is/blog/fuzzy-anchoring/?utm_source=chatgpt.com "Fuzzy Anchoring - Hypothesis"
[4]: https://github.com/tilgovi/dom-anchor-text-quote?utm_source=chatgpt.com "GitHub - tilgovi/dom-anchor-text-quote: Convert between DOM Range ..."
[5]: https://www.w3.org/TR/annotation-model/?utm_source=chatgpt.com "Web Annotation Data Model - World Wide Web Consortium (W3C)"
[6]: https://reactflow.dev/?utm_source=chatgpt.com "Node-Based UIs in React - React Flow"
[7]: https://docs.copilotkit.ai/reference/hooks/useCopilotAction?utm_source=chatgpt.com "useCopilotAction - CopilotKit Documentation"
[8]: https://github.com/hypothesis/client/issues/3919?utm_source=chatgpt.com "Quote anchoring blocks execution for a long time #3919 - GitHub"
[9]: https://github.com/judell/StandaloneAnchoring?utm_source=chatgpt.com "Demo of using dom-anchor-text-quote to anchor annotations ... - GitHub"
