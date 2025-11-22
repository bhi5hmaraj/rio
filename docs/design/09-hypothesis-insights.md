# Hypothesis Reverse Engineering Insights

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

This document captures critical insights from reverse engineering the [Hypothesis](https://hypothes.is) web annotation client, which provides battle-tested solutions for text anchoring, threading, and UI patterns that Rio will adapt.

**Source:** [hypothesis/client](https://github.com/hypothesis/client) (BSD-2-Clause)

---

## Dependency Strategy: Hybrid Approach ✅

### Decision: Vendor + NPM Dependencies

**NPM Dependencies:**
```json
{
  "dependencies": {
    "approx-string-match": "^2.0.0"
  }
}
```

**Vendored Code:** Copy `src/annotator/anchoring/*.ts` from Hypothesis client (~2,500 lines)

**Rationale:**
- ✅ Published npm packages lack key features (position hints, TextRange utilities)
- ✅ Vendored code is stable (infrequent upstream changes)
- ✅ Full control for Rio-specific adaptations
- ✅ BSD-2-Clause license permits this with attribution
- ✅ Small footprint (2,500 lines vs 100K+ for full fork)

### What NOT to Do

❌ **Fork entire repo:** 95% unused code, difficult to maintain
❌ **Use `hypothesis` npm package:** Complete application, not a library
❌ **Reimplement from scratch:** Years of production-tested code

---

## Core Anchoring Architecture

### Anchor Types (4 Classes)

Hypothesis uses a polymorphic anchor system that converts between DOM Ranges ↔ W3C Selectors:

```typescript
// Base abstraction
interface Anchor {
  static fromRange(root: Element, range: Range): Anchor;
  static fromSelector(root: Element, selector: Selector): Anchor;
  toRange(options?: AnchorOptions): Promise<Range>;
  toSelector(): Selector;
}

// 1. TextQuoteAnchor - Fuzzy matching (primary)
class TextQuoteAnchor implements Anchor {
  exact: string;
  context: { prefix?: string; suffix?: string };

  toRange(options?: { hint?: number }): Promise<Range>;
  // hint = position offset for faster search
}

// 2. TextPositionAnchor - Character offsets (fallback)
class TextPositionAnchor implements Anchor {
  start: number;
  end: number;

  toRange(): Promise<Range>;
}

// 3. RangeAnchor - XPath-based (most specific)
class RangeAnchor implements Anchor {
  start: string;  // XPath
  end: string;    // XPath

  toRange(): Promise<Range>;
}

// 4. MediaTimeAnchor - Video/audio timestamps
class MediaTimeAnchor implements Anchor {
  start: number;
  end: number;

  toRange(): Promise<Range>;
}
```

**Location:** `/src/annotator/anchoring/types.ts` (378 lines)

### Resolution Strategy (Cascading Fallback)

When resolving an annotation, Hypothesis tries selectors in priority order:

```typescript
export async function anchor(
  root: Element,
  selectors: Selector[]
): Promise<Range> {
  let result = Promise.reject('unable to anchor');

  // 1. RangeSelector (XPath) - most specific
  const range = selectors.find(s => s.type === 'RangeSelector');
  if (range) {
    result = result.catch(() =>
      RangeAnchor.fromSelector(root, range).toRange()
    );
  }

  // 2. TextPositionSelector - fast lookup
  const position = selectors.find(s => s.type === 'TextPositionSelector');
  if (position) {
    result = result.catch(() =>
      TextPositionAnchor.fromSelector(root, position)
        .toRange()
        .then(verifyQuoteMatches)  // Verify if quote selector present
    );
  }

  // 3. TextQuoteSelector - fuzzy matching (most robust)
  const quote = selectors.find(s => s.type === 'TextQuoteSelector');
  if (quote) {
    result = result.catch(() =>
      TextQuoteAnchor.fromSelector(root, quote).toRange({
        hint: position?.start  // Search near expected position first
      })
    );
  }

  // 4. MediaTimeSelector - for transcripts/videos
  const mediaTime = selectors.find(s => s.type === 'MediaTimeSelector');
  if (mediaTime) {
    result = result.catch(() =>
      MediaTimeAnchor.fromSelector(root, mediaTime).toRange()
    );
  }

  return result;
}
```

**Location:** `/src/annotator/anchoring/html.ts:36-113`

**Key Insight:** Always create multiple selectors for robustness. If DOM changes, fallback selectors can still locate content.

### Selector Creation (describe)

When user selects text, generate ALL selector types:

```typescript
export function describe(root: Element, range: Range): Selector[] {
  return [
    MediaTimeAnchor.fromRange(root, range)?.toSelector(),
    RangeAnchor.fromRange(root, range)?.toSelector(),
    TextPositionAnchor.fromRange(root, range)?.toSelector(),
    TextQuoteAnchor.fromRange(root, range)?.toSelector({
      prefix: 32,  // Fixed: 32 chars of prefix context
      suffix: 32   // Fixed: 32 chars of suffix context
    })
  ].filter(Boolean);
}
```

**Location:** `/src/annotator/guest.ts:944-973`

---

## Fuzzy Matching Algorithm

### The Secret Sauce

This is what makes Hypothesis resilient to page changes:

```typescript
export function matchQuote(
  text: string,
  quote: string,
  context: { prefix?: string; suffix?: string; hint?: number }
): Match {
  const maxErrors = Math.min(256, quote.length / 2);

  // FAST PATH: Exact match (99% of cases)
  const exactMatches = [];
  let pos = text.indexOf(quote);
  while (pos !== -1) {
    exactMatches.push({ start: pos, end: pos + quote.length, errors: 0 });
    pos = text.indexOf(quote, pos + 1);
  }

  if (exactMatches.length === 1) {
    return exactMatches[0];  // Unambiguous
  }

  if (exactMatches.length > 1) {
    // Disambiguate using context
    return scoreMatches(exactMatches, context)[0];
  }

  // EXPENSIVE PATH: Approximate string matching
  const approxMatches = approxSearch(text, quote, maxErrors);

  // Score each match
  return scoreMatches(approxMatches, context)[0];
}

function scoreMatches(matches: Match[], context: Context): Match[] {
  return matches
    .map(match => ({
      ...match,
      score: computeScore(match, context)
    }))
    .sort((a, b) => b.score - a.score);
}

function computeScore(match: Match, context: Context): number {
  const quoteWeight = 0.50;
  const prefixWeight = 0.20;
  const suffixWeight = 0.20;
  const positionWeight = 0.10;

  const quoteScore = 1 - (match.errors / match.quote.length);
  const prefixScore = similarity(match.actualPrefix, context.prefix);
  const suffixScore = similarity(match.actualSuffix, context.suffix);
  const positionScore = 1 - Math.abs(match.start - context.hint) / textLength;

  return (
    quoteScore * quoteWeight +
    prefixScore * prefixWeight +
    suffixScore * suffixWeight +
    positionScore * positionWeight
  );
}
```

**Location:** `/src/annotator/anchoring/match-quote.ts` (180 lines)

**Performance:** Fast path (exact match) handles 99% of cases in O(n). Expensive fuzzy search only runs when content has changed.

**Dependency:** Uses `approx-string-match` npm package for approximate string search.

---

## Threading & DAG Structure

### Thread Model

Hypothesis has a proven recursive threading structure perfect for Rio's DAG:

```typescript
interface Thread {
  id: string;              // Annotation ID or $tag
  annotation?: Annotation;
  parent?: string;         // Parent thread ID (single parent)
  children: Thread[];      // Child threads (recursive)
  visible: boolean;        // Matches current filters?
  collapsed: boolean;      // UI state
  replyCount: number;      // Computed: count of descendants
  depth: number;           // Nesting level (0 = root)
}
```

**Location:** `/src/sidebar/helpers/build-thread.ts`

### Building the Thread Tree

```typescript
function buildThread(annotations: Annotation[]): Thread[] {
  const threads: Record<string, Thread> = {};

  // 1. Create thread for each annotation
  for (const ann of annotations) {
    threads[ann.id] = {
      id: ann.id,
      annotation: ann,
      children: [],
      parent: ann.references?.[0],  // references[0] = immediate parent
      visible: true,
      collapsed: false,
      replyCount: 0,
      depth: 0
    };
  }

  // 2. Link children to parents
  for (const thread of Object.values(threads)) {
    if (thread.parent && threads[thread.parent]) {
      threads[thread.parent].children.push(thread);
    }
  }

  // 3. Compute reply counts and depth
  const computeMetrics = (thread: Thread, depth = 0): number => {
    thread.depth = depth;
    thread.replyCount = thread.children.reduce(
      (sum, child) => sum + 1 + computeMetrics(child, depth + 1),
      0
    );
    return thread.replyCount;
  };

  // 4. Return root threads (no parent)
  const roots = Object.values(threads).filter(t => !t.parent);
  roots.forEach(root => computeMetrics(root));

  return roots;
}
```

### Adaptation for Rio (DAG with Multiple Parents)

Hypothesis assumes single parent (`references[0]`). Rio needs multiple parents:

```typescript
interface RioConcept {
  id: string;
  annotation?: Annotation;
  parents: string[];        // Multiple parents! (DAG)
  children: string[];       // Computed: reverse edges
  edges: ConceptEdge[];     // Typed relationships
  visible: boolean;
  depth: number;            // Longest path from root
}

interface ConceptEdge {
  from: string;             // Source concept ID
  to: string;               // Target concept ID
  type: 'supports' | 'contradicts' | 'defines' | 'expands';
}

function buildConceptDAG(concepts: RioConcept[]): RioConcept[] {
  const graph: Record<string, RioConcept> = {};

  // 1. Index all concepts
  for (const concept of concepts) {
    graph[concept.id] = { ...concept, children: [] };
  }

  // 2. Build reverse edges (children)
  for (const concept of Object.values(graph)) {
    for (const edge of concept.edges) {
      if (graph[edge.to]) {
        graph[edge.to].children.push(concept.id);
      }
    }
  }

  // 3. Compute depth (longest path from any root)
  const computeDepth = (id: string, visited = new Set<string>()): number => {
    if (visited.has(id)) return 0;  // Cycle detection
    visited.add(id);

    const concept = graph[id];
    if (concept.parents.length === 0) return 0;  // Root

    return 1 + Math.max(
      ...concept.parents.map(p => computeDepth(p, visited))
    );
  };

  for (const concept of Object.values(graph)) {
    concept.depth = computeDepth(concept.id);
  }

  return Object.values(graph);
}
```

**See:** `docs/design/implementation/dag-threading.md` for full implementation

---

## UI Components (React)

### Recursive Thread Component

```typescript
function Thread({ thread }: { thread: Thread }) {
  const store = useSidebarStore();
  const isReply = thread.parent != null;

  const visibleChildren = thread.children.filter(
    child => countVisible(child) > 0
  );

  const onToggleCollapsed = () => {
    store.setExpanded(thread.id, !thread.collapsed);
  };

  return (
    <div className="thread">
      {/* Collapse control */}
      {isReply && (
        <ThreadCollapseControl
          collapsed={thread.collapsed}
          replyCount={thread.replyCount}
          onToggle={onToggleCollapsed}
        />
      )}

      {/* Annotation content */}
      <Annotation
        annotation={thread.annotation}
        replyCount={thread.replyCount}
        onReply={() => store.createReply(thread.id)}
      />

      {/* Recursive children */}
      {!thread.collapsed && visibleChildren.map(child => (
        <Thread key={child.id} thread={child} />
      ))}
    </div>
  );
}
```

**Location:** `/src/sidebar/components/Thread.tsx`

**Rio Adaptation:** Replace with React Flow nodes, but keep the recursive rendering pattern for nested concept groups.

---

## Vendored Code Setup

### Directory Structure

```
rio-extension/
├── src/
│   ├── anchoring/                      # Vendored from Hypothesis
│   │   ├── types.ts                    # Anchor classes (378 lines)
│   │   ├── html.ts                     # Resolution strategy (135 lines)
│   │   ├── match-quote.ts              # Fuzzy matching (180 lines)
│   │   ├── text-range.ts               # DOM utilities (332 lines)
│   │   ├── trim-range.ts               # Whitespace handling (239 lines)
│   │   ├── xpath.ts                    # XPath gen/resolution (180 lines)
│   │   ├── README.md                   # Attribution
│   │   └── LICENSE.txt                 # BSD-2-Clause
│   │
│   ├── rio-anchoring/                  # Rio-specific adapters
│   │   ├── concept-anchor.ts           # Wraps types.ts
│   │   ├── dag-selector.ts             # Extends W3C selectors
│   │   └── multi-parent-thread.ts      # DAG threading
│   │
│   └── ...
│
├── THIRD_PARTY_LICENSES.md
└── package.json
```

### One-Time Setup Script

```bash
#!/bin/bash
# scripts/vendor-hypothesis.sh

HYPOTHESIS_REPO="/tmp/hypothesis-client"
ANCHORING_SRC="$HYPOTHESIS_REPO/src/annotator/anchoring"
RIO_DEST="src/anchoring"

# Clone Hypothesis client
git clone https://github.com/hypothesis/client.git "$HYPOTHESIS_REPO"
cd "$HYPOTHESIS_REPO"
COMMIT_SHA=$(git rev-parse HEAD)
COMMIT_DATE=$(git log -1 --format=%ci)

# Copy anchoring files
mkdir -p "../$RIO_DEST"
cp "$ANCHORING_SRC"/{types,html,match-quote,text-range,trim-range,xpath}.ts "../$RIO_DEST/"
cp "$ANCHORING_SRC/../../LICENSE" "../$RIO_DEST/LICENSE.txt"

# Add attribution header
cat > "../$RIO_DEST/README.md" <<EOF
# Anchoring Code (Vendored from Hypothesis)

**Source:** https://github.com/hypothesis/client
**Commit:** $COMMIT_SHA
**Date:** $COMMIT_DATE
**License:** BSD-2-Clause

## Files

- types.ts - Anchor class definitions
- html.ts - Resolution strategy
- match-quote.ts - Fuzzy matching algorithm
- text-range.ts - DOM Range utilities
- trim-range.ts - Whitespace handling
- xpath.ts - XPath generation/resolution

## Modifications

None (pristine copy). Rio-specific adaptations in \`src/rio-anchoring/\`.

## Updating

Run \`npm run sync-hypothesis\` to check for upstream changes.
EOF

echo "✅ Vendored Hypothesis anchoring code ($COMMIT_SHA)"
```

### Update Monitoring Script

```typescript
// scripts/check-hypothesis-updates.ts
import { Octokit } from 'octokit';

const LAST_SYNC = '2024-11-13';  // Update after each sync

const octokit = new Octokit();
const { data: commits } = await octokit.rest.repos.listCommits({
  owner: 'hypothesis',
  repo: 'client',
  path: 'src/annotator/anchoring',
  since: LAST_SYNC
});

if (commits.length > 0) {
  console.log('⚠️  New commits in hypothesis/client anchoring:');
  commits.forEach(c => {
    console.log(`  ${c.commit.message} (${c.sha.slice(0, 7)})`);
    console.log(`  ${c.html_url}\n`);
  });
  console.log('Run `npm run sync-hypothesis` to review changes.');
} else {
  console.log('✅ Anchoring code is up to date.');
}
```

---

## License Compliance

### BSD-2-Clause Requirements

**Required Actions:**
1. ✅ Include original LICENSE file in vendored code
2. ✅ Add attribution in THIRD_PARTY_LICENSES.md
3. ✅ Preserve copyright notices in source files

**Not Required:**
- ❌ Upstream contributions (but welcomed!)
- ❌ Using same license for Rio (can use MIT/Apache/etc.)

### Attribution Template

```markdown
# Third-Party Licenses

## Hypothesis Client - Anchoring Code

**Files:** `src/anchoring/*.ts`
**Source:** https://github.com/hypothesis/client
**License:** BSD-2-Clause
**Copyright:** Copyright (c) 2013-2019 Hypothes.is Project and contributors

### License Text

[Full BSD-2-Clause license text here]

### Modifications

Rio uses the anchoring code unmodified. Extensions live in `src/rio-anchoring/`.
```

---

## Testing Strategy

### Import Hypothesis Test Cases

```typescript
// tests/anchoring/fuzzy-matching.test.ts
/**
 * Test cases adapted from Hypothesis client
 * Source: hypothesis/client/src/annotator/anchoring/test
 */

describe('Fuzzy text anchoring', () => {
  it('anchors exact quotes', async () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>The quick brown fox</p>';

    const selectors = [{
      type: 'TextQuoteSelector',
      exact: 'quick brown',
      prefix: 'The ',
      suffix: ' fox'
    }];

    const range = await anchor(container, selectors);
    expect(range.toString()).toBe('quick brown');
  });

  it('anchors quotes across HTML tags', async () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>The <b>quick</b> <i>brown</i> fox</p>';

    const selectors = [{
      type: 'TextQuoteSelector',
      exact: 'quick brown',
      prefix: 'The ',
      suffix: ' fox'
    }];

    const range = await anchor(container, selectors);
    expect(range.toString()).toBe('quick brown');
  });

  // More test cases from Hypothesis suite...
});
```

---

## Next Steps

### Integration Checklist

- [ ] Run `scripts/vendor-hypothesis.sh`
- [ ] Install `approx-string-match` dependency
- [ ] Create Rio adapter layer (`src/rio-anchoring/`)
- [ ] Import Hypothesis test cases
- [ ] Add attribution to THIRD_PARTY_LICENSES.md
- [ ] Document vendoring in Contributing guide

**See Also:**
- [Implementation Plan](07-implementation.md#phase-3-anchoring) - Anchoring implementation phase
- [Text Anchoring](02-anchoring.md) - Original anchoring design
- [Data Models](06-data-models.md#w3c-web-annotation-data-model) - Selector schemas

---

**Previous:** [← Lessons Learned](08-learnings.md) | **Home:** [Design Docs](README.md)
