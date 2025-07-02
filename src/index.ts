import type { LoadContext, Plugin } from '@docusaurus/types';
import type { PluginOptions } from './types';
import { GitSyncManager } from './git-sync-manager';
import { validateAndNormalizeOptions } from './validation-unified';
import { MDXPreValidator } from './mdx-pre-validator';
import { InvalidFilesManager } from './invalid-files-manager';
import { PlaceholderGenerator } from './placeholder-generator';
import path from 'path';
import * as fs from 'fs';

export default function pluginGitSync(
  context: LoadContext,
  opts: Partial<PluginOptions>,
): Plugin {
  const options = validateAndNormalizeOptions(opts);

  const contentDir = path.resolve(context.siteDir, options.contentPath);
  const gitSyncManager = new GitSyncManager(contentDir, options);

  // Initialize MDX pre-validator if enabled
  const mdxPreValidator = options.validateBeforeCompile === true
    ? new MDXPreValidator(context, [
      options.contentPath,
      'docs',
      'blog',
      'src/pages'
    ])
    : null;

  // Get the singleton invalid files manager
  const invalidFilesManager = InvalidFilesManager.getInstance();

  // Initialize placeholder generator
  const placeholderGenerator = new PlaceholderGenerator(context.siteDir);

  // Helper function to validate MDX files after sync
  const validateAfterSync = async () => {
    if (mdxPreValidator) {
      const report = await mdxPreValidator.validate(true); // Force refresh
      const invalidFiles = report.invalidFiles.map(({ file }) => file);
      invalidFilesManager.setInvalidFiles(invalidFiles);

      if (invalidFiles.length > 0) {
        console.log(`[Git Sync] Post-sync validation found ${invalidFiles.length} invalid MDX files`);
      }
    }
  };

  // Handle process termination gracefully
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('[Git Sync] Shutting down gracefully...');
    try {
      // Restore original files if placeholders exist
      if (placeholderGenerator.hasPlaceholders()) {
        await placeholderGenerator.restoreOriginals();
      }

      await gitSyncManager.shutdown();

      console.log('[Git Sync] Shutdown complete');
    } catch (error) {
      console.error('[Git Sync] Error during shutdown:', error);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('exit', () => {
    if (!isShuttingDown) {
      console.log('[Git Sync] Emergency shutdown');
      // Synchronous shutdown as last resort
      gitSyncManager.shutdown().catch(() => { });
    }
  });

  return {
    name: 'docusaurus-plugin-git-sync',

    async loadContent() {
      if (options.debug) {
        console.log('[Git Sync] Loading content...');
      }

      try {
        await gitSyncManager.initialize();

        if (context.siteConfig.customFields?.['git-sync-initial'] !== false) {
          // Initial sync on startup should only pull, not push
          await gitSyncManager.performSync(0, false, 'pull');
        }
      } catch (error: any) {
        // Handle authentication errors gracefully
        if (error.code === 'AUTHENTICATION_FAILED' ||
          error.message?.toLowerCase().includes('authentication') ||
          error.message?.toLowerCase().includes('invalid username or password')) {
          console.warn('[Git Sync] ⚠️  Authentication failed. Git sync will be disabled for this session.');
          console.warn('[Git Sync] ⚠️  Please check your GitHub credentials.');
          console.warn('[Git Sync] ⚠️  Docusaurus will continue with local content only.');
          gitSyncManager.disable();
        } else {
          // Re-throw non-authentication errors
          throw error;
        }
      }

      // Validate MDX files and create placeholders for invalid ones
      if (mdxPreValidator) {
        const report = await mdxPreValidator.validate(true);
        const invalidFiles = report.invalidFiles;

        if (invalidFiles.length > 0) {
          console.log(`[Git Sync] Found ${invalidFiles.length} invalid MDX files, creating placeholders...`);
          await placeholderGenerator.createPlaceholders(invalidFiles);
          invalidFilesManager.setInvalidFiles(invalidFiles.map(({ file }) => file));
        }
      }

      // Return null as we're not providing any content
      return null;
    },

    async contentLoaded({ actions }) {
      if (options.debug) {
        console.log('[Git Sync] Content loaded, starting sync scheduler...');
      }

      gitSyncManager.startScheduler();

      if (options.enableWebhook) {
        gitSyncManager.startWebhookServer();
      }

      // Restore original files after a delay to ensure Docusaurus has loaded
      if (placeholderGenerator.hasPlaceholders()) {
        setTimeout(async () => {
          console.log('[Git Sync] Restoring original MDX files...');
          await placeholderGenerator.restoreOriginals();
          console.log('[Git Sync] Original files restored successfully');
        }, options.placeholderRestorationDelay);
      }

      // Set up file watcher to re-validate when files change
      const chokidar = await import('chokidar');
      const watchPaths = mdxPreValidator ? [
        path.join(context.siteDir, 'docs'),
        path.join(context.siteDir, 'blog'),
        path.join(context.siteDir, 'src/pages')
      ].filter(p => fs.existsSync(p)) : [];

      if (watchPaths.length > 0) {
        const watcher = chokidar.watch(watchPaths, {
          ignored: /(^|[/\\])\../, // ignore dotfiles
          persistent: true,
          ignoreInitial: true
        });

        let validationTimeout: NodeJS.Timeout | null = null;

        watcher.on('all', (event, path) => {
          if (path.endsWith('.md') || path.endsWith('.mdx')) {
            // Debounce validation to avoid multiple runs
            if (validationTimeout) {
              clearTimeout(validationTimeout);
            }

            validationTimeout = setTimeout(async () => {
              console.log(`[Git Sync] File change detected, re-validating MDX files...`);
              await validateAfterSync();
            }, 1000);
          }
        });
      }

      // Store validation results if validator is enabled
      if (mdxPreValidator) {
        const { setGlobalData } = actions;
        const report = await mdxPreValidator.validate();

        // Set global validation data
        setGlobalData({
          mdxValidation: {
            totalFiles: report.totalFiles,
            validFiles: report.validFiles,
            invalidFiles: report.invalidFiles.length,
            errors: report.invalidFiles
          }
        });
      }
    },

    extendCli(cli) {
      cli
        .command('git-sync')
        .description('Manage git synchronization')
        .action(() => {
          console.log('Use one of the subcommands: sync, pull, push, status');
        });

      cli
        .command('git-sync:sync')
        .description('Perform bi-directional sync with remote repository')
        .action(async () => {
          try {
            await gitSyncManager.initialize();
            await gitSyncManager.performSync();
            console.log('✅ Sync completed successfully');
          } catch (error: any) {
            console.error('❌ Sync failed:', error.message);
            process.exit(1);
          }
        });

      cli
        .command('git-sync:pull')
        .description('Pull changes from remote repository')
        .action(async () => {
          try {
            await gitSyncManager.initialize();
            await gitSyncManager.pull();
            console.log('✅ Pull completed successfully');
          } catch (error: any) {
            console.error('❌ Pull failed:', error.message);
            process.exit(1);
          }
        });

      cli
        .command('git-sync:push')
        .description('Push changes to remote repository')
        .action(async () => {
          try {
            await gitSyncManager.initialize();
            await gitSyncManager.push();
            console.log('✅ Push completed successfully');
          } catch (error: any) {
            console.error('❌ Push failed:', error.message);
            process.exit(1);
          }
        });

      cli
        .command('git-sync:status')
        .description('Show git sync status')
        .action(async () => {
          try {
            await gitSyncManager.initialize();
            const status = await gitSyncManager.getStatus();
            console.log('Git Sync Status:', JSON.stringify(status, null, 2));
          } catch (error: any) {
            console.error('❌ Status check failed:', error.message);
            process.exit(1);
          }
        });
    },


    async postBuild() {
      if (options.debug) {
        console.log('[Git Sync] Shutting down sync manager...');
      }
      await gitSyncManager.shutdown();
      if (mdxPreValidator) {
        mdxPreValidator.clearCache();
      }
    },
  };
}

export { PluginOptions };
