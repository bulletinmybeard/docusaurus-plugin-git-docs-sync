import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as cron from 'node-cron';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import type { PluginOptions, GitSyncState } from './types';
import { WebhookServer, WebhookPayload } from './webhook-server-improved';
import { CredentialManager } from './credential-manager';
import { ErrorCode, ErrorHandler, GitOperationError } from './errors';
import { RetryManager, CircuitBreaker } from './retry-manager';
import { SyncQueue, DebouncedSyncQueue } from './sync-queue';
import { MDXValidator } from './mdx-validator';
import { PlaceholderStateManager } from './placeholder-state-manager';

export class GitSyncManager {
  private git: SimpleGit;
  private options: Required<PluginOptions>;
  private contentDir: string;
  private state: GitSyncState;
  private cronJob: cron.ScheduledTask | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private webhookServer: WebhookServer | null = null;
  private credentialManager: CredentialManager;
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;
  private syncQueue: SyncQueue;
  private debouncedQueue: DebouncedSyncQueue;
  private mdxValidator: MDXValidator | null = null;
  private isDisabled: boolean = false;

  constructor(contentDir: string, options: Required<PluginOptions>) {
    this.contentDir = contentDir;
    this.options = options;
    this.state = {
      lastSyncTime: null,
      isSyncing: false,
      syncErrors: [],
    };

    // Initialize managers
    this.credentialManager = new CredentialManager(options.encryptionKey);
    this.credentialManager.storeCredentials(options);

    this.retryManager = new RetryManager({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      onRetry: (error, attempt) => {
        if (this.options.debug) {
          console.log(`[Git Sync] Retry attempt ${attempt} after error: ${error.message}`);
        }
      }
    });

    this.circuitBreaker = new CircuitBreaker();

    // Initialize sync queues
    this.syncQueue = new SyncQueue(3);
    this.debouncedQueue = new DebouncedSyncQueue(5000, 3);

    // Initialize MDX validator if validation is enabled
    if (this.options.validateBeforeCommit) {
      this.mdxValidator = new MDXValidator(contentDir, this.options.ignorePatterns);
    }

    // Set up queue event listeners
    if (this.options.debug) {
      this.syncQueue.on('enqueued', (data) => {
        console.log(`[Git Sync] Operation enqueued: ${data.id}, queue length: ${data.queueLength}`);
      });

      this.syncQueue.on('operation-complete', (data) => {
        console.log(`[Git Sync] Operation completed: ${data.id} in ${data.duration}ms`);
      });

      this.syncQueue.on('operation-failed', (data) => {
        console.log(`[Git Sync] Operation failed: ${data.id} after ${data.attempts} attempts`);
      });
    }

    const gitOptions: Partial<SimpleGitOptions> = {
      baseDir: contentDir,
      binary: 'git',
      maxConcurrentProcesses: 1,
      config: [
        // Prevent git from asking for passwords
        'core.askpass=echo',
        // Disable credential helper
        'credential.helper=',
      ],
      // Add timeout to prevent hanging
      timeout: {
        block: 30000,  // 30 seconds timeout for blocking operations
      },
    };

    this.git = simpleGit(gitOptions);
  }

  private getAuthenticatedRemoteUrl(): string {
    return this.credentialManager.getAuthenticatedUrl(
      this.options.remoteRepository,
      this.options.authMethod
    );
  }

