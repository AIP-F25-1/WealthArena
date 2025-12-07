# Trade Simulator & User vs AI Battle System

## Overview

A comprehensive trading simulation system with two main modes:
1. **Historical Trade Simulator** - Practice trading on historical data with full playback controls
2. **User vs AI Battle** - Compete against an AI trading agent in real-time

## Architecture

### Core Components

#### 1. Simulation Engine (`utils/simulationEngine.ts`)
- Manages playback state (playing, paused, completed)
- Controls playback speed (1x, 2x, 5x, 10x)
- Handles time progression and event emissions
- Provides tick-by-tick data playback
- Supports timeline control (rewind, fast-forward, jump)

#### 2. Simulation Context (`contexts/SimulationContext.tsx`)
- Global state management using React Context
- Tracks user and AI trading states
- Manages balances, positions, P&L, and trade events
- Provides simulation control functions
- Optimized with `useMemo` to prevent unnecessary re-renders

#### 3. AI Trader (`utils/aiTrader.ts`)
- Rule-based trading strategies:
  - **Momentum Strategy**: Buys uptrends, sells downtrends
  - **Reversal Strategy**: Buys dips, sells peaks
  - **Random Strategy**: Random trades for testing
- Configurable trade frequency and position sizing
- Automatic take-profit (5%) and stop-loss (-3%)

#### 4. Historical Data (`data/historicalData.ts`)
- Mock data generation with realistic price movements
- 10 trading symbols (BTC/USD, ETH/USD, AAPL, GOOGL, etc.)
- Configurable volatility per symbol
- Duration-based candle generation

### Shared Components

All components are located in `components/trade/`:

#### 1. **PlaybackControls.tsx**
- Play, Pause, Rewind, Fast-Forward buttons
- Speed selector (1×, 2×, 5×, 10×)
- Progress bar with candle count
- Reset functionality

#### 2. **TradeLogPanel.tsx**
- Scrolling event feed
- Displays user trades, AI trades, system messages
- Color-coded by event type
- Auto-scrolls to latest events
- Shows trade details (price, quantity, timestamp)

#### 3. **TradeActions.tsx**
- Buy and Sell order buttons
- Modal for order entry with quantity input
- Balance validation
- Close all positions button
- Real-time cost calculation

#### 4. **DurationSlider.tsx**
- Custom slider component (1-60 minutes)
- Touch-responsive with PanResponder
- Visual feedback with progress fill

#### 5. **SimpleCandlestickChart.tsx**
- Lightweight candlestick visualization
- Green/red candles for bullish/bearish
- Price labels and current price indicator
- Optional volume bars
- Horizontally scrollable

#### 6. **ResultModal.tsx**
- End-of-simulation results display
- Winner announcement with animations
- Detailed statistics comparison
- Performance badges
- Play Again functionality

### Screen Flows

#### Historical Trade Simulator (`app/trade-simulator.tsx`)

**Setup Mode:**
1. Choose trading symbol from 10 options
2. Select duration (5-60 minutes)
3. View simulation info and instructions
4. Start simulation

**Trading Mode:**
1. Real-time candlestick chart
2. Playback controls for time manipulation
3. Trade buttons (Buy, Sell, Close)
4. Live P&L and balance tracking
5. Event log with commentary
6. Results modal on completion

#### User vs AI Battle

**Screen 1: Start (`app/vs-ai-start.tsx`)**
- Symbol is randomly selected
- User can reroll symbol
- Duration selection (5-30 minutes)
- Match rules explanation
- Visual representation of User vs AI

**Screen 2: Play (`app/vs-ai-play.tsx`)**
- Live trading interface
- Side-by-side scoreboard (User vs AI)
- AI trades automatically using momentum strategy
- User trades manually
- Real-time P&L comparison
- Playback controls for strategic analysis
- Auto-navigation to results on completion

**Screen 3: Game Over (`app/vs-ai-gameover.tsx`)**
- Winner announcement
- Comprehensive statistics:
  - Final P&L comparison
  - Return percentages
  - Trade counts
  - Win rates
- Performance insights
- Performance badges based on results
- Play Again or Exit options

## Features

### Trading Features
- **Market Orders**: Buy and sell at current market price
- **Position Management**: Track open positions with P&L
- **Balance Management**: Virtual $100,000 starting balance
- **Risk Management**: Prevent overtrading with balance validation

