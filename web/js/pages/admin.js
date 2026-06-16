async function renderAdmin(main) {
    await App.ensureAuth();
    if (!App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>403</h2><p>无权限访问</p><a href="#/problems">返回题目列表</a></div>';
        return;
    }
    const questions = await API.getAdminQuestions();
    let rows = '';
    questions.forEach(q => {
        rows += `<tr>
            <td>${q.id}</td>
            <td>${escapeHtml(q.title)}</td>
            <td>${q.is_visible ? '是' : '否'}</td>
            <td>
                <a href="#/admin/questions/${q.id}" class="btn-sm">编辑</a>
                <button class="btn-sm btn-danger delete-q" data-id="${q.id}">删除</button>
            </td>
        </tr>`;
    });
    main.innerHTML = `<div class="page-container">
        <a href="#/problems" class="back-link">← 返回题目列表</a>
        <h2>管理后台</h2>
        <div class="admin-actions">
            <a href="#/admin/questions" class="btn-primary" style="display:inline-block;">新建题目</a>
        </div>
        <h3>题目管理</h3>
        <table class="data-table">
            <thead><tr><th>#</th><th>标题</th><th>可见</th><th>操作</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">暂无题目</td></tr>'}</tbody>
        </table>
    </div>`;

    $$('.delete-q').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('确定要删除此题目？')) return;
            try {
                await API.deleteQuestion(btn.dataset.id);
                App.navigate('#/admin');
            } catch(e) {
                alert('删除失败: ' + e.message);
            }
        });
    });
}
