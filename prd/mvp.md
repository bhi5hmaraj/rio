# Rio MVP - Product Requirements Document

**Version:** 1.0
**Status:** Draft
**Target Release:** 4 weeks from kickoff
**Last Updated:** November 2025

---

## Executive Summary

**Rio MVP** is a Chrome extension that enables users to fact-check AI conversations in real-time using Google Gemini, add manual annotations, and export chat transcripts. The MVP focuses on **ChatGPT support only** with an architecture designed for easy extension to other platforms.

**Key Principle:** Ship a working end-to-end system in 4 weeks, then iterate based on user feedback.

---

## Vision

Provide a simple, reliable tool that helps users:
1. **Verify AI claims** using automated fact-checking
2. **Annotate conversations** with their own notes
3. **Export transcripts** for future reference

The MVP proves the core value proposition while establishing a solid foundation for advanced features like multi-platform support, graph visualization, and backend sync.

---

## Goals

### Must Have (MVP Launch Blockers)

1. ✅ **ChatGPT Chat Export**
   - Extract conversation from chat.openai.com
   - Preserve message structure (user/assistant/system)
   - Export as JSON

2. ✅ **AI Fact-Checking**
   - Send conversation to Gemini API
   - Get fact-check annotations (factual errors, logical flaws)
   - Display results in Side Panel

3. ✅ **Manual Annotations**
   - User selects text on page
   - User adds note via Side Panel
   - Annotation stored with simple text selector

4. ✅ **Basic Highlighting**
   - Show fact-check results as colored highlights
   - Show manual annotations as highlights
   - Click highlight → show annotation details

5. ✅ **Side Panel UI**
   - List all annotations (AI + manual)
   - Filter by category (factual, critique, manual)
   - Export all as JSON

6. ✅ **Settings**
   - Store Gemini API key (encrypted)
   - Enable/disable fact-checking
   - Clear all data

### Nice to Have (Post-MVP)

- 🔄 Claude.ai support (via extensible scraper interface)
- 🔄 Gemini.google.com support
- 🔄 Advanced anchoring (Hypothesis-style)
- 🔄 Graph visualization
- 🔄 Backend sync
- 🔄 Multiplayer

---

## Non-Goals (Explicitly Out of Scope)

❌ **Backend server** - MVP is local-only (chrome.storage)
❌ **Robust anchoring** - Simple text-based selectors only (Hypothesis in v2)
❌ **Multi-platform** - ChatGPT only (architecture supports extension)
❌ **Graph visualization** - Text annotations only (React Flow in v2)
❌ **CopilotKit integration** - Manual UI only (AI agent in v2)
❌ **Multiplayer** - Single-user only
❌ **RAG/search** - No conversation history search
❌ **Chrome Web Store submission** - Developer distribution only

---

## User Stories

### Epic 1: ChatGPT Export

**As a** ChatGPT user
**I want to** export my conversation as structured data
**So that** I can reference it later or share it with others

**Acceptance Criteria:**
- [ ] Click "Export Chat" button in Side Panel
- [ ] Extension extracts all messages from current conversation
- [ ] JSON file downloads with conversation data
- [ ] Format: `[{role, text, timestamp}, ...]`

---

### Epic 2: AI Fact-Checking

**As a** ChatGPT user
**I want to** automatically fact-check the AI's responses
**So that** I can catch hallucinations and verify claims

**Acceptance Criteria:**
- [ ] Click "Run Fact-Check" button in Side Panel
- [ ] Extension sends conversation to Gemini API
- [ ] Gemini returns annotations (factual errors, logical flaws)
- [ ] Annotations appear in Side Panel list
- [ ] Problematic text highlighted on ChatGPT page (yellow for factual, blue for critique)
- [ ] Click highlight → see explanation in tooltip

**Example:**
```
ChatGPT says: "Python was created in 1995"
Gemini fact-check: ❌ Factual Error
  "Python was created in 1991 by Guido van Rossum"
```

---

### Epic 3: Manual Annotations

**As a** ChatGPT user
**I want to** add my own notes to specific parts of the conversation
**So that** I can remember my thoughts and questions

**Acceptance Criteria:**
- [ ] User selects text on ChatGPT page
- [ ] Right-click → "Annotate with Rio"
- [ ] Side Panel opens annotation form
- [ ] User types note and saves
- [ ] Selected text highlighted (green)
- [ ] Click highlight → see note in tooltip

