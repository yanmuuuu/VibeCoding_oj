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
    else if (hash === '/admin/discussions') currentTab = 'discussions';

    main.innerHTML = `<div class="page-container">
        <a href="#/problems" class="back-link">← 返回题目列表</a>
        <h2>管理后台</h2>
        <div class="admin-tabs">
            <a href="#/admin/stats" class="admin-tab${currentTab==='stats'?' active':''}" data-tab="stats">统计</a>
            <a href="#/admin/questions" class="admin-tab${currentTab==='questions'?' active':''}" data-tab="questions">题目管理</a>
            <a href="#/admin/users" class="admin-tab${currentTab==='users'?' active':''}" data-tab="users">用户管理</a>
            <a href="#/admin/announcements" class="admin-tab${currentTab==='announcements'?' active':''}" data-tab="announcements">公告管理</a>
            <a href="#/admin/discussions" class="admin-tab${currentTab==='discussions'?' active':''}" data-tab="discussions">讨论管理</a>
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
            else if (t === 'discussions') loadDiscussions(content);
        });
    });

    // Load initial tab
    if (currentTab === 'stats') loadStats(content);
    else if (currentTab === 'questions') loadQuestions(content);
    else if (currentTab === 'users') loadUsers(content);
    else if (currentTab === 'announcements') loadAnnouncements(content);
    else if (currentTab === 'discussions') loadDiscussions(content);
}

async function loadStats(content) {
    const stats = await API.getAdminStats();
    function listItems(items, renderFn) {
        if (!items || !items.length) return '<li class="activity-empty">暂无记录</li>';
        return items.map(renderFn).join('');
    }
    content.innerHTML = `<div class="admin-stats">
        <div class="stat-card"><div class="stat-num">${stats.total_users}</div><div class="stat-label">总用户数</div></div>
        <div class="stat-card"><div class="stat-num">${stats.total_questions}</div><div class="stat-label">总题目数</div></div>
        <div class="stat-card"><div class="stat-num">${stats.total_submissions}</div><div class="stat-label">总提交数</div></div>
    </div>
    <div class="admin-activity-grid">
        <div class="admin-activity-card"><h4>最近提交</h4><ul>${listItems(stats.recent_submissions, s => `<li><span class="activity-main">${escapeHtml(s.username)} · ${escapeHtml(s.question_title)}</span><span class="activity-meta">${escapeHtml(s.status)} · ${formatDate(s.created_at)}</span></li>`)}</ul></div>
        <div class="admin-activity-card"><h4>新注册用户</h4><ul>${listItems(stats.recent_users, u => `<li><span class="activity-main">${escapeHtml(u.username)}</span><span class="activity-meta">${formatDate(u.created_at)}</span></li>`)}</ul></div>
        <div class="admin-activity-card"><h4>最新讨论</h4><ul>${listItems(stats.recent_discussions, d => `<li><span class="activity-main">${escapeHtml(d.username)}: ${escapeHtml(d.preview || '')}</span><span class="activity-meta">${formatDate(d.created_at)}</span></li>`)}</ul></div>
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
            <td>${escapeHtml(q.difficulty || '简单')}</td>
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
        <thead><tr><th width="30"></th><th>#</th><th>标题</th><th>难度</th><th>可见</th><th>限制</th><th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">暂无题目</td></tr>'}</tbody>
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
            if (checked.length === 0) { await showAlert('请先选择题目'); return; }
            if (action === 'delete' && !(await showConfirm('确定要删除 ' + checked.length + ' 道题目吗？', { danger: true }))) return;
            try {
                await API.batchQuestions(action, checked);
                loadQuestions(content);
            } catch(e) {
                await showAlert('操作失败: ' + e.message);
            }
        });
    });

    // Delete single
    $$('.delete-q').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!(await showConfirm('确定要删除此题目？', { danger: true }))) return;
            try {
                await API.deleteQuestion(btn.dataset.id);
                loadQuestions(content);
            } catch(e) {
                await showAlert('删除失败: ' + e.message);
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
    const state = { step: 1, questionId: null, refEditor: null };

    function renderWizard() {
        const steps = ['基本信息', '标程代码', '测试用例'];
        let stepHtml = '<div class="admin-wizard-steps">';
        steps.forEach((label, i) => {
            const n = i + 1;
            stepHtml += `<span class="wizard-step${state.step === n ? ' active' : ''}${state.step > n ? ' done' : ''}">${n}. ${label}</span>`;
        });
        stepHtml += '</div>';

        if (state.step === 1) {
            content.innerHTML = `<a href="javascript:void(0)" class="back-link" id="back-to-questions">← 返回题目管理</a>
                <h3>新建题目</h3>${stepHtml}
                <form id="wizard-step1-form" class="admin-wizard-panel">
                    <div class="form-group"><label>标题</label><input type="text" id="w-title" required></div>
                    <div class="form-group"><label>难度</label><select id="w-diff" required><option value="简单">简单</option><option value="中等">中等</option><option value="困难">困难</option></select></div>
                    <div class="form-group"><label>描述（Markdown）</label><div class="md-edit-row"><textarea id="w-desc" rows="8" required></textarea><div id="w-desc-preview" class="md-preview-panel"></div></div></div>
                    <div class="form-group"><label>输入格式</label><textarea id="w-ifmt" rows="2"></textarea></div>
                    <div class="form-group"><label>输出格式</label><textarea id="w-ofmt" rows="2"></textarea></div>
                    <div class="form-group"><label>样例输入</label><textarea id="w-sin" rows="3"></textarea></div>
                    <div class="form-group"><label>样例输出</label><textarea id="w-sout" rows="3"></textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label>时间限制(秒)</label><input type="number" id="w-tl" value="1" min="0.1" step="0.1"></div>
                        <div class="form-group"><label>内存限制(MB)</label><input type="number" id="w-ml" value="256" min="1"></div>
                    </div>
                    <div id="wizard-error" class="error" style="display:none;"></div>
                    <button type="submit" class="btn-primary" style="width:auto;padding:8px 22px;">保存草稿并下一步</button>
                </form>`;
            bindMarkdownPreview('w-desc', 'w-desc-preview');
            $('#back-to-questions').onclick = () => loadQuestions(content);
            if (state.questionId) {
                API.getAdminQuestion(state.questionId).then(q => {
                    $('#w-title').value = q.title || '';
                    $('#w-diff').value = q.difficulty || '简单';
                    $('#w-desc').value = q.description || '';
                    $('#w-ifmt').value = q.input_format || '';
                    $('#w-ofmt').value = q.output_format || '';
                    $('#w-sin').value = q.sample_input || '';
                    $('#w-sout').value = q.sample_output || '';
                    $('#w-tl').value = q.time_limit || 1;
                    $('#w-ml').value = q.memory_limit || 256;
                    bindMarkdownPreview('w-desc', 'w-desc-preview');
                });
            }
            $('#wizard-step1-form').onsubmit = async (e) => {
                e.preventDefault();
                const err = $('#wizard-error');
                err.style.display = 'none';
                const data = {
                    title: $('#w-title').value.trim(),
                    description: $('#w-desc').value.trim(),
                    difficulty: $('#w-diff').value,
                    input_format: $('#w-ifmt').value.trim(),
                    output_format: $('#w-ofmt').value.trim(),
                    sample_input: $('#w-sin').value.trim(),
                    sample_output: $('#w-sout').value.trim(),
                    time_limit: parseFloat($('#w-tl').value) || 1,
                    memory_limit: parseInt($('#w-ml').value) || 256,
                    is_visible: false
                };
                if (!data.title || !data.description) {
                    err.textContent = '标题和描述为必填';
                    err.style.display = '';
                    return;
                }
                try {
                    if (state.questionId) await API.updateQuestion(state.questionId, data);
                    else {
                        const res = await API.createQuestion(data);
                        state.questionId = res.id;
                    }
                    state.step = 2;
                    renderWizard();
                } catch (ex) {
                    err.textContent = ex.message;
                    err.style.display = '';
                }
            };
            return;
        }

        if (state.step === 2) {
            content.innerHTML = `<a href="javascript:void(0)" class="back-link" id="back-to-questions">← 返回题目管理</a>
                <h3>新建题目 #${state.questionId}</h3>${stepHtml}
                <div class="admin-wizard-panel">
                    <p class="admin-hint">题目已保存为草稿。请录入 C++ 标程代码。</p>
                    <div id="w-ref-editor" style="height:300px;border-radius:8px;overflow:hidden;"></div>
                    <div id="wizard-error" class="error" style="display:none;margin-top:10px;"></div>
                    <div style="margin-top:14px;display:flex;gap:10px;">
                        <button type="button" class="btn-secondary" id="wizard-prev">上一步</button>
                        <button type="button" class="btn-primary" id="wizard-save-ref" style="width:auto;padding:8px 22px;">保存标程并下一步</button>
                    </div>
                </div>`;
            $('#back-to-questions').onclick = () => loadQuestions(content);
            $('#wizard-prev').onclick = () => { state.step = 1; renderWizard(); };
            API.getAdminQuestion(state.questionId).then(q => {
                state.refEditor = initAdminAce('w-ref-editor', q.reference_code || '');
            });
            $('#wizard-save-ref').onclick = async () => {
                const err = $('#wizard-error');
                err.style.display = 'none';
                const code = state.refEditor.getValue().trim();
                if (!code) { err.textContent = '请填写标程代码'; err.style.display = ''; return; }
                try {
                    await API.updateQuestion(state.questionId, { reference_code: code, is_visible: false });
                    state.step = 3;
                    renderWizard();
                } catch (ex) {
                    err.textContent = ex.message;
                    err.style.display = '';
                }
            };
            return;
        }

        content.innerHTML = `<a href="javascript:void(0)" class="back-link" id="back-to-questions">← 返回题目管理</a>
            <h3>新建题目 #${state.questionId}</h3>${stepHtml}
            <div class="admin-wizard-panel">
                <p class="admin-hint">添加测试用例后可发布。也可稍后到编辑页继续完善。</p>
                <div id="wizard-tc-list"></div>
                <form id="wizard-tc-form" style="margin-top:16px;">
                    <div class="form-group"><label>输入数据</label><textarea id="w-tc-input" rows="3" required></textarea></div>
                    <div class="form-group"><label>期望输出</label><textarea id="w-tc-output" rows="3" required></textarea></div>
                    <button type="submit" class="btn-secondary">添加测试用例</button>
                </form>
                <div id="wizard-error" class="error" style="display:none;margin-top:10px;"></div>
                <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
                    <button type="button" class="btn-secondary" id="wizard-prev">上一步</button>
                    <button type="button" class="btn-secondary" id="wizard-gen">生成期望输出并校验</button>
                    <button type="button" class="btn-primary" id="wizard-finish-draft" style="width:auto;padding:8px 22px;">保存草稿并完成</button>
                    <button type="button" class="btn-primary" id="wizard-publish" style="width:auto;padding:8px 22px;">发布题目</button>
                </div>
            </div>`;

        let wizardCases = [];

        async function refreshWizardCases() {
            wizardCases = await API.getTestCases(state.questionId);
            let html = '<table class="data-table"><thead><tr><th>#</th><th>输入</th><th>期望输出</th><th>操作</th></tr></thead><tbody>';
            if (!wizardCases.length) html += '<tr><td colspan="4">暂无测试用例</td></tr>';
            else wizardCases.forEach(tc => {
                html += `<tr><td>${tc.id}</td><td><pre class="tc-preview">${escapeHtml(tc.input_data.substring(0,80))}</pre></td><td><pre class="tc-preview">${escapeHtml(tc.expected_output.substring(0,80))}</pre></td><td><button class="btn-sm btn-danger w-del-tc" data-id="${tc.id}">删除</button></td></tr>`;
            });
            html += '</tbody></table>';
            $('#wizard-tc-list').innerHTML = html;
            $$('.w-del-tc').forEach(btn => btn.onclick = async () => {
                await API.deleteTestCase(state.questionId, btn.dataset.id);
                refreshWizardCases();
            });
        }

        refreshWizardCases();
        $('#back-to-questions').onclick = () => loadQuestions(content);
        $('#wizard-prev').onclick = () => { state.step = 2; renderWizard(); };
        $('#wizard-tc-form').onsubmit = async (e) => {
            e.preventDefault();
            await API.createTestCase(state.questionId, {
                input_data: $('#w-tc-input').value.trim(),
                expected_output: $('#w-tc-output').value.trim(),
                order_index: wizardCases.length
            });
            $('#w-tc-input').value = '';
            $('#w-tc-output').value = '';
            refreshWizardCases();
        };
        $('#wizard-gen').onclick = async () => {
            const err = $('#wizard-error');
            err.style.display = 'none';
            if (!wizardCases.length) { err.textContent = '请先添加测试用例'; err.style.display = ''; return; }
            const q = await API.getAdminQuestion(state.questionId);
            const inputs = wizardCases.map(tc => tc.input_data).join('|||');
            try {
                const result = await API.generateOutputs(q.reference_code || '', inputs);
                if (result.compile_error) throw new Error(result.compile_error);
                for (let i = 0; i < wizardCases.length; i++) {
                    await API.updateTestCase(state.questionId, wizardCases[i].id, {
                        input_data: wizardCases[i].input_data,
                        expected_output: result.outputs[i],
                        order_index: wizardCases[i].order_index
                    });
                }
                showToast('期望输出已生成', 'success');
                refreshWizardCases();
            } catch (ex) {
                err.textContent = ex.message;
                err.style.display = '';
            }
        };
        $('#wizard-finish-draft').onclick = () => {
            showToast('草稿已保存', 'success');
            window.location.hash = '#/admin/questions/' + state.questionId;
        };
        $('#wizard-publish').onclick = async () => {
            const err = $('#wizard-error');
            err.style.display = 'none';
            try {
                const q = await API.getAdminQuestion(state.questionId);
                await API.updateQuestion(state.questionId, {
                    title: q.title,
                    description: q.description,
                    difficulty: q.difficulty,
                    reference_code: q.reference_code || '',
                    is_visible: true
                });
                showToast('题目已发布', 'success');
                loadQuestions(content);
            } catch (ex) {
                err.textContent = ex.message;
                err.style.display = '';
            }
        };
    }

    renderWizard();
}

