# **Rio Multiplayer Chat - Design Document**

---

## **1. Overview**

### **Vision**
Enable multiple users to collaboratively interact with ChatGPT/Claude through a single shared chat session, with democratic question voting and host moderation.

### **Core Principle**
Rio hijacks the web UI of existing chat applications (ChatGPT, Claude) and enables multiplayer interaction without requiring API access or custom backend infrastructure.

---

## **2. User Roles**

### **Host**
- **Responsibilities:**
  - Owns the ChatGPT/Claude account and browser session
  - Creates multiplayer session and shares join code
  - Reviews question queue and votes
  - Selects which question to send
  - Has final say (can edit before sending)
  - Can kick participants
  - Can end session

- **Requirements:**
  - Must have active ChatGPT or Claude account
  - Must keep browser tab open during session
  - Rio extension installed

### **Participant**
- **Responsibilities:**
  - Joins session via code
  - Submits questions to queue
  - Votes on others' questions
  - Views live chat updates
  - Participates in team chat

- **Requirements:**
  - Rio extension installed
  - Does NOT need ChatGPT/Claude account
  - Can be on any webpage (doesn't need to be on chat platform)

---

## **3. Core Workflow**

### **3.1 Session Creation**

```
┌─────────────────────────────────────────┐
│ Host: Alice                             │
├─────────────────────────────────────────┤
│ 1. Opens claude.ai/chat                 │
│ 2. Starts new chat or opens existing    │
│ 3. Clicks Rio extension                 │
│ 4. Clicks "Start Multiplayer Session"   │
│    ↓                                    │
│    Rio generates session:               │
│    • ID: rio-abc123                     │
│    • Code: 847-293                      │
│    • Link: rio.app/join/847-293         │
│ 5. Alice shares code with team          │
└─────────────────────────────────────────┘
```

### **3.2 Joining Session**

```
┌─────────────────────────────────────────┐
│ Participant: Bob                        │
├─────────────────────────────────────────┤
│ 1. Opens Rio extension (any page)       │
│ 2. Clicks "Join Session"                │
│ 3. Enters code: 847-293                 │
│ 4. Enters display name: "Bob"           │
│    ↓                                    │
│    Connected! ✓                         │
│ 5. Sees live chat history               │
│ 6. Can submit questions                 │
└─────────────────────────────────────────┘
```

### **3.3 Question Submission & Voting Flow**

```
┌──────────────────────────────────────────────────────┐
│ Step 1: Participant Submits Question                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Bob types: "What are transformers?"                  │
│ Clicks: [Submit to Queue]                           │
│                                                      │
│ ↓ Rio broadcasts to all participants                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Step 2: Everyone Sees Queue & Can Vote              │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Question Queue (3):                                  │
│                                                      │
│ 1. "What are transformers?"                          │
│    👤 Bob  |  👍 3  👎 0  |  [Upvote] [Downvote]    │
│                                                      │
│ 2. "Explain attention mechanism"                     │
│    👤 Charlie  |  👍 2  👎 0  |  [Upvote] [Downvote]│
│                                                      │
│ 3. "Compare to RNNs"                                 │
│    👤 Dave  |  👍 1  👎 1  |  [Upvote] [Downvote]   │
│                                                      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Step 3: Host Reviews & Selects                      │
├──────────────────────────────────────────────────────┤
│ Alice (Host) sees same queue, sorted by votes        │
│                                                      │
│ Alice clicks [Select] on Bob's question             │
│                                                      │
│ ↓ Rio auto-fills the chat input box                 │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Step 4: Host Review & Send                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Claude Input Box:                                    │
│ ┌────────────────────────────────────────────────┐  │
│ │ What are transformers?                         │  │ ← Auto-filled by Rio
│ │                                          [📤] │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ Rio Overlay:                                         │
│ ┌────────────────────────────────────────────────┐  │
│ │ 📋 From: Bob  |  Votes: 👍 3                  │  │
│ │ [Edit Question] [Send Now] [Skip]             │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ Alice can:                                           │
│ • Click [Send Now] - Rio auto-clicks send button    │
│ • Edit text first, then click [Send Now]            │
│ • Manually press Enter (Rio detects & syncs)        │
│ • Click [Skip] - moves to next question in queue    │
│                                                      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Step 5: Model Responds                              │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Claude generates response...                         │
│                                                      │
│ Rio detects new message in DOM                       │
│ ↓ Broadcasts to all participants                    │
│                                                      │
│ Everyone sees:                                       │
│ [User] What are transformers? ← From Bob            │
│ [Claude] Transformers are neural networks...        │
│                                                      │
│ Question removed from queue                          │
└──────────────────────────────────────────────────────┘
```

---

## **4. UI Specifications**

### **4.1 Host UI (Rio Side Panel)**

```
┌─────────────────────────────────────────────────────┐
│ Rio Multiplayer Chat                                │
│ 🟢 Hosting Session: 847-293                        │
│ Platform: Claude (claude.ai/chat/abc123)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 👥 Participants (3)                                 │
│ ┌─────────────────────────────────────────────────┐│
│ │ 🟢 Bob         [Mute] [Kick]                    ││
│ │ 🟢 Charlie     [Mute] [Kick]                    ││
│ │ 🟢 Dave        [Mute] [Kick]                    ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ 📬 Question Queue (3) [Sort: Votes ▼]              │
│ ┌─────────────────────────────────────────────────┐│
│ │ 👤 Bob  👍 3  👎 0                              ││
│ │ "What are transformers?"                        ││
│ │ [👍] [👎] [✓ Select] [✕ Reject]                ││
│ ├─────────────────────────────────────────────────┤│
│ │ 👤 Charlie  👍 2  👎 0                          ││
│ │ "Explain attention mechanism in detail"         ││
│ │ [👍] [👎] [✓ Select] [✕ Reject]                ││
│ ├─────────────────────────────────────────────────┤│
│ │ 👤 Dave  👍 1  👎 1                             ││
│ │ "Compare to RNNs"                               ││
│ │ [👍] [👎] [✓ Select] [✕ Reject]                ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ 💬 Team Chat                                        │
│ ┌─────────────────────────────────────────────────┐│
│ │ [Bob] Great question Charlie!                   ││
│ │ [Charlie] Thanks! I think this is key           ││
│ │ [You] Agreed, selecting that one next           ││
│ └─────────────────────────────────────────────────┘│
│ [Type team message...]                              │
│                                                     │
│ ⚙️ Controls                                         │
│ [📋 Copy Join Code] [⏸️ Pause] [🚪 End Session]    │
└─────────────────────────────────────────────────────┘
```

### **4.2 Participant UI (Rio Side Panel)**

```
┌─────────────────────────────────────────────────────┐
│ Rio Multiplayer Chat                                │
│ Connected to Alice's session ✓                      │
│ Session: 847-293  |  Platform: Claude               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 💬 Live Chat                                        │
│ ┌─────────────────────────────────────────────────┐│
│ │ [User] What are transformers? ← From Bob        ││
│ │                                                 ││
│ │ [Claude] Transformers are neural networks that  ││
│ │ use self-attention mechanisms to process...     ││
│ │                                                 ││
│ │ [User] How does attention work? ← From Charlie  ││
│ │                                                 ││
│ │ [Claude] Attention mechanisms allow the model...││
│ │ [Typing...]                                     ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ 📬 Question Queue (2)                               │
│ ┌─────────────────────────────────────────────────┐│
│ │ 👤 You  👍 3  👎 0  ⏳ Pending                  ││
│ │ "What are transformers?"                        ││
│ │ [Edit] [Withdraw]                               ││
│ ├─────────────────────────────────────────────────┤│
│ │ 👤 Charlie  👍 2  👎 0                          ││
│ │ "Explain attention mechanism"                   ││
│ │ [👍 Upvote] [👎 Downvote]                       ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ✍️ Submit Question                                  │
│ ┌─────────────────────────────────────────────────┐│
│ │ Type your question...                           ││
│ │                                                 ││
│ └─────────────────────────────────────────────────┘│
│ [Submit to Queue]                                   │
│                                                     │
│ 💬 Team Chat                                        │
│ ┌─────────────────────────────────────────────────┐│
│ │ [Alice] Great questions everyone!               ││
│ │ [Charlie] Should we ask about BERT next?        ││
│ └─────────────────────────────────────────────────┘│
│ [Type team message...]                              │
│                                                     │
│ [Leave Session]                                     │
└─────────────────────────────────────────────────────┘
```

### **4.3 Host's Browser Overlay (When Question Selected)**

```
┌─────────────────────────────────────────────────────┐
│ claude.ai/chat                                      │
│                                                     │
│ [Previous chat messages...]                         │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ What are transformers?                    [📤] ││ ← Input box (auto-filled)
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ 🎮 Rio: Question from Bob (👍 3 votes)          ││ ← Floating overlay
│ │                                                 ││
│ │ [✏️ Edit] [📤 Send Now] [⏭️ Skip] [✕ Close]   ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

---

## **5. Technical Architecture**

### **5.1 Components**

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
               │ WebSocket
               │
    ┌──────────▼──────────┐
    │ Signaling Server    │ (Minimal server for WebRTC/WebSocket)
    │ • Session registry  │
    │ • Message relay     │
    │ • Presence tracking │
    └─────────────────────┘
```

### **5.2 Platform Adapters**

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
  observeNewMessages(callback: (message: Message) => void): MutationObserver;
  observeInputChange(callback: (text: string) => void): MutationObserver;
}

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
    const input = document.querySelector(this.selectors.input);
    if (!input) throw new Error('Input not found');

    input.textContent = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  clickSend(): void {
    const button = document.querySelector(this.selectors.sendButton);
    if (!button) throw new Error('Send button not found');

    button.click();
  }

  getLastMessage(): string | null {
    const messages = document.querySelectorAll(this.selectors.modelMessage);
    const last = messages[messages.length - 1];
    return last?.textContent || null;
  }

  isTyping(): boolean {
    // Check for streaming indicator
    return document.querySelector('.animate-pulse') !== null;
  }

  observeNewMessages(callback: (message: Message) => void): MutationObserver {
    const container = document.querySelector(this.selectors.messageContainer);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (this.isModelMessage(node)) {
            callback({
              role: 'assistant',
              content: node.textContent,
              timestamp: Date.now(),
            });
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    return observer;
  }

  observeInputChange(callback: (text: string) => void): MutationObserver {
    const input = document.querySelector(this.selectors.input);

    const observer = new MutationObserver(() => {
      callback(input.textContent || '');
    });

    observer.observe(input, {
      characterData: true,
      subtree: true,
      childList: true,
    });

    return observer;
  }

  private isModelMessage(node: Node): boolean {
    return node instanceof Element &&
           node.matches(this.selectors.modelMessage);
  }
}

