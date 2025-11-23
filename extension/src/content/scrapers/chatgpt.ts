/**
 * ChatGPT Scraper
 * Based on selectors from Tampermonkey prototype (v6.6)
 * with defensive fallbacks for UI changes
 */

import type { ChatMessage } from '@/shared/types';
import type { PlatformScraper, ConversationData, PlatformMetadata } from './base';

const CHATGPT_SELECTORS = {
  // Message containers
  message: [
    '[data-message-author-role] .prose',  // Current (as of 2025-11)
    '.message .markdown',                  // Fallback 1
    '[data-testid="conversation-turn"]',  // Fallback 2
  ],

  // Message wrapper (has role attribute)
  messageWrapper: [
    '[data-message-author-role]',        // Current
    '.message[data-role]',                // Fallback 1
  ],

  // Input field
  input: [
    '#prompt-textarea',                    // Current
    'textarea[placeholder*="Message"]',   // Fallback 1
    '[contenteditable="true"]',           // Fallback 2
  ],
};

/**
 * ChatGPT platform scraper
 * Implements adapter pattern for ChatGPT-specific scraping logic
 */
export class ChatGPTScraper implements PlatformScraper {
  readonly platform = 'chatgpt' as const;

  canScrape(): boolean {
    const url = window.location.href;
    return url.includes('chatgpt.com') || url.includes('chat.openai.com');
  }

  getConversationId(): string | null {
    const url = window.location.href;

    // Extract from URL: chatgpt.com/c/{conversationId}
    const match = url.match(/\/c\/([a-f0-9-]+)/);
    if (match) {
      return match[1];
    }

    console.warn('Rio: Could not extract conversation ID from URL:', url);
    return null;
  }

  scrapeConversation(): ConversationData {
    const conversationId = this.getConversationId();
    const conversationUrl = window.location.href;

    // Get all message elements
    const messageElements = this.querySelectorAllWithFallbacks(CHATGPT_SELECTORS.message);

    if (!messageElements || messageElements.length === 0) {
      throw new Error('Could not find any messages on the page. ChatGPT UI may have changed.');
    }

    const messages: ChatMessage[] = [];

    messageElements.forEach((messageEl, index) => {
      // Find the message wrapper to get the role
      const wrapper = messageEl.closest('[data-message-author-role]');

      if (!wrapper) {
        console.warn('Rio: Could not find message wrapper for message', index);
        return;
      }

      const role = wrapper.getAttribute('data-message-author-role') as 'user' | 'assistant' | 'system';
      const content = (messageEl as HTMLElement).innerHTML.trim();

      if (!role || !content) {
        console.warn('Rio: Skipping message with missing role or content', index);
        return;
      }

      messages.push({
        role,
        content,
        messageIndex: index,
        timestamp: Date.now(),
      });
    });

    console.log(`Rio: Scraped ${messages.length} messages`);

    return {
      conversationId,
      conversationUrl,
      messages,
      scrapedAt: Date.now(),
    };
  }

  preprocessDOM(): void {
    console.log('Rio: Pre-processing DOM to add unique message IDs...');

    const messageElements = this.querySelectorAllWithFallbacks(CHATGPT_SELECTORS.message);

    if (!messageElements) {
      return;
    }

    messageElements.forEach((el, index) => {
      const id = `rio-msg-${index}`;
      el.id = id;
    });

    console.log(`Rio: Tagged ${messageElements.length} message elements`);
  }

  getMetadata(): PlatformMetadata {
    return {
      platform: this.platform,
      version: '1.0',
      uiDetected: CHATGPT_SELECTORS.message.find(selector => {
        return document.querySelectorAll(selector).length > 0;
      }),
    };
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

// --- Legacy exports for backward compatibility (will remove after migration) ---

export function getConversationId(): string | null {
  const scraper = new ChatGPTScraper();
  return scraper.getConversationId();
}

export function scrapeConversation(): ConversationData {
  const scraper = new ChatGPTScraper();
  return scraper.scrapeConversation();
}

export function preprocessDomWithIDs(): number {
  const scraper = new ChatGPTScraper();
  scraper.preprocessDOM();
  const messageElements = document.querySelectorAll('[id^="rio-msg-"]');
  return messageElements.length;
}

export function getChatGPTSelectors() {
  return CHATGPT_SELECTORS;
}
