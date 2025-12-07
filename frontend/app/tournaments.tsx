import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import FloatingChatbot from '../components/FloatingChatbot';

interface Tournament {
  id: string;
  name: string;
  description: string;
  status: 'upcoming' | 'active' | 'completed';
  start_date: string;
  end_date: string;
  participants: number;
  max_participants: number;
  prize_pool: number;
  entry_fee: number;
  rules: string[];
  leaderboard: Array<{
    rank: number;
    username: string;
    portfolio_value: number;
    return_percentage: number;
  }>;
}

const Tournaments = () => {
  const navigation = useNavigation();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'active' | 'completed'>('active');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      
      // Mock tournaments data
      const mockTournaments: Tournament[] = [
        {
          id: '1',
          name: 'Weekly Trading Challenge',
          description: 'Compete against other traders in a week-long trading challenge. Highest returns win!',
          status: 'active',
          start_date: '2024-01-15',
          end_date: '2024-01-22',
          participants: 1247,
          max_participants: 2000,
          prize_pool: 5000,
          entry_fee: 0,
          rules: [
            'Starting capital: $10,000',
            'No leverage allowed',
            'Maximum 10 trades per day',
            'No short selling',
            'Must hold positions for at least 1 hour'
          ],
          leaderboard: [
            { rank: 1, username: 'TradingMaster', portfolio_value: 12500, return_percentage: 25.0 },
            { rank: 2, username: 'MarketWizard', portfolio_value: 11800, return_percentage: 18.0 },
            { rank: 3, username: 'ProfitSeeker', portfolio_value: 11500, return_percentage: 15.0 },
            { rank: 4, username: 'BullTrader', portfolio_value: 11200, return_percentage: 12.0 },
            { rank: 5, username: 'RiskTaker', portfolio_value: 10900, return_percentage: 9.0 },
          ]
        },
        {
          id: '2',
          name: 'Monthly Championship',
          description: 'The ultimate trading championship with a massive prize pool. Only the best traders need apply.',
          status: 'upcoming',
          start_date: '2024-02-01',
          end_date: '2024-02-29',
          participants: 0,
          max_participants: 500,
          prize_pool: 50000,
          entry_fee: 100,
          rules: [
            'Starting capital: $50,000',
            'Maximum 2x leverage',
            'No day trading restrictions',
            'Short selling allowed',
            'Must maintain minimum 5% cash position'
          ],
          leaderboard: []
        },
        {
          id: '3',
          name: 'Crypto King Challenge',
          description: 'Focus on cryptocurrency trading with special crypto-only assets.',
          status: 'completed',
          start_date: '2024-01-01',
          end_date: '2024-01-14',
          participants: 856,
          max_participants: 1000,
          prize_pool: 10000,
          entry_fee: 25,
          rules: [
            'Crypto assets only',
            'Starting capital: $5,000',
            'No leverage restrictions',
            '24/7 trading allowed',
            'Must trade at least 3 different cryptocurrencies'
          ],
          leaderboard: [
            { rank: 1, username: 'CryptoKing', portfolio_value: 8750, return_percentage: 75.0 },
            { rank: 2, username: 'BitcoinBull', portfolio_value: 7200, return_percentage: 44.0 },
            { rank: 3, username: 'EthereumExpert', portfolio_value: 6800, return_percentage: 36.0 },
          ]
        }
      ];

      setTournaments(mockTournaments);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      Alert.alert('Error', 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const joinTournament = (tournament: Tournament) => {
    if (tournament.entry_fee > 0) {
      Alert.alert(
        'Join Tournament',
        `This tournament has an entry fee of $${tournament.entry_fee}. Do you want to proceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Join', onPress: () => processJoinTournament(tournament) },
        ]
      );
    } else {
      processJoinTournament(tournament);
    }
  };

  const processJoinTournament = async (tournament: Tournament) => {
    try {
      // Here you would process the tournament join
      Alert.alert(
        'Tournament Joined!',
        `You have successfully joined "${tournament.name}". Good luck!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error joining tournament:', error);
      Alert.alert('Error', 'Failed to join tournament. Please try again.');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'upcoming': return '#FF9800';
      case 'completed': return '#757575';
      default: return '#A1A1AA';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Live';
      case 'upcoming': return 'Starting Soon';
      case 'completed': return 'Finished';
      default: return status;
    }
  };

  const filteredTournaments = tournaments.filter(t => t.status === activeTab);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Tournaments...</Text>
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
          <Text style={styles.headerTitle}>Tournaments</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {/* Implement create tournament */}}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.activeTab]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tournaments List */}
        <View style={styles.tournamentsList}>
          {filteredTournaments.map((tournament) => (
            <View key={tournament.id} style={styles.tournamentCard}>
              <View style={styles.tournamentHeader}>
                <View style={styles.tournamentInfo}>
                  <Text style={styles.tournamentName}>{tournament.name}</Text>
                  <Text style={styles.tournamentDescription}>{tournament.description}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(tournament.status) }
                ]}>
                  <Text style={styles.statusText}>{getStatusText(tournament.status)}</Text>
                </View>
              </View>

              <View style={styles.tournamentDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar" size={16} color="#A1A1AA" />
                  <Text style={styles.detailText}>
                    {tournament.start_date} - {tournament.end_date}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Ionicons name="people" size={16} color="#A1A1AA" />
                  <Text style={styles.detailText}>
                    {tournament.participants}/{tournament.max_participants} participants
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Ionicons name="trophy" size={16} color="#A1A1AA" />
                  <Text style={styles.detailText}>
                    Prize Pool: {formatCurrency(tournament.prize_pool)}
                  </Text>
                </View>
                
                {tournament.entry_fee > 0 && (
                  <View style={styles.detailItem}>
                    <Ionicons name="card" size={16} color="#A1A1AA" />
                    <Text style={styles.detailText}>
                      Entry Fee: {formatCurrency(tournament.entry_fee)}
                    </Text>
                  </View>
                )}
              </View>

              {tournament.status === 'active' && tournament.leaderboard.length > 0 && (
                <View style={styles.leaderboardPreview}>
                  <Text style={styles.leaderboardTitle}>Current Leaders</Text>
                  {tournament.leaderboard.slice(0, 3).map((entry) => (
                    <View key={entry.rank} style={styles.leaderboardEntry}>
                      <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
                      <Text style={styles.leaderboardUsername}>{entry.username}</Text>
                      <Text style={styles.leaderboardReturn}>
                        {formatPercentage(entry.return_percentage)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.tournamentActions}>
                {tournament.status === 'active' && (
                  <TouchableOpacity
                    style={styles.joinButton}
                    onPress={() => joinTournament(tournament)}
                  >
                    <Ionicons name="play" size={16} color="white" />
                    <Text style={styles.joinButtonText}>Join Tournament</Text>
                  </TouchableOpacity>
                )}
                
                {tournament.status === 'upcoming' && (
                  <TouchableOpacity
                    style={styles.registerButton}
                    onPress={() => joinTournament(tournament)}
                  >
                    <Ionicons name="calendar" size={16} color="white" />
                    <Text style={styles.registerButtonText}>Register</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => setSelectedTournament(tournament)}
                >
                  <Ionicons name="information-circle" size={16} color="#6366F1" />
                  <Text style={styles.detailsButtonText}>Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Tournament Details Modal */}
        {selectedTournament && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedTournament.name}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedTournament(null)}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalDescription}>{selectedTournament.description}</Text>
                
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Tournament Rules</Text>
                  {selectedTournament.rules.map((rule, index) => (
                    <View key={index} style={styles.ruleItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                  ))}
                </View>

                {selectedTournament.leaderboard.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Leaderboard</Text>
                    {selectedTournament.leaderboard.map((entry) => (
                      <View key={entry.rank} style={styles.leaderboardRow}>
                        <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
                        <Text style={styles.leaderboardUsername}>{entry.username}</Text>
                        <Text style={styles.leaderboardValue}>
                          {formatCurrency(entry.portfolio_value)}
                        </Text>
                        <Text style={styles.leaderboardReturn}>
                          {formatPercentage(entry.return_percentage)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setSelectedTournament(null)}
                >
                  <Text style={styles.modalCancelButtonText}>Close</Text>
                </TouchableOpacity>
                
                {(selectedTournament.status === 'active' || selectedTournament.status === 'upcoming') && (
                  <TouchableOpacity
                    style={styles.modalJoinButton}
                    onPress={() => {
                      setSelectedTournament(null);
                      joinTournament(selectedTournament);
                    }}
                  >
                    <Text style={styles.modalJoinButtonText}>
                      {selectedTournament.status === 'active' ? 'Join Now' : 'Register'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <FloatingChatbot
        context={{
          current_page: 'tournaments',
          active_tab: activeTab,
          selected_tournament: selectedTournament?.name,
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
  createButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
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
  tournamentsList: {
    gap: 16,
  },
  tournamentCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tournamentInfo: {
    flex: 1,
    marginRight: 12,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  tournamentDescription: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tournamentDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  leaderboardPreview: {
    backgroundColor: '#2A2A3E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  leaderboardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  leaderboardRank: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: 'bold',
    width: 30,
  },
  leaderboardUsername: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  leaderboardReturn: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tournamentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  joinButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  registerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  detailsButtonText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    flex: 1,
  },
  modalDescription: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  ruleText: {
    color: '#A1A1AA',
    fontSize: 14,
    flex: 1,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  leaderboardValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#2A2A3E',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalJoinButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalJoinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Tournaments;
