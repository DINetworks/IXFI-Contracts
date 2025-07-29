@echo off
REM IXFI Documentation Build Script for Windows
REM GitBook-style documentation generation

echo 🚀 Building IXFI Protocol Documentation...

REM Navigate to docs directory
cd docs

REM Check if GitBook CLI is installed
where gitbook >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo 📦 Installing GitBook CLI...
    npm install -g gitbook-cli
)

REM Install GitBook plugins
echo 🔌 Installing GitBook plugins...
npm install

REM Install GitBook dependencies  
echo 📚 Installing GitBook dependencies...
gitbook install

REM Build static documentation
echo 🏗️  Building static documentation...
gitbook build

REM Check for command line arguments
if "%1"=="--pdf" (
    echo 📄 Generating PDF documentation...
    gitbook pdf . ./build/IXFI-Documentation.pdf
)

if "%1"=="--serve" (
    echo 🌐 Starting local documentation server...
    gitbook serve
)

echo ✅ Documentation build complete!
echo 📁 Output directory: docs/_book/
echo 🌐 To serve locally: npm run docs:serve  
echo 📄 To generate PDF: npm run docs:pdf

pause
