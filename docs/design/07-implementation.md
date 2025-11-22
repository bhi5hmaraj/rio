# Implementation Plan

**Status:** Draft v1.0
**Last Updated:** November 2025

## Development Roadmap

### Phase 1: Foundation (v0.1) — 2 weeks

**Goal:** Set up project infrastructure and basic message passing.

**Tasks:**
- [ ] Initialize project with Vite + React + TypeScript
- [ ] Configure Webpack/Vite for Chrome Extension build (separate bundles for content/background/sidepanel)
- [ ] Create `manifest.json` with minimal permissions
- [ ] Implement basic Side Panel (empty React app)
- [ ] Implement Content Script (console.log test)
- [ ] Implement Background Service Worker (message routing)
- [ ] Test message passing: Side Panel → Background → Content Script
- [ ] Set up development workflow (hot reload, debugging)
- [ ] Create build script for packaging

**Deliverables:**
- Working "Load Unpacked" extension
- Side Panel opens on icon click
- Content Script can communicate with Background

**Testing:**
- Manual: Load extension, open Side Panel, check console logs

---

### Phase 2: Scraping & Storage (v0.3) — 2 weeks

**Goal:** Scrape ChatGPT conversations and store in chrome.storage.

**Tasks:**
- [ ] Implement `ChatGPTScraper` (content script)
  - [ ] Detect ChatGPT page
  - [ ] Extract messages using selectors
  - [ ] Generate stable message IDs
  - [ ] Send scraped data to Background
- [ ] Implement `GeminiScraper` (content script)
- [ ] Implement `GenericScraper` fallback
- [ ] Implement storage layer (Background)
  - [ ] Save scraped messages
  - [ ] Save/retrieve settings
  - [ ] Cache management
- [ ] Create Settings page (Side Panel)
  - [ ] API key input
  - [ ] Theme toggle
  - [ ] "Clear data" button
- [ ] Add "Scrape Page" button in Side Panel

**Deliverables:**
- Can scrape ChatGPT conversations
- Scraped data stored in chrome.storage
- Settings page functional

**Testing:**
- Unit: Test selectors on mocked ChatGPT HTML
- Integration: Scrape real ChatGPT page, verify storage

---

### Phase 3: Anchoring & Highlighting (v0.5) — 3 weeks

**Goal:** Implement robust text anchoring and highlighting using vendored Hypothesis code.

**See:** [Hypothesis Insights](09-hypothesis-insights.md) for vendoring strategy and setup.

**Tasks:**
- [ ] Run `scripts/vendor-hypothesis.sh` to copy anchoring code
- [ ] Install npm dependency: `approx-string-match@^2.0.0`
- [ ] Implement `AnchorEngine` (content script) - wraps vendored code
  - [ ] Create selectors from Range (`describe()`)
  - [ ] Resolve selectors to Range (`anchor()` with fuzzy matching)
  - [ ] Handle edge cases (short quotes, dynamic content)
- [ ] Implement highlighter (content script)
  - [ ] Create overlay elements (bypasses Trusted Types)
  - [ ] Position overlays correctly
  - [ ] Reposition on scroll/resize
  - [ ] Clear highlights
- [ ] Test anchoring on:
  - [ ] ChatGPT (spans across `<b>`, `<i>`)
  - [ ] Gemini (TrustedHTML environment)
  - [ ] Generic articles
- [ ] Import Hypothesis test cases for regression testing
- [ ] Implement tooltip on hover
  - [ ] Show annotation explanation
  - [ ] "Jump to Side Panel" button

**Deliverables:**
- Robust anchoring that survives DOM changes
- Highlights appear correctly on page
- Tooltips show annotation details

**Testing:**
- Unit: Anchor regression suite (Hypothesis test cases)
- E2E: Highlight text on real pages, verify position

---

### Phase 4: AI Integration (v0.7) — 2 weeks

**Goal:** Connect to Gemini API and get critique annotations.

