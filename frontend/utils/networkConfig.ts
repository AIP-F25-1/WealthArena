/**
 * Dynamic Network Configuration Utility
 * Automatically resolves backend URLs based on platform, environment, and network conditions
 * Supports iOS Simulator, Android Emulator, physical devices, and web
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@wealtharena:backend_url';
const STORAGE_KEY_CHATBOT = '@wealtharena:chatbot_url';
const STORAGE_KEY_RL = '@wealtharena:rl_service_url';

/**
 * Platform detection helpers
 */
const isIOSSimulator = Platform.OS === 'ios' && __DEV__ && Constants.isDevice === false;
const isAndroidEmulator = Platform.OS === 'android' && __DEV__ && Constants.isDevice === false;
const isPhysicalDevice = Constants.isDevice === true;
const isWeb = Platform.OS === 'web';
const isDevelopment = process.env.NODE_ENV === 'development' || __DEV__;

/**
 * Get the appropriate localhost URL based on platform
 */
function getLocalhostURL(port: number): string {
  if (isWeb) {
    return `http://localhost:${port}`;
  }
  
  if (isAndroidEmulator) {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    return `http://10.0.2.2:${port}`;
  }
  
  if (isIOSSimulator) {
    // iOS Simulator on Mac can use localhost
    // On Windows, it typically needs the machine IP, but we'll try localhost first
    return `http://localhost:${port}`;
  }
  
  // Physical devices need the machine's IP address
  // This will be resolved from environment or AsyncStorage
  return getPhysicalDeviceURL(port);
}

/**
 * Extract IP address from Expo's host URI automatically
 * Expo dev server exposes the IP it's using in Constants
 */
