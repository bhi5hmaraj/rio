/**
 * Text Highlighter
 * Finds and highlights text in the DOM based on TextQuoteSelector annotations
 */

import type { Annotation, TextQuoteSelector } from '@/shared/types';
import { PRESET_CATEGORIES } from '@/shared/types';

export interface HighlightElement extends HTMLElement {
  dataset: {
    rioAnnotationId: string;
    rioCategory: string;
    rioStrength: string;
  };
}

/**
 * Find and highlight all annotations in the current page
 */
export function highlightAnnotations(annotations: Annotation[]): void {
  // Clear existing highlights first
  clearHighlights();

  for (const annotation of annotations) {
    try {
      highlightAnnotation(annotation);
    } catch (error) {
      console.warn(`Rio: Failed to highlight annotation ${annotation.id}`, error);
    }
  }

  console.log(`Rio: Highlighted ${annotations.length} annotations`);
}

/**
 * Highlight a single annotation
 */
function highlightAnnotation(annotation: Annotation): void {
  const { selector, category, strength = 5, id } = annotation;

  // Find the text in the DOM
  const range = findTextInDOM(selector);
  if (!range) {
    console.warn(`Rio: Could not find text for annotation ${id}`, selector);
    return;
  }

  // Create highlight span
  const highlight = document.createElement('mark');
  highlight.className = `rio-highlight ${category}`;
  highlight.dataset.rioAnnotationId = id;
  highlight.dataset.rioCategory = category;
  highlight.dataset.rioStrength = strength.toString();

  // Apply strength-based opacity (1-10 scale)
  const opacity = 0.1 + (strength / 10) * 0.4; // Range from 0.1 to 0.5
  const color = getCategoryColor(category);
  highlight.style.backgroundColor = `${color}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')}`;

  // Wrap the text with the highlight
  try {
    range.surroundContents(highlight);
  } catch (error) {
    // If surroundContents fails (e.g., range spans multiple elements),
    // try alternative approach
    console.warn('Rio: surroundContents failed, using fallback', error);
    const contents = range.extractContents();
    highlight.appendChild(contents);
    range.insertNode(highlight);
  }
}

/**
 * Find text in DOM using TextQuoteSelector
 * Returns a Range object if found, null otherwise
 */
function findTextInDOM(selector: TextQuoteSelector): Range | null {
  const { exact, prefix, suffix } = selector;

  // Get all text nodes in the document
  const textNodes = getTextNodes(document.body);

  for (const node of textNodes) {
    const text = node.textContent || '';

    // Try to find exact match
    const exactIndex = text.indexOf(exact);
    if (exactIndex === -1) continue;

    // Verify prefix if provided
    if (prefix) {
      const prefixText = text.substring(Math.max(0, exactIndex - prefix.length), exactIndex);
      if (!prefixText.includes(prefix) && !prefix.includes(prefixText)) {
        continue;
      }
    }

    // Verify suffix if provided
    if (suffix) {
      const suffixText = text.substring(exactIndex + exact.length, exactIndex + exact.length + suffix.length);
      if (!suffixText.includes(suffix) && !suffix.includes(suffixText)) {
        continue;
      }
    }

    // Create range
    const range = document.createRange();
    range.setStart(node, exactIndex);
    range.setEnd(node, exactIndex + exact.length);

    return range;
  }

  return null;
}

/**
 * Get all text nodes under a given element
 */
function getTextNodes(element: Node): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip empty text nodes and nodes in script/style tags
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;

      const tagName = parent.tagName?.toLowerCase();
      if (tagName === 'script' || tagName === 'style') {
        return NodeFilter.FILTER_REJECT;
      }

      // Skip existing Rio highlights to avoid nested highlights
      if (parent.classList?.contains('rio-highlight')) {
        return NodeFilter.FILTER_REJECT;
      }

      const text = node.textContent || '';
      if (text.trim().length === 0) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node as Text);
    }
  }

  return textNodes;
}

/**
 * Clear all existing highlights
 */
export function clearHighlights(): void {
  const highlights = document.querySelectorAll('.rio-highlight');
  highlights.forEach((highlight) => {
    // Replace highlight with its text content
    const parent = highlight.parentNode;
    if (parent) {
      const textNode = document.createTextNode(highlight.textContent || '');
      parent.replaceChild(textNode, highlight);
    }
  });
}

/**
 * Get category color from presets
 */
function getCategoryColor(category: string): string {
  const preset = PRESET_CATEGORIES.find((c) => c.id === category);
  return preset?.color || '#6366f1'; // Default to blue
}

/**
 * Get annotation by ID from a highlight element
 */
export function getAnnotationIdFromHighlight(element: Element): string | null {
  const highlight = element.closest('.rio-highlight');
  if (!highlight) return null;

  return (highlight as HighlightElement).dataset.rioAnnotationId || null;
}
