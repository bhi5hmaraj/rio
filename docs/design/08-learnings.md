# Lessons Learned from Prototyping

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

This document captures the critical technical insights gained during the Tampermonkey script prototyping phase. These learnings directly shaped the Chrome Extension architecture and prevented major pitfalls.

---

## The "Rio" Script Legacy

Our journey from a simple script to the extension architecture was driven by specific failures and discoveries. These constraints define our design decisions.

---

## 1. The "TrustedHTML" Wall (Gemini)

### Discovery

**When:** Attempting to inject UI into `gemini.google.com`
**Problem:** Impossible to inject *any* complex UI (React, iframes, HTML strings) directly into the page.

### Root Cause

Gemini enforces **Trusted Types**, a browser security feature that blocks:
- `element.innerHTML = string` (throws TypeError)
- `document.write(html)` (blocked)
- `eval()` and `Function()` (blocked)
- `script.src = url` (requires nonce)

### Evidence

```javascript
// ❌ This fails on gemini.google.com
const div = document.createElement('div');
div.innerHTML = '<span>Hello</span>';
// TypeError: Failed to set the 'innerHTML' property on 'Element':
// This document requires 'TrustedHTML' assignment.

// ❌ This also fails
const iframe = document.createElement('iframe');
iframe.srcdoc = '<html>...</html>';
// TypeError: Failed to set the 'srcdoc' property
```

### Solution

