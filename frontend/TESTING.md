# Frontend Testing Guide

## Overview

The WealthArena frontend uses Jest and React Native Testing Library for unit and integration testing.

## Running Tests

```bash
cd frontend
npm test              # Run tests with coverage
npm run test:watch    # Watch mode
npm run test:ci       # CI mode with JUnit output
```

## Test Structure

Tests are located in `__tests__/` directories mirroring the source structure:
- `__tests__/components/` - Component tests
- `__tests__/services/` - Service/API tests
- `__tests__/contexts/` - Context provider tests
- `__tests__/utils/` - Utility function tests

## Coverage

Coverage reports are generated in `coverage/lcov.info` for SonarQube integration.

## Writing Tests

### Component Tests

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { ComponentName } from '../ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    const { getByTestId } = render(<ComponentName />);
    expect(getByTestId('component-id')).toBeTruthy();
  });
});

### Service Tests

```typescript
import { apiService } from '../apiService';

describe('API Service', () => {
  it('should handle API calls', async () => {
    // Mock API calls and test
  });
});
```

## Best Practices

1. Test user interactions, not implementation details
2. Use test IDs for reliable element selection
3. Mock external dependencies (API calls, navigation)
4. Aim for >80% code coverage
5. Write tests before fixing bugs (TDD when possible)

