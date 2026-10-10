/**
 * Editor Engine Module - Core formatting, selection management,
 * Markdown auto-shortcuts, image drop/paste, and active state tracking.
 */

class RichEditor {
    constructor() {
        this.editor = document.getElementById('editor');
        this.sourceCode = document.getElementById('sourceCode');
        this.savedRange = null;
        this.isSourceView = false;
        this.selectedImage = null;

        this.init();
    }

    init() {
        if (!this.editor) return;

        // Selection listeners
        this.editor.addEventListener('mouseup', () => this.handleSelectionUpdate());
        this.editor.addEventListener('keyup', (e) => this.handleKeyUp(e));
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === this.editor) {
                this.updateToolbarState();
            }
        });

        // Interactive elements within editor (checkboxes, images, links)
        this.editor.addEventListener('click', (e) => this.handleEditorClick(e));
        
        // Markdown auto-shortcuts on keydown
        this.editor.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Drag and drop image upload
        this.editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.editor.style.outline = '2px dashed var(--primary)';
        });
        this.editor.addEventListener('dragleave', () => {
            this.editor.style.outline = 'none';
        });
        this.editor.addEventListener('drop', (e) => this.handleDrop(e));

        // Clipboard paste (handles image paste and clean formatting)
        this.editor.addEventListener('paste', (e) => this.handlePaste(e));
    }

    // Save and restore browser selection
    saveSelection() {
        if (window.getSelection) {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                // Check if range is inside the editor
                if (this.editor.contains(range.commonAncestorContainer)) {
                    this.savedRange = range.cloneRange();
                }
            }
        }
    }

    restoreSelection() {
        if (this.savedRange && window.getSelection) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.savedRange);
        }
    }

    handleSelectionUpdate() {
        this.saveSelection();
        this.updateToolbarState();
    }

    // Standard text formatting execution
    format(command, value = null) {
        if (this.isSourceView) return;
        this.restoreSelection();

        // Standardize background color command across browsers
        if (command === 'hiliteColor' && !document.queryCommandSupported('hiliteColor')) {
            command = 'backColor';
        }

        if (command === 'inlineCode') {
            this.formatInlineCode();
        } else if (command === 'checklist') {
            this.insertChecklist();
        } else if (command === 'horizontalRule') {
            document.execCommand('insertHorizontalRule', false, null);
        } else {
            document.execCommand(command, false, value);
        }

        this.saveSelection();
        this.editor.focus();
        this.updateToolbarState();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }

    // Format Block (H1, H2, H3, H4, P, BLOCKQUOTE, PRE)
    formatBlock(tag) {
        if (this.isSourceView) return;
        this.restoreSelection();
        
        if (tag === 'pre') {
            this.insertCodeBlock();
        } else {
            document.execCommand('formatBlock', false, tag ? `<${tag}>` : '<p>');
        }

        this.saveSelection();
        this.editor.focus();
        this.updateToolbarState();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }

    // Change Font Family
    setFontFamily(font) {
        if (this.isSourceView || !font) return;
        this.restoreSelection();
        document.execCommand('fontName', false, font);
        this.saveSelection();
        this.editor.focus();
    }

    // Change Font Size
    setFontSize(size) {
        if (this.isSourceView || !size) return;
        this.restoreSelection();
        
        // Use document.execCommand fontSize (1-7) or wrap in span with style
        const sel = window.getSelection();
        if (!sel.isCollapsed) {
            const span = document.createElement('span');
            span.style.fontSize = size;
            const range = sel.getRangeAt(0);
            try {
                range.surroundContents(span);
            } catch (err) {
                document.execCommand('fontSize', false, '3');
            }
        }
        this.saveSelection();
        this.editor.focus();
    }

    // Wrap inline selection in <code>
    formatInlineCode() {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) return;

        const range = sel.getRangeAt(0);
        const selectedText = range.extractContents();
        const codeElement = document.createElement('code');
        codeElement.appendChild(selectedText);
        range.insertNode(codeElement);
        
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(codeElement);
        sel.addRange(newRange);
    }

    // Insert preformatted code block
    insertCodeBlock() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = sel.toString() || '// Write code here...';
        pre.appendChild(code);
        
        range.deleteContents();
        range.insertNode(pre);

        // Position cursor inside code block
        const newRange = document.createRange();
        newRange.selectNodeContents(code);
        newRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }

    // Insert Task / Checklist
    insertChecklist() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const ul = document.createElement('ul');
        ul.className = 'task-list';

        const li = document.createElement('li');
        li.className = 'task-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.contentEditable = 'false';

        const span = document.createElement('span');
        span.textContent = sel.toString() || 'Task item';

        li.appendChild(checkbox);
        li.appendChild(span);
        ul.appendChild(li);

        range.deleteContents();
        range.insertNode(ul);

        // Focus inside task span
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }

    // Update active visual buttons on toolbar based on cursor state
    updateToolbarState() {
        if (this.isSourceView) return;

        // Map command buttons to execCommand state
        const commands = [
            { id: 'btn-bold', cmd: 'bold' },
            { id: 'btn-italic', cmd: 'italic' },
            { id: 'btn-underline', cmd: 'underline' },
            { id: 'btn-strike', cmd: 'strikeThrough' },
            { id: 'btn-subscript', cmd: 'subscript' },
            { id: 'btn-superscript', cmd: 'superscript' },
            { id: 'btn-align-left', cmd: 'justifyLeft' },
            { id: 'btn-align-center', cmd: 'justifyCenter' },
            { id: 'btn-align-right', cmd: 'justifyRight' },
            { id: 'btn-align-justify', cmd: 'justifyFull' },
            { id: 'btn-list-bullet', cmd: 'insertUnorderedList' },
            { id: 'btn-list-ordered', cmd: 'insertOrderedList' }
        ];

        commands.forEach(({ id, cmd }) => {
            const btn = document.getElementById(id);
            if (btn) {
                try {
                    const isActive = document.queryCommandState(cmd);
                    btn.classList.toggle('active', !!isActive);
                } catch (e) {
                    btn.classList.remove('active');
                }
            }
        });

        // Update block select dropdown (h1, h2, h3, blockquote, etc.)
        const blockSelect = document.getElementById('formatBlockSelect');
        if (blockSelect) {
            const parentBlock = this.getParentBlockTag();
            if (parentBlock) {
                blockSelect.value = parentBlock.toLowerCase();
            } else {
                blockSelect.value = 'p';
            }
        }
    }

    // Get closest parent block element (h1, h2, etc.)
    getParentBlockTag() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        let node = sel.anchorNode;
        while (node && node !== this.editor) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (['h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'p'].includes(tag)) {
                    return tag;
                }
            }
            node = node.parentNode;
        }
        return null;
    }

    // Handle Editor clicks: link previews, image selections, and checkbox toggles
    handleEditorClick(e) {
        // Handle checkbox toggles in task list
        if (e.target.matches('input[type="checkbox"]')) {
            const li = e.target.closest('li.task-item');
            if (li) {
                li.classList.toggle('completed', e.target.checked);
                if (window.StorageManager) window.StorageManager.triggerAutoSave();
            }
            return;
        }

        // Handle image selection
        if (e.target.tagName === 'IMG') {
            if (this.selectedImage) this.selectedImage.classList.remove('selected');
            this.selectedImage = e.target;
            this.selectedImage.classList.add('selected');
            if (window.ModalManager) window.ModalManager.showImageToolbar(e.target);
            return;
        } else if (this.selectedImage) {
            this.selectedImage.classList.remove('selected');
            this.selectedImage = null;
            if (window.ModalManager) window.ModalManager.hideImageToolbar();
        }

        // Handle link click / preview tooltip
        const linkElem = e.target.closest('a');
        if (linkElem && window.ModalManager) {
            window.ModalManager.showLinkTooltip(linkElem);
        } else if (window.ModalManager) {
            window.ModalManager.hideLinkTooltip();
        }
    }

    // Markdown typing shortcuts
    handleKeyDown(e) {
        if (e.key === ' ') {
            this.checkMarkdownPrefix();
        }
    }

    handleKeyUp(e) {
        this.handleSelectionUpdate();
        if (window.StorageManager) {
            window.StorageManager.updateMetrics();
            window.StorageManager.triggerAutoSave();
        }
    }

    // Check for Markdown syntax (# , ## , ### , > , - , * , 1. , [] )
    checkMarkdownPrefix() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;

        const text = node.textContent;
        const cursorOffset = range.startOffset;
        const textBeforeCursor = text.slice(0, cursorOffset);

        // Heading 1: # 
        if (textBeforeCursor === '#') {
            this.replaceMarkdownPrefix(node, 1, 'h1');
        } else if (textBeforeCursor === '##') {
            this.replaceMarkdownPrefix(node, 2, 'h2');
        } else if (textBeforeCursor === '###') {
            this.replaceMarkdownPrefix(node, 3, 'h3');
        } else if (textBeforeCursor === '>') {
            this.replaceMarkdownPrefix(node, 1, 'blockquote');
        } else if (textBeforeCursor === '-' || textBeforeCursor === '*') {
            node.textContent = node.textContent.slice(1);
            document.execCommand('insertUnorderedList');
        } else if (textBeforeCursor === '1.') {
            node.textContent = node.textContent.slice(2);
            document.execCommand('insertOrderedList');
        } else if (textBeforeCursor === '[]' || textBeforeCursor === '[ ]') {
            node.textContent = node.textContent.slice(cursorOffset);
            this.insertChecklist();
        }
    }

    replaceMarkdownPrefix(textNode, prefixLength, blockTag) {
        textNode.textContent = textNode.textContent.slice(prefixLength).trimStart();
        document.execCommand('formatBlock', false, `<${blockTag}>`);
    }

    // Drag-and-drop Image Handler
    handleDrop(e) {
        e.preventDefault();
        this.editor.style.outline = 'none';

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                this.insertImageFromFile(file);
            }
        }
    }

    // Clipboard Paste Handler (images + rich text)
    handlePaste(e) {
        if (!e.clipboardData || !e.clipboardData.items) return;

        for (const item of e.clipboardData.items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                this.insertImageFromFile(file);
                return;
            }
        }
    }

    // Read File and Insert Image Data URL
    insertImageFromFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            this.insertImage(dataUrl, file.name);
            if (window.App) window.App.showToast('Image inserted from file');
        };
        reader.readAsDataURL(file);
    }

    // Insert Image with Alignment & Alt
    insertImage(url, alt = 'Inserted Image', align = 'center') {
        this.restoreSelection();
        const img = document.createElement('img');
        img.src = url;
        img.alt = alt;
        img.className = `align-${align}`;

        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.insertNode(img);
            range.collapse(false);
        } else {
            this.editor.appendChild(img);
        }

        this.saveSelection();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }

    // Insert Table
    insertTable(rows = 3, cols = 3) {
        this.restoreSelection();
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        for (let c = 0; c < cols; c++) {
            const th = document.createElement('th');
            th.textContent = `Header ${c + 1}`;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (let r = 0; r < rows - 1; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < cols; c++) {
                const td = document.createElement('td');
                td.textContent = `Cell ${r + 1},${c + 1}`;
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.insertNode(table);
            range.collapse(false);
        } else {
            this.editor.appendChild(table);
        }

        this.saveSelection();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }
}

window.RichEditor = RichEditor;
