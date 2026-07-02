async function renderAdminProposalReview(main) {
    await App.ensureAuth();
    if (!App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>403</h2><p>无权限访问</p></div>';
        return;
    }

    const pid = main.dataset.proposalId;
    const p = await API.getAdminProposal(pid);
    if (p.status !== 'pending') {
        main.innerHTML = `<div class="page-container">
            <a href="#/admin/proposals" class="back-link">← 返回录题审核</a>
            <h2>录题 #${p.id}：${escapeHtml(p.title)}</h2>
            <p>状态：${escapeHtml(p.status_label)}</p>
            ${p.admin_reason ? '<p>审核说明：' + escapeHtml(p.admin_reason) + '</p>' : ''}
            ${p.question_id ? '<p>关联题目：<a href="#/admin/questions/' + p.question_id + '">编辑题目 #' + (p.question_display_index != null ? p.question_display_index : p.question_id) + '</a></p>' : ''}
        </div>`;
        return;
    }

    let testCases = await API.getProposalTestCases(pid);
    let currentTestCases = testCases;
    let savedReferenceCode = p.reference_code || '';

    main.innerHTML = `<div class="page-container admin-edit-page" style="max-width:1100px;">
        <a href="#/admin/proposals" class="back-link">← 返回录题审核</a>
        <div class="admin-edit-header">
            <h2>审核录题 #${p.id}：${escapeHtml(p.title)}</h2>
            <span class="admin-hint">提交者：${escapeHtml(p.username || '')}</span>
        </div>

        <section class="admin-section">
            <h3>题目信息（可补充修改）</h3>
            <form id="proposal-form">
                <div class="form-group"><label>标题</label><input type="text" id="p-title" value="${escapeHtml(p.title)}" required></div>
                <div class="form-row">
                    <div class="form-group"><label>难度</label>
                        <select id="p-diff" required>
                            <option value="简单">简单</option>
                            <option value="中等">中等</option>
                            <option value="困难">困难</option>
                        </select>
                    </div>
                    <div class="form-group"><label>时间限制(秒)</label><input type="number" id="p-tl" value="${p.time_limit}" min="0.1" step="0.1"></div>
                    <div class="form-group"><label>内存限制(MB)</label><input type="number" id="p-ml" value="${p.memory_limit}" min="1"></div>
                </div>
                <div class="form-group"><label>描述（Markdown）</label>
                    <div class="md-edit-row">
                        <textarea id="p-desc" rows="8" required>${escapeHtml(p.description)}</textarea>
                        <div id="p-desc-preview" class="md-preview-panel"></div>
                    </div>
                </div>
                <div class="form-group"><label>输入格式</label><textarea id="p-ifmt" rows="2">${escapeHtml(p.input_format || '')}</textarea></div>
                <div class="form-group"><label>输出格式</label><textarea id="p-ofmt" rows="2">${escapeHtml(p.output_format || '')}</textarea></div>
                <div class="form-group"><label>样例输入</label><textarea id="p-sin" rows="3">${escapeHtml(p.sample_input || '')}</textarea></div>
                <div class="form-group"><label>样例输出</label><textarea id="p-sout" rows="3">${escapeHtml(p.sample_output || '')}</textarea></div>
                <div id="form-error" class="error" style="display:none;"></div>
                <button type="submit" class="btn-secondary" style="width:auto;padding:8px 18px;">保存修改</button>
            </form>
        </section>

        <section class="admin-section">
            <h3>标程代码（管理员补充）</h3>
            <div id="ref-stale-warning" class="admin-warning" style="display:none;">标程已修改，期望输出可能过期，请重新生成。</div>
            <div id="ref-code-editor" style="height:280px;border-radius:8px;overflow:hidden;"></div>
            <button id="save-ref-btn" class="btn-secondary" style="margin-top:12px;">保存标程</button>
            <button id="gen-outputs-btn" class="btn-secondary" style="margin-top:12px;margin-left:8px;">编译运行，生成期望输出并校验</button>
            <div id="gen-result" style="margin-top:10px;display:none;"></div>
        </section>

        <section class="admin-section">
            <h3>测试用例（管理员补充）</h3>
            <div id="testcase-list"></div>
            <h4>添加测试用例</h4>
            <form id="tc-form">
                <div class="form-group"><label>输入数据</label><textarea id="tc-input" rows="3" required></textarea></div>
                <div class="form-group"><label>期望输出</label><textarea id="tc-output" rows="3" required></textarea></div>
                <button type="submit" class="btn-secondary">添加测试用例</button>
            </form>
        </section>

        <section class="admin-section">
            <h3>审核决定</h3>
            <div class="form-group"><label>通过说明（选填）</label><textarea id="approve-reason" rows="2" placeholder="可填写给用户的通过备注"></textarea></div>
            <div class="form-group"><label><input type="checkbox" id="publish-immediately"> 通过后立即发布为可见题目</label></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
                <button type="button" class="btn-primary" id="approve-btn" style="width:auto;padding:8px 22px;">通过</button>
                <button type="button" class="btn-danger" id="reject-btn" style="width:auto;padding:8px 22px;">不通过</button>
            </div>
            <div id="review-error" class="error" style="display:none;margin-top:10px;"></div>
        </section>
    </div>`;

    $('#p-diff').value = p.difficulty || '简单';
    bindMarkdownPreview('p-desc', 'p-desc-preview');
    const refEditor = initAdminAce('ref-code-editor', savedReferenceCode);

    function collectProposalData() {
        return {
            title: $('#p-title').value.trim(),
            description: $('#p-desc').value.trim(),
            difficulty: $('#p-diff').value,
            input_format: $('#p-ifmt').value.trim(),
            output_format: $('#p-ofmt').value.trim(),
            sample_input: $('#p-sin').value.trim(),
            sample_output: $('#p-sout').value.trim(),
            time_limit: parseFloat($('#p-tl').value) || 1,
            memory_limit: parseInt($('#p-ml').value) || 256,
            reference_code: refEditor.getValue()
        };
    }

    function updateStaleWarning() {
        const stale = refEditor.getValue() !== savedReferenceCode;
        $('#ref-stale-warning').style.display = stale ? 'block' : 'none';
    }
    refEditor.session.on('change', updateStaleWarning);

    function renderTestCases(tcs) {
        currentTestCases = tcs;
        let html = '<table class="data-table"><thead><tr><th>#</th><th>输入</th><th>期望输出</th><th>操作</th></tr></thead><tbody>';
        if (tcs.length === 0) {
            html += '<tr><td colspan="4">暂无测试用例</td></tr>';
        } else {
            tcs.forEach((tc, idx) => {
                html += `<tr id="tc-row-${tc.id}">
                    <td>${tc.order_index != null ? tc.order_index : idx}</td>
                    <td class="tc-cell"><pre class="tc-preview">${escapeHtml(tc.input_data.substring(0, 80))}${tc.input_data.length > 80 ? '...' : ''}</pre></td>
                    <td class="tc-cell"><pre class="tc-preview">${escapeHtml(tc.expected_output.substring(0, 80))}${tc.expected_output.length > 80 ? '...' : ''}</pre></td>
                    <td><button class="btn-sm btn-danger delete-tc-btn" data-id="${tc.id}">删除</button></td>
                </tr>`;
            });
        }
        html += '</tbody></table>';
        $('#testcase-list').innerHTML = html;
        $$('.delete-tc-btn').forEach(btn => btn.addEventListener('click', async function() {
            if (!(await showConfirm('确定删除此测试用例？', { danger: true }))) return;
            try {
                await API.deleteProposalTestCase(pid, this.dataset.id);
                renderTestCases(await API.getProposalTestCases(pid));
            } catch (e) { showToast('删除失败: ' + e.message, 'error'); }
        }));
    }
    renderTestCases(testCases);

    $('#proposal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = $('#form-error');
        errorEl.style.display = 'none';
        try {
            await API.updateAdminProposal(pid, collectProposalData());
            showToast('已保存', 'success');
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = '';
        }
    });

    $('#save-ref-btn').addEventListener('click', async () => {
        try {
            await API.updateAdminProposal(pid, { reference_code: refEditor.getValue() });
            savedReferenceCode = refEditor.getValue();
            updateStaleWarning();
            showToast('标程已保存', 'success');
        } catch (e) { showToast('保存失败: ' + e.message, 'error'); }
    });

    $('#gen-outputs-btn').addEventListener('click', async function() {
        const code = refEditor.getValue().trim();
        if (!code) { showToast('请先填写标程代码', 'error'); return; }
        if (!currentTestCases.length) { showToast('请先添加测试用例', 'error'); return; }

        const allInputs = currentTestCases.map(tc => tc.input_data).join('|||');
        const genResult = $('#gen-result');
        genResult.style.display = '';
        genResult.textContent = '编译运行中...';
        this.disabled = true;
        try {
            await API.updateAdminProposal(pid, { reference_code: code });
            savedReferenceCode = code;
            updateStaleWarning();
            const result = await API.generateOutputs(code, allInputs);
            this.disabled = false;
            if (result.compile_error) {
                genResult.textContent = '编译错误: ' + result.compile_error;
                genResult.style.color = '#ff6b6d';
                return;
            }
            for (let i = 0; i < currentTestCases.length; i++) {
                const tc = currentTestCases[i];
                await API.updateProposalTestCase(pid, tc.id, {
                    input_data: tc.input_data,
                    expected_output: result.outputs[i],
                    order_index: tc.order_index
                });
            }
            renderTestCases(await API.getProposalTestCases(pid));
            genResult.textContent = '已生成 ' + result.outputs.length + ' 组期望输出';
            genResult.style.color = '#52c41a';
        } catch (e) {
            this.disabled = false;
            genResult.textContent = '生成失败: ' + e.message;
            genResult.style.color = '#ff6b6d';
        }
    });

    $('#tc-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await API.createProposalTestCase(pid, {
                input_data: $('#tc-input').value,
                expected_output: $('#tc-output').value
            });
            $('#tc-input').value = '';
            $('#tc-output').value = '';
            renderTestCases(await API.getProposalTestCases(pid));
        } catch (err) { showToast('添加失败: ' + err.message, 'error'); }
    });

    $('#approve-btn').addEventListener('click', async () => {
        const errEl = $('#review-error');
        errEl.style.display = 'none';
        if (!(await showConfirm('确定通过此录题？将创建正式题目。'))) return;
        try {
            await API.updateAdminProposal(pid, collectProposalData());
            const res = await API.approveProposal(pid, {
                reason: $('#approve-reason').value.trim(),
                publish_immediately: $('#publish-immediately').checked
            });
            showToast('已通过，题目 #' + res.display_index, 'success');
            App.navigate('#/admin/questions/' + res.question_id);
        } catch (e) {
            errEl.textContent = e.message;
            errEl.style.display = '';
        }
    });

    $('#reject-btn').addEventListener('click', async () => {
        const reason = await showPrompt('请填写不通过理由（必填）');
        if (!reason || !reason.trim()) return;
        const errEl = $('#review-error');
        errEl.style.display = 'none';
        try {
            await API.rejectProposal(pid, { reason: reason.trim() });
            showToast('已标记为不通过', 'success');
            App.navigate('#/admin/proposals');
        } catch (e) {
            errEl.textContent = e.message;
            errEl.style.display = '';
        }
    });
}

