#!/usr/bin/env node

/**
 * CLI wrapper for docusaurus-plugin-git-docs-sync
 * This allows running sync commands directly from the plugin
 */

const { spawn } = require('child_process');
const path = require('path');

// Get the command from arguments
const command = process.argv[2];

// Map our commands to Docusaurus CLI commands
const commandMap = {
  'sync': 'git-sync:sync',
  'pull': 'git-sync:pull',
  'push': 'git-sync:push',
  'status': 'git-sync:status',
};

if (!command || !commandMap[command]) {
  console.log('Usage: git-sync <command>');
  console.log('');
  console.log('Commands:');
  console.log('  sync    - Perform bi-directional sync');
  console.log('  pull    - Pull changes from remote');
  console.log('  push    - Push changes to remote');
  console.log('  status  - Show sync status');
  process.exit(1);
}

// Find the Docusaurus site directory
const findDocusaurusRoot = () => {
  let currentDir = process.cwd();

  // Look up to 5 levels for a docusaurus.config.js file
  for (let i = 0; i < 5; i++) {
    try {
      const configPath = path.join(currentDir, 'docusaurus.config.js');
      const configPathTs = path.join(currentDir, 'docusaurus.config.ts');

      if (require('fs').existsSync(configPath) || require('fs').existsSync(configPathTs)) {
        return currentDir;
      }

      currentDir = path.dirname(currentDir);
    } catch (e) {
      break;
    }
  }

  console.error('Error: Could not find Docusaurus site root (no docusaurus.config.js/ts found)');
  console.error('Please run this command from within a Docusaurus project');
  process.exit(1);
};

const siteDir = findDocusaurusRoot();
console.log(`Running in Docusaurus site: ${siteDir}`);

// Run the Docusaurus CLI command
const docusaurus = spawn('npx', ['docusaurus', commandMap[command]], {
  cwd: siteDir,
  stdio: 'inherit',
  shell: true
});

docusaurus.on('error', (err) => {
  console.error('Failed to start Docusaurus:', err);
  process.exit(1);
});

docusaurus.on('exit', (code) => {
  process.exit(code || 0);
});
