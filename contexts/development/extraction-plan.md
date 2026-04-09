---
title: Extraction Service Implementation Plan
description: Detailed implementation plan for Poliwise ingestion-service (Python FastAPI)
type: development
version: 1.0
---

# Extraction Service Implementation Plan

## Purpose

This document provides the **complete technical implementation plan** for building the ingestion-service (Python FastAPI) that extracts, chunks, and embeds documents for the Poliwise AI platform.

## When to Use

- Implementing the ingestion-service from scratch
- Understanding document processing pipeline flow
- Reference for architecture decisions and technical specifications
- Onboarding developers to the ingestion layer

---

## Core Architecture

### Pipeline Flow

```
Knowledge Service (Spring Boot :8083)
  1. Admin uploads file via Gateway
  2. Save file to MinIO
  3. Create Document, DocumentVersion, ProcessingJob entities
  4. Fetch metadata (access rules, categories, tags)
  5. Publish `ingestion.requested` to RabbitMQ with full payload

└──────────────────────────────┬──────────────────────────────────────────┘
                               │ ingestion.requested (RabbitMQ)
                               ▼

Ingestion Service (Python FastAPI :8088)
  ↓ EXTRACTION LAYER
    • Download file from MinIO using file_key + bucket_name
    • Route to format-specific extractor
    • Extract raw text + structural metadata
    • Return ExtractedDocument with text + metadata
  
  ↓ STANDARDIZATION LAYER
    • Unicode NFC, whitespace cleanup
    • Document heading detection
  
  ↓ CHUNKING LAYER
    • Parent-child chunking with metadata assignment from event payload
  
  ↓ EMBEDDING LAYER
    • BGE-M3 dense (1024-dim) + sparse BM25 via LitServe
  
  ↓ STORAGE LAYER
    • Save chunks to knowledge.chunks with access control tags
    • Update knowledge.documents (extracted_text, page_count, etc.)
    • Update knowledge.processing_jobs (status = COMPLETED)
  
  ↓ PUBLISH `document.uploaded` to RabbitMQ
```

### Project Structure

```
services/ingestion-service/
├── Dockerfile
├── pyproject.toml
├── .env.example
├── src/
│   ├── main.py                          # FastAPI app entry point
│   ├── config/
│   │   ├── settings.py                  # Pydantic settings (MinIO, DB, RabbitMQ)
│   │   └── rabbitmq.py                  # RabbitMQ connection + exchange/queue setup
│   ├── api/
│   │   ├── routes/
│   │   │   ├── health.py                # GET /health
│   │   │   └── ingest.py                # POST /ingest, GET /ingest/{job_id}/status
│   ├── services/
│   │   ├── extractor.py                 # Extraction orchestrator + format-specific extractors
│   │   ├── standardizer.py              # DocumentPolicyStandardizer
│   │   ├── chunker.py                   # Parent-child chunker
│   │   ├── embedding_service.py         # BGE-M3 via LitServe
│   │   ├── minio_service.py             # MinIO download client
│   │   └── processing_job_service.py    # Update job status in DB
│   ├── models/
│   │   ├── extraction.py                # Pydantic/dataclass models for extraction output
│   │   ├── chunk.py                     # SQLAlchemy chunk model
│   │   ├── document.py                  # SQLAlchemy document model
│   │   └── processing_job.py            # SQLAlchemy job model
│   ├── db/
│   │   ├── session.py                   # asyncpg engine + session factory
│   │   └── repositories/
│   │       ├── chunk_repo.py
│   │       ├── document_repo.py
│   │       └── job_repo.py
│   └── events/
│       ├── consumer.py                  # Consume ingestion.requested, document.deleted
│       └── publisher.py                 # Publish document.uploaded
└── tests/
```

---

## Database Schema Alignment

**CRITICAL**: All table and column definitions MUST match `docs/database.md` exactly.

### Tables Written by Ingestion-Service