**Use Chrome Side Panel API** instead of content script injection:
- Side Panel runs in extension context (chrome-extension://)
- Not subject to page CSP or Trusted Types
- Can use React, external scripts, and full HTML

### Impact on Architecture

✅ **Adopted:** Side Panel as primary UI surface
❌ **Abandoned:** Content script-based UI injection

**Reference:** [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

---

## 2. The CSP Script Block (ChatGPT)

### Discovery

**When:** Attempting to load React inside an iframe on `chat.openai.com`
**Problem:** Cannot execute inline scripts or load external libraries, even inside an iframe.

### Root Cause

ChatGPT's Content Security Policy (CSP) header:
```
script-src 'self' 'nonce-XYZ' https://cdn.openai.com;
```

This blocks:
- Inline `<script>` tags without the correct nonce
- External scripts from CDNs (e.g., `unpkg`, `jsdelivr`)
- `eval()` and `new Function()`

### Evidence

```html
<!-- ❌ This fails (no nonce) -->
<script>
  console.log('Hello');
</script>

<!-- ❌ This also fails (wrong origin) -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
```

Even inside an iframe:
```javascript
const iframe = document.createElement('iframe');
iframe.srcdoc = `
  <html>
    <body>
      <script src="https://unpkg.com/react@18"></script>
    </body>
  </html>
`;
document.body.appendChild(iframe);
// CSP blocks the script load
```

### Solution

**Side Panel + Content Script Separation:**
- Side Panel hosts React UI (no CSP restrictions)
- Content Script only does minimal DOM operations (no HTML injection)

### Impact on Architecture

✅ **Content Script Role:** Scraping and highlighting only (no UI)
✅ **Side Panel Role:** All UI rendering

**Reference:** [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

## 3. DOM Fragility & Anchoring

### Discovery

**When:** Highlighting text that spans HTML tags
**Problem:** `String.indexOf()` fails to find text like "**bold** text" when HTML is `<b>bold</b> text`.

### Root Cause

Naive string search works on `innerHTML` (with tags), not `textContent` (visible text):

```javascript
const html = '<b>Neural</b> networks';
const text = element.textContent; // "Neural networks"

// ❌ This fails
html.indexOf('Neural networks');    // -1 (not found)

// ✅ This works, but how to highlight?
text.indexOf('Neural networks');    // 0 (found)
```

### Failed Approaches

1. **Replace innerHTML:**
   ```javascript
   // ❌ Breaks HTML structure
   element.innerHTML = element.innerHTML.replace(
     'Neural networks',
     '<mark>Neural networks</mark>'
   );
   // Result: <b>Neural</b> networks → <mark><b>Neural</b> networks</mark>
   // But what if it's <b>Neu<i>ral</i></b> networks?
   ```

2. **TreeWalker search:**
   ```javascript
   // ✅ Works but slow and complex
   const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
   let node;
   while (node = walker.nextNode()) {
     if (node.textContent.includes('Neural')) {
       // Now what? Need to wrap in <mark>, but how?
     }
   }
   ```

### Solution

**Use Hypothesis Text Anchoring Libraries:**
- `@hypothesis/dom-anchor-text-quote`: Fuzzy search across DOM boundaries
- `@hypothesis/dom-anchor-text-position`: Character offset-based search

**How it works:**
1. Store both quote and position
2. Search for exact quote first
3. If ambiguous, use position as hint
4. Return a `Range` object (not a string index)

```typescript
import { TextQuoteAnchor } from '@hypothesis/dom-anchor-text-quote';

const selector = {
  type: 'TextQuoteSelector',
  exact: 'Neural networks',
  prefix: 'about ',
  suffix: ' and their'
};

const anchor = TextQuoteAnchor.fromSelector(document.body, selector);
const range = await anchor.toRange();
// Returns Range spanning "Neural networks" even if it's <b>Neu<i>ral</i></b> networks
```

### Impact on Architecture

✅ **Adopted:** Hypothesis anchoring libraries (mandatory)
❌ **Abandoned:** Custom string-search-and-replace logic

**Reference:** [Hypothesis Fuzzy Anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/)

---

## 4. API Payload Constraints

### Discovery

**When:** Using Gemini API with Google Search tools
**Problem:** Cannot use `responseMimeType: "application/json"` together with `tools: [{ googleSearch: {} }]`.

### Root Cause

Gemini API constraint (as of Nov 2025):
> "The `responseMimeType` parameter is not supported when using tools."

### Evidence

```typescript
// ❌ This request is rejected (400 Bad Request)
const request = {
  contents: [...],
  tools: [{ googleSearch: {} }],
  generationConfig: {
    responseMimeType: "application/json"
  }
};

// Error: "responseMimeType is not supported with tools"
```

### Solution

**Rely on strong system instruction** to enforce JSON output:

```typescript
const systemInstruction = `
CRITICAL: Output valid JSON array only.
No markdown, no code blocks, no preamble.

Format:
[
  {"category": "...", "quote": "...", "explanation": "..."}
]
`;

const request = {
  systemInstruction: { parts: [{ text: systemInstruction }] },
  contents: [...],
  tools: [{ googleSearch: {} }]
  // No responseMimeType
};
```

Then strip markdown in post-processing:
```typescript
const text = response.candidates[0].content.parts[0].text;
const cleaned = text
  .replace(/^```json\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();
const parsed = JSON.parse(cleaned);
```

### Impact on Architecture

✅ **Adopted:** Strong prompt engineering + post-processing
✅ **Fallback:** Regex extraction if JSON parsing fails

**Reference:** [Gemini API Documentation](https://ai.google.dev/docs)

---

## 5. Unicode & Base64 Encoding

### Discovery

**When:** Generating IDs from message text containing emojis
**Problem:** Standard `btoa()` function crashes on Unicode characters.

### Root Cause

`btoa()` expects ASCII strings (0-255), but JavaScript strings are UTF-16:

```javascript
// ❌ This crashes
const id = btoa("Hello 🎉");
// DOMException: Failed to execute 'btoa' on 'Window':
// The string to be encoded contains characters outside of the Latin1 range.
```

### Solution

**Encode to UTF-8 first using `encodeURIComponent` + `unescape`:**

```javascript
// ✅ This works
function safeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

const id = safeBase64("Hello 🎉");  // "SGVsbG8g8J+OiQ=="

// Decode:
function safeBase64Decode(str) {
  return decodeURIComponent(escape(atob(str)));
}

safeBase64Decode(id);  // "Hello 🎉"
```

**Alternative (modern):**
```javascript
// Using TextEncoder (supported in Chrome 38+)
function safeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = String.fromCharCode(...bytes);
  return btoa(binString);
}
```

### Impact on Architecture

✅ **Adopted:** `safeBase64()` utility for all encoding
❌ **Avoided:** Direct `btoa()` usage

**Reference:** [MDN btoa()](https://developer.mozilla.org/en-US/docs/Web/API/btoa)

---

## 6. The "Hybrid" Necessity

### Discovery

**When:** Running local analyzer server (Python/Node.js) alongside Tampermonkey script
**Problem:** Poor UX - users must:
1. Install Tampermonkey
2. Install script
3. Install Python/Node
4. Run `python server.py` in terminal
5. Keep terminal open while browsing

### Why This Architecture Existed

**Tampermonkey ("Dumb Client") Limitations:**
- Cannot make cross-origin requests (CORS)
- Limited to page context (CSP restrictions)
- No persistent storage beyond `GM_setValue`

**Localhost Server ("Smart Server") Capabilities:**
- Full Python ecosystem (spaCy, transformers, etc.)
- No CORS restrictions
- Real database (SQLite, PostgreSQL)

### The Problem

**UX is terrible:**
- 5 setup steps instead of 1
- Terminal must stay open
- Server crashes → extension breaks
- Not distributable (can't publish to Chrome Web Store)

### Solution

**Chrome Extension MV3 Architecture:**
- **Background Service Worker** replaces the "smart server"
  - Can make cross-origin `fetch()` (via `host_permissions`)
  - Persistent storage (`chrome.storage`)
  - No terminal required
- **BYOK (Bring Your Own Key)** replaces self-hosted models
  - User provides Gemini API key
  - No server infrastructure needed
  - Scales to millions of users at $0 hosting cost

### Impact on Architecture

✅ **Adopted:** Chrome Extension with Background Worker
✅ **Adopted:** BYOK model (user API keys)
❌ **Abandoned:** Localhost server requirement

---

## 7. Performance: Short Quote Pathology

### Discovery

**When:** Anchoring very short quotes (1-3 characters) in long documents
**Problem:** Anchoring takes 5-10 seconds and blocks the UI.

### Root Cause

The Hypothesis library searches linearly through the document for the exact quote. Short quotes like "is" or "the" appear thousands of times, causing:
- 10,000+ candidate matches
- Prefix/suffix comparison for each
- O(n × m) complexity (n = quote occurrences, m = context length)

### Evidence

```typescript
// ❌ This is slow on a 50k word document
const selector = {
  type: 'TextQuoteSelector',
  exact: 'is',  // Appears 2,000+ times
  prefix: '',
  suffix: ''
};

const anchor = TextQuoteAnchor.fromSelector(document.body, selector);
const range = await anchor.toRange();
// Takes 8 seconds 😱
```

### Solution

**Strategies:**

1. **Require minimum quote length:**
   ```typescript
   const MIN_QUOTE_LENGTH = 8;

   if (selector.exact.length < MIN_QUOTE_LENGTH) {
     throw new Error('Quote too short');
   }
   ```

2. **Always include prefix/suffix for short quotes:**
   ```typescript
   const CONTEXT_LENGTH = 32;

   if (selector.exact.length < 20) {
     // Force context for disambiguation
     selector.prefix = text.slice(offset - CONTEXT_LENGTH, offset);
     selector.suffix = text.slice(offset + length, offset + length + CONTEXT_LENGTH);
   }
   ```

3. **Add timeout:**
   ```typescript
   const ANCHOR_TIMEOUT = 3000; // 3s

   const rangePromise = anchor.toRange();
   const timeoutPromise = new Promise((_, reject) =>
     setTimeout(() => reject(new Error('Timeout')), ANCHOR_TIMEOUT)
   );

   const range = await Promise.race([rangePromise, timeoutPromise]);
   ```

4. **Use position hint to narrow search:**
   ```typescript
   // Search only ±500 chars around the position hint
   const searchWindow = text.slice(position - 500, position + 500);
   ```

### Impact on Architecture

✅ **Adopted:** Minimum quote length (8 chars)
✅ **Adopted:** Mandatory prefix/suffix for short quotes
✅ **Adopted:** 3-second timeout with fallback

**Reference:** [Hypothesis Issue #3919](https://github.com/hypothesis/client/issues/3919)

---

## 8. Storage Limits (chrome.storage)

### Discovery

**When:** Storing 100+ annotations for a long conversation
**Problem:** Hit `chrome.storage.local` quota (10 MB total).

### Root Cause

**Per-extension limit:** 10 MB
**Typical annotation size:** ~1 KB (with full quote, context, explanation)

**Math:**
- 100 annotations × 1 KB = 100 KB ✅
- 1,000 annotations × 1 KB = 1 MB ✅
- 10,000 annotations × 1 KB = 10 MB ❌ (quota exceeded)

### Solution

**Strategies:**

1. **Compress data:**
   ```typescript
   import pako from 'pako';

   const compressed = pako.deflate(JSON.stringify(data), { to: 'string' });
   await chrome.storage.local.set({ annotations_gz: compressed });
   ```

2. **Paginate/limit:**
   ```typescript
   const MAX_ANNOTATIONS_PER_PAGE = 100;

   if (annotations.length > MAX_ANNOTATIONS_PER_PAGE) {
     annotations = annotations.slice(-MAX_ANNOTATIONS_PER_PAGE);
   }
   ```

3. **Use IndexedDB for large datasets:**
   ```typescript
   // chrome.storage is limited, but IndexedDB is not
   const db = await openDB('rio', 1, {
     upgrade(db) {
       db.createObjectStore('annotations', { keyPath: 'id' });
     }
   });

   await db.put('annotations', annotation);
   ```

4. **Clear old data:**
   ```typescript
   const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

   const oldAnnotations = annotations.filter(a =>
     Date.now() - a.created > ONE_MONTH
   );

   // Prompt user: "Delete 500 annotations older than 1 month?"
   ```

### Impact on Architecture

✅ **Adopted:** Limit to 100 annotations per page (v1)
✅ **Future:** Migrate to IndexedDB for power users

---

## 9. Service Worker Lifecycle (MV3)

### Discovery

**When:** Background script stops responding after 30 seconds
**Problem:** Service Workers are event-driven and shut down when idle.

### Root Cause

**MV3 Service Workers are not persistent:**
- Wake up on events (messages, alarms, etc.)
- Shut down after 30s of inactivity
- Cannot hold long-lived state in memory

**This breaks:**
```javascript
// ❌ This state is lost when worker sleeps
let activeAnalysis = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'startAnalysis') {
    activeAnalysis = { id: msg.id, status: 'running' };
  }
  if (msg.action === 'checkStatus') {
    return activeAnalysis?.status;  // null if worker restarted!
  }
});
```

### Solution

**Use `chrome.storage` for persistence:**

```typescript
// ✅ Store state in chrome.storage
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action === 'startAnalysis') {
    await chrome.storage.session.set({
      activeAnalysis: { id: msg.id, status: 'running' }
    });
  }

  if (msg.action === 'checkStatus') {
    const { activeAnalysis } = await chrome.storage.session.get('activeAnalysis');
    return activeAnalysis?.status;
  }
});
```

**Use `chrome.alarms` for periodic tasks:**

```typescript
// Set up alarm on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });
});

