"""
Sentiment Analysis Model
Loads the fine-tuned sentiment model and provides scoring functionality
"""

import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from pathlib import Path
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

class SentimentModel:
    """Sentiment analysis model for financial text"""
    
    def __init__(self, model_path: str = "models/sentiment-finetuned"):
        """
        Initialize the sentiment model
        
        Args:
            model_path: Path to the fine-tuned sentiment model
        """
        self.model_path = Path(model_path)
        self.model = None
        self.tokenizer = None
        self.label_mapping = {
            0: "negative",
            1: "neutral", 
            2: "positive"
        }
        self._load_model()
    
    def _load_model(self):
        """Load the fine-tuned model and tokenizer"""
        try:
            # Check if the fine-tuned model exists and has files
            model_files = list(self.model_path.glob("*.json")) + list(self.model_path.glob("*.bin")) + list(self.model_path.glob("*.safetensors"))
            
            if not self.model_path.exists() or len(model_files) == 0:
                logger.warning(f"Fine-tuned model not found at {self.model_path}. Using base DistilBERT model.")
                # Fall back to base model
                model_name = "distilbert-base-uncased"
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    model_name, 
                    num_labels=3,
                    id2label={0: "negative", 1: "neutral", 2: "positive"},
                    label2id={"negative": 0, "neutral": 1, "positive": 2}
                )
                logger.info("Base DistilBERT model loaded (not fine-tuned)")
            else:
                logger.info(f"Loading fine-tuned sentiment model from {self.model_path}")
                # Load fine-tuned model
                self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_path))
                self.model = AutoModelForSequenceClassification.from_pretrained(str(self.model_path))
                logger.info("Fine-tuned sentiment model loaded successfully")
            
            # Set model to evaluation mode
            self.model.eval()
            
        except Exception as e:
            logger.error(f"Failed to load sentiment model: {e}")
            raise
    
    def score(self, text: str) -> Dict[str, any]:
        """
        Analyze sentiment of the given text
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary containing:
            - label: Predicted sentiment label (negative, neutral, positive)
            - probs: List of probabilities for each class [negative, neutral, positive]
        """
        if not self.model or not self.tokenizer:
            raise RuntimeError("Model not loaded. Please initialize the model first.")
        
        try:
            # Tokenize the input text
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                padding=True,
                max_length=512
            )
            
            # Get model predictions
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
                
                # Apply softmax to get probabilities
                probabilities = torch.softmax(logits, dim=-1)
                probs = probabilities.squeeze().numpy().tolist()
                
                # Get predicted class
                predicted_class = torch.argmax(logits, dim=-1).item()
                predicted_label = self.label_mapping[predicted_class]
            
            return {
                "label": predicted_label,
                "probs": probs
            }
            
        except Exception as e:
            logger.error(f"Error during sentiment analysis: {e}")
            raise

# Global instance for reuse
_sentiment_model = None

def get_sentiment_model() -> SentimentModel:
    """Get or create the global sentiment model instance"""
    global _sentiment_model
    if _sentiment_model is None:
        _sentiment_model = SentimentModel()
    return _sentiment_model

def score(text: str) -> Dict[str, any]:
    """
    Convenience function to score text sentiment
    
    Args:
        text: Text to analyze
        
    Returns:
        Dictionary containing label and probabilities
    """
    model = get_sentiment_model()
    return model.score(text)
