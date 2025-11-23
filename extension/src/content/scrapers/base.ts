/**
 * Platform-agnostic scraper interface
 * All platform scrapers (ChatGPT, Claude, Gemini) implement this
 */

import type { ChatMessage } from '@/shared/types';

export interface ConversationData {
  conversationId: string | null;
  conversationUrl: string;
  messages: ChatMessage[];
  scrapedAt: number;
}

export interface PlatformMetadata {
  platform: string;
  version?: string;
  uiDetected?: string;
}

export interface PlatformScraper {
  /**
   * Platform identifier
   */
  readonly platform: 'chatgpt' | 'claude' | 'gemini';

  /**
   * Check if this scraper can run on current page
   */
  canScrape(): boolean;

  /**
   * Extract conversation ID from URL or page
   */
  getConversationId(): string | null;

  /**
   * Scrape full conversation
   */
  scrapeConversation(): ConversationData;

  /**
   * Pre-process DOM (add IDs, etc.)
   * Optional - not all platforms need this
   */
  preprocessDOM?(): void;

  /**
   * Get platform-specific metadata
   * Optional - for debugging/analytics
   */
  getMetadata?(): PlatformMetadata;
}
