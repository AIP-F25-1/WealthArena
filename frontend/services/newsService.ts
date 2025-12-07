// News Service for Trading News
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  category: 'market' | 'earnings' | 'fed' | 'crypto' | 'forex' | 'commodities';
  impact: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedStocks?: string[];
  relatedCrypto?: string[];
}

// Alpha Vantage News Article format
interface AlphaVantageNewsArticle {
  title: string;
  url: string;
  time_published: string;
  authors?: string[];
  summary: string;
  source: string;
  category_within_source?: string;
  source_domain?: string;
  topics?: Array<{
    topic: string;
    relevance_score: string;
  }>;
  overall_sentiment_score?: number;
  overall_sentiment_label?: 'Bullish' | 'Somewhat-Bullish' | 'Neutral' | 'Somewhat-Bearish' | 'Bearish';
  ticker_sentiment?: Array<{
    ticker: string;
    relevance_score: string;
    ticker_sentiment_score?: string;
    ticker_sentiment_label?: string;
  }>;
  banner_image?: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
  status: 'ok' | 'error';
}

class NewsService {
  private baseUrl = 'https://newsapi.org/v2';
  private apiKey = process.env.EXPO_PUBLIC_NEWS_API_KEY || 'your-news-api-key';

  /**
   * Convert Alpha Vantage news format to our NewsArticle format
   */
  private convertAlphaVantageNews(avArticle: AlphaVantageNewsArticle): NewsArticle {
    // Determine category from topics
    let category: NewsArticle['category'] = 'market';
    const topics = avArticle.topics?.map(t => t.topic.toLowerCase()) || [];
    if (topics.some(t => t.includes('earnings'))) category = 'earnings';
    else if (topics.some(t => t.includes('fed') || t.includes('federal reserve'))) category = 'fed';
    else if (topics.some(t => t.includes('crypto') || t.includes('bitcoin'))) category = 'crypto';
    else if (topics.some(t => t.includes('forex') || t.includes('currency'))) category = 'forex';
    else if (topics.some(t => t.includes('commodity') || t.includes('oil'))) category = 'commodities';

    // Determine sentiment
    let sentiment: NewsArticle['sentiment'] = 'neutral';
    const sentimentLabel = avArticle.overall_sentiment_label?.toLowerCase() || '';
    if (sentimentLabel.includes('bullish')) sentiment = 'positive';
    else if (sentimentLabel.includes('bearish')) sentiment = 'negative';

    // Determine impact based on sentiment score
    let impact: NewsArticle['impact'] = 'medium';
    const sentimentScore = Math.abs(avArticle.overall_sentiment_score || 0);
    if (sentimentScore > 0.35) impact = 'high';
    else if (sentimentScore < 0.15) impact = 'low';

    // Extract related stocks from ticker sentiment
    const relatedStocks = avArticle.ticker_sentiment
      ?.filter(t => parseFloat(t.relevance_score || '0') > 0.5)
      .map(t => t.ticker) || [];

    // Parse time_published (format: YYYYMMDDTHHMMSS)
    const timeStr = avArticle.time_published;
    let publishedAt = new Date().toISOString();
    if (timeStr) {
      const year = timeStr.substring(0, 4);
      const month = timeStr.substring(4, 6);
      const day = timeStr.substring(6, 8);
      const hour = timeStr.substring(9, 11);
      const minute = timeStr.substring(11, 13);
      publishedAt = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`).toISOString();
    }

    return {
      id: avArticle.url || `av-${Date.now()}-${Math.random()}`,
      title: avArticle.title,
      summary: avArticle.summary,
      content: avArticle.summary, // Alpha Vantage doesn't provide full content
      source: avArticle.source,
      publishedAt,
      url: avArticle.url,
      imageUrl: avArticle.banner_image,
      category,
      impact,
      sentiment,
      relatedStocks,
    };
  }

  // Mock data for development (fallback only)
  private mockNews: NewsArticle[] = [
    {
      id: '1',
      title: 'Fed Signals Potential Rate Cut Amid Economic Uncertainty',
      summary: 'Federal Reserve officials hint at possible interest rate reduction in upcoming meetings as inflation concerns ease.',
      content: 'The Federal Reserve is considering a potential interest rate cut in response to recent economic indicators showing signs of cooling inflation. This development could significantly impact bond markets and stock valuations across various sectors.',
      source: 'Financial Times',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      url: 'https://example.com/fed-rate-cut',
      imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400',
      category: 'fed',
      impact: 'high',
      sentiment: 'positive',
      relatedStocks: ['SPY', 'QQQ', 'IWM']
    },
    {
      id: '2',
      title: 'Tech Giants Report Strong Q4 Earnings, AI Investments Pay Off',
      summary: 'Major technology companies exceed expectations with robust quarterly results driven by AI and cloud computing growth.',
      content: 'Leading technology companies have reported exceptional fourth-quarter earnings, with AI investments showing significant returns. This trend is expected to continue as companies double down on artificial intelligence infrastructure.',
      source: 'Reuters',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      url: 'https://example.com/tech-earnings',
      imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400',
      category: 'earnings',
      impact: 'high',
      sentiment: 'positive',
      relatedStocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META']
    },
    {
      id: '3',
      title: 'Bitcoin Surges Past $50,000 as Institutional Adoption Grows',
      summary: 'Cryptocurrency reaches new milestone with increased institutional investment and regulatory clarity.',
      content: 'Bitcoin has broken through the $50,000 barrier for the first time in months, driven by growing institutional adoption and clearer regulatory frameworks. This milestone represents renewed confidence in the digital asset space.',
      source: 'CoinDesk',
      publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      url: 'https://example.com/bitcoin-surge',
      imageUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400',
      category: 'crypto',
      impact: 'medium',
      sentiment: 'positive',
      relatedCrypto: ['BTC', 'ETH', 'SOL']
    },
    {
      id: '4',
      title: 'Oil Prices Volatile Amid Middle East Tensions',
      summary: 'Crude oil futures experience significant price swings as geopolitical tensions escalate in key oil-producing regions.',
      content: 'Oil markets are experiencing heightened volatility due to ongoing geopolitical tensions in the Middle East. This uncertainty is affecting energy sector investments and commodity trading strategies.',
      source: 'Bloomberg',
      publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      url: 'https://example.com/oil-volatility',
      imageUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400',
      category: 'commodities',
      impact: 'high',
      sentiment: 'negative',
      relatedStocks: ['XOM', 'CVX', 'COP', 'EOG']
    },
    {
      id: '5',
      title: 'Dollar Strengthens Against Major Currencies',
      summary: 'USD gains ground against EUR, GBP, and JPY as economic data supports Federal Reserve policy stance.',
      content: 'The US dollar has strengthened significantly against major currencies following positive economic indicators and Federal Reserve policy signals. This development affects international trade and emerging market currencies.',
      source: 'Wall Street Journal',
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      url: 'https://example.com/dollar-strength',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
      category: 'forex',
      impact: 'medium',
      sentiment: 'positive',
      relatedStocks: ['UUP', 'FXE', 'FXY']
    },
    {
      id: '6',
      title: 'S&P 500 Reaches New All-Time High',
      summary: 'Major US stock index closes at record levels driven by strong corporate earnings and economic optimism.',
      content: 'The S&P 500 has reached a new all-time high, closing above previous records as investors respond positively to strong corporate earnings and optimistic economic forecasts. This milestone reflects continued confidence in the US economy.',
      source: 'CNBC',
      publishedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      url: 'https://example.com/sp500-high',
      imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400',
      category: 'market',
      impact: 'high',
      sentiment: 'positive',
      relatedStocks: ['SPY', 'VTI', 'QQQ']
    }
  ];

  async getTopNews(limit: number = 10): Promise<NewsArticle[]> {
    try {
      // Try Alpha Vantage first
      const { alphaVantageService } = await import('./alphaVantageService');
      const avNews = await alphaVantageService.getDailyNews(limit);
      
      if (avNews && avNews.length > 0) {
        return avNews.map(article => this.convertAlphaVantageNews(article)).slice(0, limit);
      }
      
      // Fallback to mock data if Alpha Vantage fails
      console.warn('Alpha Vantage news unavailable, using fallback data');
      return this.mockNews.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch news:', error);
      return this.mockNews.slice(0, limit);
    }
  }

  async getNewsByCategory(category: NewsArticle['category'], limit: number = 10): Promise<NewsArticle[]> {
    try {
      // Try Alpha Vantage first
      const { alphaVantageService } = await import('./alphaVantageService');
      const avNews = await alphaVantageService.getWeeklyNews(limit * 3); // Get more to filter
      
      if (avNews && avNews.length > 0) {
        const converted = avNews.map(article => this.convertAlphaVantageNews(article));
        return converted.filter(article => article.category === category).slice(0, limit);
      }
      
      // Fallback to mock data
      return this.mockNews.filter(article => article.category === category).slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch news by category:', error);
      return this.mockNews.filter(article => article.category === category).slice(0, limit);
    }
  }

  async getHighImpactNews(): Promise<NewsArticle[]> {
    try {
      // Try Alpha Vantage first
      const { alphaVantageService } = await import('./alphaVantageService');
      const avNews = await alphaVantageService.getDailyNews(100); // Get more to filter
      
      if (avNews && avNews.length > 0) {
        const converted = avNews.map(article => this.convertAlphaVantageNews(article));
        return converted.filter(article => article.impact === 'high');
      }
      
      // Fallback to mock data
      return this.mockNews.filter(article => article.impact === 'high');
    } catch (error) {
      console.error('Failed to fetch high impact news:', error);
      return this.mockNews.filter(article => article.impact === 'high');
    }
  }

  async searchNews(query: string, limit: number = 10): Promise<NewsArticle[]> {
    try {
      const searchResults = this.mockNews.filter(article => 
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.summary.toLowerCase().includes(query.toLowerCase()) ||
        article.content.toLowerCase().includes(query.toLowerCase())
      );
      return searchResults.slice(0, limit);
    } catch (error) {
      console.error('Failed to search news:', error);
      return [];
    }
  }

  getCategoryIcon(category: NewsArticle['category']): string {
    const icons = {
      market: 'trending-up',
      earnings: 'dollar-sign',
      fed: 'building',
      crypto: 'bitcoin',
      forex: 'globe',
      commodities: 'bar-chart'
    };
    return icons[category];
  }

  getImpactColor(impact: NewsArticle['impact']): string {
    const colors = {
      high: '#FF4444',
      medium: '#FFA500',
      low: '#4CAF50'
    };
    return colors[impact];
  }

  getSentimentColor(sentiment: NewsArticle['sentiment']): string {
    const colors = {
      positive: '#4CAF50',
      negative: '#FF4444',
      neutral: '#9E9E9E'
    };
    return colors[sentiment];
  }
}

export const newsService = new NewsService();
