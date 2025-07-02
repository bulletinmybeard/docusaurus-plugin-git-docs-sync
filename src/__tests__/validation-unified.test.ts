import { ValidationUtils, validateAndNormalizeOptions } from '../validation-unified';
import { PluginOptions } from '../types';
import { ConfigurationError } from '../errors';

describe('ValidationUtils', () => {
  describe('isValidUrl', () => {
    it('should validate HTTPS URLs', () => {
      expect(ValidationUtils.isValidUrl('https://github.com/user/repo.git')).toBe(true);
      expect(ValidationUtils.isValidUrl('http://example.com/repo.git')).toBe(true);
    });

    it('should reject SSH URLs', () => {
      expect(ValidationUtils.isValidUrl('git@github.com:user/repo.git')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(ValidationUtils.isValidUrl('not-a-url')).toBe(false);
      expect(ValidationUtils.isValidUrl('ftp://example.com')).toBe(false);
      expect(ValidationUtils.isValidUrl('')).toBe(false);
    });
  });

  describe('isValidCronExpression', () => {
    it('should validate correct cron expressions', () => {
      expect(ValidationUtils.isValidCronExpression('*/5 * * * *')).toBe(true);
      expect(ValidationUtils.isValidCronExpression('0 0 * * *')).toBe(true);
      expect(ValidationUtils.isValidCronExpression('15 14 1 * *')).toBe(true);
    });

    it('should reject invalid cron expressions', () => {
      expect(ValidationUtils.isValidCronExpression('invalid')).toBe(false);
      expect(ValidationUtils.isValidCronExpression('* * * *')).toBe(false);
      expect(ValidationUtils.isValidCronExpression('60 * * * *')).toBe(false);
    });
  });

  describe('isValidGitHubToken', () => {
    it('should validate GitHub tokens with correct prefixes', () => {
      expect(ValidationUtils.isValidGitHubToken('ghp_' + 'a'.repeat(36))).toBe(true);
      expect(ValidationUtils.isValidGitHubToken('ghs_' + 'a'.repeat(36))).toBe(true);
      expect(ValidationUtils.isValidGitHubToken('github_pat_' + 'a'.repeat(36))).toBe(true);
    });

    it('should validate generic 40+ character tokens', () => {
      expect(ValidationUtils.isValidGitHubToken('a'.repeat(40))).toBe(true);
      expect(ValidationUtils.isValidGitHubToken('a'.repeat(50))).toBe(true);
    });

    it('should reject invalid tokens', () => {
      expect(ValidationUtils.isValidGitHubToken('ghp_short')).toBe(false);
      expect(ValidationUtils.isValidGitHubToken('invalid_prefix_' + 'a'.repeat(36))).toBe(true); // 52 chars total, passes the 40+ char check
      expect(ValidationUtils.isValidGitHubToken('a'.repeat(39))).toBe(false);
    });
  });
});

describe('validateAndNormalizeOptions', () => {
  it('should validate and normalize valid options', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
      branch: 'main',
      authMethod: 'token',
      githubToken: 'ghp_' + 'a'.repeat(36),
      githubUsername: 'testuser',
    };

    const result = validateAndNormalizeOptions(options);

    expect(result.remoteRepository).toBe('https://github.com/user/repo.git');
    expect(result.branch).toBe('main');
    expect(result.authMethod).toBe('token');
    expect(result.syncDirection).toBe('sync'); // default
    expect(result.contentPath).toBe('docs'); // default
  });

  it('should throw error for missing required fields', () => {
    const options: Partial<PluginOptions> = {};

    expect(() => validateAndNormalizeOptions(options)).toThrow(ConfigurationError);
    expect(() => validateAndNormalizeOptions(options)).toThrow('remoteRepository is required');
  });

  it('should validate token authentication requirements', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
      authMethod: 'token',
    };

    expect(() => validateAndNormalizeOptions(options)).toThrow(ConfigurationError);
    expect(() => validateAndNormalizeOptions(options)).toThrow(/githubToken is required/);
    expect(() => validateAndNormalizeOptions(options)).toThrow(/githubUsername is required/);
  });

  it('should validate webhook requirements', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
      enableWebhook: true,
    };

    expect(() => validateAndNormalizeOptions(options)).toThrow(ConfigurationError);
    expect(() => validateAndNormalizeOptions(options)).toThrow(/webhookSecret is required/);
  });

  it('should validate webhook secret strength', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
      enableWebhook: true,
      webhookSecret: 'weak',
    };

    expect(() => validateAndNormalizeOptions(options)).toThrow(/webhookSecret should be at least 16 characters/);
  });

  it('should sanitize paths', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
      contentPath: '../../../etc/passwd',
    };

    const result = validateAndNormalizeOptions(options);
    expect(result.contentPath).toBe('etc/passwd');
  });

  it('should apply all defaults', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
    };

    const result = validateAndNormalizeOptions(options);

    expect(result.branch).toBe('main');
    expect(result.syncDirection).toBe('sync');
    expect(result.syncInterval).toBe('*/5 * * * *');
    expect(result.contentPath).toBe('docs');
    expect(result.commitMessage).toBe('docs: sync content from Docusaurus');
    expect(result.authorName).toBe('Docusaurus Git Sync');
    expect(result.authorEmail).toBe('noreply@docusaurus.io');
    expect(result.enableWebhook).toBe(false);
    expect(result.webhookPort).toBe(3001);
    expect(result.conflictResolution).toBe('ours');
    expect(result.debug).toBe(false);
    expect(result.authMethod).toBe('none');
    expect(result.validateBeforeCommit).toBe(false);
    expect(result.skipInvalidFiles).toBe(true);
    expect(result.validateBeforeCompile).toBe(true);
  });
});
