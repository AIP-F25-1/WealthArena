"""
WealthArena Chat Feedback API
User feedback storage for chat messages
"""

import sqlite3
import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from enum import Enum

router = APIRouter()

# Database file path (same as history)
DB_PATH = "data/chat_history.db"

class VoteType(str, Enum):
    UP = "up"
    DOWN = "down"

class FeedbackRequest(BaseModel):
    message_id: int
    vote: VoteType

class FeedbackResponse(BaseModel):
    id: int
    message_id: int
    vote: str
    created_at: str

class FeedbackStats(BaseModel):
    message_id: int
    up_votes: int
    down_votes: int
    total_votes: int
    net_score: int

def init_database():
    """Initialize SQLite database with required tables"""
    # Ensure data directory exists
    os.makedirs("data", exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create feedback table if it doesn't exist
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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON feedback(message_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_feedback_vote ON feedback(vote)")
    
    conn.commit()
    conn.close()

# Initialize database on module load
init_database()

@router.post("/v1/chat/feedback", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest):
    """Submit feedback for a chat message"""
    try:
        # First, verify that the message_id exists
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM chat_history WHERE id = ?", (request.message_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Insert feedback
        cursor.execute("""
            INSERT INTO feedback (message_id, vote)
            VALUES (?, ?)
        """, (request.message_id, request.vote.value))
        
        feedback_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return FeedbackResponse(
            id=feedback_id,
            message_id=request.message_id,
            vote=request.vote.value,
            created_at=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")

@router.get("/v1/chat/feedback/stats/{message_id}", response_model=FeedbackStats)
async def get_feedback_stats(message_id: int):
    """Get feedback statistics for a specific message"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Verify message exists
        cursor.execute("SELECT id FROM chat_history WHERE id = ?", (message_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Get vote counts
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN vote = 'up' THEN 1 ELSE 0 END) as up_votes,
                SUM(CASE WHEN vote = 'down' THEN 1 ELSE 0 END) as down_votes,
                COUNT(*) as total_votes
            FROM feedback
            WHERE message_id = ?
        """, (message_id,))
        
        result = cursor.fetchone()
        up_votes, down_votes, total_votes = result or (0, 0, 0)
        net_score = up_votes - down_votes
        
        conn.close()
        
        return FeedbackStats(
            message_id=message_id,
            up_votes=up_votes,
            down_votes=down_votes,
            total_votes=total_votes,
            net_score=net_score
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get feedback stats: {str(e)}")

@router.get("/v1/chat/feedback/user")
async def get_user_feedback(
    user_id: str = Query(..., description="User ID to get feedback for"),
    limit: int = Query(50, description="Maximum number of feedback entries to return", ge=1, le=1000)
):
    """Get feedback for messages from a specific user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT f.id, f.message_id, f.vote, f.created_at, ch.message, ch.reply
            FROM feedback f
            JOIN chat_history ch ON f.message_id = ch.id
            WHERE ch.user_id = ?
            ORDER BY f.created_at DESC
            LIMIT ?
        """, (user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        feedback_entries = []
        for row in rows:
            feedback_id, message_id, vote, created_at, message, reply = row
            feedback_entries.append({
                "feedback_id": feedback_id,
                "message_id": message_id,
                "vote": vote,
                "created_at": created_at,
                "message": message[:100] + "..." if len(message) > 100 else message,
                "reply": reply[:100] + "..." if len(reply) > 100 else reply
            })
        
        return {
            "user_id": user_id,
            "feedback_entries": feedback_entries,
            "total": len(feedback_entries)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user feedback: {str(e)}")

@router.delete("/v1/chat/feedback/{feedback_id}")
async def delete_feedback(feedback_id: int):
    """Delete a specific feedback entry"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM feedback WHERE id = ?", (feedback_id,))
        deleted_count = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        return {
            "message": f"Feedback {feedback_id} deleted successfully",
            "deleted_count": deleted_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete feedback: {str(e)}")

@router.get("/v1/chat/feedback/analytics")
async def get_feedback_analytics():
    """Get overall feedback analytics"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Overall stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total_feedback,
                SUM(CASE WHEN vote = 'up' THEN 1 ELSE 0 END) as total_up_votes,
                SUM(CASE WHEN vote = 'down' THEN 1 ELSE 0 END) as total_down_votes
            FROM feedback
        """)
        
        result = cursor.fetchone()
        total_feedback, total_up, total_down = result or (0, 0, 0)
        
        # Recent feedback (last 7 days)
        cursor.execute("""
            SELECT 
                COUNT(*) as recent_feedback,
                SUM(CASE WHEN vote = 'up' THEN 1 ELSE 0 END) as recent_up,
                SUM(CASE WHEN vote = 'down' THEN 1 ELSE 0 END) as recent_down
            FROM feedback
            WHERE created_at >= datetime('now', '-7 days')
        """)
        
        recent_result = cursor.fetchone()
        recent_feedback, recent_up, recent_down = recent_result or (0, 0, 0)
        
        # Top messages by feedback
        cursor.execute("""
            SELECT 
                ch.id,
                ch.user_id,
                ch.message,
                COUNT(f.id) as feedback_count,
                SUM(CASE WHEN f.vote = 'up' THEN 1 ELSE 0 END) as up_votes,
                SUM(CASE WHEN f.vote = 'down' THEN 1 ELSE 0 END) as down_votes
            FROM chat_history ch
            LEFT JOIN feedback f ON ch.id = f.message_id
            GROUP BY ch.id
            HAVING feedback_count > 0
            ORDER BY feedback_count DESC
            LIMIT 10
        """)
        
        top_messages = []
        for row in cursor.fetchall():
            message_id, user_id, message, feedback_count, up_votes, down_votes = row
            top_messages.append({
                "message_id": message_id,
                "user_id": user_id,
                "message": message[:100] + "..." if len(message) > 100 else message,
                "feedback_count": feedback_count,
                "up_votes": up_votes,
                "down_votes": down_votes,
                "net_score": up_votes - down_votes
            })
        
        conn.close()
        
        return {
            "overall_stats": {
                "total_feedback": total_feedback,
                "total_up_votes": total_up,
                "total_down_votes": total_down,
                "approval_rate": (total_up / total_feedback * 100) if total_feedback > 0 else 0
            },
            "recent_stats": {
                "recent_feedback": recent_feedback,
                "recent_up_votes": recent_up,
                "recent_down_votes": recent_down,
                "recent_approval_rate": (recent_up / recent_feedback * 100) if recent_feedback > 0 else 0
            },
            "top_messages": top_messages
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get feedback analytics: {str(e)}")
