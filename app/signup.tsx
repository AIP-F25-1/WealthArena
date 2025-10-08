import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Button, TextInput, Card, Icon, FoxMascot, tokens } from '@/src/design-system';

export default function SignupScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Error states
  const [firstNameError, setFirstNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignup = () => {
    // Reset errors
    setFirstNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate
    let hasError = false;
    
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

    // Signup successful - go to onboarding
    console.log('Signup with:', firstName, lastName, email, password);
    router.replace('/onboarding');
  };

  const handleGoogleSignIn = () => {
    console.log('Google Sign Up');
    // Google sign up - new users go to onboarding
    router.replace('/onboarding');
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
            {/* Social Login */}
            <Button
              variant="secondary"
              size="large"
              onPress={handleGoogleSignIn}
              fullWidth
              icon={<Image source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }} style={{ width: 20, height: 20 }} />}
            >
              Continue with Google
            </Button>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text variant="small" muted style={styles.dividerText}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Input Fields */}
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
              icon={<Icon name="trophy" size={20} color={theme.bg} />}
            >
              Create Account
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
