# AI Integration

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

Rio uses Google's Gemini API for intelligent analysis of conversations and content. The integration supports both concept extraction (for DAG building) and critique generation (for hallucination detection).

## Model Selection

### Primary: Gemini 2.5 Flash

**Why Gemini 2.5 Flash?**
- **Fast:** ~2-3s response time for typical chat analysis
- **Cheap:** Cost-effective for BYOK model
- **Search Grounding:** Built-in Google Search integration for fact-checking
- **Long Context:** 1M token context window (handles long conversations)
- **JSON Mode:** Structured output support

**Model ID:** `gemini-2.5-flash`

**API Endpoint:**
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
```

### Alternative Models (Future)

- **Gemini 2.0 Pro:** More powerful reasoning, higher cost
- **OpenAI GPT-4:** Via AnalyzerAdapter abstraction
- **Anthropic Claude:** Via AnalyzerAdapter abstraction
- **Local LLM:** Ollama integration for privacy-focused users

## The Critique System

### Critique Categories (The Rubric)

Each annotation is categorized and color-coded:

| Category | Description | Color | Example |
|----------|-------------|-------|---------|
| **critique** | Logic flaws, weak arguments, reasoning errors | Blue | "This assumes causation but only shows correlation" |
| **factuality** | Verifiable errors via Google Search | Green | "GPT-4 was released in 2024" ❌ (actually 2023) |
| **sycophancy** | Overly agreeable, not challenging user | Orange | "You're absolutely right!" (when user is wrong) |
| **bias** | Non-neutral perspective, hidden assumptions | Red | "Obviously, X is better than Y" (subjective claim) |

### Critique Prompt Template

```typescript
const CRITIQUE_SYSTEM_INSTRUCTION = `
You are a critical thinking assistant analyzing an AI conversation.

Your task: Identify problematic statements and categorize them.

Categories:
- critique: Logical flaws, weak reasoning, unfounded claims
- factuality: Statements that contradict verified facts (use Google Search to verify)
- sycophancy: Excessive agreement without critical pushback
- bias: Non-neutral language or hidden assumptions

For each issue found, output a JSON object:
{
  "category": "critique" | "factuality" | "sycophancy" | "bias",
  "quote": "exact text from conversation",
  "explanation": "why this is problematic",
  "severity": "low" | "medium" | "high",
  "searchQuery": "query used for verification" (factuality only)
}

CRITICAL: Output valid JSON array only. No markdown, no code blocks, no preamble.
`;

