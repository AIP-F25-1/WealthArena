# WealthArena UI - Troubleshooting Guide

## Metro Bundler "Unknown Module" Error

### Issue
`ERROR [Error: Requiring unknown module "3147"]`

### Cause
This happens when Metro bundler's cache becomes stale after adding new files or significantly changing imports.

### Solution
**Always clear Metro cache when adding new modules:**

```bash
# PowerShell (Windows)
npx expo start -c

# Or if using npm scripts
npm run start -- -c

# Or manually clear cache
npx expo start --clear
```

### Additional Steps if Issue Persists

1. **Stop all running Metro processes**
   ```bash
   # Kill any running Metro bundler
   taskkill /F /IM node.exe
   ```

2. **Clear watchman cache (if using watchman)**
   ```bash
   watchman watch-del-all
   ```

3. **Clear node_modules and reinstall**
   ```bash
   rm -rf node_modules
   npm install
   # or
   yarn install
   ```

4. **Clear all caches**
   ```bash
   npx expo start -c
   ```

## Common Import Errors

### Path Alias Issues

**Symptom:** Cannot find module '@/src/design-system'

**Check `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Verify imports use correct path:**
```tsx
// ✅ Correct
import { useTheme, Text, Button } from '@/src/design-system';

// ❌ Wrong
import { useTheme } from '@/contexts/ThemeContext'; // Old path
```

## Design System Not Loading

### Issue
Components from design system not rendering or causing errors.

### Checklist

1. **Verify all files exist:**
   ```
   src/design-system/
   ├── index.ts              ✓
   ├── tokens.ts             ✓
   ├── ThemeProvider.tsx     ✓
   ├── Icon.tsx              ✓
   └── icons/
       ├── MarketIcon.tsx    ✓
       ├── SignalIcon.tsx    ✓
       └── ... (14 total)    ✓
   ```

2. **Check ThemeProvider is wrapping app:**
   ```tsx
   // app/_layout.tsx
   import { ThemeProvider } from '@/src/design-system';
   
   <ThemeProvider>
     <YourApp />
   </ThemeProvider>
   ```

3. **Verify react-native-svg is installed:**
   ```bash
   npm list react-native-svg
   # Should show: react-native-svg@15.12.1
   ```

## Dark Mode Not Working

### Issue
Theme toggle in Account screen doesn't switch themes.

### Solution

**Check AsyncStorage permissions:**
```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

// Test storage
const testStorage = async () => {
  try {
    await AsyncStorage.setItem('test', 'value');
    console.log('Storage working');
  } catch (error) {
    console.error('Storage error:', error);
  }
};
```

**Verify theme context usage:**
```tsx
const { theme, mode, setMode } = useTheme();

// Toggle dark mode
<Switch
  value={mode === 'dark'}
  onValueChange={() => setMode(mode === 'dark' ? 'light' : 'dark')}
/>
```

## Icon Not Displaying

### Issue
Icon component renders but no icon visible.

### Checklist

1. **Icon name is valid:**
   ```tsx
   // Valid icon names:
   'market', 'signal', 'agent', 'replay', 'portfolio',
   'shield', 'execute', 'trophy', 'leaderboard', 'news',
   'check-shield', 'lab', 'alert', 'settings'
   ```

2. **Size and color are provided:**
   ```tsx
   <Icon name="trophy" size={24} color={theme.primary} />
   ```

3. **react-native-svg is working:**
   ```tsx
   import Svg, { Circle } from 'react-native-svg';
   
   // Test component
   <Svg width={24} height={24}>
     <Circle cx={12} cy={12} r={10} fill="red" />
   </Svg>
   ```

## Build Errors

### TypeScript Errors

**Clear TypeScript cache:**
```bash
# Remove TypeScript cache
rm -rf .expo
rm tsconfig.tsbuildinfo

# Restart
npx expo start -c
```

### Missing Types

**Install type definitions:**
```bash
npm install --save-dev @types/react @types/react-native
```

## Performance Issues

### App Slow or Laggy

1. **Enable Hermes engine** (check `app.json`):
   ```json
   {
     "expo": {
       "jsEngine": "hermes"
     }
   }
   ```

2. **Reduce re-renders:**
   - Use `React.memo()` for expensive components
   - Use `useMemo()` for expensive calculations
   - Use `useCallback()` for event handlers

3. **Optimize images:**
   - Use smaller image sizes
   - Use `resizeMode="contain"` or `"cover"`
   - Consider image optimization tools

## Development Tips

### Quick Restart
- Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
- Select "Reload" to refresh app

### View Logs
```bash
# Clear and detailed logs
npx expo start -c --dev-client
```

### Debug Mode
```bash
# Enable debug mode
npx expo start --dev-client --localhost
```

## Getting Help

If issues persist:

1. Check Expo documentation: https://docs.expo.dev
2. Check React Native documentation: https://reactnative.dev
3. Review design system guide: `DESIGN_SYSTEM_GUIDE.md`
4. Check implementation summary: `IMPLEMENTATION_SUMMARY.md`

## Common Fixes Checklist

- [ ] Clear Metro cache: `npx expo start -c`
- [ ] Restart Metro bundler
- [ ] Check all imports use `@/src/design-system`
- [ ] Verify ThemeProvider wraps app
- [ ] Ensure react-native-svg is installed
- [ ] Check TypeScript configuration
- [ ] Clear watchman cache (if applicable)
- [ ] Reinstall node_modules if needed

