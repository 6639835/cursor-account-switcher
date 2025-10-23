# Cursor Account Switcher (Tauri Edition)

A high-performance, cross-platform desktop application for managing and switching between multiple Cursor AI accounts. Built with **Tauri**, **Rust**, and **React**.

![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/license-GPL--3.0-green.svg)

## ✨ Features

### 🏠 Dashboard
- **Current Account Info**: Real-time display of logged-in account information
- **Usage Statistics**: Live quota tracking with visual progress bars
- **Quick Actions**: One-click machine ID reset

### 📋 Account Management
- **Account List**: View all accounts with status indicators
- **Batch Import**: Import multiple accounts from formatted text
- **Online Update**: Update all account information from Cursor API
- **Smart Switching**: Switch accounts with automatic machine ID reset
- **Delete Accounts**: Remove unwanted accounts

### ⚙️ Settings
- **Auto-detect Cursor Path**: Automatically finds Cursor installation
- **Machine ID Management**: Reset system identifiers
- **Process Control**: Kill/restart Cursor application

### 📊 Logs
- **Activity Tracking**: View all application operations
- **Export Logs**: Save logs for debugging

## 🚀 Why Tauri?

Compared to the original Python version:

| Feature | Python + PyQt5 | Tauri (This Version) |
|---------|---------------|----------------------|
| **Bundle Size** | ~50-80 MB | ~10-15 MB ⭐ |
| **Startup Time** | ~1-2s | <500ms ⭐ |
| **Memory Usage** | ~50-100 MB | ~30-50 MB ⭐ |
| **UI Performance** | Good | Excellent ⭐ |
| **Modern UI** | Limited | React + Tailwind ⭐ |
| **Cross-platform** | ✅ | ✅ |

## 📦 Installation

### Prerequisites

