import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useTheme, Text, Button, TextInput, Card, Icon, FoxMascot, tokens } from '@/src/design-system';
import { signup, googleSignup } from '@/services/apiService';
import { useUser } from '@/contexts/UserContext';
import { API_CONFIG, getNetworkInfo } from '@/config/apiConfig';

// Complete OAuth session when browser redirects back
WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { login: loginUser } = useUser();
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  // Error states
  const [usernameError, setUsernameError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

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

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignup = async () => {
    // Reset errors
    setUsernameError('');
    setFirstNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate
    let hasError = false;
    
    if (!username.trim()) {
      setUsernameError('Username is required');
      hasError = true;
    } else if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      hasError = true;
    }
    
    if (!firstName.trim()) {
      setFirstNameError('First name is required');
      hasError = true;
    }
    
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
    
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      hasError = true;
    }

    if (hasError) return;

    // Call backend API
    setIsLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const response = await signup({
        username: username.trim(),
        email,
        password,
        full_name: fullName || undefined,
      });
      
      if (response.success && response.data) {
        // Save user data to context
        const userData = {
          ...response.data.user,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        };
        
        await loginUser(userData, response.data.token);
        
        // Directly redirect to onboarding without Alert dialog
        router.replace('/onboarding');
      } else {
        Alert.alert('Signup Failed', response.message);
      }
    } catch (error: unknown) {
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for network-related errors
        if (error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
          const networkInfo = getNetworkInfo();
          const backendURL = API_CONFIG.BACKEND_BASE_URL;
          
          // eslint-disable-next-line no-console
          console.error('Network error - Backend URL:', backendURL);
          // eslint-disable-next-line no-console
          console.error('Network info:', networkInfo);
          
          errorMessage = `Cannot connect to server (${backendURL}). Please ensure:\n\n1. Backend is running on port 3000\n2. Your device and computer are on the same network\n3. Firewall allows connections on port 3000\n4. If using a physical device, check .env.local has EXPO_PUBLIC_BACKEND_URL set with your machine's IP\n\nAuto-detected IP: ${networkInfo.autoDetectedIP}`;
        }
      }
      
      // eslint-disable-next-line no-console
      console.error('Signup error:', errorMessage);
      
      // If account already exists, suggest login
      if (errorMessage.toLowerCase().includes('already exists')) {
        Alert.alert(
          'Account Already Exists',
          'An account with this email or username already exists. Would you like to login instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Go to Login', 
              onPress: () => router.push('/login')
            }
          ]
        );
      } else {
        Alert.alert('Signup Failed', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async (googleAccessToken: string) => {
    setIsGoogleLoading(true);
    try {
      const response = await googleSignup(googleAccessToken);
      
      if (response.success && response.data) {
        await loginUser(response.data.user, response.data.token);
        Alert.alert(
          'Welcome to WealthArena! 🎉',
          `Account created successfully! Let's get you started, ${response.data.user.username}!`,
          [
            { 
              text: 'Continue', 
              onPress: () => {
                router.replace('/onboarding');
              }
            }
          ]
        );
      } else {
        Alert.alert('Signup Failed', response.message || 'Google authentication failed');
      }
    } catch (error: unknown) {
      let errorMessage = 'Failed to sign up with Google. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for network-related errors
        if (error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Cannot connect to server. Please ensure:\n\n1. Backend is running on port 3000\n2. Your device and computer are on the same network\n3. Firewall allows connections on port 3000';
        }
      }
      
      // eslint-disable-next-line no-console
      console.error('Google signup error:', errorMessage);
      
      // If account already exists, suggest login
      if (errorMessage.toLowerCase().includes('already exists')) {
        Alert.alert(
          'Account Already Exists',
          'An account with this email already exists. Would you like to login instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Go to Login', 
              onPress: () => router.push('/login')
            }
          ]
        );
      } else {
        Alert.alert('Signup Failed', errorMessage);
      }
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
        handleGoogleSignUp(authentication.accessToken);
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
      Alert.alert('Error', 'Failed to start Google authentication. Please try again.');
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
            <FoxMascot variant="excited" size={100} />
            <Text variant="h1" weight="bold" center>
              Join WealthArena
            </Text>
            <Text variant="body" center muted style={styles.subtitle}>
              Start your gamified trading adventure today
            </Text>
          </View>

          {/* Signup Form Card */}
          <Card style={styles.formCard} elevation="med">
            {/* Social Login - Only show if Google OAuth is configured */}
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
                  {isGoogleLoading ? 'Signing up with Google...' : 'Continue with Google'}
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
              label="Username"
              placeholder="Choose a unique username"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (usernameError) setUsernameError('');
              }}
              autoCapitalize="none"
              autoComplete="username"
              textContentType="username"
              selectionColor={theme.primary}
              error={usernameError}
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <TextInput
                  label="First Name"
                  placeholder="First Name"
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text);
                    if (firstNameError) setFirstNameError('');
                  }}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                  selectionColor={theme.primary}
                  error={firstNameError}
                />
              </View>
              <View style={{ width: tokens.spacing.sm }} />
              <View style={styles.halfInput}>
                <TextInput
                  label="Last Name"
                  placeholder="Last Name"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoComplete="family-name"
                  textContentType="familyName"
                  selectionColor={theme.primary}
                />
              </View>
            </View>

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
              placeholder="Create a strong password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              selectionColor={theme.primary}
              rightIcon={<Text variant="small" color={theme.primary}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>}
              onRightIconPress={() => setShowPassword(!showPassword)}
              error={passwordError}
            />

            <TextInput
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              selectionColor={theme.primary}
              rightIcon={<Text variant="small" color={theme.primary}>
                {showConfirmPassword ? 'Hide' : 'Show'}
              </Text>}
              onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
              error={confirmPasswordError}
            />

            {/* Terms Notice */}
            <View style={styles.termsNotice}>
              <Icon name="check-shield" size={16} color={theme.muted} />
              <Text variant="xs" muted style={styles.termsText}>
                By signing up, you agree to our Terms of Service and Privacy Policy
              </Text>
            </View>

            {/* Create Account Button */}
            <Button
              variant="primary"
              size="large"
              onPress={handleSignup}
              fullWidth
              loading={isLoading}
              disabled={isLoading}
              icon={!isLoading ? <Icon name="trophy" size={20} color={theme.bg} /> : undefined}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </Card>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="small" muted>Already have an account? </Text>
            <Pressable onPress={() => router.push('/login')}>
              <Text variant="small" weight="bold" color={theme.primary}>
                Sign In
              </Text>
            </Pressable>
          </View>

          {/* Benefits List */}
          <Card style={styles.benefitsCard}>
            <Text variant="body" weight="semibold" style={styles.benefitsTitle}>
              What you'll get:
            </Text>
            <View style={styles.benefitItem}>
              <Icon name="trophy" size={20} color={theme.yellow} />
              <Text variant="small" style={styles.benefitText}>
                Earn XP and unlock achievements
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="portfolio" size={20} color={theme.primary} />
              <Text variant="small" style={styles.benefitText}>
                Build and manage your portfolio
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="replay" size={20} color={theme.accent} />
              <Text variant="small" style={styles.benefitText}>
                Practice with historical market data
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="leaderboard" size={20} color={theme.yellow} />
              <Text variant="small" style={styles.benefitText}>
                Compete on the leaderboard
              </Text>
            </View>
          </Card>

          {/* Bottom Spacing */}
          <View style={{ height: tokens.spacing.xl }} />
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
  row: {
    flexDirection: 'row',
  },
  halfInput: {
    flex: 1,
  },
  termsNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.xs,
    marginTop: -tokens.spacing.xs,
  },
  termsText: {
    flex: 1,
    lineHeight: 16,
    opacity: 0.7,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  benefitsCard: {
    gap: tokens.spacing.sm,
  },
  benefitsTitle: {
    marginBottom: tokens.spacing.xs,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  benefitText: {
    flex: 1,
  },
});
