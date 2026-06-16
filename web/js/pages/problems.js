async function renderProblems(main) {
    await App.ensureAuth();
    const problems = await API.getProblems();

    function renderTable(filtered) {
        if (filtered.length === 0) {
            return '<tr><td colspan="5">暂无匹配题目</td></tr>';
        }
        return filtered.map(p =>
            `<tr class="clickable" data-href="#/problems/${p.id}">
                <td>${p.id}</td>
                <td>${escapeHtml(p.title)}</td>
                <td>${difficultyBadge(p.difficulty)}</td>
                <td>${p.time_limit}s</td>
                <td>${p.memory_limit}MB</td>
            </tr>`
        ).join('');
    }

    main.innerHTML = `
        <div class="page-container">
            <h2>题目列表</h2>
            <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;">
                <input type="text" id="problem-search" placeholder="搜索题目..." style="padding:6px 10px;border:1px solid #d9d9d9;border-radius:4px;width:200px;font-size:14px;">
                <select id="problem-difficulty" style="padding:6px 10px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;">
                    <option value="">全部难度</option>
                    <option value="简单">简单</option>
                    <option value="中等">中等</option>
                    <option value="困难">困难</option>
                </select>
            </div>
            <table class="data-table">
                <thead><tr><th>#</th><th>标题</th><th>难度</th><th>时间限制</th><th>内存限制</th></tr></thead>
                <tbody id="problem-tbody">${renderTable(problems)}</tbody>
            </table>
        </div>`;

    function applyFilter() {
        const keyword = $('#problem-search').value.toLowerCase().trim();
        const difficulty = $('#problem-difficulty').value;
        const filtered = problems.filter(p => {
            if (keyword && !p.title.toLowerCase().includes(keyword)) return false;
            if (difficulty && p.difficulty !== difficulty) return false;
            return true;
        });
        const tbody = $('#problem-tbody');
        tbody.innerHTML = renderTable(filtered);
        tbody.querySelectorAll('.clickable').forEach(el => {
            el.addEventListener('click', () => { window.location.hash = el.dataset.href; });
        });
    }

    $('#problem-search').addEventListener('input', applyFilter);
    $('#problem-difficulty').addEventListener('change', applyFilter);

    $$('.clickable').forEach(el => {
        el.addEventListener('click', () => { window.location.hash = el.dataset.href; });
    });
}
