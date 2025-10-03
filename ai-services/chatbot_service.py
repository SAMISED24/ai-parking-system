#!/usr/bin/env python3
"""
AI Parking System - Chatbot Service
LLM-powered chatbot for parking system queries
"""

import json
import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import requests
from dataclasses import dataclass

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("Warning: OpenAI library not available, using mock responses")

from utils import setup_logging

logger = setup_logging(__name__)

@dataclass
class ParkingQuery:
    """Data class for parking-related queries"""
    intent: str
    entities: Dict[str, Any]
    confidence: float
    original_text: str

class ChatbotService:
    """LLM-powered chatbot for parking system assistance"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-3.5-turbo"):
        """
        Initialize chatbot service
        
        Args:
            api_key: OpenAI API key (if None, uses environment variable)
            model: OpenAI model to use
        """
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        self.model = model
        self.client = None
        
        # Intent patterns for parking queries
        self.intent_patterns = {
            'find_parking': [
                r'find.*parking', r'available.*slot', r'free.*space', 
                r'where.*park', r'parking.*spot'
            ],
            'check_occupancy': [
                r'how.*full', r'occupancy.*rate', r'how.*busy',
                r'spaces.*left', r'available.*now'
            ],
            'get_directions': [
                r'how.*get.*there', r'directions', r'navigate',
                r'where.*is.*lot', r'location'
            ],
            'check_duration': [
                r'how.*long.*park', r'time.*limit', r'duration',
                r'how.*much.*time', r'parking.*hours'
            ],
            'check_pricing': [
                r'cost', r'price', r'fee', r'rate', r'charge',
                r'how.*much.*pay'
            ],
            'report_issue': [
                r'problem', r'issue', r'broken', r'not.*working',
                r'report', r'complaint'
            ],
            'get_help': [
                r'help', r'assist', r'support', r'how.*use',
                r'what.*can.*do'
            ]
        }
        
        # System context for the chatbot
        self.system_context = """
        You are an AI assistant for a smart parking system. You help users with:
        - Finding available parking spaces
        - Checking occupancy rates and availability
        - Providing directions to parking lots
        - Explaining parking duration and time limits
        - Answering questions about pricing and fees
        - Helping with technical issues
        - General parking system assistance
        
        Always be helpful, concise, and friendly. Use real-time data when available.
        If you don't have specific information, acknowledge this and offer alternatives.
        """
        
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize OpenAI client"""
        if OPENAI_AVAILABLE and self.api_key:
            try:
                openai.api_key = self.api_key
                self.client = openai
                logger.info("OpenAI client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {str(e)}")
                self.client = None
        else:
            logger.warning("OpenAI not available or no API key, using mock responses")
            self.client = None
    
    def process_query(self, user_message: str, context: Optional[Dict] = None) -> Dict:
        """
        Process user query and generate response
        
        Args:
            user_message: User's message/question
            context: Optional context (parking lot data, user info, etc.)
            
        Returns:
            Dictionary with response and metadata
        """
        logger.info(f"Processing query: {user_message[:100]}...")
        
        # Analyze intent
        query_analysis = self._analyze_intent(user_message)
        
        # Generate response based on intent
        if self.client:
            response = self._generate_llm_response(user_message, context, query_analysis)
        else:
            response = self._generate_mock_response(query_analysis, context)
        
        return {
            'response': response,
            'intent': query_analysis.intent,
            'confidence': query_analysis.confidence,
            'entities': query_analysis.entities,
            'timestamp': datetime.now().isoformat(),
            'context_used': context is not None
        }
    
    def _analyze_intent(self, message: str) -> ParkingQuery:
        """Analyze user message to determine intent"""
        message_lower = message.lower()
        
        # Check each intent pattern
        best_intent = 'general'
        best_confidence = 0.0
        
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    confidence = len(re.findall(pattern, message_lower)) * 0.3
                    if confidence > best_confidence:
                        best_intent = intent
                        best_confidence = min(confidence, 1.0)
        
        # Extract entities (simple keyword extraction)
        entities = self._extract_entities(message_lower)
        
        return ParkingQuery(
            intent=best_intent,
            entities=entities,
            confidence=best_confidence,
            original_text=message
        )
    
    def _extract_entities(self, message: str) -> Dict[str, Any]:
        """Extract entities from user message"""
        entities = {}
        
        # Extract numbers (could be lot numbers, slot numbers, etc.)
        numbers = re.findall(r'\b\d+\b', message)
        if numbers:
            entities['numbers'] = [int(n) for n in numbers]
        
        # Extract time references
        time_patterns = {
            'now': r'\bnow\b|\bcurrent\b|\btoday\b',
            'hours': r'(\d+)\s*hour',
            'minutes': r'(\d+)\s*minute',
            'tomorrow': r'\btomorrow\b',
            'weekend': r'\bweekend\b'
        }
        
        for time_type, pattern in time_patterns.items():
            matches = re.findall(pattern, message)
            if matches:
                entities[time_type] = matches
        
        # Extract location references
        location_keywords = ['lot', 'level', 'floor', 'section', 'area', 'zone']
        for keyword in location_keywords:
            if keyword in message:
                entities['location_type'] = keyword
        
        return entities
    
    def _generate_llm_response(self, message: str, context: Optional[Dict], 
                              query_analysis: ParkingQuery) -> str:
        """Generate response using OpenAI LLM"""
        try:
            # Prepare context information
            context_info = ""
            if context:
                if 'parking_lots' in context:
                    lots_info = []
                    for lot in context['parking_lots']:
                        lots_info.append(
                            f"Lot {lot.get('name', 'Unknown')}: "
                            f"{lot.get('available_slots', 0)} available out of "
                            f"{lot.get('total_slots', 0)} total slots"
                        )
                    context_info += f"Current parking status:\n{chr(10).join(lots_info)}\n"
                
                if 'user_location' in context:
                    context_info += f"User location: {context['user_location']}\n"
                
                if 'current_time' in context:
                    context_info += f"Current time: {context['current_time']}\n"
            
            # Prepare the prompt
            prompt = f"""
            {self.system_context}
            
            Context information:
            {context_info}
            
            User query intent: {query_analysis.intent}
            Detected entities: {query_analysis.entities}
            
            User message: "{message}"
            
            Please provide a helpful response based on the context and intent.
            """
            
            # Make API call
            response = self.client.ChatCompletion.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_context},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"LLM response generation failed: {str(e)}")
            return self._generate_mock_response(query_analysis, context)
    
    def _generate_mock_response(self, query_analysis: ParkingQuery, 
                               context: Optional[Dict]) -> str:
        """Generate mock response based on intent"""
        intent = query_analysis.intent
        entities = query_analysis.entities
        
        # Mock responses based on intent
        responses = {
            'find_parking': [
                "I can help you find available parking! Based on current data, there are several open spots in the main parking lot.",
                "Looking for parking? Let me check the available spaces for you. There are currently 15 available slots in Lot A.",
                "I found some available parking spaces! The closest available spots are in Section B, slots 23-27."
            ],
            'check_occupancy': [
                "The current occupancy rate is approximately 65%. There are 18 available spaces out of 50 total slots.",
                "Right now, the parking lot is moderately busy with about 70% occupancy. You should be able to find a spot easily.",
                "Current status: 32 occupied, 18 available. The lot is filling up but spaces are still available."
            ],
            'get_directions': [
                "The main parking lot is located at the north entrance of the building. Take the elevator to Level 2 for the closest access.",
                "To get to the parking area, enter through the main gate and follow the signs to 'Visitor Parking'. It's about 100 meters straight ahead.",
                "The parking lot entrance is on Oak Street. Once you enter, available spots are marked in green on the digital display."
            ],
            'check_duration': [
                "Standard parking duration is up to 4 hours for visitors. Long-term parking (8+ hours) is available in the extended lot.",
                "You can park for up to 2 hours in the short-term area, or use the all-day section for longer stays.",
                "Parking time limits vary by section: 2 hours in Zone A, 4 hours in Zone B, and unlimited in Zone C."
            ],
            'check_pricing': [
                "Parking rates are $2 per hour for the first 3 hours, then $5 per hour after that. Daily maximum is $25.",
                "Current pricing: First hour free, $3/hour for hours 2-4, $20 daily maximum. Payment accepted via app or at the kiosk.",
                "Parking fees: $2.50/hour, $15 daily rate, or $75 monthly pass. Senior and student discounts available."
            ],
            'report_issue': [
                "I'm sorry to hear about the issue. Please describe the problem and I'll help you report it to maintenance.",
                "Thank you for reporting this. Can you provide more details about the issue? I'll make sure it gets to the right team.",
                "I'll help you report this issue. Please let me know the location and nature of the problem."
            ],
            'get_help': [
                "I'm here to help with all your parking needs! I can help you find spaces, check availability, get directions, and more.",
                "I can assist you with: finding parking, checking occupancy, getting directions, understanding pricing, and reporting issues. What would you like to know?",
                "Welcome! I'm your parking assistant. I can help you find available spots, provide directions, explain pricing, and answer any questions about the parking system."
            ],
            'general': [
                "I'm here to help with your parking needs. Could you please be more specific about what you're looking for?",
                "I'd be happy to assist you! Are you looking for available parking, directions, pricing information, or something else?",
                "How can I help you with parking today? I can check availability, provide directions, or answer questions about the system."
            ]
        }
        
        # Select appropriate response
        intent_responses = responses.get(intent, responses['general'])
        base_response = intent_responses[hash(query_analysis.original_text) % len(intent_responses)]
        
        # Add context-specific information if available
        if context and 'parking_lots' in context:
            lots = context['parking_lots']
            if lots and intent in ['find_parking', 'check_occupancy']:
                total_available = sum(lot.get('available_slots', 0) for lot in lots)
                total_slots = sum(lot.get('total_slots', 0) for lot in lots)
                
                if total_slots > 0:
                    occupancy_rate = ((total_slots - total_available) / total_slots) * 100
                    base_response += f"\n\nCurrent system status: {total_available} available spots out of {total_slots} total ({occupancy_rate:.1f}% occupied)."
        
        return base_response
    
    def get_parking_suggestions(self, context: Dict) -> List[Dict]:
        """Get parking suggestions based on context"""
        suggestions = []
        
        if 'parking_lots' in context:
            for lot in context['parking_lots']:
                if lot.get('available_slots', 0) > 0:
                    suggestions.append({
                        'lot_name': lot.get('name', 'Unknown'),
                        'available_slots': lot.get('available_slots', 0),
                        'total_slots': lot.get('total_slots', 0),
                        'occupancy_rate': lot.get('occupancy_rate', 0),
                        'recommendation_score': self._calculate_recommendation_score(lot)
                    })
        
        # Sort by recommendation score
        suggestions.sort(key=lambda x: x['recommendation_score'], reverse=True)
        return suggestions[:3]  # Return top 3 suggestions
    
    def _calculate_recommendation_score(self, lot: Dict) -> float:
        """Calculate recommendation score for a parking lot"""
        available = lot.get('available_slots', 0)
        total = lot.get('total_slots', 1)
        occupancy_rate = lot.get('occupancy_rate', 100)
        
        # Prefer lots with good availability but not completely empty
        availability_score = available / total
        if availability_score > 0.8:
            availability_score = 0.8  # Cap very empty lots
        
        # Prefer moderate occupancy (indicates active but not overcrowded)
        occupancy_score = 1 - abs(occupancy_rate - 60) / 100
        
        return (availability_score * 0.7) + (occupancy_score * 0.3)
    
    def handle_conversation_context(self, conversation_history: List[Dict]) -> Dict:
        """Analyze conversation history for context"""
        context = {
            'previous_intents': [],
            'mentioned_entities': {},
            'conversation_length': len(conversation_history)
        }
        
        for message in conversation_history[-5:]:  # Last 5 messages
            if 'intent' in message:
                context['previous_intents'].append(message['intent'])
            
            if 'entities' in message:
                for entity_type, entity_value in message['entities'].items():
                    if entity_type not in context['mentioned_entities']:
                        context['mentioned_entities'][entity_type] = []
                    context['mentioned_entities'][entity_type].extend(
                        entity_value if isinstance(entity_value, list) else [entity_value]
                    )
        
        return context
    
    def get_quick_responses(self, intent: str) -> List[str]:
        """Get quick response options for common intents"""
        quick_responses = {
            'find_parking': [
                "Show available spots",
                "Find closest parking",
                "Check all lots"
            ],
            'check_occupancy': [
                "Current occupancy",
                "Peak hours info",
                "Historical data"
            ],
            'get_directions': [
                "Navigate to lot",
                "Walking directions",
                "Parking map"
            ],
            'check_pricing': [
                "Hourly rates",
                "Daily pricing",
                "Monthly passes"
            ]
        }
        
        return quick_responses.get(intent, ["Tell me more", "Get help", "Start over"])

def test_chatbot():
    """Test function for the chatbot service"""
    chatbot = ChatbotService()
    
    # Test queries
    test_queries = [
        "Where can I find parking?",
        "How full is the parking lot?",
        "What are the parking rates?",
        "I need directions to the parking area",
        "How long can I park here?",
        "There's a problem with slot 15"
    ]
    
    # Mock context
    context = {
        'parking_lots': [
            {
                'name': 'Main Lot',
                'available_slots': 15,
                'total_slots': 50,
                'occupancy_rate': 70
            },
            {
                'name': 'North Lot', 
                'available_slots': 8,
                'total_slots': 30,
                'occupancy_rate': 73
            }
        ],
        'current_time': datetime.now().isoformat()
    }
    
    print("Testing Chatbot Service:")
    print("=" * 50)
    
    for query in test_queries:
        print(f"\nQuery: {query}")
        response = chatbot.process_query(query, context)
        print(f"Intent: {response['intent']} (confidence: {response['confidence']:.2f})")
        print(f"Response: {response['response']}")
        print("-" * 30)

if __name__ == '__main__':
    test_chatbot()