async function loadDiscussions(content) {
    const page = parseInt(content.dataset.discPage || '1');
    const search = content.dataset.discSearch || '';
    const data = await API.getAdminDiscussions(page, search);
    let rows = '';
    if (data.discussions && data.discussions.length) {
        data.discussions.forEach(d => {
            rows += `<tr>
                <td>${d.id}</td>
                <td>${escapeHtml(d.username)}</td>
                <td class="disc-preview-cell">${escapeHtml((d.content || '').substring(0, 120))}${(d.content || '').length > 120 ? '...' : ''}</td>
                <td>${d.reply_count}</td>
                <td>${formatDate(d.created_at)}</td>
                <td>
                    <a href="#/discussions/${d.id}" class="btn-sm" target="_blank">查看</a>
                    <button class="btn-sm btn-danger del-disc" data-id="${d.id}">删帖</button>
                    <button class="btn-sm view-replies" data-id="${d.id}">回复</button>
                </td>
            </tr>
            <tr id="replies-row-${d.id}" style="display:none;"><td colspan="6"><div class="admin-replies-box" id="replies-box-${d.id}">加载中...</div></td></tr>`;
        });
    } else {
        rows = '<tr><td colspan="6">暂无讨论</td></tr>';
    }

    content.innerHTML = `<div class="admin-search">
        <input type="text" id="disc-search" placeholder="搜索用户名或内容..." value="${escapeHtml(search)}" style="width:280px;padding:8px 12px;">
        <button class="btn-secondary" id="disc-search-btn" style="margin-left:6px;">搜索</button>
    </div>
    <table class="data-table">
        <thead><tr><th>#</th><th>用户</th><th>内容</th><th>回复数</th><th>时间</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;

    $('#disc-search-btn').onclick = () => {
        content.dataset.discSearch = $('#disc-search').value.trim();
        content.dataset.discPage = '1';
        loadDiscussions(content);
    };
    $$('.del-disc').forEach(btn => btn.onclick = async () => {
        if (!(await showConfirm('确定删除此帖？', { danger: true }))) return;
        await API.deleteDiscussion(btn.dataset.id);
        loadDiscussions(content);
    });
    $$('.view-replies').forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.id;
        const row = $(`#replies-row-${id}`);
        if (row.style.display !== 'none') { row.style.display = 'none'; return; }
        row.style.display = '';
        const replies = await API.getAdminDiscussionReplies(id);
        let html = replies.length ? '<ul class="admin-reply-list">' : '<p>暂无回复</p>';
        replies.forEach(r => {
            html += `<li><strong>${escapeHtml(r.username)}</strong> ${formatDate(r.created_at)} <button class="btn-sm btn-danger del-reply" data-did="${id}" data-rid="${r.id}">删除</button><div>${escapeHtml(r.content)}</div></li>`;
        });
        if (replies.length) html += '</ul>';
        $(`#replies-box-${id}`).innerHTML = html;
        $$(`#replies-box-${id} .del-reply`).forEach(b => b.onclick = async () => {
            if (!(await showConfirm('确定删除此回复？', { danger: true }))) return;
            await API.deleteDiscussionReply(b.dataset.did, b.dataset.rid);
            btn.click();
            btn.click();
        });
    });
}
