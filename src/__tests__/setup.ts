import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DOCUSAURUS_GIT_SYNC_KEY = 'test-encryption-key';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for integration tests
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Add a test to ensure this file is recognized as a test suite
describe('Setup', () => {
  it('should set up test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DOCUSAURUS_GIT_SYNC_KEY).toBe('test-encryption-key');
  });
});
