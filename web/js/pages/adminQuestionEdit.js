async function renderAdminQuestionEdit(main) {
    await App.ensureAuth();
    if (!App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>403</h2><p>无权限访问</p></div>';
        return;
    }
    const qid = main.dataset.questionId;
    const q = await API.getAdminQuestion(qid);
    const testCases = await API.getTestCases(qid);

    main.innerHTML = `<div class="page-container">
        <a href="#/admin" class="back-link">← 返回管理后台</a>
        <h2>编辑题目: ${escapeHtml(q.title)}</h2>
        <form id="question-form">
            <div class="form-group"><label>标题</label><input type="text" id="q-title" value="${escapeHtml(q.title)}" required></div>
            <div class="form-group"><label>描述</label><textarea id="q-desc" rows="5" required>${escapeHtml(q.description)}</textarea></div>
            <div class="form-group"><label>输入格式</label><textarea id="q-ifmt" rows="2">${escapeHtml(q.input_format || '')}</textarea></div>
            <div class="form-group"><label>输出格式</label><textarea id="q-ofmt" rows="2">${escapeHtml(q.output_format || '')}</textarea></div>
            <div class="form-group"><label>样例输入</label><textarea id="q-sin" rows="3">${escapeHtml(q.sample_input || '')}</textarea></div>
            <div class="form-group"><label>样例输出</label><textarea id="q-sout" rows="3">${escapeHtml(q.sample_output || '')}</textarea></div>
            <div class="form-row">
                <div class="form-group"><label>时间限制(秒)</label><input type="number" id="q-tl" value="${q.time_limit}" min="0.1" step="0.1"></div>
                <div class="form-group"><label>内存限制(MB)</label><input type="number" id="q-ml" value="${q.memory_limit}" min="1"></div>
            </div>
            <div class="form-group"><label><input type="checkbox" id="q-vis" ${q.is_visible ? 'checked' : ''}> 可见</label></div>
            <div id="form-error" class="error" style="display:none;"></div>
            <button type="submit" class="btn-primary">保存修改</button>
        </form>

        <h3>测试用例管理</h3>
        <div id="testcase-list"></div>
        <h4>添加测试用例</h4>
        <form id="tc-form">
            <div class="form-group"><label>输入数据</label><textarea id="tc-input" rows="3" required></textarea></div>
            <div class="form-group"><label>期望输出</label><textarea id="tc-output" rows="3" required></textarea></div>
            <div class="form-group"><label>顺序</label><input type="number" id="tc-order" value="0" min="0"></div>
            <button type="submit" class="btn-secondary">添加测试用例</button>
        </form>
    </div>`;

    function renderTestCases(tcs) {
        let html = '<table class="data-table"><thead><tr><th>#</th><th>输入</th><th>期望输出</th><th>顺序</th><th>操作</th></tr></thead><tbody>';
        tcs.forEach(tc => {
            html += `<tr>
                <td>${tc.id}</td>
                <td><pre>${escapeHtml(tc.input_data.substring(0, 200))}${tc.input_data.length > 200 ? '...' : ''}</pre></td>
                <td><pre>${escapeHtml(tc.expected_output.substring(0, 200))}${tc.expected_output.length > 200 ? '...' : ''}</pre></td>
                <td>${tc.order_index}</td>
                <td><button class="btn-sm btn-danger delete-tc" data-id="${tc.id}">删除</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        $('#testcase-list').innerHTML = html;
        $$('.delete-tc').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('确定删除此测试用例？')) return;
                try {
                    await API.deleteTestCase(qid, btn.dataset.id);
                    const updated = await API.getTestCases(qid);
                    renderTestCases(updated);
                } catch(e) {
                    alert('删除失败: ' + e.message);
                }
            });
        });
    }
    renderTestCases(testCases);

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
            await API.updateQuestion(qid, data);
            App.navigate('#/admin');
        } catch(err) {
            errorEl.textContent = err.message;
            errorEl.style.display = '';
        }
    });

    $('#tc-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input_data = $('#tc-input').value.trim();
        const expected_output = $('#tc-output').value.trim();
        const order_index = parseInt($('#tc-order').value) || 0;
        if (!input_data || !expected_output) { alert('请填写输入和期望输出'); return; }
        try {
            await API.createTestCase(qid, { input_data, expected_output, order_index });
            const updated = await API.getTestCases(qid);
            renderTestCases(updated);
            $('#tc-input').value = '';
            $('#tc-output').value = '';
        } catch(err) {
            alert('添加失败: ' + err.message);
        }
    });
}

function renderNotFound(main) {
    main.innerHTML = `<div class="error-page"><h2>404</h2><p>页面未找到</p><a href="#/problems">返回首页</a></div>`;
}

function renderError(main, msg) {
    main.innerHTML = `<div class="error-page"><h2>500</h2><p>${escapeHtml(msg)}</p><a href="#/problems">返回首页</a></div>`;
}
