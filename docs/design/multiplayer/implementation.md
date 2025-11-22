# Implementation Roadmap

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

This document outlines the implementation plan, success metrics, edge case handling, and testing strategy for Rio Multiplayer.

---

## 1. Development Timeline

### Week 1: Core Infrastructure

**Goals:**
- Platform adapter framework
- Basic WebSocket communication
- Session creation/join flow

**Deliverables:**

```
✅ Platform detection and adapter initialization
✅ PlatformAdapter interface + Claude implementation
✅ ChatGPT adapter implementation
✅ WebSocket connection manager
✅ Session creation API integration
✅ Join session flow (basic)
✅ Side panel UI scaffolding (React + Zustand)
```

**Key files:**

```
src/content/multiplayer/
  adapters/
    PlatformAdapter.ts
    ClaudeAdapter.ts
    ChatGPTAdapter.ts
  MultiplayerContentScript.ts

src/background/
  WebSocketManager.ts
  MultiplayerBackgroundWorker.ts

src/ui/multiplayer/
  SessionControl.tsx
  store.ts
```

---

### Week 2: Voting & Question Queue

**Goals:**
- Question submission and display
- Voting mechanics
- Queue sorting

**Deliverables:**

```
✅ Question submission form
✅ Vote up/down buttons with state management
✅ Queue sorting (votes, time, author)
✅ Real-time vote synchronization
✅ Vote score calculation with host weighting
✅ Question card UI component
✅ WebSocket message handlers for voting
```

**Key components:**

```tsx
<QuestionQueue
  questions={questions}
  sortBy="votes"
  onVote={handleVote}
  onSubmit={handleSubmit}
/>

<QuestionCard
  question={question}
  onVote={onVote}
  isHost={isHost}
/>

<VoteButton
  variant="up"
  active={hasUpvoted}
  count={upvotes}
  onClick={onVote}
/>
```

---

### Week 3: Host Selection & Send Control

**Goals:**
- Host selects questions
- Inject into chat input
- Send button automation
- Response observation

**Deliverables:**

```
✅ Host [Select] button and handler
✅ Question injection into platform input
✅ Rio overlay UI (floating above input)
✅ [Send Now], [Edit], [Skip] controls
✅ adapter.clickSend() implementation
✅ DOM observer for model responses
✅ Manual send detection (Enter key)
✅ Response broadcast to participants
✅ Edit history tracking
```

**Key interactions:**

```typescript
// Host clicks [Select]
onSelect(questionId) {
  const question = getQuestion(questionId);

  // Inject into content script
  chrome.tabs.sendMessage(activeTabId, {
    action: 'inject-question',
    content: question.content,
    questionId: question.id
  });

  // Show overlay
  showOverlay(question);
}

// Host clicks [Send Now]
onSend() {
  adapter.clickSend();
  observeResponse();
}
```

---

### Week 4: Team Chat & Participant Management

**Goals:**
- Team chat side channel
- Participant list with moderation
- Session controls (pause, end)

**Deliverables:**

```
✅ Team chat UI component
✅ Real-time team message sync
✅ Participant list with online status
✅ Host moderation (kick, mute)
✅ Session pause/resume
✅ Session end flow
✅ Participant disconnect handling
✅ Host reconnection logic
```

**Components:**

```tsx
<TeamChat
  messages={teamMessages}
  onSend={sendTeamMessage}
/>

<ParticipantList
  participants={participants}
  isHost={isHost}
  onKick={kickParticipant}
  onMute={muteParticipant}
/>

<SessionControls
  onPause={pauseSession}
  onEnd={endSession}
  onCopyCode={copyJoinCode}
/>
```

---

### Week 5: Polish, Edge Cases & Testing

**Goals:**
- Handle all edge cases
- Cross-platform testing
- Performance optimization
- Bug fixes

**Deliverables:**

```
✅ Edge case handling (see section 3)
✅ Error boundaries and fallbacks
✅ Loading states and skeletons
✅ Toast notifications
✅ Keyboard shortcuts
✅ Accessibility improvements (a11y)
✅ Chrome + Firefox testing
✅ ChatGPT + Claude testing
✅ Load testing (10+ participants)
✅ Documentation and examples
```