1. **Node.js** (v18+): [Download](https://nodejs.org/)
2. **Rust** (latest stable): [Install](https://www.rust-lang.org/tools/install)
3. **System Dependencies**:
   - **Windows**: Visual Studio C++ Build Tools
   - **macOS**: Xcode Command Line Tools
   - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

### Quick Start

```bash
# 1. Clone or navigate to the project
cd cursor-switcher-tauri

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run tauri dev

# 4. Build for production
npm run tauri build
```

## 🛠️ Development

### Project Structure

```
cursor-switcher-tauri/
├── src/                    # React frontend
│   ├── pages/             # Page components
│   │   ├── HomePage.tsx
│   │   ├── AccountPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── LogPage.tsx
│   ├── types/             # TypeScript types
│   ├── App.tsx            # Main app component
│   ├── main.tsx          # Entry point
│   └── styles.css        # Tailwind styles
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs           # Tauri commands
│   │   ├── database.rs       # SQLite operations
│   │   ├── csv_manager.rs    # CSV file handling
│   │   ├── api_client.rs     # Cursor API client
│   │   ├── machine_id.rs     # ID generation
│   │   ├── process_utils.rs  # Process management
│   │   ├── path_detector.rs  # Path detection
│   │   ├── reset_machine.rs  # Machine ID reset
│   │   └── types.rs          # Rust types
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
├── package.json          # Node dependencies
└── README.md
```

### Available Scripts

```bash
# Development
npm run dev              # Run Vite dev server
npm run tauri dev        # Run Tauri app in dev mode

# Build
npm run build            # Build frontend
npm run tauri build      # Build complete app

# Preview
npm run preview          # Preview production build

# Testing
npm test                 # Run all tests (frontend + backend)
npm run test:frontend    # Run frontend tests
npm run test:backend     # Run backend tests

# Linting & Formatting
npm run lint             # Lint all code
npm run format           # Format all code
```

## 🧪 Testing

This project includes comprehensive test coverage for both frontend and backend.

### Running Tests

```bash
# Run all tests
npm test

# Run frontend tests only
npm run test:frontend

# Run backend tests only  
npm run test:backend

# Run frontend tests in watch mode
npm run test:frontend:watch

# Run tests with coverage
npm run test:frontend:coverage
```

### Test Coverage

- ✅ **Frontend**: Component tests, integration tests, type tests
- ✅ **Backend**: Unit tests for all modules, integration tests
- ✅ **E2E**: Cross-module workflow tests

For detailed testing documentation, see [TESTING.md](TESTING.md).

## 📋 Usage

### Import Accounts

Format (one per line):
```
【email: test@example.com】【password:】【accessToken: eyJhbGci...】【sessionToken: user_xxx%3A%3A...】
```

### Switch Accounts

1. Go to **Accounts** page
2. Click the switch icon (↻) next to an account
3. Confirm the switch
4. Cursor will close automatically
5. Restart Cursor to use the new account

### Reset Machine ID

**Method 1**: Settings page → "Reset Machine ID" button  
**Method 2**: Home page → "Reset Machine ID" quick action

> **Note**: On Windows, administrator privileges may be required

## 🔧 Building for Distribution

### Windows

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/msi/`

### macOS

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/dmg/`

### Linux

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/deb/` or `appimage/`

## 🤖 Automated Releases (GitHub Actions)

This project includes automated workflows for building and releasing across all platforms.

### Release Workflow

The release workflow automatically builds for Windows, macOS (Intel & Apple Silicon), and Linux.

**Trigger a release:**

1. **Via Git Tag** (Recommended):
   ```bash
   # Update version in package.json and tauri.conf.json
   npm version 1.0.1
   
   # Push tag to trigger release
   git push origin v1.0.1
   ```

2. **Via Manual Dispatch**:
   - Go to Actions tab on GitHub
   - Select "Release" workflow
   - Click "Run workflow"
   - Enter version (e.g., `v1.0.1`)

**What happens:**
- Builds for all platforms in parallel
- Creates installers (`.msi`, `.dmg`, `.deb`, `.AppImage`)
- Creates a draft release on GitHub
- Uploads all artifacts to the release
- Publishes the release when all builds complete

### CI Workflow

Runs on every push and pull request to ensure code quality:

- TypeScript linting and formatting checks
- Rust linting and formatting checks
- Frontend build validation
- Full Tauri build on all platforms

### Workflow Files

- `.github/workflows/release.yml` - Automated release builds
- `.github/workflows/ci.yml` - Continuous integration checks

## 🔐 Security

- **Local Data**: All account data stored in local CSV file
- **No Telemetry**: No data sent to external servers
- **Sandboxed**: Tauri's security model restricts file system access
- **Open Source**: Fully auditable code

## 🐛 Troubleshooting

### Cursor Path Not Detected

Manually set the path in Settings:
- **Windows**: `%APPDATA%\Cursor\User\globalStorage`
- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage`
- **Linux**: `~/.config/Cursor/User/globalStorage`

### Machine ID Reset Fails (Windows)

Run the application as Administrator:
```bash
# Right-click the .exe → "Run as administrator"
```

### Build Fails

```bash
# Clean and rebuild
rm -rf node_modules src-tauri/target
npm install
npm run tauri build
```

## 📄 CSV File Format

```csv
Index,Email,Access Token,Refresh Token,Cookie,Days Remaining,Status,Record Time
1,test@example.com,eyJhbGci...,eyJhbGci...,user_xxx%3A%3A...,28.5,pro,2025-10-22 15:30:00
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](../LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for learning and research purposes only. Do not use it for purposes that violate Cursor's terms of service. Users are solely responsible for any consequences arising from use of this tool.

## 🙏 Acknowledgments

- Original Python version: Cursor Account Switcher Team
- Built with [Tauri](https://tauri.app/)
- UI powered by [React](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)

---

**Version**: 1.0.0  
**Update Date**: 2025-10-23  
**Tech Stack**: Tauri + Rust + React + TypeScript