| Table | Key Columns |
|-------|-------------|
| `knowledge.documents` | `id`, `file_key`, `bucket_name`, `extracted_text`, `page_count`, `word_count`, `chunking_strategy`, `chunk_size`, `chunk_overlap`, `embedding_model`, `embedding_dimension` |
| `knowledge.document_versions` | `id`, `document_id`, `version_number`, `file_key`, `bucket_name`, `extracted_text` |
| `knowledge.chunks` | `id`, `document_id`, `document_version_id`, `chunk_type`, `parent_chunk_id`, `content`, `summary`, `section_title`, `section_level`, `section_path`, `chunk_index`, `start_char_index`, `end_char_index`, `token_count`, `child_chunk_ids`, `embedding_vector`, `embedding_model`, `embedding_dimension`, `allowed_roles`, `allowed_departments`, `access_level`, `is_latest` |
| `knowledge.processing_jobs` | `id`, `document_id`, `document_version_id`, `job_type`, `status`, `progress_percent`, `error_message`, `error_details`, `output_metrics` |

### Schema Requirements

- **Soft Delete**: All tables have `deleted_at` for soft deletion
- **Timestamps**: All tables have `created_at`, `updated_at` (except join tables)
- **UUID Primary Keys**: All IDs are UUIDs
- **Foreign Keys**: Proper foreign key constraints between related tables

---

## Environment Configuration

```env
# Server
HOST=0.0.0.0
PORT=8088
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql+asyncpg://poliwise:poliwise_secure_password@postgres:5432/poliwise
DATABASE_SCHEMA=knowledge

# RabbitMQ
RABBITMQ_URL=amqp://poliwise:poliwise_secure_password@rabbitmq:5672
RABBITMQ_EXCHANGE=poliwise.events

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false

# LitServe
LITSERVE_EMBEDDING_URL=http://localhost:8001
LITSERVE_RERANKER_URL=http://localhost:8002

# Chunking
CHUNKING_PARENT_SIZE=1500
CHUNKING_CHILD_SIZE=400
CHUNKING_CHILD_OVERLAP=80
CHUNKING_DEFAULT_STRATEGY=parent_child

# OCR Fallback
OCR_FALLBACK_MIN_TEXT_LENGTH=50
OCR_FALLBACK_MIN_IMAGE_COUNT=1
OCR_LANGUAGE=eng
```

---

## Dependencies

```toml
[project]
name = "poliwise-ingestion"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    # FastAPI & Web
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    
    # Database
    "asyncpg>=0.30.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "pgvector>=0.3.0",
    
    # Message Queue
    "aio-pika>=9.4.0",
    
    # Configuration
    "pydantic>=2.9.0",
    "pydantic-settings>=2.6.0",
    
    # Document Extraction
    "PyMuPDF>=1.23.0",        # PDF
    "python-docx>=1.1.0",     # DOCX
    "openpyxl>=3.1.0",        # XLSX
    "pytesseract>=0.3.10",    # OCR
    "Pillow>=10.0.0",         # Images
    
    # NLP & Tokenization
    "tiktoken>=0.8.0",        # Token counting
    "underthesea>=6.8.0",     # Vietnamese NLP
    
    # HTTP Client
    "httpx>=0.27.0",
    
    # Object Storage
    "minio>=7.2.0",
    
    # Observability
    "structlog>=24.1.0",
    "prometheus-client>=0.21.0",
    "starlette-exporter>=0.24.0",
]
```

---

## Core Services Implementation

### 1. Extraction Orchestrator

**Pattern**: Registry/Strategy pattern for format-specific extractors

