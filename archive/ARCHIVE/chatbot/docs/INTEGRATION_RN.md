# WealthArena React Native Integration Guide

This guide shows how to integrate the WealthArena mobile SDK and UI components into your existing React Native app.

## Installation

### 1. Install the SDK and UI Package

```bash
npm install @wealtharena/mobile-sdk-rn @wealtharena/wealtharena-rn
# or
yarn add @wealtharena/mobile-sdk-rn @wealtharena/wealtharena-rn
```

### 2. Install Peer Dependencies

```bash
npm install react-native-svg
# or
yarn add react-native-svg
```

### 3. iOS Setup (if using React Native < 0.60)

```bash
cd ios && pod install
```

## Basic Integration

### 1. Create the WealthArena Client

```typescript
import { createWealthArenaClient } from '@wealtharena/mobile-sdk-rn';

// Create client instance
const client = createWealthArenaClient(
  'http://127.0.0.1:8000', // Your backend URL
  'your-optional-token'    // Optional auth token
);
```

### 2. Add the WealthArena Screen to Your Navigator

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { WealthArenaScreen } from '@wealtharena/wealtharena-rn';
import { createWealthArenaClient } from '@wealtharena/mobile-sdk-rn';

const Stack = createStackNavigator();

// Create client
const wealthArenaClient = createWealthArenaClient('http://127.0.0.1:8000');

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen 
          name="WealthArena" 
          options={{ title: 'Trading Education' }}
        >
          {() => (
            <WealthArenaScreen 
              client={wealthArenaClient}
              onEvent={(event) => {
                console.log('WealthArena Event:', event);
                // Handle analytics, logging, etc.
              }}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### 3. Navigate to WealthArena

```typescript
import { useNavigation } from '@react-navigation/native';

function HomeScreen() {
  const navigation = useNavigation();

  return (
    <View>
      <Button 
        title="Open Trading Education"
        onPress={() => navigation.navigate('WealthArena')}
      />
    </View>
  );
}
```

## Advanced Integration

### Custom Theme

```typescript
import { WealthArenaScreen, defaultTheme } from '@wealtharena/wealtharena-rn';

const customTheme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    primary: '#00ff88',    // Neon green
    background: '#0b0f12', // Dark background
    surface: '#1a1f24',   // Card background
  }
};

<WealthArenaScreen 
  client={client}
  theme={customTheme}
  onEvent={handleEvent}
/>
```

### SDK-Only Integration (No UI)

If you want to use only the SDK without the UI components:

```typescript
import { createWealthArenaClient } from '@wealtharena/mobile-sdk-rn';

const client = createWealthArenaClient('http://127.0.0.1:8000');

// Chat with the bot
const chatResponse = await client.chat({
  message: 'Explain RSI to me',
  symbol: 'AAPL'
});

// Analyze an asset
const analysis = await client.analyze({
  symbol: 'AAPL'
});

// Get trading state
const state = await client.state();

// Execute paper trade
const trade = await client.paperTrade({
  action: 'buy',
  symbol: 'AAPL',
  quantity: 10
});

// Get educational content
const lessons = await client.learn();
```

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
WEALTHARENA_BASE_URL=http://127.0.0.1:8000
WEALTHARENA_TOKEN=your-optional-token
```

### TypeScript Configuration

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@wealtharena/*": ["node_modules/@wealtharena/*"]
    }
  }
}
```

## Error Handling

```typescript
import { WealthArenaError } from '@wealtharena/mobile-sdk-rn';

try {
  const response = await client.chat({ message: 'Hello' });
} catch (error) {
  if (error instanceof WealthArenaError) {
    console.error('WealthArena Error:', error.message);
    console.error('Error Code:', error.code);
    console.error('Status:', error.status);
  } else {
    console.error('Unknown Error:', error);
  }
}
```

## Event Handling

The `onEvent` callback receives events for analytics and logging:

```typescript
const handleEvent = (event: { type: string; data: any }) => {
  switch (event.type) {
    case 'ChatMessage':
      // Log chat interactions
      analytics.track('chat_message', { 
        message: event.data.reply 
      });
      break;
      
    case 'TradePlaced':
      // Log trading activity
      analytics.track('paper_trade', {
        symbol: event.data.symbol,
        action: event.data.action
      });
      break;
      
    case 'AnalysisGenerated':
      // Log analysis requests
      analytics.track('analysis_request', {
        symbol: event.data.symbol
      });
      break;
  }
};
```

## Testing

### Unit Tests

```typescript
import { createWealthArenaClient } from '@wealtharena/mobile-sdk-rn';

describe('WealthArena SDK', () => {
  const client = createWealthArenaClient('http://localhost:8000');

  it('should connect to health endpoint', async () => {
    const health = await client.health();
    expect(health.status).toBe('healthy');
  });

  it('should handle chat requests', async () => {
    const response = await client.chat({
      message: 'What is RSI?'
    });
    expect(response.reply).toBeDefined();
    expect(response.sources).toBeInstanceOf(Array);
  });
});
```

### Mock Server for Testing

```typescript
// Create a mock server for testing
const mockServer = {
  '/v1/healthz': { status: 'healthy' },
  '/v1/chat': { reply: 'Mock response' },
  // ... other endpoints
};
```

## Troubleshooting

### Common Issues

1. **Network Connection Issues**
   - Ensure your backend is running on the correct port
   - Check CORS configuration for mobile emulators
   - For Android emulator, use `http://10.0.2.2:8000`
   - For iOS simulator, use `http://127.0.0.1:8000`

2. **Build Issues**
   - Make sure you've installed `react-native-svg`
   - Run `cd ios && pod install` for iOS
   - Clear Metro cache: `npx react-native start --reset-cache`

3. **TypeScript Issues**
   - Ensure you have the latest TypeScript types
   - Check your `tsconfig.json` configuration

### Debug Mode

Enable debug logging:

```typescript
const client = createWealthArenaClient('http://127.0.0.1:8000', {
  timeout: 30000,
  retries: 3,
  debug: true // Enable debug logging
});
```

## Production Deployment

### Backend Configuration

1. Set up your production backend with proper CORS
2. Configure authentication if needed
3. Set up monitoring and logging

### Mobile App Configuration

```typescript
// Production configuration
const client = createWealthArenaClient(
  'https://api.wealtharena.com', // Production URL
  process.env.WEALTHARENA_TOKEN   // Production token
);
```

## Support

For issues and questions:
- Check the [GitHub repository](https://github.com/wealtharena/mobile-sdk)
- Review the [API documentation](https://docs.wealtharena.com)
- Contact support at support@wealtharena.com

