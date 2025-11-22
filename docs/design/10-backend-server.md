# Backend Server Design

**Status:** Draft v1.0
**Last Updated:** November 2025

## Overview

The Rio Backend Server is an **optional, self-hostable** component that provides advanced features beyond the client-side extension capabilities. While Rio works fully standalone with BYOK (Bring Your Own Key), the backend enables long-term storage, RAG (Retrieval-Augmented Generation) on conversation history, and proactive analysis across all websites.

**Key Principles:**
- ✅ **Optional:** Extension works without backend
- ✅ **Open Source:** MIT licensed, self-hostable
- ✅ **User-Controlled:** Users own their data
- ✅ **Privacy-First:** End-to-end encryption option
- ✅ **Scalable:** From single-user to multi-tenant

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│  Rio Extension (Client)                                 │
│  - Content Script                                       │
│  - Side Panel                                           │
│  - Background Worker                                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTPS (REST + WebSocket)
                 │
┌────────────────▼────────────────────────────────────────┐
│  Rio Backend Server                                     │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   API Layer  │  │  Auth Layer  │  │  WebSocket   │ │
│  │   (FastAPI)  │  │   (JWT)      │  │   (Sync)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│  ┌──────▼──────────────────▼──────────────────▼───────┐ │
│  │           Service Layer (Python)                   │ │
│  │  - Annotation Storage  - RAG Query Engine          │ │
│  │  - Graph Analysis      - Proactive Analysis        │ │
│  └──────┬─────────────────────────────────────────────┘ │
│         │                                                │
│  ┌──────▼───────┐  ┌────────────┐  ┌────────────────┐  │
│  │  PostgreSQL  │  │   Vector   │  │   Redis        │  │
│  │  (Metadata)  │  │   DB       │  │   (Cache)      │  │
│  │              │  │  (Chroma/   │  │                │  │
│  │              │  │   Qdrant)  │  │                │  │
│  └──────────────┘  └────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| API Framework | FastAPI (Python) | Async, type hints, auto-generated docs |
| Database | PostgreSQL 16+ | Robust, JSONB support, full-text search |
| Vector DB | Chroma or Qdrant | Embeddings for RAG, open source |
| Cache | Redis | Session management, rate limiting |
| Auth | JWT + Passkeys | Secure, passwordless option |
| WebSocket | FastAPI WebSockets | Real-time sync, proactive notifications |
| Deployment | Docker Compose | Easy self-hosting |
| Monitoring | Prometheus + Grafana | Open source observability |

---

## Core Features

### 1. Long-Term Annotation Storage

**Problem:** chrome.storage.local has 10MB limit
**Solution:** Unlimited server-side storage with full-text search

**API Endpoints:**
```
POST   /api/v1/annotations          # Create annotation
GET    /api/v1/annotations          # List annotations (paginated, filtered)
GET    /api/v1/annotations/:id      # Get single annotation
PUT    /api/v1/annotations/:id      # Update annotation
DELETE /api/v1/annotations/:id      # Delete annotation
POST   /api/v1/annotations/search   # Full-text search
POST   /api/v1/annotations/sync     # Bulk sync from extension
```

**Storage Schema:**
```sql
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),

  -- W3C Annotation Model (JSONB)
  annotation JSONB NOT NULL,

  -- Indexed fields for fast queries
  target_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(annotation->>'body'->>'value', '') || ' ' ||
      coalesce(annotation->>'target'->>'selector'->>'exact', '')
    )
  ) STORED,

  -- Metadata
  category TEXT,  -- critique, factuality, sycophancy, bias
  severity TEXT,  -- low, medium, high
  orphan BOOLEAN DEFAULT FALSE,

  INDEX idx_user_annotations (user_id, created_at DESC),
  INDEX idx_target_url (target_url),
  INDEX idx_search (search_vector) USING GIN,
  INDEX idx_category (category)
);
```

### 2. RAG on Conversation History

**Use Case:** "What did I learn about neural networks last month?"

