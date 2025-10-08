import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { WealthArenaIcons } from './icons/WealthArenaIcons';

const IconShowcase: React.FC = () => {
  const iconCategories = [
    {
      title: 'Mascot Characters',
      icons: [
        { name: 'Wealth Bull', component: WealthArenaIcons.WealthBull, color: '#00CD66' },
        { name: 'Market Bear', component: WealthArenaIcons.MarketBear, color: '#8B4513' },
      ]
    },
    {
      title: 'Financial Game Icons',
      icons: [
        { name: 'Coin Stack', component: WealthArenaIcons.CoinStack, color: '#FFD700' },
        { name: 'Money Bag', component: WealthArenaIcons.MoneyBag, color: '#00CD66' },
        { name: 'Upward Chart', component: WealthArenaIcons.UpwardChart, color: '#7FD957' },
        { name: 'Downward Chart', component: WealthArenaIcons.DownwardChart, color: '#FF4B4B' },
        { name: 'Pie Chart', component: WealthArenaIcons.PieChart, color: '#1CB0F6' },
        { name: 'Bar Chart', component: WealthArenaIcons.BarChart, color: '#FF9600' },
        { name: 'Target Arrow', component: WealthArenaIcons.TargetArrow, color: '#FF4B4B' },
      ]
    },
    {
      title: 'Achievement & Progress',
      icons: [
        { name: 'Streak Flame', component: WealthArenaIcons.StreakFlame, color: '#FF9600' },
        { name: 'Star Filled', component: WealthArenaIcons.StarFilled, color: '#FFD700' },
        { name: 'Star Outlined', component: WealthArenaIcons.StarOutlined, color: '#FFD700' },
        { name: 'Three Stars', component: WealthArenaIcons.ThreeStars, color: '#FFD700' },
        { name: 'Crown', component: WealthArenaIcons.Crown, color: '#FFD700' },
        { name: 'Lightning Bolt', component: WealthArenaIcons.LightningBolt, color: '#FFD700' },
        { name: 'Shield', component: WealthArenaIcons.Shield, color: '#1CB0F6' },
        { name: 'Checkmark Circle', component: WealthArenaIcons.CheckmarkCircle, color: '#7FD957' },
        { name: 'X Circle', component: WealthArenaIcons.XCircle, color: '#FF4B4B' },
      ]
    },
    {
      title: 'Emotion & Reaction',
      icons: [
        { name: 'Thumbs Up', component: WealthArenaIcons.ThumbsUp, color: '#7FD957' },
        { name: 'Party Popper', component: WealthArenaIcons.PartyPopper, color: '#FF9600' },
        { name: 'Fire', component: WealthArenaIcons.Fire, color: '#FF9600' },
      ]
    },
    {
      title: 'Utility Icons',
      icons: [
        { name: 'Question Mark', component: WealthArenaIcons.QuestionMark, color: '#1CB0F6' },
        { name: 'Exclamation Mark', component: WealthArenaIcons.ExclamationMark, color: '#FF9600' },
        { name: 'Heart', component: WealthArenaIcons.Heart, color: '#FF4B4B' },
        { name: 'Bell', component: WealthArenaIcons.Bell, color: '#FFD700' },
      ]
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>WealthArena Custom Icons</Text>
      <Text style={styles.subtitle}>Duolingo-Style Ultra-Flat Design</Text>
      
      {iconCategories.map((category, categoryIndex) => (
        <View key={categoryIndex} style={styles.category}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <View style={styles.iconGrid}>
            {category.icons.map((icon, iconIndex) => {
              const IconComponent = icon.component;
              return (
                <View key={iconIndex} style={styles.iconItem}>
                  <View style={styles.iconContainer}>
                    <IconComponent size={48} color={icon.color} />
                  </View>
                  <Text style={styles.iconName}>{icon.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          All icons follow Duolingo's ultra-flat design principles:
        </Text>
        <Text style={styles.footerBullet}>• Thick black outlines (4-5px)</Text>
        <Text style={styles.footerBullet}>• Bright, saturated colors</Text>
        <Text style={styles.footerBullet}>• Simple geometric shapes</Text>
        <Text style={styles.footerBullet}>• No gradients or shadows</Text>
        <Text style={styles.footerBullet}>• Cartoonish and friendly</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000814',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#00F0FF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: '#00F0FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 30,
  },
  category: {
    marginBottom: 30,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#374151',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  iconItem: {
    alignItems: 'center',
    width: '30%',
    marginBottom: 15,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  iconName: {
    fontSize: 12,
    color: '#E0E0E0',
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  footerBullet: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 4,
    marginLeft: 10,
  },
});

export default IconShowcase;