---

### Epic 4: Annotation Management

**As a** user
**I want to** view all annotations in one place
**So that** I can review and manage them

**Acceptance Criteria:**
- [ ] Side Panel shows list of all annotations
- [ ] Each item shows: quote, category, note
- [ ] Filter by category: All / Factual / Critique / Manual
- [ ] Click annotation → scroll to highlight on page
- [ ] Delete button for manual annotations

---

### Epic 5: Settings

**As a** user
**I want to** configure the extension
**So that** it works with my Gemini API key

**Acceptance Criteria:**
- [ ] Settings page accessible from Side Panel
- [ ] Input field for Gemini API key
- [ ] "Validate" button tests API key
- [ ] Toggle: "Enable automatic fact-checking"
- [ ] "Clear all data" button

---

## Technical Architecture

### SOLID Design Principles

#### 1. Single Responsibility Principle (SRP)

Each module has one reason to change:

```typescript
// ✅ Good: Each class has one responsibility
class ChatGPTScraper {
  scrape(): Message[] { /* only scraping logic */ }
}

class AnnotationStore {
  save(annotation: Annotation): void { /* only storage */ }
}

class GeminiFactChecker {
  check(messages: Message[]): Annotation[] { /* only fact-checking */ }
}

// ❌ Bad: God object
class RioExtension {
  scrape() { }
  factCheck() { }
  save() { }
  render() { }
}
```

#### 2. Open/Closed Principle (OCP)

Open for extension, closed for modification:

```typescript
// ✅ Good: Interface allows extension
interface PlatformScraper {
  scrape(): Message[];
  getURL(): string;
  getPlatformName(): string;
}

class ChatGPTScraper implements PlatformScraper {
  scrape(): Message[] { /* ChatGPT-specific */ }
}

// Future: Add new platform without modifying existing code
class ClaudeScraper implements PlatformScraper {
  scrape(): Message[] { /* Claude-specific */ }
}

// Platform detection
const scrapers: PlatformScraper[] = [
  new ChatGPTScraper(),
  new ClaudeScraper()
];

const scraper = scrapers.find(s => s.getURL().includes(window.location.host));
```

#### 3. Liskov Substitution Principle (LSP)

Subtypes must be substitutable:

```typescript
// ✅ Good: All scrapers interchangeable
function exportChat(scraper: PlatformScraper): void {
  const messages = scraper.scrape();
  downloadJSON(messages, `${scraper.getPlatformName()}_export.json`);
}

// Works with any scraper
exportChat(new ChatGPTScraper());
exportChat(new ClaudeScraper());
```

#### 4. Interface Segregation Principle (ISP)

Clients shouldn't depend on unused interfaces:

```typescript
// ✅ Good: Separate interfaces
interface Scraper {
  scrape(): Message[];
}

interface Exporter {
  export(format: 'json' | 'csv'): Blob;
}

interface FactChecker {
  check(messages: Message[]): Annotation[];
}

// ChatGPT scraper only implements what it needs
class ChatGPTScraper implements Scraper {
  scrape(): Message[] { /* ... */ }
}

// Export service only implements export
class ExportService implements Exporter {
  export(format: 'json' | 'csv'): Blob { /* ... */ }
}
```

#### 5. Dependency Inversion Principle (DIP)

Depend on abstractions, not concretions:

```typescript
// ✅ Good: Depends on interface
class AnnotationService {
  constructor(
    private storage: AnnotationStorage,  // Interface, not class
    private factChecker: FactChecker     // Interface, not class
  ) {}

  async createAnnotation(text: string): Promise<Annotation> {
    const annotation = { text, timestamp: Date.now() };
    await this.storage.save(annotation);
    return annotation;
  }
}

// Easy to swap implementations
const service1 = new AnnotationService(
  new ChromeStorageAdapter(),
  new GeminiFactChecker()
);

const service2 = new AnnotationService(
  new IndexedDBAdapter(),      // Different storage
  new LocalMockFactChecker()   // Different fact-checker
);
```

---

### Component Architecture