```python
class DocumentExtractor(ABC):
    @abstractmethod
    async def extract(self, file_bytes: bytes, document_id: UUID, version_id: UUID) -> ExtractedDocument:
        ...

class ExtractionOrchestrator:
    def __init__(self):
        self._extractors: dict[str, DocumentExtractor] = {}
    
    def register(self, extractor: DocumentExtractor):
        for ext in extractor.supported_extensions():
            self._extractors[ext] = extractor
    
    async def extract(self, file_bytes: bytes, file_key: str, document_id: UUID, version_id: UUID) -> ExtractedDocument:
        ext = file_key.rsplit(".", 1)[-1].lower() if "." in file_key else ""
        extractor = self._extractors.get(ext)
        if not extractor:
            raise ValueError(f"No extractor for extension: .{ext}")
        return await extractor.extract(file_bytes, document_id, version_id)
```

### 2. Supported Extractors

| Format | Extension | Library | Key Features |
|--------|-----------|---------|--------------|
| PDF | `.pdf` | PyMuPDF (`fitz`) | Text extraction, image detection, OCR fallback |
| Word | `.docx` | `python-docx` | Heading detection, table extraction |
| Excel | `.xlsx` | `openpyxl` | Sheet extraction, table conversion to markdown |
| Text | `.txt`, `.md` | Built-in | UTF-8 decode, markdown structure preservation |
| Images | `.png`, `.jpg`, etc. | `pytesseract` + `Pillow` | OCR with Vietnamese language support |

### 3. Vietnamese Standardizer

Detects Vietnamese document structure:

```python
class DocumentPolicyStandardizer:
    HEADING_PATTERNS = [
        (r"^(CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)\s*[:\-]?\s*(.*)$", 1),
        (r"^(ARTICLE|Article)\s+(\d+)\s*[:\-]?\s*(.*)$", 2),
        (r"^(CLAUSE|Clause)\s+(\d+)\s*[:\-]?\s*(.*)$", 3),
        (r"^(POINT|Point)\s+([a-z])\s*[:\-]?\s*(.*)$", 4),
        (r"^(SECTION|Section)\s+(\d+)\s*[:\-]?\s*(.*)$", 2),
    ]
    
    def normalize(self, raw_text: str) -> StructuredText:
        # Unicode normalization, whitespace cleanup, heading detection
        # Returns structured text with sections and headings
```

### 4. Parent-Child Chunker

**Strategy**: Hierarchical chunking for structured documents, recursive for unstructured

```python
class ParentChildChunker:
    def __init__(self, parent_size=1500, child_size=400, child_overlap=80):
        self.parent_size = parent_size
        self.child_size = child_size
        self.child_overlap = child_overlap
        self.enc = tiktoken.get_encoding("cl100k_base")
    
    def chunk(self, structured_text, metadata: dict) -> list[Chunk]:
        if structured_text.headings:
            return self._hierarchical_chunk(structured_text, metadata)
        else:
            return self._recursive_chunk(structured_text.normalized_text, metadata)
```

### 5. Embedding Service

**Integration**: LitServe for BGE-M3 embeddings

```python
class EmbeddingService:
    def __init__(self):
        self.embedding_url = settings.litserve_embedding_url
    
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.embedding_url}/predict",
                json={"inputs": texts},
                timeout=120.0,
            )
            response.raise_for_status()
            return response.json()["outputs"]
```

---

## Database Operations

### Chunk Bulk Insert with ACL Flattening

```python
async def bulk_insert(self, chunks: list[Chunk]):
    values = []
    for c in chunks:
        values.append({
            "chunk_id": str(c.chunk_id),
            "document_id": c.document_id,
            "document_version_id": c.document_version_id,
            "chunk_type": c.chunk_type,
            "parent_chunk_id": str(c.parent_chunk_id) if c.parent_chunk_id else None,
            "content": c.content,
            "summary": c.summary,
            "section_title": c.section_title,
            "section_level": c.section_level,
            "section_path": c.section_path,
            "chunk_index": c.chunk_index,
            "start_char_index": c.start_char_index,
            "end_char_index": c.end_char_index,
            "token_count": c.token_count,
            "child_chunk_ids": [str(uid) for uid in c.child_chunk_ids],
            "allowed_roles": c.allowed_roles,        # Flattened from metadata
            "allowed_departments": c.allowed_departments,  # Flattened from metadata
            "access_level": c.access_level,          # Flattened from metadata
            "is_latest": True,
        })
    
    await self.session.execute(text("""
        INSERT INTO knowledge.chunks (...) VALUES (...)
    """), values)
```

