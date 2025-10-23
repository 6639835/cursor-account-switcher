#!/bin/bash

# Release script for Cursor Account Switcher
# This script will:
# 1. Sync version across package.json, Cargo.toml, and tauri.conf.json
# 2. Commit the version changes
# 3. Create a git tag
# 4. Push the tag to GitHub (which triggers the release workflow)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

echo -e "${GREEN}🚀 Starting release process for version ${VERSION}${NC}"

# Check if there are uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes. Please commit or stash them first.${NC}"
    git status -s
    exit 1
fi

# Check if we're on main/master branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
    echo -e "${YELLOW}⚠️  Warning: You are not on main/master branch. Current branch: ${BRANCH}${NC}"
    read -p "Do you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Sync version across all files
echo -e "${GREEN}📦 Syncing version across files...${NC}"
npm run sync-version

# Check if sync-version made any changes
if [[ -n $(git status -s) ]]; then
    echo -e "${GREEN}✅ Version synced. Committing changes...${NC}"
    git add -A
    git commit -m "chore: bump version to ${VERSION}"
else
    echo -e "${GREEN}✅ Version already synced.${NC}"
fi

# Check if tag already exists
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
    echo -e "${RED}❌ Tag v${VERSION} already exists!${NC}"
    echo -e "${YELLOW}If you want to re-release, delete the tag first:${NC}"
    echo -e "${YELLOW}  git tag -d v${VERSION}${NC}"
    echo -e "${YELLOW}  git push origin :refs/tags/v${VERSION}${NC}"
    exit 1
fi

# Create git tag
echo -e "${GREEN}🏷️  Creating tag v${VERSION}...${NC}"
git tag -a "v${VERSION}" -m "Release v${VERSION}"

# Push changes and tag
echo -e "${GREEN}⬆️  Pushing changes and tag to GitHub...${NC}"
git push origin "$BRANCH"
git push origin "v${VERSION}"

echo -e "${GREEN}✨ Release process completed!${NC}"
echo -e "${GREEN}🎉 Tag v${VERSION} has been pushed.${NC}"
echo -e "${GREEN}📦 GitHub Actions will now build and create the release.${NC}"
echo -e "${GREEN}🔗 Check progress at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions${NC}"
