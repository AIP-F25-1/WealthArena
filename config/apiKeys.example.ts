/**
 * API Keys Configuration Example
 * 
 * Copy this file to apiKeys.ts and add your actual API keys
 * The apiKeys.ts file is gitignored and won't be committed
 */

export const API_KEYS = {
  ALPHA_VANTAGE: 'your-alpha-vantage-api-key-here',
  
  // Add other API keys here
  // BACKEND_URL: 'your-backend-url',
  // RL_MODEL_ENDPOINT: 'your-rl-model-endpoint',
};

export const getAlphaVantageKey = () => {
  return API_KEYS.ALPHA_VANTAGE;
};

