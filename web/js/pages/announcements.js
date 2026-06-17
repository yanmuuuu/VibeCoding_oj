async function renderAnnouncements(main) {
    const announcements = await API.getAnnouncements();

    let html = '<div class="page-container"><h2>系统公告</h2>';
    if (!announcements || announcements.length === 0) {
        html += '<p class="empty-hint-block">暂无公告，有新消息时会在这里发布～</p>';
    } else {
        announcements.forEach(a => {
            const pinned = a.is_pinned ? ' <span class="badge badge-gold">置顶</span>' : '';
            const cardClass = a.is_pinned ? 'announce-card announce-card-pinned' : 'announce-card';
            html += `<div class="${cardClass}">
                <div class="announce-header">
                    <span class="announce-title">${escapeHtml(a.title)}${pinned}</span>
                    <span class="announce-date">${formatDate(a.created_at)}</span>
                </div>
                <div class="announce-body">${escapeHtml(a.content).replace(/\n/g, '<br>')}</div>
            </div>`;
        });
    }
    html += '</div>';
    main.innerHTML = html;
}
