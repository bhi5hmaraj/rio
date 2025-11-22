# Overview & Vision

**Status:** Draft v1.0
**Last Updated:** November 2025

## Executive Summary

**Rio** is an open-source Chrome Extension that acts as a "Radar Intercept Officer" (RIO/RSO) for AI conversations. While the user (the Pilot) flies the conversation in ChatGPT or other AI interfaces, Rio sits in the back seat (the Chrome Side Panel), actively scanning the chat for hallucinations, bias, and missed nuances.

Rio is a Chrome extension that analyzes web pages and chat conversations in real-time, extracting concepts to build a **Concept DAG** (Directed Acyclic Graph) rendered in a persistent **side-panel HUD**. The HUD hosts a React app with **CopilotKit** (for agent actions) and **React Flow** (for graph visualization).

Unlike passive tools, Rio is **agentic**:
- Scrapes conversations in real-time
- Cross-references claims using Google Search (via Gemini)
- Highlights debatable text directly in the chat interface
- Visualizes conversation structure as an interactive graph
- Provides AI-powered analysis and annotations

Rio operates on a **"Bring Your Own Key" (BYOK)** model, ensuring user privacy and zero infrastructure costs for maintainers.

## Problem Statement

Large Language Models (LLMs) like ChatGPT are powerful but prone to:

1. **Hallucinations:** Stating falsehoods confidently
2. **Sycophancy:** Agreeing with the user even when the user is wrong
3. **Bias:** Non-neutral perspectives that go unnoticed
4. **Complexity:** Long conversations become difficult to track mentally
5. **Lost Context:** Important concepts and relationships get buried in conversation flow

Existing solutions are either:
- Fully separate chat apps (disconnecting you from your workflow)
- Simple overlay scripts that break due to Content Security Policies (CSP) and DOM fragility
- Server-dependent tools that compromise privacy and require infrastructure

## Core Value Propositions

### 1. Real-Time AI Critique
- Analyzes AI responses for logical flaws, factual errors, and bias
- Uses Google Search grounding for fact-checking
- Highlights problematic text directly in the interface

### 2. Concept Visualization
- Extracts key concepts from conversations
- Maps relationships as an interactive DAG
- Enables mental model building and conversation navigation

### 3. Privacy-First Architecture
- **BYOK (Bring Your Own Key):** Users provide their own API keys
- **Local Execution:** Data flows `Browser ↔ Google API` only
- **No Analytics:** Zero tracking or telemetry
- **No Server:** All processing happens client-side

### 4. Robust & Non-Invasive
- Uses Chrome Side Panel (immune to page CSP/Trusted-Types)
- Hypothesis-style text anchoring (survives DOM changes)
- Works across ChatGPT, Gemini, and other AI interfaces

## Goals & Non-Goals

### Goals

- **Modular Architecture:** Composable components that can be swapped/upgraded independently
- **Robust Anchoring:** Text highlighting that survives DOM drift (quote + position + fuzzy matching)
- **Fast Iteration:** Mocked local pipelines first; optional server-side analysis later
- **Great UX:** Side panel with zoomable DAG, export (SVG/JSON), and Copilot chat
- **Privacy & Transparency:** Open source, client-side processing, user-controlled API keys
- **Cross-Platform:** Works on ChatGPT, Gemini, Claude, and generic web pages

### Non-Goals

- **Forking Entire Annotation UIs:** Not rebuilding Hypothesis sidebar; Side Panel is our UI surface
- **Complex Page Injection:** No injecting complex UI into hostile pages (CSP issues)
- **Providing API Services:** We don't host LLM infrastructure; users bring their own keys
- **Real-Time Collaboration:** v1 focuses on single-user analysis
- **Mobile Support:** Chrome Extension desktop only (for now)

## Target Users

### Primary
- **Power Users of AI:** People who have extended, complex conversations with ChatGPT/Claude
- **Researchers & Analysts:** Those who need to track concepts across long AI interactions
- **Critical Thinkers:** Users who want to verify AI claims and spot bias

### Secondary
- **Developers:** Building on top of Rio's architecture for custom analysis
- **Educators:** Teaching critical thinking with AI tools
- **Privacy Advocates:** Users who want client-side AI tooling

## Success Metrics

### Adoption
- Chrome Web Store installations
- GitHub stars and community engagement
- Active users (measured via opt-in telemetry if added later)

### Utility
- Average highlights per conversation
- DAG exports per session
- User retention (return usage after 7 days)

### Quality
- Anchor resolution success rate (>95%)
- False positive rate for hallucination detection
- User-reported bugs vs. features

## Open Questions

1. **PDF Support:** Do we want PDF text-layer analysis in v1 (requires PDF.js integration)?
2. **Graph Rendering:** Server-rendered SVG vs. client layout - which is primary for large graphs?
3. **Data Sync:** Local-only storage vs. optional cloud sync for annotations?
4. **LLM Provider Support:** Should we support OpenAI, Anthropic, or stay Gemini-focused?
5. **Collaboration:** Future multi-user annotation sharing?

---

**Next:** [Architecture →](01-architecture.md)
