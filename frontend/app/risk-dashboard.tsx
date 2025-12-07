import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import FloatingChatbot from '../components/FloatingChatbot';

const { width } = Dimensions.get('window');

interface RiskMetrics {
  portfolio_value: number;
  var_95: number;
  cvar_95: number;
  max_drawdown: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  volatility: number;
  beta: number;
  correlation_spy: number;
}

interface StressTest {
  scenario: string;
  portfolio_impact: number;
  description: string;
}

const RiskDashboard = () => {
  const navigation = useNavigation();
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [stressTests, setStressTests] = useState<StressTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'var' | 'stress' | 'correlation'>('overview');

  useEffect(() => {
    loadRiskData();
  }, []);

  const loadRiskData = async () => {
    try {
      setLoading(true);
      
      // Mock risk metrics data
      const mockRiskMetrics: RiskMetrics = {
        portfolio_value: 125000,
        var_95: -0.08,
        cvar_95: -0.12,
        max_drawdown: -0.15,
        sharpe_ratio: 1.2,
        sortino_ratio: 1.8,
        volatility: 0.18,
        beta: 1.1,
        correlation_spy: 0.75,
      };

      setRiskMetrics(mockRiskMetrics);

      // Mock stress test data
      const mockStressTests: StressTest[] = [
        {
          scenario: "Market Crash (-20%)",
          portfolio_impact: -0.18,
          description: "Simulated 2008-style market crash"
        },
        {
          scenario: "Interest Rate Shock (+2%)",
          portfolio_impact: -0.08,
          description: "Federal Reserve raises rates by 2%"
        },
        {
          scenario: "Tech Sector Crash (-30%)",
          portfolio_impact: -0.12,
          description: "Technology stocks decline 30%"
        },
        {
          scenario: "Inflation Spike (+5%)",
          portfolio_impact: -0.06,
          description: "Inflation rises to 8% annually"
        },
        {
          scenario: "Currency Crisis",
          portfolio_impact: -0.10,
          description: "Major currency devaluation"
        }
      ];

      setStressTests(mockStressTests);
    } catch (error) {
      console.error('Error loading risk data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getRiskColor = (value: number, isNegative = false) => {
    if (isNegative) {
      return value < -0.1 ? '#F44336' : value < -0.05 ? '#FF9800' : '#4CAF50';
    }
    return value > 0.8 ? '#4CAF50' : value > 0.5 ? '#FF9800' : '#F44336';
  };

  const getRiskLevel = (value: number) => {
    if (value < 0.05) return 'Low';
    if (value < 0.15) return 'Medium';
    return 'High';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Risk Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E1B4B', '#312E81']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Risk Dashboard</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {/* Implement risk settings */}}
          >
            <Ionicons name="settings" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Risk Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio Risk Overview</Text>
          
          {riskMetrics && (
            <View style={styles.riskOverview}>
              <View style={styles.riskCard}>
                <Text style={styles.riskLabel}>Portfolio Value</Text>
                <Text style={styles.riskValue}>
                  {formatCurrency(riskMetrics.portfolio_value)}
                </Text>
              </View>
              
              <View style={styles.riskCard}>
                <Text style={styles.riskLabel}>Risk Level</Text>
                <Text style={[
                  styles.riskValue,
                  { color: getRiskColor(riskMetrics.volatility) }
                ]}>
                  {getRiskLevel(riskMetrics.volatility)}
                </Text>
              </View>
              
              <View style={styles.riskCard}>
                <Text style={styles.riskLabel}>Volatility</Text>
                <Text style={[
                  styles.riskValue,
                  { color: getRiskColor(riskMetrics.volatility) }
                ]}>
                  {formatPercentage(riskMetrics.volatility)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'var' && styles.activeTab]}
            onPress={() => setActiveTab('var')}
          >
            <Text style={[styles.tabText, activeTab === 'var' && styles.activeTabText]}>
              VaR/CVaR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'stress' && styles.activeTab]}
            onPress={() => setActiveTab('stress')}
          >
            <Text style={[styles.tabText, activeTab === 'stress' && styles.activeTabText]}>
              Stress Tests
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'correlation' && styles.activeTab]}
            onPress={() => setActiveTab('correlation')}
          >
            <Text style={[styles.tabText, activeTab === 'correlation' && styles.activeTabText]}>
              Correlation
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && riskMetrics && (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Risk Metrics Overview</Text>
            
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Sharpe Ratio</Text>
                <Text style={[
                  styles.metricValue,
                  { color: getRiskColor(riskMetrics.sharpe_ratio) }
                ]}>
                  {riskMetrics.sharpe_ratio.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Sortino Ratio</Text>
                <Text style={[
                  styles.metricValue,
                  { color: getRiskColor(riskMetrics.sortino_ratio) }
                ]}>
                  {riskMetrics.sortino_ratio.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Max Drawdown</Text>
                <Text style={[
                  styles.metricValue,
                  { color: getRiskColor(Math.abs(riskMetrics.max_drawdown), true) }
                ]}>
                  {formatPercentage(riskMetrics.max_drawdown)}
                </Text>
              </View>
              
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Beta</Text>
                <Text style={[
                  styles.metricValue,
                  { color: getRiskColor(riskMetrics.beta) }
                ]}>
                  {riskMetrics.beta.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.riskSummary}>
              <Text style={styles.riskSummaryTitle}>Risk Assessment</Text>
              <Text style={styles.riskSummaryText}>
                Your portfolio shows {getRiskLevel(riskMetrics.volatility).toLowerCase()} risk 
                with a volatility of {formatPercentage(riskMetrics.volatility)}. 
                The Sharpe ratio of {riskMetrics.sharpe_ratio.toFixed(2)} indicates 
                {riskMetrics.sharpe_ratio > 1 ? ' strong' : ' moderate'} risk-adjusted returns.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'var' && riskMetrics && (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Value at Risk (VaR) Analysis</Text>
            
            <View style={styles.varContainer}>
              <View style={styles.varCard}>
                <Text style={styles.varLabel}>95% VaR (1-day)</Text>
                <Text style={[
                  styles.varValue,
                  { color: getRiskColor(Math.abs(riskMetrics.var_95), true) }
                ]}>
                  {formatPercentage(riskMetrics.var_95)}
                </Text>
                <Text style={styles.varDescription}>
                  Maximum expected loss in 95% of cases
                </Text>
              </View>
              
              <View style={styles.varCard}>
                <Text style={styles.varLabel}>95% CVaR (1-day)</Text>
                <Text style={[
                  styles.varValue,
                  { color: getRiskColor(Math.abs(riskMetrics.cvar_95), true) }
                ]}>
                  {formatPercentage(riskMetrics.cvar_95)}
                </Text>
                <Text style={styles.varDescription}>
                  Expected loss in worst 5% of cases
                </Text>
              </View>
            </View>

            <View style={styles.varExplanation}>
              <Text style={styles.varExplanationTitle}>Understanding VaR</Text>
              <Text style={styles.varExplanationText}>
                Value at Risk (VaR) measures the maximum potential loss over a specific time period 
                with a given confidence level. Your 95% VaR of {formatPercentage(riskMetrics.var_95)} 
                means there's a 5% chance of losing more than this amount in a single day.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'stress' && (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Stress Test Scenarios</Text>
            
            {stressTests.map((test, index) => (
              <View key={index} style={styles.stressTestCard}>
                <View style={styles.stressTestHeader}>
                  <Text style={styles.stressTestScenario}>{test.scenario}</Text>
                  <Text style={[
                    styles.stressTestImpact,
                    { color: getRiskColor(Math.abs(test.portfolio_impact), true) }
                  ]}>
                    {formatPercentage(test.portfolio_impact)}
                  </Text>
                </View>
                <Text style={styles.stressTestDescription}>{test.description}</Text>
              </View>
            ))}

            <View style={styles.stressTestInfo}>
              <Text style={styles.stressTestInfoTitle}>About Stress Testing</Text>
              <Text style={styles.stressTestInfoText}>
                Stress tests simulate extreme market conditions to evaluate how your portfolio 
                would perform during market crises. These scenarios help identify potential 
                vulnerabilities and inform risk management strategies.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'correlation' && riskMetrics && (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Correlation Analysis</Text>
            
            <View style={styles.correlationContainer}>
              <View style={styles.correlationCard}>
                <Text style={styles.correlationLabel}>S&P 500 Correlation</Text>
                <Text style={[
                  styles.correlationValue,
                  { color: getRiskColor(riskMetrics.correlation_spy) }
                ]}>
                  {riskMetrics.correlation_spy.toFixed(2)}
                </Text>
                <Text style={styles.correlationDescription}>
                  {riskMetrics.correlation_spy > 0.7 ? 'High correlation with market' : 
                   riskMetrics.correlation_spy > 0.3 ? 'Moderate correlation with market' : 
                   'Low correlation with market'}
                </Text>
              </View>
              
              <View style={styles.correlationCard}>
                <Text style={styles.correlationLabel}>Beta</Text>
                <Text style={[
                  styles.correlationValue,
                  { color: getRiskColor(riskMetrics.beta) }
                ]}>
                  {riskMetrics.beta.toFixed(2)}
                </Text>
                <Text style={styles.correlationDescription}>
                  {riskMetrics.beta > 1 ? 'More volatile than market' : 
                   riskMetrics.beta < 1 ? 'Less volatile than market' : 
                   'Same volatility as market'}
                </Text>
              </View>
            </View>

            <View style={styles.correlationExplanation}>
              <Text style={styles.correlationExplanationTitle}>Correlation Insights</Text>
              <Text style={styles.correlationExplanationText}>
                Your portfolio's correlation with the S&P 500 is {riskMetrics.correlation_spy.toFixed(2)}, 
                indicating {riskMetrics.correlation_spy > 0.7 ? 'strong' : 
                riskMetrics.correlation_spy > 0.3 ? 'moderate' : 'weak'} correlation with the broader market. 
                A beta of {riskMetrics.beta.toFixed(2)} means your portfolio is 
                {riskMetrics.beta > 1 ? ' more' : ' less'} sensitive to market movements.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <FloatingChatbot
        context={{
          current_page: 'risk_dashboard',
          risk_metrics: riskMetrics,
          active_tab: activeTab,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
  },
  loadingText: {
    color: '#A1A1AA',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  riskOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  riskCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  riskLabel: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 8,
  },
  riskValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#6366F1',
  },
  tabText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: 'white',
  },
  tabContent: {
    marginBottom: 20,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  riskSummary: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
  },
  riskSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  riskSummaryText: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
  varContainer: {
    gap: 16,
    marginBottom: 20,
  },
  varCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  varLabel: {
    fontSize: 16,
    color: '#A1A1AA',
    marginBottom: 8,
  },
  varValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  varDescription: {
    fontSize: 12,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  varExplanation: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
  },
  varExplanationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  varExplanationText: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
  stressTestCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stressTestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stressTestScenario: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  stressTestImpact: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stressTestDescription: {
    fontSize: 14,
    color: '#A1A1AA',
  },
  stressTestInfo: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  stressTestInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  stressTestInfoText: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
  correlationContainer: {
    gap: 16,
    marginBottom: 20,
  },
  correlationCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  correlationLabel: {
    fontSize: 16,
    color: '#A1A1AA',
    marginBottom: 8,
  },
  correlationValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  correlationDescription: {
    fontSize: 12,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  correlationExplanation: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
  },
  correlationExplanationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  correlationExplanationText: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
});

export default RiskDashboard;
