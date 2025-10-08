import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

const { width } = Dimensions.get('window');

export default function GlowPanels() {
  return (
    <View style={styles.container}>
      {/* Checkered Background Pattern */}
      <View style={styles.checkeredBackground} />
      
      {/* Top Row - Square Panels */}
      <View style={styles.topRow}>
        {/* Blue Square Panel */}
        <View style={styles.squarePanelContainer}>
          <View style={[styles.squarePanel, styles.blueGlow]}>
            <View style={styles.squarePanelCenter} />
          </View>
        </View>
        
        {/* Purple Square Panel */}
        <View style={styles.squarePanelContainer}>
          <View style={[styles.squarePanel, styles.purpleGlow]}>
            <View style={styles.squarePanelCenter} />
          </View>
        </View>
        
        {/* Green Square Panel */}
        <View style={styles.squarePanelContainer}>
          <View style={[styles.squarePanel, styles.greenGlow]}>
            <View style={styles.squarePanelCenter} />
          </View>
        </View>
      </View>

      {/* Middle Row - Oblong Buttons */}
      <View style={styles.middleRow}>
        {/* Green Oblong Button */}
        <View style={[styles.oblongButton, styles.greenOblongGlow]} />
        
        {/* Purple Oblong Button */}
        <View style={[styles.oblongButton, styles.purpleOblongGlow]} />
        
        {/* Blue Oblong Button */}
        <View style={[styles.oblongButton, styles.blueOblongGlow]} />
      </View>

      {/* Bottom Row */}
      <View style={styles.bottomRow}>
        {/* Large Square Panel with Gradient Border */}
        <View style={styles.largeSquarePanelContainer}>
          <LinearGradient
            colors={[Colors.neonCyan, Colors.accent, Colors.neonPink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.largeSquarePanel}
          >
            <View style={styles.largeSquarePanelCenter} />
          </LinearGradient>
        </View>
        
        {/* Pink Rectangle Panel */}
        <View style={styles.pinkRectanglePanel} />
      </View>

      {/* Gradient Oblong Button (Bottom Right) */}
      <View style={styles.gradientButtonContainer}>
        <LinearGradient
          colors={[Colors.neonCyan, Colors.accent, Colors.neonPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientOblongButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  checkeredBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    opacity: 0.1,
    // Add checkered pattern effect
  },
  
  // Top Row - Square Panels
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 40,
  },
  squarePanelContainer: {
    flex: 1,
    marginHorizontal: 5,
  },
  squarePanel: {
    aspectRatio: 1,
    borderRadius: 12,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  squarePanelCenter: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  
  // Neon Glow Effects
  blueGlow: {
    backgroundColor: Colors.neonCyan,
    shadowColor: Colors.neonCyan,
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  purpleGlow: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  greenGlow: {
    backgroundColor: Colors.neonGreen,
    shadowColor: Colors.neonGreen,
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  
  // Middle Row - Oblong Buttons
  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  oblongButton: {
    height: 50,
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 25,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  greenOblongGlow: {
    backgroundColor: Colors.neonGreen,
    shadowColor: Colors.neonGreen,
  },
  purpleOblongGlow: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
  },
  blueOblongGlow: {
    backgroundColor: Colors.neonCyan,
    shadowColor: Colors.neonCyan,
  },
  
  // Bottom Row
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  largeSquarePanelContainer: {
    flex: 2,
    marginRight: 10,
  },
  largeSquarePanel: {
    aspectRatio: 1.2,
    borderRadius: 16,
    padding: 3,
    shadowColor: Colors.neonCyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 12,
  },
  largeSquarePanelCenter: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 13,
  },
  pinkRectanglePanel: {
    flex: 1,
    backgroundColor: Colors.neonPink,
    borderRadius: 16,
    shadowColor: Colors.neonPink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  
  // Gradient Oblong Button
  gradientButtonContainer: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 120,
    height: 40,
  },
  gradientOblongButton: {
    flex: 1,
    borderRadius: 20,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 15,
    elevation: 10,
  },
});
