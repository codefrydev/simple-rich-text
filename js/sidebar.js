/**
 * Sidebar Manager - Handles the Left Side Panel
 * Includes: Document Outline (Live TOC), Quick Block Inserter, and Drafts Manager
 */

class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('editorSidebar');
        this.toggleBtn = document.getElementById('btnToggleSidebar');
        this.closeBtn = document.getElementById('btnCloseSidebar');
        this.outlineContainer = document.getElementById('sidebarOutlineList');
        this.draftsContainer = document.getElementById('sidebarDraftsList');
        this.statsContainer = document.getElementById('sidebarDocStats');

        this.activeTab = 'outline';
        this.outlineDebounceTimer = null;

        this.init();
    }

    init() {
        if (!this.sidebar) return;

        // Restore collapsed state (default to open if not set)
        const isCollapsed = localStorage.getItem('simple_rich_text_sidebar_collapsed') === 'true';
        if (isCollapsed) {
            this.sidebar.classList.add('collapsed');
            if (this.toggleBtn) this.toggleBtn.classList.remove('active');
        } else {
            this.sidebar.classList.remove('collapsed');
            if (this.toggleBtn) this.toggleBtn.classList.add('active');
        }

        // Setup Event Listeners
        this.bindEvents();

        // Initial Renders
        this.updateOutline();
        this.renderDrafts();
        this.renderDocStats();
    }

    bindEvents() {
        // Toggle button clicks
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.toggleSidebar(false));
        }

        // Tab switching
        const tabBtns = this.sidebar.querySelectorAll('.sidebar-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });

        // Listen for editor changes to update Outline & Stats
        const editor = document.getElementById('editor');
        if (editor) {
            editor.addEventListener('input', () => {
                clearTimeout(this.outlineDebounceTimer);
                this.outlineDebounceTimer = setTimeout(() => {
                    this.updateOutline();
                    this.renderDocStats();
                }, 300);
            });
        }

        // Keyboard Shortcut: Ctrl+\ or Cmd+\ to toggle sidebar
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });

        // Snapshot Save Button
        const saveSnapshotBtn = document.getElementById('btnSaveSnapshot');
        if (saveSnapshotBtn) {
            saveSnapshotBtn.addEventListener('click', () => this.saveSnapshot());
        }

        // New Document Button
        const newDocBtn = document.getElementById('btnNewDocument');
        if (newDocBtn) {
            newDocBtn.addEventListener('click', () => this.newDocument());
        }
    }

    toggleSidebar(forceState = null) {
        if (!this.sidebar) return;

        const willCollapse = forceState !== null ? !forceState : !this.sidebar.classList.contains('collapsed');
        
        if (willCollapse) {
            this.sidebar.classList.add('collapsed');
            if (this.toggleBtn) this.toggleBtn.classList.remove('active');
            localStorage.setItem('simple_rich_text_sidebar_collapsed', 'true');
        } else {
            this.sidebar.classList.remove('collapsed');
            if (this.toggleBtn) this.toggleBtn.classList.add('active');
            localStorage.setItem('simple_rich_text_sidebar_collapsed', 'false');
            this.updateOutline();
            this.renderDocStats();
        }
    }

    switchTab(tabId) {
        this.activeTab = tabId;

        // Update tab buttons
        const tabBtns = this.sidebar.querySelectorAll('.sidebar-tab-btn');
        tabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab panes
        const panes = this.sidebar.querySelectorAll('.sidebar-pane');
        panes.forEach(pane => {
            if (pane.id === `tab-${tabId}`) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        if (tabId === 'outline') {
            this.updateOutline();
        } else if (tabId === 'drafts') {
            this.renderDrafts();
            this.renderDocStats();
        }
    }

    /* ==========================================================================
       Tab 1: Document Outline (Live Table of Contents)
       ========================================================================== */

    updateOutline() {
        if (!this.outlineContainer) return;

        const editor = document.getElementById('editor');
        if (!editor) return;

        const headings = editor.querySelectorAll('h1, h2, h3, h4');

        if (headings.length === 0) {
            this.outlineContainer.innerHTML = `
                <div class="sidebar-empty-state">
                    <span class="empty-icon" data-icon="listTree"></span>
                    <p class="empty-title">No headings found</p>
                    <p class="empty-desc">Add headings (H1 - H4) or type <code># </code> in your document to generate a clickable table of contents.</p>
                </div>
            `;
            if (window.app && window.app.renderIcons) {
                window.app.renderIcons();
            }
            return;
        }

        let html = '<ul class="outline-list">';
        headings.forEach((heading, idx) => {
            const tag = heading.tagName.toLowerCase();
            const text = heading.textContent.trim() || 'Untitled Section';
            const levelClass = `level-${tag}`;

            // Attach a unique temporary id if none exists for smooth targeting
            if (!heading.id) {
                heading.id = `heading-ref-${idx}`;
            }

            html += `
                <li class="outline-item ${levelClass}" data-target-id="${heading.id}" title="${this.escapeHtml(text)}">
                    <span class="outline-tag">${tag.toUpperCase()}</span>
                    <span class="outline-text">${this.escapeHtml(text)}</span>
                </li>
            `;
        });
        html += '</ul>';

        this.outlineContainer.innerHTML = html;

        // Attach click handlers to jump to heading
        const items = this.outlineContainer.querySelectorAll('.outline-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('data-target-id');
                const targetEl = document.getElementById(targetId);
                const container = document.getElementById('editorContainer');

                if (targetEl && container) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Highlight effect
                    targetEl.classList.add('heading-flash');
                    setTimeout(() => {
                        targetEl.classList.remove('heading-flash');
                    }, 1400);

                    // Mark active in sidebar
                    items.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                }
            });
        });
    }

    /* ==========================================================================
       Tab 2: Quick Block Inserter
       ========================================================================== */

    insertBlock(type, variant = '') {
        const editor = document.getElementById('editor');
        if (!editor) return;

        editor.focus();

        switch (type) {
            case 'h1':
                document.execCommand('formatBlock', false, 'h1');
                break;
            case 'h2':
                document.execCommand('formatBlock', false, 'h2');
                break;
            case 'h3':
                document.execCommand('formatBlock', false, 'h3');
                break;
            case 'quote':
                document.execCommand('formatBlock', false, 'blockquote');
                break;
            case 'code':
                this.insertHtmlAtCursor('<pre><code>// Code snippet\nconsole.log("Hello, World!");</code></pre><p><br></p>');
                break;
            case 'callout':
                this.insertCalloutBlock(variant);
                break;
            case 'table':
                if (window.ModalManager) {
                    window.ModalManager.openTableModal();
                } else if (window.editor) {
                    window.editor.insertTable(3, 3);
                }
                break;
            case 'image':
                if (window.ModalManager) {
                    window.ModalManager.openImageModal();
                }
                break;
            case 'checklist':
                if (window.editor) {
                    window.editor.insertChecklist();
                }
                break;
            case 'hr':
                if (window.editor) {
                    window.editor.format('horizontalRule');
                }
                break;
        }

        if (window.StorageManager) {
            window.StorageManager.triggerAutoSave();
        }
        this.updateOutline();
    }

    insertCalloutBlock(type = 'note') {
        let icon = '💡';
        let title = 'Note';
        let className = 'callout-note';

        if (type === 'warning') {
            icon = '⚠️';
            title = 'Warning';
            className = 'callout-warning';
        } else if (type === 'success') {
            icon = '✅';
            title = 'Success';
            className = 'callout-success';
        } else if (type === 'info') {
            icon = 'ℹ️';
            title = 'Information';
            className = 'callout-info';
        }

        const calloutHtml = `
            <div class="callout-block ${className}">
                <div class="callout-icon">${icon}</div>
                <div class="callout-body">
                    <strong>${title}:</strong> Enter your note here...
                </div>
            </div>
            <p><br></p>
        `;

        this.insertHtmlAtCursor(calloutHtml);
    }

    insertHtmlAtCursor(html) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            const editor = document.getElementById('editor');
            if (editor) editor.innerHTML += html;
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const template = document.createElement('div');
        template.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node;
        let lastNode;

        while ((node = template.firstChild)) {
            lastNode = frag.appendChild(node);
        }

        range.insertNode(frag);

        if (lastNode) {
            range.setStartAfter(lastNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /* ==========================================================================
       Tab 3: Saved Drafts & Document Metrics
       ========================================================================== */

    saveSnapshot() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const content = editor.innerHTML;
        const plainText = editor.innerText.trim();
        const firstLine = plainText.split('\n')[0] || 'Untitled Document';
        const title = firstLine.slice(0, 40);

        const snapshots = this.getSnapshots();
        const newSnapshot = {
            id: 'snap_' + Date.now(),
            title: title || 'Draft Snapshot',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
            words: plainText ? plainText.split(/\s+/).filter(Boolean).length : 0,
            content: content
        };

        // Keep maximum 15 snapshots
        snapshots.unshift(newSnapshot);
        if (snapshots.length > 15) snapshots.pop();

        localStorage.setItem('simple_rich_text_snapshots', JSON.stringify(snapshots));
        this.renderDrafts();

        if (window.app && window.app.showToast) {
            window.app.showToast('Snapshot saved to drafts');
        }
    }

    loadSnapshot(id) {
        const snapshots = this.getSnapshots();
        const target = snapshots.find(s => s.id === id);
        if (!target) return;

        if (confirm(`Load "${target.title}"? Current unsaved edits will be replaced.`)) {
            const editor = document.getElementById('editor');
            if (editor) {
                editor.innerHTML = target.content;
                if (window.StorageManager) {
                    window.StorageManager.triggerAutoSave();
                }
                this.updateOutline();
                this.renderDocStats();
                if (window.app && window.app.showToast) {
                    window.app.showToast(`Restored: "${target.title}"`);
                }
            }
        }
    }

    deleteSnapshot(id) {
        let snapshots = this.getSnapshots();
        snapshots = snapshots.filter(s => s.id !== id);
        localStorage.setItem('simple_rich_text_snapshots', JSON.stringify(snapshots));
        this.renderDrafts();

        if (window.app && window.app.showToast) {
            window.app.showToast('Draft removed');
        }
    }

    getSnapshots() {
        try {
            const data = localStorage.getItem('simple_rich_text_snapshots');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    renderDrafts() {
        if (!this.draftsContainer) return;

        const snapshots = this.getSnapshots();

        if (snapshots.length === 0) {
            this.draftsContainer.innerHTML = `
                <div class="sidebar-empty-state">
                    <span class="empty-icon" data-icon="folder"></span>
                    <p class="empty-title">No snapshots yet</p>
                    <p class="empty-desc">Click "Save Snapshot" above to create restore points while writing.</p>
                </div>
            `;
            if (window.app && window.app.renderIcons) {
                window.app.renderIcons();
            }
            return;
        }

        let html = '<div class="drafts-list">';
        snapshots.forEach(snap => {
            html += `
                <div class="draft-card" data-id="${snap.id}">
                    <div class="draft-card-main">
                        <div class="draft-card-title">${this.escapeHtml(snap.title)}</div>
                        <div class="draft-card-meta">
                            <span>${snap.timestamp}</span>
                            <span>•</span>
                            <span>${snap.words} words</span>
                        </div>
                    </div>
                    <div class="draft-card-actions">
                        <button class="draft-action-btn load-btn" title="Restore snapshot" onclick="window.SidebarManager.loadSnapshot('${snap.id}')">
                            Restore
                        </button>
                        <button class="draft-action-btn delete-btn" title="Delete snapshot" onclick="window.SidebarManager.deleteSnapshot('${snap.id}')" data-icon="trash">
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        this.draftsContainer.innerHTML = html;
        if (window.app && window.app.renderIcons) {
            window.app.renderIcons();
        }
    }

    renderDocStats() {
        if (!this.statsContainer) return;

        const editor = document.getElementById('editor');
        if (!editor) return;

        const text = editor.innerText.trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        const chars = text.length;
        const headingsCount = editor.querySelectorAll('h1, h2, h3, h4').length;
        const readingTime = Math.max(1, Math.ceil(words / 200));

        this.statsContainer.innerHTML = `
            <div class="sidebar-stats-grid">
                <div class="stat-box">
                    <span class="stat-value">${words}</span>
                    <span class="stat-label">Words</span>
                </div>
                <div class="stat-box">
                    <span class="stat-value">${chars}</span>
                    <span class="stat-label">Characters</span>
                </div>
                <div class="stat-box">
                    <span class="stat-value">${headingsCount}</span>
                    <span class="stat-label">Headings</span>
                </div>
                <div class="stat-box">
                    <span class="stat-value">~${readingTime}m</span>
                    <span class="stat-label">Read Time</span>
                </div>
            </div>
        `;
    }

    newDocument() {
        if (confirm('Start a new document? Unsaved changes in your current view will be cleared.')) {
            const editor = document.getElementById('editor');
            if (editor) {
                editor.innerHTML = '<p><br></p>';
                editor.focus();
                if (window.StorageManager) {
                    window.StorageManager.triggerAutoSave();
                }
                this.updateOutline();
                this.renderDocStats();
                if (window.app && window.app.showToast) {
                    window.app.showToast('Started new document');
                }
            }
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

window.SidebarManager = SidebarManager;
