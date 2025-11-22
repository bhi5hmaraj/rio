# Multiplayer UI Design

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

This document specifies the UI design for Rio Multiplayer, covering both host and participant interfaces, browser overlays, and visual elements.

---

## 1. Host UI (Rio Side Panel)

### 1.1 Full Layout

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

### 1.2 Component Breakdown

**Session Header**

```tsx
<SessionHeader
  status="hosting"
  sessionCode="847-293"
  platform="claude"
  chatUrl="claude.ai/chat/abc123"
/>
```

**Visual:**
- Green status indicator (🟢 Hosting)
- Large session code for easy sharing
- Platform badge with icon
- Copy code button (one-click copy)

**Participant List**

```tsx
<ParticipantList>
  <Participant
    name="Bob"
    status="online"
    role="participant"
    actions={['mute', 'kick']}
  />
</ParticipantList>
```

**Visual:**
- Avatar with color coding
- Online/away/offline status dot
- Hover shows join time
- Host-only action buttons

**Question Queue**

```tsx
<QuestionQueue
  questions={questions}
  sortBy="votes"
  onVote={(id, vote) => voteQuestion(id, vote)}
  onSelect={(id) => selectQuestion(id)}
  onReject={(id) => rejectQuestion(id)}
/>
```

**Visual:**
- Cards with elevation shadow
- Vote count with colored indicators (green +, red -)
- Author avatar and name
- Time ago (e.g., "2m ago")
- Expandable for long questions
- Sort dropdown (Votes, Time, Author)

**Team Chat**

```tsx
<TeamChat
  messages={teamMessages}
  onSend={(content) => sendTeamMessage(content)}
/>
```

**Visual:**
- Chat bubble UI (different color from AI chat)
- Sender name + timestamp
- Input with Shift+Enter for newlines
- Auto-scroll to latest

**Control Bar**

```tsx
<ControlBar>
  <Button onClick={copyJoinCode}>📋 Copy Join Code</Button>
  <Button onClick={pauseSession}>⏸️ Pause</Button>
  <Button onClick={endSession} variant="danger">🚪 End Session</Button>
</ControlBar>
```

---

## 2. Participant UI (Rio Side Panel)

### 2.1 Full Layout

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

### 2.2 Key Differences from Host UI

**Live Chat View:**
- Prominent chat history (top section)
- Shows who submitted each question
- Real-time streaming updates
- Attribution: "From Bob", "From Charlie"

**Your Questions:**
- Highlighted differently when you authored
- [Edit] and [Withdraw] buttons for own questions
- Status indicator (⏳ Pending, ✓ Selected, ✕ Rejected)

**Voting:**
- Cannot vote on own questions
- Clear visual feedback on vote state
- Toggle votes (click again to remove)

**No Moderation:**
- No [Kick] or [Mute] buttons
- No [Select] or [Reject] on queue
- Cannot end session

---

## 3. Browser Overlay (Host Only)

### 3.1 Question Injection Overlay

When host selects a question, overlay appears on chat platform:

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

### 3.2 Overlay Component

```tsx
<RioOverlay
  question={selectedQuestion}
  onEdit={() => setEditMode(true)}
  onSend={() => sendQuestion()}
  onSkip={() => skipQuestion()}
  onClose={() => clearSelection()}
/>
```

**Positioning:**
- Floats above chat input box
- Uses `position: fixed` with high z-index
- Responsive: Adjusts if input moves

**Styling:**
- Semi-transparent background
- Border with Rio brand color
- Drop shadow for depth
- Smooth fade-in animation

**Keyboard shortcuts:**
- `Cmd/Ctrl + Enter`: Send now
- `Esc`: Skip
- Arrow keys: Navigate between questions

### 3.3 Edit Warning

If host edits question before sending:

```
┌─────────────────────────────────────────────────┐
│ ⚠️ You edited Bob's question                   │
│                                                 │
│ Original: "What are transformers?"              │
│ Edited:   "What are transformers in NLP?"       │
│                                                 │
│ [Send as Edited] [Revert to Original] [Cancel] │
└─────────────────────────────────────────────────┘
```

---

## 4. Session Creation Flow UI

### 4.1 Create Session Modal

```
┌─────────────────────────────────────────┐
│ Start Multiplayer Session               │
├─────────────────────────────────────────┤
│                                         │
│ Platform detected: ✓ Claude             │
│ Chat URL: claude.ai/chat/abc123         │
│                                         │
│ Session Settings (optional):            │
│                                         │
│ Max Participants:                       │
│ [Unlimited ▼]                           │
│                                         │
│ Access Mode:                            │
│ ● Open to anyone with code              │
│ ○ Require my approval                   │
│ ○ Invite only                           │
│                                         │
│ Host vote weight: [2x ▼]                │
│                                         │
│ [Cancel] [Create Session]               │
└─────────────────────────────────────────┘
```

### 4.2 Session Created Success

```
┌─────────────────────────────────────────┐
│ Session Created! ✓                      │
├─────────────────────────────────────────┤
│                                         │
│ Your session code:                      │
│                                         │
│      ┌─────────────┐                   │
│      │   847-293   │ [📋 Copy]         │
│      └─────────────┘                   │
│                                         │
│ Share with your team:                   │
│                                         │
│ rio.app/join/847-293                    │
│ [📋 Copy Link]                          │
│                                         │
│ Or share via:                           │
│ [Slack] [Discord] [Email]               │
│                                         │
│ [Start Collaborating →]                 │
└─────────────────────────────────────────┘
```

