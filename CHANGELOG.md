# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2025-06-29

### Added

- Initial release of docusaurus-plugin-git-docs-sync
- Bi-directional synchronization between Docusaurus and Git repositories
- Support for push, pull, and sync modes
- Scheduled synchronization using cron expressions
- CLI commands for manual sync operations (sync, pull, push, status)
- Webhook server for instant synchronization with GitHub webhook support
- Enhanced webhook features:
  - HTTPS support for secure webhook endpoints
  - Webhook event filtering by branch, event type, and file paths
  - Test endpoint for webhook validation
  - Health check and status endpoints
- Authentication support (token-based for private repositories)
- Conflict resolution strategies (ours, theirs, manual)
- MDX/Markdown validation:
  - Pre-compilation validation to prevent build failures
  - Pre-commit validation (optional)
  - Support for both .md and .mdx files
  - Invalid file placeholder system during build
  - Graceful handling of invalid MDX syntax
- Secure credential management with optional encryption
- Comprehensive error handling with custom error types
- Retry logic with exponential backoff
- Queue-based sync operations to prevent conflicts
- Input validation for all configuration options
- Debug mode for troubleshooting
- TypeScript support with full type definitions
- Jest testing framework with mocked dependencies
- Comprehensive documentation including:
  - AWS Lightsail hosting guide
  - GitHub webhook setup guide
  - Testing webhooks guide
  - Example configurations

### Security

- Credentials encrypted in memory
- Sensitive data masked in logs
- Input validation to prevent injection attacks
- Rate limiting to prevent DoS attacks
- Webhook signature validation

### Known Issues

- Moderate security vulnerabilities in webpack-dev-server (Docusaurus dependency) - affects development server only, not production builds

## [Unreleased]

### Added

- Explicit documentation for MDX (.mdx) file support alongside Markdown (.md) files

### Changed

- Updated README badges for initial release (removed npm-specific badges until published)
- Improved webhook path filter example to include both .md and .mdx files
- Cleaned up .gitignore and .npmignore files to remove unnecessary patterns

### Fixed

- Consolidated duplicate validation logic (merged validation.ts into validation-unified.ts)
- Fixed duplicate method implementations in ValidationUtils class
- Updated package.json build script to remove unnecessary JavaScript file copying

### Removed

- Dead code cleanup (8 unused files removed):
  - webhook-server.ts (replaced by webhook-server-improved.ts)
  - content-plugin.ts, mdx-content-plugin.ts (unused plugins)
  - mdx-exclusion-plugin.ts, mdx-filter-loader.ts (unused)
  - placeholder-loader.js, exclude-invalid-loader.js (unused loaders)
  - docusaurus-mdx-interceptor.ts (unused)
  - validation.ts (merged into validation-unified.ts)

## Version History

### 0.9.0-beta - Initial Beta

- Core functionality implemented
- Basic testing completed
- Documentation drafted

### 0.8.0-alpha - Alpha Release

- Proof of concept
- Basic sync functionality
- Limited testing

---

## Upgrade Guide

### From 0.x to 1.0

1. Update configuration:

   ```javascript
   // Old
   authToken: 'token'

   // New
   authMethod: 'token',
   githubToken: 'token'
   ```

2. Update CLI commands:

   ```bash
   # Old
   npm run git-sync

   # New
   npm run docusaurus git-sync:sync
   ```

3. Environment variables:
   - `GIT_TOKEN` → `GITHUB_TOKEN`
   - `GIT_USER` → `GITHUB_USERNAME`