  async initialize(): Promise<void> {
    try {
      // Ensure content directory exists
      try {
        await fs.access(this.contentDir);
      } catch {
        await fs.mkdir(this.contentDir, { recursive: true });
      }

      // Check if it's a git repository
      const isRepo = await this.git.checkIsRepo();

      if (!isRepo) {
        if (this.options.debug) {
          console.log('[Git Sync] Initializing git repository...');
        }

        await this.retryManager.executeWithRetry(
          async () => {
            await this.git.init();
            await this.git.addRemote('origin', this.getAuthenticatedRemoteUrl());
          },
          'Git repository initialization'
        );
      } else {
        const remotes = await this.git.getRemotes(true);
        const hasOrigin = remotes.some(r => r.name === 'origin');

        if (!hasOrigin) {
          await this.git.addRemote('origin', this.getAuthenticatedRemoteUrl());
        } else {
          // Update remote URL to ensure authentication is current
          await this.git.remote(['set-url', 'origin', this.getAuthenticatedRemoteUrl()]);
        }
      }

      // Configure git user
      await this.git.addConfig('user.name', this.options.authorName);
      await this.git.addConfig('user.email', this.options.authorEmail);

      // Try to fetch from remote
      try {
        await this.retryManager.executeWithRetry(
          async () => {
            await this.git.fetch('origin', this.options.branch);
          },
          'Git fetch',
          { maxRetries: 2 } // Fewer retries for initialization
        );

        const branches = await this.git.branch();

        if (!branches.current) {
          await this.git.checkoutBranch(this.options.branch, `origin/${this.options.branch}`);
        } else if (branches.current !== this.options.branch) {
          const remoteBranchExists = branches.all.includes(`remotes/origin/${this.options.branch}`);
          if (remoteBranchExists) {
            await this.git.checkout(this.options.branch);
          } else {
            await this.git.checkoutLocalBranch(this.options.branch);
          }
        }
      } catch (error) {
        const gitError = ErrorHandler.handle(error);

        // Only continue if it's a network error (offline mode)
        if (gitError.code === ErrorCode.NETWORK_ERROR) {
          if (this.options.debug) {
            console.log('[Git Sync] Could not fetch from remote (offline mode)');
          }
        } else {
          throw gitError;
        }
      }
    } catch (error) {
      throw ErrorHandler.handle(error);
    }
  }

  disable(): void {
    this.isDisabled = true;
    console.warn('[Git Sync] Git sync has been disabled due to authentication failure.');
  }

  async performSync(priority: number = 0, debounced: boolean = false, overrideSyncDirection?: 'pull' | 'push' | 'sync'): Promise<void> {
    if (this.isDisabled) {
      if (this.options.debug) {
        console.log('[Git Sync] Sync is disabled, skipping...');
      }
      return;
    }
    
    const syncOperation = async () => {
      this.state.isSyncing = true;

      try {
        await this.circuitBreaker.execute(async () => {
          // Use override sync direction if provided, otherwise use configured direction
          const syncDirection = overrideSyncDirection || this.options.syncDirection;
          
          if (this.options.debug && overrideSyncDirection) {
            console.log(`[Git Sync] Using override sync direction: ${overrideSyncDirection}`);
          }
          
          switch (syncDirection) {
            case 'pull':
              await this.pull();
              break;
            case 'push':
              await this.push();
              break;
            case 'sync':
            default:
              await this.syncBidirectional();
              break;
          }
        });

        this.state.lastSyncTime = new Date();
        this.state.syncErrors = [];

        if (this.options.debug) {
          console.log('[Git Sync] Sync completed successfully');
        }
      } catch (error) {
        const gitError = ErrorHandler.handle(error);

        if (this.options.debug) {
          console.error('[Git Sync] Sync error:', ErrorHandler.formatError(gitError, true));
        }

        this.state.syncErrors.push(gitError);

        // Re-throw for caller to handle
        throw gitError;
      } finally {
        this.state.isSyncing = false;
      }
    };

    // Use debounced queue for file change events
    if (debounced) {
      return this.debouncedQueue.enqueueDebounced(syncOperation);
    }

    // Use regular queue for scheduled or manual syncs
    return this.syncQueue.enqueue(syncOperation, priority, `sync-${Date.now()}`);
  }

