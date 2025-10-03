import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon, 
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';
import { chatbotService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { formatTime } from '../utils/dateUtils';

const Chatbot = ({ isOpen, onClose, context = null }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initial welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        type: 'bot',
        content: "Hi! I'm your parking assistant. I can help you find available spots, check occupancy rates, get directions, and answer questions about the parking system. How can I help you today?",
        timestamp: new Date().toISOString(),
        suggestions: [
          "Find available parking",
          "Check occupancy rates",
          "How much does parking cost?",
          "Get directions to parking"
        ]
      };
      setMessages([welcomeMessage]);
      setSuggestions(welcomeMessage.suggestions);
    }
  }, [isOpen, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (messageText = null) => {
    const text = messageText || inputMessage.trim();
    if (!text || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setSuggestions([]);

    try {
      const response = await chatbotService.sendMessage(text, context);
      
      if (response.data.success) {
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: response.data.response,
          timestamp: new Date().toISOString(),
          intent: response.data.intent,
          confidence: response.data.confidence
        };

        setMessages(prev => [...prev, botMessage]);

        // Get suggestions based on intent
        if (response.data.intent) {
          try {
            const suggestionsResponse = await chatbotService.getSuggestions(response.data.intent);
            if (suggestionsResponse.data.success) {
              setSuggestions(suggestionsResponse.data.suggestions || []);
            }
          } catch (error) {
            console.error('Error getting suggestions:', error);
          }
        }
      } else {
        throw new Error(response.data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again later or contact support if the problem persists.",
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };

  const clearChat = () => {
    setMessages([]);
    setSuggestions([]);
    // Re-add welcome message
    setTimeout(() => {
      const welcomeMessage = {
        id: Date.now(),
        type: 'bot',
        content: "Chat cleared! How can I help you today?",
        timestamp: new Date().toISOString(),
        suggestions: [
          "Find available parking",
          "Check occupancy rates",
          "How much does parking cost?",
          "Get directions to parking"
        ]
      };
      setMessages([welcomeMessage]);
      setSuggestions(welcomeMessage.suggestions);
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-md h-96 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-600 text-white rounded-t-lg">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <CpuChipIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Parking Assistant</h3>
                <p className="text-xs text-blue-100">AI-powered help</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearChat}
                className="text-blue-100 hover:text-white text-sm px-2 py-1 rounded"
                title="Clear chat"
              >
                Clear
              </button>
              <button
                onClick={onClose}
                className="text-blue-100 hover:text-white p-1 rounded"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.isError
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start">
                    {message.type === 'bot' && (
                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                        <CpuChipIcon className="w-3 h-3 text-gray-600" />
                      </div>
                    )}
                    {message.type === 'user' && (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                        <UserIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatTime(message.timestamp)}
                      </p>
                      {message.confidence && (
                        <p className="text-xs opacity-50 mt-1">
                          Confidence: {Math.round(message.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg max-w-xs">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                      <CpuChipIcon className="w-3 h-3 text-gray-600" />
                    </div>
                    <LoadingSpinner size="small" className="mr-2" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !isLoading && (
            <div className="px-4 py-2 border-t border-gray-100">
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask me about parking..."
                className="flex-1 form-input text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="btn btn-primary p-2"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Chatbot;
