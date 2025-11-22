# Multiplayer Integration with Backend & Extension

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

The Rio Multiplayer feature is built on top of the existing Rio extension and backend infrastructure. This document explains how multiplayer integrates with both components and the data flow between them.

**Key Principle:** Multiplayer is a **thin layer** on top of Rio's existing architecture. It reuses components wherever possible and adds minimal new infrastructure.

---

## Architecture Integration

### Three-Tier Integration

```
┌────────────────────────────────────────────────────────────┐
│  Rio Extension (Client-Side)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │   Content    │  │  Background  │  │   Side Panel     │ │
│  │   Script     │  │   Worker     │  │   (React)        │ │
│  │              │  │              │  │                  │ │
│  │ • DOM        │  │ • WebSocket  │  │ • Multiplayer UI │ │
│  │   monitoring │  │   client     │  │ • Question queue │ │
│  │ • Platform   │  │ • Message    │  │ • Voting UI      │ │
│  │   detection  │  │   routing    │  │ • Team chat      │ │
│  │ • Inject     │  │ • State sync │  │                  │ │
│  │   controls   │  │              │  │                  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘ │
│         │                  │                  │             │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │    Chrome        │      Chrome      │
          │    Runtime       │      Runtime     │
          │    Messages      │      Messages    │
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                             │ WebSocket (wss://)
                             │
          ┌──────────────────▼──────────────────┐
          │  Rio Backend Server                 │
          │  ┌───────────────────────────────┐  │
          │  │  Multiplayer Service          │  │
          │  │  - WebSocket relay            │  │
          │  │  - Session management         │  │
          │  │  - Minimal state              │  │
          │  └──────────┬────────────────────┘  │
          │             │                        │
          │  ┌──────────▼────────────────────┐  │
          │  │  Redis Pub/Sub                │  │
          │  │  - Session routing            │  │
          │  │  - Horizontal scaling         │  │
          │  └───────────────────────────────┘  │
          └─────────────────────────────────────┘
```

---

## Extension Integration

### Content Script Extensions

The multiplayer feature **extends** the existing content script with minimal changes:

**Existing Functionality (Reused):**
- ✅ Platform detection (`ChatGPTScraper`, `ClaudeScraper`)
- ✅ DOM monitoring (MutationObserver for new messages)
- ✅ Text extraction (scraping conversation)
- ✅ Input field detection

**New Functionality (Added):**
- ✨ **Question injection:** Auto-fill input field when host selects a question
- ✨ **Send button control:** Programmatically click send button (optional)
- ✨ **Overlay rendering:** Show "From: User X | Votes: N" overlay near input
- ✨ **Manual send detection:** Detect when host presses Enter (not via Rio button)

**Implementation:**
```typescript
// src/content/multiplayer/injector.ts
export class QuestionInjector {
  constructor(private platform: PlatformAdapter) {}

  async injectQuestion(question: Question): Promise<void> {
    const inputField = this.platform.getInputField();

    // Fill input
    inputField.value = question.text;
    inputField.dispatchEvent(new Event('input', { bubbles: true }));

    // Show overlay
    this.showOverlay({
      from: question.author,
      votes: question.upvotes - question.downvotes,
      actions: ['Send Now', 'Edit', 'Skip']
    });
  }

  detectManualSend(): void {
    const inputField = this.platform.getInputField();

    // Listen for Enter key
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Notify Background that host sent manually
        chrome.runtime.sendMessage({
          action: 'manual_send',
          questionText: inputField.value
        });
      }
    });
  }
}
```

**Integration Points:**
- **Platform Adapters:** Multiplayer reuses `ChatGPTAdapter` and `ClaudeAdapter` for DOM queries
- **Input Field Detection:** Existing `getInputField()` method works without changes
- **Send Button:** Existing `getSendButton()` method used for auto-click

---

### Background Worker Extensions

The Background Service Worker gets **WebSocket client** functionality:

**Existing Functionality (Reused):**
- ✅ Message routing between content script and side panel
- ✅ API call orchestration (Gemini)
- ✅ Storage management (`chrome.storage`)
- ✅ Tab coordination

**New Functionality (Added):**
- ✨ **WebSocket client:** Persistent connection to backend server
- ✨ **Session state:** Track current session ID, role (host/participant), participants
- ✨ **Message relaying:** Forward messages between WebSocket and extension components
- ✨ **Reconnection logic:** Auto-reconnect on disconnect with exponential backoff

