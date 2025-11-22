# Multiplayer Architecture

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

Rio Multiplayer extends the core extension architecture with WebSocket-based real-time collaboration. This document describes the components, data flow, and platform adapters.

---

## 1. Component Architecture

```
┌──────────────────────────────────────────────────────┐
│ Rio Chrome Extension                                 │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ Content Script (runs on claude.ai/chatgpt.com)│  │
│ │                                                │  │
│ │ • Detects platform (Claude/ChatGPT)            │  │
│ │ • Monitors DOM for new messages                │  │
│ │ • Injects questions into input box             │  │
│ │ • Clicks send button (when host approves)      │  │
│ │ • Detects manual sends (host presses Enter)    │  │
│ └────────────┬───────────────────────────────────┘  │
│              │                                       │
│ ┌────────────▼───────────────────────────────────┐  │
│ │ Background Worker (Service Worker)             │  │
│ │                                                │  │
│ │ • Manages WebSocket connections                │  │
│ │ • Broadcasts messages to participants          │  │
│ │ • Tracks session state                         │  │
│ │ • Handles voting logic                         │  │
│ └────────────┬───────────────────────────────────┘  │
│              │                                       │
│ ┌────────────▼───────────────────────────────────┐  │
│ │ Side Panel UI (React)                          │  │
│ │                                                │  │
│ │ • Question queue display                       │  │
│ │ • Voting interface                             │  │
│ │ • Team chat                                    │  │
│ │ • Live chat mirror                             │  │
│ └────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────────┘
               │
               │ WebSocket (wss://)
               │
    ┌──────────▼──────────┐
    │ Rio Backend Server  │
    │ • Session registry  │
    │ • Message relay     │
    │ • Presence tracking │
    └─────────────────────┘
```

### 1.1 Content Script

**File:** `src/content/multiplayer.ts`

**Responsibilities:**

- Platform detection and adapter initialization
- DOM observation for new messages
- Question injection into chat input
- Send button automation
- Manual send detection
- Overlay UI rendering

**Key APIs:**

```typescript
class MultiplayerContentScript {
  private adapter: PlatformAdapter;

  init(): void {
    this.adapter = this.detectPlatform();
    this.setupMessageObserver();
    this.setupInputObserver();
    this.listenForCommands();
  }

  injectQuestion(question: Question): void {
    this.adapter.setInputText(question.content);
    this.showOverlay(question);
  }

  sendQuestion(): void {
    this.adapter.clickSend();
    this.observeResponse();
  }
}
```

### 1.2 Background Worker

**File:** `src/background/multiplayer.ts`

**Responsibilities:**

- WebSocket connection management
- Session state synchronization
- Message routing between components
- Vote calculation
- Participant tracking

**Key APIs:**

```typescript
class MultiplayerBackgroundWorker {
  private ws: WebSocket;
  private sessionState: SessionState;

  createSession(platform: Platform): Session {
    const session = await this.backend.createSession({
      platform,
      hostId: this.getCurrentUserId()
    });

    this.connectWebSocket(session.id);
    return session;
  }

  joinSession(code: string): void {
    const session = await this.backend.joinSession(code);
    this.connectWebSocket(session.id);
  }

  onMessage(msg: WSMessage): void {
    switch (msg.type) {
      case 'question-submit':
        this.handleQuestionSubmit(msg.question);
        break;
      case 'question-vote':
        this.handleVote(msg);
        break;
      // ... other handlers
    }
  }
}
```

### 1.3 Side Panel UI

**File:** `src/ui/multiplayer/`

**Components:**

- `SessionControl.tsx` - Create/join session controls
- `QuestionQueue.tsx` - Question list with voting
- `ChatView.tsx` - Live chat display
- `TeamChat.tsx` - Side channel discussion
- `ParticipantList.tsx` - Online participants

**State Management:**

```typescript
// Zustand store
interface MultiplayerStore {
  session: Session | null;
  participants: Map<string, Participant>;
  questions: Map<string, Question>;
  chatMessages: ChatMessage[];
  teamMessages: TeamChatMessage[];

  submitQuestion: (content: string) => void;
  voteQuestion: (id: string, vote: 'up' | 'down') => void;
  selectQuestion: (id: string) => void;
}
```

---

## 2. Platform Adapters

### 2.1 Adapter Interface

```typescript
interface PlatformAdapter {
  name: 'claude' | 'chatgpt';
  hostname: string;

  // Selectors
  selectors: {
    input: string;
    sendButton: string;
    messageContainer: string;
    userMessage: string;
    modelMessage: string;
    typingIndicator?: string;
  };

  // Actions
  setInputText(text: string): void;
  clickSend(): void;
  getLastMessage(): string | null;
  isTyping(): boolean;

  // Observers
  observeNewMessages(callback: (msg: Message) => void): MutationObserver;
  observeInputChange(callback: (text: string) => void): MutationObserver;
}
```