  async pull(): Promise<void> {
    if (this.options.debug) {
      console.log('[Git Sync] Pulling from remote...');
    }

    await this.retryManager.executeWithRetry(
      async () => {
        // Check if we have any local changes that need to be stashed
        const status = await this.git.status();
        const hasLocalChanges = status.files.length > 0;
        let stashed = false;

        if (hasLocalChanges) {
          if (this.options.debug) {
            console.log('[Git Sync] Stashing local changes before pull...');
          }
          await this.git.stash(['push', '-m', 'Git sync: temporary stash for pull']);
          stashed = true;
        }

        try {
          const pullOptions: string[] = [];
          if (this.options.conflictResolution === 'theirs') {
            pullOptions.push('--rebase=false', '--strategy=recursive', '--strategy-option=theirs');
          } else if (this.options.conflictResolution === 'ours') {
            pullOptions.push('--rebase=true', '--strategy-option=ours');
          } else {
            pullOptions.push('--rebase=true');
          }

          await this.git.raw(['pull', 'origin', this.options.branch, ...pullOptions]);
          
          // Apply stashed changes back if pull succeeded
          if (stashed) {
            if (this.options.debug) {
              console.log('[Git Sync] Applying stashed changes...');
            }
            try {
              await this.git.stash(['pop']);
            } catch (error: any) {
              // Check if the error is about no stash entries
              if (error.message?.includes('No stash entries found')) {
                if (this.options.debug) {
                  console.log('[Git Sync] No stash entries to pop, continuing...');
                }
                // This is not an error - it means the stash was already applied or didn't exist
              } else if (error.message?.includes('conflict')) {
                console.error('[Git Sync] Conflict when applying stashed changes. Manual resolution required.');
                throw new GitOperationError(
                  ErrorCode.GIT_MERGE_CONFLICT,
                  'Conflict when applying local changes after pull',
                  { branch: this.options.branch },
                  false
                );
              } else {
                // Re-throw other errors
                throw error;
              }
            }
          }
        } catch (error: any) {
          // Try to restore stashed changes even if pull failed
          if (stashed) {
            try {
              await this.git.stash(['pop']);
            } catch (stashError: any) {
              if (!stashError.message?.includes('No stash entries found')) {
                console.error('[Git Sync] Failed to restore stashed changes:', stashError.message);
              }
            }
          }
          
          // Check the specific error type
          if (error.message?.includes('merge conflict')) {
            throw new GitOperationError(
              ErrorCode.GIT_MERGE_CONFLICT,
              'Merge conflict during pull operation',
              { branch: this.options.branch },
              false
            );
          }
          throw error;
        }
      },
      'Git pull operation'
    );
  }

  async push(): Promise<void> {
    if (this.options.debug) {
      console.log('[Git Sync] Pushing to remote...');
    }

    await this.retryManager.executeWithRetry(
      async () => {
        const status = await this.git.status();

        if (status.files.length > 0) {
          // Validate MDX files if enabled
          if (this.mdxValidator && this.options.validateBeforeCommit) {
            const filesToValidate = status.files
              .filter(file => file.path.endsWith('.md') || file.path.endsWith('.mdx'))
              .map(file => file.path);

            if (filesToValidate.length > 0) {
              if (this.options.debug) {
                console.log(`[Git Sync] Validating ${filesToValidate.length} MDX files before commit...`);
              }

              const validation = await this.mdxValidator.validateFiles(filesToValidate);

              if (!validation.valid) {
                if (this.options.skipInvalidFiles) {
                  // Remove invalid files from staging
                  for (const error of validation.errors) {
                    await this.git.reset(['HEAD', error.file]);
                    console.warn(`[Git Sync] Skipping invalid file: ${error.file} - ${error.error}`);
                  }

                  // Check if we still have files to commit
                  const newStatus = await this.git.status();
                  if (newStatus.files.length === 0) {
                    if (this.options.debug) {
                      console.log('[Git Sync] No valid files to commit after validation');
                    }
                    return;
                  }
                } else {
                  // Fail the entire operation
                  const errorMessages = validation.errors
                    .map(e => `${e.file}: ${e.error}`)
                    .join('\n');
                  throw new GitOperationError(
                    ErrorCode.GIT_COMMIT_FAILED,
                    `MDX validation failed:\n${errorMessages}`,
                    { filesWithErrors: validation.errors.length },
                    false
                  );
                }
              }
            }
          }

          try {
            // Check for placeholder files before committing
            if (await this.hasPlaceholderFiles(status.files.map(f => f.path))) {
              console.log('[Git Sync] Aborting commit: Placeholder files detected. Waiting for restoration...');
              return;
            }

            await this.git.add('.');
            await this.git.commit(this.options.commitMessage);
          } catch (error: any) {
            throw new GitOperationError(
              ErrorCode.GIT_COMMIT_FAILED,
              'Failed to commit changes',
              { filesChanged: status.files.length },
              false
            );
          }
        }

        try {
          await this.git.push('origin', this.options.branch);
        } catch (error: any) {
          if (error.message?.includes('non-fast-forward')) {
            throw new GitOperationError(
              ErrorCode.GIT_PUSH_FAILED,
              'Push rejected: remote contains work that you do not have locally',
              { branch: this.options.branch },
              true
            );
          }
          throw error;
        }
      },
      'Git push operation'
    );
  }

