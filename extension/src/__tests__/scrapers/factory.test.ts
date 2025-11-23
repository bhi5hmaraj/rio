/**
 * Tests for ScraperFactory
 */

import { ScraperFactory } from '@/content/scrapers/factory';
import { ChatGPTScraper } from '@/content/scrapers/chatgpt';

describe('ScraperFactory', () => {
  describe('getScraper', () => {
    it('should return ChatGPTScraper for ChatGPT URLs', () => {
      delete (window as any).location;
      window.location = { href: 'https://chatgpt.com/c/abc-123' } as any;

      const scraper = ScraperFactory.getScraper();
      expect(scraper).not.toBeNull();
      expect(scraper?.platform).toBe('chatgpt');
      expect(scraper).toBeInstanceOf(ChatGPTScraper);
    });

    it('should return ChatGPTScraper for chat.openai.com URLs', () => {
      delete (window as any).location;
      window.location = { href: 'https://chat.openai.com/c/test-123' } as any;

      const scraper = ScraperFactory.getScraper();
      expect(scraper).not.toBeNull();
      expect(scraper?.platform).toBe('chatgpt');
    });

    it('should return null for unsupported platforms', () => {
      delete (window as any).location;
      window.location = { href: 'https://example.com' } as any;

      const scraper = ScraperFactory.getScraper();
      expect(scraper).toBeNull();
    });

    it('should return null for non-AI chat platforms', () => {
      delete (window as any).location;
      window.location = { href: 'https://reddit.com' } as any;

      const scraper = ScraperFactory.getScraper();
      expect(scraper).toBeNull();
    });
  });

  describe('getScraperByPlatform', () => {
    it('should return ChatGPTScraper when requesting chatgpt platform', () => {
      const scraper = ScraperFactory.getScraperByPlatform('chatgpt');
      expect(scraper).not.toBeNull();
      expect(scraper?.platform).toBe('chatgpt');
    });

    it('should return null for unknown platform', () => {
      const scraper = ScraperFactory.getScraperByPlatform('unknown-platform');
      expect(scraper).toBeNull();
    });

    it('should return null for future platforms not yet implemented', () => {
      const scraper = ScraperFactory.getScraperByPlatform('claude');
      expect(scraper).toBeNull();
    });
  });

  describe('registerScraper', () => {
    it('should allow registering custom scrapers', () => {
      // Create a mock scraper that implements PlatformScraper
      const mockScraper = {
        platform: 'gemini' as const, // Use valid platform for testing
        canScrape: () => window.location.href.includes('mock.com'),
        getConversationId: () => 'mock-id',
        scrapeConversation: () => ({
          conversationId: 'mock-id',
          conversationUrl: window.location.href,
          messages: [],
          scrapedAt: Date.now(),
        }),
      };

      // Register it
      ScraperFactory.registerScraper(mockScraper);

      // Should now find gemini scraper (note: would find first gemini, so this test is a bit artificial)
      const scraper = ScraperFactory.getScraperByPlatform('gemini');
      expect(scraper).not.toBeNull();
    });
  });
});