### 2.2 Claude Adapter

```typescript
class ClaudeAdapter implements PlatformAdapter {
  name = 'claude';
  hostname = 'claude.ai';

  selectors = {
    input: 'div[contenteditable="true"]',
    sendButton: 'button[aria-label="Send Message"]',
    messageContainer: '.font-claude-message',
    userMessage: '[data-is-user-message="true"]',
    modelMessage: '[data-is-user-message="false"]',
  };

  setInputText(text: string): void {
    const input = document.querySelector(this.selectors.input) as HTMLElement;
    if (!input) throw new Error('Input not found');

    input.textContent = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  clickSend(): void {
    const button = document.querySelector(this.selectors.sendButton) as HTMLElement;
    if (!button) throw new Error('Send button not found');

    button.click();
  }

  isTyping(): boolean {
    // Check for streaming indicator
    return document.querySelector('.animate-pulse') !== null;
  }

  observeNewMessages(callback: (msg: Message) => void): MutationObserver {
    const container = document.querySelector(this.selectors.messageContainer);
    if (!container) throw new Error('Message container not found');

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (this.isModelMessage(node)) {
            callback({
              role: 'assistant',
              content: (node as HTMLElement).textContent || '',
              timestamp: Date.now(),
            });
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    return observer;
  }

  private isModelMessage(node: Node): boolean {
    return node instanceof HTMLElement &&
           node.matches(this.selectors.modelMessage);
  }
}
```

### 2.3 ChatGPT Adapter

```typescript
class ChatGPTAdapter implements PlatformAdapter {
  name = 'chatgpt';
  hostname = 'chat.openai.com';

  selectors = {
    input: '#prompt-textarea',
    sendButton: 'button[data-testid="send-button"]',
    messageContainer: '[data-testid*="conversation-turn"]',
    userMessage: '[data-message-author-role="user"]',
    modelMessage: '[data-message-author-role="assistant"]',
    typingIndicator: '.result-streaming',
  };

  setInputText(text: string): void {
    const input = document.querySelector(this.selectors.input) as HTMLTextAreaElement;
    if (!input) throw new Error('Input not found');

    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Trigger resize
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  }

  // ... similar implementations
}
```

### 2.4 Defensive Selectors

Platform UIs change frequently. Use fallback strategies:

```typescript
function findInput(): HTMLElement | null {
  const selectors = [
    'div[contenteditable="true"]',  // Claude
    '#prompt-textarea',             // ChatGPT
    '#message-input',               // Generic
    'textarea[placeholder*="Message"]',
    '[role="textbox"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      console.log(`[Rio] Found input via: ${selector}`);
      return el as HTMLElement;
    }
  }

  // Last resort: learn from user
  return learnInputLocation();
}

function learnInputLocation(): HTMLElement | null {
  showOverlay({
    message: "Can't find chat input. Click where you type →",
    onClick: (el: HTMLElement) => {
      const xpath = getXPath(el);
      localStorage.setItem('rio-learned-input', xpath);
    }
  });

  return null;
}
```

---

## 3. WebSocket Protocol

### 3.1 Connection

```typescript
// Background worker connects on session join
class WebSocketManager {
  private ws: WebSocket;

  connect(sessionId: string, userId: string): void {
    const url = `wss://backend.rio.app/api/v1/multiplayer/ws/${sessionId}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.send({
        type: 'auth',
        userId,
        sessionId,
      });
    };

    this.ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);
      this.handleMessage(msg);
    };

    this.ws.onclose = () => {
      console.log('[Rio] WebSocket closed');
      this.reconnect();
    };
  }

  send(msg: WSMessage): void {
    this.ws.send(JSON.stringify(msg));
  }
}
```

### 3.2 Message Types

```typescript
// See integration.md for full WebSocket protocol
type WSMessage =
  | { type: 'question-submit'; question: Question }
  | { type: 'question-vote'; questionId: string; vote: 'up' | 'down'; userId: string }
  | { type: 'question-select'; questionId: string; selectedBy: string }
  | { type: 'question-sent'; questionId: string; chatMessageId: string }
  | { type: 'question-reject'; questionId: string; rejectedBy: string }
  | { type: 'chat-message'; message: ChatMessage }
  | { type: 'team-chat'; message: TeamChatMessage }
  | { type: 'participant-join'; participant: Participant }
  | { type: 'participant-leave'; participantId: string }
  | { type: 'presence-update'; participantId: string; status: string }
  | { type: 'session-end'; endedBy: string };
```

---

## 4. Data Models

### 4.1 Core Entities

```typescript
interface Session {
  id: string;                      // "rio-abc123"
  code: string;                    // "847-293"
  hostId: string;                  // User ID
  platform: 'claude' | 'chatgpt';
  chatUrl: string;                 // Full URL to chat
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'paused' | 'ended';
}

