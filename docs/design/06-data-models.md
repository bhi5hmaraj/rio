# Data Models

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

This document defines all data structures used by Rio, including storage schemas, message formats, and API contracts.

## W3C Web Annotation Data Model

Rio uses the **W3C Web Annotation Data Model** as the foundation for portability and standards compliance.

Reference: [W3C Annotation Model](https://www.w3.org/TR/annotation-model/)

### Annotation Structure

```typescript
interface Annotation {
  // Required fields
  id: string;                    // Unique identifier
  type: "Annotation";            // W3C type
  created: string;               // ISO 8601 timestamp
  target: Target;                // What is being annotated
  body: Body | Body[];           // The annotation content

  // Optional fields
  motivation?: string;           // Purpose: "commenting", "critiquing", etc.
  creator?: Agent;               // Who created it (user or AI)
  modified?: string;             // Last edit timestamp
}

interface Target {
  source: string;                // Page URL
  selector: Selector | Selector[]; // How to locate the text
}

interface Selector {
  type: "TextQuoteSelector" | "TextPositionSelector" | "RangeSelector";
  // Type-specific fields below
}

interface TextQuoteSelector extends Selector {
  type: "TextQuoteSelector";
  exact: string;                 // The quoted text
  prefix?: string;               // Text before (for context)
  suffix?: string;               // Text after (for context)
}

interface TextPositionSelector extends Selector {
  type: "TextPositionSelector";
  start: number;                 // Character offset (start)
  end: number;                   // Character offset (end)
}

interface Body {
  type: "TextualBody";
  value: string;                 // The annotation text
  purpose?: string;              // "commenting", "tagging", etc.
  format?: string;               // "text/plain", "text/markdown"
}

interface Agent {
  type: "Person" | "Software";
  name?: string;
  id?: string;
}
```

### Example (Full Annotation)

```json
{
  "id": "anno-1732276800-001",
  "type": "Annotation",
  "created": "2025-11-22T10:30:00Z",
  "motivation": "critiquing",
  "creator": {
    "type": "Software",
    "name": "Rio Extension",
    "id": "rio-gemini-analyzer"
  },
  "target": {
    "source": "https://chat.openai.com/c/abc123",
    "selector": [
      {
        "type": "TextQuoteSelector",
        "exact": "GPT-4 was released in March 2024",
        "prefix": "As you mentioned, ",
        "suffix": ", which brought significant improvements."
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
    "value": "Factually incorrect. GPT-4 was released on March 14, 2023.",
    "purpose": "commenting",
    "format": "text/plain"
  }
}
```

## Rio-Specific Extensions

### Annotation Metadata (Rio-specific fields)

```typescript
interface RioAnnotation extends Annotation {
  // Rio-specific extensions
  category: "critique" | "factuality" | "sycophancy" | "bias";
  severity: "low" | "medium" | "high";
  color: string;                 // Hex color for highlighting
  searchQuery?: string;          // For factuality checks
  confidence?: number;           // 0-1, from Gemini
  messageId?: string;            // Chat message reference
}
```

### Example (Rio Annotation)

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "anno-1732276800-001",
  "type": "Annotation",
  "created": "2025-11-22T10:30:00Z",
  "motivation": "critiquing",

  "target": {
    "source": "https://chat.openai.com/c/abc123",
    "selector": [
      {
        "type": "TextQuoteSelector",
        "exact": "GPT-4 was released in March 2024",
        "prefix": "As you mentioned, ",
        "suffix": ", which brought significant improvements."
      }
    ]
  },

  "body": {
    "type": "TextualBody",
    "value": "Factually incorrect. GPT-4 was released on March 14, 2023.",
    "purpose": "commenting"
  },

  "rio:category": "factuality",
  "rio:severity": "high",
  "rio:color": "#10B981",
  "rio:searchQuery": "GPT-4 release date",
  "rio:confidence": 0.95,
  "rio:messageId": "msg-4"
}
```

## Concept Graph Model

### Graph Structure

```typescript
interface ConceptGraph {
  nodes: Node[];
  edges: Edge[];
  meta: GraphMetadata;
}

interface Node {
  id: string;                    // Unique node ID
  type: "concept" | "entity" | "claim" | "evidence";
  label: string;                 // Display name
  description?: string;          // Full description
  position?: { x: number; y: number }; // For React Flow
  data?: Record<string, any>;    // Custom data
  messageIds?: string[];         // Source messages
}

interface Edge {
  id: string;                    // Unique edge ID
  source: string;                // Source node ID
  target: string;                // Target node ID
  label?: string;                // Relationship type
  type?: "supports" | "contradicts" | "defines" | "cites";
  style?: EdgeStyle;             // Visual styling
}

