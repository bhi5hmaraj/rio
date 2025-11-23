import React from 'react';
import ReactDOM from 'react-dom/client';
import { CopilotKit } from '@copilotkit/react-core';
import App from './App';
import './index.css';

/**
 * Custom fetch function that uses Chrome extension messaging
 * to communicate with the background worker's LiteLLM client
 */
async function copilotFetch(
  _input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    // Extract messages from the request body
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const messages = body.messages || [];

    // Send to background worker
    const response = await chrome.runtime.sendMessage({
      type: 'COPILOT_CHAT',
      payload: { messages },
    });

    if (!response.success) {
      throw new Error(response.error || 'Chat request failed');
    }

    // Format response as OpenAI-compatible
    const openAIResponse = {
      id: crypto.randomUUID(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.data.model || 'gemini-2.5-flash-lite',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response.data.message,
          },
          finish_reason: 'stop',
        },
      ],
      usage: response.data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    // Return a Response object
    return new Response(JSON.stringify(openAIResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Rio: CopilotKit fetch error', error);
    throw error;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="rio-assistant"
      showDevConsole={false}
      // @ts-expect-error - Custom fetch implementation for Chrome extension
      fetch={copilotFetch}
    >
      <App />
    </CopilotKit>
  </React.StrictMode>
);
