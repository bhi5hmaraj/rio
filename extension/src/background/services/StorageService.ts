/**
 * StorageService - Centralized storage abstraction
 * All chrome.storage operations go through here
 * Implements Single Responsibility Principle
 */

import type { Annotation, RioSettings, Category } from '@/shared/types';

export class StorageService {
  /**
   * Get annotations for a conversation
   */
  async getAnnotations(conversationId: string): Promise<Annotation[]> {
    const result = await chrome.storage.local.get('annotations');
    const annotations = result.annotations || {};
    return annotations[conversationId] || [];
  }

  /**
   * Get all annotations
   */
  async getAllAnnotations(): Promise<Record<string, Annotation[]>> {
    const result = await chrome.storage.local.get('annotations');
    return result.annotations || {};
  }

  /**
   * Save annotation
   */
  async saveAnnotation(annotation: Annotation): Promise<void> {
    const result = await chrome.storage.local.get('annotations');
    const annotations = result.annotations || {};

    if (!annotations[annotation.conversationId]) {
      annotations[annotation.conversationId] = [];
    }

    annotations[annotation.conversationId].push(annotation);
    await chrome.storage.local.set({ annotations });

    // Check quota
    await this.checkQuota();
  }

  /**
   * Update existing annotation
   */
  async updateAnnotation(annotation: Annotation): Promise<void> {
    const result = await chrome.storage.local.get('annotations');
    const annotations = result.annotations || {};

    if (!annotations[annotation.conversationId]) {
      throw new Error(`No annotations found for conversation: ${annotation.conversationId}`);
    }

    const index = annotations[annotation.conversationId].findIndex(
      (a: Annotation) => a.id === annotation.id
    );

    if (index === -1) {
      throw new Error(`Annotation not found: ${annotation.id}`);
    }

    annotations[annotation.conversationId][index] = {
      ...annotation,
      updatedAt: Date.now(),
    };

    await chrome.storage.local.set({ annotations });
  }

  /**
   * Delete annotation
   */
  async deleteAnnotation(conversationId: string, annotationId: string): Promise<void> {
    const result = await chrome.storage.local.get('annotations');
    const annotations = result.annotations || {};

    if (!annotations[conversationId]) {
      return;
    }

    annotations[conversationId] = annotations[conversationId].filter(
      (a: Annotation) => a.id !== annotationId
    );

    await chrome.storage.local.set({ annotations });
  }

  /**
   * Get settings
   */
  async getSettings(): Promise<RioSettings | null> {
    const result = await chrome.storage.local.get('settings');
    return result.settings || null;
  }

  /**
   * Save settings
   */
  async saveSettings(settings: RioSettings): Promise<void> {
    // TODO: Week 2 - Encrypt API key before storing
    await chrome.storage.local.set({ settings });
    console.log('Rio: Settings saved');
  }

  /**
   * Get custom categories
   */
  async getCustomCategories(): Promise<Category[]> {
    const result = await chrome.storage.local.get('customCategories');
    return result.customCategories || [];
  }

  /**
   * Save custom category
   */
  async saveCustomCategory(category: Category): Promise<void> {
    const categories = await this.getCustomCategories();
    categories.push(category);
    await chrome.storage.local.set({ customCategories: categories });
  }

  /**
   * Delete custom category
   */
  async deleteCustomCategory(categoryId: string): Promise<void> {
    const categories = await this.getCustomCategories();
    const filtered = categories.filter(c => c.id !== categoryId);
    await chrome.storage.local.set({ customCategories: filtered });
  }

  /**
   * Check storage quota (warn at 80%)
   */
  private async checkQuota(): Promise<void> {
    const usage = await chrome.storage.local.getBytesInUse();
    const limit = chrome.storage.local.QUOTA_BYTES;
    const percentUsed = (usage / limit) * 100;

    if (percentUsed > 80) {
      console.warn(`Rio: Storage quota warning: ${percentUsed.toFixed(1)}% used (${usage}/${limit} bytes)`);
    }
  }

  /**
   * Get storage usage stats
   */
  async getStorageStats(): Promise<{ used: number; limit: number; percentUsed: number }> {
    const usage = await chrome.storage.local.getBytesInUse();
    const limit = chrome.storage.local.QUOTA_BYTES;
    return {
      used: usage,
      limit: limit,
      percentUsed: (usage / limit) * 100,
    };
  }

  /**
   * Initialize storage with defaults
   */
  async initialize(): Promise<void> {
    const result = await chrome.storage.local.get(['settings', 'annotations', 'customCategories']);

    if (!result.settings) {
      await this.saveSettings({
        aiConfig: {
          litellmEndpoint: 'http://localhost:4000',
          provider: 'gemini',
          apiKey: '',
          model: 'gemini-2.5-flash',
        },
        preferences: {
          autoFactCheck: false,
          showHUD: true,
          highlightStyle: 'underline',
        },
      });
    }

    if (!result.annotations) {
      await chrome.storage.local.set({ annotations: {} });
    }

    if (!result.customCategories) {
      await chrome.storage.local.set({ customCategories: [] });
    }

    console.log('Rio: Storage initialized');
  }

  /**
   * Clear all storage (for testing/reset)
   */
  async clear(): Promise<void> {
    await chrome.storage.local.clear();
    console.log('Rio: Storage cleared');
  }
}

// Singleton instance
export const storageService = new StorageService();
