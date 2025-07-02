import { GitSyncError, ErrorHandler } from './errors';

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  onRetry?: (error: GitSyncError, attempt: number) => void;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

export class RetryManager {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    customOptions?: Partial<RetryOptions>
  ): Promise<T> {
    const options = { ...this.options, ...customOptions };
    let lastError: GitSyncError | null = null;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = ErrorHandler.handle(error);

        // Don't retry if error is not recoverable
        if (!ErrorHandler.shouldRetry(lastError)) {
          throw lastError;
        }

        // Don't retry if we've exhausted attempts
        if (attempt === options.maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          options.initialDelay * Math.pow(options.backoffFactor, attempt),
          options.maxDelay
        );

        // Notify about retry
        if (options.onRetry) {
          options.onRetry(lastError, attempt + 1);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`${operationName} failed after ${options.maxRetries} retries`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker pattern for handling repeated failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new GitSyncError(
          'CIRCUIT_BREAKER_OPEN' as any,
          'Circuit breaker is open due to repeated failures',
          { failureCount: this.failureCount, lastFailureTime: this.lastFailureTime },
          false
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime >= this.resetTimeout
    );
  }

  getState(): { state: string; failureCount: number; lastFailureTime: number | null } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}