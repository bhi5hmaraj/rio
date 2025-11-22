# Security & Privacy

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

Rio Multiplayer prioritizes user privacy and security through minimal data storage, optional encryption, and host-controlled access.

---

## 1. Session Access Control

### 1.1 Access Modes

```typescript
interface SessionSecurity {
  accessMode: 'open' | 'approval' | 'invite-only';
  maxParticipants?: number;
  requirePassword?: boolean;
  allowedDomains?: string[];  // e.g., '@company.com'
}
```

**Open (default):**
- Anyone with the code can join
- No approval required
- Fast onboarding for public sessions

**Approval:**
- Host must approve each join request
- Shows: "Bob wants to join" → [Accept] [Reject]
- Useful for semi-private sessions

**Invite-only:**
- Host pre-approves specific user IDs
- Join code + must be on allowlist
- Most secure, but requires setup

### 1.2 Join Flow with Approval

```typescript
// Participant sends join request
ws.send({
  type: 'join-request',
  sessionId,
  userName: 'Bob',
  userId: 'bob-123'
});

// Host receives notification
onMessage({
  type: 'join-request-pending',
  participant: {
    id: 'bob-123',
    name: 'Bob'
  }
});

// Host approves or rejects
ws.send({
  type: 'join-response',
  participantId: 'bob-123',
  approved: true
});
```

### 1.3 Participant Limits

```typescript
interface SessionLimits {
  maxParticipants: number;        // Default: 20
  maxQuestionsPerUser: number;    // Default: 5
  maxQueueSize: number;           // Default: 50
}
```

**Enforcement:**

- Server rejects join if `participants.length >= maxParticipants`
- Client shows: "Session full (20/20). Try again later."
- Host can kick inactive participants to make room

---

## 2. Data Privacy

### 2.1 What's Stored Where

**Local (Extension Storage):**

```typescript
// chrome.storage.local
{
  sessionHistory: [
    {
      id: 'rio-abc123',
      code: '847-293',
      platform: 'claude',
      createdAt: 1699900800000,
      role: 'host',
      // No chat content stored
    }
  ],
  userPreferences: {
    displayName: 'Alice',
    voteWeightPreference: 2,
    defaultAccessMode: 'open'
  },
  learnedSelectors: {
    'claude.ai': { input: '...', sendButton: '...' }
  }
}
```

**Server (Signaling Only):**

```typescript
// Backend stores in-memory (Redis)
{
  sessionId: 'rio-abc123',
  code: '847-293',
  hostId: 'alice-456',
  participants: ['alice-456', 'bob-123'],
  createdAt: 1699900800000,
  expiresAt: 1699987200000,  // 24h later
  // No chat messages stored
  // No question content stored
}
```

**Never Stored:**

- ❌ ChatGPT/Claude account credentials
- ❌ API keys
- ❌ Full chat transcripts (unless user exports locally)
- ❌ Question content after session ends
- ❌ Team chat messages after session ends

### 2.2 Data Retention

**Session metadata:**
- Kept in Redis for **24 hours**
- Auto-deleted on expiry
- Manually deleted when host ends session

**Extension storage:**
- Session history kept **locally only**
- User can clear via settings
- No sync to cloud

**Exports (optional):**
- User can export session transcript
- Saved locally as JSON/Markdown
- User's responsibility to secure

---

## 3. Message Encryption

### 3.1 Transport Security

**WebSocket TLS:**

```
wss://backend.rio.app/api/v1/multiplayer/ws/{sessionId}
```

- All messages encrypted in transit (TLS 1.3)
- No plaintext WebSocket (`ws://`) allowed
- Certificate pinning (future enhancement)

### 3.2 End-to-End Encryption (Optional)

For paranoid users, enable E2EE:

```typescript
class EncryptedSession {
  private key: CryptoKey;

  async init(): Promise<string> {
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

  async decryptMessage(encrypted: string): Promise<WSMessage> {
    const { iv, data } = JSON.parse(encrypted);

    const ivArray = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const dataArray = Uint8Array.from(atob(data), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      this.key,
      dataArray
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }
}
```

**Key sharing:**

- QR code displayed on session creation
- Participants scan to get encryption key
- Server never sees plaintext (only encrypted blobs)

**Trade-off:**
- ✅ Server cannot read messages
- ❌ More complex UX (QR code scanning)
- ❌ No server-side spam filtering

**MVP decision:** Not included in v1.0, but architected for future addition.

---

## 4. Authentication & Authorization

### 4.1 No Account Required

**Participants:**
- No signup/login needed
- Self-identify with display name
- Session code is the authentication

**Security consideration:**
- Anyone with code can join (if open mode)
- Mitigation: Use approval mode or invite-only for sensitive sessions

### 4.2 Host Verification

**Problem:** How to ensure only the real host can moderate?