interface Participant {
  id: string;
  name: string;
  color: string;                   // For avatar
  role: 'host' | 'participant';
  joinedAt: number;
  status: 'online' | 'away' | 'offline';
  isMuted: boolean;                // Host can mute
}

interface Question {
  id: string;
  sessionId: string;
  content: string;
  submittedBy: Participant;
  submittedAt: number;
  status: 'pending' | 'selected' | 'sent' | 'rejected';
  votes: {
    upvotes: string[];             // Array of participant IDs
    downvotes: string[];
  };
  editHistory?: {
    original: string;
    edited: string;
    editedBy: string;
    editedAt: number;
  };
}
```

### 4.2 Chat Messages

```typescript
interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sentBy?: Participant;            // For user messages
  linkedQuestion?: string;         // Question ID that generated this
}

interface TeamChatMessage {
  id: string;
  sessionId: string;
  sender: Participant;
  content: string;
  timestamp: number;
  type: 'chat' | 'system';
}
```

---

## 5. State Management

### 5.1 Zustand Store

```typescript
interface RioStore {
  // Session state
  session: Session | null;
  participants: Map<string, Participant>;
  currentUser: Participant | null;

  // Question queue state
  questions: Map<string, Question>;
  selectedQuestion: Question | null;

  // Chat state
  chatMessages: ChatMessage[];
  teamMessages: TeamChatMessage[];

  // UI state
  queueSort: 'votes' | 'time' | 'author';
  showTeamChat: boolean;

  // Actions
  submitQuestion: (content: string) => void;
  voteQuestion: (questionId: string, vote: 'up' | 'down') => void;
  selectQuestion: (questionId: string) => void;
  rejectQuestion: (questionId: string) => void;
  sendSelectedQuestion: () => void;
  editSelectedQuestion: (newContent: string) => void;
  sendTeamMessage: (content: string) => void;
  kickParticipant: (participantId: string) => void;
  endSession: () => void;
}
```

### 5.2 Key Actions

```typescript
const useMultiplayerStore = create<RioStore>((set, get) => ({
  // ... state

  submitQuestion: (content) => {
    const question: Question = {
      id: generateId(),
      sessionId: get().session!.id,
      content,
      submittedBy: get().currentUser!,
      submittedAt: Date.now(),
      status: 'pending',
      votes: { upvotes: [], downvotes: [] },
    };

    // Broadcast to all participants
    chrome.runtime.sendMessage({
      action: 'ws-send',
      message: { type: 'question-submit', question }
    });

    // Add to local state
    set((state) => ({
      questions: new Map(state.questions).set(question.id, question),
    }));
  },

  selectQuestion: (questionId) => {
    const question = get().questions.get(questionId);
    if (!question) return;

    // Only host can select
    if (get().currentUser?.role !== 'host') return;

    // Inject into chat input box
    chrome.tabs.query({ active: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'inject-question',
        content: question.content,
        questionId: question.id,
      });
    });

    // Broadcast selection
    chrome.runtime.sendMessage({
      action: 'ws-send',
      message: {
        type: 'question-select',
        questionId,
        selectedBy: get().currentUser!.id,
      }
    });

    set({ selectedQuestion: question });
  },
}));
```

---

## 6. Communication Flow

### 6.1 Question Submit Flow

```
Participant (UI)
  │
  │ submitQuestion()
  │
  ▼
Background Worker
  │
  │ WebSocket.send({ type: 'question-submit', ... })
  │
  ▼
Backend Server
  │
  │ Broadcasts to all connected clients
  │
  ▼
All Participants
  │
  │ WebSocket.onmessage
  │
  ▼
Background Worker
  │
  │ Update local store
  │
  ▼
Side Panel UI
  │
  │ Re-render queue
```

### 6.2 Host Send Flow

```
Host (UI)
  │
  │ selectQuestion(id)
  │
  ▼
Background Worker
  │
  │ chrome.tabs.sendMessage({ action: 'inject-question' })
  │
  ▼
Content Script
  │
  │ adapter.setInputText(question.content)
  │ showOverlay()
  │
Host clicks [Send Now]
  │
  ▼
Content Script
  │
  │ adapter.clickSend()
  │ observeNewMessages()
  │
Model responds
  │
  ▼
Content Script
  │
  │ chrome.runtime.sendMessage({ action: 'model-response' })
  │
  ▼
Background Worker
  │
  │ WebSocket.send({ type: 'chat-message', ... })
  │
  ▼
All Participants
  │
  │ Update chat view
```

---

**Next:** [UI Design →](ui-design.md) | **Back to:** [Workflows](workflows.md)