class ChatGPTAdapter implements PlatformAdapter {
  // Similar implementation for ChatGPT
  // ...
}
```

### **5.3 Message Types**

```typescript
// Core data structures

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

// WebSocket message protocol

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

### **5.4 State Management**

```typescript
// Zustand store for React UI

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

const useRioStore = create<RioStore>((set, get) => ({
  session: null,
  participants: new Map(),
  currentUser: null,
  questions: new Map(),
  selectedQuestion: null,
  chatMessages: [],
  teamMessages: [],
  queueSort: 'votes',
  showTeamChat: true,

  submitQuestion: (content) => {
    const question: Question = {
      id: generateId(),
      sessionId: get().session.id,
      content,
      submittedBy: get().currentUser,
      submittedAt: Date.now(),
      status: 'pending',
      votes: { upvotes: [], downvotes: [] },
    };

    // Broadcast to all participants
    broadcastMessage({
      type: 'question-submit',
      question,
    });

    // Add to local state
    set((state) => ({
      questions: new Map(state.questions).set(question.id, question),
    }));
  },

  voteQuestion: (questionId, vote) => {
    const userId = get().currentUser.id;

    broadcastMessage({
      type: 'question-vote',
      questionId,
      vote,
      userId,
    });

    set((state) => {
      const questions = new Map(state.questions);
      const question = questions.get(questionId);

      if (vote === 'up') {
        question.votes.upvotes.push(userId);
        question.votes.downvotes = question.votes.downvotes.filter(id => id !== userId);
      } else {
        question.votes.downvotes.push(userId);
        question.votes.upvotes = question.votes.upvotes.filter(id => id !== userId);
      }

      questions.set(questionId, question);
      return { questions };
    });
  },

  selectQuestion: (questionId) => {
    const question = get().questions.get(questionId);

    // Only host can select
    if (get().currentUser.role !== 'host') return;

    // Inject into chat input box
    chrome.tabs.query({ active: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'inject-question',
        content: question.content,
      });
    });

    broadcastMessage({
      type: 'question-select',
      questionId,
      selectedBy: get().currentUser.id,
    });

    set({ selectedQuestion: question });
  },

  sendSelectedQuestion: () => {
    const question = get().selectedQuestion;

    // Tell content script to click send button
    chrome.tabs.query({ active: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'click-send',
      });
    });

    broadcastMessage({
      type: 'question-sent',
      questionId: question.id,
      chatMessageId: generateId(),
    });

    // Remove from queue
    set((state) => {
      const questions = new Map(state.questions);
      questions.delete(question.id);
      return { questions, selectedQuestion: null };
    });
  },

  // ... other actions
}));
```

