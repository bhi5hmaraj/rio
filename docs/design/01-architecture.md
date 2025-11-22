# Architecture

**Status:** Draft v1.0
**Last Updated:** November 2025

## System Overview

Rio is built as a **Manifest V3 Chrome Extension** to bypass CSP limitations and enable a rich UI via the Side Panel API. The architecture follows a "Hybrid" component model with three distinct contexts communicating via the Chrome Runtime API.

## The "Hybrid" Component Model

### Components & Responsibilities

| Component | Role | Runtime Context | Tech Stack | Key Responsibilities |
|-----------|------|-----------------|------------|---------------------|
| **Content Script** | "The Hands" | Injected into web page | Vanilla TS + `@hypothesis/text-quote-selector` | • Scrape chat text<br>• Tag DOM elements with stable IDs<br>• Paint colored highlights on page<br>• Render tooltips on hover |
| **Side Panel** | "The Face" | Extension page (chrome-extension://) | React + CopilotKit + React Flow | • Main UI/HUD<br>• Display Concept DAG<br>• "Run Critique" triggers<br>• Manage user settings (API Key) |
| **Background Service Worker** | "The Brain" | Extension background | Service Worker (TS) | • Orchestrate API calls to Gemini<br>• Handle `chrome.storage` encryption/decryption<br>• Manage global events<br>• Cross-origin fetch (via host_permissions) |
| **Backend Server** (Optional) | "The Memory" | Self-hosted server | FastAPI + PostgreSQL + Vector DB | • Long-term annotation storage<br>• RAG on conversation history<br>• Proactive analysis queue<br>• Graph clustering & ML features |

### Why This Architecture?

1. **Side Panel Isolation**
   - Runs in extension context, immune to page CSP/Trusted-Types
   - Allows React, external scripts, and iframes
   - Persistent UI that doesn't interfere with page layout
   - See: [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

2. **Content Script Limitations**
   - Can read/modify DOM but inherits page CSP
   - Cannot use `innerHTML` on Gemini (TrustedHTML enforcement)
   - Cannot load external scripts on ChatGPT (CSP blocks)
   - Should be kept minimal and focused on DOM operations only

3. **Background Worker Power**
   - Can make cross-origin fetches (via `host_permissions`)
   - Persistent storage access
   - Can coordinate between multiple tabs/panels
   - Service Worker lifecycle (event-driven, not always running)

4. **Optional Backend Server**
   - Extension works fully standalone (local-first)
   - Backend adds: unlimited storage, RAG, proactive analysis
   - Open source, self-hostable (no vendor lock-in)
   - See: [Backend Server Design](10-backend-server.md)

## Data Flow

### The "Critique Loop" (Primary Workflow)

```
┌─────────────┐
│  User       │
│  (clicks    │
│  "Critique")│
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Side Panel (React) │
│  - CopilotKit UI    │
└──────┬──────────────┘
       │ chrome.runtime.sendMessage({action: "critique"})
       ▼
┌──────────────────────┐
│  Background Worker   │
│  - Routes request    │
└──────┬───────────────┘
       │ chrome.tabs.sendMessage({action: "scrape"})
       ▼
┌──────────────────────┐
│  Content Script      │
│  - Scrape chat DOM   │
│  - Extract messages  │
└──────┬───────────────┘
       │ returns {messages: [...]}
       ▼
┌──────────────────────┐
│  Background Worker   │
│  - Call Gemini API   │
│  - With Google Search│
└──────┬───────────────┘
       │ Gemini response: {annotations: [...]}
       ▼
┌──────────────────────┴──────────────┐
│  Background broadcasts to:          │
│  1. Side Panel (for DAG)            │
│  2. Content Script (for highlights) │
└─────────────────────────────────────┘
```

### Message Schemas

See [Data Models](06-data-models.md) for detailed schemas.

**Content → Background (Scrape Result)**
```typescript
{
  action: "scrapeComplete",
  data: {
    pageId: string,
    url: string,
    messages: Array<{
      id: string,
      role: "user" | "assistant",
      text: string,
      html: string,
      timestamp: number
    }>
  }
}
```

**Background → Side Panel (Analysis Result)**
```typescript
{
  action: "analysisComplete",
  data: {
    dag: {
      nodes: Node[],
      edges: Edge[]
    },
    annotations: Annotation[],
    status: "success" | "error",
    error?: string
  }
}
```

**Background → Content Script (Highlight Command)**
```typescript
{
  action: "applyHighlights",
  annotations: Array<{
    id: string,
    target: {
      messageId: string,
      selector: TextQuoteSelector | TextPositionSelector
    },
    color: "blue" | "green" | "orange" | "red",
    category: "critique" | "factuality" | "sycophancy" | "bias",
    note: string
  }>
}
```

## Manifest V3 Configuration

### Required Permissions (Minimal Scope)

```json
{
  "permissions": [
    "sidePanel",      // For the UI
    "storage",        // For API keys and settings
    "activeTab",      // Minimize warnings; only active when clicked
    "scripting"       // To inject content script
  ],
  "host_permissions": [
    "https://generativelanguage.googleapis.com/*",  // Gemini API
    "https://chat.openai.com/*",                    // ChatGPT scraping
    "https://gemini.google.com/*"                   // Gemini scraping
  ],
  "optional_permissions": [
    "http://localhost:*/*"  // For local development/testing
  ]
}
```

### Content Security Policy

The Side Panel (as an extension page) has relaxed CSP and can:
- Load external scripts (React, CopilotKit)
- Use `eval()` if needed (though we avoid it)
- Create iframes
- Use inline scripts

The Content Script inherits the page's CSP and **cannot**:
- Use `innerHTML` on pages with Trusted Types (Gemini)
- Load external scripts on pages with strict CSP (ChatGPT)
- Execute inline scripts

## Key Modules (Swappable Components)

### 1. Scraper (Content Script)

**Interface:**
```typescript
interface Scraper {
  scrape(): Promise<ScrapedData>;
  detectSite(): "chatgpt" | "gemini" | "claude" | "generic";
}
```

**Implementations:**
- `ChatGPTScraper`: Uses `[data-message-id]` selectors
- `GeminiScraper`: Uses `.model-response-text` selectors
- `ClaudeScraper`: TBD
- `GenericScraper`: Fallback for articles (readability.js)

**Output:** Linearized text + DOM map (offsets ↔ nodes)

### 2. AnchorEngine (Content Script)

Built on Hypothesis standards + libraries.

**Interface:**
```typescript
interface AnchorEngine {
  createSelector(range: Range): TextQuoteSelector & TextPositionSelector;
  resolveSelector(selector: Selector): Range | null;
}
```

**Libraries:**
- `@hypothesis/dom-anchor-text-quote`
- `@hypothesis/dom-anchor-text-position`

**Features:**
- Fuzzy anchoring with context matching
- Falls back to position hints if quote fails
- Uses W3C Web Annotation Data Model

See [Text Anchoring](02-anchoring.md) for details.

### 3. AnalyzerAdapter (Background Worker)

**Interface:**
```typescript
interface AnalyzerAdapter {
  analyze(text: string, options: AnalysisOptions): Promise<AnalysisResult>;
}
```

**Implementations:**
- `GeminiAnalyzer`: Uses Google Gemini 2.5 Flash with Search grounding
- `LocalMockAnalyzer`: Deterministic, no network (for testing)
- `RemoteLLMAnalyzer`: Custom backend (future)

**Output:** Normalized `{nodes, edges, annotations}`

### 4. DAGRenderer (Side Panel)

**Interface:**
```typescript
interface DAGRenderer {
  render(dag: Graph): void;
  export(format: "svg" | "png" | "json"): Blob;
}
```

**Implementations:**
- `ReactFlowRenderer`: Interactive, live editing (default)
- `MermaidRenderer`: Static SVG fallback (low-end devices)

### 5. CopilotLayer (Side Panel)

**Integration:** CopilotKit hooks

**Actions:**
- `analyzeCurrentPage`: Triggers the critique loop
- `summarizeSelection`: User highlights text, asks for summary
- `addAnnotation`: Manual annotation creation
- `exportGraph`: Download DAG as file

See [UI/UX Design](04-ui-ux.md) for details.

## Security Boundaries

### What Content Script CAN Do
✅ Read page DOM (text, structure)
✅ Create temporary overlays (highlights, tooltips)
✅ Tag elements with `data-*` attributes
✅ Communicate with Background via messages

### What Content Script CANNOT Do
❌ Inject complex HTML (CSP/Trusted Types blocks it)
❌ Load external libraries (CSP blocks `<script src>`)
❌ Make cross-origin fetches directly
❌ Access `chrome.storage` directly (must go through Background)

### What Side Panel CAN Do
✅ Full React app with external dependencies
✅ Direct access to `chrome.storage`
✅ iframe embedding (if needed)
✅ WebGL/Canvas rendering (React Flow)

### What Background Worker CAN Do
✅ Cross-origin fetches (via `host_permissions`)
✅ Long-lived operations (within service worker limits)
✅ Global state management
✅ Tab coordination

## Performance Considerations

### Content Script
- **Keep it light:** Minimal bundle size (use tree-shaking)
- **Lazy inject:** Only inject when Side Panel is opened
- **Debounce DOM reads:** Use IntersectionObserver for visible content only
- **Highlight batching:** Group DOM updates to avoid layout thrashing

### Side Panel
- **Code splitting:** Load React Flow only when Graph tab is active
- **Virtualization:** For large annotation lists (react-window)
- **Memoization:** React.memo for DAG nodes to prevent re-renders

### Background Worker
- **Cache API responses:** Use `chrome.storage` for recent analyses
- **Request deduplication:** Don't re-analyze unchanged content
- **Timeout handling:** Abort fetch if Gemini takes >30s

## Testing Strategy

### Unit Tests
- AnchorEngine: Selector creation/resolution
- Scrapers: DOM extraction logic
- AnalyzerAdapter: API contract compliance

### Integration Tests
- Message passing between components
- Storage encryption/decryption
- API error handling

### E2E Tests (Playwright)
- Full critique loop on mocked ChatGPT page
- Highlight anchoring accuracy
- DAG rendering

See [Implementation Plan](07-implementation.md#testing) for details.

---

**Previous:** [← Overview](00-overview.md) | **Next:** [Text Anchoring →](02-anchoring.md)
