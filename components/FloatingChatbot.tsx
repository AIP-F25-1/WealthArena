import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
  Dimensions,
} from 'react-native';
import { Bot } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface FloatingChatbotProps {
  style?: any;
}

export default function FloatingChatbot({ style }: FloatingChatbotProps) {
  const handleChatbotPress = () => {
    router.push('/(tabs)/chat');
  };

  return (
    <TouchableOpacity
      style={[styles.floatingButton, style]}
      onPress={handleChatbotPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[Colors.neonPurple, Colors.neonCyan]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.buttonContent}>
          <Bot size={24} color={Colors.background} />
          <View style={styles.notificationDot} />
        </View>
      </LinearGradient>
      
      {/* Floating animation effect */}
      <View style={styles.floatingEffect} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100, // Above the tab bar
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: Colors.neonPurple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  gradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.background,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  floatingEffect: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 34,
    backgroundColor: 'rgba(199, 36, 245, 0.2)',
    shadowColor: Colors.neonPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
  },
});