function getIPFromExpoHost(): string | null {
  try {
    // Expo Constants exposes the debugger host/IP
    // Check multiple possible locations where Expo stores this info
    const hostUri = Constants.expoConfig?.hostUri || 
                    Constants.manifest?.debuggerHost ||
                    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
                    (Constants as any).manifest?.hostUri;
    
    if (hostUri) {
      // Extract IP from formats like: "192.168.1.100:8081" or "192.168.1.100"
      // Use a more efficient regex that prevents catastrophic backtracking
      const ipMatch = hostUri.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch) {
        // Validate that each octet is within valid IP range (0-255)
        const ip = ipMatch[1];
        const octets = ip.split('.');
        const isValidIP = octets.every(octet => {
          const num = parseInt(octet, 10);
          return num >= 0 && num <= 255;
        });
        if (isValidIP) {
          return ip;
        }
      }
      
      // Try to extract from full URL format with safer regex
      const urlMatch = hostUri.match(/https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (urlMatch) {
        const ip = urlMatch[1];
        const octets = ip.split('.');
        const isValidIP = octets.every(octet => {
          const num = parseInt(octet, 10);
          return num >= 0 && num <= 255;
        });
        if (isValidIP) {
          return ip;
        }
      }
    }
    
    // Fallback: Check if there's an expoGo object with host info
    const expoGo = (Constants.expoConfig as any)?.extra?.expoGo;
    if (expoGo?.hostUri) {
      const ipMatch = expoGo.hostUri.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch) {
        const ip = ipMatch[1];
        const octets = ip.split('.');
        const isValidIP = octets.every(octet => {
          const num = parseInt(octet, 10);
          return num >= 0 && num <= 255;
        });
        if (isValidIP) {
          return ip;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to extract IP from Expo host:', error);
  }
  
  return null;
}

/**
 * Get URL for physical devices
 * Priority:
 * 1. Environment variable (manual override)
 * 2. Auto-detect from Expo's host URI (AUTOMATIC - no config needed!)
 * 3. Cached IP from AsyncStorage
 * 4. Extract from EXPO_PUBLIC_BACKEND_URL if it contains an IP
 * 5. Fallback to localhost
 */
async function getPhysicalDeviceURL(port: number, forceRefresh: boolean = false): Promise<string> {
  // PRIORITY 1: Environment variable (SETUP SCRIPT IS SOURCE OF TRUTH)
  // The master_setup_simplified.ps1 script sets EXPO_PUBLIC_BACKEND_URL with the correct IP
  // This should always be used if available, as it's the most reliable source
  const envVar = port === 3000 
    ? process.env.EXPO_PUBLIC_BACKEND_URL
    : port === 8000 || port === 5001
    ? process.env.EXPO_PUBLIC_CHATBOT_URL
    : port === 5002
    ? process.env.EXPO_PUBLIC_RL_SERVICE_URL
    : undefined;

  if (envVar && envVar !== `http://localhost:${port}`) {
    // Environment variable is set and not localhost - USE IT (setup script is source of truth)
    // Extract IP if it's in the format http://IP:port
    const ipMatch = envVar.match(/^http:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/);
    if (ipMatch) {
      const ip = ipMatch[1];
      const portNum = parseInt(ipMatch[2], 10);
      
      // Validate IP octets are within valid range (0-255)
      const octets = ip.split('.');
      const isValidIP = octets.every(octet => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255;
      });
      
      // Validate port is within valid range (1-65535)
      const isValidPort = portNum >= 1 && portNum <= 65535;
      
      if (isValidIP && isValidPort) {
        // Validate it's not a VirtualBox IP
        if (!ip.startsWith('192.168.56.')) {
          // Cache this IP for future use
          await cacheIPAddress(ip, port);
          console.log(`✅ Using IP from setup script (env var): ${envVar}`);
          return envVar;
        } else {
          console.warn(`⚠️ Environment variable contains VirtualBox IP, trying other methods...`);
        }
      }
    }
    // If it's a full URL (not localhost), use it directly
    if (!envVar.includes('localhost') && !envVar.includes('192.168.56.')) {
      console.log(`✅ Using URL from environment variable: ${envVar}`);
      return envVar;
    }
  }

  // PRIORITY 2: Auto-detect from Expo's host URI (fallback if env var not set)
  // This is a fallback - the setup script should have set the env var correctly
  // If env var is missing, try to detect from Expo (but warn user to run setup script)
  const autoDetectedIP = getIPFromExpoHost();
  if (autoDetectedIP) {
    // Skip VirtualBox network IPs (192.168.56.x) - prefer actual network IPs
    if (!autoDetectedIP.startsWith('192.168.56.')) {
      const autoURL = `http://${autoDetectedIP}:${port}`;
      // Always update cache with latest detected IP (ensures cache stays current)
      await cacheIPAddress(autoDetectedIP, port);
      console.log(`✅ Auto-detected backend IP from Expo (fallback): ${autoDetectedIP}:${port}`);
      console.warn(`⚠️ NOTE: EXPO_PUBLIC_BACKEND_URL not set. Consider re-running master_setup_simplified.ps1`);
      return autoURL;
    } else {
      console.log(`⚠️ Skipping VirtualBox network IP ${autoDetectedIP}, trying other methods...`);
    }
  } else {
    console.warn(`⚠️ Could not auto-detect IP from Expo. Make sure EXPO_PUBLIC_BACKEND_URL is set in .env.local`);
  }

  // If force refresh, skip cache and try other methods
  if (!forceRefresh) {
    // Try to get cached IP from AsyncStorage (only if not forcing refresh)
    const storageKey = port === 3000 
      ? STORAGE_KEY
      : port === 8000 || port === 5001
      ? STORAGE_KEY_CHATBOT
      : STORAGE_KEY_RL;

    try {
      const cachedURL = await AsyncStorage.getItem(storageKey);
      if (cachedURL) {
        // Validate cached URL - skip if it's a VirtualBox IP
        if (!cachedURL.includes('192.168.56.')) {
          console.log(`📦 Using cached backend URL: ${cachedURL}`);
          return cachedURL;
        } else {
          console.log(`⚠️ Cached URL is VirtualBox IP, clearing cache and re-detecting...`);
          // Clear the bad cached IP
          await AsyncStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.warn('Failed to read cached URL from AsyncStorage:', error);
    }
  }

  // Extract IP from EXPO_PUBLIC_BACKEND_URL if available
  const backendURL = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backendURL) {
  const ipMatch = backendURL.match(/^http:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/);
  if (ipMatch) {
    const ip = ipMatch[1];
    const portNum = parseInt(ipMatch[2], 10);
    
    // Validate IP octets and port
    const octets = ip.split('.');
    const isValidIP = octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
    const isValidPort = portNum >= 1 && portNum <= 65535;
    
    if (isValidIP && isValidPort) {
      const url = `http://${ip}:${port}`;
      await cacheIPAddress(ip, port);
      return url;
    }
  }
  }

  // Fallback to localhost (will likely not work on physical devices)
  console.warn(`❌ Could not auto-detect IP for port ${port}, falling back to localhost. This may not work on physical devices.`);
  return `http://localhost:${port}`;
}

/**
 * Cache IP address in AsyncStorage
 */
async function cacheIPAddress(ip: string, port: number): Promise<void> {
  const url = `http://${ip}:${port}`;
  const storageKey = port === 3000 
    ? STORAGE_KEY
    : port === 8000 || port === 5001
    ? STORAGE_KEY_CHATBOT
    : STORAGE_KEY_RL;

  try {
    await AsyncStorage.setItem(storageKey, url);
  } catch (error) {
    console.warn('Failed to cache URL in AsyncStorage:', error);
  }
}

/**
 * Manually set and cache backend URL
 * Useful for settings screen where user can configure IP
 */
export async function setBackendURL(url: string, port: number = 3000): Promise<void> {
  const ipMatch = url.match(/^http:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/);
  if (ipMatch) {
    const ip = ipMatch[1];
    const portNum = parseInt(ipMatch[2], 10);
    
    // Validate IP octets and port
    const octets = ip.split('.');
    const isValidIP = octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
    const isValidPort = portNum >= 1 && portNum <= 65535;
    
    if (isValidIP && isValidPort) {
      await cacheIPAddress(ip, port);
    }
  } else {
    // Cache the full URL even if it's not an IP (e.g., domain name)
    const storageKey = port === 3000 
      ? STORAGE_KEY
      : port === 8000 || port === 5001
      ? STORAGE_KEY_CHATBOT
      : STORAGE_KEY_RL;
    try {
      await AsyncStorage.setItem(storageKey, url);
    } catch (error) {
      console.warn('Failed to cache URL:', error);
    }
  }
}

/**
 * Get cached backend URL
 */
export async function getCachedBackendURL(port: number = 3000): Promise<string | null> {
  const storageKey = port === 3000 
    ? STORAGE_KEY
    : port === 8000 || port === 5001
    ? STORAGE_KEY_CHATBOT
    : STORAGE_KEY_RL;
  
  try {
    return await AsyncStorage.getItem(storageKey);
  } catch (error) {
    console.warn('Failed to read cached URL:', error);
    return null;
  }
}

/**
 * Clear cached URLs
 */
export async function clearCachedURLs(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_KEY_CHATBOT, STORAGE_KEY_RL]);
  } catch (error) {
    console.warn('Failed to clear cached URLs:', error);
  }
}

