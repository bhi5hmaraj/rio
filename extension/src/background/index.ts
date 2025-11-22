/**
 * Rio Background Service Worker
 * Handles:
 * - Message passing between components
 * - API calls to LiteLLM proxy
 * - Storage management
 * - Side Panel management
 */

import type { RioMessage } from '@/shared/types';

console.log('Rio: Background service worker loaded');

// --- Side Panel Management ---

// Open side panel when extension icon clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// --- Context Menu (for manual annotations) ---

chrome.runtime.onInstalled.addListener(() => {
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
      handleFactCheck(message.payload, sendResponse);
      return true;

    case 'ADD_ANNOTATION':
      handleAddAnnotation(message.payload, sendResponse);
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
    const settings = await chrome.storage.local.get('settings');
    const aiConfig = settings.settings?.aiConfig;

    if (!aiConfig?.apiKey) {
      throw new Error('No API key configured');
    }

    // Call LiteLLM proxy (placeholder for now)
    console.log('Rio: Would call LiteLLM with', {
      endpoint: aiConfig.litellmEndpoint,
      provider: aiConfig.provider,
      messageCount: payload.messages.length,
    });

    // TODO: Implement actual LiteLLM call
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
    // Get existing annotations from storage
    const result = await chrome.storage.local.get('annotations');
    const annotations = result.annotations || {};

    // Add new annotation (grouped by conversationId)
    const annotation = payload.annotation as {
      conversationId: string;
      [key: string]: unknown;
    };
    const conversationId = annotation.conversationId;

    if (!annotations[conversationId]) {
      annotations[conversationId] = [];
    }

    annotations[conversationId].push(annotation);

    // Save back to storage
    await chrome.storage.local.set({ annotations });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Rio: Error adding annotation', error);
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleExportChat(sendResponse: (response: unknown) => void) {
  try {
    // Get all data from storage
    const result = await chrome.storage.local.get(['annotations', 'settings']);

    sendResponse({
      success: true,
      data: {
        annotations: result.annotations || {},
        settings: result.settings || {},
        exportedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('Rio: Error exporting chat', error);
    sendResponse({ success: false, error: (error as Error).message });
  }
}

// --- Storage Management ---

// Initialize storage with defaults if needed
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['settings', 'annotations', 'customCategories']);

  if (!result.settings) {
    await chrome.storage.local.set({
      settings: {
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
});
