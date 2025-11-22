# Security & Privacy

**Status:** Draft v1.0
**Last Updated:** November 2025

## Core Principles

Rio is built with **privacy-first** architecture:

1. **Bring Your Own Key (BYOK):** Users provide their own API keys
2. **No Backend:** Zero Rio-owned servers; all processing is client-side
3. **No Analytics:** No tracking, telemetry, or usage data collection
4. **Local Storage:** Annotations stored in browser only (unless user enables sync)
5. **Open Source:** Full code transparency for security audits

## Chrome Web Store Compliance

### Permission Justification

We request **minimal permissions** and provide clear justification:

| Permission | Justification | CWS Requirement |
|------------|---------------|-----------------|
| `sidePanel` | Required for main UI | ✅ Core functionality |
| `storage` | Store API keys and annotations locally | ✅ Core functionality |
| `activeTab` | Read current page content when user clicks analyze | ✅ On-demand only |
| `scripting` | Inject content script to highlight text | ✅ User-initiated |
| `host_permissions` (Gemini API) | Make API calls to user's Gemini account | ⚠️ Requires Privacy Policy |
| `host_permissions` (ChatGPT/Gemini sites) | Scrape conversation for analysis | ⚠️ Requires justification |

### Privacy Policy (Required)

**Key Points to Address:**

1. **What data is collected?**
   - Page content (only when user clicks "Analyze")
   - User-entered API keys (encrypted in local storage)
   - Annotations and graphs (local storage only)

2. **How is data used?**
   - Page content sent to **user's Gemini API account** (not Rio servers)
   - API keys used to authenticate with Google Gemini
   - Annotations displayed in Side Panel and used for highlighting

3. **Who has access to data?**
   - **User only:** Data never leaves browser except to user's API provider
   - **Google (via Gemini API):** Governed by Google's API Terms of Service
   - **Rio maintainers:** Zero access (we have no backend)

4. **Data retention:**
   - Local storage: Until user clears browser data
   - API provider: See Google Gemini ToS
   - Rio servers: N/A (we have no servers)

