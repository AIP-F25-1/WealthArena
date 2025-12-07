// WealthArena API Service
// Handles all API calls to backend and chatbot services

import API_CONFIG from './config/apiConfig';

class ApiService {
  constructor() {
    this.baseURL = API_CONFIG.BACKEND_BASE_URL;
    this.chatbotURL = API_CONFIG.CHATBOT_BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
    this.retryAttempts = API_CONFIG.RETRY_ATTEMPTS;
    this.retryDelay = API_CONFIG.RETRY_DELAY;
  }

  // Generic API call method
  async apiCall(url, options = {}) {
    const defaultOptions = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const mergedOptions = { ...defaultOptions, ...options };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
          throw new Error(HTTP error! status: );
        }
        
        return await response.json();
      } catch (error) {
        console.error(API call attempt  failed:, error);
        
        if (attempt === this.retryAttempts) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  // Health check methods
  async checkBackendHealth() {
    return this.apiCall(API_CONFIG.ENDPOINTS.HEALTH);
  }

  async checkChatbotHealth() {
    return this.apiCall(API_CONFIG.ENDPOINTS.CHATBOT_HEALTH);
  }

  // Trading signals methods
  async getTopSignals(limit = 10) {
    return this.apiCall(${API_CONFIG.ENDPOINTS.SIGNALS_TOP}?limit=);
  }

  async getSignalsBySymbol(symbol, limit = 5) {
    return this.apiCall(${API_CONFIG.ENDPOINTS.SIGNALS_SYMBOL}/?limit=);
  }

  // Market data methods
  async getMarketData(symbol, days = 30) {
    return this.apiCall(${API_CONFIG.ENDPOINTS.MARKET_DATA}/?days=);
  }

  // Portfolio methods
  async getPortfolio(userId) {
    return this.apiCall(${API_CONFIG.ENDPOINTS.PORTFOLIO}/);
  }

  // Analytics methods
  async getPerformanceAnalytics(days = 30) {
    return this.apiCall(${API_CONFIG.ENDPOINTS.ANALYTICS}?days=);
  }

  // Chatbot methods
  async chatWithBot(message, userId = null) {
    return this.apiCall(API_CONFIG.ENDPOINTS.CHAT, {
      method: 'POST',
      body: JSON.stringify({
        message: message,
        user_id: userId
      })
    });
  }

  async getKnowledgeCategories() {
    return this.apiCall(API_CONFIG.ENDPOINTS.KNOWLEDGE_CATEGORIES);
  }

  async searchKnowledge(query) {
    return this.apiCall(${API_CONFIG.ENDPOINTS.KNOWLEDGE_SEARCH}?query=);
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
