# Text Anchoring

**Status:** Draft v1.0
**Last Updated:** November 2025

## Problem Statement

When highlighting text on a web page, naive approaches (like `innerHTML.replace()`) break when:
- Text spans across HTML tags (`<b>`, `<i>`, `<span>`)
- The DOM structure changes (CSS class updates, dynamic content)
- Special characters or emojis are present
- The page uses Trusted Types (blocks `innerHTML` manipulation)

**Rio requires robust anchoring** that survives these challenges. We use the **Hypothesis approach**, battle-tested on millions of annotations.

**For detailed implementation:** See [Hypothesis Insights](09-hypothesis-insights.md) for reverse engineering findings, vendoring strategy, and production-tested algorithms.

## The Hypothesis Approach

### Core Principles

1. **Dual Selectors:** Store both a precise quote and a positional hint
2. **Fuzzy Matching:** Prefer exact quote match, fall back to approximate position
3. **Context Awareness:** Use prefix/suffix for disambiguation
4. **DOM-Agnostic:** Anchors work across HTML structure changes

### Standards Compliance

We use the **W3C Web Annotation Data Model** for portability:
- [W3C Annotation Model](https://www.w3.org/TR/annotation-model/)
- TextQuoteSelector: Quote + prefix/suffix context
- TextPositionSelector: Character offsets in document

## Selector Types

### TextQuoteSelector

The **primary** selector. Matches text robustly across tag boundaries.

```json
{
  "type": "TextQuoteSelector",
  "exact": "hallucinations are a known issue",
  "prefix": "However, ",
  "suffix": " with large language models."
}
```

**Advantages:**
- Works even if position shifts (content added above)
- Ignores HTML tags (`<b>halluci<i>nations</i></b>` still matches)
- Human-readable and portable

**Disadvantages:**
- Can be slow on very long documents (pathological case)
- Requires unique quote (ambiguous if text repeats)

### TextPositionSelector

The **fallback** selector. Uses character offsets in linearized text.

```json
{
  "type": "TextPositionSelector",
  "start": 1234,
  "end": 1265
}
```

**Advantages:**
- Fast lookup (direct offset)
- Works even if exact text changes slightly

**Disadvantages:**
- Breaks if content is inserted/removed above the target
- Not portable across different versions of the page

### Combined Strategy (Hypothesis Method)

**Store both, resolve with priority:**

1. Try TextQuoteSelector with prefix/suffix context
2. If ambiguous, use TextPositionSelector as a "hint" to narrow search
3. If exact quote fails, search near the position with fuzzy tolerance
4. If both fail, report anchor as "orphaned"

## Implementation

### Libraries

We use the **official Hypothesis libraries** (small, battle-tested):

```bash
npm install @hypothesis/dom-anchor-text-quote
npm install @hypothesis/dom-anchor-text-position
```

**Why not the full Hypothesis client?**
- We only need anchoring, not the entire annotation UI
- Smaller bundle size for content script
- Easier to customize and extend

### Creating Selectors

```typescript
import { TextQuoteAnchor, describe as describeTextQuote } from '@hypothesis/dom-anchor-text-quote';
import { TextPositionAnchor, describe as describeTextPosition } from '@hypothesis/dom-anchor-text-position';

function createSelectors(range: Range): Selector[] {
  const root = document.body;

  // Create TextQuoteSelector with context
  const quoteSelector = describeTextQuote(root, range, {
    prefix: 32,  // 32 chars of prefix
    suffix: 32   // 32 chars of suffix
  });

  // Create TextPositionSelector as fallback
  const positionSelector = describeTextPosition(root, range);

  return [quoteSelector, positionSelector];
}
```

### Resolving Selectors (Fuzzy Anchoring)

```typescript
import { TextQuoteAnchor } from '@hypothesis/dom-anchor-text-quote';
import { TextPositionAnchor } from '@hypothesis/dom-anchor-text-position';

async function resolveSelectors(selectors: Selector[]): Promise<Range | null> {
  const root = document.body;

  const quoteSelector = selectors.find(s => s.type === 'TextQuoteSelector');
  const positionSelector = selectors.find(s => s.type === 'TextPositionSelector');

  try {
    // First: Try exact quote match with context
    if (quoteSelector) {
      const anchor = TextQuoteAnchor.fromSelector(root, quoteSelector);
      return await anchor.toRange();
    }
  } catch (e) {
    console.warn('Quote selector failed, trying position hint...');
  }

  try {
    // Second: Try position-based lookup
    if (positionSelector) {
      const anchor = TextPositionAnchor.fromSelector(root, positionSelector);
      return await anchor.toRange();
    }
  } catch (e) {
    console.warn('Position selector failed');
  }

  // Third: Fuzzy matching near position hint
  if (quoteSelector && positionSelector) {
    return await fuzzyResolve(root, quoteSelector, positionSelector);
  }

  return null;  // Anchor orphaned
}
```

### Fuzzy Matching Algorithm

```typescript
async function fuzzyResolve(
  root: Element,
  quote: TextQuoteSelector,
  hint: TextPositionSelector
): Promise<Range | null> {
  const searchWindow = 500; // Search ±500 chars around hint

  // Extract text around the position hint
  const textContent = root.textContent || '';
  const startSearch = Math.max(0, hint.start - searchWindow);
  const endSearch = Math.min(textContent.length, hint.end + searchWindow);
  const searchText = textContent.slice(startSearch, endSearch);

  // Look for the exact quote in this window
  const quoteIndex = searchText.indexOf(quote.exact);

  if (quoteIndex !== -1) {
    const absoluteStart = startSearch + quoteIndex;
    const absoluteEnd = absoluteStart + quote.exact.length;

    // Convert back to Range
    return createRangeFromOffsets(root, absoluteStart, absoluteEnd);
  }

  // Could add Levenshtein distance matching here for typos
  return null;
}
```

## Handling Edge Cases

### 1. Short Quotes (Performance Issue)

**Problem:** Searching for very short quotes (e.g., "is") in long documents is slow.

**Solution:**
```typescript
const MIN_QUOTE_LENGTH = 8;

if (quote.exact.length < MIN_QUOTE_LENGTH) {
  // Require prefix/suffix context
  if (!quote.prefix || !quote.suffix) {
    console.warn('Short quote without context, may be slow');
  }

  // Add timeout
  const resolveWithTimeout = Promise.race([
    anchor.toRange(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 3000)
    )
  ]);
}
```

Reference: [Hypothesis Issue #3919](https://github.com/hypothesis/client/issues/3919)

### 2. Unicode & Emojis

**Problem:** Character offsets can mismatch if using byte offsets vs. Unicode codepoints.

**Solution:** Always use JavaScript's native string indexing (UTF-16):
```typescript
// ✅ Correct: JavaScript string offsets
const text = "Hello 🎉 World";
const offset = text.indexOf("World");  // 9 (correct)

// ❌ Wrong: Byte offsets (would differ)
```

### 3. Dynamic Content (Infinite Scroll)

**Problem:** Content loads after anchoring, shifting positions.

**Solution:**
- Re-anchor periodically (debounced)
- Use MutationObserver to detect DOM changes
- Store messageId as an additional hint (for chat interfaces)

```typescript
const observer = new MutationObserver(() => {
  debouncedReanchor();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### 4. Shadow DOM

**Problem:** Selectors don't cross shadow boundaries.

**Solution:**
- Anchor within each shadow root separately
- Store shadowHost selector as metadata
- Future: Use `:host` context for portability

### 5. PDF Text Layers

**Problem:** PDF.js creates synthetic text layers that may not match visible text.

**Solution:**
- Use PDF.js text-layer selectors
- Store both PDF page number and text offsets
- See: [Hypothesis PDF anchoring](https://github.com/hypothesis/client/blob/main/src/annotator/anchoring/pdf.js)

## Storage Format (W3C Compliant)

```json
{
  "id": "anno-123",
  "type": "Annotation",
  "created": "2025-11-22T10:30:00Z",
  "target": {
    "source": "https://chat.openai.com/c/abc123",
    "selector": [
      {
        "type": "TextQuoteSelector",
        "exact": "hallucinations are a known issue",
        "prefix": "However, ",
        "suffix": " with large language models."
      },
      {
        "type": "TextPositionSelector",
        "start": 1234,
        "end": 1265
      }
    ]
  },
  "body": {
    "type": "TextualBody",
    "value": "Factually incorrect: Recent studies show...",
    "purpose": "commenting"
  },
  "motivation": "critiquing"
}
```

## Highlighting (Without innerHTML)

Since we can't use `innerHTML` on pages with Trusted Types, we create overlay elements:

```typescript
function highlightRange(range: Range, color: string): void {
  const rects = range.getClientRects();

  for (const rect of rects) {
    const highlight = document.createElement('div');
    highlight.className = 'rio-highlight';
    highlight.style.cssText = `
      position: absolute;
      left: ${rect.left + window.scrollX}px;
      top: ${rect.top + window.scrollY}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: ${color};
      opacity: 0.3;
      pointer-events: none;
      z-index: 999999;
    `;

    document.body.appendChild(highlight);
  }
}
```

**Advantages:**
- Bypasses Trusted Types (we're creating elements, not parsing HTML)
- Works across all sites
- Easy to remove/update

**Disadvantages:**
- Position can drift on scroll/resize (need to reposition)
- More DOM nodes (use virtualization for many highlights)

## Performance Tuning

### Benchmarks (Target)
- Create selectors: <10ms
- Resolve exact quote: <50ms
- Fuzzy resolve: <200ms
- Highlight 100 spans: <100ms

### Optimizations
1. **Debounce anchoring** during rapid DOM changes
2. **Cache resolved ranges** (invalidate on mutation)
3. **Chunk large documents** (anchor in viewport first)
4. **Web Worker for fuzzy search** (avoid main thread blocking)
5. **Use requestIdleCallback** for non-critical re-anchoring

## Testing

### Regression Suite

Use the Hypothesis anchoring test datasets:
- [Hypothesis Anchoring Tests](https://github.com/hypothesis/client/tree/main/src/annotator/anchoring/test)
- [Standalone Anchoring Demo](https://github.com/judell/StandaloneAnchoring)

**Test cases:**
- Text across `<b>`, `<i>`, `<span>` tags
- Unicode characters and emojis
- Very long documents (10k+ words)
- Ambiguous quotes (repeated text)
- Dynamic content insertion

### Manual Test Pages

Create demo pages with:
- ChatGPT-like message structure
- Gemini-like response formatting
- Wikipedia articles (generic content)
- PDF.js viewer (future)

## Migration Path

If we need to switch from Hypothesis libs in the future:

1. **Storage format is W3C-compliant** → portable
2. **Selector interface is standardized** → easy to swap implementations
3. **Could use:**
   - Apache Annotator (official W3C implementation)
   - Custom fuzzy matching (simpler but less robust)
   - Server-side anchoring (for complex PDFs)

---

**Previous:** [← Architecture](01-architecture.md) | **Next:** [AI Integration →](03-ai-integration.md)
