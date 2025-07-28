const fs = require('fs');
const path = require('path');

// Simple HTML to PDF converter (without Puppeteer)
function generateHTML() {
    console.log('Generating HTML documentation...');
    
    try {
        // Read all markdown files
        const docsPath = __dirname;
        const files = [
            { name: 'TECHNICAL_DOCS.md', title: 'Technical Overview' },
            { name: 'API_REFERENCE.md', title: 'API Reference' },
            { name: 'DEPLOYMENT_GUIDE.md', title: 'Deployment Guide' },
            { name: 'INTEGRATION_EXAMPLES.md', title: 'Integration Examples' },
            { name: 'SECURITY_ANALYSIS.md', title: 'Security Analysis' }
        ];
        
        let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>IXFI Technical Documentation</title>
    <style>
        body {
            font-family: Georgia, 'Times New Roman', Times, serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        
        .cover-page {
            text-align: center;
            padding: 100px 0;
            page-break-after: always;
            border-bottom: 3px solid #0066cc;
            margin-bottom: 60px;
        }
        
        .cover-title {
            font-size: 4em;
            font-weight: bold;
            color: #0066cc;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        
        .cover-subtitle {
            font-size: 1.8em;
            color: #666;
            margin-bottom: 40px;
            font-weight: 300;
        }
        
        .cover-info {
            font-size: 1.1em;
            color: #888;
            line-height: 2;
        }
        
        .toc {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-radius: 10px;
            padding: 30px;
            margin: 40px 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            page-break-inside: avoid;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .toc h2 {
            margin-top: 0;
            color: #0066cc;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 10px;
        }
        
        .toc ul {
            list-style: none;
            padding-left: 0;
        }
        
        .toc li {
            margin: 12px 0;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.3);
        }
        
        .toc a {
            text-decoration: none;
            color: #0066cc;
            font-weight: 500;
            font-size: 1.1em;
        }
        
        .toc a:hover {
            color: #004499;
        }
        
        h1 {
            color: #0066cc;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 15px;
            page-break-before: always;
            margin-top: 60px;
            font-size: 2.5em;
        }
        
        h1:first-child {
            page-break-before: auto;
            margin-top: 0;
        }
        
        h2 {
            color: #004499;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 8px;
            margin-top: 40px;
            font-size: 1.8em;
        }
        
        h3 {
            color: #666;
            margin-top: 30px;
            font-size: 1.4em;
        }
        
        h4 {
            color: #888;
            margin-top: 25px;
            font-size: 1.2em;
        }
        
        code {
            background-color: #f8f9fa;
            padding: 3px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 0.9em;
            color: #d63384;
        }
        
        pre {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            overflow-x: auto;
            margin: 20px 0;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
            page-break-inside: avoid;
            white-space: pre;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            line-height: 1.4;
        }
        
        pre code {
            background: none;
            padding: 0;
            color: #495057;
            font-size: inherit;
            white-space: pre;
            display: block;
        }
        
        blockquote {
            border-left: 4px solid #0066cc;
            margin: 20px 0;
            padding: 15px 20px;
            background-color: #f8f9fa;
            color: #666;
            border-radius: 0 8px 8px 0;
        }
        
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        
        table th,
        table td {
            border: 1px solid #ddd;
            padding: 12px 15px;
            text-align: left;
        }
        
        table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.9em;
            letter-spacing: 0.5px;
        }
        
        table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        
        table tr:hover {
            background-color: #e8f4f8;
        }
        
        ul, ol {
            padding-left: 30px;
        }
        
        li {
            margin: 8px 0;
        }
        
        .section {
            margin-bottom: 60px;
        }
        
        .highlight {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        
        .note {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        
        .diagram {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            white-space: pre;
            overflow-x: auto;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            border: 2px solid #5a67d8;
            text-align: center;
            font-weight: bold;
            page-break-inside: avoid;
        }
        
        .code-section {
            page-break-inside: avoid;
        }
        
        @media print {
            body {
                margin: 0;
                padding: 20px;
            }
            
            h1 {
                page-break-before: always;
            }
            
            h1:first-child {
                page-break-before: auto;
            }
            
            pre, table, blockquote {
                page-break-inside: avoid;
            }
            
            .code-section {
                page-break-inside: avoid;
            }
            
            .diagram {
                page-break-inside: avoid;
            }
            
            .cover-page {
                page-break-after: always;
            }
            
            .toc {
                page-break-inside: avoid;
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
`;
        
        // Add cover page
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long', 
            day: 'numeric'
        });
        
        htmlContent += `
<div class="cover-page">
    <div class="cover-title">IXFI</div>
    <div class="cover-subtitle">Cross-Chain Protocol<br>Technical Documentation</div>
    <div class="cover-info">
        <strong>Version 1.0</strong><br>
        ${currentDate}<br>
        <br>
        Interoperable XFI Protocol<br>
        Cross-Chain Infrastructure & Gasless Transactions<br>
        <br>
        <em>Comprehensive Documentation Package</em>
    </div>
</div>
`;
        
        // Generate table of contents
        htmlContent += `
<div class="toc">
    <h2>📚 Table of Contents</h2>
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
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = path.join(docsPath, file.name);
            
            if (fs.existsSync(filePath)) {
                console.log(`Processing ${file.name}...`);
                
                let markdown = fs.readFileSync(filePath, 'utf8');
                
                // Add section with ID
                const sectionId = file.title.toLowerCase().replace(/\s+/g, '-');
                htmlContent += `<div class="section">`;
                htmlContent += `<h1 id="${sectionId}">${i + 1}. ${file.title}</h1>`;
                
                // Convert basic markdown to HTML
                const html = convertMarkdownToHTML(markdown);
                htmlContent += html;
                htmlContent += `</div>`;
            }
        }
        
        htmlContent += `
</body>
</html>
`;
        
        // Write HTML file
        const outputPath = path.join(docsPath, 'IXFI-Technical-Documentation.html');
        fs.writeFileSync(outputPath, htmlContent, 'utf8');
        
        console.log('✅ HTML documentation generated successfully!');
        console.log(`📄 File: ${outputPath}`);
        console.log('');
        console.log('📋 To convert to PDF:');
        console.log('1. Open the HTML file in Chrome/Edge');
        console.log('2. Press Ctrl+P to print');
        console.log('3. Select "Save as PDF" as destination');
        console.log('4. Choose appropriate settings and save');
        console.log('');
        console.log('🎨 The HTML file includes print-optimized CSS for best PDF results');
        
    } catch (error) {
        console.error('❌ Error generating HTML:', error);
        process.exit(1);
    }
}

function convertMarkdownToHTML(markdown) {
    // Simple markdown to HTML converter
    let html = markdown;
    
    // Remove the first h1 since we add our own section title
    html = html.replace(/^#\s+.*$/m, '');
    
    // Convert diagrams (ASCII art in code blocks) to styled diagrams - must be first
    html = html.replace(/```\n([\s\S]*?┌[\s\S]*?┘[\s\S]*?)\n```/g, '<div class="diagram">$1</div>');
    html = html.replace(/```\n([\s\S]*?├[\s\S]*?┤[\s\S]*?)\n```/g, '<div class="diagram">$1</div>');
    html = html.replace(/```\n([\s\S]*?│[\s\S]*?│[\s\S]*?)\n```/g, function(match, content) {
        if (content.includes('┌') || content.includes('├') || content.includes('└')) {
            return '<div class="diagram">' + content + '</div>';
        }
        return match;
    });
    
    // Convert code blocks with language specification
    html = html.replace(/```(\w+)?\n?([\s\S]*?)\n?```/gims, function(match, language, code) {
        // Preserve whitespace and indentation
        const preservedCode = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        return `<div class="code-section"><pre><code>${preservedCode}</code></pre></div>`;
    });
    
    // Convert inline code (after code blocks to avoid conflicts)
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    
    // Convert headers
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Convert bold text (avoid code blocks)
    html = html.replace(/\*\*((?:(?!\*\*).)*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert italic text (avoid code blocks)
    html = html.replace(/\*((?:(?!\*).)*?)\*/g, '<em>$1</em>');
    
    // Convert links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Convert tables first (before paragraph processing)
    html = html.replace(/^\|(.+)\|\s*$/gm, function(match, content) {
        const cells = content.split('|').map(cell => cell.trim()).filter(cell => cell);
        const isHeader = match.includes('---') || match.includes('===');
        const tag = isHeader ? 'th' : 'td';
        return '<tr>' + cells.map(cell => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
    });
    
    // Remove table separator lines
    html = html.replace(/^\|[-\s|:]+\|\s*$/gm, '');
    
    // Wrap consecutive table rows
    html = html.replace(/(<tr>.*<\/tr>\s*)+/gs, '<table>$&</table>');
    
    // Convert paragraphs (split by double newlines, but preserve code blocks)
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs.map(p => {
        // Skip if it's already a block element
        if (p.trim().match(/^<(div|pre|table|h[1-6]|ul|ol|blockquote)/)) {
            return p.trim();
        }
        // Skip if it's empty
        if (!p.trim()) {
            return '';
        }
        // Convert single newlines to <br> within paragraphs
        const content = p.trim().replace(/\n/g, '<br>');
        return `<p>${content}</p>`;
    }).filter(p => p).join('\n\n');
    
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*<br>\s*<\/p>/g, '');
    
    return html;
}

// Run the script
if (require.main === module) {
    generateHTML();
}

module.exports = { generateHTML };
