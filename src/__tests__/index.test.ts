import pluginGitSync from '../index';
import { GitSyncManager } from '../git-sync-manager';
import { LoadContext } from '@docusaurus/types';
import { AuthenticationError } from '../errors';

jest.mock('../git-sync-manager');
jest.mock('../validation-unified', () => ({
  validateAndNormalizeOptions: jest.fn((opts) => ({
    remoteRepository: 'https://github.com/test/repo.git',
    branch: 'main',
    syncDirection: 'sync',
    syncInterval: '*/5 * * * *',
    contentPath: 'docs',
    commitMessage: 'docs: sync content',
    authorName: 'Test User',
    authorEmail: 'test@example.com',
    ignorePatterns: [],
    enableWebhook: false,
    webhookPort: 3001,
    webhookSecret: 'test-secret',
    conflictResolution: 'ours',
    debug: true,
    authMethod: 'token',
    githubToken: 'test-token',
    githubUsername: 'testuser',
    validateBeforeCommit: false,
    skipInvalidFiles: true,
    validateBeforeCompile: false,
    placeholderRestorationDelay: 5000,
    encryptionKey: undefined,
    webhookHttps: false,
    webhookHttpsKey: undefined,
    webhookHttpsCert: undefined,
    webhookHttpsKeyPath: undefined,
    webhookHttpsCertPath: undefined,
    webhookFilters: undefined,
    ...opts,
  })),
}));

describe('pluginGitSync', () => {
  let mockContext: LoadContext;
  let mockGitSyncManager: jest.Mocked<GitSyncManager>;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      siteDir: '/test/site',
      siteConfig: {
        title: 'Test Site',
        url: 'https://test.com',
        baseUrl: '/',
        customFields: {},
      },
    } as LoadContext;

    mockGitSyncManager = {
      initialize: jest.fn(),
      performSync: jest.fn(),
      disable: jest.fn(),
      startScheduler: jest.fn(),
      startWebhookServer: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    (GitSyncManager as jest.MockedClass<typeof GitSyncManager>).mockImplementation(
      () => mockGitSyncManager
    );

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('loadContent', () => {
    it('should handle authentication errors gracefully', async () => {
      const authError = new AuthenticationError(
        'Git authentication failed. Please check your credentials.',
        { originalError: 'fatal: Authentication failed' }
      );
      
      mockGitSyncManager.initialize.mockRejectedValueOnce(authError);

      const plugin = pluginGitSync(mockContext, {
        remoteRepository: 'https://github.com/test/repo.git',
      });

      // loadContent should not throw
      await expect(plugin.loadContent!()).resolves.toBeNull();

      // Verify warning messages
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Git Sync] ⚠️  Authentication failed. Git sync will be disabled for this session.'
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Git Sync] ⚠️  Please check your GitHub credentials.'
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Git Sync] ⚠️  Docusaurus will continue with local content only.'
      );

      // Verify GitSyncManager was disabled
      expect(mockGitSyncManager.disable).toHaveBeenCalled();
    });

    it('should handle generic authentication error messages', async () => {
      const error = new Error('Invalid username or password');
      mockGitSyncManager.initialize.mockRejectedValueOnce(error);

      const plugin = pluginGitSync(mockContext, {
        remoteRepository: 'https://github.com/test/repo.git',
      });

      await expect(plugin.loadContent!()).resolves.toBeNull();
      expect(mockGitSyncManager.disable).toHaveBeenCalled();
    });

    it('should re-throw non-authentication errors', async () => {
      const error = new Error('Network connection failed');
      mockGitSyncManager.initialize.mockRejectedValueOnce(error);

      const plugin = pluginGitSync(mockContext, {
        remoteRepository: 'https://github.com/test/repo.git',
      });

      await expect(plugin.loadContent!()).rejects.toThrow('Network connection failed');
      expect(mockGitSyncManager.disable).not.toHaveBeenCalled();
    });

    it('should perform initial sync when authentication succeeds', async () => {
      mockGitSyncManager.initialize.mockResolvedValueOnce(undefined);
      mockGitSyncManager.performSync.mockResolvedValueOnce(undefined);

      const plugin = pluginGitSync(mockContext, {
        remoteRepository: 'https://github.com/test/repo.git',
      });

      await plugin.loadContent!();

      expect(mockGitSyncManager.initialize).toHaveBeenCalled();
      expect(mockGitSyncManager.performSync).toHaveBeenCalledWith(0, false, 'pull');
      expect(mockGitSyncManager.disable).not.toHaveBeenCalled();
    });
  });

  describe('contentLoaded', () => {
    it('should start scheduler and webhook server when enabled', async () => {
      const plugin = pluginGitSync(mockContext, {
        remoteRepository: 'https://github.com/test/repo.git',
        enableWebhook: true,
      });

      const actions = { setGlobalData: jest.fn() };
      await plugin.contentLoaded!({ actions } as any);

      expect(mockGitSyncManager.startScheduler).toHaveBeenCalled();
      expect(mockGitSyncManager.startWebhookServer).toHaveBeenCalled();
    });

    it('should not start webhook server when disabled', async () => {
      const plugin = pluginGitSync(mockContext, {
        remoteRepository: 'https://github.com/test/repo.git',
        enableWebhook: false,
      });

      const actions = { setGlobalData: jest.fn() };
      await plugin.contentLoaded!({ actions } as any);

      expect(mockGitSyncManager.startScheduler).toHaveBeenCalled();
      expect(mockGitSyncManager.startWebhookServer).not.toHaveBeenCalled();
    });
  });
});
