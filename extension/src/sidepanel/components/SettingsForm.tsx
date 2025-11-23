import { useState } from 'react';
import { useRioStore } from '@/shared/store';
import type { AIProvider } from '@/shared/types';

interface SettingsFormProps {
  onClose?: () => void;
}

export function SettingsForm({ onClose }: SettingsFormProps) {
  const { settings, updateSettings } = useRioStore();
  const [formData, setFormData] = useState({
    litellmEndpoint: settings.aiConfig.litellmEndpoint,
    provider: settings.aiConfig.provider,
    apiKey: settings.aiConfig.apiKey,
    model: settings.aiConfig.model || '',
    autoFactCheck: settings.preferences.autoFactCheck,
    showHUD: settings.preferences.showHUD,
    highlightStyle: settings.preferences.highlightStyle,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Update settings via message to background worker
      // Background worker will use StorageService to encrypt API key
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: {
          aiConfig: {
            litellmEndpoint: formData.litellmEndpoint,
            provider: formData.provider as AIProvider,
            apiKey: formData.apiKey,
            model: formData.model,
          },
          preferences: {
            autoFactCheck: formData.autoFactCheck,
            showHUD: formData.showHUD,
            highlightStyle: formData.highlightStyle,
          },
        },
      });

      if (response.success) {
        // Update local store
        updateSettings({
          aiConfig: {
            litellmEndpoint: formData.litellmEndpoint,
            provider: formData.provider as AIProvider,
            apiKey: formData.apiKey,
            model: formData.model,
          },
          preferences: {
            autoFactCheck: formData.autoFactCheck,
            showHUD: formData.showHUD,
            highlightStyle: formData.highlightStyle,
          },
        });

        setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        throw new Error(response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Rio: Error saving settings', error);
      setSaveMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rio-settings-form">
      <h3>AI Configuration</h3>

      <div className="rio-form-group">
        <label htmlFor="litellm-endpoint">LiteLLM Endpoint</label>
        <input
          id="litellm-endpoint"
          type="url"
          value={formData.litellmEndpoint}
          onChange={(e) => setFormData({ ...formData, litellmEndpoint: e.target.value })}
          placeholder="http://localhost:4000"
          required
        />
      </div>

      <div className="rio-form-group">
        <label htmlFor="provider">Provider</label>
        <select
          id="provider"
          value={formData.provider}
          onChange={(e) => setFormData({ ...formData, provider: e.target.value as AIProvider })}
          required
        >
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="rio-form-group">
        <label htmlFor="api-key">API Key</label>
        <div className="rio-input-with-button">
          <input
            id="api-key"
            type={showApiKey ? 'text' : 'password'}
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            placeholder="Enter your API key"
            required
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="rio-toggle-button"
          >
            {showApiKey ? '🙈' : '👁️'}
          </button>
        </div>
        <small className="rio-form-hint">API key is encrypted before storage</small>
      </div>

      <div className="rio-form-group">
        <label htmlFor="model">Model (Optional)</label>
        <input
          id="model"
          type="text"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="e.g., gemini-2.5-flash"
        />
      </div>

      <h3>Preferences</h3>

      <div className="rio-form-group rio-checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={formData.autoFactCheck}
            onChange={(e) => setFormData({ ...formData, autoFactCheck: e.target.checked })}
          />
          <span>Auto fact-check new messages</span>
        </label>
      </div>

      <div className="rio-form-group rio-checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={formData.showHUD}
            onChange={(e) => setFormData({ ...formData, showHUD: e.target.checked })}
          />
          <span>Show HUD overlay on text selection</span>
        </label>
      </div>

      <div className="rio-form-group">
        <label htmlFor="highlight-style">Highlight Style</label>
        <select
          id="highlight-style"
          value={formData.highlightStyle}
          onChange={(e) => setFormData({ ...formData, highlightStyle: e.target.value as 'underline' | 'background' | 'border' })}
        >
          <option value="underline">Underline</option>
          <option value="background">Background</option>
          <option value="border">Border</option>
        </select>
      </div>

      <div className="rio-form-actions">
        <button type="submit" className="rio-button primary" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="rio-button secondary">
            Cancel
          </button>
        )}
      </div>

      {saveMessage && (
        <div className={`rio-message ${saveMessage.type}`}>
          {saveMessage.text}
        </div>
      )}
    </form>
  );
}