### Version Management

```sql
-- Mark previous chunks as not latest
UPDATE knowledge.chunks
SET is_latest = false
WHERE document_id = :document_id AND is_latest = true;

-- Insert new chunks with is_latest = true
INSERT INTO knowledge.chunks (..., is_latest) VALUES (..., true);
```

---

## Event-Driven Architecture

### Consumed Events

| Event | Queue | Action |
|-------|-------|--------|
| `ingestion.requested` | `ingestion.requests` | Start extraction pipeline |
| `document.deleted` | `ingestion.document.deleted` | Soft-delete chunks |

### Published Events

| Event | Routing Key | Purpose |
|-------|-------------|---------|
| `document.uploaded` | `document.uploaded` | Notify system document is ready |

### Event Payload Example

```json
{
  "event_type": "ingestion.requested",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0",
  "payload": {
    "document_id": "550e8400-e29b-41d4-a716-446655440000",
    "document_version_id": "660e8400-e29b-41d4-a716-446655440001",
    "file_key": "documents/2024/01/550e8400.pdf",
    "bucket_name": "poliwise-documents",
    "job_id": "770e8400-e29b-41d4-a716-446655440002",
    "metadata": {
      "allowed_roles": ["USER", "MANAGER", "ADMIN"],
      "allowed_departments": ["dept-uuid-1", "dept-uuid-2"],
      "allowed_users": ["user-uuid-1"],
      "access_level": "PUBLIC",
      "title": "HR Policy 2024",
      "department_id": "dept-uuid-1",
      "document_metadata": {
        "category_id": "cat-uuid",
        "effective_date": "2024-01-01",
        "expiry_date": "2025-01-01"
      }
    }
  }
}
```

---

## Error Handling & Resilience

### Retry Strategy

| Error Type | Retry | Max Attempts | Action |
|------------|-------|--------------|--------|
| Network timeout | Yes | 3 | Exponential backoff |
| Invalid file format | No | 0 | Fail immediately |
| Database constraint violation | No | 0 | Idempotent skip |
| RabbitMQ connection loss | Yes | Infinite | Reconnect with backoff |

### Circuit Breaker Configuration

```python
circuit_breaker = circuit(
    failure_threshold=3,
    recovery_timeout=30,
    expected_exception=EmbeddingServiceError
)
```

### Dead Letter Queue

```python
await channel.declare_queue(
    "ingestion.requests.dlq",
    durable=True,
    arguments={
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": "ingestion.requests"
    }
)
```

---

## Idempotency Guarantees

### Unique Constraint

```sql
ALTER TABLE knowledge.chunks
ADD CONSTRAINT uniq_chunk_per_version
UNIQUE (document_version_id, chunk_index, chunk_type);
```

### Idempotent Processing

```python
async def on_ingestion_requested(message):
    payload = json.loads(message.body.decode("utf-8"))
    job_id = payload.get("job_id")
    
    # Check if job already completed
    existing_job = await job_repo.get_by_id(job_id)
    if existing_job and existing_job.status in ["COMPLETED", "FAILED"]:
        await message.ack()  # Skip duplicate
        return
    
    # Process with idempotent bulk insert
    await chunk_repo.bulk_insert(chunks, on_conflict="DO NOTHING")
```

---

## Performance Tuning

### Default Settings

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| Workers | 2 | 2-4 | Concurrent document processing |
| Embedding batch size | 32 | 16-64 | GPU memory bound |
| Parent chunk size | 1500 tokens | 1000-2000 | Auto-merging threshold |
| Child chunk size | 400 tokens | 300-500 | Retrieval-optimized |
| Child overlap | 80 tokens | 50-150 | Context preservation |
| DB connection pool | 10 | 10-20 | SQLAlchemy engine |

