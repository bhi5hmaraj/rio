/**
 * Tests for ChatGPT scraper
 */

import { getConversationId, scrapeConversation, preprocessDomWithIDs } from '@/content/scrapers/chatgpt';

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

      // Mock URL
      delete (window as any).location;
      window.location = {
        href: 'https://chatgpt.com/c/test-conversation-id',
      } as any;
    });

    it('should scrape all messages correctly', () => {
      const result = scrapeConversation();

      expect(result.conversationId).toBe('test-conversation-id');
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
});
