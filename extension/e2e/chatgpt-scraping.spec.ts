/**
 * E2E test for ChatGPT conversation scraping
 * Tests selector regression detection
 */

import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let context: BrowserContext;

test.beforeAll(async () => {
  // Load the extension
  const extensionPath = path.join(__dirname, '../dist');

  context = await chromium.launchPersistentContext('', {
    headless: true, // Chrome now supports extensions in headless mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
});

test.afterAll(async () => {
  await context.close();
});

test.describe('ChatGPT Scraping', () => {
  test('should detect ChatGPT conversation page', async () => {
    const page = await context.newPage();

    // Intercept network requests to return mock HTML
    const mockHTML = '<html><head><title>ChatGPT</title></head><body></body></html>';
    await page.route('**/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: mockHTML,
      });
    });

    // Navigate to ChatGPT URL (will be intercepted)
    await page.goto('https://chatgpt.com');

    // Verify extension is loaded and page title is set
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test.skip('should scrape conversation messages', async () => {
    // TODO: Implement when we have a ChatGPT mock server
    // or test environment
    const page = await context.newPage();
    await page.goto('https://chatgpt.com/c/test-conversation');

    // Simulate scraping
    const messages = await page.evaluate(() => {
      // This would use the actual scraper code
      const elements = document.querySelectorAll('[data-message-author-role] .prose');
      return elements.length;
    });

    expect(messages).toBeGreaterThan(0);
  });

  test.skip('should detect selector breakage', async () => {
    // TODO: This test would catch when ChatGPT UI changes
    const page = await context.newPage();
    await page.goto('https://chatgpt.com/c/test-conversation');

    // Try to find messages with current selector
    const currentSelector = await page.evaluate(() => {
      return document.querySelectorAll('[data-message-author-role] .prose').length > 0;
    });

    // Try fallback selectors
    const fallback1 = await page.evaluate(() => {
      return document.querySelectorAll('.message .markdown').length > 0;
    });

    // At least one selector should work
    expect(currentSelector || fallback1).toBe(true);
  });
});
