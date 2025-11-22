# Multiplayer Workflows

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

This document describes the core workflows for Rio Multiplayer sessions, from session creation through question voting and sending.

---

## 1. Session Creation Flow

### 1.1 Host Creates Session

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

**Steps in Detail:**

1. **Host navigates to chat platform** (ChatGPT or Claude)
2. **Opens Rio extension** (click icon or use keyboard shortcut)
3. **Clicks "Start Multiplayer Session"** button
4. **Rio backend creates session:**
   - Generates unique session ID
   - Creates 6-digit numeric join code
   - Registers session with WebSocket server
   - Sets host as session owner
5. **Host shares join code** via Slack, Discord, email, etc.

### 1.2 Session Configuration (Optional)

Before sharing, host can configure:

```typescript
interface SessionConfig {
  maxParticipants?: number;      // Default: unlimited
  accessMode: 'open' | 'approval' | 'invite-only';
  voteWeight: {
    host: number;                // Default: 2
    participant: number;         // Default: 1
  };
  allowQuestionEdits: boolean;   // Default: true
  sessionDuration?: number;      // Default: 24h
}
```

---

## 2. Joining Session Flow

### 2.1 Participant Joins

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

**Steps in Detail:**

1. **Opens Rio extension** (can be on ANY webpage - doesn't need to be on chat platform)
2. **Clicks "Join Session"**
3. **Enters 6-digit code** (e.g., 847-293)
4. **Enters display name** (no authentication required)
5. **WebSocket connection established:**
   - Extension connects to `wss://backend/api/v1/multiplayer/ws/{session_id}`
   - Server adds participant to session
   - Broadcasts join event to all participants
6. **Participant sees:**
   - Full chat history (if any)
   - Current question queue
   - List of online participants

### 2.2 Approval Mode (Optional)

If host enabled approval mode:

```
┌────────────────────────────────────┐
│ Participant: Bob                   │
│ "Waiting for host approval..."     │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Host: Alice                        │
│ "Bob wants to join"                │
│ [✓ Accept] [✕ Reject]              │
└────────────────────────────────────┘
```

---

## 3. Question Submission & Voting Flow

### 3.1 Submit Question

**Participant submits:**

```
┌──────────────────────────────────────┐
│ Bob types:                           │
│ "What are transformers in NLP?"      │
│                                      │
│ [Submit to Queue]                    │
└──────────────────────────────────────┘
```

**What happens:**

1. Bob clicks "Submit to Queue"
2. Extension sends WebSocket message:
   ```json
   {
     "type": "question-submit",
     "question": {
       "id": "q-abc123",
       "content": "What are transformers in NLP?",
       "submittedBy": { "id": "bob", "name": "Bob" },
       "submittedAt": 1699900800000,
       "status": "pending",
       "votes": { "upvotes": [], "downvotes": [] }
     }
   }
   ```
3. Backend broadcasts to ALL participants
4. Everyone sees new question in queue

### 3.2 Vote on Questions

**Everyone sees queue:**

```
┌──────────────────────────────────────────────┐
│ Question Queue (3):                          │
│                                              │
│ 1. "What are transformers in NLP?"           │
│    👤 Bob  |  👍 3  👎 0  |  [👍] [👎]      │
│                                              │
│ 2. "Explain attention mechanism"             │
│    👤 Charlie  |  👍 2  👎 0  |  [👍] [👎]  │
│                                              │
│ 3. "Compare to RNNs"                         │
│    👤 Dave  |  👍 1  👎 1  |  [👍] [👎]     │
└──────────────────────────────────────────────┘
```

**Voting rules:**

- Any participant can upvote (+1) or downvote (-1)
- Can change vote (upvote → downvote or vice versa)
- Cannot vote on own question (configurable)
- Host votes can be weighted (default: 2x)

**WebSocket message:**

```json
{
  "type": "question-vote",
  "questionId": "q-abc123",
  "vote": "up",
  "userId": "charlie"
}
```

Queue automatically re-sorts by vote score in real-time.

---

## 4. Host Selection Flow

### 4.1 Select Question

Host reviews queue and clicks **[Select]** on top-voted question.

**What happens:**

1. **Content script receives message:**
   ```typescript
   chrome.runtime.onMessage.addListener((msg) => {
     if (msg.action === 'inject-question') {
       const adapter = getCurrentPlatformAdapter();
       adapter.setInputText(msg.content);
       showRioOverlay(msg);
     }
   });
   ```

2. **Question auto-fills input box:**
   ```
   ┌────────────────────────────────────┐
   │ What are transformers in NLP? [📤]│ ← Auto-filled
   └────────────────────────────────────┘
   ```

3. **Rio overlay appears:**
   ```
   ┌────────────────────────────────────┐
   │ 📋 From: Bob  |  Votes: 👍 3       │
   │ [✏️ Edit] [📤 Send] [⏭️ Skip]     │
   └────────────────────────────────────┘
   ```

### 4.2 Host Actions

Host has three options:

**Option 1: Send Immediately**

- Click [Send Now] → Rio auto-clicks platform send button
- Response broadcast to all participants

**Option 2: Edit Then Send**

- Click [Edit Question]
- Modify text in input box
- Click [Send Now]
- Rio shows: "⚠️ You edited Bob's question"
- Stores edit history:
  ```typescript
  {
    original: "What are transformers in NLP?",
    sent: "What are transformers in natural language processing?",
    editedBy: "Alice"
  }
  ```

**Option 3: Skip**

- Click [Skip]
- Question returns to queue
- Next highest-voted question becomes available

**Option 4: Manual Send**

- Host ignores overlay and presses Enter
- Rio detects manual send via DOM observer
- Broadcasts question-sent event

---

## 5. Response Observation Flow

### 5.1 Detect Response

After host sends question, Rio monitors for model response:

```typescript
// Content script observes DOM
adapter.observeNewMessages((message) => {
  if (message.role === 'assistant') {
    // New model response detected!
    chrome.runtime.sendMessage({
      action: 'model-response',
      content: message.content,
      timestamp: Date.now()
    });
  }
});
```

### 5.2 Broadcast to Participants

1. **Background worker receives response**
2. **Sends via WebSocket:**
   ```json
   {
     "type": "chat-message",
     "message": {
       "role": "assistant",
       "content": "Transformers are neural networks...",
       "timestamp": 1699900900000,
       "linkedQuestion": "q-abc123"
     }
   }
   ```
3. **All participants see update** in real-time
4. **Question removed from queue** (status: sent → completed)

---

## 6. Question Lifecycle

### 6.1 State Machine

```
           ┌─────────┐
           │ Pending │
           └────┬────┘
                │
        ┌───────┼───────┐
        │               │
        v               v
   ┌─────────┐    ┌──────────┐
   │Selected │    │ Rejected │ (terminal)
   └────┬────┘    └──────────┘
        │
        v
   ┌─────────┐
   │  Sent   │ (terminal)
   └─────────┘
```

**State transitions:**

- **Pending → Selected:** Host clicks [Select]
- **Selected → Sent:** Host sends to AI
- **Selected → Pending:** Host clicks [Skip]
- **Pending → Rejected:** Host clicks [Reject]

### 6.2 Question Status

```typescript
type QuestionStatus =
  | 'pending'    // In queue, can be voted on
  | 'selected'   // Host selected, injected into input
  | 'sent'       // Sent to model, waiting for response
  | 'rejected';  // Host rejected, removed from queue
```

---

## 7. Team Chat Workflow

### 7.1 Side Channel Discussion

Participants can discuss questions privately before submitting:

```
┌──────────────────────────────────────┐
│ 💬 Team Chat                         │
│                                      │
│ [Bob] Should we ask about BERT?      │
│ [Charlie] Yes! Let me draft that     │
│ [Alice] Good idea, submit it         │
└──────────────────────────────────────┘
```

**Team chat features:**

- Separate from AI chat (not sent to model)
- Visible to all participants
- Used for coordination and discussion
- Supports markdown formatting

### 7.2 WebSocket Message

```json
{
  "type": "team-chat",
  "message": {
    "sender": { "id": "bob", "name": "Bob" },
    "content": "Should we ask about BERT?",
    "timestamp": 1699900950000
  }
}
```

---

## 8. Session End Flow

### 8.1 Normal End

Host clicks **[End Session]**:

1. WebSocket message broadcast:
   ```json
   {
     "type": "session-end",
     "endedBy": "alice",
     "reason": "completed"
   }
   ```
2. All participants see: "Session ended by Alice"
3. Transcript available for export
4. WebSocket connections close

### 8.2 Auto-Expire

Sessions automatically expire after **24 hours**:

- Warning at 23h: "Session expires in 1 hour"
- At 24h: Auto-end, save transcript

### 8.3 Host Disconnect

If host closes browser tab:

**Immediate:**
- Broadcast: "⚠️ Host disconnected"
- Session status → 'paused'
- Question queue frozen

**After 2 minutes:**
- Offer options:
  - [Wait for host] - Keep session paused
  - [Transfer host] - Vote for new host (future feature)
  - [End session] - Save transcript and exit

**Host reconnects:**
- Auto-resume session
- "✓ Host reconnected. Session resumed."

---

## 9. Edge Case Workflows

### 9.1 Concurrent Responses

**Problem:** Model is still typing when host selects next question

**Solution:**

- Lock question selection while `adapter.isTyping() === true`
- Show indicator: "⏳ Waiting for response..."
- Participants can still vote and chat
- Selection enabled when response complete

### 9.2 Duplicate Votes

**Problem:** User clicks upvote twice rapidly

**Solution:**

- First click: Add to upvotes
- Second click: Remove from upvotes (toggle)
- Debounce clicks (300ms)

### 9.3 Question Edit Conflict

**Problem:** Host edits question while participant withdraws it

**Solution:**

- Question locks when selected (cannot be withdrawn)
- If withdrawn before selection completes, show host: "Question withdrawn by Bob"
- Return to queue selection

---

**Next:** [Architecture →](architecture.md) | **Back to:** [Overview](overview.md)
