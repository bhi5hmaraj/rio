/**
 * Tests for StorageService
 */

import { StorageService } from '@/background/services/StorageService';
import type { Annotation, RioSettings } from '@/shared/types';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys: string | string[]) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: mockStorage[keys] });
        }
        const result: Record<string, unknown> = {};
        keys.forEach(key => {
          result[key] = mockStorage[key];
        });
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        return Promise.resolve();
      }),
      getBytesInUse: jest.fn(() => Promise.resolve(1024)),
      QUOTA_BYTES: 10485760, // 10MB
    },
  },
  runtime: {
    id: 'test-extension-id',
  },
} as any;

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new StorageService();
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();
  });

  describe('Annotations', () => {
    const mockAnnotation: Annotation = {
      id: 'test-annotation-1',
      conversationId: 'test-conversation',
      conversationUrl: 'https://chatgpt.com/c/test',
      messageIndex: 0,
      selector: {
        type: 'TextQuoteSelector',
        exact: 'Test quote',
        prefix: 'before ',
        suffix: ' after',
      },
      category: 'factuality',
      note: 'Test note',
      source: 'manual',
      createdAt: Date.now(),
    };

    it('should save annotation', async () => {
      await storageService.saveAnnotation(mockAnnotation);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        annotations: {
          'test-conversation': [mockAnnotation],
        },
      });
    });

    it('should get annotations for a conversation', async () => {
      mockStorage.annotations = {
        'test-conversation': [mockAnnotation],
      };

      const annotations = await storageService.getAnnotations('test-conversation');

      expect(annotations).toHaveLength(1);
      expect(annotations[0].id).toBe('test-annotation-1');
    });

    it('should return empty array for conversation with no annotations', async () => {
      const annotations = await storageService.getAnnotations('non-existent');
      expect(annotations).toEqual([]);
    });

    it('should get all annotations', async () => {
      mockStorage.annotations = {
        'conv-1': [mockAnnotation],
        'conv-2': [{ ...mockAnnotation, id: 'test-2' }],
      };

      const allAnnotations = await storageService.getAllAnnotations();

      expect(Object.keys(allAnnotations)).toHaveLength(2);
      expect(allAnnotations['conv-1']).toHaveLength(1);
      expect(allAnnotations['conv-2']).toHaveLength(1);
    });

    it('should update existing annotation', async () => {
      mockStorage.annotations = {
        'test-conversation': [mockAnnotation],
      };

      const updatedAnnotation = { ...mockAnnotation, note: 'Updated note' };
      await storageService.updateAnnotation(updatedAnnotation);

      const annotations = await storageService.getAnnotations('test-conversation');
      expect(annotations[0].note).toBe('Updated note');
      expect(annotations[0].updatedAt).toBeDefined();
    });

    it('should throw error when updating non-existent annotation', async () => {
      await expect(
        storageService.updateAnnotation(mockAnnotation)
      ).rejects.toThrow('No annotations found');
    });

    it('should delete annotation', async () => {
      mockStorage.annotations = {
        'test-conversation': [mockAnnotation, { ...mockAnnotation, id: 'test-2' }],
      };

      await storageService.deleteAnnotation('test-conversation', 'test-annotation-1');

      const annotations = await storageService.getAnnotations('test-conversation');
      expect(annotations).toHaveLength(1);
      expect(annotations[0].id).toBe('test-2');
    });
  });

  describe('Settings', () => {
    const mockSettings: RioSettings = {
      aiConfig: {
        litellmEndpoint: 'http://localhost:4000',
        provider: 'gemini',
        apiKey: 'test-api-key-12345',
        model: 'gemini-2.5-flash',
      },
      preferences: {
        autoFactCheck: false,
        showHUD: true,
        highlightStyle: 'underline',
      },
    };

    it('should save settings with encrypted API key', async () => {
      await storageService.saveSettings(mockSettings);

      expect(chrome.storage.local.set).toHaveBeenCalled();
      const savedSettings = (chrome.storage.local.set as jest.Mock).mock.calls[0][0].settings;

      // API key should be encrypted (different from original)
      expect(savedSettings.aiConfig.apiKey).not.toBe('test-api-key-12345');
      expect(savedSettings.aiConfig.apiKey.length).toBeGreaterThan(0);
    });

    it('should get settings with decrypted API key', async () => {
      // First save with encryption
      await storageService.saveSettings(mockSettings);

      // Then retrieve and check decryption
      const retrievedSettings = await storageService.getSettings();

      expect(retrievedSettings).not.toBeNull();
      expect(retrievedSettings!.aiConfig.apiKey).toBe('test-api-key-12345');
      expect(retrievedSettings!.aiConfig.provider).toBe('gemini');
    });

    it('should return null when no settings exist', async () => {
      const settings = await storageService.getSettings();
      expect(settings).toBeNull();
    });

    it('should handle empty API key', async () => {
      const settingsWithoutKey = {
        ...mockSettings,
        aiConfig: { ...mockSettings.aiConfig, apiKey: '' },
      };

      await storageService.saveSettings(settingsWithoutKey);
      const retrieved = await storageService.getSettings();

      expect(retrieved!.aiConfig.apiKey).toBe('');
    });
  });

  describe('Custom Categories', () => {
    const mockCategory = {
      id: 'custom-1',
      name: 'Custom Category',
      color: '#ff0000',
      preset: false,
    };

    it('should save custom category', async () => {
      await storageService.saveCustomCategory(mockCategory);

      const categories = await storageService.getCustomCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe('custom-1');
    });

    it('should get custom categories', async () => {
      mockStorage.customCategories = [mockCategory];

      const categories = await storageService.getCustomCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('Custom Category');
    });

    it('should delete custom category', async () => {
      mockStorage.customCategories = [mockCategory, { ...mockCategory, id: 'custom-2' }];

      await storageService.deleteCustomCategory('custom-1');

      const categories = await storageService.getCustomCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe('custom-2');
    });
  });

  describe('Storage Management', () => {
    it('should initialize storage with defaults', async () => {
      await storageService.initialize();

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(3);
      expect(mockStorage.settings).toBeDefined();
      expect(mockStorage.annotations).toEqual({});
      expect(mockStorage.customCategories).toEqual([]);
    });

    it('should not overwrite existing data on initialize', async () => {
      mockStorage.settings = { existing: 'data' };
      mockStorage.annotations = { 'conv-1': [] };
      mockStorage.customCategories = [];

      await storageService.initialize();

      expect(mockStorage.settings).toEqual({ existing: 'data' });
    });

    it('should get storage stats', async () => {
      const stats = await storageService.getStorageStats();

      expect(stats.used).toBe(1024);
      expect(stats.limit).toBe(10485760);
      expect(stats.percentUsed).toBeCloseTo(0.0098, 2);
    });

    it('should clear all storage', async () => {
      mockStorage.annotations = { test: [] };
      mockStorage.settings = { test: 'data' };

      await storageService.clear();

      expect(chrome.storage.local.clear).toHaveBeenCalled();
    });
  });
});