---

## **6. Key Interactions**

### **6.1 Question Lifecycle**

```typescript
// State machine for questions

type QuestionStatus =
  | 'pending'    // In queue, can be voted on
  | 'selected'   // Host selected, injected into input
  | 'sent'       // Sent to model, waiting for response
  | 'rejected';  // Host rejected, removed from queue

const questionLifecycle = {
  pending: ['selected', 'rejected'],
  selected: ['sent', 'pending'], // Can deselect back to pending
  sent: [],                      // Terminal state
  rejected: [],                  // Terminal state
};
```

### **6.2 Host Selection Flow**

```typescript
// Content script receives selection command

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'inject-question') {
    const adapter = getCurrentPlatformAdapter();

    // Inject into input box
    adapter.setInputText(message.content);

    // Show overlay
    showRioOverlay({
      questionId: message.questionId,
      submittedBy: message.submittedBy,
      votes: message.votes,
    });

    sendResponse({ success: true });
  }

  if (message.action === 'click-send') {
    const adapter = getCurrentPlatformAdapter();

    // Click send button
    adapter.clickSend();

    // Start observing for response
    observeModelResponse();

    sendResponse({ success: true });
  }
});

function showRioOverlay(data) {
  // Create floating overlay above input box
  const overlay = document.createElement('div');
  overlay.className = 'rio-question-overlay';
  overlay.innerHTML = `
    <div class="rio-overlay-content">
      <div class="rio-info">
        🎮 Rio: Question from ${data.submittedBy}
        (👍 ${data.votes.upvotes.length} votes)
      </div>
      <div class="rio-actions">
        <button id="rio-edit">✏️ Edit</button>
        <button id="rio-send">📤 Send Now</button>
        <button id="rio-skip">⏭️ Skip</button>
        <button id="rio-close">✕ Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event handlers
  document.getElementById('rio-send').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'host-send-now' });
  });

  document.getElementById('rio-skip').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'host-skip' });
    overlay.remove();
  });

  // ... other handlers
}
```

### **6.3 Manual Send Detection**

```typescript
// Detect when host manually presses Enter

