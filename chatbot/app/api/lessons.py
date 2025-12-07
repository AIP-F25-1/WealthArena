"""
WealthArena Lesson Generation API
Generates Duolingo-style lessons using Groq AI
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import json
import os
from app.llm.client import LLMClient

router = APIRouter()
llm_client = LLMClient()

class QuestionOption(BaseModel):
    text: str
    isCorrect: bool

class LessonQuestion(BaseModel):
    id: str
    type: str  # "multiple_choice", "fill_blank", "matching", "true_false", "translation"
    question: str
    options: Optional[List[QuestionOption]] = None
    correctAnswer: Optional[str] = None
    explanation: str
    difficulty: str = "beginner"  # "beginner", "intermediate", "advanced"

class Lesson(BaseModel):
    id: str
    topicId: str
    title: str
    description: str
    content: str
    questions: List[LessonQuestion]
    xpReward: int = 10
    coinReward: int = 5
    estimatedDuration: int = 5  # minutes
    difficulty: str = "beginner"

class GenerateLessonRequest(BaseModel):
    topic: str
    topicId: str
    difficulty: str = "beginner"
    lessonCount: int = 1

@router.post("/lessons/generate", response_model=List[Lesson])
async def generate_lessons(request: GenerateLessonRequest):
    """
    Generate Duolingo-style lessons for a topic using Groq AI
    """
    try:
        # Validate and limit lessonCount to prevent resource exhaustion
        # Limit to reasonable maximum (e.g., 20 lessons)
        MAX_LESSONS = 20
        lesson_count = min(max(1, request.lessonCount), MAX_LESSONS)
        if request.lessonCount != lesson_count:
            raise HTTPException(
                status_code=400,
                detail=f"lessonCount must be between 1 and {MAX_LESSONS}. Received: {request.lessonCount}"
            )
        
        lessons = []
        
        for i in range(lesson_count):
            lesson_id = f"{request.topicId}_lesson_{i+1}"
            
            # Generate lesson content and questions using Groq
            system_prompt = f"""You are an expert financial education instructor creating comprehensive slideshow-style lessons for WealthArena.

Create a detailed, engaging lesson about "{request.topic}" at {request.difficulty} level.

REQUIREMENTS:
1. Create structured content perfect for a slideshow format (3-4 main sections)
2. Create 6-10 interactive quiz questions (more comprehensive)
3. Use multiple question types: multiple choice (4 options), fill in the blank, true/false, matching
4. Make questions progressive (start easy, get harder)
5. Include detailed, educational explanations for each answer (2-3 sentences)
6. Focus on practical, actionable knowledge with real-world examples
7. Content should be thorough but digestible - explain concepts clearly

OUTPUT FORMAT (JSON):
{{
  "title": "Lesson title (max 60 chars, descriptive and engaging)",
  "description": "Brief description (max 200 chars, hook the learner)",
  "content": "Main lesson content structured for slideshow format. Use double line breaks (\\n\\n) to separate sections. Start each major section with '## Section Title'. Use bullet points with '• ' for lists. Keep each section concise but informative (2-3 paragraphs per section max).",
  "questions": [
    {{
      "type": "multiple_choice|fill_blank|true_false|matching",
      "question": "Question text (clear and specific)",
      "options": ["option1", "option2", "option3", "option4"] (for multiple_choice - always 4 options),
      "correctAnswer": "correct answer or index (0-3 for multiple choice)",
      "explanation": "Detailed explanation why this answer is correct (2-3 sentences, educational)",
      "difficulty": "{request.difficulty}"
    }}
  ]
}}

CONTENT STRUCTURE EXAMPLE:
"## Introduction\\n\\nBrief overview of the topic and why it matters.\\n\\n## Key Concepts\\n\\n• First important concept\\n• Second important concept\\n• Third important concept\\n\\nExplanation of these concepts with examples.\\n\\n## Practical Applications\\n\\nReal-world scenarios and how to apply this knowledge.\\n\\n## Summary\\n\\nKey takeaways and next steps."

Make it engaging, well-structured for slides, and suitable for {request.difficulty} level learners."""

            user_prompt = f"Create comprehensive lesson {i+1} about {request.topic} at {request.difficulty} level with 6-10 questions covering different aspects of the topic. Make it thorough and educational. Return ONLY valid JSON, no markdown formatting."

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # Call Groq API
            response_text = await llm_client.chat(messages)
            
            # Parse JSON response (handle markdown code blocks if present)
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            lesson_data = json.loads(response_text)
            
            # Convert to Lesson model
            questions = []
            for q in lesson_data.get("questions", []):
                question_type = q.get("type", "multiple_choice")
                
                # Process options for multiple choice
                options = None
                correct_answer = q.get("correctAnswer", "")
                
                if question_type == "multiple_choice":
                    option_texts = q.get("options", [])
                    correct_idx = None
                    
                    # Handle if correctAnswer is an index
                    if isinstance(correct_answer, int) or (isinstance(correct_answer, str) and correct_answer.isdigit()):
                        correct_idx = int(correct_answer)
                        correct_answer = option_texts[correct_idx] if correct_idx < len(option_texts) else ""
                    
                    options = [
                        QuestionOption(text=opt, isCorrect=(opt == correct_answer or idx == correct_idx))
                        for idx, opt in enumerate(option_texts)
                    ]
                elif question_type == "true_false":
                    options = [
                        QuestionOption(text="True", isCorrect=correct_answer.lower() in ["true", "t", "1"]),
                        QuestionOption(text="False", isCorrect=correct_answer.lower() in ["false", "f", "0"])
                    ]
                
                questions.append(LessonQuestion(
                    id=f"q_{len(questions)+1}",
                    type=question_type,
                    question=q.get("question", ""),
                    options=options,
                    correctAnswer=str(correct_answer),
                    explanation=q.get("explanation", ""),
                    difficulty=q.get("difficulty", request.difficulty)
                ))
            
            lesson = Lesson(
                id=lesson_id,
                topicId=request.topicId,
                title=lesson_data.get("title", f"Lesson {i+1}: {request.topic}"),
                description=lesson_data.get("description", ""),
                content=lesson_data.get("content", ""),
                questions=questions,
                xpReward=15 if request.difficulty == "beginner" else (25 if request.difficulty == "intermediate" else 35),
                coinReward=8 if request.difficulty == "beginner" else (15 if request.difficulty == "intermediate" else 25),
                estimatedDuration=5 + len(questions),
                difficulty=request.difficulty
            )
            
            lessons.append(lesson)
        
        return lessons
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse lesson JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate lessons: {str(e)}")

@router.get("/lessons/topic/{topic_id}", response_model=List[Lesson])
async def get_topic_lessons(topic_id: str, difficulty: str = "beginner"):
    """
    Get all lessons for a topic (generates if not cached)
    """
    # In production, this would check database first
    # For now, generate on demand
    request = GenerateLessonRequest(
        topic=topic_id.replace("_", " ").title(),
        topicId=topic_id,
        difficulty=difficulty,
        lessonCount=5  # Default 5 lessons per topic
    )
    
    return await generate_lessons(request)

