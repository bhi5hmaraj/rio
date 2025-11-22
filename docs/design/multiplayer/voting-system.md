# Voting System

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

Rio Multiplayer uses democratic voting to prioritize questions, with configurable host vote weighting and flexible queue sorting.

---

## 1. Voting Rules

### 1.1 Configuration

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

### 1.2 Default Rules (MVP)

- ✅ **Anyone can vote** on any question (except own)
- ✅ **Vote changes allowed** (toggle upvote/downvote)
- ✅ **Host vote weight: 2x** (configurable)
- ✅ **No vote caps** (unlimited votes per user)
- ❌ **No auto-select threshold** (host always decides)
- ❌ **No self-voting** (cannot vote on your own questions)

---

## 2. Vote Mechanics

### 2.1 Upvote/Downvote

**States:**

```typescript
type VoteState =
  | 'none'      // User hasn't voted
  | 'upvoted'   // User clicked upvote
  | 'downvoted' // User clicked downvote
```

**Transitions:**

```
none → upvoted     (click upvote)
none → downvoted   (click downvote)

upvoted → none     (click upvote again - toggle)
upvoted → downvoted (click downvote - switch)

downvoted → none     (click downvote again - toggle)
downvoted → upvoted  (click upvote - switch)
```

### 2.2 Vote Storage

```typescript
interface Question {
  votes: {
    upvotes: string[];    // Array of user IDs who upvoted
    downvotes: string[];  // Array of user IDs who downvoted
  };
}

// Example:
{
  votes: {
    upvotes: ['alice', 'bob', 'charlie'],
    downvotes: ['dave']
  }
}
```

### 2.3 Vote Calculation

```typescript
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

**Example calculation:**

```
Question: "What are transformers?"
Upvotes: [Alice (host), Bob, Charlie]
Downvotes: [Dave]

Score = (2 * 1) + (1 * 1) + (1 * 1) - (1 * 1)
      = 2 + 1 + 1 - 1
      = 3
```

---

## 3. Queue Sorting

### 3.1 Sort Modes

```typescript
type QueueSortMode = 'votes' | 'time' | 'author';
```

**Votes (default):**
- Sort by vote score (highest first)
- Tie-breaker: Earlier submission time

**Time:**
- Sort by submission timestamp (oldest first)
- Useful for FIFO question handling

**Author:**
- Sort alphabetically by author name
- Useful for ensuring everyone gets heard

### 3.2 Sort Implementation

```typescript
function sortQuestions(
  questions: Question[],
  sortBy: QueueSortMode
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
```

### 3.3 Real-Time Re-sorting

Queue re-sorts automatically when:

- New vote cast
- Vote changed (upvote → downvote)
- Vote removed (toggle off)
- New question submitted
- Sort mode changed

**Performance optimization:**

```typescript
// Debounce re-sort to avoid excessive renders
const debouncedSort = useMemo(
  () => debounce(sortQuestions, 100),
  [sortMode]
);

useEffect(() => {
  debouncedSort(questions, sortMode);
}, [questions, sortMode]);
```

---

## 4. Tie-Breaking Logic

### 4.1 Equal Vote Scores

When two questions have the same score:

**Primary tie-breaker: Submission time (earlier first)**

```typescript
if (scoreA === scoreB) {
  return a.submittedAt - b.submittedAt;
}
```

**Example:**

```
Question A: +3 votes, submitted at 10:00
Question B: +3 votes, submitted at 10:05

Order: A, B (A was submitted earlier)
```

### 4.2 Future Tie-Breakers (Post-MVP)

Potential enhancements:

1. **Author diversity:** Prioritize questions from users who haven't had one answered yet
2. **Recency:** Prefer newer questions if score tied
3. **Question length:** Prefer shorter questions (faster to answer)
4. **Host explicit ordering:** Drag-and-drop manual reordering

---

## 5. Vote UI/UX

### 5.1 Vote Button States

```tsx
<VoteButton
  variant="up"
  active={hasUpvoted}
  count={upvoteCount}
  onClick={() => vote('up')}
/>
```

**Visual states:**

- **Inactive:** Gray, outline style
- **Active (upvoted):** Green, filled
- **Hover:** Scale up slightly
- **Disabled:** Grayed out (for own questions)

### 5.2 Vote Display

```
👍 3  👎 1
```

- Green thumbs-up with count
- Red thumbs-down with count
- Net score: +2 (shown on hover)

### 5.3 Weighted Vote Indicator

If host has voted, show indicator:

```
👍 3 (incl. host 2x)  👎 0
```

Or use crown emoji:

```
👍 👤👤👑  👎
```

---

## 6. Advanced Features (Future)

### 6.1 Vote Decay

Questions lose score over time to prevent stale questions from staying top:

```typescript
function calculateVoteScoreWithDecay(question: Question): number {
  const baseScore = calculateVoteScore(question);
  const ageMinutes = (Date.now() - question.submittedAt) / 60000;
  const decayFactor = Math.exp(-0.01 * ageMinutes); // Exponential decay

  return baseScore * decayFactor;
}
```

### 6.2 Vote Caps

Limit votes per user per time period:

```typescript
interface VoteRateLimit {
  maxVotesPerMinute: number;   // e.g., 10
  maxVotesPerSession: number;  // e.g., 50
}
```

### 6.3 Quadratic Voting

Allow users to allocate limited "vote credits" across questions:

```typescript
interface QuadraticVoting {
  totalCredits: number;        // e.g., 100 per user
  costFunction: (n: number) => number;  // e.g., n^2
}

// Voting 1 = costs 1 credit
// Voting 2 = costs 4 credits
// Voting 3 = costs 9 credits
```

### 6.4 Anonymous Voting

Hide who voted on what to reduce bias:

```typescript
interface VotingConfig {
  anonymousVotes: boolean;     // Hide voter identities
  showVoteCount: boolean;      // Show total count only
}
```

---

## 7. Anti-Spam Measures

### 7.1 Rate Limiting

Prevent rapid vote spam:

```typescript
class VoteRateLimiter {
  private lastVote: number = 0;
  private voteCount: number = 0;

  canVote(userId: string): boolean {
    const now = Date.now();

    // Max 5 votes per second
    if (now - this.lastVote < 200) {
      return false;
    }

    // Max 20 votes per minute
    if (this.voteCount > 20) {
      return false;
    }

    this.lastVote = now;
    this.voteCount++;

    return true;
  }
}
```

### 7.2 Vote Validation

Server-side validation:

```typescript
// Backend validates votes
function validateVote(vote: VoteMessage): boolean {
  // Check user is in session
  if (!isParticipant(vote.userId)) return false;

  // Check question exists
  if (!questionExists(vote.questionId)) return false;

  // Check not voting on own question
  const question = getQuestion(vote.questionId);
  if (question.submittedBy.id === vote.userId) return false;

  return true;
}
```

---

**Next:** [Security & Privacy →](security.md) | **Back to:** [UI Design](ui-design.md)
