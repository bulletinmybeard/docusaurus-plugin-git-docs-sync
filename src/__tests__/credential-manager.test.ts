import { CredentialManager } from '../credential-manager';
import { PluginOptions } from '../types';

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;

  beforeEach(() => {
    credentialManager = new CredentialManager();
  });

  afterEach(() => {
    credentialManager.clearCredentials();
  });

  describe('storeCredentials', () => {
    it('should store and retrieve credentials securely', () => {
      const options: Partial<PluginOptions> = {
        githubToken: 'ghp_testtoken123456789',
        githubUsername: 'testuser',
        webhookSecret: 'webhook-secret-123',
      };

      credentialManager.storeCredentials(options);
      const retrieved = credentialManager.getCredentials();

      expect(retrieved.githubToken).toBe('ghp_testtoken123456789');
      expect(retrieved.githubUsername).toBe('testuser');
      expect(retrieved.webhookSecret).toBe('webhook-secret-123');
    });

    it('should handle missing credentials gracefully', () => {
      const options: Partial<PluginOptions> = {};

      credentialManager.storeCredentials(options);
      const retrieved = credentialManager.getCredentials();

      expect(retrieved.githubToken).toBeUndefined();
      expect(retrieved.githubUsername).toBeUndefined();
      expect(retrieved.webhookSecret).toBeUndefined();
    });
  });

  describe('getAuthenticatedUrl', () => {
    beforeEach(() => {
      const options: Partial<PluginOptions> = {
        githubToken: 'ghp_testtoken123',
        githubUsername: 'testuser',
      };
      credentialManager.storeCredentials(options);
    });

    it('should add authentication to GitHub HTTPS URLs', () => {
      const url = 'https://github.com/user/repo.git';
      const authUrl = credentialManager.getAuthenticatedUrl(url, 'token');

      expect(authUrl).toBe('https://testuser:ghp_testtoken123@github.com/user/repo.git');
    });


    it('should return original URL when auth method is none', () => {
      const url = 'https://github.com/user/repo.git';
      const authUrl = credentialManager.getAuthenticatedUrl(url, 'none');

      expect(authUrl).toBe(url);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask tokens in URLs', () => {
      const data = 'https://user:token123@github.com/repo.git';
      const masked = CredentialManager.maskSensitiveData(data);

      expect(masked).toBe('https://***:***@github.com/repo.git');
    });

    it('should mask GitHub personal access tokens', () => {
      const data = 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const masked = CredentialManager.maskSensitiveData(data);

      expect(masked).toContain('ghp_***');
    });

    it('should mask sensitive fields in objects', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        token: 'mytoken',
        apiKey: 'key123',
        normal: 'visible',
      };
      const masked = CredentialManager.maskSensitiveData(data);

      expect(masked.username).toBe('testuser');
      expect(masked.password).toBe('***');
      expect(masked.token).toBe('***');
      expect(masked.apiKey).toBe('***');
      expect(masked.normal).toBe('visible');
    });

    it('should handle nested objects', () => {
      const data = {
        config: {
          auth: {
            token: 'secret',
            username: 'user',
          },
        },
      };
      const masked = CredentialManager.maskSensitiveData(data);

      expect(masked.config.auth.token).toBe('***');
      expect(masked.config.auth.username).toBe('user');
    });
  });

  describe('validateCredentials', () => {
    it('should validate token authentication requirements', () => {
      const options: PluginOptions = {
        remoteRepository: 'https://github.com/user/repo.git',
        authMethod: 'token',
      } as PluginOptions;

      const errors = CredentialManager.validateCredentials(options);

      expect(errors).toContain('githubToken is required when authMethod is "token"');
      expect(errors).toContain('githubUsername is required when authMethod is "token"');
    });


    it('should validate webhook secret requirement', () => {
      const options: PluginOptions = {
        remoteRepository: 'https://github.com/user/repo.git',
        enableWebhook: true,
      } as PluginOptions;

      const errors = CredentialManager.validateCredentials(options);

      expect(errors).toContain('webhookSecret is required when enableWebhook is true');
    });

    it('should pass validation with proper credentials', () => {
      const options: PluginOptions = {
        remoteRepository: 'https://github.com/user/repo.git',
        authMethod: 'token',
        githubToken: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123',
        githubUsername: 'testuser',
      } as PluginOptions;

      const errors = CredentialManager.validateCredentials(options);

      expect(errors).toHaveLength(0);
    });
  });

  describe('clearCredentials', () => {
    it('should clear all stored credentials', () => {
      const options: Partial<PluginOptions> = {
        githubToken: 'token123',
        githubUsername: 'user123',
      };

      credentialManager.storeCredentials(options);
      credentialManager.clearCredentials();
      const retrieved = credentialManager.getCredentials();

      expect(retrieved.githubToken).toBeUndefined();
      expect(retrieved.githubUsername).toBeUndefined();
    });
  });
});