---

## 2. Success Metrics

### 2.1 Engagement Metrics

**Session activity:**
- Average session duration: **30-60 minutes** (target)
- Questions submitted per session: **10-20** (target)
- Questions sent to model: **5-10** (target)
- Voting participation rate: **>80%** (target)
- Team chat messages per session: **20-50** (target)

**Tracking:**

```typescript
interface SessionMetrics {
  sessionId: string;
  duration: number;              // milliseconds
  questionsSubmitted: number;
  questionsSent: number;
  votescast: number;
  teamChatMessages: number;
  participantCount: number;
  averageQueueSize: number;
}

// Log on session end
logMetrics(sessionMetrics);
```

### 2.2 Quality Metrics

**Question quality:**
- Vote agreement rate: **>60%** (participants vote similarly)
- Question rejection rate: **<20%** (host rejects few questions)
- Edit rate: **<30%** (host edits before sending)
- Withdrawal rate: **<10%** (authors withdraw own questions)

**Calculation:**

```typescript
// Vote agreement: Do most people vote the same way?
function calculateVoteAgreement(question: Question): number {
  const total = question.votes.upvotes.length + question.votes.downvotes.length;
  const majority = Math.max(
    question.votes.upvotes.length,
    question.votes.downvotes.length
  );

  return total > 0 ? majority / total : 0;
}
```

**Return usage:**
- Same team uses multiplayer again: **>50%** (target)
- Sessions created per week: **Growth indicator**

### 2.3 Technical Metrics

