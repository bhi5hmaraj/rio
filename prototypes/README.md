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

## Future Prototypes

This folder may contain additional prototypes for:
- Hypothesis text anchoring integration
- Graph visualization concepts
- Multiplayer collaboration experiments
- RAG-based conversation search

Each prototype should include a brief README explaining what was learned.
