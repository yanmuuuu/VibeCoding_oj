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