  async syncBidirectional(): Promise<void> {
    if (this.options.debug) {
      console.log('[Git Sync] Performing bidirectional sync...');
    }

    try {
      // Step 1: Check for placeholder files - we'll track this but not abort the entire sync
      const stateManager = PlaceholderStateManager.getInstance();
      const hasPlaceholderState = stateManager.hasPlaceholders();
      const hasPlaceholderFiles = await this.hasAnyPlaceholderFiles();
      
      if (hasPlaceholderState || hasPlaceholderFiles) {
        console.warn('[Git Sync] Placeholder files detected. Will proceed with pull but skip any commits.');
      }

      // Step 2: Fetch from remote
      await this.git.fetch('origin', this.options.branch);

      // Step 3: Stash local changes if any
      const status = await this.git.status();
      const hasLocalChanges = status.files.length > 0;
      let stashed = false;

      if (hasLocalChanges) {
        if (this.options.debug) {
          console.log('[Git Sync] Stashing local changes before pull...');
        }
        await this.git.stash(['push', '-m', 'Git sync: temporary stash']);
        stashed = true;
      }

      // Step 4: Pull remote changes first
      try {
        const localRef = await this.git.revparse(['HEAD']);
        const remoteRef = await this.git.revparse([`origin/${this.options.branch}`]);

        if (localRef !== remoteRef) {
          if (this.options.debug) {
            console.log('[Git Sync] Pulling remote changes...');
          }

          const pullOptions = ['pull', 'origin', this.options.branch];

          // Add conflict resolution strategy
          if (this.options.conflictResolution !== 'manual') {
            pullOptions.push(
              '--rebase=false',
              '--strategy=recursive',
              `--strategy-option=${this.options.conflictResolution}`
            );
          } else {
            pullOptions.push('--rebase=false');
          }

          await this.git.raw(pullOptions);
        }
      } catch (error) {
        if (this.options.debug) {
          console.log('[Git Sync] No remote branch found or pull error:', error);
        }
      }

      // Step 5: Apply stashed changes back
      if (stashed) {
        if (this.options.debug) {
          console.log('[Git Sync] Applying stashed changes...');
        }
        try {
          await this.git.stash(['pop']);
        } catch (error: any) {
          // Check if the error is about no stash entries
          if (error.message?.includes('No stash entries found')) {
            if (this.options.debug) {
              console.log('[Git Sync] No stash entries to pop, continuing...');
            }
            // This is not an error - it means the stash was already applied or didn't exist
          } else if (error.message?.includes('conflict')) {
            console.error('[Git Sync] Conflict when applying stashed changes. Manual resolution required.');
            throw new GitOperationError(
              ErrorCode.GIT_MERGE_CONFLICT,
              'Conflict when applying local changes after pull',
              { branch: this.options.branch },
              false
            );
          } else {
            // Re-throw other errors
            throw error;
          }
        }
      }

      // Step 6: Now handle local changes (after pull)
      const statusAfterPull = await this.git.status();
      const hasLocalChangesAfterPull = statusAfterPull.files.length > 0;
      let shouldPush = false;

      if (hasLocalChangesAfterPull) {
        // Validate MDX files if enabled
        if (this.mdxValidator && this.options.validateBeforeCommit) {
          const filesToValidate = statusAfterPull.files
            .filter(file => file.path.endsWith('.md') || file.path.endsWith('.mdx'))
            .map(file => file.path);

          if (filesToValidate.length > 0) {
            if (this.options.debug) {
              console.log(`[Git Sync] Validating ${filesToValidate.length} MDX files before commit...`);
            }

            const validation = await this.mdxValidator.validateFiles(filesToValidate);

            if (!validation.valid) {
              if (this.options.skipInvalidFiles) {
                // Remove invalid files from staging
                for (const error of validation.errors) {
                  await this.git.reset(['HEAD', error.file]);
                  console.warn(`[Git Sync] Skipping invalid file: ${error.file} - ${error.error}`);
                }

                // Check if we still have files to commit
                const newStatus = await this.git.status();
                if (newStatus.files.length === 0) {
                  if (this.options.debug) {
                    console.log('[Git Sync] No valid files to commit after validation');
                  }
                  // Continue with the sync process even if no files to commit
                } else {
                  if (this.options.debug) {
                    console.log(`[Git Sync] Found ${newStatus.files.length} valid files, committing...`);
                  }

                  // Check for placeholder files before committing
                  if (await this.hasPlaceholderFiles(newStatus.files.map(f => f.path))) {
                    console.log('[Git Sync] Skipping commit: Placeholder files detected');
                  } else {
                    await this.git.add('.');
                    await this.git.commit(this.options.commitMessage);
                    shouldPush = true;
                  }
                }
              } else {
                // Fail the entire operation
                const errorMessages = validation.errors
                  .map(e => `${e.file}: ${e.error}`)
                  .join('\n');
                throw new Error(`MDX validation failed:\n${errorMessages}`);
              }
            } else {
              if (this.options.debug) {
                console.log(`[Git Sync] All ${filesToValidate.length} MDX files validated successfully`);
              }

              // Check for placeholder files before committing
              if (await this.hasPlaceholderFiles(statusAfterPull.files.map(f => f.path))) {
                console.log('[Git Sync] Skipping commit: Placeholder files detected');
              } else {
                await this.git.add('.');
                await this.git.commit(this.options.commitMessage);
                shouldPush = true;
              }
            }
          } else {
            // No MDX files to validate
            if (this.options.debug) {
              console.log(`[Git Sync] Found ${statusAfterPull.files.length} local changes, committing...`);
            }

            // Check for placeholder files before committing
            if (await this.hasPlaceholderFiles(statusAfterPull.files.map(f => f.path))) {
              console.log('[Git Sync] Skipping commit: Placeholder files detected');
            } else {
              await this.git.add('.');
              await this.git.commit(this.options.commitMessage);
              shouldPush = true;
            }
          }
        } else {
          // Validation not enabled
          if (this.options.debug) {
            console.log(`[Git Sync] Found ${statusAfterPull.files.length} local changes, committing...`);
          }

          // Check for placeholder files before committing
          if (await this.hasPlaceholderFiles(statusAfterPull.files.map(f => f.path))) {
            console.log('[Git Sync] Skipping commit: Placeholder files detected');
          } else {
            await this.git.add('.');
            await this.git.commit(this.options.commitMessage);
            shouldPush = true;
          }
        }
      }

      // Step 7: Push to remote if we have commits
      if (shouldPush) {
        await this.git.push(['--set-upstream', 'origin', this.options.branch]);
      }

      if (this.options.debug) {
        console.log('[Git Sync] Git operations completed successfully');
        console.log('[Git Sync] Note: Any MDX/Markdown compilation errors are from Docusaurus, not Git Sync');
      }
    } catch (error) {
      console.error('[Git Sync] Error during sync:', error);
      throw error;
    }
  }