```
┌─────────────────────────────────────────────────────┐
│  Content Script (content/index.ts)                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Scraper Factory                              │  │
│  │  - Detects platform (ChatGPT only for MVP)    │  │
│  │  - Returns appropriate scraper                │  │
│  └───────────────┬───────────────────────────────┘  │
│                  │                                   │
│  ┌───────────────▼───────────────────────────────┐  │
│  │  ChatGPTScraper (implements PlatformScraper)  │  │
│  │  - scrape(): Message[]                        │  │
│  │  - getURL(): string                           │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  Highlighter                                  │  │
│  │  - highlight(selector, color)                 │  │
│  │  - clearHighlights()                          │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Background Worker (background/index.ts)            │
│  ┌───────────────────────────────────────────────┐  │
│  │  Message Router                               │  │
│  │  - Routes messages between components         │  │
│  └───────────────┬───────────────────────────────┘  │
│                  │                                   │
│  ┌───────────────▼───────────────────────────────┐  │
│  │  GeminiService (implements FactChecker)       │  │
│  │  - check(messages): Annotation[]              │  │
│  │  - Uses Gemini API                            │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  StorageService (implements AnnotationStorage)│  │
│  │  - save(annotation)                           │  │
│  │  - getAll(): Annotation[]                     │  │
│  │  - Uses chrome.storage.local                  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Side Panel (sidepanel/index.tsx)                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  AnnotationList (React Component)             │  │
│  │  - Displays all annotations                   │  │
│  │  - Filter by category                         │  │
│  │  - Click to highlight on page                 │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  ControlPanel (React Component)               │  │
│  │  - "Export Chat" button                       │  │
│  │  - "Run Fact-Check" button                    │  │
│  │  - Settings button                            │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  Settings (React Component)                   │  │
│  │  - API key input                              │  │
│  │  - Toggles                                    │  │
│  │  - Clear data                                 │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

### Data Models

#### Message
```typescript
interface Message {
  id: string;          // Generated or from DOM
  role: 'user' | 'assistant' | 'system';
  text: string;        // Plain text
  html?: string;       // Optional: original HTML
  timestamp: number;   // Unix timestamp
}
```

#### Annotation
```typescript
interface Annotation {
  id: string;                     // UUID
  created: string;                // ISO timestamp
  category: 'factual' | 'critique' | 'manual';

  // Simple text selector (MVP - no Hypothesis)
  target: {
    url: string;
    quote: string;                // Exact text
  };

  note: string;                   // Explanation
  color: string;                  // Highlight color

