/**
 * Storage & Metrics Module - Live document metrics calculation,
 * local storage auto-save with debounce, and draft restoration.
 */

class StorageManager {
    constructor() {
        this.saveTimeout = null;
        this.STORAGE_KEY = 'simple_rich_text_draft';
        this.AUTOSAVE_DELAY = 1200; // ms

        this.init();
    }

    init() {
        // Load existing draft if present
        this.loadDraft();
        this.updateMetrics();
    }

    // Live Metrics Calculation
    updateMetrics() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const text = editor.innerText || '';
        const trimmed = text.trim();

        // Word count
        const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(Boolean).length;

        // Character counts
        const charsWithSpaces = text.length;
        const charsWithoutSpaces = text.replace(/\s/g, '').length;

        // Paragraph count
        const paragraphs = text.split(/\n+/).filter(line => line.trim().length > 0).length;

        // Reading time (200 words per minute average)
        const readingMinutes = Math.max(1, Math.ceil(words / 200));

        // Update UI Elements
        const wordCountEl = document.getElementById('statWords');
        const charCountEl = document.getElementById('statChars');
        const readingTimeEl = document.getElementById('statReadingTime');

        if (wordCountEl) wordCountEl.textContent = words;
        if (charCountEl) charCountEl.textContent = charsWithoutSpaces;
        if (readingTimeEl) readingTimeEl.textContent = words > 0 ? `${readingMinutes} min read` : '0 min read';
    }

    // Debounced Auto-save
    triggerAutoSave() {
        this.setSaveStatus('unsaved', 'Unsaved changes...');
        clearTimeout(this.saveTimeout);

        this.saveTimeout = setTimeout(() => {
            this.saveToStorage();
        }, this.AUTOSAVE_DELAY);
    }

    saveToStorage() {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const html = editor.innerHTML;
        const draftData = {
            html: html,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(draftData));
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.setSaveStatus('saved', `Draft saved at ${now}`);
        } catch (e) {
            console.warn('Storage quota exceeded or disabled', e);
            this.setSaveStatus('unsaved', 'Auto-save failed');
        }
    }

    loadDraft() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (data && data.html && data.html.trim().length > 0) {
                    const editor = document.getElementById('editor');
                    if (editor) {
                        editor.innerHTML = data.html;
                        const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        this.setSaveStatus('saved', `Restored draft from ${time}`);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load draft from localStorage', e);
        }
    }

    clearDraft() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.setSaveStatus('saved', 'Draft cleared');
    }

    setSaveStatus(state, text) {
        const dot = document.getElementById('saveDot');
        const label = document.getElementById('saveText');

        if (dot) {
            dot.className = 'save-dot' + (state === 'unsaved' ? ' unsaved' : '');
        }
        if (label) {
            label.textContent = text;
        }
    }
}

window.StorageManager = StorageManager;