**Tasks:**
- [ ] Implement `GeminiAnalyzer` (Background)
  - [ ] Build API request
  - [ ] Call Gemini API with Google Search tools
  - [ ] Parse JSON response
  - [ ] Handle errors (network, malformed response)
- [ ] Implement critique prompt (system instruction)
- [ ] Implement concept extraction prompt
- [ ] Add "Run Critique" button in Side Panel
- [ ] Show loading state during analysis
- [ ] Display annotations in Side Panel (list view)
- [ ] Send annotations to Content Script for highlighting

**Deliverables:**
- "Run Critique" triggers Gemini analysis
- Annotations appear in Side Panel and on page
- Error handling (invalid API key, network failure)

**Testing:**
- Unit: Test Gemini request building, response parsing
- Integration: Call real Gemini API, verify annotations
- E2E: Full critique loop on ChatGPT page

---

### Phase 5: Graph Visualization (v0.9) — 3 weeks

**Goal:** Render concept DAG with React Flow.

**Tasks:**
- [ ] Install React Flow
- [ ] Implement `GraphView` component (Side Panel)
  - [ ] Render nodes and edges
  - [ ] Implement layout algorithm (hierarchical or force-directed)
  - [ ] Pan, zoom, fit view
  - [ ] Node click → highlight text
- [ ] Implement concept extraction (Gemini)
- [ ] Convert Gemini response to React Flow format
- [ ] Add minimap and controls
- [ ] Implement export (SVG, PNG, JSON)
- [ ] Optional: Mermaid.js fallback for low-end devices

**Deliverables:**
- Interactive graph in Side Panel
- Concepts extracted from conversation
- Export functionality

**Testing:**
- Unit: Test graph conversion logic
- Visual: Verify layout on various graph sizes
- E2E: Analyze page → see graph → export SVG

---

### Phase 6: CopilotKit Integration (v1.0) — 2 weeks

**Goal:** Add AI copilot chat interface.

**Tasks:**
- [ ] Install CopilotKit
- [ ] Implement `ChatView` component (Side Panel)
- [ ] Define copilot actions:
  - [ ] `analyzeCurrentPage`
  - [ ] `summarizeSelection`
  - [ ] `addAnnotation`
  - [ ] `exportGraph`
- [ ] Make state readable to agent (`useCopilotReadable`)
- [ ] Test natural language commands
- [ ] Polish UI (chat bubbles, loading states)

**Deliverables:**
- Chat interface in Side Panel
- Agent can trigger actions
- Natural language interaction works

**Testing:**
- Manual: Test various commands
- E2E: "Analyze page" → verify action triggered

---

### Phase 7: Polish & CWS Submission (v1.0) — 2 weeks

**Goal:** Prepare for Chrome Web Store launch.

**Tasks:**
- [ ] Write Privacy Policy
- [ ] Create store assets (icon, screenshots, promo tiles)
- [ ] Write store description
- [ ] Optimize bundle size (code splitting, tree-shaking)
- [ ] Accessibility audit (WCAG AA)
- [ ] Security audit (XSS, API key protection)
- [ ] Performance testing (Lighthouse)
- [ ] Browser testing (Chrome, Edge)
- [ ] Create user documentation (README, guides)
- [ ] Set up GitHub repository
- [ ] Submit to Chrome Web Store
- [ ] Publish open source release

**Deliverables:**
- CWS listing live
- GitHub repository public
- Documentation complete

**Testing:**
- Full regression suite
- User acceptance testing (5-10 beta users)

---

## Total Timeline: ~16 weeks (4 months)

Extension development (Phases 1-7) completes the standalone BYOK version.

---

## Backend Server Roadmap (Optional, Parallel Track)

The backend server can be developed in parallel with or after the extension. It's fully optional - the extension works standalone.

### Backend Phase 1: Foundation (v0.1) — 2 weeks

**Goal:** Basic API with authentication and annotation CRUD.