// Handle alarm (worker wakes up)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupOldAnnotations();
  }
});
```

### Impact on Architecture

✅ **Adopted:** `chrome.storage.session` for ephemeral state
✅ **Adopted:** `chrome.storage.local` for persistent state
❌ **Avoided:** In-memory state in background worker

**Reference:** [Chrome Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)

---

## Summary of Key Decisions

| Problem | Solution | Impact |
|---------|----------|--------|
| Trusted Types (Gemini) | Use Side Panel API | ✅ Core architecture decision |
| CSP blocks (ChatGPT) | Content script = minimal DOM ops only | ✅ Component separation |
| DOM fragility | Hypothesis text anchoring libraries | ✅ Mandatory dependency |
| Gemini API + Search | Strong prompt, no MIME type | ✅ Workaround documented |
| Unicode in btoa() | `safeBase64()` utility | ✅ Utility function |
| UX: Localhost server | Chrome Extension + BYOK | ✅ Distribution model |
| Short quote performance | Min length, timeout, context | ✅ Performance tuning |
| Storage limits | Pagination, future IndexedDB | ✅ Scalability plan |
| Service worker sleep | chrome.storage for state | ✅ State management |

---

## What We Avoided (Dead Ends)

❌ **Custom text search algorithm** → Use Hypothesis libs instead
❌ **innerHTML manipulation** → Use overlay elements
❌ **Content script UI injection** → Use Side Panel
❌ **Self-hosted LLM server** → Use BYOK (user API keys)
❌ **Eval-based JSON parsing** → Use JSON.parse with error handling
❌ **Persistent background page (MV2)** → Migrate to Service Workers (MV3)

---

**Previous:** [← Implementation Plan](07-implementation.md) | **Home:** [Design Docs](README.md)
