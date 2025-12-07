// WealthArena API Configuration (env-driven for local, Docker, Azure, and GCP)
// Uses dynamic network resolution to support multiple devices and networks automatically

import { getBackendURLSync, resolveBackendURL, getNetworkInfo } from '../utils/networkConfig';

const isDevelopment = process.env.NODE_ENV === 'development' || (global as any).__DEV__;
const isDocker = process.env.EXPO_PUBLIC_DOCKER === 'true';
const DEPLOYMENT_ENV = process.env.EXPO_PUBLIC_DEPLOYMENT_ENV || 'local';
const isAzure = DEPLOYMENT_ENV === 'azure';
const isGCP = DEPLOYMENT_ENV === 'gcp';
const isLocal = DEPLOYMENT_ENV === 'local';

// Dynamic URL Resolution Logic:
// 1. Environment variable (highest priority)
// 2. Platform-specific detection (iOS Simulator, Android Emulator, Physical Device)
// 3. Deployment environment defaults (Azure, GCP)
// 4. Fallback to localhost
// 
// For physical devices: Uses cached IP from AsyncStorage or extracts from env vars
// For simulators: Uses platform-specific localhost (localhost for iOS, 10.0.2.2 for Android)
// For web: Uses localhost
// Note: resolveBackendURL is already imported above, no need to import again
// For synchronous access, use getBackendURLSync() from networkConfig
const BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  (isDocker ? 'http://backend:3000' :
   (isAzure ? 'https://wealtharena-backend.azurewebsites.net' :
    isGCP ? 'https://wealtharena-backend.appspot.com' :
    getBackendURLSync(3000)));

const CHATBOT_BASE_URL = process.env.EXPO_PUBLIC_CHATBOT_URL || 
  (isDocker ? 'http://chatbot:5001' :
   (isAzure ? 'https://wealtharena-chatbot.azurewebsites.net' :
    isGCP ? 'https://wealtharena-chatbot.appspot.com' :
    getBackendURLSync(8000))); // Chatbot typically runs on 8000, but config allows 5001

const RL_SERVICE_URL = process.env.EXPO_PUBLIC_RL_SERVICE_URL || 
  (isDocker ? 'http://rl-service:5002' :
   (isAzure ? 'https://wealtharena-rl.azurewebsites.net' :
    isGCP ? 'https://wealtharena-rl.appspot.com' :
    getBackendURLSync(5002)));

export const API_CONFIG = {
  BACKEND_BASE_URL,
  CHATBOT_BASE_URL,
  RL_SERVICE_URL,
  ENDPOINTS: {
    // Health & Status
    HEALTH: `${BACKEND_BASE_URL}/api/health`,
    
    // Authentication
    AUTH_SIGNUP: `${BACKEND_BASE_URL}/api/auth/signup`,
    AUTH_LOGIN: `${BACKEND_BASE_URL}/api/auth/login`,
    AUTH_GOOGLE: `${BACKEND_BASE_URL}/api/auth/google`,
    
    // User Profile
    USER_PROFILE: `${BACKEND_BASE_URL}/api/user/profile`,
    USER_UPDATE_PROFILE: `${BACKEND_BASE_URL}/api/user/profile`,
    USER_XP: `${BACKEND_BASE_URL}/api/user/xp`,
    USER_COINS: `${BACKEND_BASE_URL}/api/user/coins`,
    USER_ACHIEVEMENTS: `${BACKEND_BASE_URL}/api/user/achievements`,
    USER_QUESTS: `${BACKEND_BASE_URL}/api/user/quests`,
    
    // Portfolio
    PORTFOLIO: `${BACKEND_BASE_URL}/api/portfolio`,
    PORTFOLIO_ITEMS: `${BACKEND_BASE_URL}/api/portfolio/items`,
    PORTFOLIO_TRADES: `${BACKEND_BASE_URL}/api/portfolio/trades`,
    PORTFOLIO_POSITIONS: `${BACKEND_BASE_URL}/api/portfolio/positions`,
    
    // Game Sessions
    GAME_CREATE: `${BACKEND_BASE_URL}/api/game/create-session`,
    GAME_SAVE: `${BACKEND_BASE_URL}/api/game/save-session`,
    GAME_COMPLETE: `${BACKEND_BASE_URL}/api/game/complete-session`,
    
    // Leaderboard
    LEADERBOARD_GLOBAL: `${BACKEND_BASE_URL}/api/leaderboard/global`,
    LEADERBOARD_FRIENDS: `${BACKEND_BASE_URL}/api/leaderboard/friends`,
    
    // Trading Signals
    SIGNALS_TOP: `${BACKEND_BASE_URL}/api/signals/top`,
    SIGNALS_SYMBOL: `${BACKEND_BASE_URL}/api/signals/symbol`,
    
    // Market Data
    MARKET_DATA: `${BACKEND_BASE_URL}/api/market-data`,
    MARKET_DATA_TRENDING: `${BACKEND_BASE_URL}/api/market-data/trending`,
    
    // Analytics
    ANALYTICS: `${BACKEND_BASE_URL}/api/analytics/performance`,
    
    // Chatbot
    CHATBOT_HEALTH: `${CHATBOT_BASE_URL}/healthz`,
    CHATBOT_CHAT: `${CHATBOT_BASE_URL}/v1/chat`,
    CHATBOT_KNOWLEDGE: `${CHATBOT_BASE_URL}/context/knowledge/topics`,
    
    // RL Service
    RL_PREDICTIONS: `${RL_SERVICE_URL}/predict`,
    RL_TOP_SETUPS: `${RL_SERVICE_URL}/api/top-setups`,
  },
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  FEATURES: {
    ENABLE_CHATBOT: process.env.EXPO_PUBLIC_ENABLE_CHATBOT !== 'false',
    ENABLE_REAL_TIME_SIGNALS: process.env.EXPO_PUBLIC_ENABLE_REAL_TIME_SIGNALS !== 'false',
    ENABLE_PORTFOLIO_ANALYTICS: process.env.EXPO_PUBLIC_ENABLE_PORTFOLIO_ANALYTICS !== 'false',
  },
  DEPLOYMENT_ENV,
  ENVIRONMENT: isDevelopment ? 'development' : 'production',
  VERSION: '1.0.0',
  LAST_UPDATED: new Date().toISOString(),
  // Network info for debugging
  getNetworkInfo,
  // Async URL resolution (useful for runtime updates on physical devices)
  resolveBackendURL,
  resolveChatbotURL: () => resolveBackendURL(8000),
  resolveRLServiceURL: () => resolveBackendURL(5002),
};

export default API_CONFIG;

// Re-export network utilities for convenience
export { resolveBackendURL, setBackendURL, getCachedBackendURL, clearCachedURLs, getNetworkInfo } from '../utils/networkConfig';