**Tasks:**
- [ ] Set up FastAPI project structure
- [ ] Configure PostgreSQL database (Docker Compose)
- [ ] Implement user registration/login (JWT)
- [ ] Create annotation storage endpoints (POST, GET, PUT, DELETE)
- [ ] Basic API documentation (auto-generated from FastAPI)
- [ ] Docker Compose deployment setup

**Deliverables:**
- Self-hostable backend (docker-compose up)
- Extension can sync annotations to server

**See:** [Backend Server Design](10-backend-server.md#phase-1-foundation)

### Backend Phase 2: Storage & Sync (v0.5) — 2 weeks

**Goal:** Full-text search and robust sync.

**Tasks:**
- [ ] Implement full-text search (PostgreSQL tsvector)
- [ ] Bulk sync API for extension
- [ ] Conflict resolution (last-write-wins)
- [ ] Rate limiting (per-user quotas)
- [ ] API key management for extension

**Deliverables:**
- Extension syncs annotations to backend
- Users can search their annotation history

**See:** [Backend Server Design](10-backend-server.md#phase-2-storage--sync)

### Backend Phase 3: RAG (v1.0) — 3 weeks

**Goal:** RAG on conversation history.

**Tasks:**
- [ ] Integrate vector DB (Chroma or Qdrant)
- [ ] Conversation upload endpoint
- [ ] Embedding generation (using user's API key)
- [ ] RAG query endpoint (semantic search)
- [ ] Extension UI for RAG queries (Side Panel)

**Deliverables:**
- Users can query conversation history: "What did I learn about X?"
- Semantic search across all past conversations

**See:** [Backend Server Design](10-backend-server.md#2-rag-on-conversation-history)

### Backend Phase 4: Proactive Analysis (v1.5) — 3 weeks

**Goal:** Background analysis and WebSocket notifications.

**Tasks:**
- [ ] WebSocket support for real-time updates
- [ ] Redis job queue for background analysis
- [ ] Celery worker for async processing
- [ ] Proactive analysis across all websites
- [ ] Cache layer for popular pages

**Deliverables:**
- Background analysis of any webpage
- Real-time notifications in Side Panel

**See:** [Backend Server Design](10-backend-server.md#3-proactive-analysis-across-all-websites)

### Backend Phase 5: Advanced Features (v2.0) — 4 weeks

**Goal:** Graph clustering, ML features, and E2EE option.

**Tasks:**
- [ ] End-to-end encryption option
- [ ] Graph clustering algorithms
- [ ] ML-based edge inference
- [ ] Cross-conversation concept linking
- [ ] Multi-user collaboration (future)

**Deliverables:**
- Privacy-preserving E2EE mode
- Advanced graph analysis features

**See:** [Backend Server Design](10-backend-server.md#roadmap)

## Backend Timeline: ~14 weeks (3.5 months)

Backend can be developed in parallel with extension or after v1.0 launch.

---

## Code Structure

```
/rio-extension
├── manifest.json                  # MV3 manifest
├── package.json
├── tsconfig.json
├── vite.config.ts                 # Build config
├── .env.example
├── README.md
├── LICENSE
│
├── docs/
│   ├── design/                    # This folder
│   ├── PRIVACY_POLICY.md
│   ├── CONTRIBUTING.md
│   └── USER_GUIDE.md
│
├── src/
│   ├── background/
│   │   ├── index.ts               # Service worker entry
│   │   ├── message-handler.ts     # Route messages
│   │   ├── api/
│   │   │   ├── gemini.ts          # GeminiAnalyzer
│   │   │   ├── openai.ts          # (future)
│   │   │   └── analyzer.types.ts
│   │   ├── storage/
│   │   │   ├── storage.ts         # chrome.storage wrapper
│   │   │   └── cache.ts
│   │   └── utils/
│   │       ├── encryption.ts
│   │       └── rate-limit.ts
│   │
│   ├── content/
│   │   ├── index.ts               # Entry point
│   │   ├── scrapers/
│   │   │   ├── base.ts            # Scraper interface
│   │   │   ├── chatgpt.ts         # ChatGPTScraper
│   │   │   ├── gemini.ts          # GeminiScraper
│   │   │   ├── claude.ts          # ClaudeScraper
│   │   │   └── generic.ts         # GenericScraper
│   │   ├── anchoring/
│   │   │   ├── anchor-engine.ts   # AnchorEngine
│   │   │   ├── create-selector.ts
│   │   │   ├── resolve-selector.ts
│   │   │   └── fuzzy-match.ts
│   │   ├── highlighting/
│   │   │   ├── highlighter.ts     # Apply highlights
│   │   │   ├── overlay.ts         # Create overlay elements
│   │   │   └── tooltip.ts         # Hover tooltips
│   │   └── utils/
│   │       ├── dom.ts
│   │       └── text.ts
│   │
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── index.tsx              # React root
│   │   ├── App.tsx                # Main app component
│   │   │
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── TabBar.tsx
│   │   │   │
│   │   │   ├── graph/
│   │   │   │   ├── GraphView.tsx  # React Flow canvas
│   │   │   │   ├── NodeTypes.tsx  # Custom nodes
│   │   │   │   ├── EdgeTypes.tsx  # Custom edges
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   └── MermaidFallback.tsx
│   │   │   │
│   │   │   ├── annotations/
│   │   │   │   ├── AnnotationList.tsx
│   │   │   │   ├── AnnotationCard.tsx
│   │   │   │   └── FilterBar.tsx
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── ChatView.tsx   # CopilotKit chat
│   │   │   │   ├── Actions.tsx    # Copilot actions
│   │   │   │   └── ChatBubble.tsx
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── SettingsModal.tsx
│   │   │       ├── APIKeyInput.tsx
│   │   │       └── ThemeToggle.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useRioAgent.ts     # CopilotKit hooks
│   │   │   ├── useAnnotations.ts  # State management
│   │   │   ├── useGraph.ts
│   │   │   └── useMessaging.ts    # Chrome runtime messaging
│   │   │
│   │   ├── store/
│   │   │   ├── store.ts           # Zustand or Jotai
│   │   │   └── slices/
│   │   │       ├── annotations.ts
│   │   │       ├── graph.ts
│   │   │       └── settings.ts
│   │   │
│   │   └── styles/
│   │       ├── globals.css
│   │       └── theme.css
│   │
│   ├── shared/
│   │   ├── types/
│   │   │   ├── annotation.types.ts
│   │   │   ├── graph.types.ts
│   │   │   ├── message.types.ts
│   │   │   ├── storage.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── constants/
│   │   │   ├── colors.ts
│   │   │   ├── categories.ts
│   │   │   └── prompts.ts         # Gemini prompts
│   │   │
│   │   └── utils/
│   │       ├── validation.ts
│   │       ├── sanitization.ts
│   │       └── format.ts
│   │
│   └── assets/
│       ├── icons/
│       │   ├── icon16.png
│       │   ├── icon48.png
│       │   └── icon128.png
│       └── images/
│
├── tests/
│   ├── unit/
│   │   ├── anchoring.test.ts
│   │   ├── scraper.test.ts
│   │   └── gemini.test.ts
│   │
│   ├── integration/
│   │   ├── message-passing.test.ts
│   │   └── storage.test.ts
│   │
│   └── e2e/
│       ├── critique-loop.spec.ts
│       ├── highlighting.spec.ts
│       └── graph-export.spec.ts
│
└── scripts/
    ├── build.ts                   # Production build
    ├── dev.ts                     # Dev server with hot reload
    └── package.ts                 # Create .crx file
```

---

## Build Configuration

### Vite Config (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        background: 'src/background/index.ts',
        content: 'src/content/index.ts'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].[hash].js'
      }
    }
  }
});
```

### Manifest (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "Rio - AI Conversation Critic",
  "version": "1.0.0",
  "description": "Analyze AI conversations for hallucinations, bias, and logical flaws",

  "permissions": [
    "sidePanel",
    "storage",
    "activeTab",
    "scripting"
  ],

  "host_permissions": [
    "https://generativelanguage.googleapis.com/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*"
  ],

  "background": {
    "service_worker": "src/background/index.js",
    "type": "module"
  },

  "action": {
    "default_title": "Open Rio",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },

  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },

  "content_scripts": [
    {
      "matches": [
        "https://chat.openai.com/*",
        "https://gemini.google.com/*"
      ],
      "js": ["src/content/index.js"],
      "run_at": "document_idle"
    }
  ],

  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Coverage targets:**
- Anchoring: 90%
- Scrapers: 80%
- API adapters: 85%

**Key tests:**
- `AnchorEngine`: Selector creation, fuzzy resolution
- `Scrapers`: Extract messages from mocked HTML
- `GeminiAnalyzer`: Request building, response parsing

### Integration Tests

**Focus areas:**
- Message passing between components
- Storage operations (save/retrieve/migrate)
- API error handling (network failures, rate limits)

### E2E Tests (Playwright)

**Scenarios:**
1. **Full Critique Loop:**
   - Load ChatGPT page
   - Click "Analyze"
   - Verify annotations appear
   - Verify highlights on page

2. **Graph Export:**
   - Trigger concept extraction
   - Switch to Graph tab
   - Click "Export SVG"
   - Verify file downloads

3. **Settings Persistence:**
   - Enter API key
   - Reload extension
   - Verify key persists

**Mocked Pages:**
Create static HTML files that mimic ChatGPT/Gemini structure for consistent testing.

---

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start dev server (with hot reload)
npm run dev

# Load extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select /rio-extension/dist folder
```

