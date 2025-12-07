# Chat History, Feedback, and Export APIs

This document describes the new chat history storage, feedback system, and export functionality.

## Database Schema

All data is stored in SQLite database at `data/chat_history.db`:

### chat_history table
```sql
CREATE TABLE chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    reply TEXT NOT NULL,
    meta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### feedback table
```sql
CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_history (id)
);
```

## Chat History API (`/v1/chat/history`)

### POST `/v1/chat/history`
Store a chat message and reply.

**Request:**
```json
{
  "user_id": "user123",
  "message": "What is RSI?",
  "reply": "RSI stands for Relative Strength Index...",
  "meta": {
    "tools_used": ["llm_client"],
    "trace_id": "run-12345"
  }
}
```

**Response:**
```json
{
  "id": 1,
  "user_id": "user123",
  "message": "What is RSI?",
  "reply": "RSI stands for Relative Strength Index...",
  "meta": {
    "tools_used": ["llm_client"],
    "trace_id": "run-12345"
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

### GET `/v1/chat/history`
Retrieve chat history for a user.

**Query Parameters:**
- `user_id` (required): User ID to retrieve history for
- `limit` (optional): Maximum number of messages (default: 50, max: 1000)

**Response:**
```json
{
  "messages": [
    {
      "id": 1,
      "user_id": "user123",
      "message": "What is RSI?",
      "reply": "RSI stands for Relative Strength Index...",
      "meta": {...},
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

### DELETE `/v1/chat/history`
Clear chat history for a user.

**Query Parameters:**
- `user_id` (required): User ID to clear history for

**Response:**
```json
{
  "message": "Cleared 5 messages for user user123",
  "deleted_count": 5
}
```

### GET `/v1/chat/history/stats`
Get chat statistics.

**Query Parameters:**
- `user_id` (optional): User ID to get stats for

**Response (for specific user):**
```json
{
  "user_id": "user123",
  "message_count": 25,
  "first_message": "2024-01-01T00:00:00Z",
  "last_message": "2024-01-15T10:30:00Z"
}
```

## Feedback API (`/v1/chat/feedback`)

### POST `/v1/chat/feedback`
Submit feedback for a chat message.

**Request:**
```json
{
  "message_id": 1,
  "vote": "up"
}
```

**Response:**
```json
{
  "id": 1,
  "message_id": 1,
  "vote": "up",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### GET `/v1/chat/feedback/stats/{message_id}`
Get feedback statistics for a specific message.

**Response:**
```json
{
  "message_id": 1,
  "up_votes": 5,
  "down_votes": 1,
  "total_votes": 6,
  "net_score": 4
}
```

### GET `/v1/chat/feedback/user`
Get feedback for messages from a specific user.

**Query Parameters:**
- `user_id` (required): User ID to get feedback for
- `limit` (optional): Maximum number of feedback entries (default: 50, max: 1000)

### GET `/v1/chat/feedback/analytics`
Get overall feedback analytics.

**Response:**
```json
{
  "overall_stats": {
    "total_feedback": 100,
    "total_up_votes": 75,
    "total_down_votes": 25,
    "approval_rate": 75.0
  },
  "recent_stats": {
    "recent_feedback": 20,
    "recent_up_votes": 15,
    "recent_down_votes": 5,
    "recent_approval_rate": 75.0
  },
  "top_messages": [...]
}
```

## Export API (`/v1/chat/export`)

### GET `/v1/chat/export`
Export chat history for a user.

**Query Parameters:**
- `user_id` (required): User ID to export history for
- `format` (optional): Export format - "txt", "csv", or "json" (default: "txt")
- `limit` (optional): Maximum number of messages to export (default: 1000, max: 10000)

**Response:** File download with appropriate content type and filename.

### GET `/v1/chat/export/summary`
Get a summary of exportable chat history.

**Query Parameters:**
- `user_id` (required): User ID to get summary for

**Response:**
```json
{
  "user_id": "user123",
  "total_messages": 25,
  "first_message": "2024-01-01T00:00:00Z",
  "last_message": "2024-01-15T10:30:00Z",
  "recent_messages_7_days": 5,
  "average_user_message_length": 45.2,
  "average_assistant_reply_length": 120.5,
  "max_user_message_length": 200,
  "max_assistant_reply_length": 500,
  "export_formats_available": ["txt", "csv", "json"]
}
```

### GET `/v1/chat/export/bulk`
Export summary for all users (admin endpoint).

**Response:** Text file with bulk export summary.

## Usage Examples

### Store Chat History
```bash
curl -X POST http://localhost:8000/v1/chat/history \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "message": "What is RSI?",
    "reply": "RSI stands for Relative Strength Index...",
    "meta": {"tools_used": ["llm_client"]}
  }'
```

### Submit Feedback
```bash
curl -X POST http://localhost:8000/v1/chat/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": 1,
    "vote": "up"
  }'
```

### Export Chat History
```bash
# Export as text
curl -O http://localhost:8000/v1/chat/export?user_id=user123&format=txt

# Export as CSV
curl -O http://localhost:8000/v1/chat/export?user_id=user123&format=csv

# Export as JSON
curl -O http://localhost:8000/v1/chat/export?user_id=user123&format=json
```

## Integration with Existing Chat API

To integrate these new APIs with the existing chat system, you can modify the chat endpoint to automatically store history:

```python
# In chat.py, after getting the LLM response:
# Store in history
history_data = {
    "user_id": request.user_id or "anonymous",
    "message": request.message,
    "reply": reply,
    "meta": {
        "tools_used": tools_used,
        "trace_id": trace_id
    }
}
await store_chat_history(history_data)
```

This ensures all chat interactions are automatically stored for later retrieval, feedback, and export.
