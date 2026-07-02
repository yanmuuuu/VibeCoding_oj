async function renderProposalList(main) {
    await App.ensureAuth();
    if (App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>提示</h2><p>管理员请在后台审核用户录题</p><a href="#/admin/proposals">前往审核</a></div>';
        return;
    }

    const proposals = await API.getUserProposals();
    const statusBadge = (p) => {
        if (p.status === 'pending') return '<span class="badge badge-gold">待审核</span>';
        if (p.status === 'approved') return '<span class="badge badge-green">已通过</span>';
        return '<span class="badge badge-red">未通过</span>';
    };

    let rows = '';
    proposals.forEach(p => {
        const reason = p.admin_reason ? escapeHtml(p.admin_reason) : '—';
        const qLink = p.question_id
            ? `<a href="#/problems/${p.question_id}">#${p.question_display_index != null ? p.question_display_index : p.question_id}</a>`
            : '—';
        const action = p.status === 'rejected'
            ? `<a href="#/proposals/edit/${p.id}" class="btn-sm">修改重提</a>`
            : '';
        rows += `<tr>
            <td>${p.id}</td>
            <td>${escapeHtml(p.title)}</td>
            <td>${difficultyBadge(p.difficulty)}</td>
            <td>${statusBadge(p)}</td>
            <td class="proposal-reason">${reason}</td>
            <td>${qLink}</td>
            <td>${formatDate(p.created_at)}</td>
            <td>${action}</td>
        </tr>`;
    });

    main.innerHTML = `<div class="page-container">
        <a href="#/problems" class="back-link">← 返回题目列表</a>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
            <h2 style="margin:0;">我的录题</h2>
            <a href="#/proposals/submit" class="btn-primary" style="width:auto;display:inline-block;padding:8px 22px;text-decoration:none;">+ 提交录题</a>
        </div>
        <p class="admin-hint">待审核最多 3 条；未通过可修改后重新提交。</p>
        <table class="data-table">
            <thead><tr>
                <th>ID</th><th>标题</th><th>难度</th><th>状态</th><th>审核说明</th><th>关联题目</th><th>提交时间</th><th>操作</th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="8">暂无录题记录，<a href="#/proposals/submit">去提交</a></td></tr>'}</tbody>
        </table>
    </div>`;
}