### Building for Production

```bash
# Build optimized bundle
npm run build

# Package as .crx (for sideloading)
npm run package

# Output: dist/rio-extension.crx
```

### Debugging

**Background Service Worker:**
- Open `chrome://extensions`
- Click "Inspect views: service worker"

**Side Panel:**
- Right-click Side Panel
- "Inspect" opens DevTools

**Content Script:**
- Open page DevTools
- Content script logs appear in Console

---

## Rollout Plan

### Phase 1: Developer Preview (v0.9)

**Audience:** Contributors, early adopters
**Distribution:** GitHub releases (load unpacked)
**Feedback:** GitHub issues

### Phase 2: Beta Launch (v1.0-beta)

**Audience:** Closed beta (50-100 users)
**Distribution:** Direct .crx file (sideloading)
**Feedback:** Google Form survey

### Phase 3: Public Launch (v1.0)

**Audience:** General public
**Distribution:** Chrome Web Store
**Marketing:** HackerNews, Reddit (r/ChatGPT, r/LocalLLaMA), Twitter

### Phase 4: Growth (v1.1+)

**Features:**
- Multi-LLM support (OpenAI, Anthropic)
- Custom rubrics
- Annotation sharing
- Collaboration features

---

## Success Criteria (v1.0)

### Functionality
- [ ] Can scrape ChatGPT and Gemini conversations
- [ ] Anchoring success rate >95% (regression suite)
- [ ] Gemini API integration works (with Search grounding)
- [ ] Highlights appear correctly on page
- [ ] Graph renders and is interactive
- [ ] CopilotKit actions work
- [ ] Export (SVG/JSON) works

### Quality
- [ ] Zero XSS vulnerabilities
- [ ] Bundle size <500KB (sidepanel), <50KB (content)
- [ ] Lighthouse score >90
- [ ] WCAG AA compliance
- [ ] All unit tests pass
- [ ] E2E tests pass

### Documentation
- [ ] README with setup instructions
- [ ] Privacy policy published
- [ ] User guide with screenshots
- [ ] API documentation (for contributors)

---

**Previous:** [← Data Models](06-data-models.md) | **Next:** [Lessons Learned →](08-learnings.md)
