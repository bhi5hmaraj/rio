/**
 * LiteLLM Client for AI fact-checking
 * Handles communication with LiteLLM proxy server
 */

import type { AIConfig, Annotation, ChatMessage } from '@/shared/types';

export interface FactCheckRequest {
  conversationId: string;
  conversationUrl: string;
  messages: ChatMessage[];
}

export interface FactCheckResponse {
  annotations: Annotation[];
}

interface LiteLLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LiteLLMRequest {
  model: string;
  messages: LiteLLMMessage[];
  temperature?: number;
  response_format?: { type: 'json_object' };
}

interface LiteLLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class LiteLLMClient {
  private config: AIConfig;
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * Run fact-check on conversation messages
   */
  async factCheck(request: FactCheckRequest): Promise<FactCheckResponse> {
    const prompt = this.buildFactCheckPrompt(request.messages);

    const litellmRequest: LiteLLMRequest = {
      model: this.config.model || this.getDefaultModel(),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for factual accuracy
      response_format: { type: 'json_object' },
    };

    const response = await this.callLiteLLM(litellmRequest);
    const annotations = this.parseResponse(response, request);

    return { annotations };
  }

  /**
   * Build the fact-check prompt
   * Includes 4-category rubric and requests structured JSON output
   */
  private buildFactCheckPrompt(messages: ChatMessage[]): string {
    const conversation = messages
      .map((msg, idx) => `[Message ${idx}] ${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    return `You are a fact-checking assistant. Analyze the following conversation and identify any issues in the AI assistant's responses.

CONVERSATION:
${conversation}

TASK:
Analyze the AI assistant's messages and identify specific text spans that contain:
1. **Fact Error**: Factually incorrect statements that contradict verified information
2. **Reasoning Error**: Logical fallacies, incorrect inferences, or flawed reasoning
3. **Unsupported Claim**: Assertions made without sufficient evidence or grounding
4. **Problematic Advice**: Suggestions that could be harmful, unethical, or impractical

For each issue found, provide:
- The exact quoted text (must match exactly from the conversation)
- 20 characters of context before the quote (if available)
- 20 characters of context after the quote (if available)
- The category (one of: fact_error, reasoning_error, unsupported_claim, problematic_advice)
- A strength rating (1-10, where 10 is most severe)
- A brief explanation of the issue

Return your analysis as a JSON array of findings. Each finding should have this structure:
{
  "exact": "the exact quoted text",
  "prefix": "20 chars before",
  "suffix": "20 chars after",
  "category": "fact_error",
  "strength": 8,
  "note": "Explanation of the issue",
  "messageIndex": 1
}

If there are no issues found, return an empty array: []

Use Google Search grounding when available to verify facts.

IMPORTANT: The "exact" field must match the text from the conversation character-for-character, including punctuation and spacing.`;
  }

  /**
   * Call LiteLLM proxy with retry logic
   */
  private async callLiteLLM(request: LiteLLMRequest, attempt = 0): Promise<string> {
    try {
      const endpoint = `${this.config.litellmEndpoint}/chat/completions`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LiteLLM API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as LiteLLMResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from LiteLLM');
      }

      return data.choices[0].message.content;
    } catch (error) {
      // Retry on network errors or 5xx errors
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.baseDelay * Math.pow(2, attempt);
        console.log(`Rio: Retrying LiteLLM call (attempt ${attempt + 1}/${this.maxRetries}) after ${delay}ms`);

        await this.sleep(delay);
        return this.callLiteLLM(request, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Parse LiteLLM response into annotations
   */
  private parseResponse(responseText: string, request: FactCheckRequest): Annotation[] {
    try {
      const findings = JSON.parse(responseText);

      if (!Array.isArray(findings)) {
        console.warn('Rio: LiteLLM response is not an array, returning empty annotations');
        return [];
      }

      return findings.map((finding) => this.createAnnotation(finding, request));
    } catch (error) {
      console.error('Rio: Error parsing LiteLLM response', error);
      return [];
    }
  }

  /**
   * Create annotation from finding
   */
  private createAnnotation(finding: any, request: FactCheckRequest): Annotation {
    const categoryMap: Record<string, string> = {
      fact_error: 'factuality',
      reasoning_error: 'critique',
      unsupported_claim: 'critique',
      problematic_advice: 'bias',
    };

    return {
      id: crypto.randomUUID(),
      conversationId: request.conversationId,
      conversationUrl: request.conversationUrl,
      messageIndex: finding.messageIndex || 0,
      selector: {
        type: 'TextQuoteSelector',
        exact: finding.exact || '',
        prefix: finding.prefix,
        suffix: finding.suffix,
      },
      category: categoryMap[finding.category] || 'critique',
      strength: finding.strength || 5,
      note: finding.note || '',
      source: 'ai',
      provider: this.config.provider,
      model: this.config.model || this.getDefaultModel(),
      createdAt: Date.now(),
    };
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof TypeError) {
      // Network errors
      return true;
    }

    if (error instanceof Error && error.message.includes('500')) {
      // Server errors
      return true;
    }

    return false;
  }

  /**
   * Get default model for provider
   */
  private getDefaultModel(): string {
    const defaults: Record<string, string> = {
      gemini: 'gemini-2.0-flash-exp',
      openai: 'gpt-4o',
      claude: 'claude-3-5-sonnet-20241022',
    };

    return defaults[this.config.provider] || 'gemini-2.0-flash-exp';
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create LiteLLM client from settings
 */
export function createLiteLLMClient(config: AIConfig): LiteLLMClient {
  return new LiteLLMClient(config);
}
