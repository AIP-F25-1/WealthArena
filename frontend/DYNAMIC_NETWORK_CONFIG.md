# Dynamic Network Configuration Guide

## Overview

The WealthArena frontend now features **automatic network configuration** that adapts to different devices, networks, and environments without manual configuration. This eliminates the need to manually update IP addresses when switching networks or devices.

## How It Works

### Automatic Detection

The system automatically detects your platform and resolves the correct backend URL:

1. **iOS Simulator** → Uses `http://localhost:3000` (works on Mac)
2. **Android Emulator** → Uses `http://10.0.2.2:3000` (Android emulator's special IP for host machine)
3. **Physical Devices** → Automatically extracts and caches your machine's IP address
4. **Web** → Uses `http://localhost:3000`

### Priority Order

URL resolution follows this priority (highest to lowest):

1. **Environment Variables** (`EXPO_PUBLIC_BACKEND_URL`) - Explicit override
2. **Platform Detection** - Automatically chosen based on device type
3. **Cached IP** - Stored in AsyncStorage for physical devices
4. **Environment Defaults** - Production URLs (Azure, GCP) or localhost fallback

## Usage

### Basic Usage (Automatic)

No configuration needed! The app automatically detects the correct URL:

```typescript
import { API_CONFIG } from '@/config/apiConfig';

// URLs are automatically resolved based on platform
const backendURL = API_CONFIG.BACKEND_BASE_URL;
const chatbotURL = API_CONFIG.CHATBOT_BASE_URL;
```

### Manual Override (Optional)

If you need to manually set the backend URL (e.g., for a different network), you can:

#### Option 1: Environment Variable

Create or edit `frontend/.env.local`:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:3000
EXPO_PUBLIC_CHATBOT_URL=http://192.168.1.100:8000
EXPO_PUBLIC_RL_SERVICE_URL=http://192.168.1.100:5002
```

#### Option 2: Runtime Configuration (React Hook)

Use the `useNetworkConfig` hook in your settings screen:

```typescript
import { useNetworkConfig } from '@/hooks/useNetworkConfig';

function SettingsScreen() {
  const { backendURL, updateBackendURL, testConnection } = useNetworkConfig();
  
  const handleUpdateURL = async (newURL: string) => {
    await updateBackendURL(newURL);
    // URL is now cached for future use
  };
  
  return (
    // Your settings UI
  );
}
```

### Advanced Usage

#### Get Network Information

```typescript
import { getNetworkInfo } from '@/utils/networkConfig';

const info = getNetworkInfo();
// Returns: { platform, isIOSSimulator, isAndroidEmulator, isPhysicalDevice, isWeb, ... }
```

#### Async URL Resolution

For runtime updates (especially useful for physical devices):

```typescript
import { resolveBackendURL } from '@/config/apiConfig';

// Resolves URL asynchronously (checks cache, environment, etc.)
const backendURL = await API_CONFIG.resolveBackendURL();
const chatbotURL = await API_CONFIG.resolveChatbotURL();
const rlServiceURL = await API_CONFIG.resolveRLServiceURL();
```

#### Test Connectivity

```typescript
import { useBackendConnectivity } from '@/hooks/useNetworkConfig';

function ConnectionTest({ backendURL }: { backendURL: string }) {
  const { isConnecting, isConnected, error, testConnection } = useBackendConnectivity(backendURL);
  
  return (
    <Button onPress={testConnection}>
      {isConnecting ? 'Testing...' : 'Test Connection'}
    </Button>
  );
}
```

#### Clear Cached URLs

```typescript
import { clearCachedURLs } from '@/config/apiConfig';

// Clear all cached IP addresses (forces re-detection)
await clearCachedURLs();
```

## Platform-Specific Behavior

### iOS Simulator
- **Mac**: Uses `localhost` (works automatically)
- **Windows**: May need IP address if localhost doesn't work
- **Solution**: Set `EXPO_PUBLIC_BACKEND_URL` in `.env.local` with your machine's IP

### Android Emulator
- Uses `10.0.2.2` automatically (Android's special IP for host machine)
- No configuration needed

### Physical Devices (iOS/Android)
- Automatically extracts IP from `EXPO_PUBLIC_BACKEND_URL` if set
- Caches IP in AsyncStorage for future sessions
- Falls back to localhost if no IP is found (won't work - set IP manually)

### Web
- Uses `localhost` automatically
- No configuration needed

## Troubleshooting

### Cannot Connect to Backend

1. **Check Backend is Running**
   ```bash
   # Test from your machine
   curl http://localhost:3000/api/health
   ```

2. **Verify Network Connection**
   - Ensure device and computer are on the same network
   - Check firewall allows connections on port 3000

3. **Check Environment Variables**
   ```bash
   # In frontend directory
   cat .env.local
   ```

4. **Test from Device**
   ```typescript
   import { useNetworkConfig, useBackendConnectivity } from '@/hooks/useNetworkConfig';
   
   // Use the test connection hook
   const { backendURL } = useNetworkConfig();
   const { testConnection, isConnected, error } = useBackendConnectivity(backendURL);
   ```

5. **Find Your IP Address**
   ```powershell
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

6. **Manual IP Configuration**
   - Update `frontend/.env.local` with your machine's IP
   - Restart Expo dev server
   - The app will cache this IP automatically

### Switching Networks

When switching networks (e.g., home Wi-Fi → mobile hotspot):

1. **Automatic**: If `EXPO_PUBLIC_BACKEND_URL` is set, the app will use that IP
2. **Manual**: Clear cache and update IP:
   ```typescript
   await clearCachedURLs();
   await updateBackendURL('http://NEW_IP:3000');
   ```

### Multiple Developers

For team development:

1. Each developer sets their IP in `frontend/.env.local`
2. `.env.local` is gitignored (won't conflict)
3. Each device automatically uses the correct URL

## Implementation Details

### Files

- **`utils/networkConfig.ts`** - Core network resolution logic
- **`config/apiConfig.ts`** - API configuration using dynamic URLs
- **`hooks/useNetworkConfig.ts`** - React hooks for network management
- **`.env.local`** - Optional manual configuration

### Caching

IP addresses are cached in AsyncStorage under:
- `@wealtharena:backend_url`
- `@wealtharena:chatbot_url`
- `@wealtharena:rl_service_url`

Cache persists across app restarts, making reconnections faster.

## Best Practices

1. **Development**: Use `.env.local` to set your IP once
2. **Production**: Use environment variables or deployment configs
3. **Testing**: Use `useBackendConnectivity` hook to verify connections
4. **Settings Screen**: Provide manual URL configuration option for users
5. **Error Handling**: Show helpful network error messages (already implemented in signup.tsx)

## Migration from Static Configuration

If you had static IP addresses configured:

1. Remove hardcoded IPs from code
2. Set `EXPO_PUBLIC_BACKEND_URL` in `.env.local` (optional)
3. The app will automatically use dynamic resolution
4. Existing `.env.local` with IP will be respected (highest priority)

