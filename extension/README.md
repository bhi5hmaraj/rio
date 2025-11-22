# Rio Chrome Extension

AI-powered conversation annotation for ChatGPT.

## Development

### Prerequisites

- Node.js >=18.0.0
- npm >=9.0.0

### Setup

```bash
# Install dependencies
npm install

# Start development build (watch mode)
npm run dev

# Build for production
npm run build
```

### Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run linter
npm run lint

# Format code
npm run format
```

### Loading the Extension

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist/` directory

### Project Structure

```
extension/
├── src/
│   ├── background/      # Service Worker
│   ├── content/         # Content Scripts (ChatGPT page)
│   │   └── scrapers/    # Platform-specific scrapers
│   ├── sidepanel/       # Side Panel UI (React)
│   ├── shared/          # Shared utilities and types
│   └── __tests__/       # Unit tests
├── e2e/                 # E2E tests (Playwright)
├── public/              # Static assets
│   ├── manifest.json
│   └── icons/
├── dist/                # Build output (gitignored)
└── package.json
```

### Architecture

See [ADR-001](../docs/adr/001-mvp-architecture.md) for detailed architecture decisions.

**Key components:**

- **Service Worker** (`src/background/`): Handles API calls, storage, message passing
- **Content Script** (`src/content/`): Runs on ChatGPT, handles DOM manipulation
- **Side Panel** (`src/sidepanel/`): React UI for annotations and controls
- **Scrapers** (`src/content/scrapers/`): Platform-specific conversation extraction

### Testing Strategy

**Unit Tests (Jest):**
- Utilities, selectors, state management
- Run on every commit
- Coverage target: >70%

**E2E Tests (Playwright):**
- Full user flows
- Selector regression detection
- Run before releases

### Week 1 Status (Current)

✅ Foundation complete:
- Manifest.json with MV3 + Side Panel API
- Build system (Vite + TypeScript)
- Side Panel React shell
- Service Worker with message passing
- Content Script with basic injection
- Jest + Playwright configured
- ESLint + Prettier configured

Next: Week 2 - ChatGPT scraper + export feature
