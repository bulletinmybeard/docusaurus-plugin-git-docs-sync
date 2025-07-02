import { WebhookPayload } from './webhook-server-improved';

export interface QueuedWebhook {
  id: string;
  payload: WebhookPayload;
  timestamp: Date;
  retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export class WebhookQueue {
  private queue: QueuedWebhook[] = [];
  private processing = false;
  private maxQueueSize: number;
  private maxRetries: number;
  private processInterval: number;
  private processor: (payload: WebhookPayload) => Promise<void>;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: {
    maxQueueSize?: number;
    maxRetries?: number;
    processInterval?: number;
    processor: (payload: WebhookPayload) => Promise<void>;
  }) {
    this.maxQueueSize = options.maxQueueSize || 100;
    this.maxRetries = options.maxRetries || 3;
    this.processInterval = options.processInterval || 1000;
    this.processor = options.processor;
  }

  /**
   * Add a webhook to the queue
   */
  enqueue(payload: WebhookPayload): string | null {
    if (this.queue.length >= this.maxQueueSize) {
      // Queue is full, reject the webhook
      return null;
    }

    const webhook: QueuedWebhook = {
      id: this.generateId(),
      payload,
      timestamp: new Date(),
      retries: 0,
      status: 'pending',
    };

    this.queue.push(webhook);
    this.startProcessing();

    return webhook.id;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    size: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    webhooks: QueuedWebhook[];
  } {
    const pending = this.queue.filter(w => w.status === 'pending').length;
    const processing = this.queue.filter(w => w.status === 'processing').length;
    const completed = this.queue.filter(w => w.status === 'completed').length;
    const failed = this.queue.filter(w => w.status === 'failed').length;

    return {
      size: this.queue.length,
      pending,
      processing,
      completed,
      failed,
      webhooks: this.queue.slice(-20), // Last 20 webhooks
    };
  }

  /**
   * Clear completed and old failed webhooks
   */
  cleanup(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    this.queue = this.queue.filter(webhook => {
      // Keep pending and processing webhooks
      if (webhook.status === 'pending' || webhook.status === 'processing') {
        return true;
      }
      
      // Keep recent completed/failed webhooks
      return webhook.timestamp > oneHourAgo;
    });
  }

  /**
   * Stop processing
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.processing = false;
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    if (this.processing) {
      return;
    }

    this.processing = true;
    
    // Process queue at regular intervals
    this.timer = setInterval(() => {
      this.processNext();
    }, this.processInterval);

    // Process immediately
    this.processNext();
  }

  /**
   * Process next webhook in queue
   */
  private async processNext(): Promise<void> {
    // Find next pending webhook
    const webhook = this.queue.find(w => w.status === 'pending');
    
    if (!webhook) {
      // No pending webhooks, check if we should stop processing
      const hasProcessing = this.queue.some(w => w.status === 'processing');
      if (!hasProcessing) {
        this.stop();
      }
      return;
    }

    // Mark as processing
    webhook.status = 'processing';

    try {
      // Process the webhook
      await this.processor(webhook.payload);
      
      // Mark as completed
      webhook.status = 'completed';
      
      // Cleanup old webhooks periodically
      if (Math.random() < 0.1) { // 10% chance
        this.cleanup();
      }
    } catch (error) {
      webhook.retries++;
      webhook.error = error instanceof Error ? error.message : String(error);
      
      if (webhook.retries < this.maxRetries) {
        // Retry later
        webhook.status = 'pending';
      } else {
        // Max retries reached
        webhook.status = 'failed';
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}