import { useState, useEffect } from 'react';
import { useRioStore } from '@/shared/store';
import { SettingsForm } from './components/SettingsForm';

function App() {
  const { annotations, settings, loadAnnotations, loadSettings, setAnnotations } = useRioStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Load data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load settings
        await loadSettings();

        // Get active tab to determine conversation ID
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab?.id && tab.url) {
          // Extract conversation ID from URL
          const match = tab.url.match(/\/c\/([a-f0-9-]+)/);
          const convId = match ? match[1] : null;

          if (convId) {
            setConversationId(convId);
            await loadAnnotations(convId);
          }
        }
      } catch (error) {
        console.error('Rio: Failed to load data', error);
      }
    };

    loadData();
  }, [loadAnnotations, loadSettings]);

  // Listen for storage changes for real-time updates
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') return;

      // Handle annotation changes
      if (changes.annotations && conversationId) {
        const newAnnotations = changes.annotations.newValue || {};
        const conversationAnnotations = newAnnotations[conversationId] || [];
        setAnnotations(conversationAnnotations);
      }

      // Handle settings changes
      if (changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          useRioStore.getState().setSettings(newSettings);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [conversationId, setAnnotations]);

  const handleExportChat = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script to scrape conversation
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'SCRAPE_NOW',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to scrape conversation');
      }

      const { data } = response;

      // Format export data
      const exportData = {
        conversationId: data.conversationId,
        conversationUrl: data.conversationUrl,
        messages: data.messages,
        annotations: annotations,
        scrapedAt: data.scrapedAt,
        exportedAt: Date.now(),
        version: '1.0',
      };

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const conversationIdShort = data.conversationId?.substring(0, 8) || 'unknown';
      const filename = `rio-export-${conversationIdShort}-${timestamp}.json`;

      // Create download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      console.log('Rio: Export successful', filename);
    } catch (error) {
      console.error('Rio: Export error', error);
      setExportError((error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="rio-app">
      <header className="rio-header">
        <h1>Rio</h1>
        <p className="rio-subtitle">AI Conversation Annotator</p>
      </header>

      <main className="rio-main">
        <section className="rio-section">
          <h2>Quick Actions</h2>
          <div className="rio-actions">
            <button
              className="rio-button primary"
              onClick={handleExportChat}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export Chat'}
            </button>
            <button className="rio-button secondary">
              Run Fact-Check
            </button>
          </div>
          {exportError && (
            <p className="rio-error">Export failed: {exportError}</p>
          )}
        </section>

        <section className="rio-section">
          <h2>Annotations</h2>
          {annotations.length === 0 ? (
            <p className="rio-empty-state">
              No annotations yet. Run fact-check or add manual annotations to get started.
            </p>
          ) : (
            <div className="rio-annotation-list">
              {annotations.map((annotation) => (
                <div key={annotation.id} className="rio-annotation-card">
                  <span className={`rio-category ${annotation.category}`}>
                    {annotation.category}
                  </span>
                  <p className="rio-note">{annotation.note}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rio-section">
          <div className="rio-settings-header">
            <h2>Settings</h2>
            <button
              className="rio-button secondary"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? 'Hide' : 'Configure'}
            </button>
          </div>
          {showSettings ? (
            <SettingsForm onClose={() => setShowSettings(false)} />
          ) : (
            <div className="rio-settings-summary">
              <p className="rio-text-muted">
                Provider: {settings.aiConfig.provider || 'Not configured'}
              </p>
              <p className="rio-text-muted">
                Endpoint: {settings.aiConfig.litellmEndpoint}
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="rio-footer">
        <p className="rio-version">Rio v0.1.0 MVP</p>
      </footer>
    </div>
  );
}

export default App;
