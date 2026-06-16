async function renderProblems(main) {
    await App.ensureAuth();
    const problems = await API.getProblems();
    let rows = '';
    problems.forEach(p => {
        rows += `<tr class="clickable" data-href="#/problems/${p.id}">
            <td>${p.id}</td>
            <td>${escapeHtml(p.title)}</td>
            <td>${p.time_limit}s</td>
            <td>${p.memory_limit}MB</td>
        </tr>`;
    });
    main.innerHTML = `
        <div class="page-container">
            <h2>题目列表</h2>
            <table class="data-table">
                <thead><tr><th>#</th><th>标题</th><th>时间限制</th><th>内存限制</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="4">暂无题目</td></tr>'}</tbody>
            </table>
        </div>`;

    $$('.clickable').forEach(el => {
        el.addEventListener('click', () => { window.location.hash = el.dataset.href; });
    });
}
