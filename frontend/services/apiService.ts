/**
 * WealthArena API Service - Complete Integration
 * Comprehensive API service for all backend endpoints
 */

import { API_CONFIG } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = API_CONFIG.BACKEND_BASE_URL;
const CHATBOT_URL = API_CONFIG.CHATBOT_BASE_URL;

// Helper function to get auth headers
export const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

// Helper function to create timeout controller
const createTimeoutController = (timeoutMs: number = 30000): AbortController => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
};

// Helper function to fetch with timeout
const fetchWithTimeout = async (
  url: string, 
  options: RequestInit = {}, 
  timeout: number = 30000
): Promise<Response> => {
  const controller = createTimeoutController(timeout);
  const signal = controller.signal;
  
  try {
    const response = await fetch(url, { ...options, signal });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  }
};

// Helper function to handle API responses
const handleResponse = async (response: Response, endpoint?: string) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    const detailedMessage = endpoint 
      ? `${errorMessage} (endpoint: ${endpoint})`
      : errorMessage;
    
    // Provide specific error messages for common cases
    if (response.status === 404) {
      throw new Error(`Resource not found: ${detailedMessage}`);
    } else if (response.status === 500) {
      throw new Error(`Server error: ${detailedMessage}`);
    } else if (response.status === 401) {
      throw new Error(`Unauthorized: ${detailedMessage}`);
    } else if (response.status === 403) {
      throw new Error(`Forbidden: ${detailedMessage}`);
    }
    
    throw new Error(detailedMessage);
  }
  return response.json();
};

