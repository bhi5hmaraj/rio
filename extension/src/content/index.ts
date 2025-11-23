/**
 * Rio Content Script
 * Runs on ChatGPT pages
 * Handles:
 * - Conversation scraping
 * - Text highlighting
 * - HUD overlay for annotations
 * - Text selection detection
 */

import { ScraperFactory } from './scrapers/factory';
import type { PlatformScraper } from './scrapers/base';
import { highlightAnnotations, clearHighlights } from './highlighter';
import type { Annotation } from '@/shared/types';

console.log('Rio: Content script loaded on', window.location.href);

// --- Initialize ---

let scraper: PlatformScraper | null = null;
let conversationId: string | null = null;
let currentAnnotations: Annotation[] = [];

function init() {
  // Auto-detect platform and get appropriate scraper
  scraper = ScraperFactory.getScraper();

  if (!scraper) {
    console.warn('Rio: Not running on a supported platform');
    return;
  }

  conversationId = scraper.getConversationId();
  console.log('Rio: Platform:', scraper.platform);
  console.log('Rio: Conversation ID:', conversationId);

  // Inject Rio styles
  injectStyles();

  // Set up message listener
  setupMessageListener();

  // Set up text selection listener for HUD
  setupSelectionListener();

  // Load and highlight annotations
  if (conversationId) {
    loadAndHighlightAnnotations();
    setupStorageListener();
  }

  console.log('Rio: Content script initialized');
}

// --- Message Handling ---

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    if (!scraper) {
      throw new Error('No scraper available for this platform');
    }

    const data = scraper.scrapeConversation();
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
  const annotation = payload.annotation as Annotation;
  currentAnnotations.push(annotation);
  highlightAnnotations([annotation]);
}

// --- Annotation Loading & Storage Sync ---

async function loadAndHighlightAnnotations() {
  if (!conversationId) return;

  try {
    const result = await chrome.storage.local.get('annotations');
    const allAnnotations = result.annotations || {};
    const annotations = allAnnotations[conversationId] || [];

    currentAnnotations = annotations;
    highlightAnnotations(annotations);

    console.log(`Rio: Loaded and highlighted ${annotations.length} annotations`);
  } catch (error) {
    console.error('Rio: Error loading annotations', error);
  }
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes.annotations || !conversationId) return;

    const allAnnotations = changes.annotations.newValue || {};
    const annotations = allAnnotations[conversationId] || [];

    currentAnnotations = annotations;
    clearHighlights();
    highlightAnnotations(annotations);

    console.log(`Rio: Storage updated, re-highlighted ${annotations.length} annotations`);
  });
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

    /* Rio Highlights */
    .rio-highlight {
      cursor: pointer;
      border-radius: 2px;
      padding: 0 2px;
      transition: all 0.2s ease;
      position: relative;
    }

    .rio-highlight:hover {
      filter: brightness(1.2);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Category colors (borders) */
    .rio-highlight.factuality {
      border-bottom: 2px solid #00c65e;
    }

    .rio-highlight.critique {
      border-bottom: 2px solid #007bff;
    }

    .rio-highlight.sycophancy {
      border-bottom: 2px solid #ffa500;
    }

    .rio-highlight.bias {
      border-bottom: 2px solid #dc3545;
    }

    /* Custom category fallback */
    .rio-highlight:not(.factuality):not(.critique):not(.sycophancy):not(.bias) {
      border-bottom: 2px solid #6366f1;
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
