function brandMascotHtml(size) {
    var w = size || 36;
    return '<svg class="brand-mascot auth-mascot" width="' + w + '" height="' + w + '" viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M7.5 21 Q7.5 10.5 16 8.5 Q24.5 10.5 24.5 21 L24.5 22.5 Q24.5 24.5 16 24.5 Q7.5 24.5 7.5 22.5 Z" fill="#ead8ec" stroke="#5a4a5c" stroke-width="0.9"/>' +
        '<circle cx="10.5" cy="18.5" r="2.2" fill="#f0a0b8" opacity="0.55"/>' +
        '<circle cx="21.5" cy="18.5" r="2.2" fill="#f0a0b8" opacity="0.55"/>' +
        '<line x1="14.3" y1="15.2" x2="14.3" y2="18.2" stroke="#2a1a28" stroke-width="1.1" stroke-linecap="round"/>' +
        '<line x1="17.7" y1="15.2" x2="17.7" y2="18.2" stroke="#2a1a28" stroke-width="1.1" stroke-linecap="round"/>' +
        '</svg>';
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) { for (const k in attrs) { if (k === 'className') e.className = attrs[k]; else if (k === 'textContent') e.textContent = attrs[k]; else if (k === 'innerHTML') e.innerHTML = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]); else e.setAttribute(k, attrs[k]); } }
    children.forEach(c => { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c); });
    return e;
}
function escapeHtml(s) {
    if (!s) return '';
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return s;
}
function formatDate(d) {
    if (!d) return '';
    const s = d.trim().replace(' ', 'T');
    const iso = (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) ? s : (s + '+08:00');
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return d;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(dt);
    const pick = (type) => (parts.find(p => p.type === type) || {}).value || '';
    return pick('year') + '-' + pick('month') + '-' + pick('day') + ' ' + pick('hour') + ':' + pick('minute');
}
function difficultyBadge(difficulty) {
    const key = { '简单': 'easy', '中等': 'medium', '困难': 'hard' }[difficulty] || 'default';
    return `<span class="diff-badge diff-${key}">${difficulty || '简单'}</span>`;
}
function _closeMioDialog(modal, cleanup, result) {
    modal.classList.remove('mio-dialog-show');
    setTimeout(function() {
        cleanup();
        modal.remove();
    }, 180);
}

function _openMioDialog(opts) {
    return new Promise(function(resolve) {
        var type = opts.type || 'alert';
        var title = opts.title || (type === 'alert' ? '提示' : (type === 'prompt' ? '输入' : '确认'));
        var message = opts.message || '';
        var confirmText = opts.confirmText || '确定';
        var cancelText = opts.cancelText || '取消';
        var danger = !!opts.danger;

        var modal = document.createElement('div');
        modal.className = 'mio-dialog';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        var backdrop = document.createElement('div');
        backdrop.className = 'mio-dialog-backdrop';

        var panel = document.createElement('div');
        panel.className = 'mio-dialog-panel' + (danger ? ' mio-dialog-danger' : '');

        var header = document.createElement('div');
        header.className = 'mio-dialog-header';
        header.textContent = title;

        var body = document.createElement('div');
        body.className = 'mio-dialog-body';
        var msgEl = document.createElement('p');
        msgEl.className = 'mio-dialog-message';
        msgEl.textContent = message;
        body.appendChild(msgEl);

        var inputEl = null;
        if (type === 'prompt') {
            inputEl = document.createElement('input');
            inputEl.className = 'mio-dialog-input';
            inputEl.type = opts.inputType || 'text';
            inputEl.value = opts.defaultValue || '';
            if (opts.inputPlaceholder) inputEl.placeholder = opts.inputPlaceholder;
            body.appendChild(inputEl);
        }

        var footer = document.createElement('div');
        footer.className = 'mio-dialog-footer';

        var cancelBtn = null;
        if (type !== 'alert') {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-secondary mio-dialog-btn-cancel';
            cancelBtn.textContent = cancelText;
            footer.appendChild(cancelBtn);
        }

        var confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = (danger ? 'btn-danger' : 'btn-primary') + ' mio-dialog-btn-confirm';
        confirmBtn.textContent = confirmText;
        footer.appendChild(confirmBtn);

        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);
        modal.appendChild(backdrop);
        modal.appendChild(panel);
        document.body.appendChild(modal);
        requestAnimationFrame(function() { modal.classList.add('mio-dialog-show'); });

        var settled = false;
        function finish(result) {
            if (settled) return;
            settled = true;
            _closeMioDialog(modal, cleanup, result);
            resolve(result);
        }
        function cleanup() {
            document.removeEventListener('keydown', onKey);
        }
        function onKey(e) {
            if (e.key === 'Escape') {
                if (type === 'alert') finish(undefined);
                else if (type === 'confirm') finish(false);
                else finish(null);
            } else if (e.key === 'Enter' && type === 'alert') {
                finish(undefined);
            } else if (e.key === 'Enter' && type === 'confirm') {
                finish(true);
            } else if (e.key === 'Enter' && type === 'prompt' && document.activeElement === inputEl) {
                finish(inputEl.value);
            }
        }
        document.addEventListener('keydown', onKey);

        confirmBtn.onclick = function() {
            if (type === 'prompt') finish(inputEl.value);
            else if (type === 'confirm') finish(true);
            else finish(undefined);
        };
        if (cancelBtn) {
            cancelBtn.onclick = function() {
                if (type === 'prompt') finish(null);
                else finish(false);
            };
        }
        backdrop.onclick = function() {
            if (type === 'alert') finish(undefined);
            else if (type === 'confirm') finish(false);
            else finish(null);
        };

        if (inputEl) inputEl.focus();
        else confirmBtn.focus();
    });
}

