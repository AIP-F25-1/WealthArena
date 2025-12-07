"""
WealthArena Onboarding API
AI-powered onboarding endpoints that dynamically determine user experience level
"""

import json
import random
import time
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

from ..llm.client import LLMClient

router = APIRouter()

# Initialize LLM client
llm_client = LLMClient()

# In-memory storage for onboarding sessions (in production, use Redis or database)
onboarding_sessions: Dict[str, Dict[str, Any]] = {}

class OnboardingStartReq(BaseModel):
    sessionId: Optional[str] = None
    firstName: str
    email: str
    userId: int

class OnboardingStartResp(BaseModel):
    sessionId: str
    welcomeMessage: str
    estimatedQuestions: int

class OnboardingRespondReq(BaseModel):
    sessionId: str
    answer: str | List[str]
    conversationHistory: List[Dict[str, Any]]
    userAnswers: List[Dict[str, Any]]
    userContext: Optional[Dict[str, Any]] = None

class Question(BaseModel):
    id: str
    text: str
    type: str  # 'text', 'choice', 'multi'
    options: Optional[List[str]] = None
    mascotVariant: Optional[str] = None

class ProfileUpdates(BaseModel):
    experienceLevel: Optional[str] = None
    investmentGoals: Optional[List[str]] = None
    riskTolerance: Optional[str] = None
    timeHorizon: Optional[str] = None
    learningStyle: Optional[str] = None
    interestAreas: Optional[List[str]] = None

class OnboardingRespondResp(BaseModel):
    nextQuestion: Optional[Question] = None
    estimatedRemaining: int
    profileUpdates: Optional[ProfileUpdates] = None
    complete: bool = False

class OnboardingCompleteReq(BaseModel):
    sessionId: str
    conversationHistory: List[Dict[str, Any]]
    userAnswers: List[Dict[str, Any]]
    userProfile: Optional[Dict[str, Any]] = None
    userContext: Optional[Dict[str, Any]] = None

class OnboardingCompleteResp(BaseModel):
    completionMessage: str
    finalProfile: Dict[str, Any]
    rewards: Dict[str, int]

def _get_onboarding_system_prompt() -> str:
    """Get the system prompt for onboarding AI"""
    return """You are Foxy, WealthArena's friendly AI trading coach helping new users through onboarding.

Your goal is to have a natural conversation to understand:
1. Their trading/investing experience level (beginner, intermediate, or advanced)
2. Their primary investment goals
3. Their risk tolerance (conservative, moderate, aggressive, very_aggressive)
4. Their time horizon (short, medium, long, very_long)
5. Their learning style (hands-on, structured, exploratory)
6. Their areas of interest in trading

IMPORTANT GUIDELINES:
- Keep questions natural and conversational - don't sound robotic
- Ask ONE question at a time
- Adapt your questions based on their responses
- If they mention experience, acknowledge it and dig deeper naturally
- Ask follow-up questions to clarify ambiguous answers
- Determine experience level through conversation, not a single direct question
- MAXIMUM 8 QUESTIONS TOTAL - After 8 questions, you MUST set complete: true
- Typically complete after 4-6 questions if you have enough information

RESPONSE FORMAT:
You must respond with ONLY a valid JSON object in this exact format:
{
  "nextQuestion": {
    "id": "unique_id",
    "text": "Your natural question here",
    "type": "text" | "choice" | "multi",
    "options": ["option1", "option2"] (only if type is "choice" or "multi"),
    "mascotVariant": "excited" | "learning" | "confident" | "thinking" | "cautious"
  },
  "profileUpdates": {
    "experienceLevel": "beginner" | "intermediate" | "advanced" (only if confident),
    "riskTolerance": "conservative" | "moderate" | "aggressive" | "very_aggressive" (only if confident),
    "investmentGoals": ["goal1", "goal2"] (only if identified),
    "timeHorizon": "short" | "medium" | "long" | "very_long" (only if confident),
    "learningStyle": "hands-on" | "structured" | "exploratory" (only if identified),
    "interestAreas": ["area1", "area2"] (only if identified)
  },
  "estimatedRemaining": number (1-5),
  "complete": false (true when done, usually after 4-6 questions)
}

IMPORTANT:
- Respond with ONLY the JSON object, no other text
- Experience level should be determined through conversation context, not a direct question
- Only include profileUpdates fields when you have enough confidence from their answers
- Set complete: true when you have enough information (typically 4-6 questions)
- Make questions feel natural and adapted to their responses"""