/**
 * Dynamically resolve backend base URL
 * This is the main function that should be used
 * @param port - Port number (3000 for backend, 8000/5001 for chatbot, 5002 for RL service)
 * @param forceRefresh - If true, skip cache and force fresh IP detection (useful for login/signup)
 */
export async function resolveBackendURL(port: number = 3000, forceRefresh: boolean = false): Promise<string> {
  // If environment variable is explicitly set and not localhost, use it
  const envVar = port === 3000 
    ? process.env.EXPO_PUBLIC_BACKEND_URL
    : port === 8000 || port === 5001
    ? process.env.EXPO_PUBLIC_CHATBOT_URL
    : port === 5002
    ? process.env.EXPO_PUBLIC_RL_SERVICE_URL
    : undefined;

  // Production or deployment environments
  if (!isDevelopment) {
    return envVar || getDefaultProductionURL(port);
  }

  // Development: use environment variable if set and not localhost
  if (envVar && !envVar.includes('localhost')) {
    return envVar;
  }

  // For simulators/emulators, use platform-specific localhost
  if (isIOSSimulator || isAndroidEmulator || isWeb) {
    return getLocalhostURL(port);
  }

  // For physical devices, resolve dynamically (with optional force refresh)
  if (isPhysicalDevice) {
    return await getPhysicalDeviceURL(port, forceRefresh);
  }

  // Fallback
  return envVar || getLocalhostURL(port);
}

