import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Path, Text as SvgText } from 'react-native-svg';

// Simple test icons to verify SVG is working
export const SimpleCoin = ({ size = 24, color = "#FFD700" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={color} stroke="#000000" strokeWidth="2" />
    <SvgText x="12" y="16" fontSize="12" fill="#000000" textAnchor="middle" fontWeight="bold">$</SvgText>
  </Svg>
);

export const SimpleStar = ({ size = 24, color = "#FFD700" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path 
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
      fill={color} 
      stroke="#000000" 
      strokeWidth="1" 
    />
  </Svg>
);

export const SimpleHeart = ({ size = 24, color = "#FF4B4B" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path 
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
      fill={color} 
      stroke="#000000" 
      strokeWidth="1" 
    />
  </Svg>
);

// Test component
export const SimpleIconTest = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Icon Test</Text>
      
      <View style={styles.testRow}>
        <View style={styles.iconContainer}>
          <SimpleCoin size={48} color="#FFD700" />
          <Text style={styles.label}>Coin</Text>
        </View>
        
        <View style={styles.iconContainer}>
          <SimpleStar size={48} color="#FFD700" />
          <Text style={styles.label}>Star</Text>
        </View>
        
        <View style={styles.iconContainer}>
          <SimpleHeart size={48} color="#FF4B4B" />
          <Text style={styles.label}>Heart</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000814',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 30,
  },
  testRow: {
    flexDirection: 'row',
    gap: 20,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
  },
  label: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 12,
  },
});

export default SimpleIconTest;
