/**
 * E2E test for Export Flow
 * Tests the complete export flow from scraping to download
 */

import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

let context: BrowserContext;

test.beforeAll(async () => {
  // Load the extension
  const extensionPath = path.join(__dirname, '../dist');

  context = await chromium.launchPersistentContext('', {
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
});

test.afterAll(async () => {
  await context.close();
});

/**
 * Helper function to create a mock ChatGPT page
 */
async function createMockChatGPTPage(page: Page, conversationId: string) {
  const mockHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ChatGPT - Mock Conversation</title>
    </head>
    <body>
      <div id="chat-container">
        <div data-message-author-role="user">
          <div class="prose">
            <p>What is TypeScript?</p>
          </div>
        </div>
        <div data-message-author-role="assistant">
          <div class="prose">
            <p>TypeScript is a strongly typed programming language that builds on JavaScript.</p>
          </div>
        </div>
        <div data-message-author-role="user">
          <div class="prose">
            <p>Can you give me an example?</p>
          </div>
        </div>
        <div data-message-author-role="assistant">
          <div class="prose">
            <p>Sure! Here's a simple example: <code>const greeting: string = "Hello, World!";</code></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Navigate to a URL that matches ChatGPT pattern
  await page.goto(`https://chatgpt.com/c/${conversationId}`);

  // Replace page content with mock HTML
  await page.setContent(mockHTML);
}

test.describe('Export Flow', () => {
  test('should export conversation to JSON', async () => {
    const page = await context.newPage();
    const conversationId = 'abc-123-def-456';

    // Create mock ChatGPT page
    await createMockChatGPTPage(page, conversationId);

    // Wait for content script to load
    await page.waitForTimeout(500);

    // Listen for download events
    const downloadPromise = page.waitForEvent('download');

    // Simulate clicking export button
    // Note: Since we can't directly access the Side Panel in E2E,
    // we'll test the scraping functionality directly
    const exportData = await page.evaluate(() => {
      // Trigger the SCRAPE_NOW message handler
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'SCRAPE_NOW' }, (response: any) => {
          resolve(response);
        });
      });
    });

    expect(exportData).toHaveProperty('success', true);
    expect(exportData).toHaveProperty('data');

    const data = (exportData as any).data;
    expect(data.conversationId).toBe(conversationId);
    expect(data.messages).toHaveLength(4); // 2 user + 2 assistant messages
    expect(data.messages[0].role).toBe('user');
    expect(data.messages[1].role).toBe('assistant');
  });

  test('should scrape messages with correct structure', async () => {
    const page = await context.newPage();
    const conversationId = 'test-conv-123';

    await createMockChatGPTPage(page, conversationId);
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'SCRAPE_NOW' }, (response: any) => {
          resolve(response);
        });
      });
    });

    expect(result).toHaveProperty('success', true);

    const data = (result as any).data;

    // Verify message structure
    expect(data.messages[0]).toHaveProperty('role');
    expect(data.messages[0]).toHaveProperty('content');
    expect(data.messages[0]).toHaveProperty('messageIndex');
    expect(data.messages[0]).toHaveProperty('timestamp');

    // Verify content
    expect(data.messages[0].content).toContain('What is TypeScript?');
    expect(data.messages[1].content).toContain('TypeScript is a strongly typed');
  });

  test('should handle scraping errors gracefully', async () => {
    const page = await context.newPage();

    // Navigate to a page without ChatGPT structure
    await page.goto('https://example.com');
    await page.setContent('<html><body><p>Not a ChatGPT page</p></body></html>');

    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'SCRAPE_NOW' }, (response: any) => {
          resolve(response);
        });
      });
    });

    expect(result).toHaveProperty('success', false);
    expect((result as any).error).toBeTruthy();
  });

  test('should extract conversation ID from URL', async () => {
    const page = await context.newPage();
    const testConvId = 'deadbeef-1234-5678-abcd';

    await createMockChatGPTPage(page, testConvId);
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'SCRAPE_NOW' }, (response: any) => {
          resolve(response);
        });
      });
    });

    const data = (result as any).data;
    expect(data.conversationId).toBe(testConvId);
    expect(data.conversationUrl).toContain(testConvId);
  });

  test('should include timestamps in export data', async () => {
    const page = await context.newPage();
    const conversationId = 'time-test-123';

    await createMockChatGPTPage(page, conversationId);
    await page.waitForTimeout(500);

    const beforeScrape = Date.now();

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'SCRAPE_NOW' }, (response: any) => {
          resolve(response);
        });
      });
    });

    const afterScrape = Date.now();

    const data = (result as any).data;
    expect(data.scrapedAt).toBeGreaterThanOrEqual(beforeScrape);
    expect(data.scrapedAt).toBeLessThanOrEqual(afterScrape);

    // Each message should have a timestamp
    data.messages.forEach((msg: any) => {
      expect(msg.timestamp).toBeGreaterThanOrEqual(beforeScrape);
      expect(msg.timestamp).toBeLessThanOrEqual(afterScrape);
    });
  });
});
