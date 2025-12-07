/**
 * WealthArena React Native Demo App
 * Example integration showing how to use the WealthArena SDK and UI components
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';

import { WealthArenaScreen } from '@wealtharena/wealtharena-rn';
import { createWealthArenaClient, WealthArenaClient } from '@wealtharena/mobile-sdk-rn';

const Stack = createStackNavigator();

// Create WealthArena client
const wealthArenaClient = createWealthArenaClient(
  'http://127.0.0.1:8000', // Backend URL
  undefined // No auth token for demo
);

function HomeScreen({ navigation }: any) {
  const handleEvent = (event: { type: string; data: any }) => {
    console.log('WealthArena Event:', event);
    
    // Show alert for demo purposes
    Alert.alert(
      'WealthArena Event',
      `Event: ${event.type}\nData: ${JSON.stringify(event.data, null, 2)}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WealthArena Demo</Text>
        <Text style={styles.subtitle}>Trading Education Platform</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.description}>
          This demo shows how to integrate WealthArena into your React Native app.
        </Text>
        
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('WealthArena')}
        >
          <Text style={styles.buttonText}>Open Trading Education</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={async () => {
            try {
              const health = await wealthArenaClient.health();
              Alert.alert('Health Check', `Status: ${health.status}\nService: ${health.service}`);
            } catch (error) {
              Alert.alert('Error', `Failed to connect: ${error}`);
            }
          }}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Test Connection
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Educational only. Not financial advice.
        </Text>
      </View>
    </View>
  );
}

function WealthArenaScreenWrapper({ navigation }: any) {
  const handleEvent = (event: { type: string; data: any }) => {
    console.log('WealthArena Event:', event);
    
    // Handle different event types
    switch (event.type) {
      case 'ChatMessage':
        console.log('Chat message sent:', event.data.reply);
        break;
      case 'TradePlaced':
        console.log('Trade executed:', event.data);
        break;
      case 'AnalysisGenerated':
        console.log('Analysis generated:', event.data.symbol);
        break;
      default:
        console.log('Unknown event:', event);
    }
  };

  return (
    <WealthArenaScreen
      client={wealthArenaClient}
      onEvent={handleEvent}
    />
  );
}

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0b0f12',
            },
            headerTintColor: '#00ff88',
            headerTitleStyle: {
              fontFamily: 'Courier New',
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
            options={{ title: 'WealthArena Demo' }}
          />
          <Stack.Screen 
            name="WealthArena" 
            component={WealthArenaScreenWrapper}
            options={{ title: 'Trading Education' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f12',
  },
  header: {
    padding: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ff88',
    fontFamily: 'Courier New',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    fontFamily: 'Courier New',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#00ff88',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0b0f12',
    fontFamily: 'Courier New',
  },
  secondaryButtonText: {
    color: '#00ff88',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

