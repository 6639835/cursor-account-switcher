#!/bin/bash

# Build script for macOS/Linux
echo "🔨 Building Cursor Switcher for production..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔧 Building application..."
npm run tauri build

echo "✅ Build complete!"
echo "📁 Check src-tauri/target/release/bundle/ for the output"

