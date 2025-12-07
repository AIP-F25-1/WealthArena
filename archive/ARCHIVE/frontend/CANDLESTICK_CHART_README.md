# Candlestick Chart Component

A high-performance, responsive candlestick chart component built for React Native trading applications.

## Features

✅ **Fully Responsive**: Automatically adapts to screen width using `useWindowDimensions()`
✅ **Interactive Tooltips**: Touch any candle to see OHLC data
✅ **Smooth Animations**: Fade-in and scale animations on load
✅ **Multiple Chart Types**: Daily, Weekly, Monthly, Yearly views
✅ **Performance Optimized**: Uses `useCallback` and `useMemo` for smooth rendering
✅ **Theme Support**: Bullish (green) and bearish (red) candles with proper styling
✅ **Grid Lines**: Subtle grid lines for better readability
✅ **Auto-scaling**: Automatically adjusts candle count based on chart type

## Installation

The component uses existing dependencies:
- `react-native-svg` (already installed)
- `victory-native` (already installed)

## Usage

### Basic Usage

```tsx
import CandlestickChart from '../components/CandlestickChart';
import { mockDailyData } from '../data/mockCandleData';

<CandlestickChart
  data={mockDailyData}
  chartType="daily"
/>
```

### Chart Types

- **daily**: Shows 30 candles
- **weekly**: Shows 12 candles  
- **monthly**: Shows 12 candles
- **yearly**: Shows 10 candles

### Data Format

```tsx
interface CandleData {
  time: string;    // Date/time string
  open: number;    // Opening price
  high: number;    // Highest price
  low: number;     // Lowest price
  close: number;   // Closing price
}
```

## Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `CandleData[]` | ✅ | Array of candle data |
| `chartType` | `'daily' \| 'weekly' \| 'monthly' \| 'yearly'` | ✅ | Chart time period |

## Styling

- **Bullish candles**: `#00FF6A` (green)
- **Bearish candles**: `#FF3B30` (red)
- **Background**: Transparent (blends with app theme)
- **Grid lines**: `rgba(255,255,255,0.1)` (subtle gray)
- **Chart height**: 220px
- **Padding**: 10px on all sides

## Performance Features

- **Responsive width**: Uses `useWindowDimensions()` for dynamic sizing
- **Optimized rendering**: `useCallback` for touch handlers
- **Memoized calculations**: `useMemo` for grid lines and scaling
- **Smooth animations**: Native driver animations
- **Touch optimization**: Efficient touch event handling

## Demo

Run the demo page to see all features:

```tsx
import CandlestickDemo from './app/candlestick-demo';

// Navigate to /candlestick-demo to see the full demo
```

## Integration Example

```tsx
// In your dashboard or trading screen
import CandlestickChart from '../components/CandlestickChart';
import { mockDailyData } from '../data/mockCandleData';

export default function TradingScreen() {
  return (
    <View style={styles.container}>
      <CandlestickChart
        data={mockDailyData}
        chartType="daily"
      />
    </View>
  );
}
```

## Files Created

- `components/CandlestickChart.tsx` - Main chart component
- `data/mockCandleData.ts` - Mock data for testing
- `app/candlestick-demo.tsx` - Demo page showcasing all features

## Technical Details

- Built with `react-native-svg` for high-performance rendering
- Uses `Animated` API for smooth animations
- Implements proper touch event handling
- Responsive design with automatic scaling
- Memory-optimized with React hooks
- TypeScript support with full type safety
