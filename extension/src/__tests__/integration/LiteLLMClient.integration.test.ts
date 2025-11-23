/**
 * Integration tests for LiteLLMClient
 * These tests make REAL calls to the LiteLLM backend
 *
 * Run with: npm run test:integration
 * Or: jest --testPathPattern=integration
 *
 * @jest-environment node
 */

import { LiteLLMClient } from '@/background/services/LiteLLMClient';
import type { AIConfig, ChatMessage } from '@/shared/types';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local for integration tests
function loadEnvConfig(): AIConfig | null {
  try {
    // In Jest, process.cwd() points to the extension directory
    const envPath = path.join(process.cwd(), '.env.local');

    if (!fs.existsSync(envPath)) {
      console.warn('⚠️  .env.local not found, skipping integration tests');
      return null;
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};

    envContent.split('\n').forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      env[key.trim()] = value;
    });

    if (!env.LITELLM_API_KEY || !env.LITELLM_BASE_URL || !env.LLM_MODEL) {
      console.warn('⚠️  Missing required env vars, skipping integration tests');
      return null;
    }

    return {
      litellmEndpoint: env.LITELLM_BASE_URL,
      provider: 'gemini',
      apiKey: env.LITELLM_API_KEY,
      model: env.LLM_MODEL,
    };
  } catch (error) {
    console.warn('⚠️  Error loading .env.local:', error);
    return null;
  }
}

const config = loadEnvConfig();

// Skip tests if no config available
const describeIfConfig = config ? describe : describe.skip;

