/**
 * Manual Annotation Form
 * Allows users to create annotations manually on selected text
 */

import { useState, useEffect } from 'react';
import type { Annotation, Category } from '@/shared/types';
import { PRESET_CATEGORIES } from '@/shared/types';

interface AnnotationFormProps {
  selectedText?: string;
  conversationId: string;
  onSave: (annotation: Annotation) => void;
  onCancel: () => void;
}

export function AnnotationForm({
  selectedText = '',
  conversationId,
  onSave,
  onCancel,
}: AnnotationFormProps) {
  const [category, setCategory] = useState<string>('factuality');
  const [note, setNote] = useState('');
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<{ category?: string; note?: string }>({});

  // Load custom categories from storage
  useEffect(() => {
    const loadCategories = async () => {
      const result = await chrome.storage.local.get('customCategories');
      setCustomCategories(result.customCategories || []);
    };
    loadCategories();
  }, []);

  const validate = (): boolean => {
    const newErrors: { category?: string; note?: string } = {};

    if (!category) {
      newErrors.category = 'Please select a category';
    }

    if (!note.trim()) {
      newErrors.note = 'Please enter a note';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      // Get the active tab to extract conversation URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.url || !tab?.id) {
        throw new Error('No active tab found');
      }

      // Get message index and context from content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SELECTION_CONTEXT',
        payload: { text: selectedText },
      });

      const { prefix = '', suffix = '', messageIndex = 0 } = response || {};

      // Create annotation
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        conversationId,
        conversationUrl: tab.url,
        messageIndex,
        selector: {
          type: 'TextQuoteSelector',
          exact: selectedText,
          prefix: prefix.substring(0, 20),
          suffix: suffix.substring(0, 20),
        },
        category,
        note: note.trim(),
        source: 'manual',
        createdAt: Date.now(),
      };

      // Save annotation via background worker
      await chrome.runtime.sendMessage({
        type: 'ADD_ANNOTATION',
        payload: { annotation },
      });

      onSave(annotation);
    } catch (error) {
      console.error('Rio: Error creating annotation', error);
      setErrors({ note: (error as Error).message });
    }
  };

  return (
    <form className="rio-annotation-form" onSubmit={handleSubmit}>
      <div className="rio-form-header">
        <h3>Add Manual Annotation</h3>
        <button
          type="button"
          className="rio-close-button"
          onClick={onCancel}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {selectedText && (
        <div className="rio-selected-text">
          <label className="rio-label">Selected Text:</label>
          <blockquote className="rio-quote">"{selectedText}"</blockquote>
        </div>
      )}

      <div className="rio-form-group">
        <label htmlFor="category" className="rio-label">
          Category *
        </label>
        <select
          id="category"
          className={`rio-select ${errors.category ? 'error' : ''}`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Select a category...</option>
          <optgroup label="Preset Categories">
            {PRESET_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </optgroup>
          {customCategories.length > 0 && (
            <optgroup label="Custom Categories">
              {customCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {errors.category && <span className="rio-error-text">{errors.category}</span>}
      </div>

      <div className="rio-form-group">
        <label htmlFor="note" className="rio-label">
          Note *
          <span className="rio-help-text">Markdown supported</span>
        </label>
        <textarea
          id="note"
          className={`rio-textarea ${errors.note ? 'error' : ''}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Explain the issue or add your critique..."
          rows={4}
        />
        {errors.note && <span className="rio-error-text">{errors.note}</span>}
      </div>

      <div className="rio-form-actions">
        <button type="button" className="rio-button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="rio-button primary">
          Save Annotation
        </button>
      </div>
    </form>
  );
}
