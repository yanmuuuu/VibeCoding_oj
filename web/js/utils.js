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
    const map = { '简单': { bg: '#e6f7e9', color: '#237804', border: '#b7eb8f' }, '中等': { bg: '#fff7e6', color: '#ad6800', border: '#ffd591' }, '困难': { bg: '#fff1f0', color: '#a8071a', border: '#ffa39e' } };
    const s = map[difficulty] || { bg: '#f0f0f0', color: '#595959', border: '#d9d9d9' };
    return `<span style="display:inline-block;padding:1px 8px;border-radius:3px;font-size:0.78em;font-weight:500;background:${s.bg};color:${s.color};border:1px solid ${s.border};white-space:nowrap;">${difficulty || '简单'}</span>`;
}
