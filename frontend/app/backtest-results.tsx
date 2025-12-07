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

interface BacktestResult {
  id: string;
  strategy_name: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_value: number;
  total_return: number;
  annualized_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number;
  avg_loss: number;
  status: 'completed' | 'running' | 'failed';
}

interface PerformanceData {
  date: string;
  portfolio_value: number;
  returns: number;
  drawdown: number;
}

const BacktestResults = () => {
  const navigation = useNavigation();
  const [backtests, setBacktests] = useState<BacktestResult[]>([]);
  const [selectedBacktest, setSelectedBacktest] = useState<BacktestResult | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trades'>('overview');

  useEffect(() => {
    loadBacktestData();
  }, []);

  const loadBacktestData = async () => {
    try {
      setLoading(true);
      
      // Mock backtest data
      const mockBacktests: BacktestResult[] = [
        {
          id: '1',
          strategy_name: 'Conservative Growth',
          start_date: '2023-01-01',
          end_date: '2023-12-31',
          initial_capital: 10000,
          final_value: 11250,
          total_return: 0.125,
          annualized_return: 0.125,
          sharpe_ratio: 1.2,
          max_drawdown: 0.08,
          win_rate: 0.65,
          profit_factor: 1.8,
          total_trades: 45,
          winning_trades: 29,
          losing_trades: 16,
          avg_win: 0.025,
          avg_loss: -0.015,
          status: 'completed',
        },
        {
          id: '2',
          strategy_name: 'Aggressive Growth',
          start_date: '2023-01-01',
          end_date: '2023-12-31',
          initial_capital: 10000,
          final_value: 13800,
          total_return: 0.38,
          annualized_return: 0.38,
          sharpe_ratio: 0.9,
          max_drawdown: 0.22,
          win_rate: 0.55,
          profit_factor: 1.4,
          total_trades: 78,
          winning_trades: 43,
          losing_trades: 35,
          avg_win: 0.045,
          avg_loss: -0.028,
          status: 'completed',
        },
        {
          id: '3',
          strategy_name: 'Balanced Portfolio',
          start_date: '2023-01-01',
          end_date: '2023-12-31',
          initial_capital: 10000,
          final_value: 12100,
          total_return: 0.21,
          annualized_return: 0.21,
          sharpe_ratio: 1.1,
          max_drawdown: 0.12,
          win_rate: 0.60,
          profit_factor: 1.6,
          total_trades: 52,
          winning_trades: 31,
          losing_trades: 21,
          avg_win: 0.035,
          avg_loss: -0.020,
          status: 'completed',
        },
      ];

      setBacktests(mockBacktests);
      setSelectedBacktest(mockBacktests[0]);

      // Mock performance data
      const mockPerformanceData: PerformanceData[] = [
        { date: '2023-01-01', portfolio_value: 10000, returns: 0, drawdown: 0 },
        { date: '2023-02-01', portfolio_value: 10250, returns: 0.025, drawdown: 0 },
        { date: '2023-03-01', portfolio_value: 9800, returns: -0.02, drawdown: 0.02 },
        { date: '2023-04-01', portfolio_value: 10500, returns: 0.071, drawdown: 0.02 },
        { date: '2023-05-01', portfolio_value: 10800, returns: 0.029, drawdown: 0.02 },
        { date: '2023-06-01', portfolio_value: 11200, returns: 0.037, drawdown: 0.02 },
        { date: '2023-07-01', portfolio_value: 10900, returns: -0.027, drawdown: 0.027 },
        { date: '2023-08-01', portfolio_value: 11500, returns: 0.055, drawdown: 0.027 },
        { date: '2023-09-01', portfolio_value: 11800, returns: 0.026, drawdown: 0.027 },
        { date: '2023-10-01', portfolio_value: 12000, returns: 0.017, drawdown: 0.027 },
        { date: '2023-11-01', portfolio_value: 12200, returns: 0.017, drawdown: 0.027 },
        { date: '2023-12-01', portfolio_value: 11250, returns: -0.078, drawdown: 0.078 },
      ];

      setPerformanceData(mockPerformanceData);
    } catch (error) {
      console.error('Error loading backtest data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'running': return '#FF9800';
      case 'failed': return '#F44336';
      default: return '#757575';
    }
  };

  const getReturnColor = (value: number) => {
    return value >= 0 ? '#4CAF50' : '#F44336';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Backtest Results...</Text>
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
          <Text style={styles.headerTitle}>Backtest Results</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {/* Implement filter */}}
          >
            <Ionicons name="filter" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Backtest Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Backtest</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {backtests.map((backtest) => (
              <TouchableOpacity
                key={backtest.id}
                style={[
                  styles.backtestCard,
                  selectedBacktest?.id === backtest.id && styles.selectedBacktestCard
                ]}
                onPress={() => setSelectedBacktest(backtest)}
              >
                <Text style={styles.backtestName}>{backtest.strategy_name}</Text>
                <Text style={styles.backtestPeriod}>
                  {backtest.start_date} - {backtest.end_date}
                </Text>
                <View style={styles.backtestMetrics}>
                  <Text style={[
                    styles.backtestReturn,
                    { color: getReturnColor(backtest.total_return) }
                  ]}>
                    {formatPercentage(backtest.total_return)}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(backtest.status) }
                  ]}>
                    <Text style={styles.statusText}>{backtest.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {selectedBacktest && (
          <>
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
                style={[styles.tab, activeTab === 'performance' && styles.activeTab]}
                onPress={() => setActiveTab('performance')}
              >
                <Text style={[styles.tabText, activeTab === 'performance' && styles.activeTabText]}>
                  Performance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'trades' && styles.activeTab]}
                onPress={() => setActiveTab('trades')}
              >
                <Text style={[styles.tabText, activeTab === 'trades' && styles.activeTabText]}>
                  Trades
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <View style={styles.tabContent}>
                <Text style={styles.tabTitle}>Performance Overview</Text>
                
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Total Return</Text>
                    <Text style={[
                      styles.metricValue,
                      { color: getReturnColor(selectedBacktest.total_return) }
                    ]}>
                      {formatPercentage(selectedBacktest.total_return)}
                    </Text>
                  </View>
                  
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Sharpe Ratio</Text>
                    <Text style={styles.metricValue}>
                      {selectedBacktest.sharpe_ratio.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Max Drawdown</Text>
                    <Text style={[styles.metricValue, { color: '#F44336' }]}>
                      {formatPercentage(selectedBacktest.max_drawdown)}
                    </Text>
                  </View>
                  
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Win Rate</Text>
                    <Text style={styles.metricValue}>
                      {formatPercentage(selectedBacktest.win_rate)}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Strategy Summary</Text>
                  <Text style={styles.summaryText}>
                    The {selectedBacktest.strategy_name} strategy generated a total return of{' '}
                    {formatPercentage(selectedBacktest.total_return)} over the backtest period.
                    With a Sharpe ratio of {selectedBacktest.sharpe_ratio.toFixed(2)} and a maximum
                    drawdown of {formatPercentage(selectedBacktest.max_drawdown)}, this strategy
                    shows {selectedBacktest.sharpe_ratio > 1 ? 'strong' : 'moderate'} risk-adjusted performance.
                  </Text>
                </View>
              </View>
            )}

            {activeTab === 'performance' && (
              <View style={styles.tabContent}>
                <Text style={styles.tabTitle}>Performance Charts</Text>
                
                {/* Portfolio Value Chart */}
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Portfolio Value Over Time</Text>
                  <LineChart
                    data={{
                      labels: performanceData.map(d => d.date.split('-')[1]),
                      datasets: [{
                        data: performanceData.map(d => d.portfolio_value),
                        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                        strokeWidth: 2
                      }]
                    }}
                    width={width - 40}
                    height={220}
                    chartConfig={{
                      backgroundColor: '#1A1A2E',
                      backgroundGradientFrom: '#1A1A2E',
                      backgroundGradientTo: '#1A1A2E',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      style: {
                        borderRadius: 16
                      },
                      propsForDots: {
                        r: '6',
                        strokeWidth: '2',
                        stroke: '#6366F1'
                      }
                    }}
                    bezier
                    style={styles.chart}
                  />
                </View>

                {/* Returns Chart */}
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Monthly Returns</Text>
                  <BarChart
                    data={{
                      labels: performanceData.map(d => d.date.split('-')[1]),
                      datasets: [{
                        data: performanceData.map(d => d.returns * 100)
                      }]
                    }}
                    width={width - 40}
                    height={220}
                    chartConfig={{
                      backgroundColor: '#1A1A2E',
                      backgroundGradientFrom: '#1A1A2E',
                      backgroundGradientTo: '#1A1A2E',
                      decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      style: {
                        borderRadius: 16
                      }
                    }}
                    style={styles.chart}
                  />
                </View>
              </View>
            )}

            {activeTab === 'trades' && (
              <View style={styles.tabContent}>
                <Text style={styles.tabTitle}>Trade Analysis</Text>
                
                <View style={styles.tradeStats}>
                  <View style={styles.tradeStat}>
                    <Text style={styles.tradeStatLabel}>Total Trades</Text>
                    <Text style={styles.tradeStatValue}>{selectedBacktest.total_trades}</Text>
                  </View>
                  <View style={styles.tradeStat}>
                    <Text style={styles.tradeStatLabel}>Winning Trades</Text>
                    <Text style={[styles.tradeStatValue, { color: '#4CAF50' }]}>
                      {selectedBacktest.winning_trades}
                    </Text>
                  </View>
                  <View style={styles.tradeStat}>
                    <Text style={styles.tradeStatLabel}>Losing Trades</Text>
                    <Text style={[styles.tradeStatValue, { color: '#F44336' }]}>
                      {selectedBacktest.losing_trades}
                    </Text>
                  </View>
                </View>

                <View style={styles.tradeMetrics}>
                  <View style={styles.tradeMetric}>
                    <Text style={styles.tradeMetricLabel}>Average Win</Text>
                    <Text style={[styles.tradeMetricValue, { color: '#4CAF50' }]}>
                      {formatPercentage(selectedBacktest.avg_win)}
                    </Text>
                  </View>
                  <View style={styles.tradeMetric}>
                    <Text style={styles.tradeMetricLabel}>Average Loss</Text>
                    <Text style={[styles.tradeMetricValue, { color: '#F44336' }]}>
                      {formatPercentage(selectedBacktest.avg_loss)}
                    </Text>
                  </View>
                  <View style={styles.tradeMetric}>
                    <Text style={styles.tradeMetricLabel}>Profit Factor</Text>
                    <Text style={styles.tradeMetricValue}>
                      {selectedBacktest.profit_factor.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <FloatingChatbot
        context={{
          current_page: 'backtest_results',
          selected_backtest: selectedBacktest?.strategy_name,
          performance_metrics: selectedBacktest ? {
            total_return: selectedBacktest.total_return,
            sharpe_ratio: selectedBacktest.sharpe_ratio,
            max_drawdown: selectedBacktest.max_drawdown,
          } : null,
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
  filterButton: {
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
    marginBottom: 12,
  },
  backtestCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 200,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedBacktestCard: {
    borderColor: '#6366F1',
  },
  backtestName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  backtestPeriod: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 8,
  },
  backtestMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backtestReturn: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
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
    fontSize: 14,
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
  summaryCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
  chartContainer: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
  },
  tradeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tradeStat: {
    alignItems: 'center',
  },
  tradeStatLabel: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 8,
  },
  tradeStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  tradeMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tradeMetric: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
  },
  tradeMetricLabel: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 8,
  },
  tradeMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default BacktestResults;
