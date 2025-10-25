#!/usr/bin/env node

/**
 * Release script for Cursor Account Switcher
 * This script will:
 * 1. Sync version across package.json, Cargo.toml, and tauri.conf.json
 * 2. Commit the version changes
 * 3. Create a git tag
 * 4. Push the tag to GitHub (which triggers the release workflow)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for output
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  reset: '\x1b[0m'
};

// Helper function to execute shell commands
function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    throw error;
  }
}

// Helper function to log colored messages
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to prompt user
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

async function main() {
  try {
    // Get the version from package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    log(`🚀 Starting release process for version ${version}`, 'green');

    // Check if there are uncommitted changes
    const gitStatus = exec('git status -s', { silent: true });
    if (gitStatus) {
      log('⚠️  You have uncommitted changes. Please commit or stash them first.', 'yellow');
      console.log(gitStatus);
      process.exit(1);
    }

    // Check if we're on main/master branch
    const branch = exec('git rev-parse --abbrev-ref HEAD', { silent: true });
    if (branch !== 'main' && branch !== 'master') {
      log(`⚠️  Warning: You are not on main/master branch. Current branch: ${branch}`, 'yellow');
      const answer = await prompt('Do you want to continue? (y/N) ');
      if (answer !== 'y' && answer !== 'yes') {
        process.exit(1);
      }
    }

    // Sync version across all files
    log('📦 Syncing version across files...', 'green');
    exec('npm run sync-version');

    // Check if sync-version made any changes
    const gitStatusAfterSync = exec('git status -s', { silent: true });
    if (gitStatusAfterSync) {
      log('✅ Version synced. Committing changes...', 'green');
      exec('git add -A');
      exec(`git commit -m "chore: bump version to ${version}"`);
    } else {
      log('✅ Version already synced.', 'green');
    }

    // Check if tag already exists
    const tagExists = exec(`git rev-parse v${version}`, { silent: true, ignoreError: true });
    if (tagExists) {
      log(`❌ Tag v${version} already exists!`, 'red');
      log('If you want to re-release, delete the tag first:', 'yellow');
      log(`  git tag -d v${version}`, 'yellow');
      log(`  git push origin :refs/tags/v${version}`, 'yellow');
      process.exit(1);
    }

    // Create git tag
    log(`🏷️  Creating tag v${version}...`, 'green');
    exec(`git tag -a "v${version}" -m "Release v${version}"`);

    // Push changes and tag
    log('⬆️  Pushing changes and tag to GitHub...', 'green');
    exec(`git push origin ${branch}`);
    exec(`git push origin v${version}`);

    log('✨ Release process completed!', 'green');
    log(`🎉 Tag v${version} has been pushed.`, 'green');
    log('📦 GitHub Actions will now build and create the release.', 'green');

    // Get repository URL
    const remoteUrl = exec('git config --get remote.origin.url', { silent: true });
    const repoMatch = remoteUrl.match(/github\.com[:/](.+?)(\.git)?$/);
    if (repoMatch) {
      const repoPath = repoMatch[1];
      log(`🔗 Check progress at: https://github.com/${repoPath}/actions`, 'green');
    }

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();

