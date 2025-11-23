# SOLID Principles Analysis - Rio Architecture

**Date:** 2025-11-23
**Status:** Architecture Review
**Focus:** Scraper adapter pattern and extensibility

## Executive Summary

Current architecture has **3 critical SOLID violations** that will cause brittleness as ChatGPT UI changes and we add new platforms. The scraper layer is the highest priority fix.

### Critical Issues (P0)

1. ❌ **No Adapter Pattern for Scrapers** - Hard-coded ChatGPT dependency
2. ❌ **Background Service Worker is God Object** - Too many responsibilities
3. ❌ **No Storage Abstraction** - Direct chrome.storage calls everywhere

### Medium Issues (P1)

4. ⚠️ **Switch Statement Pattern for Messages** - Not extensible
5. ⚠️ **No Platform Detection** - Can't auto-detect which scraper to use

---

## Issue 1: No Adapter Pattern for Scrapers (CRITICAL)

### Current Problem

**File:** `extension/src/content/index.ts:11`
```typescript
import { scrapeConversation, getConversationId } from './scrapers/chatgpt';
```

**Violations:**
- ❌ **Open/Closed Principle** - Must modify content/index.ts to add new platforms
- ❌ **Dependency Inversion** - Depends on concrete implementation, not abstraction
- ❌ **Single Responsibility** - content/index.ts knows about ChatGPT specifics

**Impact:**
- ChatGPT UI changes → must modify chatgpt.ts
- Adding Claude.ai support → must modify content/index.ts AND create new scraper
- Can't swap scrapers at runtime
- Can't test with mock scrapers
- Future platforms (Gemini Chat, Claude) require core file changes

### Proposed Solution: Adapter Pattern

**Step 1: Define PlatformScraper Interface**

Create `src/content/scrapers/base.ts`:
```typescript
/**
 * Platform-agnostic scraper interface
 * All platform scrapers (ChatGPT, Claude, Gemini) implement this
 */
export interface PlatformScraper {
  /**
   * Platform identifier
   */
  readonly platform: 'chatgpt' | 'claude' | 'gemini';

  /**
   * Check if this scraper can run on current page
   */
  canScrape(): boolean;

  /**
   * Extract conversation ID from URL or page
   */
  getConversationId(): string | null;

  /**
   * Scrape full conversation
   */
  scrapeConversation(): ConversationData;

  /**
   * Pre-process DOM (add IDs, etc.)
   */
  preprocessDOM?(): void;

  /**
   * Get platform-specific metadata
   */
  getMetadata?(): PlatformMetadata;
}

export interface ConversationData {
  conversationId: string | null;
  conversationUrl: string;
  messages: ChatMessage[];
  scrapedAt: number;
}

export interface PlatformMetadata {
  platform: string;
  version?: string;
  uiDetected?: string;
}
```

**Step 2: Refactor ChatGPTScraper to Implement Interface**