---

## 5. Join Session Flow UI

### 5.1 Join Modal

```
┌─────────────────────────────────────────┐
│ Join Multiplayer Session                │
├─────────────────────────────────────────┤
│                                         │
│ Enter session code:                     │
│                                         │
│ ┌───┬───┬───┬───┬───┬───┐              │
│ │ 8 │ 4 │ 7 │ 2 │ 9 │ 3 │              │
│ └───┴───┴───┴───┴───┴───┘              │
│                                         │
│ Your display name:                      │
│ ┌─────────────────────────┐             │
│ │ Bob                     │             │
│ └─────────────────────────┘             │
│                                         │
│ [Cancel] [Join Session]                 │
└─────────────────────────────────────────┘
```

### 5.2 Waiting for Approval

(If host enabled approval mode)

```
┌─────────────────────────────────────────┐
│ Waiting for Host Approval...            │
├─────────────────────────────────────────┤
│                                         │
│       ⏳ Loading animation              │
│                                         │
│ Alice is reviewing your join request    │
│                                         │
│ Session: 847-293                        │
│ Requested as: Bob                       │
│                                         │
│ [Cancel Request]                        │
└─────────────────────────────────────────┘
```

### 5.3 Join Success

```
┌─────────────────────────────────────────┐
│ Connected! ✓                            │
├─────────────────────────────────────────┤
│                                         │
│ You joined Alice's session              │
│ Platform: Claude                        │
│ 3 other participants online             │
│                                         │
│ [Start Collaborating →]                 │
└─────────────────────────────────────────┘
```

---

## 6. Visual Design System

### 6.1 Color Palette

```css
/* Brand colors */
--rio-primary: #6366f1;      /* Indigo */
--rio-primary-dark: #4f46e5;
--rio-primary-light: #818cf8;

/* Status colors */
--status-online: #10b981;    /* Green */
--status-away: #f59e0b;      /* Amber */
--status-offline: #6b7280;   /* Gray */

/* Vote colors */
--vote-up: #10b981;          /* Green */
--vote-down: #ef4444;        /* Red */

/* Role colors */
--host-badge: #8b5cf6;       /* Purple */
--participant-badge: #06b6d4; /* Cyan */

/* Background */
--bg-primary: #ffffff;
--bg-secondary: #f9fafb;
--bg-overlay: rgba(0, 0, 0, 0.5);
```

### 6.2 Typography

```css
/* Headers */
--font-header: 'Inter', system-ui, sans-serif;
--size-h1: 1.5rem;
--size-h2: 1.25rem;
--size-h3: 1.125rem;

/* Body */
--font-body: 'Inter', system-ui, sans-serif;
--size-body: 0.875rem;
--size-small: 0.75rem;

/* Code/Monospace */
--font-mono: 'Fira Code', monospace;
```

### 6.3 Spacing

```css
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
```

### 6.4 Component Styles

**Question Card:**

```tsx
<div className="question-card">
  <div className="question-header">
    <Avatar user={question.submittedBy} />
    <span className="author">{question.submittedBy.name}</span>
    <span className="timestamp">2m ago</span>
  </div>

  <div className="question-content">
    {question.content}
  </div>

  <div className="question-footer">
    <VoteButtons votes={question.votes} />
    {isHost && <ActionButtons />}
  </div>
</div>
```

```css
.question-card {
  background: var(--bg-primary);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: var(--space-md);
  margin-bottom: var(--space-sm);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
}

.question-card:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.15);
}

.question-card.selected {
  border-color: var(--rio-primary);
  background: var(--rio-primary-light);
  background-opacity: 0.1;
}
```

---

## 7. Responsive Design

### 7.1 Side Panel Widths

- **Default:** 400px
- **Narrow:** 320px (if browser < 1200px wide)
- **Wide mode:** 500px (user preference)

### 7.2 Mobile Considerations

**Not supported in MVP**, but future considerations:

- Full-screen on mobile
- Swipe gestures for navigation
- Bottom sheet for question submission

---

## 8. Accessibility

### 8.1 Keyboard Navigation

- `Tab`: Navigate between elements
- `Enter`: Submit/select/vote
- `Esc`: Close modals/overlays
- `Cmd/Ctrl + K`: Focus question input
- `Cmd/Ctrl + /`: Toggle team chat

### 8.2 Screen Reader Support

```tsx
<button
  onClick={onVote}
  aria-label={`Upvote question from ${author}`}
  aria-pressed={hasUpvoted}
>
  👍 {upvoteCount}
</button>
```

### 8.3 Focus Management

- Auto-focus on modal open
- Focus trap in modals
- Focus return after close
- Visible focus indicators

---

## 9. Animation & Feedback

### 9.1 Transitions

```css
/* Smooth state changes */
.fade-in {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Vote button feedback */
.vote-btn:active {
  transform: scale(0.95);
}
```

### 9.2 Loading States

- Skeleton screens for queue loading
- Spinner for WebSocket connection
- Pulse animation for "typing..." indicator

### 9.3 Toast Notifications

```tsx
<Toast variant="success">
  Question sent successfully!
</Toast>

<Toast variant="error">
  Failed to connect to session
</Toast>

<Toast variant="info">
  Bob joined the session
</Toast>
```

---

**Next:** [Voting System →](voting-system.md) | **Back to:** [Architecture](architecture.md)
