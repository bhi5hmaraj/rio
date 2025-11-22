# UI/UX Design

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

Rio's UI lives entirely in the **Chrome Side Panel**, a persistent extension page that runs alongside the main browser tab. This design choice bypasses CSP restrictions and provides a professional, native-feeling interface.

## Side Panel Architecture

### Why Side Panel?

**Advantages:**
- ✅ Immune to page CSP/Trusted Types
- ✅ Can use React, external libraries, iframes
- ✅ Persistent across page navigations
- ✅ Native OS-level window controls
- ✅ Doesn't obscure page content

**vs. Alternatives:**
- **Content Script UI:** Blocked by CSP, breaks on hostile pages
- **Popup:** Closes on click-away, poor for long tasks
- **New Tab:** Takes user away from context

### Opening the Side Panel

**User Triggers:**
1. Click extension icon in toolbar → opens Side Panel
2. Keyboard shortcut (configurable): `Ctrl+Shift+R`
3. Right-click context menu: "Analyze with Rio"

**Initial State:**
- Empty state with "Analyze Current Page" CTA
- Settings gear icon (top-right)
- Active tab indicator (shows which site is being analyzed)

## UI Modes (Tabs)

The Side Panel has three primary modes, accessible via tabs:

```
┌─────────────────────────────────────┐
│  Rio                        ⚙️  ×   │
├─────────────────────────────────────┤
│  [📊 Graph] [📝 Annotations] [💬 Chat] │
├─────────────────────────────────────┤
│                                     │
│         (Active Mode Content)       │
│                                     │
└─────────────────────────────────────┘
```

### Mode 1: Graph View (React Flow)

**Purpose:** Visualize the conversation as a Directed Acyclic Graph (DAG) of concepts.

**Features:**
- Interactive node-based canvas (pan, zoom, select)
- Hierarchical or force-directed layout (user toggle)
- Node click → highlights corresponding text in page
- Edge labels showing relationships
- Minimap for navigation (large graphs)
- Toolbar: Fit view, export, layout algorithm selector

**React Flow Configuration:**
```typescript
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState
} from 'reactflow';

function GraphView({ graph }: { graph: ConceptGraph }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      attributionPosition="bottom-right"
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

**Node Types:**

| Type | Visual | Example |
|------|--------|---------|
| **Concept** | Rounded rectangle, mint green | "Neural Networks" |
| **Entity** | Circle, light blue | "GPT-4" |
| **Claim** | Diamond, orange | "AI will replace jobs" |
| **Evidence** | Hexagon, gray | "[Citation: Nature, 2024]" |

**Edge Types:**

| Label | Style | Meaning |
|-------|-------|---------|
| `supports` | Solid green | Node A supports claim B |
| `contradicts` | Dashed red | Node A contradicts B |
| `defines` | Solid blue | Node A defines term B |
| `cites` | Dotted gray | Node A references source B |

**Fallback: Mermaid Static Renderer**

For low-end devices or very large graphs (>200 nodes), offer a toggle to static Mermaid.js SVG:

```typescript
function MermaidRenderer({ graph }: { graph: ConceptGraph }) {
  const mermaidCode = useMemo(() => {
    let code = 'graph TD\n';
    graph.nodes.forEach(n => {
      code += `  ${n.id}["${n.label}"]\n`;
    });
    graph.edges.forEach(e => {
      code += `  ${e.source} -->|${e.label}| ${e.target}\n`;
    });
    return code;
  }, [graph]);

  const svgUrl = `https://mermaid.ink/svg/${btoa(mermaidCode)}`;

  return <img src={svgUrl} alt="Concept Graph" />;
}
```

### Mode 2: Annotations List

**Purpose:** Show all critique annotations in a scannable list.

**Layout:**
```
┌─────────────────────────────────────┐
│ Filters: [All] [Critique] [Factual] │
│          [Sycophancy] [Bias]        │
├─────────────────────────────────────┤
│ 🔵 Critique • 2m ago                │
│ "This assumes correlation implies   │
│  causation..."                      │
│ [Jump to text]                      │
├─────────────────────────────────────┤
│ 🟢 Factual Error • 5m ago           │
│ "GPT-4 was released in 2024"        │
│ Actually: March 2023 [Source]       │
│ [Jump to text]                      │
└─────────────────────────────────────┘
```

**Interactions:**
- **Hover:** Temporarily highlight text in page (via content script)
- **Click "Jump to text":** Scroll page to highlighted span
- **Click annotation:** Expand to show full explanation + search results
- **Right-click:** "Dismiss" or "Report false positive"

**Virtualization:**
For conversations with 100+ annotations, use `react-window`:

```typescript
import { FixedSizeList } from 'react-window';

