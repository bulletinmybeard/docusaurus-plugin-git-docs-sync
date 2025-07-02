import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { WebhookQueue } from './webhook-queue';

export interface WebhookServerOptions {
  port: number;
  secret: string;
  onWebhook: (payload: WebhookPayload) => Promise<void>;
  debug: boolean;
  enableHttps?: boolean;
  httpsOptions?: {
    keyPath?: string;
    certPath?: string;
    key?: string;
    cert?: string;
  };
  filterOptions?: {
    branches?: string[];
    events?: string[];
    paths?: string[];
  };
  queueOptions?: {
    enabled?: boolean;
    maxQueueSize?: number;
    maxRetries?: number;
    processInterval?: number;
  };
}

export interface WebhookPayload {
  provider: 'github' | 'bitbucket' | 'unknown';
  event: string;
  branch?: string;
  repository?: string;
  commits?: Array<{
    id: string;
    message: string;
    author: string;
    files?: string[];
  }>;
  raw: any;
}


export class WebhookServer {
  private server: http.Server | https.Server;
  private webhookQueue: WebhookQueue | null = null;
  private webhookStats = {
    total: 0,
    successful: 0,
    failed: 0,
    filtered: 0,
    queued: 0,
    lastWebhook: null as Date | null,
  };
  private webhookLog: Array<{
    timestamp: Date;
    ip: string;
    provider: string;
    event: string;
    branch?: string;
    status: 'success' | 'failed' | 'filtered' | 'queued';
    error?: string;
  }> = [];

  constructor(private options: WebhookServerOptions) {
    this.server = this.createServer();
    
    // Initialize webhook queue if enabled
    if (this.options.queueOptions?.enabled) {
      this.webhookQueue = new WebhookQueue({
        maxQueueSize: this.options.queueOptions.maxQueueSize,
        maxRetries: this.options.queueOptions.maxRetries,
        processInterval: this.options.queueOptions.processInterval,
        processor: this.options.onWebhook,
      });
    }
  }

  private createServer(): http.Server | https.Server {
    const requestHandler = this.createRequestHandler();

    if (this.options.enableHttps && this.options.httpsOptions) {
      const httpsOptions: https.ServerOptions = {};

      // Load SSL certificates
      if (this.options.httpsOptions.keyPath && this.options.httpsOptions.certPath) {
        httpsOptions.key = fs.readFileSync(this.options.httpsOptions.keyPath);
        httpsOptions.cert = fs.readFileSync(this.options.httpsOptions.certPath);
      } else if (this.options.httpsOptions.key && this.options.httpsOptions.cert) {
        httpsOptions.key = this.options.httpsOptions.key;
        httpsOptions.cert = this.options.httpsOptions.cert;
      }

      return https.createServer(httpsOptions, requestHandler);
    }

    return http.createServer(requestHandler);
  }

  private createRequestHandler() {
    return async (req: http.IncomingMessage, res: http.ServerResponse) => {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256, X-Event-Key');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const pathname = url.pathname;

      // Route to appropriate handler
      switch (pathname) {
        case '/webhook/git-sync':
          if (req.method === 'POST') {
            await this.handleWebhook(req, res);
          } else {
            res.writeHead(405);
            res.end('Method not allowed');
          }
          break;

        case '/webhook/health':
          if (req.method === 'GET') {
            await this.handleHealth(req, res);
          } else {
            res.writeHead(405);
            res.end('Method not allowed');
          }
          break;

        case '/webhook/status':
          if (req.method === 'GET') {
            await this.handleStatus(req, res);
          } else {
            res.writeHead(405);
            res.end('Method not allowed');
          }
          break;

        case '/webhook/test':
          if (req.method === 'POST') {
            await this.handleTest(req, res);
          } else {
            res.writeHead(405);
            res.end('Method not allowed');
          }
          break;

        default:
          res.writeHead(404);
          res.end('Not found');
      }
    };
  }

  private async handleWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const clientIp = this.getClientIp(req);

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Parse payload and detect provider
        const payload = JSON.parse(body);
        const webhookPayload = this.parseWebhookPayload(req.headers, payload);

        // Verify signature
        if (!this.verifySignature(req.headers, body, webhookPayload.provider)) {
          res.writeHead(401);
          res.end('Unauthorized');
          this.logWebhook(clientIp, webhookPayload.provider, webhookPayload.event, webhookPayload.branch, 'failed', 'Invalid signature');
          return;
        }

