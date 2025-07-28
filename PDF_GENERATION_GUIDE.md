# PDF Generation Guide

This guide explains how to generate a PDF version of the IXFI technical documentation.

## Prerequisites

- Node.js >= 14.0.0
- npm or yarn package manager

## Installation

1. **Install dependencies:**

```bash
# Copy the PDF package.json
cp pdf-package.json package-pdf.json

# Install PDF generation dependencies
npm install puppeteer marked
```

## Generate PDF

### Method 1: Using the Script

```bash
# Run the PDF generation script
node generate-pdf.js
```

### Method 2: Using npm script

```bash
# Install dependencies first
npm run install-deps

# Generate PDF
npm run generate-pdf
```

## Output

The script will generate a file named `IXFI-Technical-Documentation.pdf` in the current directory.

## PDF Features

### Document Structure
- **Cover Page**: Professional title page with project information
- **Table of Contents**: Linked navigation to all sections
- **Five Main Sections**:
  1. Technical Overview
  2. API Reference
  3. Deployment Guide
  4. Integration Examples
  5. Security Analysis

### Formatting Features
- Professional typography with consistent styling
- Syntax highlighting for code blocks
- Properly formatted tables and diagrams
- Page breaks between major sections
- Header and footer with page numbers
- Print-optimized layout

### Styling
- Clean, professional design
- Consistent color scheme
- Readable fonts and spacing
- Code blocks with syntax highlighting
- Tables with proper borders and headers
- Blockquotes for important information

## Customization

### Modify Styling

Edit the CSS in `generate-pdf.js` to customize:
- Colors and fonts
- Layout and spacing
- Page margins
- Header/footer content

### Add/Remove Sections

Modify the `files` array in `generate-pdf.js`:

```javascript
const files = [
    'TECHNICAL_DOCS.md',
    'API_REFERENCE.md',
    'DEPLOYMENT_GUIDE.md',
    'INTEGRATION_EXAMPLES.md',
    'SECURITY_ANALYSIS.md'
    // Add your custom markdown files here
];
```

### Change PDF Options

Modify the `page.pdf()` options:

```javascript
await page.pdf({
    path: 'IXFI-Technical-Documentation.pdf',
    format: 'A4', // or 'Letter', 'Legal', etc.
    printBackground: true,
    margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
    }
    // Add more options as needed
});
```

## Troubleshooting

### Common Issues

1. **Puppeteer Installation Error**:
   ```bash
   # Try installing with legacy peer deps
   npm install puppeteer --legacy-peer-deps
   ```

2. **Missing Dependencies**:
   ```bash
   # Install all required packages
   npm install puppeteer marked
   ```

3. **Permission Errors**:
   - Ensure you have write permissions in the directory
   - Try running as administrator/sudo if needed

4. **Memory Issues**:
   - Close other applications
   - Increase Node.js memory limit:
   ```bash
   node --max-old-space-size=4096 generate-pdf.js
   ```

### Debug Mode

Add debug logging to the script:

```javascript
// Add this to see more detailed output
console.log('Current working directory:', process.cwd());
console.log('Available files:', fs.readdirSync('.'));
```

## Alternative Methods

### Using Pandoc

If you have Pandoc installed:

```bash
# Install pandoc (Windows)
choco install pandoc

# Generate PDF using pandoc
pandoc TECHNICAL_DOCS.md API_REFERENCE.md DEPLOYMENT_GUIDE.md INTEGRATION_EXAMPLES.md SECURITY_ANALYSIS.md -o IXFI-Documentation.pdf --pdf-engine=wkhtmltopdf
```

### Using VSCode Extension

1. Install "Markdown PDF" extension in VSCode
2. Open any markdown file
3. Press `Ctrl+Shift+P` and run "Markdown PDF: Export (pdf)"

### Manual HTML to PDF

1. Run the script to generate HTML only:
   ```javascript
   // Modify generate-pdf.js to save HTML instead
   fs.writeFileSync('documentation.html', htmlContent);
   ```

2. Open HTML in browser and print to PDF

## Advanced Configuration

### Custom CSS

Create a separate CSS file:

```css
/* custom-styles.css */
.custom-section {
    background-color: #f8f9fa;
    padding: 20px;
    margin: 20px 0;
    border-radius: 5px;
}
```

### Multiple PDF Outputs

Generate separate PDFs for each section:

```javascript
// Modify the script to generate individual PDFs
for (const file of files) {
    await generateSectionPDF(file);
}
```

## File Structure

```
IXFI-Contracts/
├── generate-pdf.js           # PDF generation script
├── pdf-package.json          # Dependencies for PDF generation
├── TECHNICAL_DOCS.md         # Main technical documentation
├── API_REFERENCE.md          # API documentation
├── DEPLOYMENT_GUIDE.md       # Deployment instructions
├── INTEGRATION_EXAMPLES.md   # Integration examples
├── SECURITY_ANALYSIS.md      # Security analysis
└── IXFI-Technical-Documentation.pdf  # Generated PDF output
```

## Tips

1. **Review Before Distribution**: Always review the generated PDF for formatting issues
2. **Version Control**: Include PDF generation date in the document
3. **File Size**: The PDF will be approximately 2-5MB depending on content
4. **Updates**: Regenerate PDF whenever documentation is updated
5. **Backup**: Keep both markdown and PDF versions in version control

This PDF generation system provides a professional way to distribute your technical documentation in a format suitable for printing, sharing, and archiving.
