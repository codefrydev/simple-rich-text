/**
 * Modals & Dialogs Module - Link Modal, Floating Tooltips,
 * Image Inserter, Table Generator & Context Controls, Find & Replace.
 */

class ModalManager {
    constructor() {
        this.activeModal = null;
        this.activeLink = null;
        this.activeTable = null;
        this.activeTableCell = null;

        // Find & Replace State
        this.searchResults = [];
        this.currentSearchIndex = -1;

        this.init();
    }

    init() {
        // Close modal on escape or backdrop click
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
                this.closeFindReplace();
            }
        });

        // Close on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });

        // Table grid picker hover logic
        this.setupTableGridPicker();

        // Track table cell focus inside editor
        document.getElementById('editor').addEventListener('click', (e) => {
            const td = e.target.closest('td, th');
            if (td) {
                this.activeTableCell = td;
                this.activeTable = td.closest('table');
                this.showTableToolbar(td);
            } else {
                this.hideTableToolbar();
            }
        });
    }

    closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(modal => {
            modal.classList.remove('show');
        });
        this.activeModal = null;
    }

    openModal(modalId) {
        this.closeAllModals();
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            this.activeModal = modal;
            
            // Focus first input
            const firstInput = modal.querySelector('input:not([type="hidden"]), select');
            if (firstInput) setTimeout(() => firstInput.focus(), 50);
        }
    }

    /* --------------------------------------------------------------------------
       Link Modal & Tooltip
       -------------------------------------------------------------------------- */
    openLinkModal() {
        if (!window.editor) return;
        window.editor.saveSelection();

        const urlInput = document.getElementById('linkModalUrl');
        const textInput = document.getElementById('linkModalText');
        const targetCheck = document.getElementById('linkModalTarget');

        const sel = window.getSelection();
        let selectedText = '';
        let currentUrl = '';
        let openInNew = true;

        // Check if cursor is on an existing link
        let anchor = null;
        if (sel.rangeCount > 0) {
            let node = sel.anchorNode;
            while (node && node !== window.editor.editor) {
                if (node.tagName === 'A') {
                    anchor = node;
                    break;
                }
                node = node.parentNode;
            }
        }

        if (anchor) {
            this.activeLink = anchor;
            currentUrl = anchor.getAttribute('href') || '';
            selectedText = anchor.textContent || '';
            openInNew = anchor.getAttribute('target') === '_blank';
        } else {
            this.activeLink = null;
            selectedText = sel.toString();
        }

        urlInput.value = currentUrl;
        textInput.value = selectedText;
        targetCheck.checked = openInNew;

        this.openModal('linkModal');
    }

    saveLink() {
        const urlInput = document.getElementById('linkModalUrl');
        const textInput = document.getElementById('linkModalText');
        const targetCheck = document.getElementById('linkModalTarget');

        const url = urlInput.value.trim();
        const text = textInput.value.trim();
        const target = targetCheck.checked ? '_blank' : '_self';

        if (!url) {
            if (window.App) window.App.showToast('Please enter a valid URL');
            return;
        }

        window.editor.restoreSelection();

        if (this.activeLink) {
            // Edit existing link
            this.activeLink.setAttribute('href', url);
            this.activeLink.setAttribute('target', target);
            if (text) this.activeLink.textContent = text;
        } else {
            // Create new link
            if (text) {
                const a = document.createElement('a');
                a.href = url;
                a.target = target;
                a.textContent = text;
                const sel = window.getSelection();
                if (sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(a);
                } else {
                    window.editor.editor.appendChild(a);
                }
            } else {
                document.execCommand('createLink', false, url);
            }
        }

        this.closeAllModals();
        this.hideLinkTooltip();
        window.editor.saveSelection();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
        if (window.App) window.App.showToast('Link inserted successfully');
    }

    removeLink() {
        if (this.activeLink) {
            const parent = this.activeLink.parentNode;
            while (this.activeLink.firstChild) {
                parent.insertBefore(this.activeLink.firstChild, this.activeLink);
            }
            parent.removeChild(this.activeLink);
            this.activeLink = null;
            this.hideLinkTooltip();
            if (window.StorageManager) window.StorageManager.triggerAutoSave();
            if (window.App) window.App.showToast('Link removed');
        } else {
            document.execCommand('unlink', false, null);
            this.hideLinkTooltip();
        }
    }

    showLinkTooltip(anchor) {
        this.activeLink = anchor;
        const tooltip = document.getElementById('linkTooltip');
        const linkUrlSpan = document.getElementById('linkTooltipUrl');
        if (!tooltip || !linkUrlSpan) return;

        const href = anchor.getAttribute('href') || '#';
        linkUrlSpan.textContent = href;
        linkUrlSpan.href = href;

        const rect = anchor.getBoundingClientRect();
        const containerRect = document.querySelector('.editor-wrapper').getBoundingClientRect();

        tooltip.style.left = `${rect.left - containerRect.left}px`;
        tooltip.style.top = `${rect.bottom - containerRect.top + 8}px`;
        tooltip.style.display = 'flex';
    }

    hideLinkTooltip() {
        const tooltip = document.getElementById('linkTooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    /* --------------------------------------------------------------------------
       Image Modal & Actions
       -------------------------------------------------------------------------- */
    openImageModal() {
        if (!window.editor) return;
        window.editor.saveSelection();

        document.getElementById('imageUrlInput').value = '';
        document.getElementById('imageAltInput').value = '';
        document.getElementById('imageFileInput').value = '';
        document.getElementById('imagePreviewContainer').style.display = 'none';

        this.openModal('imageModal');
    }

    handleImageFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const previewImg = document.getElementById('imageModalPreview');
                previewImg.src = event.target.result;
                document.getElementById('imagePreviewContainer').style.display = 'block';
                document.getElementById('imageUrlInput').value = '';
            };
            reader.readAsDataURL(file);
        }
    }

    saveImage() {
        const urlInput = document.getElementById('imageUrlInput');
        const altInput = document.getElementById('imageAltInput');
        const alignSelect = document.getElementById('imageAlignSelect');
        const previewImg = document.getElementById('imageModalPreview');

        let src = urlInput.value.trim();
        if (!src && previewImg && previewImg.src && previewImg.src.startsWith('data:')) {
            src = previewImg.src;
        }

        if (!src) {
            if (window.App) window.App.showToast('Please provide an image URL or choose a file');
            return;
        }

        const alt = altInput.value.trim() || 'Image';
        const align = alignSelect.value || 'center';

        window.editor.insertImage(src, alt, align);
        this.closeAllModals();
        if (window.App) window.App.showToast('Image inserted');
    }

    showImageToolbar(img) {
        // Quick visual indicators on image selection
    }

    hideImageToolbar() {
        // Clear selection
    }

    /* --------------------------------------------------------------------------
       Table Modal & Actions
       -------------------------------------------------------------------------- */
    openTableModal() {
        if (!window.editor) return;
        window.editor.saveSelection();
        this.openModal('tableModal');
    }

    setupTableGridPicker() {
        const container = document.getElementById('tableGridPicker');
        if (!container) return;

        container.innerHTML = '';
        const size = 8;

        for (let r = 1; r <= size; r++) {
            for (let c = 1; c <= size; c++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                cell.addEventListener('mouseover', () => this.highlightGrid(r, c));
                cell.addEventListener('click', () => {
                    window.editor.insertTable(r, c);
                    this.closeAllModals();
                    if (window.App) window.App.showToast(`Table inserted (${r}x${c})`);
                });

                container.appendChild(cell);
            }
        }
    }

    highlightGrid(maxR, maxC) {
        const cells = document.querySelectorAll('.grid-cell');
        const label = document.getElementById('gridSizeLabel');
        if (label) label.textContent = `${maxR} rows x ${maxC} cols`;

        cells.forEach(cell => {
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
            cell.classList.toggle('highlight', r <= maxR && c <= maxC);
        });
    }

    showTableToolbar(cell) {
        const toolbar = document.getElementById('tableContextToolbar');
        if (!toolbar) return;

        const rect = cell.getBoundingClientRect();
        const containerRect = document.querySelector('.editor-wrapper').getBoundingClientRect();

        toolbar.style.left = `${Math.max(10, rect.left - containerRect.left)}px`;
        toolbar.style.top = `${Math.max(10, rect.top - containerRect.top - 36)}px`;
        toolbar.style.display = 'flex';
    }

    hideTableToolbar() {
        const toolbar = document.getElementById('tableContextToolbar');
        if (toolbar) toolbar.style.display = 'none';
    }

    // Table modification operations
    insertRow(position = 'below') {
        if (!this.activeTableCell) return;
        const row = this.activeTableCell.closest('tr');
        const table = row.closest('table');
        const colCount = row.children.length;

        const newRow = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
            const td = document.createElement('td');
            td.textContent = 'New cell';
            newRow.appendChild(td);
        }

        if (position === 'above') {
            row.parentNode.insertBefore(newRow, row);
        } else {
            row.parentNode.insertBefore(newRow, row.nextSibling);
        }

        this.hideTableToolbar();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }

    insertColumn(position = 'right') {
        if (!this.activeTableCell) return;
        const cellIndex = this.activeTableCell.cellIndex;
        const table = this.activeTableCell.closest('table');

        Array.from(table.rows).forEach((row) => {
            const isHeader = row.parentNode.tagName === 'THEAD';
            const newCell = document.createElement(isHeader ? 'th' : 'td');
            newCell.textContent = isHeader ? 'Col' : 'Cell';

            if (position === 'left') {
                row.insertBefore(newCell, row.cells[cellIndex]);
            } else {
                row.insertBefore(newCell, row.cells[cellIndex + 1] || null);
            }
        });

        this.hideTableToolbar();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }

    deleteCurrentRow() {
        if (!this.activeTableCell) return;
        const row = this.activeTableCell.closest('tr');
        const table = row.closest('table');
        row.remove();

        if (table.rows.length === 0) {
            table.remove();
        }
        this.hideTableToolbar();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }

    deleteCurrentColumn() {
        if (!this.activeTableCell) return;
        const cellIndex = this.activeTableCell.cellIndex;
        const table = this.activeTableCell.closest('table');

        Array.from(table.rows).forEach((row) => {
            if (row.cells[cellIndex]) {
                row.cells[cellIndex].remove();
            }
        });

        if (table.rows.length > 0 && table.rows[0].cells.length === 0) {
            table.remove();
        }
        this.hideTableToolbar();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }

    deleteActiveTable() {
        if (this.activeTable) {
            this.activeTable.remove();
            this.activeTable = null;
            this.activeTableCell = null;
            this.hideTableToolbar();
            if (window.StorageManager) window.StorageManager.triggerAutoSave();
            if (window.App) window.App.showToast('Table deleted');
        }
    }

    /* --------------------------------------------------------------------------
       Find & Replace Panel
       -------------------------------------------------------------------------- */
    toggleFindReplace() {
        const bar = document.getElementById('findReplaceBar');
        if (!bar) return;

        const isShowing = bar.classList.contains('show');
        if (isShowing) {
            this.closeFindReplace();
        } else {
            bar.classList.add('show');
            const findInput = document.getElementById('findInput');
            if (findInput) {
                findInput.focus();
                findInput.select();
            }
            this.performSearch();
        }
    }

    closeFindReplace() {
        const bar = document.getElementById('findReplaceBar');
        if (bar) bar.classList.remove('show');
        this.clearSearchHighlights();
    }

    clearSearchHighlights() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const marks = editor.querySelectorAll('mark.search-match');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            mark.remove();
        });
        this.searchResults = [];
        this.currentSearchIndex = -1;
        this.updateSearchCounter();
    }

    performSearch() {
        this.clearSearchHighlights();
        const query = document.getElementById('findInput').value;
        const matchCase = document.getElementById('matchCaseCheck').checked;
        const editor = document.getElementById('editor');

        if (!query || !editor) {
            this.updateSearchCounter();
            return;
        }

        const treeWalker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let currentNode;
        while ((currentNode = treeWalker.nextNode())) {
            textNodes.push(currentNode);
        }

        const matches = [];
        const flags = matchCase ? 'g' : 'gi';
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedQuery, flags);

        textNodes.forEach(node => {
            let match;
            const text = node.textContent;
            const nodeMatches = [];

            while ((match = regex.exec(text)) !== null) {
                nodeMatches.push({
                    start: match.index,
                    end: match.index + match[0].length
                });
            }

            // Split and wrap in mark
            if (nodeMatches.length > 0) {
                let lastIndex = 0;
                const frag = document.createDocumentFragment();

                nodeMatches.forEach(m => {
                    if (m.start > lastIndex) {
                        frag.appendChild(document.createTextNode(text.substring(lastIndex, m.start)));
                    }
                    const mark = document.createElement('mark');
                    mark.className = 'search-match';
                    mark.textContent = text.substring(m.start, m.end);
                    frag.appendChild(mark);
                    matches.push(mark);
                    lastIndex = m.end;
                });

                if (lastIndex < text.length) {
                    frag.appendChild(document.createTextNode(text.substring(lastIndex)));
                }

                node.parentNode.replaceChild(frag, node);
            }
        });

        this.searchResults = matches;
        this.currentSearchIndex = matches.length > 0 ? 0 : -1;
        this.highlightCurrentMatch();
        this.updateSearchCounter();
    }

    highlightCurrentMatch() {
        this.searchResults.forEach((m, idx) => {
            m.classList.toggle('current', idx === this.currentSearchIndex);
        });

        if (this.currentSearchIndex >= 0 && this.searchResults[this.currentSearchIndex]) {
            this.searchResults[this.currentSearchIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    findNext() {
        if (this.searchResults.length === 0) return;
        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
        this.highlightCurrentMatch();
        this.updateSearchCounter();
    }

    findPrev() {
        if (this.searchResults.length === 0) return;
        this.currentSearchIndex = (this.currentSearchIndex - 1 + this.searchResults.length) % this.searchResults.length;
        this.highlightCurrentMatch();
        this.updateSearchCounter();
    }

    replaceCurrent() {
        if (this.currentSearchIndex < 0 || !this.searchResults[this.currentSearchIndex]) return;

        const replaceText = document.getElementById('replaceInput').value;
        const currentMark = this.searchResults[this.currentSearchIndex];
        const textNode = document.createTextNode(replaceText);

        currentMark.parentNode.replaceChild(textNode, currentMark);
        this.performSearch();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
    }

    replaceAll() {
        const replaceText = document.getElementById('replaceInput').value;
        if (this.searchResults.length === 0) return;

        this.searchResults.forEach(mark => {
            const textNode = document.createTextNode(replaceText);
            mark.parentNode.replaceChild(textNode, mark);
        });

        this.performSearch();
        if (window.StorageManager) window.StorageManager.triggerAutoSave();
        if (window.App) window.App.showToast('All occurrences replaced');
    }

    updateSearchCounter() {
        const counter = document.getElementById('matchCounter');
        if (!counter) return;

        if (this.searchResults.length === 0) {
            counter.textContent = '0 matches';
        } else {
            counter.textContent = `${this.currentSearchIndex + 1} of ${this.searchResults.length}`;
        }
    }
}

window.ModalManager = ModalManager;
