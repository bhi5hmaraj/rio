# Rio Multiplayer Feature Documentation

**Status:** Draft v1.0
**Last Updated:** November 2025
**Original Document:** [Archive](../archive/multiplayer_design_original.md)

## Overview

The Rio Multiplayer feature enables collaborative AI chat sessions where multiple users can interact with ChatGPT/Claude through a single shared session. The system implements democratic question voting with host moderation, operating through the browser extension without requiring API access.

**Key Innovation:** Rio "hijacks" existing chat UIs (ChatGPT, Claude) to enable multiplayer interaction, eliminating the need for custom backend infrastructure or API keys for participants.

---

## Documentation Structure

This feature is documented across multiple focused documents:

### Core Concepts

1. **[Overview & User Roles](overview.md)** (~150 lines)
   - Vision and core principles
   - Host and Participant responsibilities
   - Requirements and capabilities

2. **[Workflows](workflows.md)** (~250 lines)
   - Session creation and joining
   - Question submission and voting flow
   - Host selection and send process
   - Question lifecycle

### Technical Design

3. **[Architecture](architecture.md)** (~350 lines)
   - Component overview (Content Script, Background Worker, Side Panel)
   - Platform adapters (ChatGPT, Claude)
   - WebSocket protocol and message types
   - State management

4. **[UI Design](ui-design.md)** (~300 lines)
   - Host UI specifications
   - Participant UI specifications
   - Browser overlays and controls
   - Visual mockups

5. **[Voting System](voting-system.md)** (~150 lines)
   - Voting rules and mechanics
   - Queue sorting algorithms
   - Host vote weighting
   - Tie-breaking logic

### Integration & Implementation

6. **[Backend Integration](integration.md)** (~300 lines)
   - How multiplayer uses the Rio backend server
   - WebSocket server requirements
   - Extension integration points
   - Data flow between components

7. **[Security & Privacy](security.md)** (~200 lines)
   - Session access control
   - Data privacy considerations
   - Optional end-to-end encryption
   - Threat model

8. **[Implementation Roadmap](implementation.md)** (~250 lines)
   - 5-week development plan
   - Success metrics
   - Edge cases and solutions
   - Testing strategy

---

## Quick Reference

### Key Features

- **Democratic Question Voting:** All participants can submit and vote on questions
- **Host Moderation:** Final control remains with account owner
- **Real-Time Sync:** WebSocket-based live updates
- **Platform Agnostic:** Works with ChatGPT and Claude
- **No API Required:** Participants don't need their own accounts
- **Team Chat:** Separate channel for participant discussion

### User Roles

| Role | Needs Account? | Can Do |
|------|---------------|--------|
| **Host** | Yes (ChatGPT/Claude) | Create session, select questions, send to AI, moderate |
| **Participant** | No | Submit questions, vote, view chat, discuss with team |

### Data Flow

```
Participant → Submit Question → Queue (All users)
                                      ↓
                               Everyone votes
                                      ↓
                           Host selects winner
                                      ↓
                     Rio injects into chat input
                                      ↓
                            Host sends to AI
                                      ↓
                        Response → All participants
```

---

## Integration with Rio Core

### Extension Integration

Multiplayer builds on the core Rio extension:
- **Uses existing Side Panel** for multiplayer UI
- **Leverages content scripts** for DOM manipulation
- **Extends background worker** for WebSocket management
- **Reuses scrapers** for platform detection

See: [Extension Architecture](../01-architecture.md)

### Backend Integration

Multiplayer requires the optional Rio backend server:
- **WebSocket relay:** Real-time message broadcasting
- **Session management:** Create, join, and expire sessions
- **No persistence:** Minimal server (messages not stored)
- **Scalable:** Redis pub/sub for horizontal scaling

See: [Backend Server Design](../10-backend-server.md)

---

## Development Status

### MVP Features (v1.0)

- [x] Session creation and joining
- [x] Question submission and queue
- [x] Democratic voting system
- [x] Host selection and send controls
- [x] Real-time chat sync
- [x] Platform adapters (ChatGPT, Claude)

### Future Enhancements (v2.0)

- [ ] DAG integration (concept graph collaboration)
- [ ] Persistent sessions (save/resume)
- [ ] Enhanced analytics (question metrics)
- [ ] Multi-host support
- [ ] Advanced moderation tools
- [ ] Annotation collaboration

See: [Implementation Roadmap](implementation.md#future-enhancements)

---

## Quick Links

- **What is multiplayer?** [Overview](overview.md#vision)
- **How do I join a session?** [Workflows](workflows.md#joining-session)
- **How does voting work?** [Voting System](voting-system.md#voting-rules)
- **How does it integrate with the backend?** [Integration](integration.md#backend-server-role)
- **When will this be ready?** [Implementation](implementation.md#timeline)

---

## Design Principles

1. **Democratic but Moderated:** Everyone has a voice, host has final say
2. **Minimal Backend:** Server only relays messages, no persistence
3. **Platform Hijacking:** Leverage existing UIs, don't rebuild them
4. **Progressive Enhancement:** Works with or without advanced features
5. **Privacy-Preserving:** Optional E2EE, no account required for participants

---

**Previous:** [← Backend Server](../10-backend-server.md) | **Home:** [Design Docs](../README.md)
