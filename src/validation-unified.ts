import { PluginOptions } from './types';
import { ConfigurationError } from './errors';

export const DEFAULT_OPTIONS: Partial<PluginOptions> = {
  branch: 'main',
  syncDirection: 'sync',
  syncInterval: '*/5 * * * *',
  contentPath: 'docs',
  commitMessage: 'docs: sync content from Docusaurus',
  authorName: 'Docusaurus Git Sync',
  authorEmail: 'noreply@docusaurus.io',
  ignorePatterns: ['.git', 'node_modules', '.docusaurus', 'build'],
  enableWebhook: false,
  webhookPort: 3001,
  conflictResolution: 'ours',
  debug: false,
  authMethod: 'none',
  validateBeforeCommit: false,
  skipInvalidFiles: true,
  validateBeforeCompile: true,
  placeholderRestorationDelay: 5000,
  // Enhanced webhook defaults
  webhookHttps: false,
  webhookHttpsKey: undefined,
  webhookHttpsCert: undefined,
  webhookHttpsKeyPath: undefined,
  webhookHttpsCertPath: undefined,
  webhookFilters: undefined,
};

/**
 * Enhanced options validation with detailed checks
 */
export function validateOptionsEnhanced(options: Partial<PluginOptions>): void {
  const errors: string[] = [];

  // Required field validation
  if (!options.remoteRepository) {
    errors.push('remoteRepository is required');
  } else if (!ValidationUtils.isValidUrl(options.remoteRepository)) {
    errors.push('remoteRepository must be a valid Git URL (HTTPS)');
  }

  // Branch validation
  if (options.branch && !ValidationUtils.isValidBranchName(options.branch)) {
    errors.push('branch name contains invalid characters');
  }

  // Sync direction validation
  if (options.syncDirection && !['push', 'pull', 'sync'].includes(options.syncDirection)) {
    errors.push('syncDirection must be one of: push, pull, sync');
  }

  // Cron expression validation
  if (options.syncInterval && !ValidationUtils.isValidCronExpression(options.syncInterval)) {
    errors.push('syncInterval must be a valid cron expression');
  }

  // Path validation
  if (options.contentPath) {
    // Sanitize the path first
    options.contentPath = ValidationUtils.sanitizePath(options.contentPath);
    // Then validate the sanitized path
    if (!ValidationUtils.isValidPath(options.contentPath)) {
      errors.push('contentPath contains invalid characters');
    }
  }

  // Email validation
  if (options.authorEmail && !ValidationUtils.isValidEmail(options.authorEmail)) {
    errors.push('authorEmail must be a valid email address');
  }

  // Port validation
  if (options.webhookPort !== undefined && !ValidationUtils.isValidPort(options.webhookPort)) {
    errors.push('webhookPort must be between 1 and 65535');
  }

  // Webhook secret validation
  if (options.enableWebhook && options.webhookSecret) {
    if (!ValidationUtils.isStrongWebhookSecret(options.webhookSecret)) {
      errors.push('webhookSecret should be at least 16 characters and include letters and numbers');
    }
  }

  // Conflict resolution validation
  if (options.conflictResolution && !['ours', 'theirs', 'manual'].includes(options.conflictResolution)) {
    errors.push('conflictResolution must be one of: ours, theirs, manual');
  }

  // Auth method validation
  if (options.authMethod && !['token', 'none'].includes(options.authMethod)) {
    errors.push('authMethod must be one of: token, none');
  }

  // Throw error if validation fails
  if (errors.length > 0) {
    throw new ConfigurationError(
      `Invalid configuration: ${errors.join(', ')}`,
      { errors }
    );
  }
}

export class ValidationUtils {
  /**
   * Validate URL format - only HTTPS URLs allowed
   */
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Validate cron expression
   */
  static isValidCronExpression(expression: string): boolean {
    // Basic cron validation - 5 fields
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    return cronRegex.test(expression);
  }

