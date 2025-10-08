export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Generate realistic mock data for different time periods
const generateMockData = (days: number, basePrice: number = 100): CandleData[] => {
  const data: CandleData[] = [];
  let currentPrice = basePrice;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    
    // Generate realistic price movement
    const volatility = 0.02; // 2% daily volatility
    const trend = Math.random() > 0.5 ? 1 : -1;
    const change = (Math.random() * volatility * trend);
    
    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    data.push({
      time: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    });
    
    currentPrice = close;
  }
  
  return data;
};

// Mock data for different chart types
export const mockDailyData = generateMockData(30, 150);
export const mockWeeklyData = generateMockData(12, 145);
export const mockMonthlyData = generateMockData(12, 140);
export const mockYearlyData = generateMockData(10, 120);

// Sample data for testing
export const sampleCandleData: CandleData[] = [
  { time: '2024-01-01', open: 100.00, high: 105.50, low: 98.20, close: 103.80 },
  { time: '2024-01-02', open: 103.80, high: 108.30, low: 102.10, close: 106.90 },
  { time: '2024-01-03', open: 106.90, high: 109.20, low: 104.50, close: 107.40 },
  { time: '2024-01-04', open: 107.40, high: 110.80, low: 106.20, close: 109.50 },
  { time: '2024-01-05', open: 109.50, high: 112.30, low: 108.70, close: 111.20 },
  { time: '2024-01-06', open: 111.20, high: 113.80, low: 109.90, close: 112.60 },
  { time: '2024-01-07', open: 112.60, high: 115.40, low: 111.30, close: 114.20 },
  { time: '2024-01-08', open: 114.20, high: 116.90, low: 113.10, close: 115.80 },
  { time: '2024-01-09', open: 115.80, high: 118.50, low: 114.60, close: 117.30 },
  { time: '2024-01-10', open: 117.30, high: 119.80, low: 116.20, close: 118.70 },
  { time: '2024-01-11', open: 118.70, high: 121.40, low: 117.50, close: 120.10 },
  { time: '2024-01-12', open: 120.10, high: 122.90, low: 118.80, close: 121.60 },
  { time: '2024-01-13', open: 121.60, high: 124.30, low: 120.40, close: 123.20 },
  { time: '2024-01-14', open: 123.20, high: 125.80, low: 121.90, close: 124.70 },
  { time: '2024-01-15', open: 124.70, high: 127.50, low: 123.60, close: 126.30 },
  { time: '2024-01-16', open: 126.30, high: 128.90, low: 125.10, close: 127.80 },
  { time: '2024-01-17', open: 127.80, high: 130.40, low: 126.50, close: 129.20 },
  { time: '2024-01-18', open: 129.20, high: 131.80, low: 128.00, close: 130.60 },
  { time: '2024-01-19', open: 130.60, high: 133.20, low: 129.40, close: 132.10 },
  { time: '2024-01-20', open: 132.10, high: 134.70, low: 130.80, close: 133.50 },
  { time: '2024-01-21', open: 133.50, high: 136.10, low: 132.20, close: 134.90 },
  { time: '2024-01-22', open: 134.90, high: 137.50, low: 133.60, close: 136.30 },
  { time: '2024-01-23', open: 136.30, high: 138.90, low: 135.00, close: 137.70 },
  { time: '2024-01-24', open: 137.70, high: 140.30, low: 136.40, close: 139.10 },
  { time: '2024-01-25', open: 139.10, high: 141.70, low: 137.80, close: 140.50 },
  { time: '2024-01-26', open: 140.50, high: 143.10, low: 139.20, close: 141.90 },
  { time: '2024-01-27', open: 141.90, high: 144.50, low: 140.60, close: 143.30 },
  { time: '2024-01-28', open: 143.30, high: 145.90, low: 142.00, close: 144.70 },
  { time: '2024-01-29', open: 144.70, high: 147.30, low: 143.40, close: 146.10 },
  { time: '2024-01-30', open: 146.10, high: 148.70, low: 144.80, close: 147.50 },
];
