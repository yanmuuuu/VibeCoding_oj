async function renderUserCenter(main) {
    await App.ensureAuth();
    main.innerHTML = `<div class="page-container">
        <h2>用户中心</h2>
        <div class="user-info">
            <p>用户名: <strong>${escapeHtml(App.user.username)}</strong></p>
        </div>
        <h3>我的提交</h3>
        <table class="data-table">
            <thead><tr><th>题目</th><th>状态</th><th>时间</th></tr></thead>
            <tbody id="submission-list"><tr><td colspan="3">加载中...</td></tr></tbody>
        </table>
        <div id="load-more" style="text-align:center;margin-top:16px;"></div>
    </div>`;

    let page = 1;
    const tbody = $('#submission-list');

    async function loadPage() {
        try {
            const subs = await API.getUserSubmissions(page);
            if (page === 1) tbody.innerHTML = '';
            if (subs.length === 0 && page === 1) {
                tbody.innerHTML = '<tr><td colspan="3">暂无提交记录</td></tr>';
                return;
            }
            subs.forEach(s => {
                const row = el('tr', {className:'clickable'}, [
                    el('td', {}, s.title),
                    el('td', {textContent: s.status}),
                    el('td', {textContent: formatDate(s.created_at)})
                ]);
                row.addEventListener('click', () => App.navigate('#/result/' + s.id));
                tbody.appendChild(row);
            });
            if (subs.length >= 20) {
                $('#load-more').innerHTML = '<button class="btn-secondary" id="load-more-btn">加载更多</button>';
                $('#load-more-btn').addEventListener('click', () => { page++; loadPage(); });
            } else {
                $('#load-more').innerHTML = '';
            }
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="3">加载失败: ' + escapeHtml(e.message) + '</td></tr>';
        }
    }

    await loadPage();
}