interface EdgeStyle {
  stroke?: string;               // Color
  strokeWidth?: number;
  strokeDasharray?: string;      // For dashed lines
}

interface GraphMetadata {
  pageUrl: string;
  pageTitle?: string;
  timestamp: number;
  analyzerVersion: string;
  nodeCount: number;
  edgeCount: number;
}
```

### Example (Concept Graph)

```json
{
  "nodes": [
    {
      "id": "n1",
      "type": "concept",
      "label": "Neural Networks",
      "description": "Computational models inspired by biological neural networks",
      "messageIds": ["msg-1", "msg-3"],
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "n2",
      "type": "concept",
      "label": "Backpropagation",
      "description": "Algorithm for training neural networks",
      "messageIds": ["msg-3", "msg-5"],
      "position": { "x": 300, "y": 100 }
    },
    {
      "id": "n3",
      "type": "claim",
      "label": "AI will replace all jobs",
      "messageIds": ["msg-7"],
      "position": { "x": 200, "y": 300 }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "n2",
      "target": "n1",
      "label": "defines",
      "type": "defines",
      "style": { "stroke": "#3B82F6" }
    },
    {
      "id": "e2",
      "source": "n1",
      "target": "n3",
      "label": "supports",
      "type": "supports",
      "style": { "stroke": "#10B981" }
    }
  ],
  "meta": {
    "pageUrl": "https://chat.openai.com/c/abc123",
    "pageTitle": "Discussion about AI",
    "timestamp": 1732276800000,
    "analyzerVersion": "rio-1.0",
    "nodeCount": 3,
    "edgeCount": 2
  }
}
```

## Message Schemas (Chrome Runtime)

### Content Script → Background

#### Scrape Complete

```typescript
interface ScrapeCompleteMessage {
  action: "scrapeComplete";
  data: {
    pageId: string;              // Unique page identifier
    url: string;
    title?: string;
    messages: ScrapedMessage[];
    metadata: {
      site: "chatgpt" | "gemini" | "claude" | "generic";
      scrapedAt: number;
      messageCount: number;
    };
  };
}

interface ScrapedMessage {
  id: string;                    // Message ID (from DOM or generated)
  role: "user" | "assistant" | "system";
  text: string;                  // Plain text content
  html?: string;                 // Original HTML (optional)
  timestamp?: number;            // Message timestamp
  position: number;              // Order in conversation
}
```

#### Error Report

```typescript
interface ErrorMessage {
  action: "error";
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: number;
  };
}
```

### Background → Side Panel

#### Analysis Complete

```typescript
interface AnalysisCompleteMessage {
  action: "analysisComplete";
  data: {
    annotations: RioAnnotation[];
    graph?: ConceptGraph;
    status: "success" | "partial" | "error";
    error?: string;
    stats: {
      totalAnnotations: number;
      byCategoryCount: {
        critique: number;
        factuality: number;
        sycophancy: number;
        bias: number;
      };
      analysisDuration: number;  // ms
    };
  };
}
```

#### Progress Update

```typescript
interface ProgressMessage {
  action: "analysisProgress";
  data: {
    stage: "scraping" | "analyzing" | "anchoring" | "complete";
    progress: number;            // 0-100
    message?: string;
  };
}
```

### Background → Content Script

#### Apply Highlights

```typescript
interface ApplyHighlightsMessage {
  action: "applyHighlights";
  annotations: Array<{
    id: string;
    target: {
      messageId?: string;
      selector: TextQuoteSelector | TextPositionSelector;
    };
    color: string;
    category: string;
    tooltip?: string;
  }>;
}
```

#### Clear Highlights

```typescript
interface ClearHighlightsMessage {
  action: "clearHighlights";
  annotationIds?: string[];      // Clear specific, or all if undefined
}
```

### Side Panel → Background

#### Trigger Analysis

```typescript
interface TriggerAnalysisMessage {
  action: "analyzeCurrentPage";
  options: {
    mode: "concepts" | "critique" | "both";
    enableSearch: boolean;
    customPrompt?: string;
  };
}
```

#### Export Graph

```typescript
interface ExportGraphMessage {
  action: "exportGraph";
  format: "svg" | "png" | "json";
  graphId?: string;
}
```

## Storage Schemas (chrome.storage)

### Local Storage Structure

```typescript
interface RioStorage {
  // User settings
  settings: {
    apiKey_encrypted?: string;
    theme: "light" | "dark" | "auto";
    enableSearch: boolean;
    autoAnalyze: boolean;
    severityFilter: ("low" | "medium" | "high")[];
  };

