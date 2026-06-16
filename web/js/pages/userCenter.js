async function renderUserCenter(main) {
    await App.ensureAuth();
    main.innerHTML = `<div class="page-container">
        <a href="#/problems" class="back-link">← 返回题目列表</a>
        <h2>用户中心</h2>
        <div class="user-info">
            <p>用户名: <strong>${escapeHtml(App.user.username)}</strong></p>
        </div>
        <h3>问题状态</h3>
        <div id="submission-stats" style="margin-bottom:16px;font-size:0.9em;color:#666;"></div>
        <table class="data-table">
            <thead><tr><th>#</th><th>题目</th><th>难度</th><th>状态</th><th>提交次数</th></tr></thead>
            <tbody id="problem-status-list"><tr><td colspan="5">加载中...</td></tr></tbody>
        </table>
        <div style="margin-top:20px;text-align:center;" id="toggle-history-area">
            <button class="btn-secondary" id="toggle-history-btn" style="display:none;">查看提交历史</button>
        </div>
        <div id="submission-history" style="display:none;margin-top:20px;">
            <h3>提交历史</h3>
            <table class="data-table">
                <thead><tr><th>题目</th><th>难度</th><th>状态</th><th>耗时</th><th>时间</th><th></th></tr></thead>
                <tbody id="submission-list"><tr><td colspan="6">加载中...</td></tr></tbody>
            </table>
            <div id="load-more" style="text-align:center;margin-top:16px;"></div>
        </div>
    </div>`;

    let historyPage = 1;
    let allSubs = [];
    let problemStatuses = [];
    const tbody = $('#submission-list');
    const problemTbody = $('#problem-status-list');

    const statusColorMap = { 'AC': '#4caf50', 'WA': '#f44336', 'TLE': '#ff9800', 'MLE': '#ff5722', 'RE': '#9c27b0', 'CE': '#9e9e9e' };
    const statusTextMap = { 'AC': '通过', 'WA': '答案错误', 'TLE': '超时', 'MLE': '内存超限', 'RE': '运行错误', 'CE': '编译错误', 'SE': '系统错误' };

    function getStatusText(status) { return statusTextMap[status] || status; }
    function getStatusColor(status) { return statusColorMap[status] || '#607d8b'; }

    async function loadProblemStatus() {
        try {
            problemStatuses = await API.get(`/api/user/problem-status`);
            updateStats();
            if (problemStatuses.length === 0) {
                problemTbody.innerHTML = '<tr><td colspan="5">暂无提交记录</td></tr>';
            } else {
                problemTbody.innerHTML = '';
                problemStatuses.forEach((ps, idx) => {
                    const row = el('tr', {className:'clickable'}, [
                        el('td', {textContent: ps.id}),
                        el('td', {textContent: ps.title}),
                        el('td', {innerHTML: difficultyBadge(ps.difficulty)}),
                        el('td', {innerHTML: ps.solved
                            ? '<span style="color:#4caf50;font-weight:bold;">已通过</span>'
                            : '<span style="color:#f44336;font-weight:bold;">未通过</span>'}),
                        el('td', {innerHTML: `<strong>${ps.attempt_count}</strong> 次`})
                    ]);
                    row.addEventListener('click', () => App.navigate('#/problems/' + ps.id));
                    problemTbody.appendChild(row);
                });
            }
            $('#toggle-history-btn').style.display = 'inline-block';
        } catch(e) {
            problemTbody.innerHTML = '<tr><td colspan="5">加载失败: ' + escapeHtml(e.message) + '</td></tr>';
        }
    }

    function updateStats() {
        const statsEl = $('#submission-stats');
        if (problemStatuses.length === 0) {
            statsEl.textContent = '';
            return;
        }
        const totalSubs = allSubs.length || problemStatuses.reduce((s, p) => s + p.attempt_count, 0);
        const solvedCount = problemStatuses.filter(p => p.solved).length;
        const attemptedCount = problemStatuses.length;
        statsEl.innerHTML = `共 ${totalSubs} 次提交，通过 <strong>${solvedCount}</strong> 题，尝试 <strong>${attemptedCount}</strong> 题`;
    }

    async function loadHistoryPage() {
        try {
            const subs = await API.getUserSubmissions(historyPage);
            allSubs.push(...subs);
            updateStats();
            if (historyPage === 1) tbody.innerHTML = '';
            if (subs.length === 0 && historyPage === 1) {
                tbody.innerHTML = '<tr><td colspan="6">暂无提交记录</td></tr>';
                return;
            }
            subs.forEach(s => {
                const color = getStatusColor(s.status);
                const statusText = getStatusText(s.status);
                const row = el('tr', {className:'clickable'}, [
                    el('td', {}, escapeHtml(s.title)),
                    el('td', {innerHTML: difficultyBadge(s.difficulty)}),
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
                $('#load-more-btn').addEventListener('click', () => { historyPage++; loadHistoryPage(); });
            } else {
                $('#load-more').innerHTML = '';
            }
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="6">加载失败: ' + escapeHtml(e.message) + '</td></tr>';
        }
    }

    await loadProblemStatus();

    let historyLoaded = false;
    $('#toggle-history-btn').addEventListener('click', () => {
        const historyDiv = $('#submission-history');
        if (historyDiv.style.display === 'none') {
            historyDiv.style.display = 'block';
            $('#toggle-history-btn').textContent = '收起提交历史';
            if (!historyLoaded) {
                loadHistoryPage();
                historyLoaded = true;
            }
        } else {
            historyDiv.style.display = 'none';
            $('#toggle-history-btn').textContent = '查看提交历史';
        }
    });
}
