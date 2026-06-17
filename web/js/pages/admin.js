async function renderAdmin(main) {
    await App.ensureAuth();
    if (!App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>403</h2><p>无权限访问</p><a href="#/problems">返回题目列表</a></div>';
        return;
    }

    const hash = window.location.hash.slice(1);
    let currentTab = 'stats';
    if (hash === '/admin/questions') currentTab = 'questions';
    else if (hash === '/admin/users') currentTab = 'users';
    else if (hash === '/admin/announcements') currentTab = 'announcements';

    main.innerHTML = `<div class="page-container">
        <a href="#/problems" class="back-link">← 返回题目列表</a>
        <h2>管理后台</h2>
        <div class="admin-tabs">
            <a href="#/admin/stats" class="admin-tab${currentTab==='stats'?' active':''}" data-tab="stats">统计</a>
            <a href="#/admin/questions" class="admin-tab${currentTab==='questions'?' active':''}" data-tab="questions">题目管理</a>
            <a href="#/admin/users" class="admin-tab${currentTab==='users'?' active':''}" data-tab="users">用户管理</a>
            <a href="#/admin/announcements" class="admin-tab${currentTab==='announcements'?' active':''}" data-tab="announcements">公告管理</a>
        </div>
        <div id="admin-content"></div>
    </div>`;

    const content = $('#admin-content');

    // Tab click handlers
    $$('.admin-tab').forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            $$('.admin-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const t = this.dataset.tab;
            if (t === 'stats') loadStats(content);
            else if (t === 'questions') loadQuestions(content);
            else if (t === 'users') loadUsers(content);
            else if (t === 'announcements') loadAnnouncements(content);
        });
    });

    // Load initial tab
    if (currentTab === 'stats') loadStats(content);
    else if (currentTab === 'questions') loadQuestions(content);
    else if (currentTab === 'users') loadUsers(content);
    else if (currentTab === 'announcements') loadAnnouncements(content);
}

async function loadStats(content) {
    const stats = await API.getAdminStats();
    content.innerHTML = `<div class="admin-stats">
        <div class="stat-card"><div class="stat-num">${stats.total_users}</div><div class="stat-label">总用户数</div></div>
        <div class="stat-card"><div class="stat-num">${stats.total_questions}</div><div class="stat-label">总题目数</div></div>
        <div class="stat-card"><div class="stat-num">${stats.total_submissions}</div><div class="stat-label">总提交数</div></div>
    </div>`;
}