  // Annotations (per-page)
  annotations: {
    [pageId: string]: RioAnnotation[];
  };

  // Graphs (per-page)
  graphs: {
    [pageId: string]: ConceptGraph;
  };

  // Cache
  cache: {
    [cacheKey: string]: {
      data: any;
      timestamp: number;
      expiresAt: number;
    };
  };

  // Metadata
  meta: {
    version: string;
    installedAt: number;
    lastUsed: number;
  };
}
```

### Storage Keys

```typescript
// Settings
await chrome.storage.local.get('settings');
await chrome.storage.local.set({ settings: { ... } });

// Annotations for specific page
const pageId = "chatgpt-abc123";
await chrome.storage.local.get(`annotations.${pageId}`);

// All annotations
const { annotations } = await chrome.storage.local.get('annotations');

// Graph
await chrome.storage.local.get(`graphs.${pageId}`);
```

### Storage Limits

- **chrome.storage.local:** 10 MB total
- **Per-item limit:** ~8 KB (recommended)

**Optimization:**
- Compress large graphs (JSON.stringify + gzip)
- Paginate annotations (keep only recent 100 per page)
- Clear old cache entries (TTL: 24 hours)

## API Contracts (AnalyzerAdapter)

### Interface Definition

```typescript
interface AnalyzerAdapter {
  analyze(
    input: AnalysisInput,
    options: AnalysisOptions
  ): Promise<AnalysisResult>;

  validateKey(apiKey: string): Promise<boolean>;
}

interface AnalysisInput {
  text: string;
  messages?: ScrapedMessage[];
  context?: {
    url: string;
    title?: string;
    site: string;
  };
}

interface AnalysisOptions {
  mode: "concepts" | "critique" | "both";
  enableSearch: boolean;
  customPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

interface AnalysisResult {
  annotations?: RioAnnotation[];
  graph?: ConceptGraph;
  metadata: {
    model: string;
    tokensUsed: {
      input: number;
      output: number;
    };
    duration: number;           // ms
    timestamp: number;
  };
}
```

### Gemini Analyzer Implementation

```typescript
class GeminiAnalyzer implements AnalyzerAdapter {
  constructor(private apiKey: string) {}

  async analyze(
    input: AnalysisInput,
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    const request = this.buildRequest(input, options);
    const response = await this.callAPI(request);
    const parsed = this.parseResponse(response, options.mode);

    return {
      ...parsed,
      metadata: {
        model: "gemini-2.5-flash",
        tokensUsed: {
          input: response.usageMetadata?.promptTokenCount || 0,
          output: response.usageMetadata?.candidatesTokenCount || 0
        },
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    // Implementation from 03-ai-integration.md
  }

  private buildRequest(input: AnalysisInput, options: AnalysisOptions): any {
    // Implementation from 03-ai-integration.md
  }

  private async callAPI(request: any): Promise<any> {
    // Implementation from 03-ai-integration.md
  }

  private parseResponse(response: any, mode: string): any {
    // Implementation from 03-ai-integration.md
  }
}
```

## Type Definitions (TypeScript)

### Centralized Types File

```typescript
// src/shared/types.ts

export * from './annotation.types';
export * from './graph.types';
export * from './message.types';
export * from './storage.types';
export * from './analyzer.types';
```

### Usage

```typescript
// In any module
import type { RioAnnotation, ConceptGraph } from '@/shared/types';
```

## Versioning & Migration

### Schema Versioning

```typescript
const SCHEMA_VERSION = "1.0";

interface VersionedData<T> {
  schemaVersion: string;
  data: T;
}

async function saveAnnotation(annotation: RioAnnotation): Promise<void> {
  const versioned: VersionedData<RioAnnotation> = {
    schemaVersion: SCHEMA_VERSION,
    data: annotation
  };

  await chrome.storage.local.set({
    [`annotation.${annotation.id}`]: versioned
  });
}
```

### Migration Strategy

```typescript
async function migrateStorage(fromVersion: string): Promise<void> {
  if (fromVersion === "0.9" && SCHEMA_VERSION === "1.0") {
    // Example: Rename field
    const { annotations } = await chrome.storage.local.get('annotations');

    const migrated = Object.entries(annotations).map(([id, anno]: any) => ({
      ...anno,
      category: anno.type,  // Rename 'type' to 'category'
    }));

    await chrome.storage.local.set({ annotations: migrated });
  }
}
```

---

**Previous:** [← Security & Privacy](05-security-privacy.md) | **Next:** [Implementation Plan →](07-implementation.md)
