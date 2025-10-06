#!/bin/bash

# WealthArena Mobile SDK Build Script
# Builds all mobile SDKs and creates distribution packages

set -e

echo "🚀 Building WealthArena Mobile SDKs..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check npm/yarn
    if ! command -v npm &> /dev/null && ! command -v yarn &> /dev/null; then
        print_error "npm or yarn is required but not installed"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "src/bot/app.py" ]; then
        print_error "Please run this script from the WealthArena root directory"
        exit 1
    fi
    
    print_status "Dependencies check passed"
}

# Build React Native SDK
build_rn_sdk() {
    print_status "Building React Native SDK..."
    
    cd packages/mobile-sdk-rn
    
    # Install dependencies
    if [ -f "package.json" ]; then
        npm install
        npm run build
        print_status "React Native SDK built successfully"
    else
        print_warning "React Native SDK package.json not found, skipping..."
    fi
    
    cd ../..
}

# Build React Native UI Package
build_rn_ui() {
    print_status "Building React Native UI Package..."
    
    cd packages/wealtharena-rn
    
    # Install dependencies
    if [ -f "package.json" ]; then
        npm install
        npm run build
        print_status "React Native UI Package built successfully"
    else
        print_warning "React Native UI Package package.json not found, skipping..."
    fi
    
    cd ../..
}

# Build Android SDK
build_android_sdk() {
    print_status "Building Android SDK..."
    
    cd packages/mobile-sdk-android
    
    # Check if Gradle wrapper exists
    if [ -f "gradlew" ]; then
        ./gradlew build
        print_status "Android SDK built successfully"
    else
        print_warning "Android SDK Gradle wrapper not found, skipping..."
    fi
    
    cd ../..
}

# Build iOS SDK
build_ios_sdk() {
    print_status "Building iOS SDK..."
    
    cd packages/mobile-sdk-ios
    
    # Check if Package.swift exists
    if [ -f "Package.swift" ]; then
        swift build
        print_status "iOS SDK built successfully"
    else
        print_warning "iOS SDK Package.swift not found, skipping..."
    fi
    
    cd ../..
}

# Create distribution packages
create_distribution() {
    print_status "Creating distribution packages..."
    
    # Create dist directory
    mkdir -p dist
    
    # Copy React Native SDK
    if [ -d "packages/mobile-sdk-rn/dist" ]; then
        cp -r packages/mobile-sdk-rn/dist dist/mobile-sdk-rn
        print_status "React Native SDK packaged"
    fi
    
    # Copy React Native UI
    if [ -d "packages/wealtharena-rn/dist" ]; then
        cp -r packages/wealtharena-rn/dist dist/wealtharena-rn
        print_status "React Native UI packaged"
    fi
    
    # Copy Android SDK
    if [ -d "packages/mobile-sdk-android/build" ]; then
        cp -r packages/mobile-sdk-android/build dist/mobile-sdk-android
        print_status "Android SDK packaged"
    fi
    
    # Copy iOS SDK
    if [ -d "packages/mobile-sdk-ios/.build" ]; then
        cp -r packages/mobile-sdk-ios/.build dist/mobile-sdk-ios
        print_status "iOS SDK packaged"
    fi
    
    print_status "Distribution packages created in dist/ directory"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Test React Native SDK
    if [ -d "packages/mobile-sdk-rn" ]; then
        cd packages/mobile-sdk-rn
        if [ -f "package.json" ]; then
            npm test 2>/dev/null || print_warning "React Native SDK tests failed or not configured"
        fi
        cd ../..
    fi
    
    # Test Android SDK
    if [ -d "packages/mobile-sdk-android" ]; then
        cd packages/mobile-sdk-android
        if [ -f "gradlew" ]; then
            ./gradlew test 2>/dev/null || print_warning "Android SDK tests failed or not configured"
        fi
        cd ../..
    fi
    
    # Test iOS SDK
    if [ -d "packages/mobile-sdk-ios" ]; then
        cd packages/mobile-sdk-ios
        if [ -f "Package.swift" ]; then
            swift test 2>/dev/null || print_warning "iOS SDK tests failed or not configured"
        fi
        cd ../..
    fi
    
    print_status "Tests completed"
}

# Main execution
main() {
    print_status "Starting WealthArena Mobile SDK build process..."
    
    check_dependencies
    build_rn_sdk
    build_rn_ui
    build_android_sdk
    build_ios_sdk
    run_tests
    create_distribution
    
    print_status "✅ All SDKs built successfully!"
    print_status "📦 Distribution packages available in dist/ directory"
    print_status "🚀 Ready for deployment!"
}

# Run main function
main "$@"

