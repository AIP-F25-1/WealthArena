"""
WealthArena Knowledge API
Knowledge base topics and educational content
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

router = APIRouter()

class KnowledgeTopic(BaseModel):
    id: str
    name: str
    description: str
    category: str
    difficulty: str  # "Beginner", "Intermediate", "Advanced"
    estimated_time: str  # e.g., "5 minutes", "15 minutes"
    prerequisites: List[str]
    learning_objectives: List[str]

class TopicList(BaseModel):
    topics: List[KnowledgeTopic]
    total: int
    categories: List[str]

# Knowledge base data
KNOWLEDGE_TOPICS = [
    KnowledgeTopic(
        id="trading_basics",
        name="Trading Basics",
        description="Learn the fundamental concepts of trading, including market types, order types, and basic terminology.",
        category="Fundamentals",
        difficulty="Beginner",
        estimated_time="10 minutes",
        prerequisites=[],
        learning_objectives=[
            "Understand what trading is and how markets work",
            "Learn about different types of orders",
            "Understand basic trading terminology",
            "Learn about market participants"
        ]
    ),
    KnowledgeTopic(
        id="technical_analysis",
        name="Technical Analysis",
        description="Master technical indicators, chart patterns, and price action analysis for better trading decisions.",
        category="Analysis",
        difficulty="Intermediate",
        estimated_time="20 minutes",
        prerequisites=["Trading Basics"],
        learning_objectives=[
            "Learn to read and interpret price charts",
            "Understand key technical indicators (RSI, MACD, Moving Averages)",
            "Identify chart patterns and trends",
            "Apply technical analysis to trading decisions"
        ]
    ),
    KnowledgeTopic(
        id="risk_management",
        name="Risk Management",
        description="Essential risk management principles to protect your capital and improve trading performance.",
        category="Strategy",
        difficulty="Intermediate",
        estimated_time="15 minutes",
        prerequisites=["Trading Basics"],
        learning_objectives=[
            "Understand the importance of risk management",
            "Learn position sizing techniques",
            "Master stop-loss and take-profit strategies",
            "Develop a risk management plan"
        ]
    ),
    KnowledgeTopic(
        id="rl_model_explained",
        name="RL Model Explained",
        description="Understand how reinforcement learning models work in trading and their applications.",
        category="Advanced",
        difficulty="Advanced",
        estimated_time="25 minutes",
        prerequisites=["Technical Analysis", "Risk Management"],
        learning_objectives=[
            "Understand reinforcement learning concepts",
            "Learn how RL models are applied to trading",
            "Understand model training and evaluation",
            "Learn about model limitations and considerations"
        ]
    ),
    KnowledgeTopic(
        id="market_psychology",
        name="Market Psychology",
        description="Understand the psychological aspects of trading and how emotions affect decision-making.",
        category="Psychology",
        difficulty="Intermediate",
        estimated_time="12 minutes",
        prerequisites=["Trading Basics"],
        learning_objectives=[
            "Understand common trading emotions",
            "Learn to control fear and greed",
            "Develop a disciplined trading mindset",
            "Learn about cognitive biases in trading"
        ]
    ),
    KnowledgeTopic(
        id="portfolio_management",
        name="Portfolio Management",
        description="Learn how to build and manage a diversified trading portfolio.",
        category="Strategy",
        difficulty="Intermediate",
        estimated_time="18 minutes",
        prerequisites=["Risk Management"],
        learning_objectives=[
            "Understand portfolio diversification",
            "Learn asset allocation strategies",
            "Understand correlation and its impact",
            "Develop a portfolio management plan"
        ]
    ),
    KnowledgeTopic(
        id="fundamental_analysis",
        name="Fundamental Analysis",
        description="Learn to analyze companies and markets using fundamental data and economic indicators.",
        category="Analysis",
        difficulty="Intermediate",
        estimated_time="22 minutes",
        prerequisites=["Trading Basics"],
        learning_objectives=[
            "Understand fundamental analysis concepts",
            "Learn to read financial statements",
            "Understand economic indicators",
            "Apply fundamental analysis to trading"
        ]
    ),
    KnowledgeTopic(
        id="trading_strategies",
        name="Trading Strategies",
        description="Explore different trading strategies including day trading, swing trading, and long-term investing.",
        category="Strategy",
        difficulty="Intermediate",
        estimated_time="20 minutes",
        prerequisites=["Technical Analysis", "Risk Management"],
        learning_objectives=[
            "Understand different trading styles",
            "Learn about day trading strategies",
            "Explore swing trading approaches",
            "Understand long-term investment strategies"
        ]
    )
]

@router.get("/v1/knowledge/topics", response_model=TopicList)
async def get_knowledge_topics(
    category: Optional[str] = Query(None, description="Filter by category"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty level"),
    search: Optional[str] = Query(None, description="Search in topic names and descriptions")
):
    """Get available knowledge topics"""
    try:
        filtered_topics = KNOWLEDGE_TOPICS.copy()
        
        # Apply filters
        if category:
            filtered_topics = [t for t in filtered_topics if t.category.lower() == category.lower()]
        
        if difficulty:
            filtered_topics = [t for t in filtered_topics if t.difficulty.lower() == difficulty.lower()]
        
        if search:
            search_lower = search.lower()
            filtered_topics = [
                t for t in filtered_topics 
                if search_lower in t.name.lower() or search_lower in t.description.lower()
            ]
        
        # Get unique categories
        categories = list(set(topic.category for topic in KNOWLEDGE_TOPICS))
        
        return TopicList(
            topics=filtered_topics,
            total=len(filtered_topics),
            categories=categories
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get knowledge topics: {str(e)}")

@router.get("/v1/knowledge/topics/{topic_id}")
async def get_topic_details(topic_id: str):
    """Get detailed information about a specific topic"""
    try:
        topic = next((t for t in KNOWLEDGE_TOPICS if t.id == topic_id), None)
        
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        return topic
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get topic details: {str(e)}")

@router.get("/v1/knowledge/categories")
async def get_knowledge_categories():
    """Get all available knowledge categories"""
    try:
        categories = list(set(topic.category for topic in KNOWLEDGE_TOPICS))
        
        # Get topic count per category
        category_stats = {}
        for topic in KNOWLEDGE_TOPICS:
            if topic.category not in category_stats:
                category_stats[topic.category] = 0
            category_stats[topic.category] += 1
        
        return {
            "categories": categories,
            "category_stats": category_stats,
            "total_categories": len(categories)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get categories: {str(e)}")

@router.get("/v1/knowledge/difficulty-levels")
async def get_difficulty_levels():
    """Get available difficulty levels"""
    try:
        levels = list(set(topic.difficulty for topic in KNOWLEDGE_TOPICS))
        
        # Get topic count per difficulty
        difficulty_stats = {}
        for topic in KNOWLEDGE_TOPICS:
            if topic.difficulty not in difficulty_stats:
                difficulty_stats[topic.difficulty] = 0
            difficulty_stats[topic.difficulty] += 1
        
        return {
            "difficulty_levels": levels,
            "difficulty_stats": difficulty_stats,
            "total_levels": len(levels)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get difficulty levels: {str(e)}")

@router.get("/v1/knowledge/recommended")
async def get_recommended_topics(
    user_level: str = Query("Beginner", description="User's current level"),
    limit: int = Query(5, description="Number of recommendations", ge=1, le=10)
):
    """Get recommended topics based on user level"""
    try:
        # Define learning paths
        learning_paths = {
            "Beginner": ["trading_basics", "market_psychology"],
            "Intermediate": ["technical_analysis", "risk_management", "fundamental_analysis"],
            "Advanced": ["rl_model_explained", "trading_strategies", "portfolio_management"]
        }
        
        # Get recommended topics
        recommended_ids = learning_paths.get(user_level, learning_paths["Beginner"])
        recommended_topics = [t for t in KNOWLEDGE_TOPICS if t.id in recommended_ids]
        
        # Add related topics
        if user_level == "Beginner":
            # Add some intermediate topics as "next steps"
            next_steps = [t for t in KNOWLEDGE_TOPICS if t.difficulty == "Intermediate"][:2]
            recommended_topics.extend(next_steps)
        
        # Limit results
        recommended_topics = recommended_topics[:limit]
        
        return {
            "user_level": user_level,
            "recommended_topics": recommended_topics,
            "total_recommendations": len(recommended_topics)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")

@router.get("/v1/knowledge/search")
async def search_knowledge(
    query: str = Query(..., description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty")
):
    """Search knowledge topics"""
    try:
        query_lower = query.lower()
        results = []
        
        for topic in KNOWLEDGE_TOPICS:
            # Check if query matches in name, description, or objectives
            matches = (
                query_lower in topic.name.lower() or
                query_lower in topic.description.lower() or
                any(query_lower in obj.lower() for obj in topic.learning_objectives)
            )
            
            if matches:
                # Apply additional filters
                if category and topic.category.lower() != category.lower():
                    continue
                if difficulty and topic.difficulty.lower() != difficulty.lower():
                    continue
                
                results.append(topic)
        
        return {
            "query": query,
            "results": results,
            "total_results": len(results),
            "filters": {
                "category": category,
                "difficulty": difficulty
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search knowledge: {str(e)}")

@router.get("/v1/knowledge/stats")
async def get_knowledge_stats():
    """Get knowledge base statistics"""
    try:
        total_topics = len(KNOWLEDGE_TOPICS)
        
        # Count by category
        category_counts = {}
        for topic in KNOWLEDGE_TOPICS:
            category_counts[topic.category] = category_counts.get(topic.category, 0) + 1
        
        # Count by difficulty
        difficulty_counts = {}
        for topic in KNOWLEDGE_TOPICS:
            difficulty_counts[topic.difficulty] = difficulty_counts.get(topic.difficulty, 0) + 1
        
        # Calculate average time
        total_time_minutes = 0
        for topic in KNOWLEDGE_TOPICS:
            # Extract number from estimated_time (e.g., "10 minutes" -> 10)
            try:
                time_str = topic.estimated_time.split()[0]
                total_time_minutes += int(time_str)
            except:
                pass
        
        avg_time = total_time_minutes / total_topics if total_topics > 0 else 0
        
        return {
            "total_topics": total_topics,
            "category_distribution": category_counts,
            "difficulty_distribution": difficulty_counts,
            "average_learning_time_minutes": round(avg_time, 1),
            "total_learning_time_hours": round(total_time_minutes / 60, 1),
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get knowledge stats: {str(e)}")
