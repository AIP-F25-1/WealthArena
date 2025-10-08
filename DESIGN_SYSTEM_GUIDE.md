# WealthArena Design System Guide

## Overview

This design system is inspired by Duolingo's clean, accessible, and gamified approach. It provides a consistent visual language across the entire WealthArena app with no emojis—only SVG icons and proper components.

## Design Tokens

### Colors
```typescript
primary: '#58CC02'       // Brand green
accentBlue: '#1CB0F6'   // Secondary blue
accentYellow: '#FFC800' // Accent yellow (gamification)
danger: '#FF4B4B'        // Error/danger states
```

### Spacing (8px baseline)
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

### Border Radius
- sm: 8px
- md: 12px
- lg: 20px
- pill: 999px

### Typography
- h1: 26px (semibold)
- h2: 20px (semibold)
- h3: 18px (semibold)
- body: 16px
- small: 13px
- xs: 11px

## Components

### ThemeProvider
Wraps the entire app and provides light/dark mode support.

```tsx
import { ThemeProvider, useTheme } from '@/src/design-system';

// In your root layout
<ThemeProvider>
  <YourApp />
</ThemeProvider>

// In any component
const { theme, mode, setMode } = useTheme();
```

### Text
Typography component with variants and theme support.

```tsx
<Text variant="h1" weight="bold" color={theme.primary}>
  Welcome
</Text>
```

### Button
Accessible button with variants: primary, secondary, ghost, danger.

```tsx
<Button 
  variant="primary" 
  size="large"
  onPress={handlePress}
  icon={<Icon name="trophy" size={20} color={theme.bg} />}
>
  Get Started
</Button>
```

### Card
Surface container with elevation and padding.

```tsx
<Card elevation="med" padding="lg">
  <Text>Card content</Text>
</Card>
```

### Icon
14 SVG icons for consistent visuals.

Available icons:
- market (chart with uptrend)
- signal (wave pattern)
- agent (headset)
- replay (circular arrow)
- portfolio (pie chart)
- shield (protection)
- execute (laptop/screen)
- trophy (achievement)
- leaderboard (podium)
- news (document)
- check-shield (verified)
- lab (beaker)
- alert (exclamation)
- settings (gear)

```tsx
<Icon name="trophy" size={24} color={theme.primary} />
```

### Header
Top navigation with greeting, avatar, and actions.

```tsx
<Header 
  greeting="Good evening" 
  userName="Trader"
  showNotifications
/>
```

### FAB (Floating Action Button)
Animated floating button for AI chat.

```tsx
<FAB onPress={() => router.push('/ai-chat')} />
```

### TextInput
Form input with validation and icons.

```tsx
<TextInput
  label="Email"
  placeholder="Enter your email"
  value={email}
  onChangeText={setEmail}
  error={emailError}
/>
```

### Badge
Small label for status/count.

```tsx
<Badge variant="success" size="small">
  +50 XP
</Badge>
```

### Sparkline
Mini chart for trends.

```tsx
<Sparkline 
  data={[100, 105, 102, 108, 106]}
  width={100}
  height={40}
  color={theme.primary}
/>
```

### ProgressRing
Circular progress indicator.

```tsx
<ProgressRing progress={66} size={60} />
```

### FoxCoach
Mascot with helpful messages.

```tsx
<FoxCoach 
  message="Great job! Keep learning!"
  variant="excited"
/>
```

## Theme Support

### Light Theme
- Background: #FFFFFF
- Surface: #FBFDFA
- Text: #0F1720
- Primary: #58CC02

### Dark Theme
- Background: #071019
- Surface: #0B1318
- Text: #E6EEF3
- Primary: #4BC200 (adjusted for dark)

## Usage Examples

### Dashboard Screen
```tsx
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Header, 
  FAB, 
  Icon 
} from '@/src/design-system';

export default function Dashboard() {
  const { theme } = useTheme();
  
  return (
    <SafeAreaView style={{ backgroundColor: theme.bg }}>
      <Header userName="Trader" showNotifications />
      <ScrollView>
        <Card elevation="med">
          <Icon name="portfolio" size={32} color={theme.primary} />
          <Text variant="h2" weight="bold">$24,580</Text>
          <Text variant="small" muted>Portfolio Value</Text>
        </Card>
      </ScrollView>
      <FAB onPress={() => router.push('/ai-chat')} />
    </SafeAreaView>
  );
}
```

## Accessibility

- Minimum touch targets: 44x44px
- WCAG AA contrast ratios
- Accessible labels on all interactive elements
- Support for screen readers

## Refactored Screens

The following screens have been completely refactored:

### Auth Flow
- ✅ splash.tsx - Animated hero with mascot
- ✅ landing.tsx - Clean feature showcase
- ✅ login.tsx - Simple form with validation
- ✅ signup.tsx - Multi-step registration

### Main Tabs
- ✅ dashboard.tsx - Hero cards, stats, FAB
- ✅ game.tsx - Elevated design with gradient hero
- ✅ opportunities.tsx - Portfolio list with sparklines
- ✅ account.tsx - Profile with dark mode toggle

### Modal Screens
- ✅ daily-quests.tsx - Progress rings, no emojis

## No Emojis

All emojis have been replaced with:
- SVG Icon components
- Badge components
- Proper image assets (character mascots)

## File Structure

```
src/design-system/
├── tokens.ts              # Design tokens
├── ThemeProvider.tsx      # Theme context
├── index.ts              # Main exports
├── Text.tsx              # Typography
├── Button.tsx            # Buttons
├── Card.tsx              # Containers
├── Header.tsx            # Navigation
├── FAB.tsx               # Floating button
├── TextInput.tsx         # Form inputs
├── Badge.tsx             # Labels
├── Sparkline.tsx         # Charts
├── ProgressRing.tsx      # Progress
├── FoxCoach.tsx          # Mascot
├── Icon.tsx              # Icon facade
└── icons/                # SVG icons
    ├── MarketIcon.tsx
    ├── SignalIcon.tsx
    ├── AgentIcon.tsx
    └── ... (14 total)
```

## Best Practices

1. **Always use design system components** - No inline styles for colors/spacing
2. **Use theme values** - Access via `useTheme()` hook
3. **Consistent spacing** - Use tokens.spacing values
4. **Accessible touch targets** - Minimum 44x44px
5. **Icons over emojis** - Use SVG Icon components
6. **Semantic variants** - Use named variants (primary, secondary, etc.)
7. **Responsive** - Test on multiple screen sizes

## Migration Checklist

When refactoring a screen:
- [ ] Remove all emoji characters
- [ ] Replace with Icon components
- [ ] Use Card for surfaces
- [ ] Use Button for actions
- [ ] Use Text for typography
- [ ] Apply proper spacing from tokens
- [ ] Add SafeAreaView
- [ ] Include FAB if needed
- [ ] Test light/dark modes
- [ ] Verify touch targets
- [ ] Check contrast ratios

