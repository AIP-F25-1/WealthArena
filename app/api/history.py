"""
WealthArena Chat History API
SQLite-based chat history storage and retrieval
"""

import sqlite3
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import json

router = APIRouter()

# Database file path
DB_PATH = "data/chat_history.db"

class ChatHistoryRequest(BaseModel):
    user_id: str
    message: str
    reply: str
    meta: Optional[Dict[str, Any]] = None

class ChatHistoryResponse(BaseModel):
    id: int
    user_id: str
    message: str
    reply: str
    meta: Optional[Dict[str, Any]] = None
    created_at: str

class ChatHistoryList(BaseModel):
    messages: List[ChatHistoryResponse]
    total: int

def init_database():
    """Initialize SQLite database with required tables"""
    # Ensure data directory exists
    os.makedirs("data", exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create chat_history table
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
    
    # Create feedback table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES chat_history (id)
        )
    """)
    
    # Create indexes for better performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON feedback(message_id)")
    
    conn.commit()
    conn.close()

# Initialize database on module load
init_database()

@router.post("/v1/chat/history", response_model=ChatHistoryResponse)
async def store_chat_history(request: ChatHistoryRequest):
    """Store a chat message and reply in the database"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Convert meta to JSON string if provided
        meta_json = json.dumps(request.meta) if request.meta else None
        
        cursor.execute("""
            INSERT INTO chat_history (user_id, message, reply, meta)
            VALUES (?, ?, ?, ?)
        """, (request.user_id, request.message, request.reply, meta_json))
        
        message_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Return the stored record
        return ChatHistoryResponse(
            id=message_id,
            user_id=request.user_id,
            message=request.message,
            reply=request.reply,
            meta=request.meta,
            created_at=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store chat history: {str(e)}")

@router.get("/v1/chat/history", response_model=ChatHistoryList)
async def get_chat_history(
    user_id: str = Query(..., description="User ID to retrieve history for"),
    limit: int = Query(50, description="Maximum number of messages to return", ge=1, le=1000)
):
    """Get chat history for a specific user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get total count
        cursor.execute("SELECT COUNT(*) FROM chat_history WHERE user_id = ?", (user_id,))
        total = cursor.fetchone()[0]
        
        # Get messages with limit
        cursor.execute("""
            SELECT id, user_id, message, reply, meta, created_at
            FROM chat_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        messages = []
        for row in rows:
            id_val, user_id_val, message, reply, meta_json, created_at = row
            meta = json.loads(meta_json) if meta_json else None
            
            messages.append(ChatHistoryResponse(
                id=id_val,
                user_id=user_id_val,
                message=message,
                reply=reply,
                meta=meta,
                created_at=created_at
            ))
        
        return ChatHistoryList(messages=messages, total=total)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chat history: {str(e)}")

@router.delete("/v1/chat/history")
async def clear_chat_history(
    user_id: str = Query(..., description="User ID to clear history for")
):
    """Clear chat history for a specific user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Delete from chat_history table
        cursor.execute("DELETE FROM chat_history WHERE user_id = ?", (user_id,))
        deleted_count = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        return {
            "message": f"Cleared {deleted_count} messages for user {user_id}",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear chat history: {str(e)}")

@router.get("/v1/chat/history/stats")
async def get_chat_stats(
    user_id: Optional[str] = Query(None, description="User ID to get stats for (optional)")
):
    """Get chat statistics"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if user_id:
            # Get stats for specific user
            cursor.execute("SELECT COUNT(*) FROM chat_history WHERE user_id = ?", (user_id,))
            user_count = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT MIN(created_at), MAX(created_at)
                FROM chat_history
                WHERE user_id = ?
            """, (user_id,))
            result = cursor.fetchone()
            first_message, last_message = result
            
            return {
                "user_id": user_id,
                "message_count": user_count,
                "first_message": first_message,
                "last_message": last_message
            }
        else:
            # Get global stats
            cursor.execute("SELECT COUNT(*) FROM chat_history")
            total_messages = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(DISTINCT user_id) FROM chat_history")
            unique_users = cursor.fetchone()[0]
            
            cursor.execute("SELECT MIN(created_at), MAX(created_at) FROM chat_history")
            result = cursor.fetchone()
            first_message, last_message = result
            
            return {
                "total_messages": total_messages,
                "unique_users": unique_users,
                "first_message": first_message,
                "last_message": last_message
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chat stats: {str(e)}")