Update `src/content/scrapers/chatgpt.ts`:
```typescript
import type { PlatformScraper, ConversationData } from './base';
import type { ChatMessage } from '@/shared/types';

export class ChatGPTScraper implements PlatformScraper {
  readonly platform = 'chatgpt' as const;

  private readonly SELECTORS = {
    message: [
      '[data-message-author-role] .prose',
      '.message .markdown',
      '[data-testid="conversation-turn"]',
    ],
    messageWrapper: [
      '[data-message-author-role]',
      '.message[data-role]',
    ],
  };

  canScrape(): boolean {
    const url = window.location.href;
    return url.includes('chatgpt.com') || url.includes('chat.openai.com');
  }

  getConversationId(): string | null {
    const url = window.location.href;
    const match = url.match(/\/c\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  scrapeConversation(): ConversationData {
    const conversationId = this.getConversationId();
    const conversationUrl = window.location.href;

    const messageElements = this.querySelectorAllWithFallbacks(this.SELECTORS.message);

    if (!messageElements || messageElements.length === 0) {
      throw new Error('Could not find any messages on the page. ChatGPT UI may have changed.');
    }

    const messages: ChatMessage[] = [];

    messageElements.forEach((messageEl, index) => {
      const wrapper = messageEl.closest('[data-message-author-role]');
      if (!wrapper) return;

      const role = wrapper.getAttribute('data-message-author-role') as 'user' | 'assistant' | 'system';
      const content = (messageEl as HTMLElement).innerHTML.trim();

      if (!role || !content) return;

      messages.push({
        role,
        content,
        messageIndex: index,
        timestamp: Date.now(),
      });
    });

    return {
      conversationId,
      conversationUrl,
      messages,
      scrapedAt: Date.now(),
    };
  }

  preprocessDOM(): void {
    const messageElements = this.querySelectorAllWithFallbacks(this.SELECTORS.message);
    if (!messageElements) return;

    messageElements.forEach((el, index) => {
      el.id = `rio-msg-${index}`;
    });
  }

  private querySelectorAllWithFallbacks(selectors: string[]): NodeListOf<Element> | null {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Rio: Found ${elements.length} elements via selector: ${selector}`);
        return elements;
      }
    }
    console.warn('Rio: No elements found with selectors:', selectors);
    return null;
  }
}
```

**Step 3: Create ScraperFactory with Platform Detection**

Create `src/content/scrapers/factory.ts`:
```typescript
import type { PlatformScraper } from './base';
import { ChatGPTScraper } from './chatgpt';

/**
 * Factory to detect and return the appropriate scraper
 * for the current platform
 */
export class ScraperFactory {
  private static scrapers: PlatformScraper[] = [
    new ChatGPTScraper(),
    // Future: new ClaudeScraper(),
    // Future: new GeminiScraper(),
  ];

  /**
   * Auto-detect platform and return appropriate scraper
   */
  static getScraper(): PlatformScraper | null {
    for (const scraper of this.scrapers) {
      if (scraper.canScrape()) {
        console.log(`Rio: Detected platform: ${scraper.platform}`);
        return scraper;
      }
    }

    console.warn('Rio: No compatible scraper found for this page');
    return null;
  }

  /**
   * Get scraper by platform name (for testing)
   */
  static getScraperByPlatform(platform: string): PlatformScraper | null {
    return this.scrapers.find(s => s.platform === platform) || null;
  }

  /**
   * Register a new scraper (for extensibility)
   */
  static registerScraper(scraper: PlatformScraper): void {
    this.scrapers.push(scraper);
  }
}
```

**Step 4: Update Content Script to Use Factory**

Update `src/content/index.ts`:
```typescript
import { ScraperFactory } from './scrapers/factory';
import type { PlatformScraper } from './scrapers/base';

let scraper: PlatformScraper | null = null;
let conversationId: string | null = null;

function init() {
  // Auto-detect platform and get appropriate scraper
  scraper = ScraperFactory.getScraper();

  if (!scraper) {
    console.warn('Rio: Not running on a supported platform');
    return;
  }

  conversationId = scraper.getConversationId();
  console.log('Rio: Platform:', scraper.platform);
  console.log('Rio: Conversation ID:', conversationId);

  // Inject Rio styles
  injectStyles();

  // Set up message listener
  setupMessageListener();

  // Set up text selection listener for HUD
  setupSelectionListener();

  console.log('Rio: Content script initialized');
}

