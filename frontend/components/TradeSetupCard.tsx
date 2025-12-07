import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Target,
  BarChart3,
  DollarSign,
  Plus,
  Eye,
  MessageCircle,
  Maximize2,
  Shield,
  Trophy,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedGlow from './AnimatedGlow';
import TopPickBadge from './TopPickBadge';
import XPBadge from './XPBadge';

const { width } = Dimensions.get('window');

export interface TradeSetupData {
  id: string;
  rank?: number;
  symbol: string;
  name: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  lastUpdated: string;
  entry: {
    price: number;
    type: string;
    timing: string;
  };
  takeProfits: {
    level: number;
    price: number;
    percent: number;
    position: number;
    probability: number;
  }[];
  stopLoss: {
    price: number;
    percent: number;
    type: string;
    trailAmount: number;
    trailPercent: number;
  };
  riskAnalysis: {
    riskReward: number;
    maxLoss: number;
    maxGain: number;
    winProbability: number;
  };
  positionSizing: {
    recommendedPercent: number;
    dollarAmount: number;
    shares: number;
    maxRisk: number;
    riskPercent: number;
  };
  indicators: {
    rsi: { value: number; status: string; positive: boolean };
    macd: { status: string; positive: boolean };
    volume: { status: string; positive: boolean };
    trend: { status: string; positive: boolean };
    momentum: { value: string; positive: boolean };
    volatility: { status: string; warning: boolean };
  };
  reasoning: string[];
  modelVersion: string;
  backtestPerformance: string;
  riskLevel: string;
}

interface TradeSetupCardProps {
  setup: TradeSetupData;
  variant?: 'default' | 'compact' | 'mobile';
  onAddToPortfolio?: () => void;
  onAddToWatchlist?: () => void;
  onChat?: () => void;
  onViewAnalysis?: () => void;
  onExpandChart?: () => void;
  showRank?: boolean;
}

