# RAG Data Pipeline Documentation

## Architecture Overview

WealthArena uses a RAG (Retrieval Augmented Generation) system that combines multiple data sources for enhanced context retrieval:

1. **Knowledge Base Layer**: Static educational content from markdown files (`docs/kb/`)
2. **PDF Documents Layer**: User-uploaded PDF files from the `docs/` directory

## Data Flow

The complete pipeline follows these stages:

### 1. Knowledge Base Ingestion

**Knowledge Base Processing**:
- Processes markdown files from `docs/kb/` directory
- Runs once during initial setup via `python scripts/kb_ingest.py`
- Creates `wealtharena_kb` collection in ChromaDB
- Each markdown file is ingested as a document with metadata

### 2. PDF Document Ingestion

**PDF Processing**:
- Processes PDF files from `docs/` directory
- Can be run manually via `python scripts/pdf_ingest.py`
- Runs automatically via background scheduler (configurable via `PDF_INGEST_INTERVAL_HOURS`)
- Creates `pdf_documents` collection in ChromaDB
- Supports parallel processing for multiple PDFs

### 3. Document Processing

**Text Cleaning**:
- Removes HTML tags using BeautifulSoup
- Normalizes whitespace and special characters
- Preserves basic punctuation for readability

**Chunking Strategy**:
- Splits documents into overlapping chunks (default: 500 tokens with 50 token overlap)
- Maintains context by including document title/source in metadata
- Generates unique chunk IDs based on content hash

**Metadata Extraction**:
- Extracts ticker symbols using regex patterns
- Captures publication dates, source names, document types
- Adds ingestion timestamps and collection type

**Deduplication**:
- Uses content hashes to prevent duplicate ingestion
- Checks existing document IDs before adding to vector store

### 4. Vector Ingestion

**Collection Management**:
- Creates separate ChromaDB collections: `wealtharena_kb`, `pdf_documents`
- Uses consistent `DefaultEmbeddingFunction()` across all collections
- Handles batch ingestion with error recovery

**Ingestion Process**:
- Checks for existing documents to avoid duplicates
- Adds documents in configurable batch sizes (default: 100)
- Enriches metadata with ingestion timestamps
- Returns statistics: added, duplicates, errors

### 5. Retrieval

**Multi-Collection Search**:
- Searches across all collections in parallel
- Merges results by relevance score
- Deduplicates based on document IDs
- Returns top-k results sorted by similarity

**Collection-Aware Metadata**:
- Each result includes `collection_type` field (kb/pdf)
- Source attribution in formatted context
- Maintains backward compatibility with single-collection search

### 6. LLM Context Injection

**Context Formatting**:
- Formats results with source labels: [Knowledge Base], [PDF Document]
- Combines context from multiple sources
- Passes enriched context to Groq LLM API

**Tool Tracking**:
- Records which collections were searched in `tools_used` (kb_search, pdf_search)
- Enables monitoring of multi-source retrieval usage

## Configuration Guide

### Environment Variables

#### Ingestion Configuration

```bash
# PDF Ingestion
PDF_INGEST_INTERVAL_HOURS=24          # Background job interval in hours (default: 24)
ENABLE_PDF_INGESTION=true              # Enable automatic PDF ingestion (default: true)
```

#### Vector Store Configuration

```bash
CHROMA_PERSIST_DIR=C:/Users/DELL/Downloads/WealthArena/data/vectorstore  # Use absolute path (code resolves relative paths)
```

### Recommended Values

- **PDF Ingestion Interval**: 24 hours (daily updates sufficient for document processing)
- **PDF Parallel Processing**: Use `--parallel --max-workers 2` for 20+ PDFs
- **Batch Size**: 30 chunks per batch for better progress feedback

## Deployment Checklist

### Pre-Flight Checks

1. **Environment Variables**:
   ```bash
   python scripts/verify_data_pipeline.py
   ```
   - Verifies required env vars are set
   - Checks optional vars with defaults
   - Validates configuration format

2. **Initial Data Load**:
   ```bash
   # Ingest knowledge base
   python scripts/kb_ingest.py
   
   # Ingest PDF documents
   python scripts/pdf_ingest.py
   ```
   - Processes markdown files from `docs/kb/` directory
   - Processes PDF files from `docs/` directory
   - Verifies vector store contains documents

3. **Vector Store Verification**:
   - Checks all collections exist
   - Verifies document counts meet minimums
   - Tests retrieval from each collection

### Background Job Verification

1. **Scheduler Status**:
   ```bash
   curl http://localhost:8000/v1/background/status
   ```
   - Verify scheduler is running
   - Check last run times for PDF ingestion job
   - Confirm no error messages

### End-to-End RAG Test

1. **Multi-Collection Search**:
   ```bash
   curl "http://localhost:8000/v1/search?q=financial%20markets&k=5"
   ```
   - Verify results from multiple collections
   - Check source attribution in results

