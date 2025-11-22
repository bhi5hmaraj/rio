# Multiplayer Overview & User Roles

**Status:** Draft v1.0
**Last Updated:** November 2025

## Vision

Enable multiple users to **collaboratively interact** with ChatGPT/Claude through a single shared chat session, with **democratic question voting** and **host moderation**.

### The Problem

AI chat interfaces like ChatGPT and Claude are designed for single-user interaction. When teams want to collaborate on AI-assisted problem-solving, they face challenges:
- Only one person can control the chat at a time
- Others must wait for their turn or interrupt
- Questions get lost or forgotten
- No systematic way to prioritize which questions to ask

### The Solution

Rio Multiplayer transforms single-user AI chats into collaborative sessions where:
- **Everyone can submit questions** to a shared queue
- **Democratic voting** determines priority
- **Host moderates** and has final say
- **Real-time sync** keeps everyone on the same page
- **No API required** for participants (only host needs account)

---

## Core Principle

**"UI Hijacking"** — Rio hijacks the web UI of existing chat applications (ChatGPT, Claude) and enables multiplayer interaction without requiring:
- API access or tokens
- Custom backend infrastructure
- Rebuilding the chat interface
- Participants to have their own accounts

### How It Works

1. **Host** opens ChatGPT/Claude in their browser
2. **Rio extension** detects the platform and injects controls
3. **Multiplayer session** created via lightweight backend relay
4. **Participants** join via code (can be on any webpage)
5. **Questions flow** through democratic voting to host's chat input
6. **Responses** broadcast back to all participants in real-time

---

## User Roles

### Host (Session Owner)

**Definition:** The user who owns the ChatGPT/Claude account and creates the multiplayer session.

**Responsibilities:**
- ✅ Owns the ChatGPT or Claude account and browser session
- ✅ Creates multiplayer session and shares join code
- ✅ Reviews question queue and casts votes
- ✅ Selects which question to send to the AI
- ✅ Has final say (can edit questions before sending)
- ✅ Can reject questions or skip them
- ✅ Can kick or mute disruptive participants
- ✅ Can pause or end the session

**Requirements:**
- Must have active **ChatGPT** (Plus or Free) or **Claude** account
- Must keep **browser tab open** during the session (DOM monitoring required)
- Must have **Rio extension installed**
- Must be on the actual chat platform (chat.openai.com or claude.ai)

**Capabilities:**
- **Vote weight:** Can be configured (e.g., host votes count 2x)
- **Veto power:** Can reject any question regardless of votes
- **Edit questions:** Can modify text before sending to AI
- **Send control:** Rio auto-fills input, but host presses send (maintains control)

**Limitations:**
- Cannot leave the chat tab (session ends if they navigate away)
- Cannot delegate host role mid-session (MVP limitation)
- Responsible for AI account quota/rate limits

---

### Participant (Contributor)

**Definition:** A user who joins a multiplayer session to contribute questions and vote, without needing their own AI account.

**Responsibilities:**
- ✅ Joins session via shared code or link
- ✅ Submits questions to the queue
- ✅ Votes on other participants' questions (upvote/downvote)
- ✅ Views live chat updates as conversation progresses
- ✅ Participates in team chat (side channel for discussion)
- ✅ Follows session etiquette

**Requirements:**
- Must have **Rio extension installed**
- Does **NOT** need ChatGPT or Claude account
- Can be on **any webpage** (doesn't need to be on chat platform)
- Must have **session code** (6-digit numeric code)

**Capabilities:**
- **Submit unlimited questions** (configurable by host)
- **Vote freely:** Upvote (+1) or downvote (-1) on any question
- **Real-time visibility:** See chat history, question queue, and who's online
- **Team chat:** Discuss questions privately before submitting
- **Passive mode:** Can "lurk" without submitting questions

**Limitations:**
- Cannot send messages directly to AI (must go through queue)
- Cannot see host's edits until message is sent
- No moderation powers (cannot kick others)
- Session ends if host closes their browser tab

---

## Role Comparison

| Feature | Host | Participant |
|---------|------|-------------|
| **Needs AI Account** | ✅ Yes (ChatGPT/Claude) | ❌ No |
| **Must be on chat platform** | ✅ Yes (chat.openai.com) | ❌ No (any page) |
| **Create session** | ✅ Yes | ❌ No (only join) |
| **Submit questions** | ✅ Yes | ✅ Yes |
| **Vote on questions** | ✅ Yes (weighted) | ✅ Yes (standard) |
| **Select question to send** | ✅ Yes | ❌ No |
| **Edit questions** | ✅ Yes (before send) | ❌ No |
| **Reject questions** | ✅ Yes | ❌ No |
| **Kick participants** | ✅ Yes | ❌ No |
| **End session** | ✅ Yes | ❌ No (can leave) |
| **See team chat** | ✅ Yes | ✅ Yes |
| **View live responses** | ✅ Yes | ✅ Yes |

---

## Use Cases

### Scenario 1: Team Brainstorming

**Setup:**
- Alice (host) has ChatGPT Plus
- Bob, Charlie, and Dave (participants) join her session
- Goal: Brainstorm product features

**Flow:**
1. Alice starts session on chat.openai.com
2. Team joins via code, submits feature questions
3. Everyone votes on which to explore first
4. Alice sends top-voted question
5. Team discusses GPT's response in team chat
6. Repeat for next question

**Benefit:** Structured, democratic exploration of ideas

---

### Scenario 2: Collaborative Coding

**Setup:**
- Developer (host) uses Claude for code review
- Junior devs (participants) ask clarifying questions

**Flow:**
1. Host pastes code into Claude
2. Juniors submit questions about the code
3. Host prioritizes based on votes + pedagogical value
4. Everyone learns from Claude's explanations

**Benefit:** Educational, mentorship-friendly

---

### Scenario 3: Research Team

**Setup:**
- Researcher (host) with GPT-4
- Team members (participants) from different time zones

**Flow:**
1. Questions accumulated asynchronously
2. Host reviews queue when available
3. Votes guide which research questions to prioritize
4. Session transcript shared later

**Benefit:** Async-friendly, democratic research

---

## Session Lifecycle

### 1. Creation Phase
- Host clicks "Start Multiplayer Session" in Rio extension
- Rio generates:
  - **Session ID:** `rio-abc123`
  - **Join Code:** `847-293` (6-digit numeric)
  - **Join Link:** `rio.app/join/847-293`
- Host shares code with team via Slack/Discord/Email

### 2. Active Phase
- Participants join and see real-time chat history
- Questions submitted, voted, and sent
- Host moderates and sends to AI
- Responses broadcast to all

### 3. End Phase
- **Host ends session:** Explicit "End Session" button
- **Auto-expire:** 24 hours max session duration
- **Host leaves:** Session ends if host closes tab
- **All participants leave:** Session remains active (host might return)

---

## Design Philosophy

### Democratic but Moderated

- **Democratic:** Everyone has equal voice through voting
- **Moderated:** Host retains control and final decision-making
- **Transparent:** All votes and queue changes visible to everyone

### Minimal Barrier to Entry

- **Participants don't need accounts:** Only host needs ChatGPT/Claude
- **No configuration:** Join with 6-digit code, start contributing
- **Platform agnostic:** Works wherever Rio extension is installed

### Host-Preserving

- **Host always in control:** Rio never auto-sends without host approval
- **Host can edit:** Questions are suggestions, not commands
- **Host can veto:** Reject questions regardless of votes

---

**Next:** [Workflows →](workflows.md) | **Back to:** [Multiplayer Home](README.md)
