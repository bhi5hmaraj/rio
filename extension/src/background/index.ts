/**
 * Rio Background Service Worker
 * Handles:
 * - Message passing between components
 * - API calls to LiteLLM proxy
 * - Storage management
 * - Side Panel management
 */

import type { RioMessage, Annotation } from '@/shared/types';
import { storageService } from './services/StorageService';

console.log('Rio: Background service worker loaded');

// --- Side Panel Management ---

// Open side panel when extension icon clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// --- Context Menu (for manual annotations) ---

chrome.runtime.onInstalled.addListener(async () => {
  // Initialize storage with defaults
  await storageService.initialize();

  // Create context menu
  chrome.contextMenus.create({
    id: 'rio-annotate',
    title: 'Annotate with Rio',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rio-annotate' && tab?.id) {
    // Send message to content script to handle annotation
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_ANNOTATION_FORM',
      payload: {
        selectedText: info.selectionText,
      },
    });

    // Open side panel
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message: RioMessage, sender, sendResponse) => {
  console.log('Rio: Received message', message.type, message);

  switch (message.type) {
    case 'SCRAPE_CONVERSATION':
      handleScrapeConversation(sender, sendResponse);
      return true; // Keep channel open for async response

    case 'RUN_FACT_CHECK':
      handleFactCheck(message.payload as { conversationId: string; messages: unknown[] }, sendResponse);
      return true;

    case 'ADD_ANNOTATION':
      handleAddAnnotation(message.payload as { annotation: unknown }, sendResponse);
      return true;

    case 'OPEN_SIDE_PANEL':
      if (sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id });
        sendResponse({ success: true });
      }
      break;

    case 'EXPORT_CHAT':
      handleExportChat(sendResponse);
      return true;

    default:
      console.warn('Rio: Unknown message type', message.type);
  }
});

// --- Message Handlers ---

async function handleScrapeConversation(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
) {
  try {
    if (!sender.tab?.id) {
      throw new Error('No tab ID in sender');
    }

    // Ask content script to scrape the conversation
    const result = await chrome.tabs.sendMessage(sender.tab.id, {
      type: 'SCRAPE_NOW',
    });

    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('Rio: Error scraping conversation', error);
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleFactCheck(
  payload: { conversationId: string; messages: unknown[] },
  sendResponse: (response: unknown) => void
) {
  try {
    // Get settings from storage
    const settings = await storageService.getSettings();

    if (!settings?.aiConfig?.apiKey) {
      throw new Error('No API key configured');
    }

    // Call LiteLLM proxy (placeholder for now)
    console.log('Rio: Would call LiteLLM with', {
      endpoint: settings.aiConfig.litellmEndpoint,
      provider: settings.aiConfig.provider,
      messageCount: payload.messages.length,
    });

    // TODO: Week 3 - Implement actual LiteLLM call
    sendResponse({
      success: true,
      data: {
        annotations: [],
        message: 'Fact-check not yet implemented (Week 3)',
      },
    });
  } catch (error) {
    console.error('Rio: Error in fact-check', error);
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleAddAnnotation(
  payload: { annotation: unknown },
  sendResponse: (response: unknown) => void
) {
  try {
    const annotation = payload.annotation as Annotation;
    await storageService.saveAnnotation(annotation);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Rio: Error adding annotation', error);
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleExportChat(sendResponse: (response: unknown) => void) {
  try {
    // Get all data from storage
    const annotations = await storageService.getAllAnnotations();
    const settings = await storageService.getSettings();

    sendResponse({
      success: true,
      data: {
        annotations,
        settings,
        exportedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('Rio: Error exporting chat', error);
    sendResponse({ success: false, error: (error as Error).message });
  }
}

// All storage operations now handled by StorageService
// See: src/background/services/StorageService.ts
