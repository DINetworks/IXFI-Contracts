const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const marked = require('marked');

// PDF generation script for IXFI documentation
async function generatePDF() {
    console.log('Starting PDF generation...');
    
    try {
        // Read all markdown files
        const docsPath = __dirname;
        const files = [
            'TECHNICAL_DOCS.md',
            'API_REFERENCE.md',
            'DEPLOYMENT_GUIDE.md',
            'INTEGRATION_EXAMPLES.md',
            'SECURITY_ANALYSIS.md'
        ];
        
        let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>IXFI Technical Documentation</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                h1 {
                    color: #2c3e50;
                    border-bottom: 3px solid #3498db;
                    padding-bottom: 10px;
                    page-break-before: always;
                }
                
                h1:first-child {
                    page-break-before: auto;
                }
                
                h2 {
                    color: #34495e;
                    border-bottom: 2px solid #ecf0f1;
                    padding-bottom: 5px;
                    margin-top: 30px;
                }
                
                h3 {
                    color: #7f8c8d;
                    margin-top: 25px;
                }
                
                code {
                    background-color: #f8f9fa;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9em;
                }
                
                pre {
                    background-color: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 5px;
                    padding: 15px;
                    overflow-x: auto;
                    margin: 15px 0;
                }
                
                pre code {
                    background: none;
                    padding: 0;
                }
                
                blockquote {
                    border-left: 4px solid #3498db;
                    margin: 0;
                    padding-left: 20px;
                    color: #7f8c8d;
                }
                
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 15px 0;
                }
                
                table th,
                table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                
                table th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                
                .page-break {
                    page-break-before: always;
                }
                
                .toc {
                    background-color: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 5px;
                    padding: 20px;
                    margin: 20px 0;
                }
                
                .toc h2 {
                    margin-top: 0;
                    border-bottom: none;
                }
                
                .toc ul {
                    list-style-type: none;
                    padding-left: 0;
                }
                
                .toc li {
                    margin: 5px 0;
                }
                
                .toc a {
                    text-decoration: none;
                    color: #3498db;
                }
                
                .cover-page {
                    text-align: center;
                    padding: 100px 0;
                    page-break-after: always;
                }
                
                .cover-title {
                    font-size: 48px;
                    font-weight: bold;
                    color: #2c3e50;
                    margin-bottom: 20px;
                }
                
                .cover-subtitle {
                    font-size: 24px;
                    color: #7f8c8d;
                    margin-bottom: 40px;
                }
                
                .cover-info {
                    font-size: 16px;
                    color: #95a5a6;
                    line-height: 2;
                }
                
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    
                    h1 {
                        page-break-before: always;
                    }
                    
                    h1:first-child {
                        page-break-before: auto;
                    }
                    
                    pre {
                        page-break-inside: avoid;
                    }
                    
                    table {
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
        `;
        
        // Add cover page
        htmlContent += `
        <div class="cover-page">
            <div class="cover-title">IXFI</div>
            <div class="cover-subtitle">Cross-Chain Protocol<br>Technical Documentation</div>
            <div class="cover-info">
                Version 1.0<br>
                ${new Date().toLocaleDateString()}<br>
                <br>
                Interoperable XFI Protocol<br>
                Cross-Chain Infrastructure & Gasless Transactions
            </div>
        </div>
        `;
        
        // Generate table of contents
        htmlContent += `
        <div class="toc">
            <h2>Table of Contents</h2>
            <ul>
                <li><a href="#technical-overview">1. Technical Overview</a></li>
                <li><a href="#api-reference">2. API Reference</a></li>
                <li><a href="#deployment-guide">3. Deployment Guide</a></li>
                <li><a href="#integration-examples">4. Integration Examples</a></li>
                <li><a href="#security-analysis">5. Security Analysis</a></li>
            </ul>
        </div>
        `;
        
        // Process each markdown file
        const sectionTitles = [
            'Technical Overview',
            'API Reference', 
            'Deployment Guide',
            'Integration Examples',
            'Security Analysis'
        ];
        
        for (let i = 0; i < files.length; i++) {
            const filePath = path.join(docsPath, files[i]);
            if (fs.existsSync(filePath)) {
                console.log(`Processing ${files[i]}...`);
                
                let markdown = fs.readFileSync(filePath, 'utf8');
                
                // Add section title and page break
                htmlContent += `<div class="page-break"></div>`;
                htmlContent += `<h1 id="${sectionTitles[i].toLowerCase().replace(/\s+/g, '-')}">${sectionTitles[i]}</h1>`;
                
                // Remove the first h1 from markdown since we're adding our own
                markdown = markdown.replace(/^#\s+.*$/m, '');
                
                // Convert markdown to HTML
                const html = marked.parse(markdown);
                htmlContent += html;
            }
        }
        
        htmlContent += `
        </body>
        </html>
        `;
        
        // Launch Puppeteer and generate PDF
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set content
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });
        
        console.log('Generating PDF...');
        
        // Generate PDF
        await page.pdf({
            path: 'IXFI-Technical-Documentation.pdf',
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            },
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
                    IXFI Technical Documentation
                </div>
            `,
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                </div>
            `
        });
        
        await browser.close();
        
        console.log('✅ PDF generated successfully: IXFI-Technical-Documentation.pdf');
        
    } catch (error) {
        console.error('❌ Error generating PDF:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    generatePDF();
}

module.exports = { generatePDF };