### Playback Features
- **Real-time Simulation**: Candle-by-candle price movement
- **Speed Control**: 1×, 2×, 5×, 10× playback speeds
- **Timeline Control**: 
  - Pause to analyze
  - Rewind to review past moves
  - Fast-forward to skip ahead
  - Jump to specific candle
- **Progress Tracking**: Visual progress bar

### AI Features
- **Intelligent Trading**: Rule-based decision making
- **Market Analysis**: Analyzes recent price action
- **Risk Management**: Automatic profit-taking and stop-loss
- **Configurable Strategies**: Multiple trading styles

### Visual Features
- **Dark Theme**: Modern gaming aesthetic
- **Real-time Updates**: Live P&L and balance
- **Color-coded Events**: Easy event identification
- **Smooth Animations**: Polished user experience
- **Responsive Design**: Adapts to screen sizes

## Technical Details

### State Management
- React Context for global simulation state
- Local state for component-specific data
- Event-driven architecture for real-time updates
- Optimized re-renders with `useMemo` and `useCallback`

### Performance
- Efficient candle data slicing (visible window only)
- Debounced event listeners
- Minimal re-renders through proper memoization
- Smooth 60fps chart rendering

### Data Flow
1. User selects symbol and duration
2. Historical data is generated
3. Simulation engine is initialized
4. Playback begins, emitting tick events
5. Components subscribe to events
6. User/AI make trading decisions
7. P&L is calculated on each tick
8. Results are shown on completion

## Future Enhancements

### Potential Features
- More AI strategies (ML-based, technical indicators)
- Multiple timeframes (1min, 5min, 1hour)
- Advanced order types (limit, stop-loss)
- Real market data integration
- Match history and statistics
- Leaderboards and achievements
- Multiplayer competitions
- Advanced charting tools
- Strategy backtesting

### Technical Improvements
- WebSocket for real-time data
- Database for match history
- Cloud save/sync
- Performance analytics
- A/B testing for AI strategies

## Usage

### Starting Historical Simulator
```typescript
// Navigate to simulator
router.push('/trade-simulator');

// Select symbol and duration
// Start simulation
// Trade using Buy/Sell buttons
// Control playback with controls
// View results at end
```

### Starting AI Battle
```typescript
// Navigate to vs AI
router.push('/vs-ai-start');

// Symbol is auto-selected (can reroll)
// Choose duration
// Start match
// Trade against AI
// View winner at end
```

### Integrating Components
```typescript
import { SimulationProvider, useSimulation } from '@/contexts/SimulationContext';
import { PlaybackControls } from '@/components/trade/PlaybackControls';

function MyComponent() {
  const simulation = useSimulation();
  
  return (
    <PlaybackControls
      playbackState={simulation.playbackState}
      playbackSpeed={simulation.playbackSpeed}
      progress={simulation.progress}
      currentIndex={simulation.currentIndex}
      totalCandles={simulation.totalCandles}
      onPlay={simulation.play}
      onPause={simulation.pause}
      onRewind={simulation.rewind}
      onFastForward={simulation.fastForward}
      onSpeedChange={simulation.setSpeed}
    />
  );
}
```

## Design System Updates

Added the following theme properties to `src/design-system/tokens.ts`:
- `success`: Green color for positive values
- `warning`: Yellow color for warnings
- `card`: Card background color
- `cardHover`: Card hover state color
- `textMuted`: Muted text color
- `radius.full`: For circular elements (9999px)

## Dependencies

All components use existing dependencies:
- React Native core components
- Expo Router for navigation
- Design system components from `@/src/design-system`
- Ionicons for icons

## Testing Recommendations

1. **Unit Tests**
   - Simulation engine playback logic
   - AI trading decision algorithms
   - P&L calculation functions
   - Data generation utilities

2. **Integration Tests**
   - Simulation context state management
   - Component interaction with simulation
   - Navigation flow between screens

3. **E2E Tests**
   - Complete simulator flow
   - Complete AI battle flow
   - Edge cases (insufficient balance, etc.)

## Conclusion

This trading simulation system provides a comprehensive, engaging way for users to practice trading and compete against AI. The modular architecture makes it easy to extend with new features, strategies, and data sources.

