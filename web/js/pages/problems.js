async function renderProblems(main) {
    await App.ensureAuth();
    const problems = await API.getProblems();

    function matchProblem(p, rawKeyword) {
        var keyword = rawKeyword.trim().toLowerCase();
        if (!keyword) return true;

        if (keyword.charAt(0) === '#') {
            keyword = keyword.slice(1).trim();
        }

        if (/^\d+$/.test(keyword)) {
            if (String(p.id) === keyword) return true;
            if (String(p.id).includes(keyword)) return true;
        }

        if (p.title && p.title.toLowerCase().includes(keyword)) return true;

        var diff = (p.difficulty || '').toLowerCase();
        if (diff.includes(keyword)) return true;
        if (keyword === 'easy' && p.difficulty === '简单') return true;
        if (keyword === 'medium' && p.difficulty === '中等') return true;
        if (keyword === 'hard' && p.difficulty === '困难') return true;

        return false;
    }

    function renderTable(filtered, keyword, difficulty) {
        if (filtered.length === 0) {
            if (!keyword && !difficulty) {
                return '<tr><td colspan="5" class="empty-hint">暂无题目，请联系管理员添加，或稍后再来看看～</td></tr>';
            }
            return '<tr><td colspan="5" class="empty-hint">没有匹配的题目，试试编号（如 1 或 #3）、标题关键词或难度吧</td></tr>';
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
            <div class="filter-bar">
                <input type="text" id="problem-search" class="filter-input filter-input-wide" placeholder="编号 / 标题 / 难度…">
                <select id="problem-difficulty" class="filter-select">
                    <option value="">全部难度</option>
                    <option value="简单">简单</option>
                    <option value="中等">中等</option>
                    <option value="困难">困难</option>
                </select>
            </div>
            <p class="filter-hint">支持题目编号（如 <code>1</code>、<code>#3</code>）、标题关键词；可与难度筛选组合使用</p>
            <table class="data-table">
                <thead><tr><th>#</th><th>标题</th><th>难度</th><th>时间限制</th><th>内存限制</th></tr></thead>
                <tbody id="problem-tbody">${renderTable(problems, '', '')}</tbody>
            </table>
        </div>`;

    function bindRows() {
        $$('#problem-tbody .clickable').forEach(el => {
            el.addEventListener('click', () => { window.location.hash = el.dataset.href; });
        });
    }

    function applyFilter() {
        const keyword = $('#problem-search').value;
        const difficulty = $('#problem-difficulty').value;
        const filtered = problems.filter(p => {
            if (!matchProblem(p, keyword)) return false;
            if (difficulty && p.difficulty !== difficulty) return false;
            return true;
        });
        $('#problem-tbody').innerHTML = renderTable(filtered, keyword.trim(), difficulty);
        bindRows();
    }

    $('#problem-search').addEventListener('input', applyFilter);
    $('#problem-difficulty').addEventListener('change', applyFilter);
    bindRows();
}
