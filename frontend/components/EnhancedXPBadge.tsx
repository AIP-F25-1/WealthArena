import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { 
  StarFilled, 
  CoinStack, 
  LightningBolt, 
  Crown,
  WealthBull,
  MarketBear,
  StreakFlame
} from './icons/WealthArenaIcons';

interface EnhancedXPBadgeProps {
  xp: number;
  level: number;
  streak?: number;
  coins?: number;
  showMascot?: boolean;
  variant?: 'default' | 'premium' | 'achievement';
  onPress?: () => void;
}

export const EnhancedXPBadge: React.FC<EnhancedXPBadgeProps> = ({
  xp,
  level,
  streak = 0,
  coins = 0,
  showMascot = false,
  variant = 'default',
  onPress,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'premium':
        return {
          container: styles.premiumContainer,
          text: styles.premiumText,
          iconColor: '#FFD700',
        };
      case 'achievement':
        return {
          container: styles.achievementContainer,
          text: styles.achievementText,
          iconColor: '#FF9600',
        };
      default:
        return {
          container: styles.defaultContainer,
          text: styles.defaultText,
          iconColor: '#7FD957',
        };
    }
  };

  const variantStyles = getVariantStyles();

  const getMascotIcon = () => {
    if (xp >= 1000) {
      return <WealthBull size={24} color="#00CD66" />;
    } else if (xp >= 500) {
      return <MarketBear size={24} color="#8B4513" />;
    }
    return null;
  };

  const renderXPDisplay = () => (
    <View style={styles.xpContainer}>
      <LightningBolt size={16} color={variantStyles.iconColor} />
      <Text style={[styles.xpText, variantStyles.text]}>{xp}</Text>
    </View>
  );

  const renderLevelDisplay = () => (
    <View style={styles.levelContainer}>
      <StarFilled size={16} color={variantStyles.iconColor} />
      <Text style={[styles.levelText, variantStyles.text]}>Lv.{level}</Text>
    </View>
  );

  const renderStreakDisplay = () => {
    if (streak <= 0) return null;
    return (
      <View style={styles.streakContainer}>
        <StreakFlame size={14} color="#FF9600" />
        <Text style={styles.streakText}>{streak}</Text>
      </View>
    );
  };

  const renderCoinsDisplay = () => {
    if (coins <= 0) return null;
    return (
      <View style={styles.coinsContainer}>
        <CoinStack size={14} color="#FFD700" />
        <Text style={styles.coinsText}>{coins}</Text>
      </View>
    );
  };

  const BadgeContent = (
    <View style={[styles.container, variantStyles.container]}>
      {/* Main XP and Level Display */}
      <View style={styles.mainDisplay}>
        {renderXPDisplay()}
        {renderLevelDisplay()}
      </View>

      {/* Additional Stats */}
      <View style={styles.additionalStats}>
        {renderStreakDisplay()}
        {renderCoinsDisplay()}
      </View>

      {/* Mascot Display */}
      {showMascot && getMascotIcon() && (
        <View style={styles.mascotContainer}>
          {getMascotIcon()}
        </View>
      )}

      {/* Premium Indicator */}
      {variant === 'premium' && (
        <View style={styles.premiumIndicator}>
          <Crown size={12} color="#FFD700" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {BadgeContent}
      </TouchableOpacity>
    );
  }

  return BadgeContent;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 3,
    minHeight: 40,
    gap: 8,
  },
  defaultContainer: {
    backgroundColor: 'rgba(127, 217, 87, 0.1)',
    borderColor: '#7FD957',
  },
  premiumContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: '#FFD700',
  },
  achievementContainer: {
    backgroundColor: 'rgba(255, 150, 0, 0.1)',
    borderColor: '#FF9600',
  },
  mainDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '700',
  },
  levelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  defaultText: {
    color: '#7FD957',
  },
  premiumText: {
    color: '#FFD700',
  },
  achievementText: {
    color: '#FF9600',
  },
  additionalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  coinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9600',
  },
  coinsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFD700',
  },
  mascotContainer: {
    marginLeft: 4,
  },
  premiumIndicator: {
    marginLeft: 4,
  },
});

export default EnhancedXPBadge;
