import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useTheme, Text, Button, TextInput, Card, Icon, FoxMascot, tokens } from '@/src/design-system';
import { login } from '@/services/apiService';
import { useUser } from '@/contexts/UserContext';
import { getNetworkInfo } from '@/config/apiConfig';

// Complete OAuth session when browser redirects back
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { login: loginUser } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Get platform-specific client IDs
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
  const isGoogleConfigured = !!googleClientId;
  
  // Compute redirect URI using makeRedirectUri
  const redirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI 
    ? process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI 
    : makeRedirectUri({ useProxy: true });

  // Configure Google OAuth - use a dummy config if not configured to satisfy hook requirements
  const googleAuthConfig = isGoogleConfigured ? {
    ...(Platform.OS === 'ios' && process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
      : Platform.OS === 'android' && process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
      ? { androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID }
      : Platform.OS === 'web' && process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      ? { webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID }
      : { clientId: googleClientId }),
    redirectUri,
    scopes: ['profile', 'email'] as const,
  } : {
    // Dummy config when not configured - hook still needs to be called
    clientId: 'dummy-client-id',
    redirectUri: makeRedirectUri({ useProxy: true }),
    scopes: ['profile', 'email'] as const,
  };

  // Always call the hook (React requirement) but it won't work if not configured
  const [request, response, promptAsync] = Google.useAuthRequest(googleAuthConfig);

  const handleGoogleLogin = async (googleAccessToken: string) => {
    setIsGoogleLoading(true);
    try {
      // Import googleLogin from apiService (will be added)
      const { googleLogin } = await import('@/services/apiService');
      const response = await googleLogin(googleAccessToken);
      
      if (response.success && response.data) {
        await loginUser(response.data.user, response.data.token);
        Alert.alert('Success', `Welcome, ${response.data.user.username}!`);
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Login Failed', response.message || 'Google authentication failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to login with Google. Please try again.';
      // eslint-disable-next-line no-console
      console.error('Google login error:', errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle Google OAuth response (only if configured)
  useEffect(() => {
    if (!isGoogleConfigured) return; // Skip if Google not configured
    
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleGoogleLogin(authentication.accessToken);
      }
    } else if (response?.type === 'error') {
      setIsGoogleLoading(false);
      // Only show error if configured (otherwise might be from dummy config)
      if (isGoogleConfigured) {
        Alert.alert('Error', 'Google authentication failed. Please try again.');
      }
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      setIsGoogleLoading(false);
    }
  }, [response, isGoogleConfigured]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    // Reset errors
    setEmailError('');
    setPasswordError('');

    // Validate
    let hasError = false;
    if (!email) {
      setEmailError('Email is required');
      hasError = true;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      hasError = true;
    }
    
    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      hasError = true;
    }

    if (hasError) return;

    // Call backend API
    setIsLoading(true);
    try {
      const response = await login({ email, password });
      
      if (response.success && response.data) {
        // Save user data to context
        await loginUser(response.data.user, response.data.token);
        
        Alert.alert('Success', `Welcome back, ${response.data.user.username}!`);
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Login Failed', response.message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to login. Please try again.';
      // eslint-disable-next-line no-console
      console.error('Login error:', errorMessage);
      
      // Get network info for debugging
      const networkInfo = getNetworkInfo();
      // eslint-disable-next-line no-console
      console.error('Network info:', networkInfo);
      
      // Provide helpful error message
      let userMessage = errorMessage;
      if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
        userMessage = `Cannot connect to server. Please ensure:\n\n1. Backend is running on port 3000\n2. Your device and computer are on the same network\n3. Firewall allows connections on port 3000\n4. If using a physical device, check .env.local has EXPO_PUBLIC_BACKEND_URL set with your machine's IP\n\nAuto-detected IP: ${networkInfo.autoDetectedIP}`;
      }
      
      Alert.alert('Error', userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isGoogleConfigured || !request || !promptAsync) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('Google OAuth is not configured. Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID');
      }
      // Silently return - button is already hidden when not configured
      return;
    }
    setIsGoogleLoading(true);
    try {
      const result = await promptAsync();
      // Handle immediate cancellation/dismissal
      if (result?.type === 'dismiss' || result?.type === 'cancel') {
        setIsGoogleLoading(false);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Google sign-in failed';
      // eslint-disable-next-line no-console
      console.error('Google sign-in error:', errorMessage);
      setIsGoogleLoading(false);
      Alert.alert('Error', error.message || 'Failed to start Google sign-in. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Section with Mascot */}
          <View style={styles.hero}>
            <FoxMascot variant="confident" size={100} />
            <Text variant="h1" weight="bold" center>
              Welcome Back!
            </Text>
            <Text variant="body" center muted style={styles.subtitle}>
              Sign in to continue your trading journey
            </Text>
          </View>

          {/* Login Form Card */}
          <Card style={styles.formCard} elevation="med">
            {/* Social Login - Only show if Google is configured */}
            {isGoogleConfigured && (
              <>
                <Button
                  variant="secondary"
                  size="large"
                  onPress={handleGoogleSignIn}
                  fullWidth
                  loading={isGoogleLoading}
                  disabled={isGoogleLoading || isLoading}
                  icon={<Image source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }} style={{ width: 20, height: 20 }} />}
                >
                  {isGoogleLoading ? 'Signing in with Google...' : 'Continue with Google'}
                </Button>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                  <Text variant="small" muted style={styles.dividerText}>OR</Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                </View>
              </>
            )}

            {/* Input Fields */}
            <TextInput
              label="Email"
              placeholder="your.email@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              selectionColor={theme.primary}
              error={emailError}
            />

            <TextInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              selectionColor={theme.primary}
              rightIcon={<Text variant="small" color={theme.primary}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>}
              onRightIconPress={() => setShowPassword(!showPassword)}
              error={passwordError}
            />

            {/* Forgot Password */}
            <Pressable style={styles.forgotPassword}>
              <Text variant="small" color={theme.primary} weight="semibold">
                Forgot Password?
              </Text>
            </Pressable>

            {/* Login Button */}
            <Button
              variant="primary"
              size="large"
              onPress={handleLogin}
              fullWidth
              loading={isLoading}
              disabled={isLoading}
              icon={!isLoading ? <Icon name="check-shield" size={20} color={theme.bg} /> : undefined}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Card>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="small" muted>Don't have an account? </Text>
            <Pressable onPress={() => router.push('/signup')}>
              <Text variant="small" weight="bold" color={theme.primary}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Icon name="shield" size={16} color={theme.muted} />
            <Text variant="xs" muted style={styles.securityText}>
              Your data is encrypted and secure
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  hero: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
  },
  subtitle: {
    marginTop: tokens.spacing.sm,
  },
  formCard: {
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: tokens.spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: tokens.spacing.md,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -tokens.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing.md,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.xl,
  },
  securityText: {
    opacity: 0.7,
  },
});
