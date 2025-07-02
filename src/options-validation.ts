import type { PluginOptions } from './types';
import { CredentialManager } from './credential-manager';
import { validateOptionsEnhanced, DEFAULT_OPTIONS } from './validation-unified';

export function validateOptions(options: Partial<PluginOptions>): Required<PluginOptions> {
  // Perform enhanced validation first
  validateOptionsEnhanced(options);
  
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Validate credentials using CredentialManager
  const credentialErrors = CredentialManager.validateCredentials(mergedOptions);
  if (credentialErrors.length > 0) {
    throw new Error(`docusaurus-plugin-git-sync: ${credentialErrors.join(', ')}`);
  }
  
  // Ensure all required fields are present
  return {
    remoteRepository: mergedOptions.remoteRepository!,
    branch: mergedOptions.branch || 'main',
    syncDirection: mergedOptions.syncDirection || 'sync',
    syncInterval: mergedOptions.syncInterval || '*/5 * * * *',
    contentPath: mergedOptions.contentPath || 'docs',
    commitMessage: mergedOptions.commitMessage || 'docs: sync content from Docusaurus',
    authorName: mergedOptions.authorName || 'Docusaurus Git Sync',
    authorEmail: mergedOptions.authorEmail || 'noreply@docusaurus.io',
    ignorePatterns: mergedOptions.ignorePatterns || ['.git', 'node_modules', '.docusaurus', 'build'],
    enableWebhook: mergedOptions.enableWebhook || false,
    webhookPort: mergedOptions.webhookPort || 3001,
    webhookSecret: mergedOptions.webhookSecret || '',
    conflictResolution: mergedOptions.conflictResolution || 'ours',
    debug: mergedOptions.debug || false,
    authMethod: mergedOptions.authMethod || 'none',
    githubToken: mergedOptions.githubToken || '',
    githubUsername: mergedOptions.githubUsername || '',
    validateBeforeCommit: mergedOptions.validateBeforeCommit || false,
    skipInvalidFiles: mergedOptions.skipInvalidFiles !== undefined ? mergedOptions.skipInvalidFiles : true,
    validateBeforeCompile: mergedOptions.validateBeforeCompile !== undefined ? mergedOptions.validateBeforeCompile : true,
    placeholderRestorationDelay: mergedOptions.placeholderRestorationDelay || 5000,
    encryptionKey: mergedOptions.encryptionKey || '',
    // Enhanced webhook options
    webhookHttps: mergedOptions.webhookHttps || false,
    webhookHttpsKey: mergedOptions.webhookHttpsKey || '',
    webhookHttpsCert: mergedOptions.webhookHttpsCert || '',
    webhookHttpsKeyPath: mergedOptions.webhookHttpsKeyPath || '',
    webhookHttpsCertPath: mergedOptions.webhookHttpsCertPath || '',
    webhookFilters: mergedOptions.webhookFilters!,
  };
}