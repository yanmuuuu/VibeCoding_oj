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
