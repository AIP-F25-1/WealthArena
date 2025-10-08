import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, Text, FoxMascot, tokens } from '@/src/design-system';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* Decorative clouds */}
      <View pointerEvents="none" style={[styles.cloud, styles.cloudTop, { backgroundColor: theme.primary, opacity: 0.3 }]} />
      <View pointerEvents="none" style={[styles.cloud, styles.cloudBottom, { backgroundColor: theme.primary, opacity: 0.3 }]} />
      
      {/* Main content */}
      <View style={styles.content}>
        <Animated.View 
          style={[
            styles.logoContainer,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* Add background circle for better fox visibility */}
          <View style={[styles.foxBackground, { 
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
          }]}>
            <FoxMascot variant="excited" size={140} />
          </View>
        </Animated.View>

        <Text 
          variant="h1" 
          weight="bold" 
          center 
          color="#FFFFFF"
          style={styles.appName}
        >
          WealthArena
        </Text>
        <Text 
          variant="body" 
          center 
          color="#FFFFFF"
          style={styles.tagline}
        >
          Learn trading the fun way
        </Text>
      </View>

      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        <Pressable
          onPress={() => router.push('/signup')}
          style={[styles.button, styles.primaryButton]}
        >
          <Text variant="body" weight="bold" color={theme.primary}>
            Get Started
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/login')}
          style={[styles.button, styles.secondaryButton]}
        >
          <Text variant="body" weight="semibold" color="#FFFFFF">
            Already Have an Account
          </Text>
        </Pressable>
        
        <Text variant="small" center color="#FFFFFF" style={styles.copyright}>
          WealthArena 2025
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  cloud: {
    position: 'absolute',
    borderRadius: 100,
  },
  cloudTop: {
    width: width * 0.6,
    height: 180,
    top: 100,
    right: -50,
  },
  cloudBottom: {
    width: width * 0.5,
    height: 150,
    top: 240,
    left: -60,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  logoContainer: {
    marginBottom: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foxBackground: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  appName: {
    marginBottom: tokens.spacing.xs,
  },
  tagline: {
    opacity: 0.9,
  },
  buttonContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  button: {
    height: 56,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
  copyright: {
    marginTop: tokens.spacing.md,
    opacity: 0.7,
  },
});
