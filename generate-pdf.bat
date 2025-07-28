@echo off
echo Installing PDF generation dependencies...
npm install puppeteer marked

echo.
echo Generating PDF documentation...
node generate-pdf.js

echo.
echo PDF generation complete!
echo Output file: IXFI-Technical-Documentation.pdf

pause
