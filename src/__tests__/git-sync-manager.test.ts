import { GitSyncManager } from '../git-sync-manager';
import { PluginOptions } from '../types';
import * as fs from 'fs/promises';
import simpleGit from 'simple-git';

jest.mock('simple-git');
jest.mock('fs/promises');
jest.mock('../credential-manager');
jest.mock('../webhook-server-improved');

const mockGit = {
  init: jest.fn(),
  addRemote: jest.fn(),
  getRemotes: jest.fn(),
  fetch: jest.fn(),
  branch: jest.fn(),
  checkoutBranch: jest.fn(),
  checkout: jest.fn(),
  checkoutLocalBranch: jest.fn(),
  status: jest.fn(),
  add: jest.fn(),
  commit: jest.fn(),
  push: jest.fn(),
  pull: jest.fn(),
  stash: jest.fn(),
  merge: jest.fn(),
};

describe('GitSyncManager', () => {
  let gitSyncManager: GitSyncManager;
  const testDir = '/test/content';
  const defaultOptions: Required<PluginOptions> = {
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
    debug: false,
    authMethod: 'token',
    githubToken: 'test-token',
    githubUsername: 'testuser',
    validateBeforeCommit: false,
    skipInvalidFiles: true,
    validateBeforeCompile: false,
    placeholderRestorationDelay: 5000,
    encryptionKey: '',
    webhookHttps: false,
    webhookHttpsKey: '',
    webhookHttpsCert: '',
    webhookHttpsKeyPath: '',
    webhookHttpsCertPath: '',
    webhookFilters: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

    gitSyncManager = new GitSyncManager(testDir, defaultOptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('disable()', () => {
    it('should set isDisabled to true', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      gitSyncManager.disable();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Git Sync] Git sync has been disabled due to authentication failure.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('performSync with disabled state', () => {
    it('should skip sync when disabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const debugOptions = { ...defaultOptions, debug: true };
      gitSyncManager = new GitSyncManager(testDir, debugOptions);

      // Disable the manager
      gitSyncManager.disable();

      // Try to perform sync
      await gitSyncManager.performSync();

      // Verify sync was skipped
      expect(consoleSpy).toHaveBeenCalledWith('[Git Sync] Sync is disabled, skipping...');
      expect(mockGit.fetch).not.toHaveBeenCalled();
      expect(mockGit.pull).not.toHaveBeenCalled();
      expect(mockGit.push).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not perform any git operations when disabled', async () => {
      gitSyncManager.disable();

      await gitSyncManager.performSync();

      // Verify no git operations were performed
      expect(mockGit.init).not.toHaveBeenCalled();
      expect(mockGit.fetch).not.toHaveBeenCalled();
      expect(mockGit.pull).not.toHaveBeenCalled();
      expect(mockGit.push).not.toHaveBeenCalled();
      expect(mockGit.commit).not.toHaveBeenCalled();
    });
  });

  describe('startScheduler with disabled state', () => {
    it('should not start scheduler when disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const debugOptions = { ...defaultOptions, debug: true };
      gitSyncManager = new GitSyncManager(testDir, debugOptions);

      gitSyncManager.disable();
      gitSyncManager.startScheduler();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Git Sync] Scheduler not started - sync is disabled'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('startWebhookServer with disabled state', () => {
    it('should not start webhook server when disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const debugOptions = { ...defaultOptions, debug: true, enableWebhook: true };
      gitSyncManager = new GitSyncManager(testDir, debugOptions);

      gitSyncManager.disable();
      gitSyncManager.startWebhookServer();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Git Sync] Webhook server not started - sync is disabled'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('authentication failure handling', () => {
    it('should handle authentication errors during initialization', async () => {
      const authError = new Error('fatal: Authentication failed for \'https://github.com/test/repo.git/\'');
      mockGit.fetch.mockRejectedValueOnce(authError);
      mockGit.getRemotes.mockResolvedValue([]);

      await expect(gitSyncManager.initialize()).rejects.toThrow();
    });
  });
});