const CRITIQUE_USER_PROMPT = `
Analyze this conversation for hallucinations, bias, and logical flaws:

${conversationText}

Return JSON array of annotations.
`;
```

## API Integration

### Request Structure

```typescript
interface GeminiRequest {
  contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: [{ text: string }];
  };
  tools?: Array<{
    googleSearch: {};
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: string; // "application/json"
  };
}
```

**Important Constraint:** Cannot use `responseMimeType: "application/json"` when `tools: [{ googleSearch: {} }]` is enabled. The API rejects this combination.

**Workaround:** Rely on strong system instruction to enforce JSON output.

### Making the API Call (Background Worker)

```typescript
async function callGeminiAPI(
  messages: Message[],
  apiKey: string
): Promise<Annotation[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const conversationText = messages
    .map(m => `[${m.role}]: ${m.text}`)
    .join('\n\n');

  const request: GeminiRequest = {
    systemInstruction: {
      parts: [{ text: CRITIQUE_SYSTEM_INSTRUCTION }]
    },
    contents: [{
      role: "user",
      parts: [{ text: CRITIQUE_USER_PROMPT.replace('${conversationText}', conversationText) }]
    }],
    tools: [
      { googleSearch: {} }  // Enable search grounding
    ],
    generationConfig: {
      temperature: 0.1,  // Low temperature for consistency
      maxOutputTokens: 8192
      // Note: No responseMimeType due to tools constraint
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return parseGeminiResponse(data);
}
```

### Response Parsing

```typescript
function parseGeminiResponse(response: any): Annotation[] {
  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error('No response from Gemini');

  const text = candidate.content.parts[0].text;

  // Strip markdown code blocks if present (despite prompt instruction)
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const annotations = JSON.parse(cleaned);

    // Validate structure
    if (!Array.isArray(annotations)) {
      throw new Error('Response is not an array');
    }

    return annotations.map((anno, idx) => ({
      id: `anno-${Date.now()}-${idx}`,
      category: anno.category,
      quote: anno.quote,
      explanation: anno.explanation,
      severity: anno.severity || 'medium',
      searchQuery: anno.searchQuery,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Invalid JSON from Gemini');
  }
}
```

## Concept Extraction (DAG Building)

### Concept Extraction Prompt

```typescript
const CONCEPT_EXTRACTION_PROMPT = `
You are analyzing a conversation to extract key concepts and their relationships.

For each important concept, identify:
- id: unique identifier (lowercase-kebab-case)
- label: short name (2-4 words)
- description: one-sentence explanation
- messageIds: which messages discuss this concept

For relationships between concepts:
- source: concept id
- target: concept id
- label: relationship type ("supports", "contradicts", "defines", "depends-on")

Output format:
{
  "nodes": [
    {"id": "concept-1", "label": "Neural Networks", "description": "...", "messageIds": ["msg-1", "msg-3"]}
  ],
  "edges": [
    {"source": "concept-1", "target": "concept-2", "label": "supports"}
  ]
}

CRITICAL: Output valid JSON only. No markdown.
`;
```

### Dual-Mode Operation

**Mode 1: Concept DAG** (for visualization)
- Extract concepts and relationships
- Build graph structure
- Used by React Flow renderer

**Mode 2: Critique Annotations** (for highlighting)
- Extract problematic quotes
- Categorize issues
- Used by content script highlighter

**Implementation:**
```typescript
type AnalysisMode = 'concepts' | 'critique';

async function analyzeConversation(
  messages: Message[],
  mode: AnalysisMode,
  apiKey: string
): Promise<ConceptGraph | Annotation[]> {
  const prompt = mode === 'concepts'
    ? CONCEPT_EXTRACTION_PROMPT
    : CRITIQUE_SYSTEM_INSTRUCTION;

  // Make API call with appropriate prompt
  // ...
}
```

## Error Handling

### Network Errors

```typescript
async function callGeminiWithRetry(
  request: GeminiRequest,
  apiKey: string,
  maxRetries = 3
): Promise<any> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { /* ... */ });

      if (response.status === 429) {
        // Rate limit: exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (e) {
      lastError = e;
      console.warn(`Gemini API attempt ${attempt} failed:`, e);
    }
  }

  throw lastError;
}
```

### Malformed Responses

```typescript
function parseGeminiResponseSafe(response: any): Annotation[] {
  try {
    return parseGeminiResponse(response);
  } catch (e) {
    // Fallback: Extract quotes using regex
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const quoteMatches = text.matchAll(/"quote":\s*"([^"]+)"/g);

    const fallbackAnnotations: Annotation[] = [];
    for (const match of quoteMatches) {
      fallbackAnnotations.push({
        id: `fallback-${Date.now()}-${fallbackAnnotations.length}`,
        category: 'critique',
        quote: match[1],
        explanation: 'Auto-detected issue (malformed response)',
        severity: 'low'
      });
    }

    return fallbackAnnotations;
  }
}
```

### API Key Validation

```typescript
async function validateAPIKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    return response.ok;
  } catch {
    return false;
  }
}
```

## Search Grounding

### How It Works

When `tools: [{ googleSearch: {} }]` is enabled:
1. Gemini identifies claims that need verification
2. Automatically generates search queries
3. Fetches results from Google Search
4. Uses search results to verify/contradict claims
5. Cites sources in the response

### Example

**Input (from conversation):**
> "GPT-4 was released in March 2024"

**Gemini's Process:**
1. Generates search query: "GPT-4 release date"
2. Finds result: "GPT-4 released March 14, 2023"
3. Returns annotation:
   ```json
   {
     "category": "factuality",
     "quote": "GPT-4 was released in March 2024",
     "explanation": "Incorrect. GPT-4 was released March 14, 2023.",
     "searchQuery": "GPT-4 release date",
     "severity": "high"
   }
   ```

### Disabling Search (for privacy)

```typescript
interface AnalysisOptions {
  enableSearch: boolean;
  // ... other options
}

function buildGeminiRequest(options: AnalysisOptions): GeminiRequest {
  const request: GeminiRequest = {
    // ... base request
  };

  if (options.enableSearch) {
    request.tools = [{ googleSearch: {} }];
  }

  return request;
}
```

## Cost Estimation

### Gemini 2.5 Flash Pricing (as of Nov 2025)

- **Input:** $0.075 per 1M tokens
- **Output:** $0.30 per 1M tokens

### Typical Usage

**Average conversation:**
- 10 messages × 200 tokens = 2,000 input tokens
- Critique response: ~1,000 output tokens

**Cost per analysis:** ~$0.00045 (less than a penny)

**100 analyses:** ~$0.045

This makes BYOK viable even for heavy users.

## Local Mock Analyzer (Testing)

For development without API keys:

```typescript
class LocalMockAnalyzer implements AnalyzerAdapter {
  async analyze(text: string): Promise<Annotation[]> {
    // Deterministic pattern matching
    const annotations: Annotation[] = [];

    // Detect common hallucination patterns
    if (text.match(/\b(always|never|all|none|every)\b/i)) {
      annotations.push({
        id: `mock-${Date.now()}`,
        category: 'critique',
        quote: text.match(/\b(always|never|all|none|every)\b.{0,50}/i)?.[0] || '',
        explanation: 'Absolutist language often indicates overgeneralization',
        severity: 'low'
      });
    }

    // More patterns...
    return annotations;
  }
}
```

## Future Enhancements

### 1. Multi-Model Support
- Allow users to choose: Gemini, GPT-4, Claude
- Abstract via AnalyzerAdapter interface
- Store preference in settings

### 2. Streaming Responses
- Use Server-Sent Events (SSE) for real-time updates
- Show annotations as they're generated
- Better UX for long analyses

### 3. Context Caching
- Cache recent conversation analyses
- Invalidate only on new messages
- Reduce API calls and cost

### 4. Custom Rubrics
- Let users define their own critique categories
- Upload custom system instructions
- Share rubrics with community

### 5. Confidence Scores
- Parse Gemini's confidence from response
- Show uncertainty visually (dashed highlights)
- Allow users to dispute low-confidence annotations

---

**Previous:** [← Text Anchoring](02-anchoring.md) | **Next:** [UI/UX Design →](04-ui-ux.md)
