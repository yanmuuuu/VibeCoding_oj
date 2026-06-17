function brandMascotHtml(size) {
    var w = size || 36;
    return '<svg class="brand-mascot auth-mascot" width="' + w + '" height="' + w + '" viewBox="0 0 32 32" aria-hidden="true">' +
        '<ellipse cx="16" cy="20" rx="11" ry="9" fill="#fcd9b8"/>' +
        '<path d="M7 14 L10 20 L5 19 Z" fill="#fcd9b8"/>' +
        '<path d="M25 14 L22 20 L27 19 Z" fill="#fcd9b8"/>' +
        '<circle cx="12" cy="19" r="1.8" fill="#1a1028"/>' +
        '<circle cx="20" cy="19" r="1.8" fill="#1a1028"/>' +
        '<ellipse cx="16" cy="22" rx="2.2" ry="1.3" fill="#d4af37"/>' +
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
    const dt = new Date(d.replace(' ', 'T') + 'Z');
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0') + ' ' + String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0');
}
function difficultyBadge(difficulty) {
    const key = { '简单': 'easy', '中等': 'medium', '困难': 'hard' }[difficulty] || 'default';
    return `<span class="diff-badge diff-${key}">${difficulty || '简单'}</span>`;
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