describeIfConfig('LiteLLMClient Integration Tests', () => {
  // Increase timeout for real API calls
  jest.setTimeout(30000);

  let client: LiteLLMClient;

  beforeAll(() => {
    if (!config) {
      throw new Error('Config not loaded');
    }
    client = new LiteLLMClient(config);
    console.log(`\n🔧 Testing with: ${config.litellmEndpoint}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   API Key: ${config.apiKey.substring(0, 15)}...\n`);
  });

  describe('Real API Connection', () => {
    it('should successfully connect to LiteLLM backend', async () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'What is 2+2?',
          messageIndex: 0,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: '2+2 equals 4.',
          messageIndex: 1,
          timestamp: Date.now(),
        },
      ];

      const result = await client.factCheck({
        conversationId: 'integration-test-1',
        conversationUrl: 'https://chatgpt.com/c/integration-test-1',
        messages,
      });

      // Should get a response (even if no errors found)
      expect(result).toBeDefined();
      expect(result.annotations).toBeDefined();
      expect(Array.isArray(result.annotations)).toBe(true);

      console.log(`✅ Connection successful! Found ${result.annotations.length} annotations`);
    });

    it('should detect factual errors in conversation', async () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'What is the capital of France?',
          messageIndex: 0,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: 'The capital of France is London. France is located in Western Europe.',
          messageIndex: 1,
          timestamp: Date.now(),
        },
      ];

      const result = await client.factCheck({
        conversationId: 'integration-test-2',
        conversationUrl: 'https://chatgpt.com/c/integration-test-2',
        messages,
      });

      console.log(`\n📊 Fact-check results:`);
      console.log(`   Found ${result.annotations.length} annotations`);

      // Should find at least one annotation (the capital error)
      expect(result.annotations.length).toBeGreaterThan(0);

      // Check first annotation structure
      const firstAnnotation = result.annotations[0];
      console.log(`\n📝 First annotation:`);
      console.log(`   Quote: "${firstAnnotation.selector.exact}"`);
      console.log(`   Category: ${firstAnnotation.category}`);
      console.log(`   Strength: ${firstAnnotation.strength}/10`);
      console.log(`   Note: ${firstAnnotation.note}`);

      expect(firstAnnotation).toHaveProperty('id');
      expect(firstAnnotation).toHaveProperty('selector');
      expect(firstAnnotation).toHaveProperty('category');
      expect(firstAnnotation).toHaveProperty('strength');
      expect(firstAnnotation).toHaveProperty('note');
      expect(firstAnnotation).toHaveProperty('source', 'ai');
      expect(firstAnnotation).toHaveProperty('provider', 'gemini');
      expect(firstAnnotation).toHaveProperty('model');
      expect(firstAnnotation).toHaveProperty('createdAt');

      // Should be a factuality error (fact_error -> factuality)
      expect(firstAnnotation.category).toBe('factuality');

      // Should have a reasonable strength (likely high for this obvious error)
      expect(firstAnnotation.strength).toBeGreaterThanOrEqual(1);
      expect(firstAnnotation.strength).toBeLessThanOrEqual(10);
    });

    it('should return valid TextQuoteSelector format', async () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'Tell me about the Earth.',
          messageIndex: 0,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: 'The Earth is flat and sits at the center of the universe. It was created 6000 years ago.',
          messageIndex: 1,
          timestamp: Date.now(),
        },
      ];

      const result = await client.factCheck({
        conversationId: 'integration-test-3',
        conversationUrl: 'https://chatgpt.com/c/integration-test-3',
        messages,
      });

      console.log(`\n📊 Found ${result.annotations.length} annotations for Earth test`);

      if (result.annotations.length > 0) {
        const annotation = result.annotations[0];

        // Verify TextQuoteSelector structure
        expect(annotation.selector).toHaveProperty('type', 'TextQuoteSelector');
        expect(annotation.selector).toHaveProperty('exact');
        expect(typeof annotation.selector.exact).toBe('string');
        expect(annotation.selector.exact.length).toBeGreaterThan(0);

        console.log(`\n📝 TextQuoteSelector validation:`);
        console.log(`   Type: ${annotation.selector.type}`);
        console.log(`   Exact: "${annotation.selector.exact}"`);
        console.log(`   Prefix: "${annotation.selector.prefix || 'N/A'}"`);
        console.log(`   Suffix: "${annotation.selector.suffix || 'N/A'}"`);

        // Prefix and suffix are optional but should be strings if present
        if (annotation.selector.prefix) {
          expect(typeof annotation.selector.prefix).toBe('string');
        }
        if (annotation.selector.suffix) {
          expect(typeof annotation.selector.suffix).toBe('string');
        }
      }
    });

    it('should handle conversation with no errors', async () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'What is TypeScript?',
          messageIndex: 0,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content:
            'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
          messageIndex: 1,
          timestamp: Date.now(),
        },
      ];

      const result = await client.factCheck({
        conversationId: 'integration-test-4',
        conversationUrl: 'https://chatgpt.com/c/integration-test-4',
        messages,
      });

      console.log(`\n📊 Clean conversation test: ${result.annotations.length} annotations`);

      // Should return empty array or very few annotations
      expect(result.annotations).toBeDefined();
      expect(Array.isArray(result.annotations)).toBe(true);
    });

    it('should include messageIndex in annotations', async () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'What is the largest planet?',
          messageIndex: 0,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: 'The largest planet in our solar system is Saturn.',
          messageIndex: 1,
          timestamp: Date.now(),
        },
      ];

      const result = await client.factCheck({
        conversationId: 'integration-test-5',
        conversationUrl: 'https://chatgpt.com/c/integration-test-5',
        messages,
      });

      if (result.annotations.length > 0) {
        const annotation = result.annotations[0];

        console.log(`\n📊 Message index test:`);
        console.log(`   Message index: ${annotation.messageIndex}`);
        console.log(`   Quote: "${annotation.selector.exact}"`);

        // Should have a valid messageIndex
        expect(annotation.messageIndex).toBeGreaterThanOrEqual(0);
        expect(annotation.messageIndex).toBeLessThan(messages.length);

        // Most likely pointing to the assistant's message (index 1)
        expect([0, 1]).toContain(annotation.messageIndex);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid API key gracefully', async () => {
      const badConfig: AIConfig = {
        ...config!,
        apiKey: 'invalid-key-12345',
      };

      const badClient = new LiteLLMClient(badConfig);

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'Test',
          messageIndex: 0,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: 'Test response',
          messageIndex: 1,
          timestamp: Date.now(),
        },
      ];

      await expect(
        badClient.factCheck({
          conversationId: 'error-test-1',
          conversationUrl: 'https://chatgpt.com/c/error-test-1',
          messages,
        })
      ).rejects.toThrow();

      console.log('✅ Invalid API key properly rejected');
    });

    it('should handle invalid endpoint gracefully', async () => {
      const badConfig: AIConfig = {
        ...config!,
        litellmEndpoint: 'https://invalid-endpoint-that-does-not-exist.com',
      };

      const badClient = new LiteLLMClient(badConfig);

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'Test',
          messageIndex: 0,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: 'Test response',
          messageIndex: 1,
          timestamp: Date.now(),
        },
      ];

      await expect(
        badClient.factCheck({
          conversationId: 'error-test-2',
          conversationUrl: 'https://chatgpt.com/c/error-test-2',
          messages,
        })
      ).rejects.toThrow();

      console.log('✅ Invalid endpoint properly rejected');
    });
  });
});
