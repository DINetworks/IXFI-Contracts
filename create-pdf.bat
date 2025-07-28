@echo off
echo Generating HTML documentation...
node generate-html.js

echo.
echo Opening HTML file for PDF conversion...
start "" "IXFI-Technical-Documentation.html"

echo.
echo =========================================
echo  PDF Conversion Instructions
echo =========================================
echo 1. The HTML file should open in your browser
echo 2. Press Ctrl+P to open print dialog
echo 3. Select "Save as PDF" as destination
echo 4. Recommended settings:
echo    - Paper size: A4
echo    - Margins: Default
echo    - Options: Background graphics ON
echo 5. Click "Save" and choose location
echo.
echo The PDF will be professionally formatted!
echo =========================================

pause
