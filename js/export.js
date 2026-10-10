/**
 * Export & Import Module - Multi-format export (HTML, Markdown, Plain Text),
 * Print/PDF preview, File Import, and Advanced Clipboard operations.
 */

class ExportManager {
    constructor() {
        this.init();
    }

    init() {
        // Setup file import listener
        const importInput = document.getElementById('fileImportInput');
        if (importInput) {
            importInput.addEventListener('change', (e) => this.handleFileImport(e));
        }
    }

    // Trigger file download
    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Export as complete standalone HTML file
    exportHTML() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const bodyHTML = editor.innerHTML;
        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Export</title>
    <style>
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            line-height: 1.7;
            color: #1e293b;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 20px;
        }
        h1, h2, h3, h4 { margin-top: 1.4em; margin-bottom: 0.5em; line-height: 1.3; }
        blockquote { border-left: 3px solid #71717a; margin: 16px 0; padding: 8px 16px; background: #f4f4f5; font-style: italic; }
        code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        pre { background: #18181b; color: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
        pre code { background: transparent; color: inherit; padding: 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #e4e4e7; padding: 8px 12px; text-align: left; }
        th { background: #f4f4f5; font-weight: 600; }
        img { max-width: 100%; border-radius: 8px; }
        a { color: #18181b; text-decoration: underline; }
        ul.task-list { list-style: none; padding-left: 0; }
        li.task-item { display: flex; align-items: center; gap: 8px; }
    </style>
</head>
<body>
${bodyHTML}
</body>
</html>`;

        this.downloadFile(fullHTML, 'document.html', 'text/html;charset=utf-8');
        if (window.App) window.App.showToast('Exported as HTML');
    }

    // Export as Markdown
    exportMarkdown() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const markdown = this.htmlToMarkdown(editor.innerHTML);
        this.downloadFile(markdown, 'document.md', 'text/markdown;charset=utf-8');
        if (window.App) window.App.showToast('Exported as Markdown');
    }

    // Export as Plain Text
    exportPlainText() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const text = editor.innerText;
        this.downloadFile(text, 'document.txt', 'text/plain;charset=utf-8');
        if (window.App) window.App.showToast('Exported as Plain Text');
    }

    // Print Document / PDF
    printDocument() {
        window.print();
    }

    // Import file (.html, .md, .txt)
    handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        const extension = file.name.split('.').pop().toLowerCase();

        reader.onload = (event) => {
            const content = event.target.result;
            const editor = document.getElementById('editor');

            if (extension === 'html' || extension === 'htm') {
                // If it contains body tag, extract body innerHTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'text/html');
                editor.innerHTML = doc.body.innerHTML || content;
            } else if (extension === 'md') {
                // Convert basic markdown to HTML
                editor.innerHTML = this.markdownToHtml(content);
            } else {
                // Plain text: escape and preserve newlines
                editor.innerText = content;
            }

            if (window.StorageManager) {
                window.StorageManager.updateMetrics();
                window.StorageManager.triggerAutoSave();
            }
            if (window.App) window.App.showToast(`Imported ${file.name}`);
        };

        reader.readAsText(file);
        e.target.value = ''; // Reset input
    }

    // Basic HTML to Markdown Converter
    htmlToMarkdown(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        function traverse(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            const tag = node.tagName.toLowerCase();
            const children = Array.from(node.childNodes).map(traverse).join('');

            switch (tag) {
                case 'h1': return `\n# ${children}\n`;
                case 'h2': return `\n## ${children}\n`;
                case 'h3': return `\n### ${children}\n`;
                case 'h4': return `\n#### ${children}\n`;
                case 'p': return `\n${children}\n`;
                case 'strong':
                case 'b': return `**${children}**`;
                case 'em':
                case 'i': return `*${children}*`;
                case 'u': return `<u>${children}</u>`;
                case 's':
                case 'strike': return `~~${children}~~`;
                case 'code':
                    if (node.parentNode && node.parentNode.tagName === 'PRE') return children;
                    return `\`${children}\``;
                case 'pre': return `\n\`\`\`\n${children.trim()}\n\`\`\`\n`;
                case 'blockquote': return `\n> ${children.trim().replace(/\n/g, '\n> ')}\n`;
                case 'ul':
                    if (node.classList.contains('task-list')) return `\n${children}\n`;
                    return `\n${children}\n`;
                case 'ol': return `\n${children}\n`;
                case 'li':
                    if (node.classList.contains('task-item')) {
                        const checked = node.querySelector('input[type="checkbox"]')?.checked;
                        const label = node.querySelector('span')?.textContent || node.textContent;
                        return `- [${checked ? 'x' : ' '}] ${label.trim()}\n`;
                    }
                    const parent = node.parentNode ? node.parentNode.tagName.toLowerCase() : 'ul';
                    return parent === 'ol' ? `1. ${children.trim()}\n` : `- ${children.trim()}\n`;
                case 'hr': return `\n---\n`;
                case 'a':
                    return `[${children}](${node.getAttribute('href') || ''})`;
                case 'img':
                    return `![${node.getAttribute('alt') || 'image'}](${node.getAttribute('src') || ''})`;
                case 'table':
                    return `\n${children}\n`;
                case 'tr':
                    const cells = Array.from(node.children).map(c => c.textContent.trim());
                    return `| ${cells.join(' | ')} |\n`;
                case 'thead':
                    const headers = Array.from(node.querySelectorAll('th')).map(th => th.textContent.trim());
                    if (headers.length === 0) return children;
                    const sep = headers.map(() => '---');
                    return `| ${headers.join(' | ')} |\n| ${sep.join(' | ')} |\n`;
                case 'tbody': return children;
                case 'br': return '\n';
                default: return children;
            }
        }

        return traverse(temp).trim().replace(/\n{3,}/g, '\n\n');
    }

    // Markdown to HTML parser for file imports
    markdownToHtml(md) {
        let html = md
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
            .replace(/\*(.*?)\*/gim, '<i>$1</i>')
            .replace(/~~(.*?)~~/gim, '<s>$1</s>')
            .replace(/`([^`]+)`/gim, '<code>$1</code>')
            .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2">')
            .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
            .replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>')
            .replace(/\n$/gim, '<br>');
        return html;
    }

    // Copy Content Function (Preserves rich text & fallback support)
    async copyContent() {
        const editor = document.getElementById('editor');
        const sourceCode = document.getElementById('sourceCode');
        const isSourceView = window.App && window.App.isSourceView;

        let plainText, html;

        if (isSourceView) {
            plainText = sourceCode.value;
            if (!plainText.trim()) {
                if (window.App) window.App.showToast('Editor is empty!');
                return;
            }
            try {
                await navigator.clipboard.writeText(plainText);
                if (window.App) window.App.showToast('HTML Source copied!');
            } catch (err) {
                if (window.App) window.App.showToast('Failed to copy');
            }
            return;
        }

        html = editor.innerHTML;
        plainText = editor.innerText;

        if (!plainText.trim() && !html.trim()) {
            if (window.App) window.App.showToast('Editor is empty!');
            return;
        }

        try {
            const htmlBlob = new Blob([html], { type: 'text/html' });
            const textBlob = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({
                'text/html': htmlBlob,
                'text/plain': textBlob
            });

            await navigator.clipboard.write([clipboardItem]);
            if (window.App) window.App.showToast('Rich text copied successfully!');
        } catch (err) {
            console.warn('ClipboardItem failed, falling back to basic text copy.', err);
            try {
                await navigator.clipboard.writeText(plainText);
                if (window.App) window.App.showToast('Copied as plain text (browser fallback)');
            } catch (fallbackErr) {
                if (window.App) window.App.showToast('Failed to copy content');
            }
        }
    }
}

window.ExportManager = ExportManager;
