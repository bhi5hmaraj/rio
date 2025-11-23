/**
 * Tests for ChatGPT scraper
 */

import { ChatGPTScraper, getConversationId, scrapeConversation, preprocessDomWithIDs } from '@/content/scrapers/chatgpt';

describe('ChatGPT Scraper', () => {
  describe('getConversationId', () => {
    it('should extract conversation ID from ChatGPT URL', () => {
      // Mock window.location
      delete (window as any).location;
      window.location = {
        href: 'https://chatgpt.com/c/abc-123-def-456',
      } as any;

      const id = getConversationId();
      expect(id).toBe('abc-123-def-456');
    });

    it('should return null for non-conversation URLs', () => {
      delete (window as any).location;
      window.location = {
        href: 'https://chatgpt.com/',
      } as any;

      const id = getConversationId();
      expect(id).toBeNull();
    });
  });

  describe('scrapeConversation', () => {
    beforeEach(() => {
      // Set up a mock ChatGPT DOM structure
      document.body.innerHTML = `
        <div data-message-author-role="user">
          <div class="prose">
            <p>Hello, ChatGPT!</p>
          </div>
        </div>
        <div data-message-author-role="assistant">
          <div class="prose">
            <p>Hello! How can I help you today?</p>
          </div>
        </div>
        <div data-message-author-role="user">
          <div class="prose">
            <p>What is TypeScript?</p>
          </div>
        </div>
      `;

      // Mock URL (use hex-only ID to match regex pattern)
      delete (window as any).location;
      window.location = {
        href: 'https://chatgpt.com/c/abc-123-def-456',
      } as any;
    });

    it('should scrape all messages correctly', () => {
      const result = scrapeConversation();

      expect(result.conversationId).toBe('abc-123-def-456');
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toContain('Hello, ChatGPT!');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[2].role).toBe('user');
    });

    it('should include message indices', () => {
      const result = scrapeConversation();

      expect(result.messages[0].messageIndex).toBe(0);
      expect(result.messages[1].messageIndex).toBe(1);
      expect(result.messages[2].messageIndex).toBe(2);
    });

    it('should throw error if no messages found', () => {
      document.body.innerHTML = '<div>Empty page</div>';

      expect(() => {
        scrapeConversation();
      }).toThrow('Could not find any messages on the page');
    });
  });

  describe('preprocessDomWithIDs', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div data-message-author-role="user">
          <div class="prose">Message 1</div>
        </div>
        <div data-message-author-role="assistant">
          <div class="prose">Message 2</div>
        </div>
      `;
    });

    it('should add unique IDs to all message elements', () => {
      const count = preprocessDomWithIDs();

      expect(count).toBe(2);

      const messages = document.querySelectorAll('[data-message-author-role] .prose');
      expect(messages[0].id).toBe('rio-msg-0');
      expect(messages[1].id).toBe('rio-msg-1');
    });

    it('should return 0 if no messages found', () => {
      document.body.innerHTML = '<div>Empty</div>';
      const count = preprocessDomWithIDs();
      expect(count).toBe(0);
    });
  });

  describe('ChatGPTScraper (class-based adapter)', () => {
    let scraper: ChatGPTScraper;

    beforeEach(() => {
      scraper = new ChatGPTScraper();
    });

    describe('canScrape', () => {
      it('should return true for chatgpt.com URLs', () => {
        delete (window as any).location;
        window.location = { href: 'https://chatgpt.com/c/abc-123' } as any;
        expect(scraper.canScrape()).toBe(true);
      });

      it('should return true for chat.openai.com URLs', () => {
        delete (window as any).location;
        window.location = { href: 'https://chat.openai.com/c/abc-123' } as any;
        expect(scraper.canScrape()).toBe(true);
      });

      it('should return false for non-ChatGPT URLs', () => {
        delete (window as any).location;
        window.location = { href: 'https://example.com' } as any;
        expect(scraper.canScrape()).toBe(false);
      });
    });

    describe('getConversationId', () => {
      it('should extract conversation ID from URL', () => {
        delete (window as any).location;
        window.location = { href: 'https://chatgpt.com/c/abc-123-def' } as any;
        expect(scraper.getConversationId()).toBe('abc-123-def');
      });

      it('should return null for non-conversation URLs', () => {
        delete (window as any).location;
        window.location = { href: 'https://chatgpt.com/' } as any;
        expect(scraper.getConversationId()).toBeNull();
      });
    });

    describe('scrapeConversation', () => {
      beforeEach(() => {
        document.body.innerHTML = `
          <div data-message-author-role="user">
            <div class="prose"><p>Test message</p></div>
          </div>
        `;
        delete (window as any).location;
        window.location = { href: 'https://chatgpt.com/c/abc-123' } as any;
      });

      it('should return ConversationData with correct structure', () => {
        const result = scraper.scrapeConversation();
        expect(result).toHaveProperty('conversationId');
        expect(result).toHaveProperty('conversationUrl');
        expect(result).toHaveProperty('messages');
        expect(result).toHaveProperty('scrapedAt');
        expect(Array.isArray(result.messages)).toBe(true);
      });
    });

    describe('getMetadata', () => {
      it('should return platform metadata', () => {
        const metadata = scraper.getMetadata();
        expect(metadata.platform).toBe('chatgpt');
        expect(metadata.version).toBe('1.0');
      });
    });

    describe('platform', () => {
      it('should have platform property set to chatgpt', () => {
        expect(scraper.platform).toBe('chatgpt');
      });
    });
  });
});
