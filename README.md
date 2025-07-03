# docusaurus-plugin-git-docs-sync

[![npm version](https://img.shields.io/npm/v/docusaurus-plugin-git-docs-sync)](https://www.npmjs.com/package/docusaurus-plugin-git-docs-sync)
[![npm downloads](https://img.shields.io/npm/dm/docusaurus-plugin-git-docs-sync)](https://www.npmjs.com/package/docusaurus-plugin-git-docs-sync)
[![bundle size](https://img.shields.io/bundlephobia/minzip/docusaurus-plugin-git-docs-sync)](https://bundlephobia.com/package/docusaurus-plugin-git-docs-sync)
[![node](https://img.shields.io/node/v/docusaurus-plugin-git-docs-sync)](https://nodejs.org)

[![CI](https://github.com/bulletinmybeard/docusaurus-plugin-git-docs-sync/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/bulletinmybeard/docusaurus-plugin-git-docs-sync/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/bulletinmybeard/docusaurus-plugin-git-docs-sync)](https://codecov.io/gh/bulletinmybeard/docusaurus-plugin-git-docs-sync)

[![Docusaurus](https://img.shields.io/badge/Docusaurus-3.0+-3ECC5F?logo=docusaurus&logoColor=white)](https://docusaurus.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/bulletinmybeard/docusaurus-plugin-git-docs-sync/blob/master/CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/bulletinmybeard/docusaurus-plugin-git-docs-sync?style=social)](https://github.com/bulletinmybeard/docusaurus-plugin-git-docs-sync)
[![Follow on Twitter](https://img.shields.io/twitter/follow/bulletinmybeard?style=social)](https://twitter.com/bulletinmybeard)

A Docusaurus plugin that automatically syncs your documentation with a GitHub repository. Write your docs once, and they'll stay in sync everywhere. Supports both Markdown (.md) and MDX (.mdx) files.

## Features

- **Automatic sync**: Your documentation stays up-to-date across your website and GitHub
- **Real-time updates**: Changes appear instantly with webhook support
- **Easy setup**: Get started in just 3 minutes with minimal configuration
- **Team collaboration**: Multiple people can edit docs without conflicts
- **Backup protection**: Your content is always safe in GitHub
- **MDX/Markdown support**: Works with both .md and .mdx files
- **Smart validation**: Ensures your content is always valid before syncing

## Quick Start

Get your documentation syncing with GitHub in 3 simple steps:

### 1. Install the plugin

```bash
npm install docusaurus-plugin-git-docs-sync
```

### 2. Add your GitHub repository

Edit your `docusaurus.config.js` file:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-git-docs-sync',
      {
        remoteRepository: 'https://github.com/yourusername/your-docs-repo.git',
      },
    ],
  ],
};
```

### 3. Start your site

```bash
npm run start
```

That's it! Your documentation will now automatically sync with GitHub every 5 minutes. Any changes you make locally will be pushed to GitHub, and any changes made on GitHub will be pulled to your site.

## Installation

Install the plugin using npm:

```bash
npm install docusaurus-plugin-git-docs-sync
```

## Configuration

The plugin works great with just the basic setup, but you can customize it to fit your needs.

### Basic Configuration

For most users, this is all you need:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-git-docs-sync',
      {
        remoteRepository: 'https://github.com/yourusername/your-docs-repo.git',
      },
    ],
  ],
};
```

### Configuration Options

#### Essential Settings

| Setting | What it does | Default | Example |
|:---------|:--------------|:---------|:----------|
| `remoteRepository` | Your GitHub repository URL | Required | `https://github.com/you/docs.git` |
| `branch` | Which branch to sync | `main` | `main`, `master`, `docs` |
| `syncDirection` | How to sync | `sync` | `sync`, `push`, `pull` |
| `syncInterval` | How often to sync | Every 5 min | `*/30 * * * *` (30 minutes) |
| `contentPath` | Where your docs are | `docs` | `docs`, `content`, `pages` |
| `debug` | Show detailed logs | `false` | `true` or `false` |

#### Customization Options

| Setting | What it does | Default | Example |
|:---------|:--------------|:---------|:----------|
| `commitMessage` | Message for commits | `docs: sync content` | `Update documentation` |
| `authorName` | Who makes commits | `Docusaurus Git Sync` | `Documentation Bot` |
| `conflictResolution` | Who wins conflicts | `ours` | `ours`, `theirs`, `manual` |
| `ignorePatterns` | Files to skip | System files | `['*.tmp', 'drafts/**']` |

#### Private Repository Settings

| Setting | What it does | Required for | Example |
|---------|--------------|--------------|----------|
| `authMethod` | How to authenticate | Private repos | `token` |
| `githubUsername` | Your GitHub username | Private repos | `yourusername` |
| `githubToken` | Your access token | Private repos | `ghp_abc123...` |

#### Real-time Sync Settings (Webhooks)

| Setting | What it does | Default | Example |
|:---------|:--------------|:---------|:----------|
| `enableWebhook` | Turn on instant sync | `false` | `true` |
| `webhookPort` | Port for webhooks | `3001` | `3001`, `8080` |
| `webhookSecret` | Password for security | None | `my-secret-key` |

#### Content Validation

| Setting | What it does | Default | When to change |
|---------|--------------|---------|----------------|
| `validateBeforeCommit` | Check files before syncing | `false` | Enable for strict quality |
| `skipInvalidFiles` | Skip broken files | `true` | Set `false` to stop on errors |

### Full Example with All Options

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-git-docs-sync',
      {
        // Required
        remoteRepository: 'https://github.com/yourusername/docs.git',

        // Common options
        branch: 'main',
        syncDirection: 'sync',      // 'sync', 'push', or 'pull'
        syncInterval: '*/30 * * * *', // Every 30 minutes
        
        // For private repos
        authMethod: 'token',
        githubUsername: 'yourusername',
        githubToken: 'ghp_YourTokenHere',

        // For instant updates
        enableWebhook: true,
        webhookPort: 3001,
        webhookSecret: 'choose-a-secret',

        // Optional customization
        conflictResolution: 'ours',  // or 'theirs'
        validateBeforeCommit: true,
        debug: true,                 // See what's happening
      },
    ],
  ],
};
```

## How It Works

### Automatic Synchronization

The plugin keeps your documentation in sync using two methods:

1. **Regular Sync** (Default: every 5 minutes)
   - Checks for changes automatically
   - Works in the background while you write
   - No manual steps required

2. **Instant Sync** (Optional: with webhooks)
   - Updates immediately when you push to GitHub
   - Perfect for team collaboration
   - See changes in real-time

### Why This Matters

- **Never lose work**: Your docs are always backed up to GitHub
- **Team friendly**: Multiple people can edit without conflicts
- **Version control**: Track all changes with Git history
- **Works offline**: Syncs automatically when you're back online

### Automatic Synchronization

Once configured, the plugin will automatically:

1. Initialize a git repository in your content directory
2. Set up the remote repository
3. Perform initial sync on startup
4. Start the scheduler for periodic syncs
5. Start the webhook server (if enabled) for real-time syncs

### Manual Controls

While the plugin works automatically, you can also trigger syncs manually:

```bash
# Sync now (both directions)
npm run docusaurus git-sync:sync

# Get latest changes from GitHub
npm run docusaurus git-sync:pull

# Send your changes to GitHub
npm run docusaurus git-sync:push

# Check what's happening
npm run docusaurus git-sync:status
```

### Sync Modes Explained

Choose how your documentation syncs:

- **`sync`** (Default): Two-way sync - changes go both directions
- **`push`**: One-way backup - only sends your changes to GitHub
- **`pull`**: One-way update - only receives changes from GitHub

### Handling Conflicts

When the same file is edited in two places:

- **`ours`** (Default): Your local changes win
- **`theirs`**: GitHub changes win
- **`manual`**: You decide which changes to keep

### Real-time Updates with Webhooks

Want changes to appear instantly? Set up webhooks for real-time synchronization!

> **Note**: Webhooks give you instant updates, while scheduled sync ensures nothing is missed. Using both gives you the best experience.

#### Enable Webhooks

Add these lines to your plugin configuration:

```js
{
  enableWebhook: true,
  webhookPort: 3001,
  webhookSecret: 'choose-a-secret-password-here'
}
```

#### Advanced Webhook Options

For production environments:

```js
{
  enableWebhook: true,
  webhookPort: 3001,
  webhookSecret: process.env.WEBHOOK_SECRET,

  // Only sync specific branches
  webhookFilters: {
    branches: ['main'],                   // Only sync main branch
    paths: ['docs/**', '*.md', '*.mdx']   // Only sync documentation files
  }
}
```

#### Connect to GitHub

1. In your GitHub repository, go to Settings → Webhooks
2. Click "Add webhook"
3. Fill in:
   - **Payload URL**: `http://your-domain:3001/webhook/git-sync`
   - **Content type**: Select `application/json`
   - **Secret**: Enter the same secret from your config
   - **Events**: Choose "Just the push event"
4. Click "Add webhook"

#### Testing Your Webhook

To verify webhooks are working:

```bash
# Check if the webhook server is running
curl http://localhost:3001/webhook/status
```

#### Troubleshooting Webhooks

If webhooks aren't working:

1. Make sure your server is accessible from the internet
2. Check that your firewall allows connections on port 3001
3. Verify the webhook secret matches exactly (it's case-sensitive)
4. Check GitHub's webhook settings for delivery errors
5. Enable debug mode in your config to see detailed logs

## Working with Private Repositories

### For Public Repositories

No additional setup needed! Public repositories work out of the box.

### For Private Repositories

You'll need a GitHub Personal Access Token:

#### Step 1: Create a Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Click "Generate new token" (classic)
3. Name it something like "Docusaurus Sync"
4. Check the `repo` checkbox
5. Click "Generate token"
6. Copy the token (you won't see it again!)

#### Step 2: Add to Your Configuration

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-git-docs-sync',
      {
        remoteRepository: 'https://github.com/yourusername/your-private-repo.git',
        authMethod: 'token',
        githubUsername: 'yourusername',
        githubToken: 'ghp_YourTokenHere', // Or use process.env.GITHUB_TOKEN
      },
    ],
  ],
};
```

#### Step 3: Keep Your Token Safe

**Option A**: Use environment variables (recommended)

1. Create a `.env` file in your project root:
   ```
   GITHUB_TOKEN=ghp_YourTokenHere
   ```

2. Add to `.gitignore`:
   ```
   .env
   ```

3. Update your config:
   ```js
   githubToken: process.env.GITHUB_TOKEN
   ```

**Option B**: Direct configuration (for local development only)

You can put the token directly in your config, but never commit this!


## Real-World Examples

### Team Documentation

Perfect for teams working together on docs:

```js
plugins: [
  [
    'docusaurus-plugin-git-docs-sync',
    {
      remoteRepository: 'https://github.com/myteam/shared-docs.git',
      syncDirection: 'sync',              // Two-way sync
      conflictResolution: 'theirs',       // Team changes win conflicts
    },
  ],
],
```

### Content Backup

Never lose your work with automatic GitHub backups:

```js
plugins: [
  [
    'docusaurus-plugin-git-docs-sync',
    {
      remoteRepository: 'https://github.com/yourusername/blog-backup.git',
      syncDirection: 'push',              // One-way backup
      syncInterval: '0 * * * *',          // Hourly backups
    },
  ],
],
```


### Community Contributions

Accept documentation contributions from your community:

```js
plugins: [
  [
    'docusaurus-plugin-git-docs-sync',
    {
      remoteRepository: 'https://github.com/opensource/community-docs.git',
      syncDirection: 'pull',              // Only receive approved changes
      branch: 'contributions',
    },
  ],
],
```


## Troubleshooting

### Checking If Everything Works

Run this command to see the current status:

```bash
npm run docusaurus git-sync:status
```

This shows you:
- Which GitHub repository you're connected to
- When the last sync happened
- Any pending changes
- Whether the connection is working

### Common Issues and Solutions

#### Can't Access Private Repository

**Error**: `Authentication failed`

**Fix**: Make sure you've added your GitHub token:

```js
{
  authMethod: 'token',
  githubToken: 'your-github-token',
  githubUsername: 'yourusername'
}
```

##### Graceful Authentication Failure Handling

Starting from version 1.0.0-beta.1, the plugin handles authentication failures gracefully:

- **Docusaurus continues to start** even with invalid credentials
- **Git sync is automatically disabled** when authentication fails
- **Clear warning messages** are displayed in the console
- **Local development continues** without interruption

When authentication fails, you'll see:
```
[Git Sync] ⚠️  Authentication failed. Git sync will be disabled for this session.
[Git Sync] ⚠️  Please check your GitHub credentials.
[Git Sync] ⚠️  Docusaurus will continue with local content only.
```

To fix authentication issues:
1. Update your credentials in the `.env` file or configuration
2. Restart Docusaurus
3. Git sync will automatically re-enable with valid credentials

#### File Conflicts

**Error**: `Merge conflict in docs/file.md`

**Fix**: Choose who wins when files conflict:

```js
conflictResolution: 'theirs' // GitHub wins
// or
conflictResolution: 'ours'   // Your local file wins
```

#### Webhooks Not Working

**Issue**: GitHub shows webhook delivered but nothing happens

**Fix**: Check these things:

1. Your webhook config matches GitHub:
   ```js
   enableWebhook: true,
   webhookPort: 3001,
   webhookSecret: 'same-secret-as-github'
   ```

2. Your server allows connections on port 3001
3. The webhook URL is correct: `http://your-domain:3001/webhook/git-sync`

#### Large File Errors

**Error**: `File exceeds GitHub's size limit`

**Fix**: Exclude large files from syncing:

```js
ignorePatterns: ['*.mp4', '*.zip', 'videos/**']
```

#### Sync Schedule Not Working

**Issue**: Automatic sync isn't happening

**Fix**: Check your sync interval setting:

```js
syncInterval: '*/5 * * * *'  // Every 5 minutes (default)
syncInterval: '0 * * * *'    // Every hour
syncInterval: '0 0 * * *'    // Once per day
```

#### Invalid File Errors

**Error**: `MDX validation failed`

**Fix**: Either fix the syntax error in your file, or skip validation:

```js
validateBeforeCommit: false,
skipInvalidFiles: true
```

### Tips for Large Documentation

If you have lots of documentation:

1. **Sync less frequently**:
   ```js
   syncInterval: '0 */4 * * *' // Every 4 hours
   ```

2. **Use webhooks for instant updates**:
   ```js
   enableWebhook: true,
   webhookPort: 3001
   ```

3. **Exclude unnecessary files**:
   ```js
   ignorePatterns: ['*.log', 'temp/**', 'drafts/**']
   ```

### Seeing What's Happening

To see detailed information about what the plugin is doing:

```js
{
  debug: true  // Shows detailed sync information
}
```

This will show you when files are synced, any issues that occur, and webhook activity.

### Getting Help

Still having trouble? Here's how to get help:

1. Check existing [GitHub Issues](https://github.com/bulletinmybeard/docusaurus-plugin-git-docs-sync/issues)
2. Turn on debug mode (`debug: true`) to see what's happening
3. Create a new issue with:
   - Your configuration (remove any tokens/secrets!)
   - The error message you're seeing
   - What you expected to happen

## Compatibility

### Works With

- **Docusaurus**: Version 3.0 or newer
- **Operating Systems**: Windows, Mac, Linux
- **Node.js**: Version 18 or newer
- **Git**: Version 2.7.4 or newer

### Git Providers

| Provider | Status | Features |
|----------|--------|----------|
| GitHub | ✅ **Fully Supported** | • Public & private repos<br>• Webhooks for instant sync<br>• Token authentication<br>• Full API integration |
| GitLab | 🔜 Coming Soon | Planned for future release |
| Bitbucket | 🔜 Coming Soon | Planned for future release |
| Azure DevOps | 🔜 Coming Soon | Planned for future release |

### Works Great With

This plugin plays nicely with other Docusaurus plugins:
- Documentation and blog content
- Images and media files
- Search plugins
- Sitemap generators


## What You'll Need

Before getting started:

✓ **Git** installed on your computer ([Download Git](https://git-scm.com/downloads))  
✓ **Node.js** version 18 or newer ([Download Node.js](https://nodejs.org/))  
✓ **Docusaurus** version 3.0 or newer ([Get Docusaurus](https://docusaurus.io/docs))  
✓ A **GitHub account** and repository for your docs

## Important Notes

- Currently optimized for GitHub (other Git providers coming soon)
- Large files over 100MB cannot be synced due to GitHub limits
- Webhooks require your server to be accessible from the internet

## Next Steps

After installation:

1. **Write your docs** - Just create or edit files in your docs folder
2. **Watch it sync** - Changes automatically sync to GitHub
3. **Collaborate** - Team members can edit on GitHub or locally
4. **Stay safe** - Your content is always backed up

### Need Help?

- [Report Issues](https://github.com/bulletinmybeard/docusaurus-plugin-git-docs-sync/issues) - Get help when something's not working
- [View on GitHub](https://github.com/bulletinmybeard/docusaurus-plugin-git-docs-sync) - See the latest updates

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.