  startScheduler(): void {
    if (this.isDisabled) {
      if (this.options.debug) {
        console.log('[Git Sync] Scheduler not started - sync is disabled');
      }
      return;
    }
    
    if (this.cronJob) {
      return;
    }

    this.cronJob = cron.schedule(this.options.syncInterval, async () => {
      await this.performSync();
    });

    if (this.options.debug) {
      console.log(`[Git Sync] Scheduler started with interval: ${this.options.syncInterval}`);
    }
  }

  startWebhookServer(): void {
    if (this.isDisabled) {
      if (this.options.debug) {
        console.log('[Git Sync] Webhook server not started - sync is disabled');
      }
      return;
    }
    
    if (!this.options.enableWebhook || this.webhookServer) {
      return;
    }

    const credentials = this.credentialManager.getCredentials();
    
    // Prepare HTTPS options if enabled
    const httpsOptions = this.options.webhookHttps ? {
      keyPath: this.options.webhookHttpsKeyPath,
      certPath: this.options.webhookHttpsCertPath,
      key: this.options.webhookHttpsKey,
      cert: this.options.webhookHttpsCert,
    } : undefined;

    this.webhookServer = new WebhookServer({
      port: this.options.webhookPort,
      secret: credentials.webhookSecret || '',
      onWebhook: async (payload: WebhookPayload) => {
        if (this.options.debug) {
          console.log('[Git Sync] Webhook received:', {
            provider: payload.provider,
            event: payload.event,
            branch: payload.branch,
            commits: payload.commits?.length || 0,
          });
        }
        await this.performSync();
      },
      debug: this.options.debug,
      enableHttps: this.options.webhookHttps,
      httpsOptions,
      filterOptions: this.options.webhookFilters,
    });

    this.webhookServer.start();
  }