async def _analyze_user_response_for_profile(answer: str | List[str], conversation_history: List[Dict], user_answers: List[Dict]) -> Dict[str, Any]:
    """Use AI to analyze user responses and extract profile information"""
    
    # Build context from conversation
    conversation_text = "\n".join([
        f"{'Bot' if msg.get('isBot') else 'User'}: {msg.get('text', '')}"
        for msg in conversation_history[-10:]  # Last 10 messages for context
    ])
    
    answer_text = answer if isinstance(answer, str) else ", ".join(answer)
    analysis_prompt = f"""Based on the onboarding conversation below, analyze the user's profile:

Conversation:
{conversation_text}

Latest Answer: {answer_text}

Previous Answers:
{json.dumps([ans.get('answer', '') for ans in user_answers], indent=2)}

Analyze and extract:
1. experienceLevel: "beginner", "intermediate", or "advanced" (determine from context, not explicit answer)
2. riskTolerance: "conservative", "moderate", "aggressive", or "very_aggressive"
3. investmentGoals: list of goals mentioned
4. timeHorizon: "short", "medium", "long", or "very_long"
5. learningStyle: "hands-on", "structured", or "exploratory"
6. interestAreas: list of trading topics they're interested in

Respond with ONLY a valid JSON object:
{{
  "experienceLevel": "value" or null,
  "riskTolerance": "value" or null,
  "investmentGoals": ["goal1"] or null,
  "timeHorizon": "value" or null,
  "learningStyle": "value" or null,
  "interestAreas": ["area1"] or null
}}

Only include fields you're confident about based on the conversation. Return null for uncertain fields."""

    try:
        messages = [
            {"role": "system", "content": "You are an expert at analyzing user responses to extract trading profile information. Always respond with valid JSON only."},
            {"role": "user", "content": analysis_prompt}
        ]
        
        response = await llm_client.chat(messages)
        
        # Parse JSON response
        # Remove markdown code blocks if present
        response_clean = response.strip()
        if response_clean.startswith("```"):
            response_clean = response_clean.split("```")[1]
            if response_clean.startswith("json"):
                response_clean = response_clean[4:]
            response_clean = response_clean.strip()
        if response_clean.endswith("```"):
            response_clean = response_clean[:-3].strip()
        
        profile_data = json.loads(response_clean)
        
        # Clean up null values
        return {k: v for k, v in profile_data.items() if v is not None}
    except Exception as e:
        # If analysis fails, return empty dict
        print(f"Error analyzing profile: {e}")
        return {}