function AnnotationList({ annotations }: { annotations: Annotation[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <AnnotationCard annotation={annotations[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={annotations.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### Mode 3: Chat (CopilotKit)

**Purpose:** AI-powered copilot for interacting with annotations and graph.

**Features:**
- Natural language commands: "Summarize the main arguments"
- Action execution: "Export graph as SVG"
- Clarification questions: "What does 'sycophancy' mean?"
- Annotation creation: "Add note: this claim needs verification"

**CopilotKit Integration:**
```typescript
import { CopilotKit, CopilotChat } from '@copilotkit/react-core';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-hooks';

function ChatView() {
  // Make current state readable to the agent
  useCopilotReadable({
    description: "Current conversation annotations",
    value: annotations
  });

  useCopilotReadable({
    description: "Concept graph structure",
    value: graph
  });

  // Define actions the agent can trigger
  useCopilotAction({
    name: "analyzeCurrentPage",
    description: "Run critique analysis on the current page",
    handler: async () => {
      await triggerAnalysis();
      return "Analysis complete!";
    }
  });

  useCopilotAction({
    name: "exportGraph",
    description: "Export the concept graph",
    parameters: [
      { name: "format", type: "string", enum: ["svg", "png", "json"] }
    ],
    handler: async ({ format }) => {
      const blob = await exportGraph(format);
      downloadBlob(blob, `rio-graph.${format}`);
      return `Exported as ${format}`;
    }
  });

  return (
    <CopilotKit>
      <CopilotChat />
    </CopilotKit>
  );
}
```

**Agent Actions (Declarative):**

| Action | Parameters | Description |
|--------|------------|-------------|
| `analyzeCurrentPage` | - | Trigger critique loop |
| `summarizeSelection` | - | Summarize user-selected text |
| `addAnnotation` | `text`, `category`, `note` | Manually create annotation |
| `exportGraph` | `format` | Download graph (svg/png/json) |
| `searchConcept` | `conceptId` | Find all mentions of concept |
| `compareMessages` | `msgId1`, `msgId2` | Diff two messages |

## Visual Design

### Color Scheme

**Light Mode:**
- Background: `#FFFFFF`
- Surface: `#F5F5F5`
- Primary (mint): `#10B981`
- Text: `#1F2937`

**Dark Mode:**
- Background: `#1F2937`
- Surface: `#374151`
- Primary (mint): `#34D399`
- Text: `#F9FAFB`

**Critique Category Colors:**
- Critique (logic): `#3B82F6` (blue)
- Factuality: `#10B981` (green)
- Sycophancy: `#F59E0B` (orange)
- Bias: `#EF4444` (red)

### Typography

- **Headers:** Inter, 16px/18px, semibold
- **Body:** Inter, 14px, regular
- **Code:** JetBrains Mono, 13px
- **Graph Labels:** Inter, 12px, medium

### Spacing

- **Padding:** 12px base unit (1.5× = 18px, 2× = 24px)
- **Card gaps:** 16px
- **Section margins:** 24px

## User Workflows

### Workflow 1: First-Time Setup

1. User installs extension from Chrome Web Store
2. Clicks extension icon → Side Panel opens
3. Sees "Welcome to Rio" screen with:
   - "What is Rio?" explainer (30 words)
   - "Add Gemini API Key" button
4. Clicks button → Settings modal opens
5. Pastes API key → "Validate" button
6. Success: "Ready to analyze!"

### Workflow 2: Analyzing a ChatGPT Conversation

1. User opens ChatGPT conversation
2. Clicks Rio icon → Side Panel opens (or already open)
3. Clicks "Analyze Current Page" button
4. Loading state: "Analyzing..." (with progress bar)
5. Results appear:
   - Switches to "Annotations" tab
   - Shows 12 annotations (3 factual, 5 critique, 2 bias, 2 sycophancy)
6. User clicks first annotation
7. Page scrolls to highlighted text
8. Highlight pulses (animation) to draw attention
9. User hovers → tooltip shows full explanation
10. User clicks "Jump to Graph" → switches to Graph tab
11. Graph shows concept DAG with highlighted node

### Workflow 3: Exporting Results

1. User in Graph tab
2. Clicks toolbar "Export" button
3. Dropdown appears: "SVG", "PNG", "JSON"
4. User selects "SVG"
5. Browser downloads `rio-graph-2025-11-22.svg`

**Alternative (via Chat):**
1. User switches to Chat tab
2. Types: "export the graph as PNG"
3. Agent responds: "Exporting..." → downloads file
4. Agent: "Exported as rio-graph-2025-11-22.png"

### Workflow 4: Manual Annotation

1. User selects text on ChatGPT page (native browser selection)
2. Right-clicks → "Add Rio Annotation"
3. Side Panel switches to Chat tab
4. Pre-filled prompt: "Create annotation for: <selected text>"
5. User types: "This claim needs citation"
6. Agent creates annotation → appears in list

## Settings Page

Accessible via gear icon (⚙️) in Side Panel header.

**Sections:**

### API Keys
- Gemini API Key (required)
- OpenAI API Key (optional, future)
- Anthropic API Key (optional, future)
- [How to get an API key →]

### Analysis Options
- ☑ Enable Google Search grounding (recommended)
- ☐ Analyze automatically on page load
- Severity filter: [Low] [Medium] [High]

### Appearance
- Theme: [Auto] [Light] [Dark]
- Highlight opacity: [slider 20-80%]
- Font size: [Small] [Medium] [Large]

### Privacy
- ☑ Store annotations locally only
- ☐ Enable usage analytics (opt-in)
- [Clear all data] button

### Advanced
- Custom system instruction (textarea)
- Model selection: [Gemini 2.5 Flash] [Gemini 2.0 Pro]
- Max tokens: [8192]

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Open/close Side Panel |
| `Ctrl+Shift+A` | Run analysis |
| `Ctrl+Shift+G` | Switch to Graph tab |
| `Ctrl+Shift+L` | Switch to Annotations tab |
| `Ctrl+Shift+C` | Switch to Chat tab |
| `Escape` | Close modals |
| `J` / `K` | Next/previous annotation |
| `Enter` | Jump to highlighted text |

## Responsive Design

**Minimum width:** 300px
**Optimal width:** 400-500px (Chrome Side Panel default)
**Maximum width:** User-resizable up to 800px

**Breakpoints:**
- `width < 350px`: Hide minimap, stack toolbar vertically
- `width < 400px`: Reduce font sizes, compact cards
- `width > 600px`: Show sidebar within Side Panel (for settings)

## Accessibility

### Screen Reader Support
- All buttons have `aria-label`
- Annotations have `role="article"`
- Graph nodes have `aria-describedby` with full description

### Keyboard Navigation
- All interactive elements are focusable
- Focus indicators (2px blue outline)
- Skip links for sections

### Color Contrast
- WCAG AA compliance (4.5:1 for text)
- Pattern + color for critique categories (not color-only)

### Motion
- `prefers-reduced-motion`: Disable animations
- No auto-playing videos or carousels

## Performance

### Lazy Loading
- React Flow only loads when Graph tab is active
- CopilotKit only initializes when Chat tab is active
- Annotations virtualized (100+ items)

### Code Splitting
```typescript
const GraphView = lazy(() => import('./GraphView'));
const ChatView = lazy(() => import('./ChatView'));

function SidePanel() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {activeTab === 'graph' && <GraphView />}
      {activeTab === 'chat' && <ChatView />}
    </Suspense>
  );
}
```

### Bundle Size Targets
- Side Panel bundle: <500KB (gzipped)
- Content Script: <50KB (gzipped)
- Initial load: <1s on 3G

## Future Enhancements

### Collaboration
- Share annotated conversations via URL
- Multi-user annotation with conflict resolution
- Community rubrics (upvote/downvote annotations)

### Advanced Visualization
- Timeline view (conversation flow over time)
- Heatmap (which parts of conversation have most issues)
- 3D graph (for very large concept networks)

### Mobile Extension
- Chrome Mobile side panel (when API becomes available)
- Touch-optimized graph navigation

---

**Previous:** [← AI Integration](03-ai-integration.md) | **Next:** [Security & Privacy →](05-security-privacy.md)
