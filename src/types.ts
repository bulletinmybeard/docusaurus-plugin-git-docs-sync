export interface PluginOptions {
  remoteRepository: string;
  branch?: string;
  syncDirection?: 'push' | 'pull' | 'sync';
  syncInterval?: string;
  contentPath?: string;
  commitMessage?: string;
  authorName?: string;
  authorEmail?: string;
  ignorePatterns?: string[];
  enableWebhook?: boolean;
  webhookPort?: number;
  webhookSecret?: string;
  conflictResolution?: 'ours' | 'theirs' | 'manual';
  debug?: boolean;
  // Authentication options
  authMethod?: 'token' | 'none';
  githubToken?: string;
  githubUsername?: string;
  // Validation options
  validateBeforeCommit?: boolean;
  skipInvalidFiles?: boolean;
  validateBeforeCompile?: boolean;
  placeholderRestorationDelay?: number;
  // Security options
  encryptionKey?: string;
  // Enhanced webhook options
  webhookHttps?: boolean;
  webhookHttpsKey?: string;
  webhookHttpsCert?: string;
  webhookHttpsKeyPath?: string;
  webhookHttpsCertPath?: string;
  webhookFilters?: {
    branches?: string[];
    events?: string[];
    paths?: string[];
  };
}

export interface GitSyncState {
  lastSyncTime: Date | null;
  isSyncing: boolean;
  syncErrors: Error[];
}