/**
 * Backend Connection Test Page
 * Test all backend API endpoints
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Button, Card, Icon } from '@/src/design-system';
import { checkHealth, getTopSignals, getLeaderboard, setAuthToken } from '@/services/apiService';

export default function BackendTestScreen() {
  const { theme } = useTheme();
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-test health on mount
  useEffect(() => {
    testHealth();
  }, []);

  const addResult = (message: string, success: boolean = true) => {
    const prefix = success ? '✅' : '❌';
    setTestResults((prev) => [`${prefix} ${message}`, ...prev]);
  };

  const testHealth = async () => {
    try {
      addResult('Testing backend health...');
      const result = await checkHealth();
      setHealthStatus(result);
      if (result.success) {
        addResult('Backend is online and healthy!', true);
      } else {
        addResult('Backend health check failed', false);
      }
    } catch (error: any) {
      addResult(`Health check error: ${error.message}`, false);
      setHealthStatus({ success: false, message: error.message });
    }
  };

  const testSignals = async () => {
    try {
      addResult('Testing AI Signals endpoint...');
      const signals = await getTopSignals(5);
      addResult(`Retrieved ${signals.length} AI signals`, true);
    } catch (error: any) {
      addResult(`Signals test failed: ${error.message}`, false);
    }
  };

  const testLeaderboard = async () => {
    try {
      addResult('Testing Leaderboard endpoint...');
      const leaders = await getLeaderboard(10);
      addResult(`Retrieved ${leaders.length} leaderboard entries`, true);
    } catch (error: any) {
      addResult(`Leaderboard test failed: ${error.message}`, false);
    }
  };

  const testAllEndpoints = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    await testHealth();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testSignals();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testLeaderboard();
    
    setIsLoading(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Icon name="network" size={48} color={theme.accent} />
          <Text variant="h1" weight="bold" center style={styles.title}>
            Backend Test
          </Text>
          <Text variant="body" center muted>
            Test WealthArena Backend API Connectivity
          </Text>
        </View>

        {/* Health Status Card */}
        <Card style={styles.card} elevation="med">
          <Text variant="h3" weight="bold" style={styles.cardTitle}>
            Health Status
          </Text>
          {healthStatus ? (
            <View>
              <View style={styles.statusRow}>
                <Text variant="body" weight="bold">Status:</Text>
                <Text 
                  variant="body" 
                  style={{ 
                    color: healthStatus.success ? theme.success : theme.error,
                    marginLeft: 8,
                  }}
                >
                  {healthStatus.success ? 'ONLINE ✅' : 'OFFLINE ❌'}
                </Text>
              </View>
              {healthStatus.message && (
                <Text variant="small" muted style={styles.statusMessage}>
                  {healthStatus.message}
                </Text>
              )}
              {healthStatus.database && (
                <View style={styles.statusRow}>
                  <Text variant="small" muted>Database:</Text>
                  <Text variant="small" style={{ marginLeft: 8 }}>
                    {healthStatus.database}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text variant="body" muted>
              Testing...
            </Text>
          )}
          <Button
            variant="secondary"
            size="medium"
            onPress={testHealth}
            style={styles.testButton}
          >
            Retest Health
          </Button>
        </Card>

        {/* Quick Tests */}
        <Card style={styles.card} elevation="med">
          <Text variant="h3" weight="bold" style={styles.cardTitle}>
            Quick Tests
          </Text>
          <View style={styles.buttonGroup}>
            <Button
              variant="secondary"
              size="medium"
              onPress={testAllEndpoints}
              loading={isLoading}
              disabled={isLoading}
              style={styles.actionButton}
            >
              Run All Tests
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onPress={testSignals}
              style={styles.actionButton}
            >
              Test Signals
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onPress={testLeaderboard}
              style={styles.actionButton}
            >
              Test Leaderboard
            </Button>
            <Button
              variant="outline"
              size="medium"
              onPress={clearResults}
              style={styles.actionButton}
            >
              Clear Results
            </Button>
          </View>
        </Card>

        {/* Test Results */}
        <Card style={styles.card} elevation="med">
          <Text variant="h3" weight="bold" style={styles.cardTitle}>
            Test Results
          </Text>
          {testResults.length > 0 ? (
            <View style={styles.results}>
              {testResults.map((result, index) => (
                <View key={index} style={styles.resultRow}>
                  <Text variant="small" style={{ fontFamily: 'monospace' }}>
                    {result}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="body" muted center>
              No tests run yet
            </Text>
          )}
        </Card>

        {/* Connection Info */}
        <Card style={styles.card} elevation="low">
          <Text variant="h3" weight="bold" style={styles.cardTitle}>
            Connection Info
          </Text>
          <View style={styles.infoRow}>
            <Text variant="small" muted>Backend URL:</Text>
            <Text variant="small" style={{ fontFamily: 'monospace' }}>
              http://localhost:3000/api
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="small" muted>Environment:</Text>
            <Text variant="small">Development</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusMessage: {
    marginTop: 8,
  },
  testButton: {
    marginTop: 16,
  },
  buttonGroup: {
    gap: 8,
  },
  actionButton: {
    marginBottom: 8,
  },
  results: {
    gap: 4,
  },
  resultRow: {
    paddingVertical: 4,
  },
  infoRow: {
    marginBottom: 8,
  },
});

