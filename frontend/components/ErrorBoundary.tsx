/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */

import React, { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card, Icon, tokens } from '@/src/design-system';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Card style={styles.errorCard}>
            <View style={styles.errorContent}>
              <Icon name="warning" size={48} color="#ff6b6b" />
              <Text variant="h3" weight="semibold" style={styles.errorTitle}>
                Oops! Something went wrong
              </Text>
              <Text variant="body" style={styles.errorMessage}>
                We're sorry, but something unexpected happened. Don't worry, your data is safe.
              </Text>
              
              {__DEV__ && this.state.error && (
                <View style={styles.errorDetails}>
                  <Text variant="small" style={styles.errorText}>
                    {this.state.error.toString()}
                  </Text>
                </View>
              )}
              
              <Button 
                variant="primary" 
                onPress={this.handleRetry}
                style={styles.retryButton}
              >
                Try Again
              </Button>
            </View>
          </Card>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: '#f8f9fa',
  },
  errorCard: {
    maxWidth: 400,
    width: '100%',
  },
  errorContent: {
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  errorTitle: {
    textAlign: 'center',
    color: '#333',
  },
  errorMessage: {
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
  },
  errorDetails: {
    backgroundColor: '#f5f5f5',
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    width: '100%',
    marginTop: tokens.spacing.sm,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#666',
  },
  retryButton: {
    marginTop: tokens.spacing.md,
    minWidth: 120,
  },
});