async function loadQuestions(content) {
    const questions = await API.getAdminQuestions();
    let rows = '';
    questions.forEach(q => {
        rows += `<tr>
            <td><input type="checkbox" class="q-check" data-id="${q.id}"></td>
            <td>${q.id}</td>
            <td>${escapeHtml(q.title)}</td>
            <td>${q.is_visible ? '<span class="badge badge-green">可见</span>' : '<span class="badge badge-red">隐藏</span>'}</td>
            <td>${q.time_limit}s / ${q.memory_limit}MB</td>
            <td>
                <a href="#/admin/questions/${q.id}" class="btn-sm">编辑</a>
                <button class="btn-sm btn-danger delete-q" data-id="${q.id}">删除</button>
            </td>
        </tr>`;
    });

    content.innerHTML = `<div style="margin-bottom:16px;">
        <a href="#/admin/questions/new" class="btn-primary" style="width:auto;display:inline-block;padding:8px 22px;text-decoration:none;">+ 新建题目</a>
        <span class="batch-actions" style="margin-left:12px;">
            <label style="cursor:pointer;font-size:0.88em;"><input type="checkbox" id="q-select-all"> 全选</label>
            <button class="btn-secondary btn-batch" data-action="show" style="margin-left:8px;">批量显示</button>
            <button class="btn-secondary btn-batch" data-action="hide" style="margin-left:4px;">批量隐藏</button>
            <button class="btn-danger btn-batch" data-action="delete" style="margin-left:4px;">批量删除</button>
        </span>
    </div>
    <table class="data-table">
        <thead><tr><th width="30"></th><th>#</th><th>标题</th><th>可见</th><th>限制</th><th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">暂无题目</td></tr>'}</tbody>
    </table>`;

    // Select all checkbox
    const selectAll = $('#q-select-all');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            $$('.q-check').forEach(c => c.checked = this.checked);
        });
    }

    // Batch actions
    $$('.btn-batch').forEach(btn => {
        btn.addEventListener('click', async function() {
            const action = this.dataset.action;
            const checked = [];
            $$('.q-check:checked').forEach(c => checked.push(c.dataset.id));
            if (checked.length === 0) { alert('请先选择题目'); return; }
            if (action === 'delete' && !confirm(`确定要删除 ${checked.length} 道题目吗？`)) return;
            try {
                await API.batchQuestions(action, checked);
                loadQuestions(content);
            } catch(e) {
                alert('操作失败: ' + e.message);
            }
        });
    });

    // Delete single
    $$('.delete-q').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('确定要删除此题目？')) return;
            try {
                await API.deleteQuestion(btn.dataset.id);
                loadQuestions(content);
            } catch(e) {
                alert('删除失败: ' + e.message);
            }
        });
    });

    // Create question: redirect to standalone form page
    const createBtn = content.querySelector('a[href="#/admin/questions/new"]');
    if (createBtn) {
        createBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showCreateQuestionForm(content);
        });
    }
}

function showCreateQuestionForm(content) {
    content.innerHTML = `<a href="javascript:void(0)" class="back-link" id="back-to-questions">← 返回题目管理</a>
        <h3>新建题目</h3>
        <form id="question-form">
            <div class="form-group"><label>标题</label><input type="text" id="q-title" required></div>
            <div class="form-group"><label>描述</label><textarea id="q-desc" rows="5" required></textarea></div>
            <div class="form-group"><label>输入格式</label><textarea id="q-ifmt" rows="2"></textarea></div>
            <div class="form-group"><label>输出格式</label><textarea id="q-ofmt" rows="2"></textarea></div>
            <div class="form-group"><label>样例输入</label><textarea id="q-sin" rows="3"></textarea></div>
            <div class="form-group"><label>样例输出</label><textarea id="q-sout" rows="3"></textarea></div>
            <div class="form-row">
                <div class="form-group"><label>时间限制(秒)</label><input type="number" id="q-tl" value="1" min="0.1" step="0.1"></div>
                <div class="form-group"><label>内存限制(MB)</label><input type="number" id="q-ml" value="256" min="1"></div>
            </div>
            <div class="form-group"><label><input type="checkbox" id="q-vis" checked> 可见</label></div>
            <div id="form-error" class="error" style="display:none;"></div>
            <button type="submit" class="btn-primary">创建题目</button>
        </form>`;

    $('#back-to-questions').addEventListener('click', () => loadQuestions(content));

    $('#question-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = $('#form-error');
        errorEl.style.display = 'none';
        const data = {
            title: $('#q-title').value.trim(),
            description: $('#q-desc').value.trim(),
            input_format: $('#q-ifmt').value.trim(),
            output_format: $('#q-ofmt').value.trim(),
            sample_input: $('#q-sin').value.trim(),
            sample_output: $('#q-sout').value.trim(),
            time_limit: parseInt($('#q-tl').value) || 1,
            memory_limit: parseInt($('#q-ml').value) || 256,
            is_visible: $('#q-vis').checked
        };
        if (!data.title || !data.description) {
            errorEl.textContent = '标题和描述为必填';
            errorEl.style.display = '';
            return;
        }
        try {
            await API.createQuestion(data);
            loadQuestions(content);
        } catch(err) {
            errorEl.textContent = err.message;
            errorEl.style.display = '';
        }
    });
}