async def _generate_next_question(conversation_history: List[Dict], user_answers: List[Dict], current_profile: Dict[str, Any], user_context: Optional[Dict]) -> Dict[str, Any]:
    """Use AI to generate the next onboarding question"""
    
    # Build conversation context
    conversation_text = "\n".join([
        f"{'Bot' if msg.get('isBot') else 'User'}: {msg.get('text', '')}"
        for msg in conversation_history
    ])
    
    user_name = user_context.get('firstName', 'there') if user_context else 'there'
    
    prompt = f"""Continue the onboarding conversation. Here's what we've discussed so far:

Conversation History:
{conversation_text}

User's Name: {user_name}

Current Profile Information (what we know so far):
{json.dumps(current_profile, indent=2)}

Number of questions asked so far: {len([m for m in conversation_history if m.get('isBot')])}

CRITICAL: MAXIMUM 8 QUESTIONS TOTAL. If we've asked 8 or more questions, you MUST set complete: true.
Otherwise, if we have enough information (typically after 4-6 questions), set complete: true.

Remember:
- Keep questions natural and conversational
- Adapt based on what they've already told us
- Don't ask redundant questions
- Determine experience level through conversation, not a direct "What's your experience?" question
- After 4-6 questions, you should have enough to complete the profile

Respond with ONLY the JSON object as specified in the system prompt."""

    try:
        messages = [
            {"role": "system", "content": _get_onboarding_system_prompt()},
            {"role": "user", "content": prompt}
        ]
        
        response = await llm_client.chat(messages)
        
        # Parse JSON response
        response_clean = response.strip()
        if response_clean.startswith("```"):
            response_clean = response_clean.split("```")[1]
            if response_clean.startswith("json"):
                response_clean = response_clean[4:]
            response_clean = response_clean.strip()
        if response_clean.endswith("```"):
            response_clean = response_clean[:-3].strip()
        
        question_data = json.loads(response_clean)
        return question_data
    except Exception as e:
        print(f"Error generating question: {e}")
        # Fallback: return completion if we can't generate
        return {
            "nextQuestion": None,
            "estimatedRemaining": 0,
            "complete": True,
            "profileUpdates": {}
        }

@router.post("/onboarding/start", response_model=OnboardingStartResp)
async def start_onboarding(request: OnboardingStartReq):
    """Start a new onboarding session"""
    
    session_id = request.sessionId or f"onboarding_{request.userId}_{int(time.time())}"
    
    # Store session
    onboarding_sessions[session_id] = {
        "userId": request.userId,
        "firstName": request.firstName,
        "email": request.email,
        "startTime": datetime.now().isoformat(),
        "conversationHistory": [],
        "userAnswers": [],
        "profile": {}
    }
    
    # Generate welcome message using AI
    welcome_prompt = f"""Create a warm, personalized welcome message for {request.firstName} starting their WealthArena onboarding journey.

Keep it friendly, brief (2-3 sentences), and exciting. Include a brief introduction of yourself as Foxy, their AI trading coach.

Respond with ONLY the welcome message text, no JSON or formatting."""
    
    try:
        messages = [
            {"role": "system", "content": "You are Foxy, WealthArena's friendly AI trading coach. Create warm, personalized welcome messages."},
            {"role": "user", "content": welcome_prompt}
        ]
        welcome_message = await llm_client.chat(messages)
    except Exception as e:
        print(f"Error generating welcome message: {e}")
        welcome_message = f"Hi {request.firstName}! Welcome to WealthArena! I'm Foxy, your AI trading coach. Let's get to know you better so I can personalize your experience."
    
    return OnboardingStartResp(
        sessionId=session_id,
        welcomeMessage=welcome_message,
        estimatedQuestions=5
    )