**Architecture:**
1. User's conversations → chunked → embedded (OpenAI/Gemini embeddings)
2. Stored in vector DB with metadata (date, URL, concepts)
3. Query: Natural language → embedded → semantic search
4. Results: Relevant conversation snippets + original annotations

**API Endpoints:**
```
POST /api/v1/conversations          # Upload conversation
POST /api/v1/conversations/query    # RAG query
GET  /api/v1/conversations/:id      # Retrieve conversation
```

**Vector DB Schema (Chroma):**
```python
collection = chroma_client.create_collection(
    name="user_conversations",
    metadata={"hnsw:space": "cosine"},
    embedding_function=OpenAIEmbeddingFunction(api_key=user_api_key)
)

# Document format
{
    "id": "msg-123",
    "text": "Neural networks are...",
    "metadata": {
        "conversation_id": "conv-abc",
        "url": "https://chat.openai.com/c/abc",
        "timestamp": "2025-11-20T10:00:00Z",
        "role": "assistant",
        "concepts": ["neural-networks", "backpropagation"]
    },
    "embedding": [0.1, 0.2, ...]  # Auto-generated
}
```

**RAG Query Flow:**
```
User Query: "What did I learn about neural networks?"
    ↓
Embed query → [0.15, 0.22, ...]
    ↓
Search vector DB (top 10 matches)
    ↓
Re-rank by date/relevance
    ↓
Return: [{text, url, timestamp, concepts}, ...]
```

### 3. Proactive Analysis Across All Websites

**Use Case:** Analyze any webpage for bias, not just AI chats

**Features:**
- **Background analysis:** User visits page → server analyzes in background
- **Notifications:** WebSocket push when analysis complete
- **Caching:** Analyze popular pages once, serve to all users
- **Batch processing:** Queue analysis jobs, process during low traffic

**API Endpoints:**
```
POST /api/v1/analyze/page           # Request page analysis
GET  /api/v1/analyze/status/:jobId  # Check analysis status
POST /api/v1/analyze/subscribe      # WebSocket for live updates
```

**Analysis Job Queue (Redis):**
```python
# Job structure
{
    "job_id": "job-123",
    "user_id": "user-456",
    "url": "https://example.com/article",
    "content": "Page text...",
    "analysis_type": "bias_detection",
    "status": "queued",  # queued, processing, complete, failed
    "created_at": "2025-11-22T10:00:00Z"
}

# Worker processes jobs from Redis queue
# Results stored in PostgreSQL + sent via WebSocket
```

### 4. Advanced Graph Analysis

**Features:**
- Concept clustering (similar concepts across conversations)
- Relationship inference (ML-based edge detection)
- Graph evolution over time (track learning journey)
- Cross-conversation concept linking

**API Endpoints:**
```
GET /api/v1/graphs/:conversationId     # Get conversation graph
GET /api/v1/graphs/global              # User's global concept graph
POST /api/v1/graphs/cluster            # Find concept clusters
POST /api/v1/graphs/infer-edges        # ML-based edge detection
```

**Graph Storage:**
```sql
CREATE TABLE concept_nodes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  embedding VECTOR(1536),  -- pgvector extension
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE concept_edges (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES concept_nodes(id),
  target_id UUID REFERENCES concept_nodes(id),
  edge_type TEXT,  -- supports, contradicts, defines
  confidence FLOAT,  -- 0-1, from ML model
  conversation_id UUID
);
```

---

## Authentication & Authorization

### User Management

**Auth Flow:**
```
1. User creates account (email + passkey OR password)
2. Server issues JWT token (7-day expiry)
3. Extension stores token in chrome.storage.local
4. Token auto-refreshed on API calls
5. Optional: End-to-end encryption (user master key)
```

**User Schema:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,

  -- Auth
  password_hash TEXT,  -- bcrypt, nullable (passkey-only users)
  passkey_credential JSONB,  -- WebAuthn credential

  -- Settings
  settings JSONB DEFAULT '{
    "theme": "auto",
    "enableSearch": true,
    "encryptionEnabled": false
  }'::jsonb,

  -- Quotas (for hosted service)
  storage_quota_mb INTEGER DEFAULT 1000,
  api_calls_per_day INTEGER DEFAULT 10000,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);
