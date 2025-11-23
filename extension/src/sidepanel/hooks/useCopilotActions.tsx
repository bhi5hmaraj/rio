/**
 * CopilotKit Action Hooks
 * Define actions that the AI assistant can perform
 */

import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { useRioStore } from '@/shared/store';
import type { Annotation } from '@/shared/types';

export function useCopilotActions() {
  const { annotations, settings } = useRioStore();

  // Make conversation context available to the AI
  useCopilotReadable({
    description: 'Current conversation annotations',
    value: annotations,
  });

  useCopilotReadable({
    description: 'Rio settings and configuration',
    value: {
      provider: settings.aiConfig.provider,
      model: settings.aiConfig.model,
      hasApiKey: !!settings.aiConfig.apiKey,
      hasEndpoint: !!settings.aiConfig.litellmEndpoint,
    },
  });

  // Action: Run fact-check on the conversation
  useCopilotAction({
    name: 'runFactCheck',
    description:
      'Run an AI-powered fact-check on the current ChatGPT conversation. This will analyze the conversation for factual errors, reasoning issues, and problematic advice.',
    parameters: [
      {
        name: 'reason',
        type: 'string',
        description: 'Optional reason for running the fact-check',
        required: false,
      },
    ],
    handler: async ({ reason }) => {
      try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.id) {
          return {
            success: false,
            error: 'No active tab found',
          };
        }

        // Scrape conversation first
        const scrapeResponse = await chrome.tabs.sendMessage(tab.id, {
          type: 'SCRAPE_NOW',
        });

        if (!scrapeResponse.success) {
          return {
            success: false,
            error: scrapeResponse.error || 'Failed to scrape conversation',
          };
        }

        const { data } = scrapeResponse;

        // Run fact-check via background worker
        const factCheckResponse = await chrome.runtime.sendMessage({
          type: 'RUN_FACT_CHECK',
          payload: {
            conversationId: data.conversationId,
            messages: data.messages,
          },
        });

        if (!factCheckResponse.success) {
          return {
            success: false,
            error: factCheckResponse.error || 'Fact-check failed',
          };
        }

        return {
          success: true,
          annotationsFound: factCheckResponse.data.count,
          reason,
        };
      } catch (error) {
        console.error('Rio: Error in runFactCheck action', error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  });

  // Action: Add a manual annotation
  useCopilotAction({
    name: 'addAnnotation',
    description:
      'Add a manual annotation to the conversation. Use this when the user wants to flag specific text with a category and note.',
    parameters: [
      {
        name: 'text',
        type: 'string',
        description: 'The exact text to annotate from the conversation',
        required: true,
      },
      {
        name: 'category',
        type: 'string',
        description:
          'Category of the annotation: factuality, critique, bias, or other',
        required: true,
      },
      {
        name: 'note',
        type: 'string',
        description: 'Explanation of the annotation',
        required: true,
      },
      {
        name: 'strength',
        type: 'number',
        description: 'Strength of the annotation from 1-10 (default: 5)',
        required: false,
      },
    ],
    handler: async ({ text, category, note, strength = 5 }) => {
      try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.url || !tab?.id) {
          return {
            success: false,
            error: 'No active tab found',
          };
        }

        // Extract conversation ID
        const match = tab.url.match(/\/c\/([a-f0-9-]+)/);
        const conversationId = match ? match[1] : null;

        if (!conversationId) {
          return {
            success: false,
            error: 'Not on a ChatGPT conversation page',
          };
        }

        // Get text context from content script
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'GET_SELECTION_CONTEXT',
          payload: { text },
        });

        const { prefix = '', suffix = '', messageIndex = 0 } = response || {};

        // Create annotation
        const annotation: Annotation = {
          id: crypto.randomUUID(),
          conversationId,
          conversationUrl: tab.url,
          messageIndex,
          selector: {
            type: 'TextQuoteSelector',
            exact: text,
            prefix: prefix.substring(0, 20),
            suffix: suffix.substring(0, 20),
          },
          category,
          note,
          strength,
          source: 'ai', // CopilotKit-created annotations are AI-assisted
          provider: 'copilot',
          model: 'gemini-2.5-flash-lite',
          createdAt: Date.now(),
        };

        // Save annotation via background worker
        await chrome.runtime.sendMessage({
          type: 'ADD_ANNOTATION',
          payload: { annotation },
        });

        return {
          success: true,
          annotationId: annotation.id,
        };
      } catch (error) {
        console.error('Rio: Error in addAnnotation action', error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  });

  // Action: Export conversation data
  useCopilotAction({
    name: 'exportConversation',
    description:
      'Export the current conversation with all annotations to a JSON file.',
    parameters: [],
    handler: async () => {
      try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.id) {
          return {
            success: false,
            error: 'No active tab found',
          };
        }

        // Scrape conversation
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'SCRAPE_NOW',
        });

        if (!response.success) {
          return {
            success: false,
            error: response.error || 'Failed to scrape conversation',
          };
        }

        const { data } = response;

        // Get current annotations from store
        const currentAnnotations = useRioStore.getState().annotations;

        // Format export data
        const exportData = {
          conversationId: data.conversationId,
          conversationUrl: data.conversationUrl,
          messages: data.messages,
          annotations: currentAnnotations,
          scrapedAt: data.scrapedAt,
          exportedAt: Date.now(),
          version: '1.0',
        };

        // Create download
        const timestamp = new Date().toISOString().split('T')[0];
        const conversationIdShort = data.conversationId?.substring(0, 8) || 'unknown';
        const filename = `rio-export-${conversationIdShort}-${timestamp}.json`;

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        return {
          success: true,
          filename,
        };
      } catch (error) {
        console.error('Rio: Error in exportConversation action', error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  });

  // Action: Get annotation statistics
  useCopilotAction({
    name: 'getAnnotationStats',
    description:
      'Get statistics about the annotations in the current conversation.',
    parameters: [],
    handler: async () => {
      const currentAnnotations = useRioStore.getState().annotations;

      const stats = {
        total: currentAnnotations.length,
        byCategory: {} as Record<string, number>,
        bySource: {
          manual: 0,
          ai: 0,
        },
        averageStrength: 0,
      };

      currentAnnotations.forEach((annotation) => {
        // Count by category
        stats.byCategory[annotation.category] =
          (stats.byCategory[annotation.category] || 0) + 1;

        // Count by source
        if (annotation.source === 'manual') {
          stats.bySource.manual++;
        } else {
          stats.bySource.ai++;
        }
      });

      // Calculate average strength
      const totalStrength = currentAnnotations.reduce(
        (sum, a) => sum + (a.strength || 5),
        0
      );
      stats.averageStrength =
        currentAnnotations.length > 0 ? totalStrength / currentAnnotations.length : 0;

      return stats;
    },
  });
}