5. **Third-party services:**
   - Google Gemini API (user's account)
   - Optional: OpenAI, Anthropic (future)
   - No advertising, analytics, or tracking services

**Full Policy:** See `docs/PRIVACY_POLICY.md`

### Single Purpose Compliance

**Extension Purpose (from CWS listing):**
> "Rio analyzes AI conversations for hallucinations, bias, and logical flaws using your own Gemini API key. It highlights problematic text and visualizes concepts as an interactive graph."

**Single Purpose Statement:**
> "AI conversation analysis and concept visualization"

All features must align with this purpose:
- ✅ Analyze page content for critique → **Aligned**
- ✅ Highlight text on page → **Aligned**
- ✅ Visualize concepts as graph → **Aligned**
- ✅ Chat interface for interaction → **Aligned**
- ❌ Auto-fill forms, scrape emails → **Not aligned, excluded**

## Data Security

### API Key Storage

**Encryption:** API keys are stored encrypted using Web Crypto API.

```typescript
async function encryptAPIKey(key: string, userPin: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(userPin),
    { name: "PBKDF2" },
    false,
    ["deriveCryptoKey"]
  );

  const cryptoKey = await crypto.subtle.deriveCryptoKey(
    {
      name: "PBKDF2",
      salt: enc.encode("rio-salt-v1"), // In production: random salt per user
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    enc.encode(key)
  );

  return JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  });
}
```

**Storage:**
```typescript
await chrome.storage.local.set({
  apiKey_encrypted: encryptedKey,
  apiKey_iv: iv
});
```

**Alternative (Simple):** For v1, we may use `chrome.storage.local` directly (it's encrypted by Chrome) and defer custom encryption to v2.

### Content Security Policy (CSP)

**Side Panel (extension page):**
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

This allows:
- ✅ React and bundled scripts
- ✅ WebAssembly (if needed for graph layout)
- ❌ Inline scripts (`'unsafe-inline'`)
- ❌ `eval()` (`'unsafe-eval'`)

### Secure Communication

**Message passing:**
```typescript
// Content Script → Background (validate sender)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab) {
    console.error('Message not from tab');
    return;
  }

  // Validate message structure
  if (!isValidMessage(message)) {
    console.error('Invalid message format');
    return;
  }

  handleMessage(message, sender.tab.id);
});
```

**API calls:**
- Always use HTTPS for Gemini API
- Validate responses before parsing
- Timeout after 30s to prevent hanging requests

## User Data Privacy

### What We Never Collect

❌ Browsing history
❌ Personal identifiable information (PII)
❌ Conversation content (beyond user-initiated analysis)
❌ Usage analytics or telemetry
❌ IP addresses or device fingerprints

### What Users Can Export

✅ Annotations (JSON)
✅ Concept graphs (JSON/SVG/PNG)
✅ Settings (including API key for backup)

**Export Format:**
```json
{
  "version": "1.0",
  "exportDate": "2025-11-22T10:30:00Z",
  "annotations": [ /* ... */ ],
  "graphs": [ /* ... */ ],
  "settings": {
    "apiKey": "REDACTED",
    "theme": "dark",
    "enableSearch": true
  }
}
```

### Data Deletion

**User-Initiated:**
- Settings → "Clear all data" button
- Clears: API keys, annotations, graphs, settings
- Irreversible (no backup)

**Uninstall Cleanup:**
```typescript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    // Migrate data if schema changed
    migrateStorage(details.previousVersion);
  }
});

// Note: chrome.storage persists after uninstall
// Users must manually clear via browser settings
```

## Attack Surface Analysis

### Potential Threats

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **API Key Theft** | Attacker uses user's Gemini quota | Encrypt keys, use chrome.storage (encrypted at rest) |
| **XSS via Annotation** | Malicious script in annotation text | Sanitize all user input, use `textContent` not `innerHTML` |
| **Malicious Page** | Page tricks extension into leaking data | Validate all messages, never trust page content |
| **Man-in-the-Middle** | Intercept API calls | Always use HTTPS, validate certificates |
| **Side-Channel** | Timing attacks to infer annotations | Not applicable (local-only data) |

### Security Best Practices

1. **Input Sanitization:**
   ```typescript
   function sanitizeAnnotation(text: string): string {
     return text
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;');
   }
   ```

2. **Output Encoding:**
   ```typescript
   // Always use textContent for user input
   element.textContent = annotation.quote; // ✅ Safe
   element.innerHTML = annotation.quote;   // ❌ XSS risk
   ```

3. **Origin Validation:**
   ```typescript
   function isAllowedOrigin(url: string): boolean {
     const allowed = [
       'https://chat.openai.com',
       'https://gemini.google.com',
       'https://claude.ai'
     ];
     return allowed.some(origin => url.startsWith(origin));
   }
   ```

4. **Rate Limiting:**
   ```typescript
   const RATE_LIMIT = 10; // analyses per minute
   const analysisTimestamps: number[] = [];

   function canAnalyze(): boolean {
     const now = Date.now();
     const recentAnalyses = analysisTimestamps.filter(t => now - t < 60000);

     if (recentAnalyses.length >= RATE_LIMIT) {
       return false;
     }

     analysisTimestamps.push(now);
     return true;
   }
   ```

## Compliance & Legal

### Open Source License

**Recommended:** MIT License

**Rationale:**
- Permissive (allows commercial use)
- Simple and well-understood
- Compatible with React, CopilotKit licenses

**Key Points:**
- No warranty or liability
- Users responsible for API costs
- Derivatives must include copyright notice

### Terms of Service

**Key Clauses:**

1. **User Responsibility:**
   > "You are responsible for all API costs incurred through your Gemini account."

2. **No Service Level Agreement (SLA):**
   > "Rio is provided 'as-is' with no uptime guarantees."

3. **Content Disclaimer:**
   > "AI-generated critiques may be incorrect. Always verify claims independently."

4. **Export Restrictions:**
   > "Do not use Rio to analyze classified or export-controlled content."

### GDPR Compliance

**Data Controller:** None (we process no personal data)

**User Rights:**
- Right to access: Users have full access via export
- Right to deletion: "Clear all data" button
- Right to portability: JSON export format
- Right to rectification: Users can edit annotations

**Legal Basis:** Not applicable (no personal data processing)

## Security Audit Checklist

Before v1.0 release:

- [ ] All user input sanitized
- [ ] No `innerHTML` usage with untrusted content
- [ ] API keys encrypted or Chrome storage-only
- [ ] HTTPS-only API calls
- [ ] Origin validation for messages
- [ ] No tracking or analytics code
- [ ] Privacy policy published
- [ ] Open source repository public
- [ ] Dependency audit (npm audit)
- [ ] CSP policy validated
- [ ] Rate limiting implemented
- [ ] Error messages don't leak sensitive data

## Responsible Disclosure

**Security Issues:** [security@rio-extension.dev](mailto:security@rio-extension.dev) (or GitHub Security Advisory)

**Response Time:**
- Critical: 24 hours
- High: 72 hours
- Medium: 1 week

**Disclosure Policy:** 90 days or until fix is deployed

---

**Previous:** [← UI/UX Design](04-ui-ux.md) | **Next:** [Data Models →](06-data-models.md)
