/**
 * Annotation Tooltip
 * Shows detailed information about annotations on hover/click
 */

import type { Annotation } from '@/shared/types';
import { PRESET_CATEGORIES } from '@/shared/types';

let tooltipElement: HTMLElement | null = null;
let currentAnnotations: Annotation[] = [];

/**
 * Initialize tooltip functionality
 */
export function initializeTooltip(annotations: Annotation[]) {
  currentAnnotations = annotations;

  // Add event listeners to all highlights
  setupHighlightListeners();
}

/**
 * Update annotations (for storage sync)
 */
export function updateAnnotations(annotations: Annotation[]) {
  currentAnnotations = annotations;
  hideTooltip();
}

/**
 * Setup event listeners for highlight elements
 */
function setupHighlightListeners() {
  // Use event delegation for better performance
  document.addEventListener('mouseover', handleHighlightHover);
  document.addEventListener('click', handleHighlightClick);
  document.addEventListener('mouseout', handleMouseOut);
}

/**
 * Handle mouse hover over highlights
 */
function handleHighlightHover(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const highlight = target.closest('.rio-highlight');

  if (!highlight) {
    // Only hide if we're not moving to the tooltip itself
    if (!tooltipElement?.contains(target)) {
      hideTooltip();
    }
    return;
  }

  const annotationId = (highlight as HTMLElement).dataset.rioAnnotationId;
  if (!annotationId) return;

  const annotation = currentAnnotations.find((a) => a.id === annotationId);
  if (!annotation) return;

  showTooltip(annotation, highlight as HTMLElement, event);
}

/**
 * Handle click on highlights
 */
function handleHighlightClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const highlight = target.closest('.rio-highlight');

  if (!highlight) return;

  const annotationId = (highlight as HTMLElement).dataset.rioAnnotationId;
  if (!annotationId) return;

  const annotation = currentAnnotations.find((a) => a.id === annotationId);
  if (!annotation) return;

  // Show tooltip and keep it visible
  showTooltip(annotation, highlight as HTMLElement, event, true);
  event.stopPropagation();
}

/**
 * Handle mouse out
 */
function handleMouseOut(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const highlight = target.closest('.rio-highlight');

  if (!highlight) return;

  // Don't hide if moving to tooltip
  const relatedTarget = event.relatedTarget as HTMLElement;
  if (tooltipElement?.contains(relatedTarget)) return;

  // Hide tooltip after a short delay
  setTimeout(() => {
    const isHoveringTooltip = tooltipElement?.matches(':hover');
    const isHoveringHighlight = document.querySelector('.rio-highlight:hover');

    if (!isHoveringTooltip && !isHoveringHighlight) {
      hideTooltip();
    }
  }, 100);
}

/**
 * Show tooltip with annotation details
 */
function showTooltip(annotation: Annotation, element: HTMLElement, event: MouseEvent, pinned = false) {
  // Remove existing tooltip
  hideTooltip();

  // Create tooltip element
  tooltipElement = document.createElement('div');
  tooltipElement.className = 'rio-tooltip';
  if (pinned) {
    tooltipElement.classList.add('rio-tooltip-pinned');
  }

  // Get category info
  const categoryInfo = PRESET_CATEGORIES.find((c) => c.id === annotation.category);
  const categoryName = categoryInfo?.name || annotation.category;
  const categoryColor = categoryInfo?.color || '#6366f1';

  // Build tooltip content
  tooltipElement.innerHTML = `
    <div class="rio-tooltip-header">
      <span class="rio-tooltip-category" style="color: ${categoryColor}">
        ${categoryName}
      </span>
      <span class="rio-tooltip-strength">
        Strength: ${annotation.strength || 5}/10
      </span>
    </div>
    <div class="rio-tooltip-quote">
      "${annotation.selector.exact}"
    </div>
    <div class="rio-tooltip-note">
      ${annotation.note}
    </div>
    <div class="rio-tooltip-meta">
      ${annotation.source === 'ai' ? `
        <span>AI: ${annotation.provider || 'unknown'}</span>
        ${annotation.model ? `<span class="rio-tooltip-model">${annotation.model}</span>` : ''}
      ` : `
        <span>Manual annotation</span>
      `}
    </div>
    ${pinned ? '<div class="rio-tooltip-close">×</div>' : ''}
  `;

  // Add close button handler for pinned tooltips
  if (pinned) {
    const closeBtn = tooltipElement.querySelector('.rio-tooltip-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideTooltip();
    });
  }

  document.body.appendChild(tooltipElement);

  // Position tooltip
  positionTooltip(element, event);

  // Add hover listener to keep tooltip visible
  tooltipElement.addEventListener('mouseenter', () => {
    // Keep tooltip visible
  });

  tooltipElement.addEventListener('mouseleave', () => {
    if (!pinned) {
      hideTooltip();
    }
  });
}

/**
 * Position tooltip near the cursor, ensuring it stays in viewport
 */
function positionTooltip(element: HTMLElement, event: MouseEvent) {
  if (!tooltipElement) return;

  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Start with cursor position
  let left = event.clientX;
  let top = rect.bottom + 8; // 8px below the highlight

  // Adjust horizontal position to stay in viewport
  if (left + tooltipRect.width > viewportWidth - 16) {
    left = viewportWidth - tooltipRect.width - 16;
  }

  if (left < 16) {
    left = 16;
  }

  // Adjust vertical position if tooltip goes below viewport
  if (top + tooltipRect.height > viewportHeight - 16) {
    // Show above the highlight instead
    top = rect.top - tooltipRect.height - 8;
  }

  // If still doesn't fit, position at bottom of viewport
  if (top < 16) {
    top = 16;
  }

  tooltipElement.style.left = `${left}px`;
  tooltipElement.style.top = `${top}px`;
}

/**
 * Hide tooltip
 */
export function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
}

/**
 * Hide tooltip on click outside
 */
document.addEventListener('click', (event) => {
  if (tooltipElement && !tooltipElement.contains(event.target as Node)) {
    const highlight = (event.target as HTMLElement).closest('.rio-highlight');
    if (!highlight) {
      hideTooltip();
    }
  }
});