```

**API Key for Extension:**
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  key_hash TEXT NOT NULL,  -- SHA-256 of API key
  name TEXT,  -- "Chrome Extension - Work Laptop"
  scopes TEXT[] DEFAULT ARRAY['read', 'write'],
  last_used TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE
);
```

### Authorization Levels

| Role | Permissions | Use Case |
|------|-------------|----------|
| `user` | CRUD own annotations, RAG queries | Default |
| `premium` | Unlimited storage, priority analysis | Paid tier |
| `admin` | Manage users, view metrics | Self-hosted admin |

---

## Privacy & Encryption

### End-to-End Encryption (Optional)

**Flow:**
```
1. User enables E2EE in settings
2. Extension generates master key (AES-256)
3. Master key encrypted with user password (PBKDF2)
4. All annotations encrypted client-side before upload
5. Server stores encrypted blobs (can't read content)
6. RAG features disabled (can't embed encrypted text)
```

**Trade-offs:**
- ✅ Zero-knowledge architecture
- ✅ Server breach = data useless
- ❌ No server-side RAG (can't search encrypted text)
- ❌ No proactive analysis

**Implementation:**
```typescript
// Extension (client-side)
async function encryptAnnotation(annotation: Annotation, masterKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(annotation))
  );

  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
    version: 'v1'
  };
}

// Server receives encrypted blob
POST /api/v1/annotations
{
  "encrypted_data": "...",  // Can't decrypt
  "iv": "...",
  "metadata": {             // Unencrypted (for indexing)
    "target_url": "https://chat.openai.com/c/abc",
    "created_at": "2025-11-22T10:00:00Z"
  }
}
```

### Data Retention

**Policies:**
- User-initiated deletion: Immediate (soft delete, hard delete after 30 days)
- Account deletion: All data deleted within 7 days
- Orphaned data cleanup: Quarterly job removes orphaned embeddings
- Backup retention: 30 days for disaster recovery

---

## Deployment

### Self-Hosting (Docker Compose)

**Minimum Requirements:**
- 2 CPU cores
- 4 GB RAM
- 20 GB storage
- Ubuntu 22.04+ or similar

**Quick Start:**
```bash
# Clone repo
git clone https://github.com/yourusername/rio-backend
cd rio-backend

# Configure environment
cp .env.example .env
# Edit .env: Set SECRET_KEY, DATABASE_URL, etc.

# Start services
docker-compose up -d

# Create admin user
docker-compose exec api python manage.py create-admin \
  --email admin@example.com \
  --password secure_password
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://rio:password@db:5432/rio
      - REDIS_URL=redis://redis:6379
      - VECTOR_DB_URL=http://chroma:8000
    depends_on:
      - db
      - redis
      - chroma
    volumes:
      - ./logs:/app/logs

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=rio
      - POSTGRES_USER=rio
      - POSTGRES_PASSWORD=password

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  chroma:
    image: chromadb/chroma:latest
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - ANONYMIZED_TELEMETRY=False

  worker:
    build: ./api
    command: celery -A app.worker worker --loglevel=info
    depends_on:
      - redis
      - db

volumes:
  postgres_data:
  redis_data:
  chroma_data:
```

### Hosted Service (Future)

**For users who don't want to self-host:**
- Free tier: 100MB storage, 1000 API calls/day
- Pro tier: $5/mo - 10GB storage, unlimited API calls
- Team tier: $20/mo - Shared annotations, collaboration

---

## API Reference

### Authentication

**Register:**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "display_name": "John Doe"
}

Response 201:
{
  "user_id": "uuid",
  "api_key": "rio_sk_...",  // For extension
  "jwt_token": "eyJ..."      // For web dashboard
}
```

**Login:**
```http
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "secure_password"
}

