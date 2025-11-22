import React from 'react';
import { useRioStore } from '@/shared/store';

function App() {
  const { annotations, settings } = useRioStore();

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
            <button className="rio-button primary">
              Export Chat
            </button>
            <button className="rio-button secondary">
              Run Fact-Check
            </button>
          </div>
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
          <h2>Settings</h2>
          <div className="rio-settings">
            <p className="rio-text-muted">
              {settings.aiConfig.provider
                ? `Provider: ${settings.aiConfig.provider}`
                : 'No AI provider configured'}
            </p>
          </div>
        </section>
      </main>

      <footer className="rio-footer">
        <p className="rio-version">Rio v0.1.0 MVP</p>
      </footer>
    </div>
  );
}

export default App;