  // Metadata
  source: 'gemini' | 'user';     // Who created it
  severity?: 'low' | 'medium' | 'high';
}
```

#### Settings
```typescript
interface Settings {
  geminiApiKey?: string;          // Encrypted
  autoFactCheck: boolean;
  theme: 'light' | 'dark' | 'auto';
}
```

---

## User Interface

### Side Panel Layout

```
┌─────────────────────────────────────┐
│  Rio                        ⚙️      │
├─────────────────────────────────────┤
│  [Export Chat] [Run Fact-Check]    │
├─────────────────────────────────────┤
│  Filters: [All] [Factual] [Manual] │
├─────────────────────────────────────┤
│                                     │
│  📌 Annotations (3)                 │
│                                     │
│  ❌ Factual Error · 2m ago          │
│  "Python was created in 1995"      │
│  Actually: 1991 by Guido van Rossum│
│  [Jump to text]                    │
│                                     │
│  ⚠️ Logical Flaw · 5m ago           │
│  "AI will replace all jobs"        │
│  Overgeneralization without evidence│
│  [Jump to text]                    │
│                                     │
│  ✏️ My Note · 10m ago               │
│  "This approach seems promising"    │
│  [Jump to text] [Delete]           │
│                                     │
└─────────────────────────────────────┘
```

### Settings Modal

```
┌─────────────────────────────────────┐
│  Settings                       ×   │
├─────────────────────────────────────┤
│                                     │
│  Gemini API Key                    │
│  ┌─────────────────────────────┐   │
│  │ sk-••••••••••••••••        │   │
│  └─────────────────────────────┘   │
│  [Validate] [How to get key →]     │
│                                     │
│  ☑ Enable automatic fact-checking  │
│  ☐ Enable search grounding         │
│                                     │
│  Theme: [Auto ▼]                   │
│                                     │
│  [Clear All Data]                  │
│                                     │
│  [Save]                            │
└─────────────────────────────────────┘
```

---

## Success Criteria

### Functional Requirements

- [ ] User can export ChatGPT conversation as JSON
- [ ] User can run fact-check on conversation
- [ ] Fact-check results appear as highlights
- [ ] User can add manual annotations
- [ ] Annotations persist across browser sessions
- [ ] Side Panel shows all annotations
- [ ] User can filter annotations by category
- [ ] Settings page works (API key storage, toggles)

### Non-Functional Requirements

- [ ] Extension loads in <500ms
- [ ] Fact-check completes in <10s for 20-message conversation
- [ ] Highlights don't break page layout
- [ ] Works on Chrome 120+
- [ ] Bundle size <1MB total
- [ ] Zero console errors in normal operation

### Quality Metrics

- [ ] 90%+ code coverage (critical paths)
- [ ] TypeScript strict mode enabled
- [ ] ESLint passes with zero errors
- [ ] Manual test checklist 100% pass

---

## Implementation Timeline

### Week 1: Foundation

**Goal:** Basic extension scaffold + ChatGPT scraper

- [ ] Day 1-2: Project setup (Vite, TypeScript, React)
- [ ] Day 3-4: Manifest V3 config, Side Panel skeleton
- [ ] Day 5: ChatGPT scraper (extract messages)
- [ ] Day 5: Export to JSON functionality

**Deliverable:** Extension loads, can export ChatGPT chat

---

### Week 2: AI Integration

**Goal:** Gemini fact-checking works end-to-end

- [ ] Day 6-7: Gemini API integration (background worker)
- [ ] Day 8-9: Fact-check UI (Side Panel)
- [ ] Day 10: Simple highlighting (CSS overlay)

**Deliverable:** Fact-check runs, highlights show on page

---

### Week 3: Manual Annotations

**Goal:** User can add their own notes

- [ ] Day 11-12: Text selection detection
- [ ] Day 13: Annotation form UI
- [ ] Day 14: Storage (chrome.storage.local)
- [ ] Day 15: Annotation list UI

**Deliverable:** User annotations work end-to-end

---

### Week 4: Polish & Testing

**Goal:** Bug-free, production-ready

- [ ] Day 16-17: Settings page (API key, toggles)
- [ ] Day 18: Bug fixes, edge cases
- [ ] Day 19: Manual testing checklist
- [ ] Day 20: Documentation (README, SETUP)

**Deliverable:** MVP ready for developer distribution

---

## Technical Debt (Acknowledged for MVP)

These are shortcuts taken for speed, to be addressed in v2:

1. **Simple Text Selectors**
   - MVP: Store exact quote only
   - v2: Hypothesis-style fuzzy anchoring

2. **No Backend**
   - MVP: chrome.storage.local only
   - v2: Optional backend sync

3. **ChatGPT Only**
   - MVP: One platform scraper
   - v2: Claude, Gemini scrapers

4. **Basic Highlighting**
   - MVP: CSS overlays, may break on scroll
   - v2: Robust DOM Range-based highlights

5. **No Graph Viz**
   - MVP: List view only
   - v2: React Flow concept graph

6. **Manual Fact-Check Trigger**
   - MVP: User clicks button
   - v2: Auto-analyze on new messages

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| ChatGPT DOM changes break scraper | Medium | High | Abstract selectors, add tests |
| Gemini API quota exceeded | Low | Medium | Handle 429, show user error |
| Highlighting breaks layout | Medium | Low | Use `position: absolute`, test on real pages |
| chrome.storage quota (10MB) | Low | Low | Warn user, implement cleanup |

---

## Open Questions

1. **Color scheme for highlights?**
   - Yellow for factual errors?
   - Blue for logical flaws?
   - Green for user notes?

2. **Default fact-check behavior?**
   - Auto-run on page load?
   - Or manual trigger only?

3. **Export format details?**
   - Include annotations in export?
   - Markdown option?

4. **Quota handling?**
   - What to do if user exceeds Gemini quota?

---

## Post-MVP Roadmap (v2)

Features to build after MVP validation:

1. **Multi-Platform Support** (Claude, Gemini)
2. **Advanced Anchoring** (Hypothesis vendored code)
3. **Graph Visualization** (React Flow)
4. **Backend Integration** (Optional sync)
5. **CopilotKit** (AI agent interface)
6. **Chrome Web Store** (Public distribution)

---

**See Also:**
- [Technical Design Docs](../docs/design/README.md)
- [Backend Server Design](../docs/design/10-backend-server.md) (Post-MVP)
- [Multiplayer Feature](../docs/design/multiplayer/README.md) (Post-MVP)

---

**Status:** Ready for development kickoff 🚀
