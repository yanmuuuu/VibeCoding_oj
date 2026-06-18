async function renderDiscussions(main) {
    await App.ensureAuth();

    main.innerHTML = `<div class="page-container">
        <a href="#/problems" class="back-link">← 返回题目列表</a>
        <div class="discussions-header">
            <h2>讨论区</h2>
            <button class="btn-primary" id="new-discussion-btn" style="width:auto;padding:8px 24px;">发帖</button>
        </div>
        <div id="new-discussion-form" style="display:none;">
            <div class="discussion-form">
                <textarea id="discussion-content" placeholder="支持 Markdown 语法..." rows="6"></textarea>
                <div class="discussion-form-actions">
                    <button class="btn-primary" id="submit-discussion-btn" style="width:auto;padding:8px 24px;">提交</button>
                    <button class="btn-secondary" id="cancel-discussion-btn">取消</button>
                </div>
            </div>
        </div>
        <div id="discussions-list"></div>
        <div id="discussions-loading" style="text-align:center;padding:24px;color:#a0a8b4;">加载中...</div>
        <div id="discussions-load-more" style="text-align:center;margin-top:16px;"></div>
    </div>`;

    let page = 1;
    let hasMore = true;

    async function loadPage() {
        try {
            $('#discussions-loading').style.display = 'block';
            const list = await API.getDiscussions(page);
            $('#discussions-loading').style.display = 'none';

            if (list.length === 0 && page === 1) {
                $('#discussions-list').innerHTML = '<div class="empty-hint-block">暂无讨论，快来发第一条帖子吧！</div>';
                hasMore = false;
                return;
            }

            list.forEach(d => {
                const preview = d.content.length > 100 ? d.content.slice(0, 100).replace(/\n/g, ' ') + '...' : d.content.replace(/\n/g, ' ');
                const avatar = el('img', {className: 'discussion-avatar', src: d.avatar_url || '', alt: ''});
                const username = el('span', {className: 'discussion-username', textContent: d.username});
                attachUserProfileNav(avatar, d.user_id, true);
                attachUserProfileNav(username, d.user_id, true);
                const card = el('div', {className: 'discussion-card'},
                    el('div', {className: 'discussion-card-header'},
                        avatar,
                        username,
                        el('span', {className: 'discussion-time', textContent: formatDate(d.created_at)})
                    ),
                    el('div', {className: 'discussion-card-preview', textContent: preview}),
                    el('div', {className: 'discussion-card-footer'},
                        el('span', {className: 'discussion-likes', innerHTML: '♥ ' + d.like_count}),
                        el('span', {className: 'discussion-replies', textContent: '💬 ' + d.reply_count + ' 条回复'})
                    )
                );
                card.addEventListener('click', () => App.navigate('#/discussions/' + d.id));
                $('#discussions-list').appendChild(card);
            });

            if (list.length >= 20) {
                $('#discussions-load-more').innerHTML = '<button class="btn-secondary" id="load-more-btn">加载更多</button>';
                $('#load-more-btn').addEventListener('click', () => { page++; loadPage(); });
            } else {
                hasMore = false;
                $('#discussions-load-more').innerHTML = '';
            }
        } catch(e) {
            $('#discussions-loading').innerHTML = '<div class="error">加载失败: ' + escapeHtml(e.message) + '</div>';
        }
    }

    loadPage();

    $('#new-discussion-btn').addEventListener('click', () => {
        $('#new-discussion-form').style.display = 'block';
        $('#new-discussion-btn').style.display = 'none';
    });

    $('#cancel-discussion-btn').addEventListener('click', () => {
        $('#new-discussion-form').style.display = 'none';
        $('#new-discussion-btn').style.display = '';
        $('#discussion-content').value = '';
    });

    $('#submit-discussion-btn').addEventListener('click', async () => {
        const content = $('#discussion-content').value.trim();
        if (!content) { showToast('内容不能为空', 'warning'); return; }
        try {
            $('#submit-discussion-btn').disabled = true;
            $('#submit-discussion-btn').textContent = '提交中...';
            const data = await API.createDiscussion(content);
            App.navigate('#/discussions/' + data.id);
        } catch(e) {
            showToast('发帖失败: ' + e.message, 'error');
            $('#submit-discussion-btn').disabled = false;
            $('#submit-discussion-btn').textContent = '提交';
        }
    });
}