function showAlert(message, opts) {
    opts = opts || {};
    return _openMioDialog({
        type: 'alert',
        message: message,
        title: opts.title || '提示',
        confirmText: opts.confirmText || '确定'
    });
}

function showConfirm(message, opts) {
    opts = opts || {};
    return _openMioDialog({
        type: 'confirm',
        message: message,
        title: opts.title || '确认',
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        danger: !!opts.danger
    });
}

function showPrompt(message, opts) {
    opts = opts || {};
    return _openMioDialog({
        type: 'prompt',
        message: message,
        title: opts.title || '输入',
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        defaultValue: opts.defaultValue || '',
        inputType: opts.inputType || 'text',
        inputPlaceholder: opts.inputPlaceholder || ''
    });
}

function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3200;
    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('toast-show'); });
    setTimeout(function() {
        toast.classList.remove('toast-show');
        setTimeout(function() { toast.remove(); }, 320);
    }, duration);
}
function renderNotFound(main) {
    main.innerHTML = '<div class="error-page"><h2>404</h2><p>页面不存在</p><a href="#/problems">返回题目列表</a></div>';
}
function renderError(main, msg) {
    main.innerHTML = '<div class="error-page"><h2>出错了</h2><p>' + escapeHtml(msg) + '</p><a href="#/problems">返回题目列表</a></div>';
}
function renderMarkdown(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
        var raw = marked.parse(text);
        return raw.replace(/<table>/g, '<table class="md-table">');
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
}

function initAdminAce(elementId, initialCode) {
    var editor = ace.edit(elementId);
    editor.setTheme('ace/theme/monokai');
    editor.session.setMode('ace/mode/c_cpp');
    editor.setValue(initialCode || '', -1);
    editor.setOptions({ fontSize: '14px', tabSize: 4, useSoftTabs: true, showPrintMargin: false });
    return editor;
}

function bindMarkdownPreview(textareaId, previewId) {
    var textarea = document.getElementById(textareaId);
    var preview = document.getElementById(previewId);
    if (!textarea || !preview) return;
    function render() {
        preview.innerHTML = renderMarkdown(textarea.value || '');
    }
    textarea.addEventListener('input', render);
    render();
}

function showTcExpandModal(title, content) {
    var modal = document.createElement('div');
    modal.className = 'tc-expand-modal';
    modal.innerHTML = '<div class="tc-expand-backdrop"></div><div class="tc-expand-panel"><div class="tc-expand-header"><span>' + escapeHtml(title) + '</span><button type="button" class="tc-expand-close">&times;</button></div><pre class="tc-expand-body"></pre></div>';
    modal.querySelector('.tc-expand-body').textContent = content;
    function close() { modal.remove(); }
    modal.querySelector('.tc-expand-close').onclick = close;
    modal.querySelector('.tc-expand-backdrop').onclick = close;
    document.body.appendChild(modal);
}
