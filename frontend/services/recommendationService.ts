/**
 * Personalized Recommendation Service
 * AI-powered portfolio and strategy recommendations based on user profile
 */

import { rlAgentService } from './rlAgentService';
import { API_CONFIG } from '../config/apiConfig';

export interface PortfolioRecommendation {
  id: string;
  name: string;
  description: string;
  riskLevel: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  expectedReturn: number;
  expectedVolatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  assets: {
    symbol: string;
    name: string;
    allocation: number;
    assetType: 'stock' | 'etf' | 'crypto' | 'commodity' | 'forex' | 'bond';
    expectedReturn: number;
    risk: 'low' | 'medium' | 'high';
  }[];
  rebalancingFrequency: 'monthly' | 'quarterly' | 'annually';
  minInvestment: number;
  confidence: number; // 0-1
  reasoning: string;
  pros: string[];
  cons: string[];
  suitabilityScore: number; // 0-100
}

export interface StrategyRecommendation {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  timeHorizon: 'short' | 'medium' | 'long';
  expectedReturn: number;
  winRate: number;
  maxDrawdown: number;
  timeCommitment: 'low' | 'medium' | 'high';
  indicators: string[];
  reasoning: string;
  suitabilityScore: number;
  learningResources: {
    title: string;
    type: 'video' | 'article' | 'course';
    url: string;
  }[];
}

export interface MarketInsight {
  id: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  timeframe: 'short' | 'medium' | 'long';
  sectors: string[];
  recommendation: 'buy' | 'sell' | 'hold' | 'watch';
  confidence: number;
  reasoning: string;
  relatedAssets: string[];
}

export interface PersonalizedRecommendations {
  portfolios: PortfolioRecommendation[];
  strategies: StrategyRecommendation[];
  marketInsights: MarketInsight[];
  lastUpdated: string;
  nextUpdate: string;
}

class RecommendationService {
  private baseUrl = API_CONFIG.BACKEND_BASE_URL; // Backend API URL (dynamically resolved)