**Implementation:**
```typescript
// src/background/multiplayer/ws-client.ts
export class MultiplayerWSClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;

  async connect(serverUrl: string, sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.ws = new WebSocket(`${serverUrl}/ws/${sessionId}`);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleServerMessage(message);
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };
  }

  private handleServerMessage(message: any): void {
    switch (message.type) {
      case 'question_submitted':
        // Notify Side Panel
        chrome.runtime.sendMessage({
          action: 'multiplayer:question_submitted',
          data: message.payload
        });
        break;

      case 'vote_updated':
        // Update vote counts in UI
        chrome.runtime.sendMessage({
          action: 'multiplayer:vote_updated',
          data: message.payload
        });
        break;

      case 'response_streamed':
        // Notify all participants of new AI response
        chrome.runtime.sendMessage({
          action: 'multiplayer:response_streamed',
          data: message.payload
        });
        break;
    }
  }

  send(type: string, payload: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }
}
```

**Integration Points:**
- **Existing Message Router:** Multiplayer messages flow through same `chrome.runtime.onMessage` handler
- **Storage:** Session state stored in `chrome.storage.session` (ephemeral)
- **Tab Management:** Track which tab is hosting the session

---

### Side Panel Extensions

The Side Panel gets a **new tab** for multiplayer:

**Existing Tabs (Reused):**
- Graph View
- Annotations
- Chat (CopilotKit)

**New Tab (Added):**
- ✨ **Multiplayer:** Question queue, voting UI, team chat, participant list

**UI Structure:**
```typescript
// src/sidepanel/components/MultiplayerTab.tsx
export function MultiplayerTab() {
  const { session, isHost } = useMultiplayerSession();

  if (!session) {
    return <JoinOrCreateSession />;
  }

  return (
    <div className="multiplayer-tab">
      {isHost && <HostControls />}
      <ParticipantList participants={session.participants} />
      <QuestionQueue questions={session.queue} onVote={handleVote} />
      <TeamChat messages={session.teamChat} onSend={handleSendMessage} />
    </div>
  );
}
```

**Integration Points:**
- **CopilotKit:** Multiplayer actions exposed as Copilot tools
  - "Start multiplayer session"
  - "Submit question to queue"
  - "Vote on question"
- **React Flow:** (Future) DAG collaboration mode where concepts are collaboratively built

---

## Backend Server Integration

### WebSocket Relay Service

The Rio Backend server (see [Backend Server Design](../10-backend-server.md)) gets a **new service** for multiplayer:

**New Components:**

1. **WebSocket Endpoint** (`/ws/{session_id}`)
2. **Session Manager** (in-memory or Redis)
3. **Message Relay** (pub/sub pattern)

**Implementation:**
```python
# backend/api/multiplayer.py
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set

class MultiplayerService:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.active_sessions: Dict[str, Set[WebSocket]] = {}

    async def handle_connection(self, websocket: WebSocket, session_id: str):
        await websocket.accept()

        # Add to session
        if session_id not in self.active_sessions:
            self.active_sessions[session_id] = set()
        self.active_sessions[session_id].add(websocket)

        try:
            while True:
                message = await websocket.receive_json()
                await self.relay_message(session_id, message, websocket)
        except WebSocketDisconnect:
            self.active_sessions[session_id].remove(websocket)

    async def relay_message(
        self,
        session_id: str,
        message: dict,
        sender: WebSocket
    ):
        # Broadcast to all participants in session (except sender)
        for ws in self.active_sessions.get(session_id, set()):
            if ws != sender:
                await ws.send_json(message)

        # Also publish to Redis for horizontal scaling
        await self.redis.publish(
            f"multiplayer:session:{session_id}",
            json.dumps(message)
        )

# FastAPI route
@app.websocket("/api/v1/multiplayer/ws/{session_id}")
async def multiplayer_websocket(websocket: WebSocket, session_id: str):
    await multiplayer_service.handle_connection(websocket, session_id)
```

**Why Minimal?**
- ❌ No persistent storage (sessions expire after 24 hours)
- ❌ No message history (participants see only real-time updates)
- ❌ No authentication (session ID is the auth token)
- ✅ Just a relay (messages go in, messages go out)

---

### Session Management API

**Endpoints:**

```http
POST /api/v1/multiplayer/sessions
{
  "host_id": "user-123",
  "platform": "chatgpt",
  "chat_url": "https://chat.openai.com/c/abc123"
}

Response 201:
{
  "session_id": "rio-abc123",
  "join_code": "847-293",
  "ws_url": "wss://api.rio.com/ws/rio-abc123",
  "expires_at": "2025-11-23T10:00:00Z"
}
```

```http
POST /api/v1/multiplayer/sessions/{code}/join
{
  "display_name": "Bob",
  "participant_id": "user-456"  // Optional
}

Response 200:
{
  "session_id": "rio-abc123",
  "ws_url": "wss://api.rio.com/ws/rio-abc123",
  "role": "participant",
  "host_name": "Alice"
}
```

```http
DELETE /api/v1/multiplayer/sessions/{session_id}
Authorization: Bearer {host_token}

Response 204: (Session ended)
```

