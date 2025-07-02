/**
 * Custom error types for Git Sync plugin
 */

export enum ErrorCode {
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Git operation errors
  GIT_INIT_FAILED = 'GIT_INIT_FAILED',
  GIT_REMOTE_FAILED = 'GIT_REMOTE_FAILED',
  GIT_PULL_FAILED = 'GIT_PULL_FAILED',
  GIT_PUSH_FAILED = 'GIT_PUSH_FAILED',
  GIT_COMMIT_FAILED = 'GIT_COMMIT_FAILED',
  GIT_MERGE_CONFLICT = 'GIT_MERGE_CONFLICT',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  REMOTE_NOT_FOUND = 'REMOTE_NOT_FOUND',
  
  // File system errors
  PATH_NOT_FOUND = 'PATH_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DISK_FULL = 'DISK_FULL',
  
  // Webhook errors
  WEBHOOK_START_FAILED = 'WEBHOOK_START_FAILED',
  WEBHOOK_VALIDATION_FAILED = 'WEBHOOK_VALIDATION_FAILED',
  
  // General errors
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class GitSyncError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any,
    public isRecoverable: boolean = true
  ) {
    super(message);
    this.name = 'GitSyncError';
    Object.setPrototypeOf(this, GitSyncError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      isRecoverable: this.isRecoverable,
    };
  }
}

export class ConfigurationError extends GitSyncError {
  constructor(message: string, details?: any) {
    super(ErrorCode.INVALID_CONFIG, message, details, false);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class GitOperationError extends GitSyncError {
  constructor(code: ErrorCode, message: string, details?: any, isRecoverable = true) {
    super(code, message, details, isRecoverable);
    this.name = 'GitOperationError';
    Object.setPrototypeOf(this, GitOperationError.prototype);
  }
}

export class NetworkError extends GitSyncError {
  constructor(message: string, details?: any) {
    super(ErrorCode.NETWORK_ERROR, message, details, true);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class AuthenticationError extends GitSyncError {
  constructor(message: string, details?: any) {
    super(ErrorCode.AUTHENTICATION_FAILED, message, details, false);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  static handle(error: any): GitSyncError {
    // Already a GitSyncError
    if (error instanceof GitSyncError) {
      return error;
    }

    // Git operation errors
    if (error.message) {
      const message = error.message.toLowerCase();
      
      // Authentication errors
      if (message.includes('authentication failed') || 
          message.includes('invalid username or password') ||
          (message.includes('permission denied') && 
           (message.includes('git') || message.includes('remote')))) {
        return new AuthenticationError(
          'Git authentication failed. Please check your credentials.',
          { originalError: error.message }
        );
      }
      
      // Network errors
      if (message.includes('could not resolve host') ||
          message.includes('network is unreachable') ||
          message.includes('connection refused')) {
        return new NetworkError(
          'Network error occurred while syncing.',
          { originalError: error.message }
        );
      }
      
      // Remote not found
      if (message.includes('repository not found') ||
          message.includes('does not exist')) {
        return new GitOperationError(
          ErrorCode.REMOTE_NOT_FOUND,
          'Remote repository not found.',
          { originalError: error.message },
          false
        );
      }
      
      // Merge conflicts
      if (message.includes('merge conflict') ||
          message.includes('automatic merge failed')) {
        return new GitOperationError(
          ErrorCode.GIT_MERGE_CONFLICT,
          'Merge conflict detected. Manual resolution required.',
          { originalError: error.message },
          false
        );
      }
      
      // File system errors
      if (message.includes('enoent') || message.includes('no such file')) {
        return new GitSyncError(
          ErrorCode.PATH_NOT_FOUND,
          'Path not found.',
          { originalError: error.message }
        );
      }
      
      if (message.includes('eacces') || message.includes('permission denied')) {
        return new GitSyncError(
          ErrorCode.PERMISSION_DENIED,
          'Permission denied accessing file system.',
          { originalError: error.message },
          false
        );
      }
      
      if (message.includes('enospc') || message.includes('no space left')) {
        return new GitSyncError(
          ErrorCode.DISK_FULL,
          'Disk space full.',
          { originalError: error.message },
          false
        );
      }
      
      // Handle spawn EIO errors (common in Docker)
      if (message.includes('spawn eio') || message.includes('spawn EIO')) {
        return new GitSyncError(
          ErrorCode.UNKNOWN_ERROR,
          'Process spawn error (EIO). This often occurs in Docker environments.',
          { originalError: error.message },
          false  // Don't retry spawn errors
        );
      }
    }
    
    // Default to unknown error
    return new GitSyncError(
      ErrorCode.UNKNOWN_ERROR,
      error.message || 'An unknown error occurred.',
      { originalError: error }
    );
  }

  static isRecoverable(error: GitSyncError): boolean {
    return error.isRecoverable;
  }

  static shouldRetry(error: GitSyncError): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.GIT_PULL_FAILED,
      ErrorCode.GIT_PUSH_FAILED,
    ];
    
    return error.isRecoverable && retryableCodes.includes(error.code);
  }

  static formatError(error: GitSyncError, includeDetails = false): string {
    let message = `[${error.code}] ${error.message}`;
    
    if (includeDetails && error.details) {
      message += `\nDetails: ${JSON.stringify(error.details, null, 2)}`;
    }
    
    return message;
  }
}