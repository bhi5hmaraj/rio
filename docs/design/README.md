# Rio Extension - Design Documentation

This directory contains the comprehensive design documentation for the Rio Chrome Extension.

## Navigation

### Core Documents

1. **[Overview & Vision](00-overview.md)** - Executive summary, problem statement, and product vision
2. **[Architecture](01-architecture.md)** - System architecture, component model, and data flow
3. **[Text Anchoring](02-anchoring.md)** - Robust text anchoring using Hypothesis approach
4. **[AI Integration](03-ai-integration.md)** - LLM integration, prompts, and analysis strategies
5. **[UI/UX Design](04-ui-ux.md)** - Side panel, visualization, and user interactions
6. **[Security & Privacy](05-security-privacy.md)** - BYOK model, permissions, and compliance
7. **[Data Models](06-data-models.md)** - Storage schemas, message formats, and APIs
8. **[Implementation Plan](07-implementation.md)** - Roadmap, code structure, and rollout strategy
9. **[Lessons Learned](08-learnings.md)** - Key insights from prototyping phase
10. **[Hypothesis Insights](09-hypothesis-insights.md)** - Reverse engineering findings and dependency strategy
11. **[Backend Server](10-backend-server.md)** - Optional self-hosted backend for storage, RAG, and advanced features

### Quick Reference

- **What is Rio?** See [Overview](00-overview.md#executive-summary)
- **How does it work?** See [Architecture](01-architecture.md#data-flow)
- **What are the key technical decisions?** See [Lessons Learned](08-learnings.md)
- **How do I start building?** See [Implementation Plan](07-implementation.md#phase-1)

## Document Status

- **Version:** 1.0 (Draft)
- **Last Updated:** November 2025
- **Status:** Active Development

## Design Principles

### Doc Length Guidelines
- **Target:** 400-500 lines maximum per document
- **Rationale:** Keeps docs scannable and focused
- **If over 500 lines:** Split into modular subdocuments or move implementation details to separate files

### Modularity
- Each doc should have a single, clear focus
- Reference other docs rather than duplicating content
- Use `docs/design/implementation/` for detailed code examples
- Use `docs/design/reference/` for large schemas or API specs

## Contributing

When updating design docs:
1. Keep documents under 500 lines (400-500 ideal)
2. Make documents modular and focused on their specific domain
3. Move detailed implementations to `implementation/` subdirectory
4. Cross-reference related sections using relative links
5. Update this README if adding new documents
6. Maintain consistency in terminology across all docs
