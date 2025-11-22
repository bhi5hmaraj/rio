# ADR-001: MVP Architecture and Implementation Strategy

**Status:** Accepted
**Date:** 2025-11-22
**Deciders:** Product team
**Context:** Pre-MVP planning after successful Tampermonkey prototypes

---

## Context

We've validated the core Rio concept through two Tampermonkey prototypes:
1. **Annotation prototype (v6.6)**: Proved Gemini fact-checking, 4-category rubric, and HTML-aware highlighting
2. **DAG prototype (v1.0)**: Proved React Flow feasibility and CSP bypass techniques

Now we're ready to build the production Chrome Extension MVP in 4 weeks. We need to make key architectural decisions to ensure we ship a working, extensible system.

**Key constraints:**
- 4-week timeline
- ChatGPT-only (multi-platform in v2)
- No backend server (local-only)
- SOLID principles for extensibility

---

## Decisions

### 1. Build Tooling & Project Structure

**Decision:**
- **Bundler:** Any modern bundler (Vite preferred for speed, Webpack acceptable)
- **Monorepo:** Use monorepo structure with `extension/` as the main package
- **TypeScript:** Use TypeScript with strict mode enabled
- **Testing:** Jest for unit tests, Playwright for E2E tests
- **Linting:** ESLint + Prettier with standard React/TypeScript configs

**Rationale:**
- Monorepo allows future backend, docs, and tooling packages
- Jest is standard for React unit testing
- Playwright provides robust E2E testing with Chrome extension support
- TypeScript strict mode catches bugs early

**Structure:**
```
rio/
├── extension/           # Chrome extension code
│   ├── src/
│   │   ├── content/     # Content scripts
│   │   ├── background/  # Service worker
│   │   ├── sidepanel/   # Side panel UI (React)
│   │   └── shared/      # Shared utilities
│   ├── public/
│   │   └── manifest.json
│   └── package.json
├── docs/                # Design docs (existing)
├── prd/                 # Product docs (existing)
├── prototypes/          # Archived prototypes (existing)
└── package.json         # Root workspace config
```

---

### 2. AI Integration: LiteLLM Proxy

**Decision:**
- Use **self-hosted LiteLLM proxy server** for all AI provider calls
- Support multiple providers (OpenAI, Gemini, Claude, etc.)
- BYOK (Bring Your Own Key) model - users provide their own API keys
- Store provider info with each annotation (`provider: 'gemini'`)

**Rationale:**
- LiteLLM provides unified API across all providers
- Self-hosted means no data sent to third parties
- BYOK keeps costs with users, privacy-first
- Storing provider info enables future analysis ("Gemini caught more errors than ChatGPT")

**Configuration:**
```typescript
interface AIConfig {
  litellmEndpoint: string;  // e.g., "http://localhost:4000"
  provider: 'openai' | 'gemini' | 'claude' | 'custom';
  apiKey: string;           // Encrypted in chrome.storage
  model?: string;           // e.g., "gemini-2.5-flash"
}
```

---

### 3. Chrome Extension Architecture

**Decision:**
- **Side Panel API** for main UI (Chrome 114+)
- **Service Worker** for API calls and background processing
- **Content Script** for DOM manipulation and text selection
- **No Firefox support** in MVP (post-MVP, will use popup fallback)

**Rationale:**
- Side Panel provides dedicated UI space, no CSP issues
- Service Worker can proxy API calls, manage storage, handle background tasks
- Content Script injects highlights and handles user interactions
- Firefox doesn't support Side Panel API yet (would need popup fallback)

**API Call Flow:**
```
Content Script
  ↓ (chrome.runtime.sendMessage)
Service Worker
  ↓ (fetch to LiteLLM)
LiteLLM Proxy
  ↓ (proxy to provider)
Gemini/OpenAI/Claude
```

---

### 4. Fact-Checking Strategy

**Decision:**
- **On-demand** fact-checking only (user clicks "Run Fact-Check")
- **Service Worker** handles API calls (not Content Script)
- Use prototype's **4-category rubric** (factuality, critique, sycophancy, bias)
- Gemini model with **Google Search grounding** enabled by default

**Rationale:**
- On-demand is simpler for MVP, avoids auto-triggering costs
- Service Worker avoids CSP issues, centralizes API logic
- 4-category rubric validated in prototype
- Google Search grounding significantly improves accuracy (prototype finding)

