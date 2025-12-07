import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WealthArenaIcons } from './icons/WealthArenaIcons';

const IconTest = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Icon Test</Text>
      
      {/* Test individual icons */}
      <View style={styles.testRow}>
        <View style={styles.iconContainer}>
          <WealthArenaIcons.CoinStack size={32} color="#FFD700" />
          <Text style={styles.label}>Coin</Text>
        </View>
        
        <View style={styles.iconContainer}>
          <WealthArenaIcons.StarFilled size={32} color="#FFD700" />
          <Text style={styles.label}>Star</Text>
        </View>
        
        <View style={styles.iconContainer}>
          <WealthArenaIcons.Heart size={32} color="#FF4B4B" />
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

export default IconTest;