function handleScrapeNow(sendResponse: (response: unknown) => void) {
  try {
    if (!scraper) {
      throw new Error('No scraper available for this platform');
    }

    const data = scraper.scrapeConversation();
    sendResponse({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Rio: Error scraping conversation', error);
    sendResponse({
      success: false,
      error: (error as Error).message,
    });
  }
}
```

### Benefits of This Approach

✅ **Open/Closed** - Add new platforms without modifying existing code
✅ **Dependency Inversion** - Content script depends on `PlatformScraper` interface
✅ **Single Responsibility** - Each scraper handles one platform
✅ **Liskov Substitution** - All scrapers are interchangeable
✅ **Testability** - Can inject mock scrapers for testing
✅ **Future-proof** - ChatGPT UI changes only affect chatgpt.ts

### Adding New Platform (Example: Claude)

```typescript
// src/content/scrapers/claude.ts
export class ClaudeScraper implements PlatformScraper {
  readonly platform = 'claude' as const;

  canScrape(): boolean {
    return window.location.href.includes('claude.ai');
  }

  getConversationId(): string | null {
    // Claude-specific logic
  }

  scrapeConversation(): ConversationData {
    // Claude-specific selectors
  }
}

// Factory automatically picks it up:
// ScraperFactory.registerScraper(new ClaudeScraper());
```

**No changes needed to content/index.ts or background/index.ts!**

---

## Issue 2: Background Service Worker God Object

### Current Problem

**File:** `extension/src/background/index.ts` (224 lines)

**Responsibilities:**
1. Side panel management
2. Context menu setup
3. Message routing
4. Conversation scraping
5. Fact-checking
6. Annotation storage
7. Export handling
8. Storage initialization

**Violations:**
- ❌ **Single Responsibility Principle** - Doing 8 different things
- ❌ **Open/Closed** - Switch statement for messages

### Proposed Solution: Service Layer

**Directory structure:**
```
src/background/
├── index.ts              # Entry point, delegates to services
├── services/
│   ├── StorageService.ts     # All chrome.storage operations
│   ├── MessageRouter.ts      # Message routing
│   ├── SidePanelService.ts   # Side panel management
│   └── FactCheckService.ts   # LiteLLM integration (Week 3)
└── handlers/
    ├── ScrapeHandler.ts
    ├── FactCheckHandler.ts
    ├── AnnotationHandler.ts
    └── ExportHandler.ts
```

**Example: StorageService**

Create `src/background/services/StorageService.ts`:
```typescript
import type { Annotation, RioSettings, Category } from '@/shared/types';

/**
 * Centralized storage service
 * All chrome.storage operations go through here
 */
export class StorageService {
  /**
   * Get annotations for a conversation
   */
  async getAnnotations(conversationId: string): Promise<Annotation[]> {
    const result = await chrome.storage.local.get('annotations');
    const annotations = result.annotations || {};
    return annotations[conversationId] || [];
  }

  /**
   * Save annotation
   */
  async saveAnnotation(annotation: Annotation): Promise<void> {
    const result = await chrome.storage.local.get('annotations');
    const annotations = result.annotations || {};

    if (!annotations[annotation.conversationId]) {
      annotations[annotation.conversationId] = [];
    }

    annotations[annotation.conversationId].push(annotation);
    await chrome.storage.local.set({ annotations });

    // Check quota
    await this.checkQuota();
  }

  /**
   * Get settings
   */
  async getSettings(): Promise<RioSettings | null> {
    const result = await chrome.storage.local.get('settings');
    return result.settings || null;
  }

  /**
   * Save settings (with API key encryption)
   */
  async saveSettings(settings: RioSettings): Promise<void> {
    // TODO: Encrypt API key before storing
    await chrome.storage.local.set({ settings });
  }

  /**
   * Get custom categories
   */
  async getCustomCategories(): Promise<Category[]> {
    const result = await chrome.storage.local.get('customCategories');
    return result.customCategories || [];
  }

  /**
   * Check storage quota (warn at 8MB)
   */
  private async checkQuota(): Promise<void> {
    const usage = await chrome.storage.local.getBytesInUse();
    const limit = chrome.storage.local.QUOTA_BYTES;
    const percentUsed = (usage / limit) * 100;

    if (percentUsed > 80) {
      console.warn(`Rio: Storage quota warning: ${percentUsed.toFixed(1)}% used`);
    }
  }

  /**
   * Initialize storage with defaults
   */
  async initialize(): Promise<void> {
    const result = await chrome.storage.local.get(['settings', 'annotations', 'customCategories']);

    if (!result.settings) {
      await this.saveSettings({
        aiConfig: {
          litellmEndpoint: 'http://localhost:4000',
          provider: 'gemini',
          apiKey: '',
          model: 'gemini-2.5-flash',
        },
        preferences: {
          autoFactCheck: false,
          showHUD: true,
          highlightStyle: 'underline',
        },
      });
    }

    if (!result.annotations) {
      await chrome.storage.local.set({ annotations: {} });
    }

    if (!result.customCategories) {
      await chrome.storage.local.set({ customCategories: [] });
    }

    console.log('Rio: Storage initialized');
  }
}

// Singleton instance
export const storageService = new StorageService();
```

**Refactored background/index.ts:**
```typescript
import { storageService } from './services/StorageService';
import { MessageRouter } from './services/MessageRouter';

console.log('Rio: Background service worker loaded');

// Initialize storage
chrome.runtime.onInstalled.addListener(async () => {
  await storageService.initialize();

  // Setup context menu
  chrome.contextMenus.create({
    id: 'rio-annotate',
    title: 'Annotate with Rio',
    contexts: ['selection'],
  });
});

// Setup message routing
const messageRouter = new MessageRouter();
chrome.runtime.onMessage.addListener(messageRouter.handleMessage.bind(messageRouter));

// Side panel management
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rio-annotate' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_ANNOTATION_FORM',
      payload: { selectedText: info.selectionText },
    });
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
```

**Now it's 30 lines instead of 224!**

---

## Issue 3: No Platform Detection

### Current Problem

Content script assumes it's always running on ChatGPT. What if:
- User loads Rio on unsupported site
- Future: Multiple platforms supported, need to detect which one

### Solution (Already Covered)

The `ScraperFactory.getScraper()` pattern solves this:
```typescript
scraper = ScraperFactory.getScraper();