const adapter = getCurrentPlatformAdapter();

// Watch for manual sends
adapter.observeNewMessages((message) => {
  if (message.role === 'user') {
    // Check if this matches selected question
    const selectedQuestion = getSelectedQuestion();

    if (selectedQuestion && message.content === selectedQuestion.content) {
      // Host sent it manually!
      chrome.runtime.sendMessage({
        action: 'question-sent-manually',
        questionId: selectedQuestion.id,
      });
    }
  }
});

// Alternative: Listen for Enter key
const input = document.querySelector(adapter.selectors.input);

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const text = input.textContent.trim();
    const selectedQuestion = getSelectedQuestion();

    if (selectedQuestion && text === selectedQuestion.content) {
      // Manual send detected
      chrome.runtime.sendMessage({
        action: 'question-sent-manually',
        questionId: selectedQuestion.id,
      });
    }
  }
});
```

---

## **7. Voting System**

### **7.1 Voting Rules**

```typescript
interface VotingConfig {
  allowSelfVote: boolean;           // Can author vote on own question?
  allowVoteChange: boolean;         // Can change vote from up to down?
  voteWeight: {
    host: number;                   // Host vote weight (e.g., 2x)
    participant: number;            // Regular participant weight
  };
  autoSelectThreshold?: number;     // Auto-select if votes > threshold
}