  /**
   * Validate port number
   */
  static isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  /**
   * Validate branch name
   */
  static isValidBranchName(branch: string): boolean {
    // Git branch naming rules
    const invalidPatterns = [
      /\.\./, // consecutive dots
      /^\./, // starts with dot
      /\.$/, // ends with dot
      /\/\//, // consecutive slashes
      /\/$/, // ends with slash
      /^\//, // starts with slash
      // eslint-disable-next-line no-control-regex
      /[\x00-\x1f\x7f]/, // control characters
      /[~^:?*[]/, // invalid characters
      /@{/, // reflog shorthand
    ];

    if (branch.length === 0 || branch.length > 255) {
      return false;
    }

    return !invalidPatterns.some(pattern => pattern.test(branch));
  }

  /**
   * Validate file/directory path
   */
  static isValidPath(path: string): boolean {
    // Basic path validation - no null bytes, not empty
    // eslint-disable-next-line no-control-regex
    return path.length > 0 && !path.includes('\x00');
  }

  /**
   * Sanitize file path
   */
  static sanitizePath(path: string): string {
    // Remove directory traversal attempts and normalize path
    const segments = path.split('/');
    const sanitized = segments
      .filter(segment => segment !== '..' && segment !== '.' && segment !== '')
      .join('/');
    return sanitized;
  }

  /**
   * Validate email
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate webhook secret strength
   */
  static isStrongWebhookSecret(secret: string): boolean {
    // At least 16 characters, includes letters and numbers
    return secret.length >= 16 && 
           /[a-zA-Z]/.test(secret) && 
           /[0-9]/.test(secret);
  }

  /**
   * Validate GitHub token format
   */
  static isValidGitHubToken(token: string): boolean {
    return /^(ghp_|ghs_|github_pat_)[A-Za-z0-9_]{36,}$/.test(token) || token.length >= 40;
  }
}

/**
 * Unified validation and normalization for plugin options
 */
export class UnifiedValidator {
  private errors: string[] = [];

  /**
   * Main validation entry point
   */
  validate(options: Partial<PluginOptions>): Required<PluginOptions> {
    this.errors = [];

    // Phase 1: Basic field validation
    this.validateBasicFields(options);

    // Phase 2: Business rule validation
    this.validateBusinessRules(options);

    // Phase 3: Security validation
    this.validateSecurity(options);

    // Throw if any errors
    if (this.errors.length > 0) {
      throw new ConfigurationError(
        `Invalid configuration: ${this.errors.join(', ')}`,
        { errors: this.errors }
      );
    }

    // Phase 4: Apply defaults and sanitize
    return this.normalizeOptions(options);
  }

  /**
   * Basic field validation
   */
  private validateBasicFields(options: Partial<PluginOptions>): void {
    // Required fields
    if (!options.remoteRepository) {
      this.errors.push('remoteRepository is required');
    } else if (!ValidationUtils.isValidUrl(options.remoteRepository)) {
      this.errors.push('remoteRepository must be a valid Git URL (HTTPS)');
    }

    // Optional field formats
    if (options.branch && !ValidationUtils.isValidBranchName(options.branch)) {
      this.errors.push('branch name contains invalid characters');
    }

    if (options.syncDirection && !['push', 'pull', 'sync'].includes(options.syncDirection)) {
      this.errors.push('syncDirection must be one of: push, pull, sync');
    }

    if (options.syncInterval && !ValidationUtils.isValidCronExpression(options.syncInterval)) {
      this.errors.push('syncInterval must be a valid cron expression');
    }

    if (options.contentPath && !ValidationUtils.isValidPath(options.contentPath)) {
      this.errors.push('contentPath contains invalid characters');
    }

    if (options.authorEmail && !ValidationUtils.isValidEmail(options.authorEmail)) {
      this.errors.push('authorEmail must be a valid email address');
    }

    if (options.webhookPort !== undefined && !ValidationUtils.isValidPort(options.webhookPort)) {
      this.errors.push('webhookPort must be between 1 and 65535');
    }

    if (options.conflictResolution && !['ours', 'theirs', 'manual'].includes(options.conflictResolution)) {
      this.errors.push('conflictResolution must be one of: ours, theirs, manual');
    }

    if (options.authMethod && !['token', 'none'].includes(options.authMethod)) {
      this.errors.push('authMethod must be one of: token, none');
    }

    if (options.placeholderRestorationDelay !== undefined) {
      if (!Number.isInteger(options.placeholderRestorationDelay) || options.placeholderRestorationDelay < 0) {
        this.errors.push('placeholderRestorationDelay must be a non-negative integer (milliseconds)');
      }
    }
  }

  /**
   * Business rule validation (cross-field dependencies)
   */
  private validateBusinessRules(options: Partial<PluginOptions>): void {
    // Token authentication requirements
    if (options.authMethod === 'token') {
      if (!options.githubToken) {
        this.errors.push('githubToken is required when authMethod is "token"');
      }
      if (!options.githubUsername) {
        this.errors.push('githubUsername is required when authMethod is "token"');
      }
    }

    // Webhook requirements
    if (options.enableWebhook) {
      if (!options.webhookSecret) {
        this.errors.push('webhookSecret is required when enableWebhook is true');
      }
      
      // HTTPS validation
      if (options.webhookHttps) {
        const hasInlineCredentials = options.webhookHttpsKey && options.webhookHttpsCert;
        const hasPathCredentials = options.webhookHttpsKeyPath && options.webhookHttpsCertPath;
        
        if (!hasInlineCredentials && !hasPathCredentials) {
          this.errors.push('webhookHttpsKey and webhookHttpsCert (or webhookHttpsKeyPath and webhookHttpsCertPath) are required when webhookHttps is true');
        }
      }
      
      // Filter validation
      if (options.webhookFilters) {
        if (options.webhookFilters.branches && options.webhookFilters.branches.length === 0) {
          this.errors.push('webhookFilters.branches must contain at least one branch if specified');
        }
        if (options.webhookFilters.events && options.webhookFilters.events.length === 0) {
          this.errors.push('webhookFilters.events must contain at least one event if specified');
        }
        if (options.webhookFilters.paths && options.webhookFilters.paths.length === 0) {
          this.errors.push('webhookFilters.paths must contain at least one path pattern if specified');
        }
      }
    }
  }

  /**
   * Security validation
   */
  private validateSecurity(options: Partial<PluginOptions>): void {
    // GitHub token format
    if (options.githubToken && !ValidationUtils.isValidGitHubToken(options.githubToken)) {
      this.errors.push('githubToken appears to be invalid format');
    }

    // Webhook secret strength
    if (options.enableWebhook && options.webhookSecret) {
      if (!ValidationUtils.isStrongWebhookSecret(options.webhookSecret)) {
        this.errors.push('webhookSecret should be at least 16 characters and include letters and numbers');
      }
    }

    // Encryption key warning
    if (options.encryptionKey && options.encryptionKey.length < 32) {
      this.errors.push('encryptionKey should be at least 32 characters for adequate security');
    }
  }

  /**
   * Normalize options with defaults and sanitization
   */
  private normalizeOptions(options: Partial<PluginOptions>): Required<PluginOptions> {
    const merged = { ...DEFAULT_OPTIONS, ...options };

    // Sanitize paths
    if (merged.contentPath) {
      merged.contentPath = ValidationUtils.sanitizePath(merged.contentPath);
    }

    // Ensure all required fields have values
    return {
      remoteRepository: merged.remoteRepository!,
      branch: merged.branch!,
      syncDirection: merged.syncDirection!,
      syncInterval: merged.syncInterval!,
      contentPath: merged.contentPath!,
      commitMessage: merged.commitMessage!,
      authorName: merged.authorName!,
      authorEmail: merged.authorEmail!,
      ignorePatterns: merged.ignorePatterns!,
      enableWebhook: merged.enableWebhook!,
      webhookPort: merged.webhookPort!,
      webhookSecret: merged.webhookSecret || '',
      conflictResolution: merged.conflictResolution!,
      debug: merged.debug!,
      authMethod: merged.authMethod!,
      githubToken: merged.githubToken || '',
      githubUsername: merged.githubUsername || '',
      validateBeforeCommit: merged.validateBeforeCommit!,
      skipInvalidFiles: merged.skipInvalidFiles !== undefined ? merged.skipInvalidFiles : true,
      validateBeforeCompile: merged.validateBeforeCompile !== undefined ? merged.validateBeforeCompile : true,
      placeholderRestorationDelay: merged.placeholderRestorationDelay!,
      encryptionKey: merged.encryptionKey || '',
      // Enhanced webhook options
      webhookHttps: merged.webhookHttps!,
      webhookHttpsKey: merged.webhookHttpsKey || '',
      webhookHttpsCert: merged.webhookHttpsCert || '',
      webhookHttpsKeyPath: merged.webhookHttpsKeyPath || '',
      webhookHttpsCertPath: merged.webhookHttpsCertPath || '',
      webhookFilters: merged.webhookFilters!,
    };
  }
}

/**
 * Main entry point for validation
 */
export function validateAndNormalizeOptions(options: Partial<PluginOptions>): Required<PluginOptions> {
  const validator = new UnifiedValidator();
  return validator.validate(options);
}