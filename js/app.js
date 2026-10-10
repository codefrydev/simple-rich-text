/**
 * Main Application Orchestrator - Initializes modules, binds events,
 * manages global shortcuts, theme toggle, and UI states.
 */

class App {
    constructor() {
        this.isSourceView = false;
        this.isFullscreen = false;
        this.toastTimeout = null;

        this.init();
    }

    init() {
        // Initialize Core Modules
        window.editor = new RichEditor();
        window.ModalManager = new ModalManager();
        window.StorageManager = new StorageManager();
        window.ExportManager = new ExportManager();
        window.SidebarManager = new SidebarManager();

        // Setup theme from localStorage or system preference
        this.initTheme();

        // Setup UI event listeners
        this.bindEvents();

        // Setup keyboard shortcuts
        this.bindKeyboardShortcuts();

        // Populate SVG icons across the UI
        this.renderIcons();
    }

    // Populate all icons matching data-icon attribute
    renderIcons() {
        if (!window.Icons) return;
        document.querySelectorAll('[data-icon]').forEach(el => {
            const iconName = el.getAttribute('data-icon');
            if (window.Icons[iconName]) {
                el.innerHTML = window.Icons[iconName];
            }
        });
    }

    // Bind UI actions
    bindEvents() {
        // Source Code View Toggle
        const toggleViewBtn = document.getElementById('toggleViewBtn');
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', () => this.toggleView());
        }

        // Theme Toggle Button
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Fullscreen Toggle Button
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Clear Content Button
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearEditor());
        }

        // Copy Output Button
        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => window.ExportManager.copyContent());
        }

        // Dropdown menus (Export dropdown)
        const exportMenuBtn = document.getElementById('exportMenuBtn');
        const exportDropdown = document.getElementById('exportDropdown');
        if (exportMenuBtn && exportDropdown) {
            exportMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                exportDropdown.classList.toggle('show');
            });
            document.addEventListener('click', () => {
                exportDropdown.classList.remove('show');
            });
        }

        // Color Picker Triggers
        const textColorBtn = document.getElementById('textColorBtn');
        const textColorInput = document.getElementById('textColorInput');
        const textColorSwatch = document.getElementById('textColorSwatch');

        if (textColorBtn && textColorInput) {
            textColorBtn.addEventListener('click', () => textColorInput.click());
            textColorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                textColorSwatch.style.backgroundColor = color;
                window.editor.format('foreColor', color);
            });
        }

        const bgColorBtn = document.getElementById('bgColorBtn');
        const bgColorInput = document.getElementById('bgColorInput');
        const bgColorSwatch = document.getElementById('bgColorSwatch');

        if (bgColorBtn && bgColorInput) {
            bgColorBtn.addEventListener('click', () => bgColorInput.click());
            bgColorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                bgColorSwatch.style.backgroundColor = color;
                window.editor.format('hiliteColor', color);
            });
        }

        // Select Changes
        const formatBlockSelect = document.getElementById('formatBlockSelect');
        if (formatBlockSelect) {
            formatBlockSelect.addEventListener('change', (e) => {
                window.editor.formatBlock(e.target.value);
            });
        }

        const fontFamilySelect = document.getElementById('fontFamilySelect');
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', (e) => {
                window.editor.setFontFamily(e.target.value);
            });
        }

        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (fontSizeSelect) {
            fontSizeSelect.addEventListener('change', (e) => {
                window.editor.setFontSize(e.target.value);
            });
        }
    }

    // Global Keyboard Shortcuts
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;

            if (modifier) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        window.editor.format('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        window.editor.format('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        window.editor.format('underline');
                        break;
                    case 'k':
                        e.preventDefault();
                        window.ModalManager.openLinkModal();
                        break;
                    case 'f':
                        e.preventDefault();
                        window.ModalManager.toggleFindReplace();
                        break;
                    case 's':
                        e.preventDefault();
                        window.StorageManager.saveToStorage();
                        this.showToast('Draft saved successfully');
                        break;
                    case 'z':
                        if (e.shiftKey) {
                            e.preventDefault();
                            window.editor.format('redo');
                        } else {
                            e.preventDefault();
                            window.editor.format('undo');
                        }
                        break;
                    case 'y':
                        if (!isMac) {
                            e.preventDefault();
                            window.editor.format('redo');
                        }
                        break;
                }
            }
        });
    }

    // Toggle between WYSIWYG and HTML Raw Source
    toggleView() {
        const editor = document.getElementById('editor');
        const sourceCode = document.getElementById('sourceCode');
        const toolbar = document.getElementById('toolbar');
        const toggleBtn = document.getElementById('toggleViewBtn');

        if (this.isSourceView) {
            // Switch back to Visual Editor
            editor.innerHTML = sourceCode.value;
            sourceCode.style.display = 'none';
            editor.style.display = 'block';
            toolbar.style.opacity = '1';
            toolbar.style.pointerEvents = 'auto';
            toggleBtn.innerHTML = `<span data-icon="codeFile">${window.Icons.codeFile || ''}</span> <span>View HTML Source</span>`;
            if (window.StorageManager) {
                window.StorageManager.updateMetrics();
                window.StorageManager.triggerAutoSave();
            }
        } else {
            // Switch to Raw Source View
            sourceCode.value = editor.innerHTML;
            editor.style.display = 'none';
            sourceCode.style.display = 'block';
            toolbar.style.opacity = '0.4';
            toolbar.style.pointerEvents = 'none';
            toggleBtn.innerHTML = `<span data-icon="edit">${window.Icons.edit || ''}</span> <span>View Visual Editor</span>`;
        }

        this.isSourceView = !this.isSourceView;
        window.editor.isSourceView = this.isSourceView;
    }

    // Toggle Theme (Dark / Light)
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('simple_rich_text_theme', newTheme);

        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.innerHTML = newTheme === 'dark' ? window.Icons.sun : window.Icons.moon;
            themeBtn.title = newTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('simple_rich_text_theme');
        const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const activeTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

        document.documentElement.setAttribute('data-theme', activeTheme);
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.innerHTML = activeTheme === 'dark' ? window.Icons.sun : window.Icons.moon;
            themeBtn.title = activeTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }
    }

    // Toggle Zen / Fullscreen Mode
    toggleFullscreen() {
        const container = document.querySelector('.app-container');
        const btn = document.getElementById('fullscreenBtn');
        if (!container) return;

        this.isFullscreen = !this.isFullscreen;
        container.classList.toggle('fullscreen', this.isFullscreen);

        if (btn) {
            btn.innerHTML = this.isFullscreen ? window.Icons.minimize : window.Icons.maximize;
            btn.title = this.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
        }
    }

    // Clear Editor
    clearEditor() {
        if (confirm('Are you sure you want to clear all editor content?')) {
            const editor = document.getElementById('editor');
            const sourceCode = document.getElementById('sourceCode');

            if (this.isSourceView) {
                sourceCode.value = '';
            } else {
                editor.innerHTML = '';
            }

            if (window.StorageManager) {
                window.StorageManager.clearDraft();
                window.StorageManager.updateMetrics();
            }
            this.showToast('Editor cleared');
        }
    }

    // Toast Notification System
    showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('show');

        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    window.App = new App();
});
