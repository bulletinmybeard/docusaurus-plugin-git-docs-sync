import {
  GitSyncError,
  ConfigurationError,
  GitOperationError,
  NetworkError,
  AuthenticationError,
  ErrorHandler,
  ErrorCode,
} from '../errors';

describe('Error Classes', () => {
  describe('GitSyncError', () => {
    it('should create error with proper properties', () => {
      const error = new GitSyncError(
        ErrorCode.GIT_PULL_FAILED,
        'Pull failed',
        { branch: 'main' },
        true
      );

      expect(error.code).toBe(ErrorCode.GIT_PULL_FAILED);
      expect(error.message).toBe('Pull failed');
      expect(error.details).toEqual({ branch: 'main' });
      expect(error.isRecoverable).toBe(true);
      expect(error.name).toBe('GitSyncError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new GitSyncError(
        ErrorCode.NETWORK_ERROR,
        'Network unreachable',
        { host: 'github.com' },
        false
      );

      const json = error.toJSON();
      expect(json).toEqual({
        name: 'GitSyncError',
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network unreachable',
        details: { host: 'github.com' },
        isRecoverable: false,
      });
    });
  });

  describe('ConfigurationError', () => {
    it('should create non-recoverable error', () => {
      const error = new ConfigurationError('Invalid config', { field: 'remoteRepository' });

      expect(error.code).toBe(ErrorCode.INVALID_CONFIG);
      expect(error.isRecoverable).toBe(false);
      expect(error.name).toBe('ConfigurationError');
    });
  });

  describe('GitOperationError', () => {
    it('should create git operation error', () => {
      const error = new GitOperationError(
        ErrorCode.GIT_MERGE_CONFLICT,
        'Merge conflict detected',
        { files: ['README.md'] },
        false
      );

      expect(error.code).toBe(ErrorCode.GIT_MERGE_CONFLICT);
      expect(error.name).toBe('GitOperationError');
      expect(error.isRecoverable).toBe(false);
    });
  });

  describe('NetworkError', () => {
    it('should create recoverable network error', () => {
      const error = new NetworkError('Connection timeout', { timeout: 30000 });

      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.isRecoverable).toBe(true);
      expect(error.name).toBe('NetworkError');
    });
  });

  describe('AuthenticationError', () => {
    it('should create non-recoverable auth error', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error.code).toBe(ErrorCode.AUTHENTICATION_FAILED);
      expect(error.isRecoverable).toBe(false);
      expect(error.name).toBe('AuthenticationError');
    });
  });
});

describe('ErrorHandler', () => {
  describe('handle', () => {
    it('should return GitSyncError as-is', () => {
      const original = new GitSyncError(ErrorCode.UNKNOWN_ERROR, 'Test error');
      const handled = ErrorHandler.handle(original);

      expect(handled).toBe(original);
    });

    it('should handle authentication errors', () => {
      const error = new Error('fatal: Authentication failed for repo');
      const handled = ErrorHandler.handle(error);

      expect(handled).toBeInstanceOf(AuthenticationError);
      expect(handled.code).toBe(ErrorCode.AUTHENTICATION_FAILED);
    });

    it('should handle network errors', () => {
      const error = new Error('Could not resolve host: github.com');
      const handled = ErrorHandler.handle(error);

      expect(handled).toBeInstanceOf(NetworkError);
      expect(handled.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('should handle repository not found', () => {
      const error = new Error('Repository not found');
      const handled = ErrorHandler.handle(error);

      expect(handled).toBeInstanceOf(GitOperationError);
      expect(handled.code).toBe(ErrorCode.REMOTE_NOT_FOUND);
    });

    it('should handle merge conflicts', () => {
      const error = new Error('Automatic merge failed; fix conflicts and commit');
      const handled = ErrorHandler.handle(error);

      expect(handled).toBeInstanceOf(GitOperationError);
      expect(handled.code).toBe(ErrorCode.GIT_MERGE_CONFLICT);
    });

    it('should handle file system errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      const handled = ErrorHandler.handle(error);

      expect(handled.code).toBe(ErrorCode.PATH_NOT_FOUND);
    });

    it('should handle permission errors', () => {
      const error = new Error('EACCES: permission denied');
      const handled = ErrorHandler.handle(error);

      expect(handled.code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    it('should handle disk space errors', () => {
      const error = new Error('ENOSPC: no space left on device');
      const handled = ErrorHandler.handle(error);

      expect(handled.code).toBe(ErrorCode.DISK_FULL);
    });

    it('should handle unknown errors', () => {
      const error = new Error('Something went wrong');
      const handled = ErrorHandler.handle(error);

      expect(handled.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(handled.message).toBe('Something went wrong');
    });
  });

  describe('isRecoverable', () => {
    it('should identify recoverable errors', () => {
      const recoverable = new GitSyncError(ErrorCode.NETWORK_ERROR, 'Network error', {}, true);
      const nonRecoverable = new GitSyncError(ErrorCode.INVALID_CONFIG, 'Config error', {}, false);

      expect(ErrorHandler.isRecoverable(recoverable)).toBe(true);
      expect(ErrorHandler.isRecoverable(nonRecoverable)).toBe(false);
    });
  });

  describe('shouldRetry', () => {
    it('should identify retryable errors', () => {
      const networkError = new GitSyncError(ErrorCode.NETWORK_ERROR, 'Network error', {}, true);
      const pullError = new GitSyncError(ErrorCode.GIT_PULL_FAILED, 'Pull failed', {}, true);
      const configError = new GitSyncError(ErrorCode.INVALID_CONFIG, 'Config error', {}, false);

      expect(ErrorHandler.shouldRetry(networkError)).toBe(true);
      expect(ErrorHandler.shouldRetry(pullError)).toBe(true);
      expect(ErrorHandler.shouldRetry(configError)).toBe(false);
    });
  });

  describe('formatError', () => {
    it('should format error without details', () => {
      const error = new GitSyncError(
        ErrorCode.GIT_PUSH_FAILED,
        'Push failed',
        { branch: 'main' }
      );

      const formatted = ErrorHandler.formatError(error, false);
      expect(formatted).toBe('[GIT_PUSH_FAILED] Push failed');
    });

    it('should format error with details', () => {
      const error = new GitSyncError(
        ErrorCode.GIT_PUSH_FAILED,
        'Push failed',
        { branch: 'main' }
      );

      const formatted = ErrorHandler.formatError(error, true);
      expect(formatted).toContain('[GIT_PUSH_FAILED] Push failed');
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('"branch": "main"');
    });
  });
});