if (!scraper) {
  console.warn('Rio: Not running on a supported platform');
  return; // Early exit
}
```

Each scraper's `canScrape()` method handles detection:
```typescript
canScrape(): boolean {
  const url = window.location.href;
  return url.includes('chatgpt.com') || url.includes('chat.openai.com');
}
```

---

## Implementation Priority

### Week 2 (Current)
1. ✅ **Implement Adapter Pattern for Scrapers** (P0 - CRITICAL)
   - Base interface
   - ChatGPTScraper class
   - ScraperFactory
   - Update content/index.ts

2. ✅ **Create StorageService** (P0 - Required for Week 2 tasks)
   - Move all chrome.storage logic
   - Encryption for API keys
   - Quota monitoring

### Week 3
3. ⚠️ **Refactor Background Service Worker** (P1)
   - MessageRouter
   - FactCheckService
   - Handler classes

### Post-MVP
4. ⚠️ **Add More Platform Scrapers** (P2)
   - ClaudeScraper
   - GeminiScraper

---

## Testing Strategy

### Unit Tests for Scrapers

```typescript
describe('ChatGPTScraper', () => {
  let scraper: ChatGPTScraper;

  beforeEach(() => {
    scraper = new ChatGPTScraper();
  });

  it('should detect ChatGPT URLs', () => {
    global.window = { location: { href: 'https://chatgpt.com/c/abc-123' } };
    expect(scraper.canScrape()).toBe(true);
  });

  it('should extract conversation ID', () => {
    global.window = { location: { href: 'https://chatgpt.com/c/abc-123-def' } };
    expect(scraper.getConversationId()).toBe('abc-123-def');
  });
});
```

### Integration Tests for ScraperFactory

```typescript
describe('ScraperFactory', () => {
  it('should return ChatGPTScraper for ChatGPT URLs', () => {
    global.window = { location: { href: 'https://chatgpt.com/c/test' } };
    const scraper = ScraperFactory.getScraper();
    expect(scraper?.platform).toBe('chatgpt');
  });

  it('should return null for unsupported platforms', () => {
    global.window = { location: { href: 'https://example.com' } };
    const scraper = ScraperFactory.getScraper();
    expect(scraper).toBeNull();
  });
});
```

---

## Decision

**Implement Adapter Pattern for scrapers IMMEDIATELY (Week 2).**

This is the foundation for extensibility and will prevent technical debt as we add:
- More platforms (Claude, Gemini)
- ChatGPT UI change handling
- Testing infrastructure

StorageService should also be implemented in Week 2 since it's required for the storage layer task.

Background service refactoring can wait until Week 3 or 4 (nice-to-have but not critical).
