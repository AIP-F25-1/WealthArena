/**
 * React Hook for Dynamic Network Configuration
 * Provides runtime URL resolution and management for backend services
 * Useful for physical devices where IP addresses may change
 */

import { useState, useEffect, useCallback } from 'react';
import { resolveBackendURL, setBackendURL, getCachedBackendURL, getNetworkInfo, clearCachedURLs } from '../utils/networkConfig';
import { API_CONFIG } from '../config/apiConfig';

interface NetworkConfig {
  backendURL: string;
  chatbotURL: string;
  rlServiceURL: string;
  isLoading: boolean;
  networkInfo: ReturnType<typeof getNetworkInfo>;
  refreshURLs: () => Promise<void>;
  updateBackendURL: (url: string) => Promise<void>;
  clearCache: () => Promise<void>;
}

/**
 * Hook to manage dynamic network configuration
 * Automatically resolves backend URLs based on platform and caches them
 */
export function useNetworkConfig(): NetworkConfig {
  const [backendURL, setBackendURLState] = useState<string>(API_CONFIG.BACKEND_BASE_URL);
  const [chatbotURL, setChatbotURLState] = useState<string>(API_CONFIG.CHATBOT_BASE_URL);
  const [rlServiceURL, setRLServiceURLState] = useState<string>(API_CONFIG.RL_SERVICE_URL);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [networkInfo] = useState(getNetworkInfo());

  // Resolve URLs on mount and when needed
  const refreshURLs = useCallback(async () => {
    setIsLoading(true);
    try {
      const [backend, chatbot, rl] = await Promise.all([
        resolveBackendURL(3000),
        resolveBackendURL(8000),
        resolveBackendURL(5002),
      ]);

      setBackendURLState(backend);
      setChatbotURLState(chatbot);
      setRLServiceURLState(rl);
    } catch (error) {
      console.error('Failed to resolve backend URLs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update backend URL manually (useful for settings screen)
  const updateBackendURL = useCallback(async (url: string) => {
    try {
      // Extract port from URL or use default
      const portMatch = url.match(/:(\d+)/);
      const port = portMatch ? parseInt(portMatch[1], 10) : 3000;
      
      await setBackendURL(url, port);
      
      // Update state
      if (port === 3000) {
        setBackendURLState(url);
      } else if (port === 8000 || port === 5001) {
        setChatbotURLState(url);
      } else if (port === 5002) {
        setRLServiceURLState(url);
      }
      
      // Refresh all URLs to ensure consistency
      await refreshURLs();
    } catch (error) {
      console.error('Failed to update backend URL:', error);
      throw error;
    }
  }, [refreshURLs]);

  // Clear cached URLs
  const clearCache = useCallback(async () => {
    try {
      await clearCachedURLs();
      // Reset to initial config values
      setBackendURLState(API_CONFIG.BACKEND_BASE_URL);
      setChatbotURLState(API_CONFIG.CHATBOT_BASE_URL);
      setRLServiceURLState(API_CONFIG.RL_SERVICE_URL);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }, []);

  // Resolve URLs on mount (only for physical devices that may need IP resolution)
  useEffect(() => {
    if (networkInfo.isPhysicalDevice) {
      refreshURLs();
    } else {
      setIsLoading(false);
    }
  }, [networkInfo.isPhysicalDevice, refreshURLs]);

  return {
    backendURL,
    chatbotURL,
    rlServiceURL,
    isLoading,
    networkInfo,
    refreshURLs,
    updateBackendURL,
    clearCache,
  };
}

/**
 * Hook to test backend connectivity
 * Useful for settings screen to validate backend URL before saving
 */
export function useBackendConnectivity(backendURL: string) {
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testConnection = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setIsConnected(null);

    try {
      const response = await fetch(`${backendURL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        setIsConnected(true);
        setError(null);
      } else {
        setIsConnected(false);
        setError(`Backend returned status ${response.status}`);
      }
    } catch (err) {
      setIsConnected(false);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Connection timeout. Check if backend is running.');
        } else if (err.message.includes('Network request failed')) {
          setError('Cannot reach backend. Check URL and network connection.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Unknown error occurred');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [backendURL]);

  return {
    isConnecting,
    isConnected,
    error,
    testConnection,
  };
}

