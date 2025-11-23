/**
 * ScraperFactory - Auto-detects platform and returns appropriate scraper
 * Implements Open/Closed Principle: new platforms can be added without modifying core logic
 */

import type { PlatformScraper } from './base';
import { ChatGPTScraper } from './chatgpt';

export class ScraperFactory {
  private static scrapers: PlatformScraper[] = [
    new ChatGPTScraper(),
    // TODO: Week 5+ - Add new platforms
    // new ClaudeScraper(),
    // new GeminiScraper(),
  ];

  /**
   * Auto-detect platform and return appropriate scraper
   * @returns PlatformScraper instance or null if no compatible scraper found
   */
  static getScraper(): PlatformScraper | null {
    for (const scraper of this.scrapers) {
      if (scraper.canScrape()) {
        console.log(`Rio: Detected platform: ${scraper.platform}`);
        return scraper;
      }
    }

    console.warn('Rio: No compatible scraper found for this page');
    return null;
  }

  /**
   * Get scraper by platform name (for testing)
   * @param platform - Platform identifier ('chatgpt', 'claude', 'gemini')
   */
  static getScraperByPlatform(platform: string): PlatformScraper | null {
    return this.scrapers.find(s => s.platform === platform) || null;
  }

  /**
   * Register a new scraper (for extensibility)
   * Allows adding custom scrapers at runtime
   * @param scraper - PlatformScraper instance to register
   */
  static registerScraper(scraper: PlatformScraper): void {
    this.scrapers.push(scraper);
    console.log(`Rio: Registered scraper for platform: ${scraper.platform}`);
  }
}
