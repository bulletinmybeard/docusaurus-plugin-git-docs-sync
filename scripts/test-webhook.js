#!/usr/bin/env node

/**
 * Test script for docusaurus-plugin-git-docs-sync GitHub webhooks
 *
 * Usage:
 *   node scripts/test-webhook.js [options]
 *
 * Options:
 *   --url         Webhook URL (default: http://localhost:3001/webhook/git-sync)
 *   --secret      Webhook secret (required)
 *   --event       Event type: push, pull_request, etc. (default: push)
 *   --branch      Branch name (default: main)
 *   --repository  Repository name (default: test/repo)
 *   --files       Comma-separated list of changed files
 *   --message     Commit message (default: Test commit)
 *   --author      Author name (default: Test User)
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://localhost:3001/webhook/git-sync',
    secret: '',
    event: 'push',
    branch: 'main',
    repository: 'test/repo',
    files: 'docs/test.md',
    message: 'Test commit',
    author: 'Test User',
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    if (key in options) {
      options[key] = value;
    }
  }

  if (!options.secret) {
    console.error('Error: --secret is required');
    console.log('\nUsage: node scripts/test-webhook.js --secret your-secret [options]');
    console.log('\nOptions:');
    console.log('  --url         Webhook URL (default: http://localhost:3001/webhook/git-sync)');
    console.log('  --secret      Webhook secret (required)');
    console.log('  --event       Event type (default: push)');
    console.log('  --branch      Branch name (default: main)');
    console.log('  --repository  Repository name (default: test/repo)');
    console.log('  --files       Comma-separated list of changed files');
    console.log('  --message     Commit message');
    console.log('  --author      Author name');
    process.exit(1);
  }

  return options;
}

// Generate GitHub webhook payload
function generatePayload(options) {
  const files = options.files.split(',').map(f => f.trim());
  const commitId = crypto.randomBytes(20).toString('hex');

  return {
    ref: `refs/heads/${options.branch}`,
    before: '0000000000000000000000000000000000000000',
    after: commitId,
    repository: {
      name: options.repository.split('/')[1] || options.repository,
      full_name: options.repository,
      html_url: `https://github.com/${options.repository}`,
    },
    pusher: {
      name: options.author,
      email: `${options.author.toLowerCase().replace(' ', '.')}@example.com`,
    },
    commits: [{
      id: commitId,
      message: options.message,
      timestamp: new Date().toISOString(),
      author: {
        name: options.author,
        email: `${options.author.toLowerCase().replace(' ', '.')}@example.com`,
      },
      added: files,
      modified: [],
      removed: [],
    }],
  };
}

// Generate GitHub webhook headers
function generateHeaders(options, payload) {
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', options.secret)
    .update(payloadString)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString),
    'X-GitHub-Event': options.event,
    'X-Hub-Signature-256': `sha256=${signature}`,
  };
}

// Send webhook request
function sendWebhook(options) {
  const payload = generatePayload(options);
  const payloadString = JSON.stringify(payload, null, 2);
  const headers = generateHeaders(options, payload);

  console.log('Sending GitHub webhook to:', options.url);
  console.log('Event:', options.event);
  console.log('Branch:', options.branch);
  console.log('Files:', options.files);
  console.log('\nPayload:');
  console.log(payloadString);
  console.log('\nHeaders:');
  console.log(JSON.stringify(headers, null, 2));

  const url = new URL(options.url);
  const client = url.protocol === 'https:' ? https : http;

  const req = client.request(
    {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers,
    },
    (res) => {
      console.log('\nResponse Status:', res.statusCode, res.statusMessage);
      console.log('Response Headers:', res.headers);

      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        console.log('\nResponse Body:');
        try {
          const json = JSON.parse(body);
          console.log(JSON.stringify(json, null, 2));
        } catch {
          console.log(body);
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('\n✅ Webhook sent successfully!');
        } else {
          console.log('\n❌ Webhook failed!');
          process.exit(1);
        }
      });
    }
  );

  req.on('error', (error) => {
    console.error('\nError sending webhook:', error.message);
    console.log('\nMake sure the webhook server is running and accessible at:', options.url);
    process.exit(1);
  });

  req.write(JSON.stringify(payload));
  req.end();
}

// Main
const options = parseArgs();
sendWebhook(options);