### Throughput Expectations

- **CPU-only**: 10-20 documents/hour per worker
- **GPU (T4+)**: 50-100 documents/hour per worker
- **Embedding speed**: ~2000 tokens/sec (GPU), ~50 tokens/sec (CPU)

### Memory Management

- **Streaming extraction**: For large documents (>50MB)
- **Batch embedding**: Don't accumulate all chunks in memory
- **Database streaming**: Insert chunks as they're embedded

---

## Security & Compliance

### File Validation

```python
async def validate_file(file_bytes: bytes, mime_type: str) -> None:
    if len(file_bytes) > settings.max_file_size:
        raise FileTooLargeError(f"File size exceeds limit")
    
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ...]
    if mime_type not in allowed_types:
        raise InvalidFileTypeError(f"Unsupported MIME type")
```

### Data Retention

- `processing_jobs`: Keep COMPLETED for 30 days (configurable)
- Chunk `is_latest`: Prevents old version data from being used
- Soft delete: Never hard delete for audit trail

---

## Monitoring & Observability

### Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `ingestion_total` | Counter | Total ingestion jobs by status |
| `ingestion_duration_seconds` | Histogram | Duration by pipeline stage |
| `chunks_created_total` | Counter | Chunks created by type |
| `embedding_latency_seconds` | Histogram | LitServe embedding latency |
| `minio_errors_total` | Counter | MinIO download errors |

### Health Checks

- `/health`: Overall health (all dependencies)
- `/health/live`: Liveness (process running)
- `/health/ready`: Readiness (can accept traffic)

### Structured Logging

```python
import structlog

logger = structlog.get_logger()
logger.info("processing.started", document_id=document_id, version_id=version_id)
logger.error("embedding.failed", document_id=document_id, error=str(e), exc_info=True)
```

---

## Testing Strategy

### Unit Tests

```
tests/
├── fixtures/
│   ├── sample_vietnamese_policy.pdf
│   ├── sample_hr_document.docx
│   ├── sample_timesheet.xlsx
│   ├── sample_policy.md
│   └── sample_scanned_image.png
├── test_extractors.py
├── test_standardizer.py
├── test_chunker.py
├── test_embedding_service.py
└── test_repositories.py
```

### Integration Tests

Test full pipeline with:
- Mock MinIO returning fixture files
- In-memory PostgreSQL with pgvector mock
- Mock RabbitMQ for event verification
- Test coverage ≥ 80% for extractor and chunker

---

## Implementation Checklist

- [ ] All table/column names match `docs/database.md` exactly
- [ ] Unique constraint on `knowledge.chunks` (document_version_id, chunk_index, chunk_type)
- [ ] `content_tsv` TSVECTOR generated column created
- [ ] HNSW index on `knowledge.chunks.embedding_vector`
- [ ] GIN indexes on `allowed_roles`, `allowed_departments`, `content_tsv`
- [ ] RabbitMQ DLQ configured for `ingestion.requests`
- [ ] Health check endpoints return proper status
- [ ] Metrics endpoint enabled in production
- [ ] Structured JSON logging enabled
- [ ] Idempotency tested: replay same event twice → no duplicate chunks
- [ ] Versioning tested: v1 → ingest → re-ingest → v2 chunks `is_latest=true`
- [ ] OCR fallback configurable and logged
- [ ] Token count validated on Vietnamese sample
- [ ] Memory usage profiled on large documents

---

## References

- **Database Schema**: `docs/database.md` - Table definitions
- **Authorization**: `contexts/authorization/dual-strategy.md` - ACL flattening strategy
- **Service Boundaries**: `contexts/service-boundaries/responsibilities.md` - Service ownership
- **Event Contracts**: `contexts/service-boundaries/events.md` - RabbitMQ event specifications
- **API Standards**: `contexts/service-boundaries/api-contracts.md` - Response formats