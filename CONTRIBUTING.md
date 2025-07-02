# Contributing to docusaurus-plugin-git-docs-sync

Thank you for your interest in contributing to docusaurus-plugin-git-docs-sync! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please be respectful and inclusive in all interactions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your feature or bug fix
4. Make your changes
5. Submit a pull request

## Development Setup

### Prerequisites

- Node.js >= 18.0
- npm or yarn
- Git
- TypeScript knowledge

### Installation

```bash
# Clone your fork
git clone https://github.com/bulletinmybeard/docusaurus-plugin-git-docs-sync.git
cd docusaurus-plugin-git-docs-sync

# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm run test
```

### Local Development

To test the plugin locally with a Docusaurus site:

```bash
# In the plugin directory
npm link

# In your Docusaurus site directory
npm link docusaurus-plugin-git-docs-sync

# Watch for changes during development
npm run watch
```

## Project Structure

```bash
docusaurus-plugin-git-docs-sync/
├── src/                      # Source code
│   ├── index.ts              # Main plugin entry
│   ├── git-sync-manager.ts   # Core sync logic
│   ├── credential-manager.ts # Secure credential handling
│   ├── errors.ts             # Error definitions
│   ├── validation.ts         # Input validation
│   ├── webhook-server.ts     # Webhook server
│   ├── sync-queue.ts         # Async queue management
│   ├── rate-limiter.ts       # Rate limiting
│   ├── retry-manager.ts      # Retry logic
│   ├── types.ts              # TypeScript types
│   └── __tests__/            # Unit tests
├── lib/                      # Compiled output (gitignored)
├── docs/                     # Documentation
├── examples/                 # Example configurations
└── package.json              # Package configuration
```

## Development Workflow

### 1. Creating a New Feature

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ...

# Run tests
npm run test

# Check TypeScript types
npm run typecheck

# Run linter
npm run lint
```

### 2. Debugging

Enable debug mode in your Docusaurus config:

```javascript
plugins: [
  [
    'docusaurus-plugin-git-docs-sync',
    {
      debug: true,
      // ... other options
    },
  ],
],
```

### 3. Common Development Tasks

#### Adding a New Option

1. Add the option to `types.ts`:

   ```typescript
   export interface PluginOptions {
     // ... existing options
     myNewOption?: string;
   }
   ```

2. Add default value in `options-validation.ts`:

   ```typescript
   export const DEFAULT_OPTIONS: Partial<PluginOptions> = {
     // ... existing defaults
     myNewOption: 'default-value',
   };
   ```

3. Add validation in `validation.ts` if needed
4. Update the README documentation
5. Add tests for the new option

#### Adding Error Handling

1. Define error code in `errors.ts`:

   ```typescript
   export enum ErrorCode {
     // ... existing codes
     MY_NEW_ERROR = 'MY_NEW_ERROR',
   }
   ```

2. Use in your code:

   ```typescript
   throw new GitOperationError(
     ErrorCode.MY_NEW_ERROR,
     'Descriptive error message',
     { context: 'data' }
   );
   ```

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

1. Create test files with `.test.ts` or `.spec.ts` extension
2. Place tests in `src/__tests__/` directory
3. Follow the existing test patterns

Example test:

```typescript
import { MyModule } from '../my-module';

describe('MyModule', () => {
  it('should do something', () => {
    const result = MyModule.doSomething();
    expect(result).toBe(expected);
  });
});
```

### Test Coverage

We aim for at least 80% test coverage. Check coverage with:

```bash
npm run test:coverage
```

## Code Style

### TypeScript Guidelines

- Use TypeScript strict mode
- Prefer interfaces over types for object shapes
- Use enums for constants
- Add JSDoc comments for public APIs

### General Guidelines

- Use meaningful variable names
- Keep functions small and focused
- Handle errors appropriately
- Add debug logging for important operations
- Validate user inputs

### Linting

Run ESLint before committing:

```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

## Submitting Changes

### Pull Request Process

1. Update the README.md with details of changes if needed
2. Update the CHANGELOG.md with your changes
3. Ensure all tests pass
4. Update documentation if you changed APIs
5. Request review from maintainers

### Pull Request Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] Added new tests
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.logs left
```

### Commit Messages

Follow conventional commits:

```
feat: add new sync mode
fix: resolve authentication error
docs: update README
test: add validation tests
refactor: improve error handling
```

## Release Process

### Version Bumping

```bash
# Patch release (1.0.0 -> 1.0.1)
npm version patch

# Minor release (1.0.0 -> 1.1.0)
npm version minor

# Major release (1.0.0 -> 2.0.0)
npm version major
```

### Publishing

Maintainers can publish to npm:

```bash
# Ensure you're logged in to npm
npm login

# Publish to npm
npm publish
```

### Release Checklist

1. [ ] All tests pass
2. [ ] CHANGELOG.md updated
3. [ ] README.md updated if needed
4. [ ] Version bumped appropriately
5. [ ] Git tag created
6. [ ] Published to npm
7. [ ] GitHub release created

## Security

### Reporting Security Issues

Please report security vulnerabilities privately to the maintainers rather than public issues.

### Security Best Practices

- Never log sensitive information
- Use the CredentialManager for handling secrets
- Validate all user inputs
- Keep dependencies updated

## Getting Help

- Open an issue for bugs
- Start a discussion for features
- Check existing issues before creating new ones
- Join our Discord for real-time help

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