**Reliability:**
- WebSocket uptime: **>99%**
- Message delivery latency: **<500ms** (p95)
- Platform adapter success rate: **>95%** (selectors work)
- Session uptime: **>90%** (host doesn't disconnect)

**Performance:**

```typescript
interface PerformanceMetrics {
  wsLatency: number[];           // RTT measurements
  messageSyncDelay: number[];    // Time from send to all receive
  queueRenderTime: number[];     // UI render performance
  memoryUsage: number;           // MB
}

// Monitor and alert if degraded
if (median(wsLatency) > 500) {
  alertOps('High WebSocket latency');
}
```

---

## 3. Edge Cases & Solutions

### 3.1 Host Edits Question Before Sending

**Scenario:**
1. Bob submits: "What are transformers?"
2. Alice selects it (injected into input)
3. Alice edits to: "What are transformers in NLP?"
4. Alice sends

**Solution:**

```typescript
// Detect input change
adapter.observeInputChange((newText) => {
  if (newText !== selectedQuestion.content) {
    showEditWarning({
      original: selectedQuestion.content,
      edited: newText
    });
  }
});

// Store edit history
questionHistory.push({
  originalContent: "What are transformers?",
  sentContent: "What are transformers in NLP?",
  submittedBy: "Bob",
  editedBy: "Alice",
  editedAt: Date.now()
});
```

**UI:**

```
⚠️ You edited Bob's question

Original: "What are transformers?"
Edited:   "What are transformers in NLP?"

[Send as Edited] [Revert] [Cancel]
```

---

### 3.2 Multiple Questions Selected Accidentally

**Scenario:** Alice clicks [Select] on two questions rapidly

**Solution:**

```typescript
// Only allow one selected question at a time
onSelect(questionId) {
  if (selectedQuestion && selectedQuestion.id !== questionId) {
    // Deselect previous
    deselectQuestion(selectedQuestion.id);

    // Show notification
    showToast({
      message: `Deselected: "${selectedQuestion.content}"`,
      variant: 'info'
    });
  }

  selectQuestion(questionId);
}
```

**State management:**

```typescript
set((state) => ({
  selectedQuestion: question,  // Only one at a time
  questions: updateQuestionStatus(state.questions, question.id, 'selected')
}));
```

---

### 3.3 Model Response Takes Long Time

**Scenario:** Claude is generating a very long response (streaming)

**Solution:**

```typescript
// Lock question queue during response
const isModelTyping = adapter.isTyping();

if (isModelTyping) {
  disableQuestionSelection();
  showIndicator("⏳ Waiting for Claude to finish...");
}

// Unlock when done
adapter.observeNewMessages((msg) => {
  if (msg.role === 'assistant' && !adapter.isTyping()) {
    enableQuestionSelection();
  }
});
```

**Participants can still:**
- Submit new questions
- Vote on existing questions
- Chat in team chat

**But host cannot:**
- Select next question until response complete

---

### 3.4 Participant Submits Spam

**Scenario:** Bob submits 10 questions in 1 minute

**Solutions:**

**Option A: Rate Limiting**

```typescript
interface RateLimits {
  maxQuestionsPerMinute: 5;
  maxQuestionsPerSession: 20;
}

// Check before allowing submission
if (getUserQuestionCount(userId, 60000) >= 5) {
  showError("⚠️ Slow down! Max 5 questions per minute.");
  return;
}
```

**Option B: Queue Limit**

```typescript
// Max 3 pending questions per user
const userPendingQuestions = questions.filter(
  q => q.submittedBy.id === userId && q.status === 'pending'
);

if (userPendingQuestions.length >= 3) {
  showError("You have 3 questions in queue. Wait for one to be answered.");
  return;
}
```

**Option C: Host Controls**

```tsx
<ParticipantActions>
  <Button onClick={() => muteUser(userId)}>Mute</Button>
  <Button onClick={() => kickUser(userId)}>Kick</Button>
  <Button onClick={() => deleteUserQuestions(userId)}>Clear Questions</Button>
</ParticipantActions>
```

**MVP choice:** Option B (queue limit) + Option C (host controls)

---

### 3.5 Host Disconnects Mid-Session

**Scenario:** Alice (host) closes browser or loses internet

**Solution:**

**Immediate:**

```typescript
// WebSocket detects disconnect
ws.onclose = () => {
  broadcast({
    type: 'host-disconnected',
    sessionId,
    timestamp: Date.now()
  });

  updateSessionStatus('paused');
};
```

**UI for participants:**

```
⚠️ Host disconnected

Session is paused. You can:
• Wait for host to reconnect
• Continue discussing in team chat
• Leave session

[Wait] [Leave]
```

**After 2 minutes:**

```
Host hasn't reconnected.

[Wait longer]
[Transfer host to: Bob ▼]  (requires vote - future feature)
[End session and save transcript]
```

**Host reconnects:**

```typescript
// Auto-resume if within timeout
ws.onopen = () => {
  if (session.status === 'paused' && isHost) {
    broadcast({
      type: 'host-reconnected',
      sessionId
    });

    updateSessionStatus('active');
  }
};
```

**UI:**

```
✓ Host reconnected

Session resumed. Syncing any new questions...
```

---

### 3.6 Platform UI Changes

**Scenario:** Claude updates their UI, selectors break

**Solution:**

**Defensive selectors:**

```typescript
function findInput(): HTMLElement | null {
  const selectors = [
    'div[contenteditable="true"]',       // Current
    '#message-input',                    // Fallback 1
    'textarea[placeholder*="Message"]',  // Fallback 2
    '[role="textbox"]',                  // Fallback 3
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
```

**Learn from user:**

```typescript
function learnInputLocation(): HTMLElement | null {
  showOverlay({
    message: "Can't find chat input. Click where you type →",
    onClick: (el: HTMLElement) => {
      const xpath = getXPath(el);
      localStorage.setItem('rio-learned-input-claude', xpath);

      showToast({
        message: "✓ Learned input location. Thanks!",
        variant: 'success'
      });

      return el;
    }
  });

  return null;
}
```

**Monitoring:**

```typescript
// Log selector failures to backend
if (!findInput()) {
  logError({
    type: 'selector-failure',
    platform: 'claude',
    url: window.location.href,
    timestamp: Date.now()
  });
}
```

---

## 4. Testing Strategy

### 4.1 Unit Tests

**Coverage targets:**
- Utility functions: **>90%**
- State management: **>80%**
- WebSocket handlers: **>75%**

**Example tests:**

```typescript
describe('VoteCalculation', () => {
  it('should calculate weighted votes correctly', () => {
    const question: Question = {
      votes: {
        upvotes: ['alice', 'bob'],  // alice is host
        downvotes: ['dave']
      }
    };

    const score = calculateVoteScore(question);
    expect(score).toBe(2); // (2*1 + 1*1 - 1*1)
  });

  it('should handle tie-breaking by submission time', () => {
    const questions = sortQuestions([q1, q2], 'votes');
    expect(questions[0]).toBe(q1); // Earlier submission
  });
});
```

### 4.2 Integration Tests

**Key flows:**

```typescript
describe('Session Creation Flow', () => {
  it('should create session and generate join code', async () => {
    const session = await createSession('claude');

    expect(session.id).toMatch(/^rio-/);
    expect(session.code).toMatch(/^\d{6}$/);
    expect(session.platform).toBe('claude');
  });

  it('should allow participant to join with code', async () => {
    const session = await createSession('claude');
    const joined = await joinSession(session.code, 'Bob');

    expect(joined.sessionId).toBe(session.id);
  });
});
```

### 4.3 E2E Tests

**Playwright tests:**

```typescript
test('Host can select and send question', async ({ page, context }) => {
  // Host creates session
  await page.goto('https://claude.ai/chat/new');
  await page.click('[data-testid="rio-extension"]');
  await page.click('text=Start Multiplayer Session');

  const code = await page.textContent('[data-testid="session-code"]');

  // Participant joins (new context)
  const participant = await context.newPage();
  await participant.goto('chrome-extension://rio-id/sidepanel.html');
  await participant.fill('[data-testid="join-code"]', code);
  await participant.click('text=Join Session');

  // Participant submits question
  await participant.fill('[data-testid="question-input"]', 'What are transformers?');
  await participant.click('text=Submit');

  // Host sees question
  await expect(page.locator('text=What are transformers?')).toBeVisible();

  // Host selects and sends
  await page.click('[data-testid="select-question"]');
  await page.click('[data-testid="send-now"]');

  // Verify sent to Claude
  await expect(page.locator('[data-is-user-message="true"]')).toContainText('What are transformers?');
});
```

### 4.4 Load Testing

**Simulate 20 participants:**

```typescript
async function loadTest() {
  const session = await createSession('claude');

  // Spawn 20 participant connections
  const participants = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      connectParticipant(session.code, `User${i}`)
    )
  );

  // Each submits 5 questions
  const questions = [];
  for (const p of participants) {
    for (let i = 0; i < 5; i++) {
      questions.push(p.submitQuestion(`Question ${i} from ${p.name}`));
    }
  }

  await Promise.all(questions);

  // Measure metrics
  console.log('Queue size:', getQueueSize());
  console.log('WS latency:', measureLatency());
  console.log('Memory usage:', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');
}
```

---

## 5. Deployment

### 5.1 Extension Release

**Chrome Web Store:**

1. Increment version in `manifest.json`
2. Run build: `npm run build`
3. Zip extension: `zip -r rio-v1.0.0.zip dist/`
4. Upload to Chrome Web Store Developer Dashboard
5. Submit for review

**Firefox Add-ons:**

1. Same build process
2. Upload to addons.mozilla.org
3. Include privacy policy link

### 5.2 Backend Deployment

**Server requirements:**
- Backend API running (see `docs/design/10-backend-server.md`)
- WebSocket relay at `wss://backend.rio.app/api/v1/multiplayer/ws`
- Redis for session state

**Health checks:**

```bash
curl https://backend.rio.app/health
# Expected: { "status": "ok", "websocket": "ready" }
```

---

## 6. Future Enhancements

### 6.1 Phase 2 Features

**Saved Templates:**

```typescript
interface QuestionTemplate {
  id: string;
  name: string;
  content: string;  // "Explain [CONCEPT] like I'm 5"
  variables: string[];  // ["CONCEPT"]
}
```

**Question Threads:**

```typescript
interface Question {
  parentId?: string;  // Link to parent question
  children: string[]; // Child question IDs
}
```

**Smart Queue (AI-powered):**
- Merge similar questions
- Suggest logical ordering
- Flag off-topic questions

### 6.2 DAG Integration

```typescript
interface MultiplayerDAG {
  sessionId: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  contributors: Map<string, Participant>;
}

// Export as collaborative concept map
exportSessionAsDAG(sessionId);
```

---

**Next:** [Back to Overview](README.md) | **See also:** [Backend Integration](integration.md)
