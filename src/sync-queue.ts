import { EventEmitter } from 'events';

interface QueueItem {
  id: string;
  operation: () => Promise<any>;
  priority: number;
  timestamp: number;
  retries: number;
}

export class SyncQueue extends EventEmitter {
  private queue: QueueItem[] = [];
  private processing = false;
  private maxRetries = 3;
  private concurrency = 1; // Sequential processing by default

  constructor(maxRetries = 3) {
    super();
    this.maxRetries = maxRetries;
  }

  /**
   * Add an operation to the queue
   */
  async enqueue(
    operation: () => Promise<any>,
    priority: number = 0,
    id?: string
  ): Promise<any> {
    const item: QueueItem = {
      id: id || `op-${Date.now()}-${Math.random()}`,
      operation,
      priority,
      timestamp: Date.now(),
      retries: 0,
    };

    // Check if operation with same ID already exists
    if (id && this.queue.some(item => item.id === id)) {
      this.emit('duplicate', { id });
      return Promise.reject(new Error(`Operation with ID ${id} already in queue`));
    }

    // Add to queue sorted by priority (higher priority first)
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.emit('enqueued', { id: item.id, queueLength: this.queue.length });

    // Start processing if not already running
    if (!this.processing) {
      this.process();
    }

    // Return a promise that resolves when the operation completes
    return new Promise((resolve, reject) => {
      const handleComplete = (result: any) => {
        if (result.id === item.id) {
          this.removeListener('operation-complete', handleComplete);
          this.removeListener('operation-failed', handleFailed);
          resolve(result.result);
        }
      };

      const handleFailed = (result: any) => {
        if (result.id === item.id) {
          this.removeListener('operation-complete', handleComplete);
          this.removeListener('operation-failed', handleFailed);
          reject(result.error);
        }
      };

      this.on('operation-complete', handleComplete);
      this.on('operation-failed', handleFailed);
    });
  }

  /**
   * Process items in the queue
   */
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.emit('processing-started');

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        this.emit('operation-started', { id: item.id });
        
        const result = await item.operation();
        
        this.emit('operation-complete', { 
          id: item.id, 
          result,
          duration: Date.now() - item.timestamp 
        });
      } catch (error: any) {
        // Check if it's a spawn EIO error (should not retry)
        const errorMessage = error?.message?.toLowerCase() || '';
        const isSpawnError = errorMessage.includes('spawn eio') || errorMessage.includes('spawn EIO');
        
        if (isSpawnError) {
          // Don't retry spawn errors - they indicate a system-level issue
          this.emit('operation-failed', { 
            id: item.id, 
            error,
            attempts: item.retries,
            reason: 'spawn_error'
          });
          
          // Clear the queue to prevent further attempts
          this.clear();
          
          console.error('[Git Sync] Fatal spawn error detected. Clearing queue to prevent hanging.');
        } else {
          item.retries++;
          
          if (item.retries < this.maxRetries) {
            // Re-add to queue for retry
            this.queue.unshift(item);
            this.emit('operation-retry', { 
              id: item.id, 
              attempt: item.retries,
              error 
            });
            
            // Wait before retry (exponential backoff)
            await this.sleep(Math.pow(2, item.retries) * 1000);
          } else {
            this.emit('operation-failed', { 
              id: item.id, 
              error,
              attempts: item.retries 
            });
          }
        }
      }
    }

    this.processing = false;
    this.emit('processing-complete');
  }

  /**
   * Get current queue status
   */
  getStatus(): { 
    queueLength: number; 
    processing: boolean; 
    items: Array<{ id: string; priority: number; retries: number }> 
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      items: this.queue.map(item => ({
        id: item.id,
        priority: item.priority,
        retries: item.retries,
      })),
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    const clearedCount = this.queue.length;
    this.queue = [];
    this.emit('queue-cleared', { clearedCount });
  }

  /**
   * Remove a specific operation from the queue
   */
  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index > -1) {
      this.queue.splice(index, 1);
      this.emit('operation-removed', { id });
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Debounced queue - coalesces multiple calls into one
 */
export class DebouncedSyncQueue extends SyncQueue {
  private debounceTimer?: NodeJS.Timeout;
  private debounceMs: number;
  private pendingOperation?: () => Promise<any>;

  constructor(debounceMs = 5000, maxRetries = 3) {
    super(maxRetries);
    this.debounceMs = debounceMs;
  }

  async enqueueDebounced(operation: () => Promise<any>): Promise<any> {
    this.pendingOperation = operation;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    return new Promise((resolve, reject) => {
      this.debounceTimer = setTimeout(async () => {
        if (this.pendingOperation) {
          try {
            const result = await this.enqueue(this.pendingOperation, 0, 'debounced-sync');
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.pendingOperation = undefined;
          }
        }
      }, this.debounceMs);
    });
  }
}