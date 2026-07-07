async function renderProblemSets(main) {
    await App.ensureAuth();
    const sets = await API.getProblemSets();

    function pct(s) {
        const total = parseInt(s.total_count, 10) || 0;
        const solved = parseInt(s.solved_count, 10) || 0;
        return total > 0 ? Math.round(solved * 100 / total) : 0;
    }

    main.innerHTML = `
        <div class="page-container">
            <h2>题单 / 训练计划</h2>
            <p class="filter-hint">按难度自动生成训练题单，结合你的 AC 记录展示完成进度。</p>
            <div class="set-grid">
                ${sets.map(s => `
                    <div class="set-card clickable" data-href="#/sets/${s.id}">
                        <div class="set-card-title">${escapeHtml(s.title)}</div>
                        <div class="set-card-desc">${escapeHtml(s.description)}</div>
                        <div class="set-card-meta">
                            ${s.difficulty ? difficultyBadge(s.difficulty) : '<span class="diff-badge">全部</span>'}
                            <span>${s.solved_count || 0}/${s.total_count || 0} 已完成</span>
                        </div>
                        <div class="progress-bar"><span style="width:${pct(s)}%"></span></div>
                    </div>
                `).join('')}
            </div>
        </div>`;

    main.querySelectorAll('.set-card').forEach(card => {
        card.addEventListener('click', () => App.navigate(card.dataset.href));
    });
}

async function renderProblemSetDetail(main) {
    await App.ensureAuth();
    const setId = main.dataset.setId || 'all';
    const set = await API.getProblemSet(setId);
    const solved = set.problems.filter(p => p.solved).length;
    const total = set.problems.length;
    const percent = total > 0 ? Math.round(solved * 100 / total) : 0;

    main.innerHTML = `
        <div class="page-container">
            <a href="#/sets" class="back-link">← 返回题单</a>
            <h2>${escapeHtml(set.title)}</h2>
            <p class="filter-hint">${escapeHtml(set.description)}</p>
            <div class="stats-cards">
                <div class="stat-card"><div class="stat-num">${solved}</div><div class="stat-label">已完成</div></div>
                <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">题目数</div></div>
                <div class="stat-card"><div class="stat-num">${percent}%</div><div class="stat-label">完成率</div></div>
            </div>
            <table class="data-table">
                <thead><tr><th>状态</th><th>#</th><th>题目</th><th>难度</th><th>通过率</th><th>时间</th><th>内存</th></tr></thead>
                <tbody>
                    ${set.problems.length ? set.problems.map(p => `
                        <tr class="clickable" data-href="#/problems/${p.id}">
                            <td>${p.solved ? '<span style="color:#4caf50;font-weight:bold;">AC</span>' : '<span style="color:#999;">未完成</span>'}</td>
                            <td>${p.display_index != null ? p.display_index : p.id}</td>
                            <td>${escapeHtml(p.title)}</td>
                            <td>${difficultyBadge(p.difficulty)}</td>
                            <td>${p.acceptance_rate || 0}%</td>
                            <td>${p.time_limit}s</td>
                            <td>${p.memory_limit}MB</td>
                        </tr>`).join('') : '<tr><td colspan="7" class="empty-hint">这个题单暂无题目</td></tr>'}
                </tbody>
            </table>
        </div>`;

    main.querySelectorAll('tr.clickable').forEach(row => {
        row.addEventListener('click', () => App.navigate(row.dataset.href));
    });
}
