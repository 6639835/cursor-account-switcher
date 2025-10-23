# Contributing to Cursor Account Switcher

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other contributors

## Getting Started

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Rust** (latest stable version)
3. **Git**
4. **Platform-specific dependencies:**
   - **Windows:** Visual Studio C++ Build Tools
   - **macOS:** Xcode Command Line Tools
   - **Linux:** See README for package list

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/cursor-account-switcher.git
cd cursor-account-switcher

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/cursor-account-switcher.git
```

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run tauri dev
```

## Development Workflow

### 1. Create a Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write clean, readable code
- Follow the existing code style
- Add comments for complex logic
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run linters
npm run lint

# Check formatting
npm run format:check

# Build the app
npm run build
npm run tauri build
```

### 4. Commit Your Changes

Use clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: add new account import feature"
# or
git commit -m "fix: resolve machine ID reset issue on Windows"
# or
git commit -m "docs: update installation instructions"
```

**Commit Message Prefixes:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### 5. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub:
1. Go to your fork on GitHub
2. Click "Pull Request"
3. Fill out the PR template
4. Wait for CI checks to pass
5. Address review feedback

## Coding Standards

### TypeScript/React

- Use functional components with hooks
- Use TypeScript types (avoid `any`)
- Follow React best practices
- Use meaningful variable names
- Add JSDoc comments for complex functions

**Example:**

```typescript
/**
 * Switches to a different account and resets the machine ID
 * @param accountId - The ID of the account to switch to
 * @returns Promise that resolves when switch is complete
 */
async function switchAccount(accountId: string): Promise<void> {
  // Implementation
}
```

### Rust

- Follow Rust naming conventions
- Use `rustfmt` for formatting
- Handle errors properly (avoid `.unwrap()` in production code)
- Add documentation comments (`///`) for public functions
- Use `clippy` for linting

**Example:**

```rust
/// Resets the machine ID by modifying system files
///
/// # Arguments
/// * `cursor_path` - Path to the Cursor installation directory
///
/// # Returns
/// * `Result<(), String>` - Ok if successful, Err with message if failed
pub fn reset_machine_id(cursor_path: &str) -> Result<(), String> {
    // Implementation
}
```

### Formatting

**Auto-format before committing:**

```bash
# Format TypeScript/React
npm run format:ts

# Format Rust
npm run format:rust

# Or format everything
npm run format
```

## Testing

### Manual Testing

1. Test on your platform (Windows/macOS/Linux)
2. Test all major features:
   - Account switching
   - Machine ID reset
   - Account import
   - Settings management
3. Check for console errors
4. Verify UI responsiveness

### Automated Testing

CI runs automatically on every PR and checks:
- TypeScript linting
- Rust linting
- Code formatting
- Build success on all platforms

**Run CI checks locally:**

```bash
npm run lint
npm run format:check
npm run build
npm run tauri build
```

## Submitting Changes

### Pull Request Checklist

Before submitting, ensure:

- [ ] Code follows project style guidelines
- [ ] All linters pass (`npm run lint`)
- [ ] Code is properly formatted (`npm run format:check`)
- [ ] Manual testing completed
- [ ] Documentation updated (if needed)
- [ ] PR template is filled out
- [ ] Branch is up to date with `main`

### PR Review Process

1. **Automated checks** - CI must pass
2. **Code review** - Maintainers will review your code
3. **Revisions** - Address feedback and push updates
4. **Approval** - Maintainer approves the PR
5. **Merge** - Maintainer merges the PR

## Release Process

Releases are automated via GitHub Actions.

### For Maintainers

To create a new release:

```bash
# 1. Update version
npm version 1.0.1  # or minor, major

# 2. Push tag
git push origin v1.0.1

# 3. GitHub Actions will:
#    - Build for all platforms
#    - Create release
#    - Upload installers
```

See [WORKFLOWS.md](./WORKFLOWS.md) for detailed release documentation.

## Project Structure

```
cursor-account-switcher/
├── src/                    # React frontend
│   ├── pages/             # Page components
│   ├── types/             # TypeScript types
│   └── styles.css         # Tailwind styles
├── src-tauri/             # Rust backend
│   ├── src/               # Rust source code
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri config
├── .github/               # GitHub-specific files
│   ├── workflows/         # CI/CD workflows
│   └── ISSUE_TEMPLATE/    # Issue templates
└── package.json           # Node.js dependencies
```

## Getting Help

- **Questions?** Open a [Discussion](https://github.com/OWNER/cursor-account-switcher/discussions)
- **Found a bug?** Open an [Issue](https://github.com/OWNER/cursor-account-switcher/issues/new?template=bug_report.md)
- **Want a feature?** Open a [Feature Request](https://github.com/OWNER/cursor-account-switcher/issues/new?template=feature_request.md)

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [React Documentation](https://react.dev/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 License.

---

Thank you for contributing! 🎉