const defaultVotingConfig: VotingConfig = {
  allowSelfVote: false,
  allowVoteChange: true,
  voteWeight: {
    host: 2,                        // Host votes count double
    participant: 1,
  },
  autoSelectThreshold: undefined,   // Disabled by default
};
```

### **7.2 Queue Sorting**

```typescript
function sortQuestions(
  questions: Question[],
  sortBy: 'votes' | 'time' | 'author'
): Question[] {
  switch (sortBy) {
    case 'votes':
      return questions.sort((a, b) => {
        const scoreA = calculateVoteScore(a);
        const scoreB = calculateVoteScore(b);

        if (scoreA === scoreB) {
          // Tie-breaker: earlier submission first
          return a.submittedAt - b.submittedAt;
        }

        return scoreB - scoreA; // Higher score first
      });

    case 'time':
      return questions.sort((a, b) =>
        a.submittedAt - b.submittedAt
      );

    case 'author':
      return questions.sort((a, b) =>
        a.submittedBy.name.localeCompare(b.submittedBy.name)
      );
  }
}

function calculateVoteScore(question: Question): number {
  const config = getVotingConfig();

  let score = 0;

  for (const userId of question.votes.upvotes) {
    const participant = getParticipant(userId);
    score += participant.role === 'host'
      ? config.voteWeight.host
      : config.voteWeight.participant;
  }

  for (const userId of question.votes.downvotes) {
    const participant = getParticipant(userId);
    score -= participant.role === 'host'
      ? config.voteWeight.host
      : config.voteWeight.participant;
  }

  return score;
}
```

---

## **8. Edge Cases & Solutions**

### **8.1 Host Edits Question Before Sending**

```
Scenario:
1. Bob submits: "What are transformers?"
2. Alice selects it (injected into input)
3. Alice edits to: "What are transformers in NLP?"
4. Alice sends

Solution:
• Rio detects input change
• Shows warning: "⚠️ You edited Bob's question"
• Options:
  [Send as edited] - Credits both Bob & Alice
  [Send original] - Credits only Bob
  [Cancel] - Back to queue

Storage:
{
  originalContent: "What are transformers?",
  sentContent: "What are transformers in NLP?",
  submittedBy: "Bob",
  editedBy: "Alice",
}
```

### **8.2 Multiple Questions Selected Accidentally**

```
Scenario:
Alice clicks [Select] on two questions rapidly

