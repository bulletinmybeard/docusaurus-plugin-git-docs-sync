import { ValidationUtils, validateOptionsEnhanced } from '../validation-unified';
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

  describe('isValidPort', () => {
    it('should validate valid port numbers', () => {
      expect(ValidationUtils.isValidPort(80)).toBe(true);
      expect(ValidationUtils.isValidPort(3000)).toBe(true);
      expect(ValidationUtils.isValidPort(65535)).toBe(true);
    });

    it('should reject invalid port numbers', () => {
      expect(ValidationUtils.isValidPort(0)).toBe(false);
      expect(ValidationUtils.isValidPort(65536)).toBe(false);
      expect(ValidationUtils.isValidPort(-1)).toBe(false);
      expect(ValidationUtils.isValidPort(3.14)).toBe(false);
    });
  });

  describe('isValidBranchName', () => {
    it('should validate valid branch names', () => {
      expect(ValidationUtils.isValidBranchName('main')).toBe(true);
      expect(ValidationUtils.isValidBranchName('feature/new-feature')).toBe(true);
      expect(ValidationUtils.isValidBranchName('release-1.0.0')).toBe(true);
    });

    it('should reject invalid branch names', () => {
      expect(ValidationUtils.isValidBranchName('.branch')).toBe(false);
      expect(ValidationUtils.isValidBranchName('branch.')).toBe(false);
      expect(ValidationUtils.isValidBranchName('branch..name')).toBe(false);
      expect(ValidationUtils.isValidBranchName('branch//name')).toBe(false);
      expect(ValidationUtils.isValidBranchName('branch~name')).toBe(false);
      expect(ValidationUtils.isValidBranchName('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate valid email addresses', () => {
      expect(ValidationUtils.isValidEmail('user@example.com')).toBe(true);
      expect(ValidationUtils.isValidEmail('test.user@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(ValidationUtils.isValidEmail('notanemail')).toBe(false);
      expect(ValidationUtils.isValidEmail('@example.com')).toBe(false);
      expect(ValidationUtils.isValidEmail('user@')).toBe(false);
    });
  });

  describe('sanitizePath', () => {
    it('should remove directory traversal attempts', () => {
      expect(ValidationUtils.sanitizePath('docs/../../../etc/passwd')).toBe('docs/etc/passwd');
      expect(ValidationUtils.sanitizePath('./docs/./content')).toBe('docs/content');
      expect(ValidationUtils.sanitizePath('docs/content')).toBe('docs/content');
    });
  });

  describe('isStrongWebhookSecret', () => {
    it('should validate strong webhook secrets', () => {
      expect(ValidationUtils.isStrongWebhookSecret('abcd1234efgh5678')).toBe(true);
      expect(ValidationUtils.isStrongWebhookSecret('MySecureWebhook123')).toBe(true);
    });

    it('should reject weak webhook secrets', () => {
      expect(ValidationUtils.isStrongWebhookSecret('short')).toBe(false);
      expect(ValidationUtils.isStrongWebhookSecret('onlyletters')).toBe(false);
      expect(ValidationUtils.isStrongWebhookSecret('12345678901234567')).toBe(false);
    });
  });
});

describe('validateOptionsEnhanced', () => {
  it('should validate required fields', () => {
    const options: Partial<PluginOptions> = {};

    expect(() => validateOptionsEnhanced(options)).toThrow(ConfigurationError);
    expect(() => validateOptionsEnhanced(options)).toThrow('remoteRepository is required');
  });

  it('should validate URL format', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'not-a-valid-url',
    };

    expect(() => validateOptionsEnhanced(options)).toThrow('remoteRepository must be a valid Git URL');
  });

  it('should validate sync direction', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
      syncDirection: 'invalid' as any,
    };

    expect(() => validateOptionsEnhanced(options)).toThrow('syncDirection must be one of: push, pull, sync');
  });

  it('should sanitize paths', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
      contentPath: '../../../etc/passwd',
    };

    validateOptionsEnhanced(options);
    expect(options.contentPath).toBe('etc/passwd');
  });

  it('should pass validation with valid options', () => {
    const options: Partial<PluginOptions> = {
      remoteRepository: 'https://github.com/user/repo.git',
      branch: 'main',
      syncDirection: 'sync',
      syncInterval: '*/5 * * * *',
      contentPath: 'docs',
      authorEmail: 'test@example.com',
      webhookPort: 3001,
      conflictResolution: 'ours',
      authMethod: 'token',
    };

    expect(() => validateOptionsEnhanced(options)).not.toThrow();
  });
});
