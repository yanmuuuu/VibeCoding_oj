async function renderUserCenter(main) {
    await App.ensureAuth();
    main.innerHTML = `<div class="page-container">
        <a href="#/problems" class="back-link">← 返回题目列表</a>
        <h2>用户中心</h2>
        <div class="user-info">
            <p>用户名: <strong>${escapeHtml(App.user.username)}</strong></p>
        </div>
        <h3>我的提交</h3>
        <div id="submission-stats" style="margin-bottom:16px;font-size:0.9em;color:#666;"></div>
        <table class="data-table">
            <thead><tr><th>题目</th><th>状态</th><th>耗时</th><th>时间</th><th></th></tr></thead>
            <tbody id="submission-list"><tr><td colspan="5">加载中...</td></tr></tbody>
        </table>
        <div id="load-more" style="text-align:center;margin-top:16px;"></div>
    </div>`;

    let page = 1;
    let allSubs = [];
    const tbody = $('#submission-list');

    function getStatusText(status) {
        const map = { 'AC': '通过', 'WA': '答案错误', 'TLE': '超时', 'MLE': '内存超限', 'RE': '运行错误', 'CE': '编译错误', 'SE': '系统错误' };
        return map[status] || status;
    }

    function getStatusColor(status) {
        const map = { 'AC': '#4caf50', 'WA': '#f44336', 'TLE': '#ff9800', 'MLE': '#ff5722', 'RE': '#9c27b0', 'CE': '#9e9e9e' };
        return map[status] || '#607d8b';
    }

    function updateStats() {
        const acProblems = new Set();
        const attemptedProblems = new Set();
        allSubs.forEach(s => {
            attemptedProblems.add(s.question_id);
            if (s.status === 'AC') acProblems.add(s.question_id);
        });
        const totalSubs = allSubs.length;
        const statsEl = $('#submission-stats');
        if (totalSubs === 0) {
            statsEl.textContent = '';
        } else {
            statsEl.innerHTML = `共 ${totalSubs} 次提交，通过 <strong>${acProblems.size}</strong> 题，尝试 <strong>${attemptedProblems.size}</strong> 题`;
        }
    }

    async function loadPage() {
        try {
            const subs = await API.getUserSubmissions(page);
            allSubs.push(...subs);
            updateStats();
            if (page === 1) tbody.innerHTML = '';
            if (subs.length === 0 && page === 1) {
                tbody.innerHTML = '<tr><td colspan="5">暂无提交记录</td></tr>';
                return;
            }
            subs.forEach(s => {
                const color = getStatusColor(s.status);
                const statusText = getStatusText(s.status);
                const row = el('tr', {className:'clickable'}, [
                    el('td', {}, escapeHtml(s.title)),
                    el('td', {innerHTML: `<span style="color:${color};font-weight:bold;">${s.status}</span> ${statusText}`}),
                    el('td', {textContent: s.total_time + 'ms/' + s.total_memory + 'KB'}),
                    el('td', {textContent: formatDate(s.created_at)}),
                    el('td', {innerHTML: '<span style="color:#1890ff;">查看详情 →</span>'})
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
            tbody.innerHTML = '<tr><td colspan="5">加载失败: ' + escapeHtml(e.message) + '</td></tr>';
        }
    }

    await loadPage();
}