**Solution:** Host token

```typescript
// On session creation, host receives secret token
{
  sessionId: 'rio-abc123',
  code: '847-293',
  hostToken: 'secret-token-xyz'  // Only shown to host
}

// Host includes token in moderation actions
ws.send({
  type: 'participant-kick',
  participantId: 'bob-123',
  hostToken: 'secret-token-xyz'  // Server validates
});
```

**Storage:**

```typescript
// Stored in extension's service worker memory
// Not persisted to disk
sessionStorage.setItem('hostToken', token);
```

### 4.3 Future: OAuth Integration

Post-MVP enhancement:

- Link session to GitHub/Google account
- Verify participants belong to org
- Auto-approve based on email domain

```typescript
interface OAuthSession {
  provider: 'github' | 'google';
  allowedOrg: 'my-company';
  requireVerification: true;
}
```

---

## 5. Threat Model

### 5.1 Threats & Mitigations

**Threat: Session Code Guessing**

- **Attack:** Brute-force 6-digit codes (1,000,000 combinations)
- **Mitigation:**
  - Rate limit join attempts (max 5 per minute per IP)
  - Require CAPTCHA after 3 failed attempts
  - Use approval mode for sensitive sessions

**Threat: Malicious Participant**

- **Attack:** Spam questions, team chat, or votes
- **Mitigation:**
  - Host can kick or mute participants
  - Rate limits on question submission (5 per 5 minutes)
  - Vote rate limits (20 per minute)
  - Server-side validation

**Threat: Eavesdropping on Session**

- **Attack:** Intercept WebSocket messages
- **Mitigation:**
  - TLS encryption (wss://)
  - Optional E2EE for sensitive sessions
  - Ephemeral sessions (no server-side persistence)

**Threat: Host Impersonation**

- **Attack:** Participant tries to send moderation commands
- **Mitigation:**
  - Host token validation on backend
  - WebSocket origin validation
  - Role-based access control

**Threat: XSS via Question Content**

- **Attack:** Submit question with `<script>alert('xss')</script>`
- **Mitigation:**
  - Sanitize all user input before rendering
  - Use React's built-in XSS protection
  - Content Security Policy (CSP)

### 5.2 Security Best Practices

**Input sanitization:**

```typescript
import DOMPurify from 'dompurify';

function sanitizeQuestion(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [],  // Strip all HTML
    ALLOWED_ATTR: []
  });
}
```

**Rate limiting:**

```typescript
// Server-side rate limiter
class RateLimiter {
  private attempts = new Map<string, number[]>();

  isAllowed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const userAttempts = this.attempts.get(key) || [];

    // Remove old attempts outside window
    const recentAttempts = userAttempts.filter(t => now - t < windowMs);

    if (recentAttempts.length >= maxAttempts) {
      return false;
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }
}

// Usage
if (!rateLimiter.isAllowed(userId, 5, 300000)) {
  throw new Error('Too many questions. Try again in 5 minutes.');
}
```

**CSP Header:**

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  connect-src 'self' wss://backend.rio.app;
  img-src 'self' data:;
  style-src 'self' 'unsafe-inline';
```

---

## 6. Privacy Features

### 6.1 Anonymous Mode (Future)

Allow participants to join without revealing identity:

```typescript
interface Participant {
  id: string;
  name: string;              // "Anonymous User 1"
  isAnonymous: boolean;
  anonymousId?: string;      // Stable across questions
}
```

**Use case:** Ask "dumb" questions without social pressure

### 6.2 Private Questions (Future)

Submit questions only host can see:

```typescript
interface Question {
  visibility: 'public' | 'host-only';
}
```

**Use case:** Sensitive topics in educational sessions

### 6.3 Incognito Sessions

Session that leaves no trace:

```typescript
interface SessionConfig {
  incognito: boolean;  // No local storage, no exports
}
```

**Behavior:**
- No session history saved
- No export allowed
- All data deleted immediately on session end

---

## 7. Compliance

### 7.1 GDPR Considerations

**Data minimization:**
- Collect only display name (no email, no auth)
- No tracking or analytics by default
- User can opt-in to telemetry

**Right to deletion:**
- Sessions auto-delete after 24h
- User can clear extension storage anytime
- No server-side chat persistence

**Right to export:**
- User can export session transcript as JSON
- Includes all questions, votes, and messages
- Export is local (no upload to server)

### 7.2 Chrome Web Store Policies

**Privacy policy required:**
- Disclose data collected (session code, display name)
- Explain WebSocket usage
- No third-party analytics (unless opt-in)

**Permissions justification:**
- `storage`: For user preferences
- `activeTab`: For content script injection
- `webSockets`: For real-time collaboration

---

**Next:** [Implementation Roadmap →](implementation.md) | **Back to:** [Voting System](voting-system.md)
