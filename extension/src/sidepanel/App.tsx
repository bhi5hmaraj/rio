import { useState, useEffect } from 'react';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { useRioStore } from '@/shared/store';
import { SettingsForm } from './components/SettingsForm';
import { AnnotationForm } from './components/AnnotationForm';
import type { Annotation } from '@/shared/types';

function App() {
  const { annotations, settings, loadAnnotations, loadSettings, setAnnotations } = useRioStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [conversationData, setConversationData] = useState<any>(null);

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

  // Listen for messages from background/content scripts
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'SHOW_ANNOTATION_FORM') {
        setSelectedText(message.payload?.selectedText || '');
        setShowAnnotationForm(true);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

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

  // Make conversation context available to Copilot
  useCopilotReadable({
    description: 'Current ChatGPT conversation and annotations',
    value: {
      conversationId,
      annotations,
      annotationCount: annotations.length,
      categories: annotations.map(a => a.category),
      conversationData,
    },
  });

  // Define Copilot actions
  useCopilotAction({
    name: 'exportChat',
    description: 'Export the current ChatGPT conversation with all annotations to a JSON file',
    handler: async () => {
      return await handleExportChat();
    },
  });

  useCopilotAction({
    name: 'runFactCheck',
    description: 'Run AI fact-checking on the current ChatGPT conversation to find errors, biases, and problematic content',
    handler: async () => {
      return await handleRunFactCheck();
    },
  });

  useCopilotAction({
    name: 'addAnnotation',
    description: 'Add a manual annotation to selected text in the conversation',
    parameters: [
      {
        name: 'category',
        type: 'string',
        description: 'Annotation category: factuality, critique, sycophancy, or bias',
        required: true,
      },
      {
        name: 'note',
        type: 'string',
        description: 'The annotation note explaining the issue',
        required: true,
      },
      {
        name: 'selectedText',
        type: 'string',
        description: 'The text to annotate',
        required: false,
      },
    ],
    handler: async ({ category, note, selectedText: text }) => {
      if (!conversationId) {
        return { success: false, message: 'No conversation ID found' };
      }

      const annotation: Annotation = {
        id: crypto.randomUUID(),
        conversationId,
        conversationUrl: window.location.href,
        messageIndex: 0,
        selector: {
          type: 'TextQuoteSelector',
          exact: text || selectedText,
          prefix: '',
          suffix: '',
        },
        category,
        note,
        source: 'manual',
        createdAt: Date.now(),
      };

      await chrome.runtime.sendMessage({
        type: 'ADD_ANNOTATION',
        payload: { annotation },
      });

      return { success: true, annotation };
    },
  });

  useCopilotAction({
    name: 'listAnnotations',
    description: 'List all annotations for the current conversation',
    handler: async () => {
      return {
        count: annotations.length,
        annotations: annotations.map(a => ({
          category: a.category,
          note: a.note,
          source: a.source,
          quote: a.selector.exact,
        })),
      };
    },
  });

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
      setConversationData(data);

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
      return { success: true, filename };
    } catch (error) {
      console.error('Rio: Export error', error);
      setExportError((error as Error).message);
      return { success: false, error: (error as Error).message };
    } finally {
      setIsExporting(false);
    }
  };

  const handleRunFactCheck = async () => {
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.id) {
        throw new Error('No active tab found');
      }

      // Scrape conversation first
      const scrapeResponse = await chrome.tabs.sendMessage(tab.id, {
        type: 'SCRAPE_NOW',
      });

      if (!scrapeResponse.success) {
        throw new Error(scrapeResponse.error || 'Failed to scrape conversation');
      }

      const { data } = scrapeResponse;
      setConversationData(data);

      // Run fact-check via background worker
      const factCheckResponse = await chrome.runtime.sendMessage({
        type: 'RUN_FACT_CHECK',
        payload: {
          conversationId: data.conversationId,
          messages: data.messages,
        },
      });

      if (!factCheckResponse.success) {
        throw new Error(factCheckResponse.error || 'Fact-check failed');
      }

      console.log('Rio: Fact-check complete', factCheckResponse.data);
      return {
        success: true,
        annotationsFound: factCheckResponse.data.count,
        annotations: factCheckResponse.data.annotations,
      };
    } catch (error) {
      console.error('Rio: Fact-check error', error);
      setExportError((error as Error).message);
      return { success: false, error: (error as Error).message };
    }
  };

  const handleSaveAnnotation = (annotation: Annotation) => {
    setShowAnnotationForm(false);
    setSelectedText('');
    console.log('Rio: Annotation saved', annotation);
  };

  const handleCancelAnnotation = () => {
    setShowAnnotationForm(false);
    setSelectedText('');
  };

  return (
    <CopilotSidebar
      defaultOpen={true}
      clickOutsideToClose={false}
      labels={{
        title: 'Rio AI Assistant',
        initial: 'Hi! I can help you fact-check conversations, add annotations, and export your chat data. What would you like to do?',
      }}
    >
      <div className="rio-app">
        <header className="rio-header">
          <h1>Rio</h1>
          <p className="rio-subtitle">AI Conversation Annotator</p>
        </header>

        <main className="rio-main">
          {/* Show annotation form when active */}
          {showAnnotationForm && conversationId && (
            <section className="rio-section rio-annotation-form-section">
              <AnnotationForm
                selectedText={selectedText}
                conversationId={conversationId}
                onSave={handleSaveAnnotation}
                onCancel={handleCancelAnnotation}
              />
            </section>
          )}

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
              <button className="rio-button secondary" onClick={handleRunFactCheck}>
                Run Fact-Check
              </button>
              <button
                className="rio-button secondary"
                onClick={() => setShowAnnotationForm(!showAnnotationForm)}
              >
                {showAnnotationForm ? 'Hide Form' : 'Add Annotation'}
              </button>
            </div>
            {exportError && <p className="rio-error">Error: {exportError}</p>}
          </section>

          <section className="rio-section">
            <h2>Annotations ({annotations.length})</h2>
            {annotations.length === 0 ? (
              <p className="rio-empty-state">
                No annotations yet. Try saying "run fact check" or "add an annotation"
              </p>
            ) : (
              <div className="rio-annotation-list">
                {annotations.map((annotation) => (
                  <div key={annotation.id} className="rio-annotation-card">
                    <span className={`rio-category ${annotation.category}`}>
                      {annotation.category}
                    </span>
                    <p className="rio-quote">"{annotation.selector.exact.substring(0, 80)}..."</p>
                    <p className="rio-note">{annotation.note}</p>
                    <p className="rio-meta">
                      {annotation.source === 'ai' ? '🤖 AI' : '✏️ Manual'} •{' '}
                      {new Date(annotation.createdAt).toLocaleTimeString()}
                    </p>
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
          <p className="rio-version">Rio v0.1.0 MVP • Powered by CopilotKit</p>
        </footer>
      </div>
    </CopilotSidebar>
  );
}

export default App;