  /**
   * Get personalized recommendations based on user profile
   */
  async getPersonalizedRecommendations(
    riskProfile: any,
    userPreferences: any = {}
  ): Promise<PersonalizedRecommendations> {
    try {
      // For now, generate mock recommendations based on risk profile
      // In production, this would call the RL backend API
      const recommendations = this.generateMockRecommendations(riskProfile, userPreferences);
      
      return {
        portfolios: recommendations.portfolios,
        strategies: recommendations.strategies,
        marketInsights: recommendations.marketInsights,
        lastUpdated: new Date().toISOString(),
        nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      throw error;
    }
  }

  /**
   * Get portfolio recommendations for specific risk level
   */
  async getPortfolioRecommendations(
    riskLevel: string,
    investmentAmount: number = 10000
  ): Promise<PortfolioRecommendation[]> {
    try {
      const portfolios = this.generatePortfolioRecommendations(riskLevel, investmentAmount);
      return portfolios;
    } catch (error) {
      console.error('Error getting portfolio recommendations:', error);
      throw error;
    }
  }

  /**
   * Get strategy recommendations based on user profile
   */
  async getStrategyRecommendations(
    riskProfile: any,
    experienceLevel: string = 'intermediate'
  ): Promise<StrategyRecommendation[]> {
    try {
      const strategies = this.generateStrategyRecommendations(riskProfile, experienceLevel);
      return strategies;
    } catch (error) {
      console.error('Error getting strategy recommendations:', error);
      throw error;
    }
  }

  /**
   * Get market insights and opportunities
   */
  async getMarketInsights(
    sectors: string[] = [],
    timeframe: string = 'medium'
  ): Promise<MarketInsight[]> {
    try {
      const insights = this.generateMarketInsights(sectors, timeframe);
      return insights;
    } catch (error) {
      console.error('Error getting market insights:', error);
      throw error;
    }
  }

  /**
   * Generate mock recommendations based on risk profile
   */
  private generateMockRecommendations(riskProfile: any, userPreferences: any) {
    const portfolios = this.generatePortfolioRecommendations(riskProfile.riskTolerance);
    const strategies = this.generateStrategyRecommendations(riskProfile);
    const marketInsights = this.generateMarketInsights(riskProfile.sectorPreferences);

    return { portfolios, strategies, marketInsights };
  }

  /**
   * Generate portfolio recommendations
   */
  private generatePortfolioRecommendations(
    riskLevel: string,
    investmentAmount: number = 10000
  ): PortfolioRecommendation[] {
    const basePortfolios = {
      conservative: [
        {
          id: 'conservative_balanced',
          name: 'Conservative Balanced',
          description: 'Low-risk portfolio focused on capital preservation with steady growth',
          riskLevel: 'conservative' as const,
          expectedReturn: 6.5,
          expectedVolatility: 8.2,
          maxDrawdown: 12,
          sharpeRatio: 0.79,
          assets: [
            { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', allocation: 40, assetType: 'etf' as const, expectedReturn: 8.0, risk: 'medium' as const },
            { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', allocation: 35, assetType: 'etf' as const, expectedReturn: 4.5, risk: 'low' as const },
            { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', allocation: 15, assetType: 'etf' as const, expectedReturn: 7.5, risk: 'medium' as const },
            { symbol: 'GLD', name: 'SPDR Gold Trust', allocation: 10, assetType: 'commodity' as const, expectedReturn: 3.0, risk: 'medium' as const },
          ],
          rebalancingFrequency: 'quarterly' as const,
          minInvestment: 1000,
          confidence: 0.85,
          reasoning: 'Diversified across asset classes with emphasis on bonds for stability',
          pros: ['Low volatility', 'Steady returns', 'Capital preservation'],
          cons: ['Lower growth potential', 'Inflation risk'],
          suitabilityScore: 92,
        }
      ],
      moderate: [
        {
          id: 'moderate_growth',
          name: 'Moderate Growth',
          description: 'Balanced portfolio with moderate risk for steady long-term growth',
          riskLevel: 'moderate' as const,
          expectedReturn: 8.2,
          expectedVolatility: 12.5,
          maxDrawdown: 18,
          sharpeRatio: 0.66,
          assets: [
            { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', allocation: 50, assetType: 'etf' as const, expectedReturn: 8.0, risk: 'medium' as const },
            { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', allocation: 20, assetType: 'etf' as const, expectedReturn: 7.5, risk: 'medium' as const },
            { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', allocation: 20, assetType: 'etf' as const, expectedReturn: 4.5, risk: 'low' as const },
            { symbol: 'VWO', name: 'Vanguard Emerging Markets ETF', allocation: 10, assetType: 'etf' as const, expectedReturn: 9.5, risk: 'high' as const },
          ],
          rebalancingFrequency: 'quarterly' as const,
          minInvestment: 2000,
          confidence: 0.82,
          reasoning: 'Balanced approach with 70% stocks and 30% bonds for growth and stability',
          pros: ['Good risk-return balance', 'Diversified globally', 'Moderate volatility'],
          cons: ['Higher volatility than conservative', 'Market exposure'],
          suitabilityScore: 88,
        }
      ],
      aggressive: [
        {
          id: 'aggressive_growth',
          name: 'Aggressive Growth',
          description: 'High-growth portfolio with higher risk for maximum returns',
          riskLevel: 'aggressive' as const,
          expectedReturn: 11.5,
          expectedVolatility: 18.2,
          maxDrawdown: 25,
          sharpeRatio: 0.63,
          assets: [
            { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', allocation: 40, assetType: 'etf' as const, expectedReturn: 8.0, risk: 'medium' as const },
            { symbol: 'QQQ', name: 'Invesco QQQ Trust', allocation: 25, assetType: 'etf' as const, expectedReturn: 12.0, risk: 'high' as const },
            { symbol: 'VWO', name: 'Vanguard Emerging Markets ETF', allocation: 20, assetType: 'etf' as const, expectedReturn: 9.5, risk: 'high' as const },
            { symbol: 'BTC-USD', name: 'Bitcoin', allocation: 10, assetType: 'crypto' as const, expectedReturn: 15.0, risk: 'high' as const },
            { symbol: 'GLD', name: 'SPDR Gold Trust', allocation: 5, assetType: 'commodity' as const, expectedReturn: 3.0, risk: 'medium' as const },
          ],
          rebalancingFrequency: 'monthly' as const,
          minInvestment: 5000,
          confidence: 0.78,
          reasoning: 'Growth-focused with 85% stocks, 10% crypto, and 5% commodities',
          pros: ['High growth potential', 'Diversified across asset classes', 'Tech exposure'],
          cons: ['High volatility', 'Significant drawdown risk', 'Market timing sensitive'],
          suitabilityScore: 85,
        }
      ],
      very_aggressive: [
        {
          id: 'very_aggressive_max_growth',
          name: 'Maximum Growth',
          description: 'Ultra-high growth portfolio with maximum risk for aggressive investors',
          riskLevel: 'very_aggressive' as const,
          expectedReturn: 14.2,
          expectedVolatility: 25.5,
          maxDrawdown: 35,
          sharpeRatio: 0.56,
          assets: [
            { symbol: 'QQQ', name: 'Invesco QQQ Trust', allocation: 30, assetType: 'etf' as const, expectedReturn: 12.0, risk: 'high' as const },
            { symbol: 'ARKK', name: 'ARK Innovation ETF', allocation: 20, assetType: 'etf' as const, expectedReturn: 15.0, risk: 'high' as const },
            { symbol: 'VWO', name: 'Vanguard Emerging Markets ETF', allocation: 20, assetType: 'etf' as const, expectedReturn: 9.5, risk: 'high' as const },
            { symbol: 'BTC-USD', name: 'Bitcoin', allocation: 15, assetType: 'crypto' as const, expectedReturn: 15.0, risk: 'high' as const },
            { symbol: 'ETH-USD', name: 'Ethereum', allocation: 10, assetType: 'crypto' as const, expectedReturn: 18.0, risk: 'high' as const },
            { symbol: 'GLD', name: 'SPDR Gold Trust', allocation: 5, assetType: 'commodity' as const, expectedReturn: 3.0, risk: 'medium' as const },
          ],
          rebalancingFrequency: 'monthly' as const,
          minInvestment: 10000,
          confidence: 0.72,
          reasoning: 'Maximum growth with 80% growth stocks, 25% crypto, and 5% commodities',
          pros: ['Maximum growth potential', 'Innovation exposure', 'Crypto diversification'],
          cons: ['Extreme volatility', 'High drawdown risk', 'Requires active management'],
          suitabilityScore: 82,
        }
      ]
    };

    return basePortfolios[riskLevel as keyof typeof basePortfolios] || basePortfolios.moderate;
  }

  /**
   * Generate strategy recommendations
   */
  private generateStrategyRecommendations(riskProfile: any, experienceLevel: string = 'intermediate'): StrategyRecommendation[] {
    const strategies = [
      {
        id: 'momentum_trading',
        name: 'Momentum Trading',
        description: 'Follow market trends using technical indicators for entry and exit signals',
        difficulty: 'intermediate' as const,
        riskLevel: 'medium' as const,
        timeHorizon: 'short' as const,
        expectedReturn: 12.5,
        winRate: 65,
        maxDrawdown: 15,
        timeCommitment: 'high' as const,
        indicators: ['RSI', 'MACD', 'Moving Averages', 'Volume'],
        reasoning: 'Good for active traders who can monitor markets regularly',
        suitabilityScore: riskProfile.riskTolerance === 'aggressive' ? 85 : 60,
        learningResources: [
          { title: 'Momentum Trading Basics', type: 'video' as const, url: '/learn/momentum-basics' },
          { title: 'Technical Analysis Guide', type: 'article' as const, url: '/learn/technical-analysis' },
        ]
      },
      {
        id: 'value_investing',
        name: 'Value Investing',
        description: 'Long-term fundamental analysis approach focusing on undervalued stocks',
        difficulty: 'intermediate' as const,
        riskLevel: 'low' as const,
        timeHorizon: 'long' as const,
        expectedReturn: 9.5,
        winRate: 75,
        maxDrawdown: 12,
        timeCommitment: 'low' as const,
        indicators: ['P/E Ratio', 'PEG Ratio', 'Book Value', 'Debt-to-Equity'],
        reasoning: 'Perfect for conservative investors with long-term outlook',
        suitabilityScore: riskProfile.riskTolerance === 'conservative' ? 95 : 70,
        learningResources: [
          { title: 'Fundamental Analysis Course', type: 'course' as const, url: '/learn/fundamental-analysis' },
          { title: 'Value Investing Principles', type: 'article' as const, url: '/learn/value-investing' },
        ]
      },
      {
        id: 'dca_strategy',
        name: 'Dollar-Cost Averaging',
        description: 'Regular investments regardless of market conditions to reduce timing risk',
        difficulty: 'beginner' as const,
        riskLevel: 'low' as const,
        timeHorizon: 'long' as const,
        expectedReturn: 8.0,
        winRate: 80,
        maxDrawdown: 10,
        timeCommitment: 'low' as const,
        indicators: ['None - Time-based'],
        reasoning: 'Ideal for beginners and conservative investors',
        suitabilityScore: riskProfile.riskTolerance === 'conservative' ? 90 : 75,
        learningResources: [
          { title: 'DCA Strategy Explained', type: 'video' as const, url: '/learn/dca-strategy' },
          { title: 'Building Wealth Gradually', type: 'article' as const, url: '/learn/building-wealth' },
        ]
      },
      {
        id: 'swing_trading',
        name: 'Swing Trading',
        description: 'Capture price swings over days to weeks using technical analysis',
        difficulty: 'intermediate' as const,
        riskLevel: 'high' as const,
        timeHorizon: 'medium' as const,
        expectedReturn: 15.0,
        winRate: 58,
        maxDrawdown: 20,
        timeCommitment: 'medium' as const,
        indicators: ['Support/Resistance', 'Fibonacci', 'Volume', 'RSI'],
        reasoning: 'Good for experienced traders who can dedicate time to analysis',
        suitabilityScore: riskProfile.riskTolerance === 'aggressive' ? 88 : 55,
        learningResources: [
          { title: 'Swing Trading Masterclass', type: 'course' as const, url: '/learn/swing-trading' },
          { title: 'Chart Pattern Recognition', type: 'video' as const, url: '/learn/chart-patterns' },
        ]
      }
    ];

    // Filter and sort by suitability score
    return strategies
      .filter(strategy => strategy.suitabilityScore >= 50)
      .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
      .slice(0, 3);
  }

  /**
   * Generate market insights
   */
  private generateMarketInsights(sectors: string[] = [], timeframe: string = 'medium'): MarketInsight[] {
    return [
      {
        id: 'tech_ai_boom',
        title: 'AI and Technology Sector Growth',
        description: 'Artificial intelligence and cloud computing companies showing strong fundamentals and growth potential',
        impact: 'high' as const,
        timeframe: 'long' as const,
        sectors: ['technology', 'artificial_intelligence'],
        recommendation: 'buy' as const,
        confidence: 0.82,
        reasoning: 'Strong earnings growth, increasing AI adoption, and favorable market conditions',
        relatedAssets: ['QQQ', 'ARKK', 'NVDA', 'MSFT', 'GOOGL'],
      },
      {
        id: 'renewable_energy',
        title: 'Renewable Energy Transition',
        description: 'Clean energy sector benefiting from government incentives and corporate sustainability goals',
        impact: 'medium' as const,
        timeframe: 'medium' as const,
        sectors: ['energy', 'renewable_energy'],
        recommendation: 'buy' as const,
        confidence: 0.75,
        reasoning: 'Policy support, cost reductions, and increasing demand for clean energy',
        relatedAssets: ['ICLN', 'PBW', 'ENPH', 'SEDG'],
      },
      {
        id: 'inflation_hedge',
        title: 'Inflation Hedge Opportunities',
        description: 'Commodities and real estate showing resilience against inflation pressures',
        impact: 'medium' as const,
        timeframe: 'short' as const,
        sectors: ['commodities', 'real_estate'],
        recommendation: 'watch' as const,
        confidence: 0.68,
        reasoning: 'Inflation data suggests commodities may provide portfolio protection',
        relatedAssets: ['GLD', 'SLV', 'VNQ', 'DJP'],
      }
    ];
  }
}

export const recommendationService = new RecommendationService();