@router.post("/onboarding/respond", response_model=OnboardingRespondResp)
async def respond_onboarding(request: OnboardingRespondReq):
    """Process onboarding response and get next question"""
    
    # Get session
    session = onboarding_sessions.get(request.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")
    
    # Update session
    session["conversationHistory"] = request.conversationHistory
    session["userAnswers"] = request.userAnswers
    
    # Analyze user response to extract profile information
    profile_updates = await _analyze_user_response_for_profile(
        request.answer,
        request.conversationHistory,
        request.userAnswers
    )
    
    # Merge with existing profile
    session["profile"].update(profile_updates)
    
    # Check if we've reached max questions (8)
    question_count = len([m for m in request.conversationHistory if m.get('isBot')])
    MAX_QUESTIONS = 8
    
    if question_count >= MAX_QUESTIONS:
        # Force completion if we've reached max
        return OnboardingRespondResp(
            nextQuestion=None,
            estimatedRemaining=0,
            profileUpdates=None,
            complete=True
        )
    
    # Generate next question using AI
    question_data = await _generate_next_question(
        request.conversationHistory,
        request.userAnswers,
        session["profile"],
        request.userContext
    )
    
    # Enforce max questions - if next question would exceed limit, complete instead
    if question_count + 1 >= MAX_QUESTIONS:
        question_data["complete"] = True
        question_data["nextQuestion"] = None
    
    # Build response
    next_question = None
    if question_data.get("nextQuestion"):
        q = question_data["nextQuestion"]
        next_question = Question(
            id=q.get("id", f"q_{int(time.time())}"),
            text=q.get("text", ""),
            type=q.get("type", "text"),
            options=q.get("options"),
            mascotVariant=q.get("mascotVariant", "learning")
        )
    
    profile_updates_obj = None
    if question_data.get("profileUpdates") or profile_updates:
        merged_updates = {**question_data.get("profileUpdates", {}), **profile_updates}
        if merged_updates:
            profile_updates_obj = ProfileUpdates(**merged_updates)
    
    complete = question_data.get("complete", False)
    estimated_remaining = question_data.get("estimatedRemaining", 0) if not complete else 0
    
    return OnboardingRespondResp(
        nextQuestion=next_question,
        estimatedRemaining=estimated_remaining,
        profileUpdates=profile_updates_obj,
        complete=complete
    )

@router.post("/onboarding/complete", response_model=OnboardingCompleteResp)
async def complete_onboarding(request: OnboardingCompleteReq):
    """Complete onboarding and get final profile"""
    
    # Get session
    session = onboarding_sessions.get(request.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")
    
    # Merge all profile information
    final_profile = {
        **session.get("profile", {}),
        **(request.userProfile or {})
    }
    
    # Use AI to finalize profile if needed
    if not final_profile.get("experienceLevel"):
        # Analyze all responses to determine experience level
        analysis_prompt = f"""Based on the complete onboarding conversation below, determine the user's experience level (beginner, intermediate, or advanced).

Conversation:
{json.dumps(request.conversationHistory, indent=2)}

All User Answers:
{json.dumps(request.userAnswers, indent=2)}

Respond with ONLY a JSON object:
{{
  "experienceLevel": "beginner" | "intermediate" | "advanced"
}}

Use context clues: mentioning years of experience, specific strategies, technical terms, trading platforms, etc."""
        
        try:
            messages = [
                {"role": "system", "content": "You are an expert at determining trading experience levels from conversations. Always respond with valid JSON only."},
                {"role": "user", "content": analysis_prompt}
            ]
            response = await llm_client.chat(messages)
            response_clean = response.strip()
            if response_clean.startswith("```"):
                response_clean = response_clean.split("```")[1]
                if response_clean.startswith("json"):
                    response_clean = response_clean[4:]
                response_clean = response_clean.strip()
            if response_clean.endswith("```"):
                response_clean = response_clean[:-3].strip()
            analysis = json.loads(response_clean)
            final_profile.update(analysis)
        except Exception as e:
            print(f"Error finalizing profile: {e}")
            # Default to beginner if we can't determine
            final_profile.setdefault("experienceLevel", "beginner")
    
    # Generate completion message
    user_name = request.userContext.get("firstName", "there") if request.userContext else "there"
    completion_prompt = f"""Create a warm completion message for {user_name} finishing onboarding.

Their profile:
Experience: {final_profile.get('experienceLevel', 'beginner')}
Goals: {final_profile.get('investmentGoals', [])}
Risk: {final_profile.get('riskTolerance', 'moderate')}

Keep it brief (2-3 sentences), encouraging, and exciting about starting their trading journey.

Respond with ONLY the completion message text, no JSON."""
    
    try:
        messages = [
            {"role": "system", "content": "You are Foxy, WealthArena's friendly AI trading coach. Create warm, encouraging completion messages."},
            {"role": "user", "content": completion_prompt}
        ]
        completion_message = await llm_client.chat(messages)
    except Exception as e:
        print(f"Error generating completion message: {e}")
        completion_message = f"Congratulations, {user_name}! Your profile is ready. Let's start your trading journey!"
    
    # Clean up session
    onboarding_sessions.pop(request.sessionId, None)
    
    return OnboardingCompleteResp(
        completionMessage=completion_message,
        finalProfile=final_profile,
        rewards={"xp": 50, "coins": 500}
    )