Solution:
• Only allow one selected question at a time
• If new question selected while one is already selected:
  - Previous question returns to queue
  - New question becomes selected

UI Feedback:
"Deselected: 'What are transformers?' by Bob
 Selected: 'Explain attention' by Charlie"
```

### **8.3 Model Response Takes Long Time**

```
Scenario:
Claude is generating a very long response (streaming)

Solution:
• Lock question queue during response
• Show indicator: "⏳ Waiting for Claude to finish..."
• Participants can still:
  - Submit new questions
  - Vote on existing questions
  - Chat in team chat
• But host cannot select next question until response complete

Detection:
const adapter = getCurrentPlatformAdapter();
if (adapter.isTyping()) {
  // Model is still generating
  disableQuestionSelection();
}
```

### **8.4 Participant Submits Spam**

```
Scenario:
Bob submits 10 questions in 1 minute

Solutions:

Option A: Rate Limiting
• Max 5 questions per 5 minutes per user
• Show warning: "⚠️ Slow down! You can submit 3 more questions in 4 minutes"

Option B: Queue Limit
• Max 3 pending questions per user
• "You have 3 questions in queue. Wait for one to be answered."

Option C: Host Controls
• Host can:
  - Mute user (can't submit questions)
  - Delete questions from queue
  - Kick user from session
```

### **8.5 Host Disconnects Mid-Session**

```
Scenario:
Alice (host) closes browser/loses internet

Solution:

Immediate:
• Broadcast to all: "⚠️ Host disconnected"
• Session status → 'paused'
• Question queue frozen
• Team chat still works

After 2 minutes:
• Offer migration options:
  [Wait for host] - Session paused
  [Transfer host to: Bob ▼] - Vote required
  [End session] - Save transcript

Host reconnects:
• Auto-resume session
• "✓ Host reconnected. Session resumed."
• Sync any questions submitted during downtime
```

### **8.6 Platform UI Changes**

```
Scenario:
Claude updates their UI, selectors break

Solution:

Defensive selectors:
function findInput(): HTMLElement | null {
  const selectors = [
    'div[contenteditable="true"]',
    '#message-input',
    'textarea[placeholder*="Message"]',
    '[role="textbox"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }

  // Fallback: learn from user
  return learnInputLocation();
}

learnInputLocation():
• Show overlay: "Can't find chat input. Click where you type →"
• User clicks input box
• Rio saves location: localStorage.set('learned-input', xpath)
• Next time, try learned location first
```

---

## **9. Security & Privacy**

### **9.1 Session Access Control**

```typescript
interface SessionSecurity {
  accessMode: 'open' | 'approval' | 'invite-only';
  maxParticipants?: number;
  requirePassword?: boolean;
  allowedDomains?: string[];  // e.g., '@company.com'
}

// Approval mode
function handleJoinRequest(participant: Participant) {
  if (session.security.accessMode === 'approval') {
    // Notify host
    showHostNotification({
      title: 'Join Request',
      message: `${participant.name} wants to join`,
      actions: [
        { label: 'Accept', action: () => approveJoin(participant) },
        { label: 'Reject', action: () => rejectJoin(participant) },
      ],
    });
  }
}
```

### **9.2 Data Privacy**

```
What's stored where:

Local (Extension Storage):
• Session history (optional, can disable)
• User preferences
• Learned DOM selectors

Server (Signaling Only):
• Active session registry (ID, code, participant count)
• Real-time message relay (not persisted)
• Expires after 24h

Never Stored:
• ChatGPT/Claude account credentials
• API keys
• Full chat transcripts (unless user exports)
```

### **9.3 Message Encryption**

```typescript
// Optional E2E encryption for paranoid users

class EncryptedSession {
  private key: CryptoKey;

  async init() {
    // Generate shared key on session creation
    this.key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Share key with participants via QR code or link
    const exportedKey = await crypto.subtle.exportKey('raw', this.key);
    return btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  }

  async encryptMessage(message: WSMessage): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(message));

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    );

    return JSON.stringify({
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    });
  }

  // decrypt() similar
}
```

---

## **10. Success Metrics**

### **10.1 Engagement Metrics**
- Session duration (avg, median)
- Questions submitted per session
- Questions sent to model per session
- Voting participation rate
- Team chat activity

### **10.2 Quality Metrics**
- Vote agreement rate (do people vote similarly?)
- Question rejection rate (host rejects %)
- Edit rate (host edits before sending %)
- Return usage (same team uses again)

### **10.3 Technical Metrics**
- WebSocket latency (RTT)
- Message sync delay
- Platform adapter success rate (% times selectors work)
- Session uptime (% time host connected)

---

## **11. Future Enhancements**

### **11.1 Phase 2 Features**

**Saved Templates**
```
Bob saves frequently asked question templates:
• "Explain [CONCEPT] like I'm 5"
• "Compare [A] vs [B]"
• "What are the pros and cons of [TOPIC]?"