Response 200:
{
  "jwt_token": "eyJ...",
  "refresh_token": "...",
  "expires_in": 604800
}
```

### Annotations (Full CRUD)

**See:** [Data Models](06-data-models.md#w3c-web-annotation-data-model) for annotation schema.

**Sync from Extension:**
```http
POST /api/v1/annotations/sync
Content-Type: application/json
Authorization: Bearer rio_sk_...

{
  "annotations": [
    { /* W3C Annotation */ },
    { /* W3C Annotation */ }
  ],
  "last_sync": "2025-11-20T10:00:00Z"
}

Response 200:
{
  "synced": 15,
  "conflicts": [],
  "server_updates": [
    { "id": "...", "modified_at": "..." }
  ]
}
```

### RAG Queries

```http
POST /api/v1/conversations/query
Authorization: Bearer rio_sk_...

{
  "query": "What did I learn about neural networks?",
  "filters": {
    "date_range": {
      "start": "2025-11-01",
      "end": "2025-11-30"
    },
    "urls": ["https://chat.openai.com/*"]
  },
  "limit": 10
}

Response 200:
{
  "results": [
    {
      "text": "Neural networks are computational models...",
      "url": "https://chat.openai.com/c/abc",
      "timestamp": "2025-11-15T14:30:00Z",
      "concepts": ["neural-networks", "deep-learning"],
      "relevance_score": 0.92
    }
  ],
  "query_time_ms": 45
}
```

---

## Roadmap

### Phase 1: Foundation (v0.1)
- [ ] Basic API (FastAPI + PostgreSQL)
- [ ] User authentication (JWT)
- [ ] Annotation CRUD
- [ ] Docker Compose deployment

### Phase 2: Storage & Sync (v0.5)
- [ ] Full-text search
- [ ] Extension sync API
- [ ] Conflict resolution
- [ ] Rate limiting

### Phase 3: RAG (v1.0)
- [ ] Vector DB integration (Chroma)
- [ ] Conversation upload
- [ ] RAG query endpoint
- [ ] Embedding generation

### Phase 4: Proactive Analysis (v1.5)
- [ ] WebSocket support
- [ ] Background analysis queue
- [ ] Cross-website analysis
- [ ] Caching layer

### Phase 5: Advanced Features (v2.0)
- [ ] End-to-end encryption
- [ ] Graph clustering
- [ ] ML-based edge inference
- [ ] Multi-user collaboration

---

## Monitoring & Operations

### Health Checks
```
GET /health
GET /health/db
GET /health/redis
GET /health/vector-db
```

### Metrics (Prometheus)
- Request latency (p50, p95, p99)
- API endpoint usage
- Database query performance
- Vector DB search times
- Queue depth (analysis jobs)
- Active WebSocket connections

### Logging
```python
# Structured logging (JSON)
{
  "timestamp": "2025-11-22T10:00:00Z",
  "level": "INFO",
  "user_id": "uuid",
  "endpoint": "/api/v1/annotations",
  "method": "POST",
  "duration_ms": 45,
  "status_code": 201
}
```

---

## Security Considerations

### Best Practices
- ✅ HTTPS only (TLS 1.3)
- ✅ Rate limiting (per user, per IP)
- ✅ Input validation (Pydantic models)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (content-type validation)
- ✅ CORS (whitelist extension origin)
- ✅ API key rotation
- ✅ Regular security audits

### Threat Model
| Threat | Mitigation |
|--------|------------|
| API key theft | Rate limiting, IP allowlisting, revocation |
| SQL injection | Parameterized queries, ORM |
| DDoS | Cloudflare, rate limiting |
| Data breach | E2EE option, encrypted backups |
| Account takeover | Passkeys, 2FA (future) |

---

**See Also:**
- [Architecture](01-architecture.md) - Client-side architecture
- [Data Models](06-data-models.md) - Annotation schemas
- [Security & Privacy](05-security-privacy.md) - Client-side security

---

**Previous:** [← Hypothesis Insights](09-hypothesis-insights.md) | **Home:** [Design Docs](README.md)