export default function TradeSetupCard({
  setup,
  variant = 'default',
  onAddToPortfolio,
  onAddToWatchlist,
  onChat,
  onViewAnalysis,
  onExpandChart,
  showRank = true,
}: TradeSetupCardProps) {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

  const isCompact = variant === 'compact';
  const isMobile = variant === 'mobile';

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return Colors.neonGreen;
      case 'SELL':
        return Colors.error;
      default:
        return Colors.gold;
    }
  };

  const getSignalEmoji = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return '🟢';
      case 'SELL':
        return '🔴';
      default:
        return '🟡';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return Colors.neonGreen;
      case 'medium':
        return Colors.gold;
      case 'high':
        return Colors.error;
      default:
        return Colors.textMuted;
    }
  };

  if (isCompact) {
    return (
      <View style={[styles.setupCard, styles.compactCard]}>
        <LinearGradient
          colors={[Colors.glow.cyan, 'transparent']}
          style={styles.setupGradient}
        >
          {/* Compact Header */}
          <View style={styles.compactHeader}>
            <View style={styles.compactHeaderLeft}>
              <Text style={styles.compactSymbol}>{setup.symbol}</Text>
              <Text style={styles.compactName}>{setup.name}</Text>
            </View>
            <View style={[
              styles.compactSignalBadge,
              { backgroundColor: getSignalColor(setup.signal) },
            ]}>
              <Text style={styles.compactSignalText}>{setup.signal} {setup.confidence}%</Text>
            </View>
          </View>

          {/* Compact Price */}
          <View style={styles.compactPriceSection}>
            <Text style={styles.compactPrice}>${setup.currentPrice.toFixed(2)}</Text>
            <Text style={[
              styles.compactPriceChange,
              { color: setup.priceChange >= 0 ? Colors.neonGreen : Colors.error },
            ]}>
              {setup.priceChange >= 0 ? '+' : ''}{setup.priceChangePercent}%
            </Text>
          </View>

          {/* Compact Actions */}
          <View style={styles.compactActions}>
            <TouchableOpacity style={styles.compactButton} onPress={onAddToPortfolio}>
              <Plus size={16} color={Colors.neonGreen} />
              <Text style={styles.compactButtonText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compactButton} onPress={onChat}>
              <MessageCircle size={16} color={Colors.neonCyan} />
              <Text style={styles.compactButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.setupCard, isMobile && styles.mobileCard]}>
      <LinearGradient
        colors={[Colors.glow.cyan, 'transparent']}
        style={styles.setupGradient}
      >
        {/* Header Bar */}
        <View style={styles.setupHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.setupSymbol}>{setup.symbol}</Text>
            <Text style={styles.setupName}>{setup.name}</Text>
          </View>
          <View style={styles.headerCenter}>
            <View style={[
              styles.signalBadge,
              { backgroundColor: getSignalColor(setup.signal) },
            ]}>
              <Text style={styles.signalText}>{setup.signal}</Text>
              <Text style={styles.confidenceText}>{setup.confidence}%</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerRight}>
            <MoreVertical size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* TOP PICK Badge */}
        {showRank && setup.rank === 1 && (
          <View style={styles.topPickContainer}>
            <TopPickBadge text="⭐ TOP PICK" />
          </View>
        )}
        {showRank && setup.rank === 2 && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>⭐⭐ RUNNER UP</Text>
          </View>
        )}
        {showRank && setup.rank === 3 && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>⭐⭐⭐ SOLID PICK</Text>
          </View>
        )}

        {/* Price Display */}
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Current Price</Text>
          <Text style={styles.priceValue}>${setup.currentPrice.toFixed(2)}</Text>
          <View style={styles.priceChangeRow}>
            <Text style={[
              styles.priceChange,
              { color: setup.priceChange >= 0 ? Colors.neonGreen : Colors.error },
            ]}>
              {setup.priceChange >= 0 ? '+' : ''}${setup.priceChange.toFixed(2)} ({setup.priceChange >= 0 ? '+' : ''}{setup.priceChangePercent}%)
            </Text>
            {setup.priceChange >= 0 ? (
              <TrendingUp size={20} color={Colors.neonGreen} />
            ) : (
              <TrendingDown size={20} color={Colors.error} />
            )}
          </View>
          <Text style={styles.lastUpdated}>Last Updated: {setup.lastUpdated}</Text>
        </View>

        {/* Chart Section */}
        <View style={styles.chartSection}>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartLabel}>30-Day Chart</Text>
            <View style={styles.chartArea} />
            <TouchableOpacity style={styles.chartControls} onPress={onExpandChart}>
              <Maximize2 size={16} color={Colors.neonCyan} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trade Details Section */}
        <ScrollView 
          style={styles.detailsSection}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {/* Entry Strategy Box */}
          <View style={styles.detailBox}>
            <View style={styles.boxHeader}>
              <Target size={18} color={Colors.neonCyan} />
              <Text style={styles.boxTitle}>Entry Strategy</Text>
            </View>
            <View style={styles.boxContent}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Entry Price:</Text>
                <Text style={styles.detailValue}>${setup.entry.price.toFixed(2)} 📍</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Entry Type:</Text>
                <Text style={styles.detailSubvalue}>{setup.entry.type}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Timing:</Text>
                <Text style={styles.detailSubvalue}>{setup.entry.timing}</Text>
              </View>
            </View>
          </View>

          {/* Take Profit Ladder Box */}
          <AnimatedGlow glowColor={Colors.neonGreen} glowIntensity={15}>
            <View style={styles.detailBox}>
              <View style={styles.boxHeader}>
                <Trophy size={18} color={Colors.neonGreen} />
                <Text style={styles.boxTitle}>Take Profit Targets 🎯</Text>
              </View>
              <View style={styles.boxContent}>
                {setup.takeProfits.map((tp) => (
                  <View key={tp.level} style={styles.tpRow}>
                    <Text style={styles.tpLabel}>TP{tp.level}:</Text>
                    <Text style={styles.tpPrice}>${tp.price.toFixed(2)} (+{tp.percent}%)</Text>
                    <Text style={styles.tpPosition}>[Close {tp.position}%]</Text>
                    <XPBadge xp={tp.level * 10} size="small" />
                  </View>
                ))}
                <Text style={styles.achievementText}>
                  🏆 Hit all 3 TPs for 'Perfect Trade' badge
                </Text>
              </View>
            </View>
          </AnimatedGlow>

          {/* Stop Loss Box */}
          <AnimatedGlow glowColor={Colors.error} glowIntensity={10}>
            <View style={styles.detailBox}>
              <View style={styles.boxHeader}>
                <Shield size={18} color={Colors.error} />
                <Text style={styles.boxTitle}>Stop Loss 🛑</Text>
              </View>
              <View style={styles.boxContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>SL Price:</Text>
                  <Text style={[styles.detailValue, { color: Colors.error }]}>
                    ${setup.stopLoss.price.toFixed(2)} ({setup.stopLoss.percent}%)
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailSubvalue}>{setup.stopLoss.type}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Trail Amount:</Text>
                  <Text style={styles.detailSubvalue}>
                    ${setup.stopLoss.trailAmount.toFixed(2)} ({setup.stopLoss.trailPercent}%)
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Risk Management:</Text>
                  <Text style={styles.detailSubvalue}>Level 4 → Level 5</Text>
                  <XPBadge xp={15} size="small" />
                </View>
              </View>
            </View>
          </AnimatedGlow>

          {/* Risk Analysis Box */}
          <View style={styles.detailBox}>
            <View style={styles.boxHeader}>
              <BarChart3 size={18} color={Colors.neonCyan} />
              <Text style={styles.boxTitle}>Risk Analysis 📊</Text>
            </View>
            <View style={styles.boxContent}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Risk/Reward:</Text>
                <Text style={styles.detailValue}>
                  1:{setup.riskAnalysis.riskReward.toFixed(1)}{' '}
                  <Text style={styles.excellentText}>Excellent {getSignalEmoji(setup.signal)}</Text>
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Max Loss:</Text>
                <Text style={styles.detailSubvalue}>
                  ${setup.riskAnalysis.maxLoss.toFixed(2)}/share ({setup.stopLoss.percent}%)
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Max Gain:</Text>
                <Text style={styles.detailSubvalue}>
                  ${setup.riskAnalysis.maxGain.toFixed(2)}/share (+{setup.takeProfits[2].percent}%)
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Win Probability:</Text>
                <Text style={styles.detailValue}>{setup.riskAnalysis.winProbability}%</Text>
              </View>
            </View>
          </View>

          {/* Position Sizing Box */}
          <AnimatedGlow glowColor={Colors.gold} glowIntensity={12}>
            <View style={styles.detailBox}>
              <View style={styles.boxHeader}>
                <DollarSign size={18} color={Colors.gold} />
                <Text style={styles.boxTitle}>Position Sizing 💰</Text>
              </View>
              <View style={styles.boxContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Recommended:</Text>
                  <Text style={styles.detailValue}>{setup.positionSizing.recommendedPercent}% of portfolio</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shares:</Text>
                  <Text style={styles.detailValue}>~{setup.positionSizing.shares} shares</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Capital Required:</Text>
                  <Text style={styles.detailSubvalue}>${setup.positionSizing.dollarAmount.toLocaleString()}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Based on:</Text>
                  <Text style={styles.detailSubvalue}>Kelly Criterion</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Position Sizing Master:</Text>
                  <Text style={styles.detailSubvalue}>Level 3 → Level 4</Text>
                  <XPBadge xp={20} size="small" />
                </View>
              </View>
            </View>
          </AnimatedGlow>
        </ScrollView>

        {/* Key Indicators Grid */}
        <View style={styles.indicatorsSection}>
          <Text style={styles.sectionTitle}>Key Indicators</Text>
          <View style={styles.indicatorsGrid}>
            <View style={styles.indicatorCard}>
              <Text style={styles.indicatorLabel}>RSI</Text>
              <Text style={styles.indicatorValue}>{setup.indicators.rsi.value}</Text>
              <Text style={[
                styles.indicatorStatus,
                { color: setup.indicators.rsi.positive ? Colors.neonGreen : Colors.textMuted },
              ]}>
                {setup.indicators.rsi.status}
              </Text>
            </View>
            <View style={styles.indicatorCard}>
              <Text style={styles.indicatorLabel}>MACD</Text>
              <Text style={[
                styles.indicatorStatus,
                { color: setup.indicators.macd.positive ? Colors.neonGreen : Colors.textMuted },
              ]}>
                {setup.indicators.macd.status} ↑
              </Text>
            </View>
            <View style={styles.indicatorCard}>
              <Text style={styles.indicatorLabel}>Volume</Text>
              <Text style={[
                styles.indicatorStatus,
                { color: setup.indicators.volume.positive ? Colors.neonGreen : Colors.textMuted },
              ]}>
                {setup.indicators.volume.status} {getSignalEmoji(setup.signal)}
              </Text>
            </View>
            <View style={styles.indicatorCard}>
              <Text style={styles.indicatorLabel}>Trend</Text>
              <Text style={[
                styles.indicatorStatus,
                { color: setup.indicators.trend.positive ? Colors.neonGreen : Colors.textMuted },
              ]}>
                {setup.indicators.trend.status} {getSignalEmoji(setup.signal)}
              </Text>
            </View>
            <View style={styles.indicatorCard}>
              <Text style={styles.indicatorLabel}>Momentum</Text>
              <Text style={[
                styles.indicatorStatus,
                { color: setup.indicators.momentum.positive ? Colors.neonGreen : Colors.textMuted },
              ]}>
                {setup.indicators.momentum.value}
              </Text>
            </View>
            <View style={styles.indicatorCard}>
              <Text style={styles.indicatorLabel}>Volatility</Text>
              <Text style={[
                styles.indicatorStatus,
                { color: setup.indicators.volatility.warning ? Colors.gold : Colors.textMuted },
              ]}>
                {setup.indicators.volatility.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Model Reasoning */}
        <View style={styles.reasoningSection}>
          <TouchableOpacity
            style={styles.reasoningHeader}
            onPress={() => setIsReasoningExpanded(!isReasoningExpanded)}
          >
            <Text style={styles.reasoningTitle}>Why This Setup?</Text>
            {isReasoningExpanded ? (
              <ChevronUp size={20} color={Colors.text} />
            ) : (
              <ChevronDown size={20} color={Colors.text} />
            )}
          </TouchableOpacity>
          
          {isReasoningExpanded && (
            <View style={styles.reasoningContent}>
              <Text style={styles.reasoningIntro}>Our RL model identified this opportunity because:</Text>
              {setup.reasoning.map((reason, index) => (
                <Text key={index} style={styles.reasoningItem}>• {reason}</Text>
              ))}
              <TouchableOpacity style={styles.chatbotButton} onPress={onChat}>
                <MessageCircle size={16} color={Colors.neonCyan} />
                <Text style={styles.chatbotButtonText}>Ask Chatbot for More Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={onAddToPortfolio}>
            <Plus size={20} color={Colors.text} />
            <Text style={styles.primaryButtonText}>Add to My Portfolio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onAddToWatchlist}>
            <Eye size={18} color={Colors.neonCyan} />
            <Text style={styles.secondaryButtonText}>Watchlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onChat}>
            <MessageCircle size={18} color={Colors.neonCyan} />
            <Text style={styles.secondaryButtonText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onViewAnalysis}>
            <BarChart3 size={18} color={Colors.neonCyan} />
            <Text style={styles.secondaryButtonText}>Analysis</Text>
          </TouchableOpacity>
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>Model: {setup.modelVersion}</Text>
          <Text style={styles.footerText}>Backtest: {setup.backtestPerformance} in similar setups</Text>
          <View style={[
            styles.riskLevelBadge,
            { backgroundColor: getRiskLevelColor(setup.riskLevel) },
          ]}>
            <Text style={styles.riskLevelText}>Risk: {setup.riskLevel} ⚠️</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  setupCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.neonCyan,
    shadowColor: Colors.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  compactCard: {
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
  mobileCard: {
    marginHorizontal: 12,
    borderRadius: 20,
  },
  setupGradient: {
    backgroundColor: Colors.surface,
    padding: 20,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  setupSymbol: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  setupName: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  headerCenter: {
    alignItems: 'center',
    marginHorizontal: 12,
  },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: Colors.neonGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  signalText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  confidenceText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  headerRight: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  priceSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priceLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  priceChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  priceChange: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  chartSection: {
    marginBottom: 20,
  },
  chartPlaceholder: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    height: 200,
  },
  chartLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  chartArea: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  chartControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsSection: {
    maxHeight: 400,
    marginBottom: 20,
  },
  detailBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  boxContent: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.neonCyan,
  },
  detailSubvalue: {
    fontSize: 13,
    color: Colors.text,
  },
  excellentText: {
    fontSize: 12,
    color: Colors.neonGreen,
    fontWeight: '700' as const,
  },
  tpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tpLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    width: 35,
  },
  tpPrice: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.neonGreen,
    flex: 1,
  },
  tpPosition: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  tpProbability: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  indicatorsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  indicatorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  indicatorCard: {
    flex: 1,
    minWidth: (width - 80) / 3,
    backgroundColor: Colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  indicatorLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  indicatorValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  indicatorStatus: {
    fontSize: 10,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  reasoningSection: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasoningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  reasoningTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  reasoningContent: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  reasoningIntro: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  reasoningItem: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  chatbotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatbotButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.neonCyan,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flex: 1,
    minWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.neonGreen,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: Colors.neonGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  secondaryButton: {
    flex: 1,
    minWidth: (width - 72) / 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.neonCyan,
  },
  cardFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  riskLevelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 4,
  },
  riskLevelText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  
  // Compact styles
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactHeaderLeft: {
    flex: 1,
  },
  compactSymbol: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  compactName: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  compactSignalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  compactSignalText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  compactPriceSection: {
    marginBottom: 12,
  },
  compactPrice: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  compactPriceChange: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  compactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  compactButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  topPickContainer: {
    marginBottom: 16,
  },
  achievementText: {
    fontSize: 12,
    color: Colors.neonGreen,
    fontWeight: '600' as const,
    marginTop: 8,
    textAlign: 'center',
  },
});