export const apiService = {
  // Authentication
  async signup(userData: {
    email: string;
    password: string;
    username: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    full_name?: string;
  }) {
    // Force refresh IP detection for login/signup to ensure we have the latest IP
    const { resolveBackendURL } = await import('../utils/networkConfig');
    let backendUrl = await resolveBackendURL(3000, true); // forceRefresh = true
    
    try {
      const response = await fetch(`${backendUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return handleResponse(response);
    } catch (error: any) {
      // If connection fails, try one more time with fresh detection
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        console.log('🔄 Signup failed, retrying with fresh IP detection...');
        backendUrl = await resolveBackendURL(3000, true);
        const retryResponse = await fetch(`${backendUrl}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
        return handleResponse(retryResponse);
      }
      throw error;
    }
  },

  async login(credentials: { email: string; password: string }) {
    // Force refresh IP detection for login/signup to ensure we have the latest IP
    const { resolveBackendURL } = await import('../utils/networkConfig');
    let backendUrl = await resolveBackendURL(3000, true); // forceRefresh = true
    
    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      return handleResponse(response);
    } catch (error: any) {
      // If connection fails, try one more time with fresh detection
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        console.log('🔄 Login failed, retrying with fresh IP detection...');
        backendUrl = await resolveBackendURL(3000, true);
        const retryResponse = await fetch(`${backendUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });
        return handleResponse(retryResponse);
      }
      throw error;
    }
  },

  async googleLogin(googleAccessToken: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: googleAccessToken })
    });
    return handleResponse(response);
  },

  async googleSignup(googleAccessToken: string) {
    // Google OAuth typically uses the same endpoint for both login and signup
    // The backend determines if it's a new user based on the email
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: googleAccessToken })
    });
    return handleResponse(response);
  },

  async setAuthToken(token: string | null) {
    if (token) {
      await AsyncStorage.setItem('authToken', token);
    } else {
      await AsyncStorage.removeItem('authToken');
    }
  },

  // User Profile
  async getUserProfile() {
    try {
      const { resolveBackendURL } = await import('../utils/networkConfig');
      const backendUrl = await resolveBackendURL(3000);
      const response = await fetchWithTimeout(`${backendUrl}/api/user/profile`, {
        headers: await getAuthHeaders(),
      }, 15000);
      return handleResponse(response);
    } catch (error: any) {
      console.error('Failed to fetch user profile:', error);
      throw error;
    }
  },

  async updateUserProfile(profileData: Record<string, unknown>) {
    try {
      const { resolveBackendURL } = await import('../utils/networkConfig');
      const backendUrl = await resolveBackendURL(3000);
      const response = await fetchWithTimeout(`${backendUrl}/api/user/profile`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(profileData)
      }, 15000);
      return handleResponse(response);
    } catch (error: any) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  },

  async uploadAvatar(imageUri: string, imageType: 'base64' | 'file' = 'base64') {
    if (imageType === 'base64') {
      // Send base64 directly in JSON
      const response = await fetch(`${API_BASE_URL}/api/user/upload-avatar`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ imageData: imageUri, encoding: 'base64' })
      });
      return handleResponse(response);
    } else {
      // Send as multipart/form-data
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as unknown as Blob);
      
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/user/upload-avatar`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: formData
      });
      return handleResponse(response);
    }
  },

  // XP and Coins
  async awardXP(amount: number, reason: string) {
    const response = await fetch(`${API_BASE_URL}/api/user/xp`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ xpAmount: amount, reason })
    });
    return handleResponse(response);
  },

  async getUserQuests() {
    const response = await fetch(`${API_BASE_URL}/api/user/quests`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async awardCoins(amount: number, reason: string) {
    const response = await fetch(`${API_BASE_URL}/api/user/coins`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ coinAmount: amount, reason })
    });
    return handleResponse(response);
  },

  // Achievements
  async getAchievements() {
    const response = await fetch(`${API_BASE_URL}/api/user/achievements`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async unlockAchievement(achievementId: number) {
    const response = await fetch(`${API_BASE_URL}/api/user/achievements/unlock`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ achievementId })
    });
    return handleResponse(response);
  },

  // Quests
  async getQuests() {
    const response = await fetch(`${API_BASE_URL}/api/user/quests`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async completeQuest(questId: number) {
    const response = await fetch(`${API_BASE_URL}/api/user/quest/${questId}/complete`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Leaderboard
  async getGlobalLeaderboard(filters: Record<string, string> = {}) {
    try {
      const { resolveBackendURL } = await import('../utils/networkConfig');
      const backendUrl = await resolveBackendURL(3000);
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${backendUrl}/api/leaderboard/global?${params}`, {
        headers: await getAuthHeaders(),
      }, 15000); // 15s timeout for leaderboard
      return handleResponse(response);
    } catch (error: any) {
      console.error('Failed to fetch global leaderboard:', error);
      throw error;
    }
  },

  async getFriendsLeaderboard() {
    try {
      const { resolveBackendURL } = await import('../utils/networkConfig');
      const backendUrl = await resolveBackendURL(3000);
      const response = await fetchWithTimeout(`${backendUrl}/api/leaderboard/friends`, {
        headers: await getAuthHeaders(),
      }, 15000); // 15s timeout for leaderboard
      return handleResponse(response);
    } catch (error: any) {
      console.error('Failed to fetch friends leaderboard:', error);
      throw error;
    }
  },

  async getUserRank(userId: number) {
    try {
      const { resolveBackendURL } = await import('../utils/networkConfig');
      const backendUrl = await resolveBackendURL(3000);
      const response = await fetchWithTimeout(`${backendUrl}/api/leaderboard/user/${userId}`, {
        headers: await getAuthHeaders(),
      }, 15000); // 15s timeout for leaderboard
      return handleResponse(response);
    } catch (error: any) {
      console.error('Failed to fetch user rank:', error);
      throw error;
    }
  },

  // Game Sessions
  async createGameSession(params: { gameType: string; symbols?: string[] | string; difficulty?: string; startingCash?: number }) {
    const response = await fetch(`${API_BASE_URL}/api/game/create-session`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(params)
    });
    return handleResponse(response);
  },

  async saveGameSession(sessionId: string, state: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/api/game/save-session`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ sessionId, state })
    });
    return handleResponse(response);
  },

  async resumeGameSession(sessionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/game/resume-session/${sessionId}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async completeGameSession(sessionId: string, results: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/api/game/complete-session`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ sessionId, results })
    });
    return handleResponse(response);
  },

  async discardGameSession(sessionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/game/discard-session`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ sessionId })
    });
    return handleResponse(response);
  },

  // Learning System (DEPRECATED - Use getKnowledgeTopics, getKnowledgeTopic, completeUserLesson, getUserLearningProgress instead)
  /** @deprecated Use getKnowledgeTopics instead */
  async getTopics() {
    // eslint-disable-next-line no-console
    console.warn('getTopics is deprecated. Use getKnowledgeTopics instead.');
    // Fallback to new endpoint
    return this.getKnowledgeTopics();
  },

  /** @deprecated Use getKnowledgeTopic instead */
  async getTopic(topicId: string) {
    // eslint-disable-next-line no-console
    console.warn('getTopic is deprecated. Use getKnowledgeTopic instead.');
    // Fallback to new endpoint
    return this.getKnowledgeTopic(topicId);
  },

  /** @deprecated Use completeUserLesson instead */
  async completeLesson(lessonId: string) {
    // eslint-disable-next-line no-console
    console.warn('completeLesson is deprecated. Use completeUserLesson instead.');
    return { success: false, message: 'This endpoint is deprecated. Use completeUserLesson instead.' };
  },

  /** @deprecated This endpoint may not be implemented */
  async completeTopic(topicId: string) {
    // eslint-disable-next-line no-console
    console.warn('completeTopic is deprecated and may not be implemented.');
    return { success: false, message: 'This endpoint is deprecated.' };
  },

  /** @deprecated Use getUserLearningProgress instead */
  async getLearningProgress() {
    // eslint-disable-next-line no-console
    console.warn('getLearningProgress is deprecated. Use getUserLearningProgress instead.');
    // Fallback to new endpoint
    return this.getUserLearningProgress();
  },

  // Knowledge & Learning Functions (Chatbot Integration)
  async getKnowledgeTopics(category?: string, difficulty?: string) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    
    try {
      const response = await fetch(`${CHATBOT_URL}/v1/knowledge/topics?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        // Try old endpoint format as fallback
        const fallbackResponse = await fetch(`${CHATBOT_URL}/context/knowledge/topics?${params.toString()}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (fallbackResponse.ok) {
          return handleResponse(fallbackResponse);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return handleResponse(response);
    } catch (error) {
      console.error('Failed to fetch knowledge topics:', error);
      throw error;
    }
  },

  async getKnowledgeTopic(topicId: string) {
    const response = await fetch(`${CHATBOT_URL}/context/knowledge/topics/${topicId}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  async completeUserLesson(lessonData: { lessonId: string, topicId: string, timeSpent?: number, score?: number }) {
    const response = await fetch(`${API_BASE_URL}/api/user/complete-lesson`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(lessonData)
    });
    return handleResponse(response);
  },

  async getUserLearningProgress() {
    const response = await fetch(`${API_BASE_URL}/api/learning/progress`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Backend Learning API (Primary)
  async getLearningTopics() {
    const response = await fetch(`${API_BASE_URL}/api/learning/topics`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getLearningTopic(topicId: string) {
    const response = await fetch(`${API_BASE_URL}/api/learning/topic/${topicId}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async completeLearningLesson(lessonId: number) {
    const response = await fetch(`${API_BASE_URL}/api/learning/complete-lesson`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ lessonId })
    });
    return handleResponse(response);
  },

  async completeLearningTopic(topicId: number) {
    const response = await fetch(`${API_BASE_URL}/api/learning/complete-topic`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ topicId })
    });
    return handleResponse(response);
  },

  // Portfolio
  async getPortfolio() {
    try {
      const { resolveBackendURL } = await import('../utils/networkConfig');
      const backendUrl = await resolveBackendURL(3000);
      const response = await fetchWithTimeout(`${backendUrl}/api/portfolio`, {
        headers: await getAuthHeaders(),
      }, 15000);
      return handleResponse(response);
    } catch (error: any) {
      console.error('Failed to fetch portfolio:', error);
      throw error;
    }
  },

  async getPortfolioItems() {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/items`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getTrades() {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/trades`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getPositions() {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/positions`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Portfolio Management
  async createPortfolio(portfolioData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/api/portfolio`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(portfolioData)
    });
    return handleResponse(response);
  },

  async updatePortfolio(portfolioId: string, portfolioData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/${portfolioId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(portfolioData)
    });
    return handleResponse(response);
  },

  async deletePortfolio(portfolioId: string) {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/${portfolioId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async createPortfolioFromSignal(signalId: number, portfolioName: string, investmentAmount: number) {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/from-signal`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ signalId, portfolioName, investmentAmount })
    });
    return handleResponse(response);
  },

  async getPortfolioPerformance(portfolioId: string) {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/${portfolioId}/performance`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Trading Signals
  async getTopSignals(assetClass: string | null = null, limit: number = 3) {
    const params = new URLSearchParams();
    if (assetClass) params.append('assetType', assetClass);
    params.append('limit', limit.toString());
    
    const endpoint = `${API_BASE_URL}/api/signals/top?${params}`;
    
    try {
      // Try RL service first (shorter timeout since it's optional)
      const { resolveBackendURL } = await import('../utils/networkConfig');
      const rlUrl = await resolveBackendURL(5002);
      const rlEndpoint = `${rlUrl}/api/top-setups?${params}`;
      
      try {
        const response = await fetchWithTimeout(rlEndpoint, {
          headers: await getAuthHeaders(),
        }, 10000); // 10s timeout for RL service
        
        if (response.ok) {
          const rlData = await response.json();
          
          // Normalize RL service response to match backend shape { success, data }
          // RL service might return { setups: [...] } or just an array or { data: [...] }
          let normalizedData: any[] = [];
          
          if (Array.isArray(rlData)) {
            normalizedData = rlData;
          } else if (rlData.setups && Array.isArray(rlData.setups)) {
            normalizedData = rlData.setups;
          } else if (rlData.data && Array.isArray(rlData.data)) {
            normalizedData = rlData.data;
          } else if (rlData.success && rlData.data && Array.isArray(rlData.data)) {
            // Already in correct format
            return rlData;
          }
          
          // Return normalized response matching backend format
          return {
            success: true,
            data: normalizedData
          };
        }
      } catch (rlError: any) {
        // RL service timeout or error - fall back to backend
        console.warn('RL service unavailable, using backend signals:', rlError.message);
      }
      
      // Fallback to backend signals endpoint
      const response = await fetchWithTimeout(endpoint, {
        headers: await getAuthHeaders(),
      });
      return await handleResponse(response, endpoint);
    } catch (error: any) {
      console.error(`Failed to fetch signals from ${endpoint}:`, error);
      throw error;
    }
  },

  async getHistoricalSignals(filters: { limit?: number; assetType?: string; outcome?: string; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.assetType) params.append('assetType', filters.assetType);
    if (filters.outcome) params.append('outcome', filters.outcome);
    if (filters.offset) params.append('offset', filters.offset.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/signals/historical?${params}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Game Sessions
  async getActiveSessions() {
    const response = await fetch(`${API_BASE_URL}/api/game/sessions`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getGameHistory(limit: number = 10) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/game/history?${params}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Market Data
  async getMarketData(symbol: string) {
    const response = await fetch(`${API_BASE_URL}/api/market-data/real-time/${symbol}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Chatbot
  async sendChatMessage(message: string, userId: string = 'anonymous') {
    const response = await fetch(`${CHATBOT_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userId })
    });
    return handleResponse(response);
  },

  // Onboarding
  async startOnboarding(userData: {
    firstName: string;
    email: string;
    userId: number;
  }) {
    const response = await fetch(`${API_BASE_URL}/api/chatbot/onboarding/start`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(userData)
    });
    return handleResponse(response);
  },

  async sendOnboardingResponse(data: {
    sessionId: string;
    answer: string;
    conversationHistory?: unknown[];
    userAnswers?: unknown[];
  }) {
    const response = await fetch(`${API_BASE_URL}/api/chatbot/onboarding/respond`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  async completeOnboarding(data: {
    sessionId: string;
    conversationHistory?: unknown[];
    userAnswers?: unknown[];
    userProfile?: Record<string, unknown>;
  }) {
    const response = await fetch(`${API_BASE_URL}/api/user/complete-onboarding`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  // Notifications Functions
  async getNotifications(filters?: { status?: string, type?: string, limit?: number, offset?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/notifications?${params.toString()}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getUnreadNotificationCount() {
    try {
      const { resolveBackendURL } = await import('../utils/networkConfig');
      const backendUrl = await resolveBackendURL(3000);
      const response = await fetchWithTimeout(`${backendUrl}/api/notifications/unread-count`, {
        headers: await getAuthHeaders(),
      }, 10000); // 10s timeout for notifications
      return handleResponse(response);
    } catch (error: any) {
      console.error('Failed to fetch unread notification count:', error);
      throw error;
    }
  },

  async markNotificationRead(notificationId: string) {
    const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async markAllNotificationsRead() {
    const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async deleteNotification(notificationId: string) {
    const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Analytics Functions
  async getAnalyticsPerformance(timeframe?: string, portfolioId?: string) {
    const params = new URLSearchParams();
    if (timeframe) params.append('timeframe', timeframe);
    if (portfolioId) params.append('portfolioId', portfolioId);
    
    const response = await fetch(`${API_BASE_URL}/api/analytics/performance?${params.toString()}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // News Functions
  async getTrendingMarketData(limit?: number, timeframe?: string) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (timeframe) params.append('timeframe', timeframe);
    
    const endpoint = `${API_BASE_URL}/api/market-data/trending?${params.toString()}`;
    
    try {
      const response = await fetchWithTimeout(endpoint, {
        headers: await getAuthHeaders(),
      });
      const result = await handleResponse(response, endpoint);
      
      // Ensure consistent format - always return { articles: [] } structure
      if (result && typeof result === 'object') {
        if (Array.isArray(result)) {
          return { articles: result };
        } else if (result.articles && Array.isArray(result.articles)) {
          return result;
        } else if (result.data && Array.isArray(result.data)) {
          return { articles: result.data };
        }
      }
      
      // Default to empty array if format is unexpected
      return { articles: [] };
    } catch (error: any) {
      console.error(`Failed to fetch trending market data from ${endpoint}:`, error);
      // Return empty structure on error to prevent crashes
      return { articles: [] };
    }
  },

  async searchNews(query: string, limit?: number) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (limit) params.append('k', limit.toString());
    
    const response = await fetch(`${CHATBOT_URL}/v1/search?${params.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // Onboarding Analytics
  async trackOnboardingAnalytics(analyticsData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/api/analytics/onboarding`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(analyticsData)
    });
    return handleResponse(response);
  },

  // Complete Onboarding (Alias for existing)
  async completeUserOnboarding(data: {
    sessionId: string;
    conversationHistory?: unknown[];
    userAnswers?: unknown[];
    userProfile?: Record<string, unknown>;
  }) {
    return this.completeOnboarding(data);
  },
};

// Export individual functions for easier imports
export const {
  signup,
  login,
  googleLogin,
  googleSignup,
  setAuthToken,
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  awardXP,
  awardCoins,
  getAchievements,
  unlockAchievement,
  getQuests,
  completeQuest,
  getGlobalLeaderboard,
  getFriendsLeaderboard,
  getUserRank,
  createGameSession,
  saveGameSession,
  resumeGameSession,
  completeGameSession,
  discardGameSession,
  getTopics,
  getTopic,
  completeLesson,
  completeTopic,
  getLearningProgress,
  getPortfolio,
  getPortfolioItems,
  getTrades,
  getPositions,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  createPortfolioFromSignal,
  getPortfolioPerformance,
  getTopSignals,
  getHistoricalSignals,
  getActiveSessions,
  getGameHistory,
  getMarketData,
  sendChatMessage,
  startOnboarding,
  sendOnboardingResponse,
  completeOnboarding,
  getKnowledgeTopics,
  getKnowledgeTopic,
  completeUserLesson,
  getUserLearningProgress,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getAnalyticsPerformance,
  getTrendingMarketData,
  searchNews,
  completeUserOnboarding,
} = apiService;

export default apiService;