/**
 * Get default production URL based on deployment environment
 */
function getDefaultProductionURL(port: number): string {
  const DEPLOYMENT_ENV = process.env.EXPO_PUBLIC_DEPLOYMENT_ENV || 'local';
  
  if (DEPLOYMENT_ENV === 'azure') {
    if (port === 3000) return 'https://wealtharena-backend.azurewebsites.net';
    if (port === 8000 || port === 5001) return 'https://wealtharena-chatbot.azurewebsites.net';
    if (port === 5002) return 'https://wealtharena-rl.azurewebsites.net';
  }
  
  if (DEPLOYMENT_ENV === 'gcp') {
    if (port === 3000) return 'https://wealtharena-backend.appspot.com';
    if (port === 8000 || port === 5001) return 'https://wealtharena-chatbot.appspot.com';
    if (port === 5002) return 'https://wealtharena-rl.appspot.com';
  }
  
  return `http://localhost:${port}`;
}

/**
 * Synchronous version for use in config files (uses cached value or falls back)
 * Now includes automatic IP detection from Expo's host URI
 */
export function getBackendURLSync(port: number = 3000): string {
  // Check environment variable first (manual override)
  const envVar = port === 3000 
    ? process.env.EXPO_PUBLIC_BACKEND_URL
    : port === 8000 || port === 5001
    ? process.env.EXPO_PUBLIC_CHATBOT_URL
    : port === 5002
    ? process.env.EXPO_PUBLIC_RL_SERVICE_URL
    : undefined;

  if (envVar && (!isDevelopment || !envVar.includes('localhost'))) {
    return envVar;
  }

  // For simulators/emulators/web, use platform-specific localhost
  if (isIOSSimulator || isAndroidEmulator || isWeb) {
    return getLocalhostURL(port);
  }

  // For physical devices in development, AUTO-DETECT IP from Expo
  if (isPhysicalDevice && isDevelopment) {
    // AUTOMATIC: Try to extract IP from Expo's host URI (no manual config needed!)
    const autoDetectedIP = getIPFromExpoHost();
    if (autoDetectedIP) {
      return `http://${autoDetectedIP}:${port}`;
    }
    
    // Fallback: Try to extract IP from backend URL env var
    if (process.env.EXPO_PUBLIC_BACKEND_URL) {
      const ipMatch = process.env.EXPO_PUBLIC_BACKEND_URL.match(/^http:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/);
      if (ipMatch) {
        const ip = ipMatch[1];
        const portNum = parseInt(ipMatch[2], 10);
        
        // Validate IP octets and port
        const octets = ip.split('.');
        const isValidIP = octets.every(octet => {
          const num = parseInt(octet, 10);
          return num >= 0 && num <= 255;
        });
        const isValidPort = portNum >= 1 && portNum <= 65535;
        
        if (isValidIP && isValidPort) {
          return `http://${ip}:${port}`;
        }
      }
    }
    // Final fallback - async resolution will update this
    return `http://localhost:${port}`;
  }

  // Production fallback
  if (!isDevelopment) {
    return getDefaultProductionURL(port);
  }

  return envVar || getLocalhostURL(port);
}

/**
 * Network configuration info for debugging
 */
export function getNetworkInfo() {
  const autoDetectedIP = getIPFromExpoHost();
  
  return {
    platform: Platform.OS,
    isIOSSimulator,
    isAndroidEmulator,
    isPhysicalDevice,
    isWeb,
    isDevelopment,
    executionEnvironment: Constants.executionEnvironment,
    isDevice: Constants.isDevice,
    autoDetectedIP: autoDetectedIP || 'Not detected',
    expoHostUri: Constants.expoConfig?.hostUri || 
                 Constants.manifest?.debuggerHost ||
                 (Constants as any).manifest?.hostUri ||
                 'Not available',
  };
}

