# Rio Prototypes

This folder contains early proof-of-concept implementations that informed the Rio extension design.

---

## Tampermonkey Prototype (v6.6)

**File:** `rio-tampermonkey-v6.6.js`

**Purpose:** Early exploration of the core Rio concept - AI-powered annotation of chat conversations.

### What It Does

- ✅ **Scrapes ChatGPT conversations** using DOM selectors
- ✅ **Sends to Gemini API** for fact-checking with Google Search grounding
- ✅ **Highlights text** with color-coded annotations (factuality, critique, sycophancy, bias)
- ✅ **Shows tooltips** on hover with AI critique
- ✅ **4-category rubric system** for evaluation
- ✅ **HTML-aware highlighting** (preserves formatting tags like `<strong>`, `<em>`)

### Key Learnings

**What worked:**

1. **Rubric-based approach** - The 4 categories (factuality, critique, sycophancy, bias) provided clear signal
2. **Gemini's Google Search integration** - Grounded fact-checking significantly improved accuracy
3. **Strength ratings (1-10)** - Opacity-based visual encoding worked well for nuance
4. **HTML snippet matching** - Preserving original HTML prevented broken formatting

**What didn't work:**

1. **String replacement approach** - Fragile, broke on special characters and nested HTML
2. **No text anchoring** - Highlights broke when chat content changed
3. **Tampermonkey limitations** - Content Security Policy blocks, no proper React UI
4. **No annotation persistence** - Lost on page refresh
5. **Single-shot analysis** - No incremental updates as conversation continued

### Design Decisions Carried Forward to MVP

✅ **Keep the 4-category rubric** (factuality, critique, sycophancy, bias)
✅ **Use Gemini with Google Search** for fact-checking
✅ **Strength-based visual encoding** (color opacity/border thickness)
✅ **Tooltip-based annotation display**

❌ **Replace string replacement** → Use proper W3C Annotation selectors
❌ **Replace Tampermonkey** → Chrome Extension MV3
❌ **Add persistence** → chrome.storage.local
❌ **Add incremental updates** → Re-run analysis on new messages

### Migration Path

The MVP Chrome extension (`prd/mvp.md`) implements the same core concept with production-quality architecture:

| Prototype Feature | MVP Implementation |
|-------------------|-------------------|
| Tampermonkey script | Chrome Extension MV3 |
| String replacement | W3C TextQuoteSelector (simple) |
| Inline tooltip | Side Panel UI (React) |
| One-shot analysis | Incremental fact-checking |
| `GM_setValue` | `chrome.storage.local` |
| Direct Gemini API | Service Worker proxy |

**See:** `prd/mvp.md` for full MVP specification that builds on these learnings.

---

## DAG Visualization Prototype (v1.0)

**File:** `rio-dag-v1.0.js`

**Purpose:** Proof-of-concept for embedding React Flow graph visualization on ChatGPT despite Content Security Policy restrictions.

### What It Does

- ✅ **Embeds React Flow** in a sandboxed iframe
- ✅ **Modal UI** - Full-screen overlay with close button
- ✅ **UMD library injection** - Injects React, ReactDOM, and ReactFlow as text
- ✅ **CSP workaround** - Iframe sandbox bypasses ChatGPT's strict CSP
- ✅ **Interactive graph** - Pan, zoom, and node manipulation work

### Key Learnings

**What worked:**

1. **Iframe sandbox approach** - Successfully bypassed CSP restrictions that block inline scripts
2. **UMD builds via GM_getResourceText** - Injecting libraries as text strings works reliably
3. **React Flow feasibility** - Confirmed graph visualization is technically viable
4. **Modal overlay UX** - Full-screen graph view feels natural, doesn't clutter chat interface

**What didn't work:**

1. **No data extraction** - Didn't implement actual conversation → graph conversion
2. **Static demo only** - Hardcoded nodes/edges, no dynamic generation
3. **Performance unknown** - Didn't test with real conversation graphs (100+ nodes)
4. **No persistence** - Graph state lost on modal close

### Design Decisions Carried Forward to v2

✅ **Use iframe sandbox** for React Flow (CSP workaround validated)
✅ **Modal/Side Panel toggle** for graph view (keep chat visible)
✅ **React Flow is the right library** (mature, feature-rich, good DX)

⚠️ **Defer to v2** - Graph visualization excluded from MVP to focus on core annotation features

### Technical Architecture Insights

**For Chrome Extension implementation:**

```typescript
// Side Panel can use React Flow directly (no CSP issues)
import ReactFlow from 'reactflow';

// OR: If CSP issues arise, use iframe approach:
const GraphView = () => {
  return (
    <iframe
      srcDoc={generateGraphHTML(nodes, edges)}
      sandbox="allow-scripts allow-same-origin"
    />
  );
};
```

**Conversation → Graph algorithm** (to be implemented in v2):

1. Extract all assertions from AI responses
2. Identify relationships (supports, contradicts, depends-on)
3. Build DAG with concepts as nodes, relationships as edges
4. Use force-directed layout for automatic positioning
5. Color-code nodes by annotation category (factuality, critique, etc.)

**See:** `docs/design/04-ui-ux.md` section on "Graph Mode" for full v2 specification.

---

## Summary: Prototype → MVP → v2

| Feature | Annotation Prototype | DAG Prototype | MVP | v2 |
|---------|---------------------|---------------|-----|-----|
| Fact-checking | ✅ Working | - | ✅ Included | ✅ Enhanced |
| Text highlighting | ✅ Working | - | ✅ Included | ✅ + Anchoring |
| Graph visualization | - | ✅ Proven | ❌ Deferred | ✅ Included |
| Chrome Extension | ❌ Tampermonkey | ❌ Tampermonkey | ✅ MV3 | ✅ MV3 |
| CSP workaround | ❌ Blocked | ✅ Iframe | ✅ Side Panel | ✅ Side Panel |
| Persistence | ❌ None | ❌ None | ✅ chrome.storage | ✅ + Backend |

Both prototypes validated core technical feasibility. MVP focuses on annotation features with solid architecture for graph visualization in v2.