  async getStatus(): Promise<any> {
    const gitStatus = await this.git.status();
    const remotes = await this.git.getRemotes(true);
    const branch = await this.git.branch();

    // Use credential manager to mask sensitive data
    const safeRemotes = CredentialManager.maskSensitiveData(remotes);

    return CredentialManager.maskSensitiveData({
      gitStatus,
      remotes: safeRemotes,
      currentBranch: branch.current,
      syncState: this.state,
      options: {
        remoteRepository: this.options.remoteRepository,
        branch: this.options.branch,
        syncDirection: this.options.syncDirection,
        syncInterval: this.options.syncInterval,
        authMethod: this.options.authMethod,
      },
    });
  }

  /**
   * Check if any of the given files contain placeholder markers
   */
  private async hasPlaceholderFiles(files: string[]): Promise<boolean> {
    const mdxFiles = files.filter(file => file.endsWith('.md') || file.endsWith('.mdx'));

    for (const file of mdxFiles) {
      const filePath = path.join(this.contentDir, file);
      if (fsSync.existsSync(filePath)) {
        const content = fsSync.readFileSync(filePath, 'utf-8');
        if (content.includes('DOCUSAURUS_PLACEHOLDER_DO_NOT_COMMIT')) {
          console.warn(`[Git Sync] Found placeholder file: ${file}`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check all tracked files for placeholder markers
   */
  private async hasAnyPlaceholderFiles(): Promise<boolean> {
    try {
      const status = await this.git.status();
      const allFiles = status.files.map(f => f.path);

      // Also check unmodified tracked files
      const trackedFiles = await this.git.raw(['ls-files']);
      const trackedFilesList = trackedFiles.split('\n').filter(f => f);

      const filesToCheck = [...new Set([...allFiles, ...trackedFilesList])];
      const mdxFiles = filesToCheck.filter(file => file.endsWith('.md') || file.endsWith('.mdx'));

      for (const file of mdxFiles) {
        const filePath = path.join(this.contentDir, file);
        if (fsSync.existsSync(filePath)) {
          const content = fsSync.readFileSync(filePath, 'utf-8');
          if (content.includes('DOCUSAURUS_PLACEHOLDER_DO_NOT_COMMIT')) {
            console.warn(`[Git Sync] Found placeholder file: ${file}`);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[Git Sync] Error checking for placeholder files:', error);
      return false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.webhookServer) {
      await this.webhookServer.stop();
      this.webhookServer = null;
    }

    // Clear sync queues
    this.syncQueue.clear();
    this.debouncedQueue.clear();

    // Clear credentials from memory
    this.credentialManager.clearCredentials();
  }
}
