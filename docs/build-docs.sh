#!/bin/bash

# IXFI Documentation Build Script
# GitBook-style documentation generation

echo "🚀 Building IXFI Protocol Documentation..."

# Navigate to docs directory
cd docs

# Install GitBook CLI if not present
if ! command -v gitbook &> /dev/null; then
    echo "📦 Installing GitBook CLI..."
    npm install -g gitbook-cli
fi

# Install GitBook plugins
echo "🔌 Installing GitBook plugins..."
npm install

# Install GitBook dependencies
echo "📚 Installing GitBook dependencies..."
gitbook install

# Build static documentation
echo "🏗️  Building static documentation..."
gitbook build

# Optional: Build PDF
if [ "$1" = "--pdf" ]; then
    echo "📄 Generating PDF documentation..."
    gitbook pdf . ./build/IXFI-Documentation.pdf
fi

# Optional: Serve locally
if [ "$1" = "--serve" ]; then
    echo "🌐 Starting local documentation server..."
    gitbook serve
fi

echo "✅ Documentation build complete!"
echo "📁 Output directory: docs/_book/"
echo "🌐 To serve locally: npm run docs:serve"
echo "📄 To generate PDF: npm run docs:pdf"