Quick submit from templates
```

**Question Threads**
```
Allow follow-up questions linked to previous ones:

Question 1: "What are transformers?" ← Sent
  ↳ Follow-up: "How do they compare to RNNs?" ← In queue
  ↳ Follow-up: "What about memory usage?" ← In queue

When parent answered, children auto-highlighted
```

**Smart Queue**
```
AI suggests:
• Merge similar questions
• Reorder for logical flow
• Flag off-topic questions
• Suggest clarifications
```

### **11.2 DAG Integration**

```
While chatting, Rio:
• Extracts concepts mentioned
• Builds DAG in background
• Links questions to concept nodes
• At end: "Export conversation as concept map"

Multiplayer DAG:
• Each participant can arrange nodes
• Vote on relationships
• Collaborative knowledge building
```

---

## **12. Open Questions**

1. **Vote threshold for auto-send?**
   - Should host be able to enable "Auto-send at 5 upvotes"?
   - Pros: Faster, democratic
   - Cons: Host loses control

2. **Anonymous questions?**
   - Allow participants to submit anonymously?
   - Use case: Avoid social pressure, ask "dumb" questions
   - Con: Less accountability

3. **Question expiry?**
   - Auto-remove questions older than X minutes?
   - Or keep them indefinitely until resolved?

4. **Concurrent platforms?**
   - Can host have Claude AND ChatGPT tabs open?
   - Vote on which platform to use per question?
   - "Send this one to Claude, that one to GPT"

5. **Export format?**
   - Just transcript? Or include votes, timestamps, metadata?
   - JSON for analysis? Markdown for sharing?

---

## **13. Implementation Roadmap**

### **Week 1: Core Infrastructure**
- ✅ Platform adapters (Claude, ChatGPT)
- ✅ Session creation/join
- ✅ WebSocket messaging
- ✅ Basic question queue

### **Week 2: Voting & Selection**
- ✅ Vote up/down
- ✅ Queue sorting
- ✅ Host select question
- ✅ Inject into input box

### **Week 3: Send Control**
- ✅ Rio overlay UI
- ✅ Send button integration
- ✅ Manual send detection
- ✅ Response observation

### **Week 4: Polish & Edge Cases**
- ✅ Team chat
- ✅ Participant management (kick, mute)
- ✅ Session persistence
- ✅ Error handling

### **Week 5: Testing & Launch**
- ✅ Cross-platform testing
- ✅ Load testing (10+ participants)
- ✅ Bug fixes
- ✅ Documentation

---

## **End of Design Document**

**Version**: 1.0
**Date**: 2024-11-13
**Status**: Draft for Review

---

**Next Steps:**
1. Review this design doc with team
2. Prototype platform adapters
3. Build minimal UI mockups
4. Test WebSocket performance
5. Begin Week 1 implementation