        // Apply filters
        if (!this.shouldProcessWebhook(webhookPayload)) {
          this.webhookStats.filtered++;
          this.logWebhook(clientIp, webhookPayload.provider, webhookPayload.event, webhookPayload.branch, 'filtered');
          res.writeHead(200);
          res.end('Filtered');
          return;
        }

        // Process webhook
        this.webhookStats.total++;
        this.webhookStats.lastWebhook = new Date();

        // Use queue if enabled
        if (this.webhookQueue) {
          const queueId = this.webhookQueue.enqueue(webhookPayload);
          
          if (queueId) {
            this.webhookStats.queued++;
            this.logWebhook(clientIp, webhookPayload.provider, webhookPayload.event, webhookPayload.branch, 'queued');
            res.writeHead(200, { 'X-Queue-ID': queueId });
            res.end('Queued');
          } else {
            // Queue is full
            res.writeHead(503, { 'Retry-After': '60' });
            res.end('Service temporarily unavailable - queue full');
          }
        } else {
          // Process immediately without queue
          res.writeHead(200);
          res.end('OK');

          // Trigger sync after a small delay
          setTimeout(async () => {
            try {
              await this.options.onWebhook(webhookPayload);
              this.webhookStats.successful++;
              this.logWebhook(clientIp, webhookPayload.provider, webhookPayload.event, webhookPayload.branch, 'success');
            } catch (error) {
              this.webhookStats.failed++;
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.logWebhook(clientIp, webhookPayload.provider, webhookPayload.event, webhookPayload.branch, 'failed', errorMessage);
              if (this.options.debug) {
                console.error('[Git Sync] Webhook processing error:', error);
              }
            }
          }, 1000);
        }

      } catch (error) {
        if (this.options.debug) {
          console.error('[Git Sync] Webhook error:', error);
        }
        res.writeHead(400);
        res.end('Bad request');
      }
    });
  }

  private async handleHealth(req: http.IncomingMessage, res: http.ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      httpsEnabled: this.options.enableHttps || false,
    }));
  }

  private async handleStatus(req: http.IncomingMessage, res: http.ServerResponse) {
    const response: any = {
      stats: this.webhookStats,
      recentWebhooks: this.webhookLog.slice(-10),
      configuration: {
        httpsEnabled: this.options.enableHttps || false,
        filtersEnabled: !!this.options.filterOptions,
        queueEnabled: !!this.webhookQueue,
        filters: this.options.filterOptions || {},
      },
    };
    
    // Add queue status if enabled
    if (this.webhookQueue) {
      response.queue = this.webhookQueue.getStatus();
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  private async handleTest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Verify webhook secret in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    const providedSecret = authHeader.substring(7);
    if (providedSecret !== this.options.secret) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    // Send test webhook
    const testPayload: WebhookPayload = {
      provider: 'github',
      event: 'push',
      branch: 'main',
      repository: 'test/repo',
      commits: [{
        id: 'test123',
        message: 'Test webhook',
        author: 'Test User',
        files: ['README.md'],
      }],
      raw: { test: true },
    };

    try {
      await this.options.onWebhook(testPayload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Test webhook processed successfully',
        payload: testPayload,
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  private parseWebhookPayload(headers: http.IncomingHttpHeaders, payload: any): WebhookPayload {
    // GitHub
    if (headers['x-github-event']) {
      return {
        provider: 'github',
        event: headers['x-github-event'] as string,
        branch: payload.ref?.replace('refs/heads/', ''),
        repository: payload.repository?.full_name,
        commits: payload.commits?.map((c: any) => ({
          id: c.id,
          message: c.message,
          author: c.author?.name || c.author?.username,
          files: [...(c.added || []), ...(c.modified || []), ...(c.removed || [])],
        })),
        raw: payload,
      };
    }


    // Bitbucket
    if (headers['x-event-key']) {
      const eventKey = headers['x-event-key'] as string;
      return {
        provider: 'bitbucket',
        event: eventKey,
        branch: payload.push?.changes?.[0]?.new?.name,
        repository: payload.repository?.full_name,
        commits: payload.push?.changes?.[0]?.commits?.map((c: any) => ({
          id: c.hash,
          message: c.message,
          author: c.author?.user?.display_name || c.author?.raw,
          files: [], // Bitbucket doesn't provide file lists in webhooks
        })),
        raw: payload,
      };
    }

    return {
      provider: 'unknown',
      event: 'unknown',
      raw: payload,
    };
  }

  private verifySignature(headers: http.IncomingHttpHeaders, body: string, provider: string): boolean {
    if (!this.options.secret) {
      return true; // No secret configured, allow all
    }

    switch (provider) {
      case 'github': {
        const githubSignature = headers['x-hub-signature-256'];
        if (!githubSignature) return false;
        return this.verifyGitHubSignature(body, githubSignature as string);
      }


      case 'bitbucket':
        // Bitbucket uses a more complex signature verification
        // For now, we'll just check if the webhook has the right structure
        return true; // TODO: Implement proper Bitbucket signature verification

      default:
        return false;
    }
  }

  private verifyGitHubSignature(payload: string, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.options.secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  private shouldProcessWebhook(payload: WebhookPayload): boolean {
    if (!this.options.filterOptions) {
      return true; // No filters, process all
    }

    const { branches, events, paths } = this.options.filterOptions;

    // Check branch filter
    if (branches && branches.length > 0 && payload.branch) {
      if (!branches.includes(payload.branch)) {
        if (this.options.debug) {
          console.log(`[Git Sync] Webhook filtered: branch '${payload.branch}' not in filter list`);
        }
        return false;
      }
    }

    // Check event filter
    if (events && events.length > 0) {
      if (!events.includes(payload.event)) {
        if (this.options.debug) {
          console.log(`[Git Sync] Webhook filtered: event '${payload.event}' not in filter list`);
        }
        return false;
      }
    }

    // Check path filter
    if (paths && paths.length > 0 && payload.commits) {
      const affectedFiles = payload.commits.flatMap(c => c.files || []);
      const hasMatchingFile = affectedFiles.some(file => 
        paths.some(pattern => this.matchPath(file, pattern))
      );

      if (!hasMatchingFile) {
        if (this.options.debug) {
          console.log('[Git Sync] Webhook filtered: no files match path filters');
        }
        return false;
      }
    }

    return true;
  }

  private matchPath(filePath: string, pattern: string): boolean {
    // Simple glob-like matching
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return filePath.startsWith(prefix);
    }
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      const dirname = path.dirname(filePath);
      return dirname === prefix;
    }
    if (pattern.includes('*')) {
      // Convert glob to regex
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(filePath);
    }
    return filePath === pattern;
  }


  private getClientIp(req: http.IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  private logWebhook(
    ip: string,
    provider: string,
    event: string,
    branch: string | undefined,
    status: 'success' | 'failed' | 'filtered' | 'queued',
    error?: string
  ) {
    const entry = {
      timestamp: new Date(),
      ip,
      provider,
      event,
      branch,
      status,
      error,
    };

    this.webhookLog.push(entry);

    // Keep only last 100 entries
    if (this.webhookLog.length > 100) {
      this.webhookLog.shift();
    }

    if (this.options.debug) {
      console.log(`[Git Sync] Webhook ${status}:`, {
        provider,
        event,
        branch,
        ip,
        error,
      });
    }
  }

  public start(): void {
    this.server.listen(this.options.port, () => {
      const protocol = this.options.enableHttps ? 'https' : 'http';
      console.log(`[Git Sync] Webhook server started on ${protocol}://localhost:${this.options.port}`);
      
      if (this.options.debug) {
        console.log('[Git Sync] Webhook endpoints:');
        console.log(`  - POST ${protocol}://localhost:${this.options.port}/webhook/git-sync`);
        console.log(`  - GET  ${protocol}://localhost:${this.options.port}/webhook/health`);
        console.log(`  - GET  ${protocol}://localhost:${this.options.port}/webhook/status`);
        console.log(`  - POST ${protocol}://localhost:${this.options.port}/webhook/test`);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // Stop the queue if enabled
      if (this.webhookQueue) {
        this.webhookQueue.stop();
      }
      
      this.server.close(() => {
        if (this.options.debug) {
          console.log('[Git Sync] Webhook server stopped');
        }
        resolve();
      });
    });
  }
}

// Backward compatibility function
export function createWebhookServer(
  port: number,
  secret: string,
  onWebhook: () => Promise<void>,
  debug: boolean
): http.Server {
  const server = new WebhookServer({
    port,
    secret,
    onWebhook: async () => {
      await onWebhook();
    },
    debug,
  });

  server.start();
  return server as any; // Type compatibility
}