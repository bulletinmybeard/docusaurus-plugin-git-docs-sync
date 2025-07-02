# Webhook Test Script

This directory contains a test script for testing GitHub webhooks with the docusaurus-plugin-git-docs-sync plugin.

## Overview

The `test-webhook.js` script simulates GitHub webhook payloads to test your webhook server locally or through services like ngrok. This is useful for:

- Testing webhook connectivity without making actual Git commits
- Debugging webhook authentication issues
- Simulating different event types and payloads
- Verifying your webhook server is running correctly

## Usage

```bash
node scripts/test-webhook.js --secret your-secret [options]
```

### Required Parameters

- `--secret` - The webhook secret configured in your `docusaurus.config.js`

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--url` | `http://localhost:3001/webhook/git-sync` | Webhook endpoint URL |
| `--event` | `push` | GitHub event type (push, pull_request, etc.) |
| `--branch` | `main` | Branch name for the simulated event |
| `--repository` | `test/repo` | Repository name (format: owner/repo) |
| `--files` | `docs/test.md` | Comma-separated list of changed files |
| `--message` | `Test commit` | Commit message |
| `--author` | `Test User` | Commit author name |

## Examples

### Basic Test (Local)

Test the webhook server running locally on the default port:

```bash
node scripts/test-webhook.js \
  --secret "your-webhook-secret-here"
```

### Test with Specific Repository

Simulate a push to a specific repository and branch:

```bash
node scripts/test-webhook.js \
  --secret "your-webhook-secret-here" \
  --repository "yourusername/your-repo" \
  --branch "main"
```

### Test with Multiple Files

Simulate changes to multiple files:

```bash
node scripts/test-webhook.js \
  --secret "your-webhook-secret-here" \
  --files "docs/intro.md,docs/tutorial.md,blog/post.md" \
  --message "Update documentation"
```

### Test Different Event Types

Test pull request events:

```bash
node scripts/test-webhook.js \
  --secret "your-webhook-secret-here" \
  --event "pull_request" \
  --branch "feature/new-docs"
```

### Complete Example

Full example with all options:

```bash
node scripts/test-webhook.js \
  --url "http://localhost:3001/webhook/git-sync" \
  --secret "8b882547b8944f1b3e46d9d31fd1320f9aeb27b0d7d67f1de18a9163322016b2" \
  --event "push" \
  --branch "master" \
  --repository "bulletinmybeard/rschu-me-docs" \
  --files "docs/getting-started.md,docs/api-reference.md" \
  --message "docs: update API documentation" \
  --author "Robin Schulz"
```

## Finding Your Webhook Secret

Your webhook secret is configured in your `docusaurus.config.js` file:

```js
// docusaurus.config.js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-git-docs-sync',
      {
        // ... other options
        webhookSecret: process.env.WEBHOOK_SECRET || 'your-default-secret',
      },
    ],
  ],
};
```

Make sure to use the same secret in:

1. Your `docusaurus.config.js` configuration
2. Your GitHub webhook settings
3. When testing with this script

## Expected Output

### Successful Request

```bash
Sending GitHub webhook to: http://localhost:3001/webhook/git-sync
Event: push
Branch: main
Files: docs/test.md

Payload:
{
  "ref": "refs/heads/main",
  "before": "0000000000000000000000000000000000000000",
  "after": "abc123...",
  "repository": {
    "name": "repo",
    "full_name": "test/repo",
    "html_url": "https://github.com/test/repo"
  },
  ...
}

Response Status: 200 OK
Webhook sent successfully!
```

### Failed Request

Common failure scenarios:

1. **401 Unauthorized** - Wrong webhook secret
2. **404 Not Found** - Wrong URL or webhook server not running
3. **Connection refused** - Webhook server not running on specified port

## Troubleshooting

### Webhook Server Not Running

Ensure your Docusaurus site is running and webhook is enabled:

```js
// docusaurus.config.js
{
  enableWebhook: true,
  webhookPort: 3001,
  webhookSecret: 'your-secret'
}
```

### Debugging

Enable debug mode in your Docusaurus config to see detailed webhook logs:

```js
{
  debug: true,
  enableWebhook: true,
  // ... other options
}
```

## Related Documentation

- [GitHub Webhook Setup Guide](../docs/github-webhook-setup.md)
- [Testing Webhooks Guide](../docs/testing-webhooks.md)
- [Main Plugin README](../README.md)
