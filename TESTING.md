# Testing Guide

This document describes the testing infrastructure and how to run tests for the Cursor Account Switcher project.

## Overview

The project includes comprehensive tests for both frontend (TypeScript/React) and backend (Rust) components.

## Test Structure

```
cursor-account-switcher/
├── src/
│   ├── __tests__/           # Frontend application tests
│   ├── pages/__tests__/     # Page component tests
│   ├── types/__tests__/     # Type definition tests
│   └── test/                # Test utilities and setup
├── src-tauri/
│   ├── src/                 # Rust source with inline unit tests
│   └── tests/               # Rust integration tests
└── scripts/
    ├── test.sh              # Unix test runner
    └── test.bat             # Windows test runner
```

## Frontend Tests

### Technology Stack
- **Vitest**: Fast unit test framework
- **React Testing Library**: Component testing utilities
- **jsdom**: DOM implementation for Node.js

### Running Frontend Tests

```bash
# Run all frontend tests once
npm run test:frontend

# Run tests in watch mode (interactive)
npm run test:frontend:watch

# Run tests with UI (browser interface)
npm run test:frontend:ui

# Run tests with coverage report
npm run test:frontend:coverage
```

### Test Coverage

Frontend tests cover:
- ✅ Application routing and navigation
- ✅ Component rendering and behavior
- ✅ User interactions (clicks, form inputs)
- ✅ Tauri API integration (mocked)
- ✅ Type definitions and interfaces
- ✅ Error handling and edge cases

### Writing Frontend Tests

Example test structure:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    global.mockInvoke.mockReset();
  });

  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    await user.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalled();
    });
  });
});
```

## Backend Tests

### Technology Stack
- **Cargo Test**: Rust's built-in test framework
- **tempfile**: Temporary file and directory creation for tests

### Running Backend Tests

```bash
# Run all backend tests
npm run test:backend

# Run backend tests with verbose output
npm run test:backend:verbose

# Run tests directly with cargo
cd src-tauri && cargo test

# Run tests with output (nocapture)
cd src-tauri && cargo test -- --nocapture

# Run specific test
cd src-tauri && cargo test test_name

# Run tests for a specific module
cd src-tauri && cargo test csv_manager
```

### Test Coverage

Backend tests cover:
- ✅ CSV file operations (read, write, update, delete)
- ✅ Account parsing and validation
- ✅ Database operations (SQLite)
- ✅ Machine ID generation
- ✅ Data serialization/deserialization
- ✅ Error handling and edge cases

### Writing Backend Tests

Example test structure:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_some_functionality() {
        // Arrange
        let input = setup_test_data();
        
        // Act
        let result = function_to_test(input);
        
        // Assert
        assert_eq!(result, expected_value);
    }

    #[test]
    fn test_error_handling() {
        let result = function_that_should_fail();
        assert!(result.is_err());
    }
}
```

## Running All Tests

```bash
# Run both frontend and backend tests
npm test

# Or use the platform-specific script
# Unix/Linux/macOS:
./scripts/test.sh

# Windows:
scripts\test.bat
```

## Continuous Integration

The test suite is designed to run in CI/CD environments. Example GitHub Actions workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run frontend tests
        run: npm run test:frontend
      - name: Run backend tests
        run: cd src-tauri && cargo test
```

## Test Utilities

### Frontend Test Utilities

Located in `src/test/utils.tsx`:

- `renderWithProviders()`: Render components with necessary providers
- `createMockAccount()`: Generate mock account data
- `createMockAccountInfo()`: Generate mock account info
- `createMockUsageInfo()`: Generate mock usage statistics
- `createMockMachineIds()`: Generate mock machine IDs

### Backend Test Utilities

- `tempfile::tempdir()`: Create temporary directories for file tests
- Test databases with in-memory SQLite

## Mocking

### Frontend Mocking

The Tauri API is automatically mocked in tests via `src/test/setup.ts`:

```typescript
// Access the mock in tests
global.mockInvoke.mockResolvedValue(someData);
global.mockInvoke.mockRejectedValue(new Error('Failed'));
```

### Backend Mocking

Rust tests use temporary files and in-memory databases to avoid side effects:

```rust
let temp_dir = tempfile::tempdir().unwrap();
let db_path = temp_dir.path().join("test.db");
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up resources (temp files, connections) after tests
3. **Mocking**: Mock external dependencies (APIs, file system when appropriate)
4. **Coverage**: Aim for high test coverage but focus on critical paths
5. **Speed**: Keep tests fast by using in-memory databases and avoiding network calls
6. **Naming**: Use descriptive test names that explain what is being tested
7. **Arrange-Act-Assert**: Structure tests clearly with setup, execution, and verification

## Debugging Tests

### Frontend

```bash
# Run specific test file
npm run test:frontend src/__tests__/App.test.tsx

# Run tests matching a pattern
npm run test:frontend -- -t "should render"

# Run with debug output
DEBUG=* npm run test:frontend
```

### Backend

```bash
# Run with output
cd src-tauri && cargo test -- --nocapture

# Run specific test
cd src-tauri && cargo test test_add_account -- --nocapture

# Show all output including passed tests
cd src-tauri && cargo test -- --nocapture --show-output
```

## Common Issues

### Frontend

**Issue**: Tests fail with "document is not defined"
- **Solution**: Ensure `vitest.config.ts` has `environment: 'jsdom'`

**Issue**: Tauri invoke is not mocked
- **Solution**: Check that `src/test/setup.ts` is in `setupFiles` in vitest config

### Backend

**Issue**: "tempfile not found"
- **Solution**: Ensure `tempfile = "3.8"` is in `[dev-dependencies]` in Cargo.toml

**Issue**: Tests interfere with each other
- **Solution**: Use unique temporary directories for each test

## Contributing Tests

When contributing new features:

1. Write tests for new functionality
2. Ensure existing tests still pass
3. Update this documentation if adding new test patterns
4. Aim for at least 80% code coverage for new code

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Rust Testing Guide](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Cargo Test Documentation](https://doc.rust-lang.org/cargo/commands/cargo-test.html)

