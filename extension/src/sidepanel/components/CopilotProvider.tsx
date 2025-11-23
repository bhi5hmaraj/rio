/**
 * CopilotKit Provider for Rio Side Panel
 * Wraps the app with CopilotKit and defines AI actions
 */

import { CopilotKit } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { ReactNode } from 'react';

interface CopilotProviderProps {
  children: ReactNode;
}

/**
 * Custom fetch function that uses Chrome extension messaging
 * to communicate with the background worker
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

export function CopilotProvider({ children }: CopilotProviderProps) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilot" // Dummy URL, we override fetch
      publicApiKey="dummy-key" // Not used, we override fetch
      // @ts-ignore - Custom fetch implementation
      fetch={copilotFetch}
    >
      {children}
      <CopilotPopup
        instructions="You are Rio, an AI assistant for analyzing and annotating ChatGPT conversations. You can help users:
- Run fact-checks on conversations
- Add manual annotations
- Export conversation data
- Analyze conversation quality

Be concise and helpful. When suggesting fact-checks or annotations, explain your reasoning."
        labels={{
          title: 'Rio Assistant',
          initial: 'Hi! I can help you analyze and annotate this conversation. Ask me anything!',
        }}
      />
    </CopilotKit>
  );
}