2. **Chat Endpoint**:
   ```bash
   curl -X POST http://localhost:8000/v1/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What is RSI?", "user_id": "test"}'
   ```
   - Verify multi-collection context is used
   - Check `tools_used` includes collection searches
   - Confirm response includes relevant context

## Monitoring & Metrics

### Available Metrics

#### Ingestion Metrics

- `ingest_documents_total`: Documents ingested by collection and status
- `ingest_latency_seconds`: Ingestion operation latency histogram
- `vector_store_documents`: Current document count per collection (gauge)

#### Background Job Metrics

- `background_job_runs_total`: Job runs by job name and status
- `background_job_last_success_timestamp`: Last successful run timestamp per job

### Accessing Metrics

**Prometheus Format**:
```bash
curl http://localhost:8000/metrics
```

**JSON Summary**:
```bash
curl http://localhost:8000/v1/metrics/system
```

## Troubleshooting

### Empty Vector Store

**Symptoms**: No results from search, chat returns generic responses

**Solutions**:
1. Run knowledge base ingestion: `python scripts/kb_ingest.py`
2. Run PDF ingestion: `python scripts/pdf_ingest.py`
3. Check background scheduler is running: `GET /v1/background/status`
4. Verify collections exist: Check `data/vectorstore/` directory
5. Review ingestion logs for errors

### PDF Ingestion Failures

**Symptoms**: Background jobs show error status, no new PDF documents

**Solutions**:
1. **PDF Processing Errors**:
   - Check PDF files are valid and not corrupted
   - Verify PDF files are in `docs/` directory
   - Review logs for specific error messages
   - Use `--skip-on-error` to continue with other PDFs

2. **Slow Processing**:
   - Use parallel processing: `python scripts/pdf_ingest.py --parallel --max-workers 2`
   - Reduce batch size if memory issues occur
   - Check system resources (CPU, memory)

3. **Resume Interrupted Ingestion**:
   - Use `--resume` flag to continue from where it left off
   - Check progress files in `data/` directory

### Collection Not Found Errors

**Symptoms**: Errors when searching specific collections

**Solutions**:
1. Collections are created automatically on first ingestion
2. Verify collection names match: `wealtharena_kb`, `pdf_documents`
3. Check ChromaDB directory permissions
4. Review vector store initialization logs

### Background Scheduler Not Running

**Symptoms**: No automatic PDF ingestion, jobs show pending status

**Solutions**:
1. Check application logs for scheduler startup errors
2. Verify `ENABLE_PDF_INGESTION=true` is set in `.env`
3. Check FastAPI lifespan context manager is working
4. Review asyncio task creation logs

## API Reference

### Background Job Status

**Endpoint**: `GET /v1/background/status`

**Response**:
```json
{
  "scheduler_running": true,
  "jobs": {
    "pdf_ingestion": {
      "name": "pdf_ingestion",
      "status": "success",
      "interval_seconds": 86400,
      "last_run": "2024-01-01T12:00:00",
      "next_run": "2024-01-02T12:00:00",
      "run_count": 10,
      "success_count": 9,
      "error_count": 1
    }
  },
  "collections": {
    "wealtharena_kb": {"exists": true, "count": 5},
    "pdf_documents": {"exists": true, "count": 150}
  }
}
```

### Enhanced Chat Endpoint

**Endpoint**: `POST /v1/chat`

**Request**:
```json
{
  "message": "What is RSI?",
  "user_id": "user123"
}
```

**Response** (with multi-collection RAG):
```json
{
  "reply": "RSI is a momentum indicator...",
  "tools_used": ["kb_search", "pdf_search"],
  "trace_id": "run-12345"
}
```

The `tools_used` array indicates which collections were searched:
- `kb_search`: Knowledge base collection
- `pdf_search`: PDF documents collection

## Best Practices

1. **Initial Setup**: Run `python scripts/kb_ingest.py` to ingest knowledge base first
2. **PDF Processing**: Use parallel processing for 20+ PDFs: `python scripts/pdf_ingest.py --parallel --max-workers 2`
3. **Monitor Metrics**: Regularly check ingestion statistics and background job status
4. **Verify Before Deploy**: Always run `verify_data_pipeline.py` before production deployment
5. **Monitor Background Jobs**: Check `/v1/background/status` regularly
6. **Review Logs**: Monitor application logs for ingestion errors
7. **Test End-to-End**: Verify RAG flow works with sample queries before going live
8. **Resume Interrupted Ingestion**: Use `--resume` flag to continue from where it left off

## Future Enhancements

Potential improvements to the RAG pipeline:

1. **Additional Data Sources**: News feeds, educational content, market data
2. **Advanced Chunking**: Semantic chunking based on document structure
3. **Query Routing**: Intelligent routing to most relevant collection
4. **Caching**: Cache frequently accessed documents
5. **Incremental Updates**: Only process new/updated documents
6. **Quality Scoring**: Rank documents by quality/relevance before ingestion
7. **Multi-Language Support**: Process documents in multiple languages
8. **Real-Time Updates**: WebSocket-based real-time document ingestion