**No automatic/real-time checking because:**
- Unpredictable costs (user doesn't control when API calls happen)
- Latency issues (waiting for AI on every message)
- API rate limits could break UX

---

### 5. ChatGPT Conversation Identification

**Decision:**
- **URL parsing** for conversation ID: Extract from `chatgpt.com/c/{conversationId}`
- **DOM selectors:** Use code from archived Tampermonkey prototype
- **Defensive selectors:** Multiple fallback selectors with version detection
- **E2E regression tests:** Playwright tests to catch selector breakage

**Rationale:**
- URL is most reliable identifier (doesn't change across UI updates)
- Prototype already has working selectors - don't reinvent
- ChatGPT UI updates frequently - need defensive coding
- E2E tests catch breakage before users report it

**Selector strategy:**
```typescript
const SELECTORS = {
  chatgpt: {
    message: [
      '[data-message-author-role] .prose',  // Current
      '.message .markdown',                  // Fallback 1
      '[data-testid="conversation-turn"]'   // Fallback 2
    ],
    input: [
      '#prompt-textarea',                    // Current
      'textarea[placeholder*="Message"]'     // Fallback
    ]
  }
};
```

---

### 6. Manual Annotation UX

**Decision:**
- **Right-click context menu:** "Annotate with Rio" option
- **HUD overlay:** Floating annotation button appears near text selection
- **Both approaches supported:** User can choose preferred method

**Rationale:**
- Right-click is familiar, discoverable
- HUD overlay is faster for power users
- Supporting both maximizes accessibility

**Flow:**
```
User selects text
  ↓
Context menu: "Annotate with Rio"
  OR
HUD overlay button appears
  ↓
Side Panel opens annotation form
  ↓
User adds category + note
  ↓
Annotation saved to chrome.storage
```

---

### 7. Annotation Categories

**Decision:**
- **4 preset categories:** factuality, critique, sycophancy, bias
- **User can add custom categories:** Extensible category system
- **AI annotations use presets only**
- **Manual annotations can use custom categories**

**Rationale:**
- Preset categories validated in prototype
- Custom categories needed for domain-specific use (e.g., "legal risk", "needs citation")
- AI shouldn't create new categories (consistency, UX confusion)

**Data model:**
```typescript
interface Category {
  id: string;
  name: string;
  color: string;
  preset: boolean;  // true for built-in, false for user-created
}

// Built-in categories
const PRESET_CATEGORIES = [
  { id: 'factuality', name: 'Factuality', color: '#00c65e', preset: true },
  { id: 'critique', name: 'Critique', color: '#007bff', preset: true },
  { id: 'sycophancy', name: 'Sycophancy', color: '#ffa500', preset: true },
  { id: 'bias', name: 'Bias', color: '#dc3545', preset: true },
];
```

---

### 8. Data Model & Storage

**Decision:**
- Store **provider info** with each annotation
- Provide **export option** for all data (JSON format)
- Use **chrome.storage.local** (10MB limit)
- Warn user at 8MB usage, suggest export + cleanup

**Annotation schema:**
```typescript
interface Annotation {
  id: string;                    // UUID
  conversationId: string;        // From URL
  conversationUrl: string;       // Full URL for reference
  messageIndex: number;          // Which message (0-indexed)

  // Text selection
  selector: {
    type: 'TextQuoteSelector';
    exact: string;               // The highlighted text
    prefix?: string;             // 20 chars before
    suffix?: string;             // 20 chars after
  };

  // Classification
  category: string;              // 'factuality' | 'critique' | custom
  strength?: number;             // 1-10 (AI annotations only)
  note: string;                  // The critique/note

  // Metadata
  source: 'ai' | 'manual';
  provider?: string;             // 'gemini' | 'openai' | 'claude'
  model?: string;                // 'gemini-2.5-flash'
  createdAt: number;             // Timestamp
  updatedAt?: number;            // For edits
}
```

**Storage structure:**
```typescript
// chrome.storage.local
{
  annotations: Map<conversationId, Annotation[]>,
  categories: Category[],
  settings: {
    aiConfig: AIConfig,
    preferences: UserPreferences
  }
}
```

---

### 9. Implementation Strategy

**Decision:**
- **Bottom-up approach** (infrastructure first, then features)
- **4-week timeline:**
  - Week 1: Foundation (manifest, build, Side Panel scaffolding, Service Worker)
  - Week 2: ChatGPT scraper + export + storage
  - Week 3: Gemini integration + fact-checking + highlighting
  - Week 4: Manual annotations + CopilotKit + polish

**Rationale:**
- Bottom-up is safer with validated prototypes (we know features work)
- Build solid foundation prevents rework
- Each week delivers measurable progress
- Week 4 has buffer for polish and bug fixes

**Week 1 deliverables:**
```
✅ Manifest.json (MV3, Side Panel API)
✅ Build system (bundler, TypeScript config)
✅ Side Panel React app (empty shell)
✅ Service Worker (message passing)
✅ Content Script (basic injection)
✅ Jest + Playwright setup
```

---

### 10. CopilotKit Integration

**Decision:**
- Use **LiteLLM proxy** for CopilotKit backend (same as Gemini)
- Install `@copilotkit/react-core` and `@copilotkit/react-ui`
- Implement in **Week 4** (after core features stable)
- Actions: `exportChat`, `factCheck`, `addAnnotation`, `search`

**Rationale:**
- LiteLLM can serve CopilotKit's agent requests
- CopilotKit is "nice-to-have", build core features first
- Natural language interface improves UX but isn't critical path

**CopilotKit setup:**
```typescript
// Side Panel
<CopilotKit runtimeUrl="http://localhost:4000/copilot">
  <CopilotChat />
  <AnnotationList />
</CopilotKit>

// Actions
useCopilotAction({
  name: "factCheck",
  description: "Run fact-check on the current conversation",
  handler: async () => {
    const messages = await scrapeConversation();
    const annotations = await factCheck(messages);
    return `Found ${annotations.length} issues`;
  }
});
```

---

### 11. Testing Strategy

**Decision:**
- **Unit tests (Jest):** All utilities, state management, selector logic
- **Integration tests:** Service Worker ↔ Content Script message passing
- **E2E tests (Playwright):** Full user flows, selector regression detection
- **Coverage target:** >70% for critical paths

**E2E test cases:**
```javascript
// Catch ChatGPT selector breakage
test('can scrape ChatGPT conversation', async ({ page }) => {
  await page.goto('https://chatgpt.com/c/test-conversation');
  const messages = await page.evaluate(() => {
    return window.rioScraper.scrapeMessages();
  });
  expect(messages.length).toBeGreaterThan(0);
});

// End-to-end annotation flow
test('user can create manual annotation', async ({ page }) => {
  await page.selectText('Python was created in 1995');
  await page.click('[data-testid="rio-annotate-button"]');
  await page.fill('[data-testid="note-input"]', 'Wrong year');
  await page.click('[data-testid="save-annotation"]');

  const highlights = await page.locator('.rio-highlight').count();
  expect(highlights).toBe(1);
});
```

---

## Consequences

### Positive

✅ **Validated approach:** Building on proven prototypes reduces risk
✅ **Extensible architecture:** SOLID principles enable v2 features (multi-platform, backend, graphs)
✅ **Fast iteration:** Bottom-up approach delivers working foundation early
✅ **Privacy-first:** BYOK + local storage, no data sent to Rio servers
✅ **Testable:** E2E tests catch regressions before users do
✅ **Flexible AI:** LiteLLM supports any provider (Gemini, OpenAI, Claude, local models)

### Negative

⚠️ **10MB storage limit:** Power users may hit chrome.storage quota
⚠️ **ChatGPT selector brittleness:** UI changes will break scraper (mitigated by E2E tests)
⚠️ **Chrome 114+ only:** Older Chrome versions won't work (acceptable for developer MVP)
⚠️ **No Firefox support:** Excludes Firefox users (post-MVP)
⚠️ **Manual fact-checking:** User must trigger, not automatic (trade-off for cost control)

### Mitigations

- **Storage limit:** Export feature + warning at 8MB
- **Selector brittleness:** Multiple fallbacks + E2E tests + fast fix cycle
- **Browser version:** Document minimum Chrome version clearly
- **Firefox:** v2 will add popup fallback for Side Panel
- **Manual triggering:** Consider auto-trigger option in v2 with cost warnings

---

## References

- [MVP PRD](../../prd/mvp.md)
- [Annotation Prototype Learnings](../../prototypes/README.md#annotation-prototype-v66)
- [DAG Prototype Learnings](../../prototypes/README.md#dag-visualization-prototype-v10)
- [Design: Architecture](../design/01-architecture.md)
- [Design: AI Integration](../design/03-ai-integration.md)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/sidePanel/)
- [LiteLLM Docs](https://docs.litellm.ai/)

---

## Notes

This ADR captures decisions made during pre-MVP planning session on 2025-11-22. Implementation begins Week 1 with foundation work.

**Next ADRs to consider:**
- ADR-002: Text anchoring strategy (simple vs Hypothesis)
- ADR-003: Graph extraction algorithm (for v2)
- ADR-004: Backend architecture (for v2)