async function loadProposals(content, statusFilter) {
    const filter = statusFilter || 'pending';
    const proposals = await API.getAdminProposals(filter);
    const statusBadge = (p) => {
        if (p.status === 'pending') return '<span class="badge badge-gold">待审核</span>';
        if (p.status === 'approved') return '<span class="badge badge-green">已通过</span>';
        return '<span class="badge badge-red">未通过</span>';
    };

    let rows = '';
    proposals.forEach(p => {
        const action = p.status === 'pending'
            ? `<a href="#/admin/proposals/${p.id}" class="btn-sm">审核</a>`
            : `<a href="#/admin/proposals/${p.id}" class="btn-sm">查看</a>`;
        rows += `<tr>
            <td>${p.id}</td>
            <td>${escapeHtml(p.username || '')}</td>
            <td>${escapeHtml(p.title)}</td>
            <td>${difficultyBadge(p.difficulty)}</td>
            <td>${statusBadge(p)}</td>
            <td>${formatDate(p.created_at)}</td>
            <td>${action}</td>
        </tr>`;
    });

    content.innerHTML = `<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-secondary proposal-filter${filter==='pending'?' active':''}" data-status="pending">待审核</button>
        <button class="btn-secondary proposal-filter${filter==='approved'?' active':''}" data-status="approved">已通过</button>
        <button class="btn-secondary proposal-filter${filter==='rejected'?' active':''}" data-status="rejected">未通过</button>
        <button class="btn-secondary proposal-filter${filter==='all'?' active':''}" data-status="all">全部</button>
    </div>
    <table class="data-table">
        <thead><tr><th>ID</th><th>提交者</th><th>标题</th><th>难度</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">暂无记录</td></tr>'}</tbody>
    </table>`;

    $$('.proposal-filter').forEach(btn => {
        btn.addEventListener('click', () => loadProposals(content, btn.dataset.status));
    });
}
