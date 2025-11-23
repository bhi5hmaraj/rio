/**
 * Tests for LiteLLMClient
 */

import { LiteLLMClient, createLiteLLMClient } from '@/background/services/LiteLLMClient';
import type { AIConfig, ChatMessage } from '@/shared/types';

// Mock fetch globally
global.fetch = jest.fn();

const mockConfig: AIConfig = {
  litellmEndpoint: 'http://localhost:4000',
  provider: 'gemini',
  apiKey: 'test-api-key',
  model: 'gemini-2.0-flash-exp',
};

const mockMessages: ChatMessage[] = [
  {
    role: 'user',
    content: 'What is the capital of France?',
    messageIndex: 0,
    timestamp: Date.now(),
  },
  {
    role: 'assistant',
    content: 'The capital of France is London.',
    messageIndex: 1,
    timestamp: Date.now(),
  },
];

describe('LiteLLMClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('factory function', () => {
    it('should create client from config', () => {
      const client = createLiteLLMClient(mockConfig);
      expect(client).toBeInstanceOf(LiteLLMClient);
    });
  });

  describe('factCheck', () => {
    it('should successfully fact-check conversation and return annotations', async () => {
      const mockResponse = JSON.stringify([
        {
          exact: 'The capital of France is London.',
          prefix: '',
          suffix: '',
          category: 'fact_error',
          strength: 10,
          note: 'The capital of France is Paris, not London.',
          messageIndex: 1,
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: mockResponse,
              },
            },
          ],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv-123',
        conversationUrl: 'https://chatgpt.com/c/test-conv-123',
        messages: mockMessages,
      });

      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0].selector.exact).toBe('The capital of France is London.');
      expect(result.annotations[0].category).toBe('factuality');
      expect(result.annotations[0].strength).toBe(10);
      expect(result.annotations[0].note).toBe('The capital of France is Paris, not London.');
      expect(result.annotations[0].source).toBe('ai');
      expect(result.annotations[0].provider).toBe('gemini');
      expect(result.annotations[0].model).toBe('gemini-2.0-flash-exp');
    });

    it('should call correct endpoint with proper headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '[]' } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
        })
      );
    });

    it('should include proper request body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '[]' } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('gemini-2.0-flash-exp');
      expect(body.temperature).toBe(0.1);
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toContain('What is the capital of France?');
    });

    it('should return empty annotations when no issues found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '[]' } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(result.annotations).toHaveLength(0);
    });

    it('should handle multiple annotations', async () => {
      const mockResponse = JSON.stringify([
        {
          exact: 'First error',
          category: 'fact_error',
          strength: 8,
          note: 'First note',
          messageIndex: 1,
        },
        {
          exact: 'Second error',
          category: 'reasoning_error',
          strength: 6,
          note: 'Second note',
          messageIndex: 1,
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockResponse } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(result.annotations).toHaveLength(2);
      expect(result.annotations[0].category).toBe('factuality');
      expect(result.annotations[1].category).toBe('critique');
    });
  });

  describe('error handling', () => {
    it('should throw error when API returns non-200 status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const client = new LiteLLMClient(mockConfig);

      await expect(
        client.factCheck({
          conversationId: 'test-conv',
          conversationUrl: 'https://chatgpt.com/c/test-conv',
          messages: mockMessages,
        })
      ).rejects.toThrow('LiteLLM API error (401): Unauthorized');
    });

    it('should throw error when no choices in response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      });

      const client = new LiteLLMClient(mockConfig);

      await expect(
        client.factCheck({
          conversationId: 'test-conv',
          conversationUrl: 'https://chatgpt.com/c/test-conv',
          messages: mockMessages,
        })
      ).rejects.toThrow('No response from LiteLLM');
    });

    it('should handle malformed JSON gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json' } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      // Should return empty array instead of throwing
      expect(result.annotations).toHaveLength(0);
    });

    it('should handle non-array JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"error": "something"}' } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      // Should return empty array when response is not an array
      expect(result.annotations).toHaveLength(0);
    });
  });

  describe('retry logic', () => {
    it('should retry on network error', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '[]' } }],
          }),
        });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.annotations).toHaveLength(0);
    });

    it('should retry on 500 error', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '[]' } }],
          }),
        });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.annotations).toHaveLength(0);
    });

    it('should not retry on 400 error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      const client = new LiteLLMClient(mockConfig);

      await expect(
        client.factCheck({
          conversationId: 'test-conv',
          conversationUrl: 'https://chatgpt.com/c/test-conv',
          messages: mockMessages,
        })
      ).rejects.toThrow('LiteLLM API error (400): Bad Request');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it(
      'should give up after max retries',
      async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Network error'));

        const client = new LiteLLMClient(mockConfig);

        await expect(
          client.factCheck({
            conversationId: 'test-conv',
            conversationUrl: 'https://chatgpt.com/c/test-conv',
            messages: mockMessages,
          })
        ).rejects.toThrow('Network error');

        // Should try initial + 3 retries = 4 total
        expect(global.fetch).toHaveBeenCalledTimes(4);
      },
      10000
    ); // 10 second timeout for retry test
  });

  describe('category mapping', () => {
    it('should map fact_error to factuality', async () => {
      const mockResponse = JSON.stringify([
        {
          exact: 'test',
          category: 'fact_error',
          strength: 5,
          note: 'test',
          messageIndex: 0,
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockResponse } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(result.annotations[0].category).toBe('factuality');
    });

    it('should map reasoning_error to critique', async () => {
      const mockResponse = JSON.stringify([
        {
          exact: 'test',
          category: 'reasoning_error',
          strength: 5,
          note: 'test',
          messageIndex: 0,
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockResponse } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(result.annotations[0].category).toBe('critique');
    });

    it('should map problematic_advice to bias', async () => {
      const mockResponse = JSON.stringify([
        {
          exact: 'test',
          category: 'problematic_advice',
          strength: 5,
          note: 'test',
          messageIndex: 0,
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockResponse } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(result.annotations[0].category).toBe('bias');
    });

    it('should default unknown categories to critique', async () => {
      const mockResponse = JSON.stringify([
        {
          exact: 'test',
          category: 'unknown_category',
          strength: 5,
          note: 'test',
          messageIndex: 0,
        },
      ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockResponse } }],
        }),
      });

      const client = new LiteLLMClient(mockConfig);
      const result = await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      expect(result.annotations[0].category).toBe('critique');
    });
  });

  describe('default model selection', () => {
    it('should use specified model when provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '[]' } }],
        }),
      });

      const client = new LiteLLMClient({
        ...mockConfig,
        model: 'custom-model',
      });

      await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('custom-model');
    });

    it('should use default gemini model when provider is gemini', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '[]' } }],
        }),
      });

      const client = new LiteLLMClient({
        ...mockConfig,
        model: undefined,
      });

      await client.factCheck({
        conversationId: 'test-conv',
        conversationUrl: 'https://chatgpt.com/c/test-conv',
        messages: mockMessages,
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('gemini-2.0-flash-exp');
    });
  });
});
