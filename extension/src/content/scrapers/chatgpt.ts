/**
 * ChatGPT Scraper
 * Based on selectors from Tampermonkey prototype (v6.6)
 * with defensive fallbacks for UI changes
 */

import type { ChatMessage } from '@/shared/types';

// --- Selectors with fallbacks ---

export const CHATGPT_SELECTORS = {
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

// --- Helper: Try multiple selectors ---

function querySelectorWithFallbacks(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      console.log(`Rio: Found element via selector: ${selector}`);
      return el;
    }
  }

  console.warn('Rio: No element found with selectors:', selectors);
  return null;
}

function querySelectorAllWithFallbacks(selectors: string[]): NodeListOf<Element> | null {
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

// --- Conversation ID extraction ---

export function getConversationId(): string | null {
  const url = window.location.href;

  // Extract from URL: chatgpt.com/c/{conversationId}
  const match = url.match(/\/c\/([a-f0-9-]+)/);
  if (match) {
    return match[1];
  }

  console.warn('Rio: Could not extract conversation ID from URL:', url);
  return null;
}

// --- Message scraping ---

export function scrapeConversation(): {
  conversationId: string | null;
  conversationUrl: string;
  messages: ChatMessage[];
  scrapedAt: number;
} {
  const conversationId = getConversationId();
  const conversationUrl = window.location.href;

  // Get all message elements
  const messageElements = querySelectorAllWithFallbacks(CHATGPT_SELECTORS.message);

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

// --- Selector getter (for testing/validation) ---

export function getChatGPTSelectors() {
  return CHATGPT_SELECTORS;
}

// --- Pre-process DOM with IDs (from prototype) ---

export function preprocessDomWithIDs(): number {
  console.log('Rio: Pre-processing DOM to add unique message IDs...');

  const messageElements = querySelectorAllWithFallbacks(CHATGPT_SELECTORS.message);

  if (!messageElements) {
    return 0;
  }

  messageElements.forEach((el, index) => {
    const id = `rio-msg-${index}`;
    el.id = id;
  });

  console.log(`Rio: Tagged ${messageElements.length} message elements`);
  return messageElements.length;
}

// --- Export for testing ---

export const ChatGPTScraper = {
  getConversationId,
  scrapeConversation,
  preprocessDomWithIDs,
  getChatGPTSelectors,
};
