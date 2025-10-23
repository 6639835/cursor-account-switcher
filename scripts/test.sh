#!/bin/bash

# Test runner script for Cursor Account Switcher
# This script runs both frontend and backend tests

set -e

echo "🧪 Running Cursor Account Switcher Tests"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Run frontend tests
print_status "Running frontend tests..."
if npm run test:frontend; then
    print_success "Frontend tests passed"
else
    print_error "Frontend tests failed"
    exit 1
fi

echo ""

# Run backend tests
print_status "Running backend tests..."
if cd src-tauri && cargo test && cd ..; then
    print_success "Backend tests passed"
else
    print_error "Backend tests failed"
    exit 1
fi

echo ""
print_success "All tests passed! 🎉"

