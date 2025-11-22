/**
 * Rio Content Script
 * Runs on ChatGPT pages
 * Handles:
 * - Conversation scraping
 * - Text highlighting
 * - HUD overlay for annotations
 * - Text selection detection
 */

import { getChatGPTSelectors, scrapeConversation, getConversationId } from './scrapers/chatgpt';

console.log('Rio: Content script loaded on', window.location.href);

// --- Initialize ---

let conversationId: string | null = null;

function init() {
  conversationId = getConversationId();
  console.log('Rio: Conversation ID:', conversationId);

  // Inject Rio styles
  injectStyles();

  // Set up message listener
  setupMessageListener();

  // Set up text selection listener for HUD
  setupSelectionListener();

  console.log('Rio: Content script initialized');
}

// --- Message Handling ---

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Rio Content: Received message', message.type);

    switch (message.type) {
      case 'SCRAPE_NOW':
        handleScrapeNow(sendResponse);
        return true; // Keep channel open

      case 'SHOW_ANNOTATION_FORM':
        handleShowAnnotationForm(message.payload);
        break;

      case 'HIGHLIGHT_TEXT':
        handleHighlightText(message.payload);
        break;

      default:
        console.warn('Rio Content: Unknown message type', message.type);
    }
  });
}

// --- Message Handlers ---

function handleScrapeNow(sendResponse: (response: unknown) => void) {
  try {
    const data = scrapeConversation();
    sendResponse({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Rio: Error scraping conversation', error);
    sendResponse({
      success: false,
      error: (error as Error).message,
    });
  }
}

function handleShowAnnotationForm(payload: { selectedText: string }) {
  console.log('Rio: Show annotation form for', payload.selectedText);
  // TODO: Week 4 - Show annotation form in side panel
}

function handleHighlightText(payload: { annotation: unknown }) {
  console.log('Rio: Highlight text', payload);
  // TODO: Week 3 - Implement highlighting
}

// --- Text Selection & HUD ---

let hudElement: HTMLElement | null = null;

function setupSelectionListener() {
  document.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      showHUD(selection);
    } else {
      hideHUD();
    }
  });

  // Hide HUD when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    if (hudElement && !hudElement.contains(e.target as Node)) {
      hideHUD();
    }
  });
}

function showHUD(selection: Selection) {
  // Remove existing HUD
  hideHUD();

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Create HUD element
  hudElement = document.createElement('div');
  hudElement.className = 'rio-hud';
  hudElement.innerHTML = `
    <button class="rio-hud-button" data-action="annotate">
      📝 Annotate
    </button>
  `;

  // Position near selection
  hudElement.style.position = 'fixed';
  hudElement.style.left = `${rect.left}px`;
  hudElement.style.top = `${rect.bottom + 5}px`;
  hudElement.style.zIndex = '10000';

  document.body.appendChild(hudElement);

  // Add click handler
  const button = hudElement.querySelector('[data-action="annotate"]');
  button?.addEventListener('click', () => {
    const selectedText = selection.toString().trim();
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
    });

    chrome.runtime.sendMessage({
      type: 'ADD_ANNOTATION',
      payload: {
        selectedText,
        conversationId,
      },
    });

    hideHUD();
  });
}

function hideHUD() {
  if (hudElement) {
    hudElement.remove();
    hudElement = null;
  }
}

// --- Styles ---

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Rio HUD Overlay */
    .rio-hud {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px;
    }

    .rio-hud-button {
      padding: 6px 12px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .rio-hud-button:hover {
      background: #4f46e5;
    }

    /* Rio Highlights (for Week 3) */
    .rio-highlight {
      background-color: rgba(99, 102, 241, 0.2);
      border-bottom: 2px solid #6366f1;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .rio-highlight:hover {
      background-color: rgba(99, 102, 241, 0.3);
    }

    .rio-highlight.factuality {
      border-bottom-color: #00c65e;
      background-color: rgba(0, 198, 94, 0.1);
    }

    .rio-highlight.critique {
      border-bottom-color: #007bff;
      background-color: rgba(0, 123, 255, 0.1);
    }

    .rio-highlight.sycophancy {
      border-bottom-color: #ffa500;
      background-color: rgba(255, 165, 0, 0.1);
    }

    .rio-highlight.bias {
      border-bottom-color: #dc3545;
      background-color: rgba(220, 53, 69, 0.1);
    }
  `;
  document.head.appendChild(style);
}

// --- Initialize on load ---

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