**Storage Schema (Redis):**
```
Session data (TTL: 24 hours):
  session:{session_id} → {
    "host_id": "user-123",
    "created_at": "2025-11-22T10:00:00Z",
    "platform": "chatgpt",
    "chat_url": "...",
    "participants": [
      {"id": "user-456", "name": "Bob", "joined_at": "..."}
    ]
  }

Join code mapping (TTL: 24 hours):
  join_code:{code} → session_id
```

---

## Message Flow Examples

### Example 1: Participant Submits Question

```
┌─────────────────────────────────────────────────────────┐
│ 1. Participant (Bob) in Side Panel                     │
│    Types: "What are transformers?"                      │
│    Clicks: [Submit to Queue]                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Side Panel → Background Worker                      │
│    chrome.runtime.sendMessage({                        │
│      action: 'multiplayer:submit_question',            │
│      text: 'What are transformers?'                    │
│    })                                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Background Worker → Backend (WebSocket)             │
│    ws.send({                                           │
│      type: 'question_submitted',                       │
│      payload: {                                        │
│        author: 'Bob',                                  │
│        text: 'What are transformers?',                 │
│        timestamp: 1732276800                           │
│      }                                                 │
│    })                                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Backend → All Participants (Broadcast)              │
│    for each ws in session:                             │
│      ws.send({...})                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Background Worker → Side Panel (All Users)          │
│    chrome.runtime.sendMessage({                        │
│      action: 'multiplayer:question_added',             │
│      question: {...}                                   │
│    })                                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Side Panel Updates UI                              │
│    • Adds question to queue                            │
│    • Sorts by votes                                    │
│    • Shows notification                                │
└─────────────────────────────────────────────────────────┘
```

### Example 2: Host Selects and Sends Question

```
┌─────────────────────────────────────────────────────────┐
│ 1. Host (Alice) clicks [Select] on top question        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Side Panel → Background Worker                      │
│    {action: 'multiplayer:select_question', id: 'q-1'}  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Background Worker → Content Script                  │
│    {action: 'inject_question', text: '...', meta: ...} │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Content Script                                      │
│    • Fills ChatGPT input field                         │
│    • Shows overlay: "From: Bob | Votes: 3"             │
│    • Waits for host to send                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (Host presses Enter or clicks [Send Now])
┌─────────────────────────────────────────────────────────┐
│ 5. Content Script detects send                         │
│    → Background Worker                                 │
│    {action: 'question_sent', id: 'q-1'}                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Background Worker → Backend (WebSocket)             │
│    {type: 'question_sent', id: 'q-1'}                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (Backend broadcasts)
┌─────────────────────────────────────────────────────────┐
│ 7. All participants receive update                     │
│    • Question removed from queue                       │
│    • Marked as "sent" in history                       │
└─────────────────────────────────────────────────────────┘
```

---

## Scalability Considerations

### Horizontal Scaling with Redis Pub/Sub

For hosted deployments (multiple backend servers):

```python
# Redis pub/sub for cross-server message relay
async def subscribe_to_session(session_id: str):
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"multiplayer:session:{session_id}")

    async for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'])
            # Relay to local WebSocket connections
            await broadcast_to_local_clients(session_id, data)
```

**Benefits:**
- Multiple backend servers can handle same session
- Load balancing across servers
- Redundancy (if one server fails, others continue)

---

## State Management

### Extension State (chrome.storage.session)

```typescript
interface MultiplayerState {
  sessionId: string | null;
  role: 'host' | 'participant' | null;
  wsUrl: string | null;
  participants: Array<{
    id: string;
    name: string;
    isHost: boolean;
  }>;
  questionQueue: Question[];
  teamChat: Message[];
}

// Store in session storage (clears on extension reload)
await chrome.storage.session.set({ multiplayer: state });
```

### Backend State (Redis, 24h TTL)

```
Session: {session_id, host_id, created_at, platform, participants[]}
Join Code: {code} → {session_id}
Active Connections: Set<{user_id, ws_connection}>
```

**No Persistent Storage:**
- Sessions expire after 24 hours
- No message history stored
- Participants must be actively connected to see updates

---

## Future Enhancements

### Phase 2: DAG Collaboration

Multiplayer could enable collaborative concept graph building:
- **Shared DAG:** All participants see same concept graph
- **Simultaneous editing:** Multiple users add nodes/edges
- **Conflict resolution:** Operational transform for concurrent edits
- **Chat integration:** Discuss concepts via team chat

**See:** [Backend Server Design](../10-backend-server.md#4-advanced-graph-analysis)

### Phase 3: Persistent Sessions

Optional backend feature for saving sessions:
- Save/resume sessions
- Export transcripts
- Analytics (question metrics, vote patterns)

---

**See Also:**
- [Backend Server Design](../10-backend-server.md) - Backend architecture
- [Extension Architecture](../01-architecture.md) - Core extension design
- [Workflows](workflows.md) - User interaction flows

---

**Previous:** [← Security](security.md) | **Next:** [Implementation →](implementation.md)
