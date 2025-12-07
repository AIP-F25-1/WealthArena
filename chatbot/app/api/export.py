"""
WealthArena Chat Export API
Export chat history to downloadable formats
"""

import sqlite3
import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
import io

router = APIRouter()

# Database file path (same as history)
DB_PATH = "data/chat_history.db"

def init_database():
    """Initialize SQLite database with required tables"""
    # Ensure data directory exists
    os.makedirs("data", exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create chat_history table if it doesn't exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            message TEXT NOT NULL,
            reply TEXT NOT NULL,
            meta TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize database on module load
init_database()

@router.get("/v1/chat/export")
async def export_chat_history(
    user_id: str = Query(..., description="User ID to export history for"),
    format: str = Query("txt", description="Export format (txt, csv, json)", regex="^(txt|csv|json)$"),
    limit: int = Query(1000, description="Maximum number of messages to export", ge=1, le=10000)
):
    """Export chat history for a specific user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get chat history
        cursor.execute("""
            SELECT id, message, reply, meta, created_at
            FROM chat_history
            WHERE user_id = ?
            ORDER BY created_at ASC
            LIMIT ?
        """, (user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            raise HTTPException(status_code=404, detail="No chat history found for this user")
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"chat_history_{user_id}_{timestamp}.{format}"
        
        if format == "txt":
            return await _export_txt(rows, filename)
        elif format == "csv":
            return await _export_csv(rows, filename)
        elif format == "json":
            return await _export_json(rows, filename)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export chat history: {str(e)}")

async def _export_txt(rows, filename):
    """Export chat history as plain text"""
    content = io.StringIO()
    
    content.write(f"Chat History Export\n")
    content.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    content.write(f"Total Messages: {len(rows)}\n")
    content.write("=" * 50 + "\n\n")
    
    for i, (message_id, message, reply, meta, created_at) in enumerate(rows, 1):
        content.write(f"Message #{i} (ID: {message_id})\n")
        content.write(f"Time: {created_at}\n")
        content.write(f"User: {message}\n")
        content.write(f"Assistant: {reply}\n")
        
        if meta:
            content.write(f"Metadata: {meta}\n")
        
        content.write("-" * 30 + "\n\n")
    
    content.seek(0)
    
    return StreamingResponse(
        io.BytesIO(content.getvalue().encode('utf-8')),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

async def _export_csv(rows, filename):
    """Export chat history as CSV"""
    content = io.StringIO()
    
    # CSV header
    content.write("message_id,created_at,user_message,assistant_reply,metadata\n")
    
    for message_id, message, reply, meta, created_at in rows:
        # Escape CSV fields
        message_escaped = message.replace('"', '""')
        reply_escaped = reply.replace('"', '""')
        meta_escaped = meta.replace('"', '""') if meta else ""
        
        content.write(f'"{message_id}","{created_at}","{message_escaped}","{reply_escaped}","{meta_escaped}"\n')
    
    content.seek(0)
    
    return StreamingResponse(
        io.BytesIO(content.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

async def _export_json(rows, filename):
    """Export chat history as JSON"""
    import json
    
    export_data = {
        "export_info": {
            "generated_at": datetime.now().isoformat(),
            "total_messages": len(rows),
            "format": "json"
        },
        "messages": []
    }
    
    for message_id, message, reply, meta, created_at in rows:
        message_data = {
            "id": message_id,
            "created_at": created_at,
            "user_message": message,
            "assistant_reply": reply
        }
        
        if meta:
            try:
                message_data["metadata"] = json.loads(meta)
            except:
                message_data["metadata"] = meta
        
        export_data["messages"].append(message_data)
    
    content = json.dumps(export_data, indent=2, ensure_ascii=False)
    
    return StreamingResponse(
        io.BytesIO(content.encode('utf-8')),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/v1/chat/export/summary")
async def get_export_summary(
    user_id: str = Query(..., description="User ID to get summary for")
):
    """Get a summary of exportable chat history"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get basic stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total_messages,
                MIN(created_at) as first_message,
                MAX(created_at) as last_message
            FROM chat_history
            WHERE user_id = ?
        """, (user_id,))
        
        result = cursor.fetchone()
        if not result or result[0] == 0:
            raise HTTPException(status_code=404, detail="No chat history found for this user")
        
        total_messages, first_message, last_message = result
        
        # Get message length stats
        cursor.execute("""
            SELECT 
                AVG(LENGTH(message)) as avg_user_message_length,
                AVG(LENGTH(reply)) as avg_assistant_reply_length,
                MAX(LENGTH(message)) as max_user_message_length,
                MAX(LENGTH(reply)) as max_assistant_reply_length
            FROM chat_history
            WHERE user_id = ?
        """, (user_id,))
        
        length_stats = cursor.fetchone()
        
        # Get recent activity (last 7 days)
        cursor.execute("""
            SELECT COUNT(*) as recent_messages
            FROM chat_history
            WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
        """, (user_id,))
        
        recent_messages = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "user_id": user_id,
            "total_messages": total_messages,
            "first_message": first_message,
            "last_message": last_message,
            "recent_messages_7_days": recent_messages,
            "average_user_message_length": round(length_stats[0], 2) if length_stats[0] else 0,
            "average_assistant_reply_length": round(length_stats[1], 2) if length_stats[1] else 0,
            "max_user_message_length": length_stats[2] or 0,
            "max_assistant_reply_length": length_stats[3] or 0,
            "export_formats_available": ["txt", "csv", "json"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get export summary: {str(e)}")

@router.get("/v1/chat/export/bulk")
async def bulk_export_all_users():
    """Export chat history for all users (admin endpoint)"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get all users with their message counts
        cursor.execute("""
            SELECT 
                user_id,
                COUNT(*) as message_count,
                MIN(created_at) as first_message,
                MAX(created_at) as last_message
            FROM chat_history
            GROUP BY user_id
            ORDER BY message_count DESC
        """)
        
        users = cursor.fetchall()
        conn.close()
        
        if not users:
            raise HTTPException(status_code=404, detail="No chat history found")
        
        # Create a summary report
        content = io.StringIO()
        content.write("WealthArena Chat History - Bulk Export Summary\n")
        content.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        content.write("=" * 60 + "\n\n")
        
        total_messages = 0
        for user_id, message_count, first_message, last_message in users:
            content.write(f"User: {user_id}\n")
            content.write(f"  Messages: {message_count}\n")
            content.write(f"  First: {first_message}\n")
            content.write(f"  Last: {last_message}\n")
            content.write("-" * 30 + "\n")
            total_messages += message_count
        
        content.write(f"\nTotal Users: {len(users)}\n")
        content.write(f"Total Messages: {total_messages}\n")
        
        content.seek(0)
        
        return StreamingResponse(
            io.BytesIO(content.getvalue().encode('utf-8')),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=bulk_export_summary.txt"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to perform bulk export: {str(e)}")
