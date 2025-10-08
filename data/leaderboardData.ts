export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  xp: number;
  winRate: number;
  totalTrades: number;
  avatar?: string;
  badge?: string;
  streak?: number;
}

export const mockLeaderboardData: LeaderboardEntry[] = [
  {
    id: '1',
    rank: 1,
    name: 'CryptoKing',
    xp: 15420,
    winRate: 89,
    totalTrades: 156,
    badge: 'Champion',
    streak: 12,
  },
  {
    id: '2',
    rank: 2,
    name: 'StockMaster',
    xp: 14280,
    winRate: 85,
    totalTrades: 134,
    badge: 'Expert',
    streak: 8,
  },
  {
    id: '3',
    rank: 3,
    name: 'TradeNinja',
    xp: 13150,
    winRate: 82,
    totalTrades: 142,
    badge: 'Pro',
    streak: 6,
  },
  {
    id: '4',
    rank: 4,
    name: 'WealthBuilder',
    xp: 12430,
    winRate: 78,
    totalTrades: 128,
    badge: 'Advanced',
    streak: 5,
  },
  {
    id: '5',
    rank: 5,
    name: 'MarketGuru',
    xp: 11890,
    winRate: 76,
    totalTrades: 145,
    badge: 'Advanced',
    streak: 3,
  },
  {
    id: '6',
    rank: 6,
    name: 'PortfolioPro',
    xp: 11240,
    winRate: 74,
    totalTrades: 98,
    badge: 'Intermediate',
    streak: 4,
  },
  {
    id: '7',
    rank: 7,
    name: 'InvestorElite',
    xp: 10870,
    winRate: 72,
    totalTrades: 112,
    badge: 'Intermediate',
    streak: 2,
  },
  {
    id: '8',
    rank: 8,
    name: 'TradingHero',
    xp: 10230,
    winRate: 70,
    totalTrades: 89,
    badge: 'Intermediate',
    streak: 1,
  },
  {
    id: '9',
    rank: 9,
    name: 'FinanceWiz',
    xp: 9650,
    winRate: 68,
    totalTrades: 76,
    badge: 'Intermediate',
    streak: 1,
  },
  {
    id: '10',
    rank: 10,
    name: 'MoneyMaker',
    xp: 9180,
    winRate: 65,
    totalTrades: 67,
    badge: 'Beginner',
    streak: 1,
  },
];

export const getCurrentUserRank = (): LeaderboardEntry => {
  return {
    id: 'current',
    rank: 245,
    name: 'Wealthman Trader',
    xp: 2450,
    winRate: 68,
    totalTrades: 28,
    badge: 'Beginner',
    streak: 7,
  };
};

export const getTopPerformers = (limit: number = 5): LeaderboardEntry[] => {
  return mockLeaderboardData.slice(0, limit);
};

export const getUserRanking = (userId: string): LeaderboardEntry | null => {
  if (userId === 'current') {
    return getCurrentUserRank();
  }
  return mockLeaderboardData.find(entry => entry.id === userId) || null;
};
