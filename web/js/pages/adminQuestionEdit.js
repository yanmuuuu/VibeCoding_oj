async function renderAdminQuestionEdit(main) {
    await App.ensureAuth();
    if (!App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>403</h2><p>无权限访问</p></div>';
        return;
    }
    const qid = main.dataset.questionId;
    const q = await API.getAdminQuestion(qid);
    const testCases = await API.getTestCases(qid);
    let currentTestCases = testCases;
    let savedReferenceCode = q.reference_code || '';
    let outputsVerified = true;

    main.innerHTML = `<div class="page-container admin-edit-page" style="max-width:1100px;">
        <a href="#/admin/questions" class="back-link">← 返回题目管理</a>
        <div class="admin-edit-header">
            <h2>编辑题目 #${q.display_index != null ? q.display_index : qid}: ${escapeHtml(q.title)}</h2>
            <button type="button" class="btn-secondary" id="preview-problem-btn" style="width:auto;padding:8px 18px;">预览做题页</button>
        </div>

        <section class="admin-section">
            <h3>基本信息</h3>
            <form id="question-form">
                <div class="form-group"><label>标题</label><input type="text" id="q-title" value="${escapeHtml(q.title)}" required></div>
                <div class="form-row">
                    <div class="form-group"><label>难度</label>
                        <select id="q-diff" required>
                            <option value="简单">简单</option>
                            <option value="中等">中等</option>
                            <option value="困难">困难</option>
                        </select>
                    </div>
                    <div class="form-group"><label>时间限制(秒)</label><input type="number" id="q-tl" value="${q.time_limit}" min="0.1" step="0.1"></div>
                    <div class="form-group"><label>内存限制(MB)</label><input type="number" id="q-ml" value="${q.memory_limit}" min="1"></div>
                </div>
                <div class="form-group"><label>描述（Markdown）</label>
                    <div class="md-edit-row">
                        <textarea id="q-desc" rows="8" required>${escapeHtml(q.description)}</textarea>
                        <div id="q-desc-preview" class="md-preview-panel"></div>
                    </div>
                </div>
                <div class="form-group"><label>输入格式</label><textarea id="q-ifmt" rows="2">${escapeHtml(q.input_format || '')}</textarea></div>
                <div class="form-group"><label>输出格式</label><textarea id="q-ofmt" rows="2">${escapeHtml(q.output_format || '')}</textarea></div>
                <div class="form-group"><label>样例输入</label><textarea id="q-sin" rows="3">${escapeHtml(q.sample_input || '')}</textarea></div>
                <div class="form-group"><label>样例输出</label><textarea id="q-sout" rows="3">${escapeHtml(q.sample_output || '')}</textarea></div>
                <div class="form-group"><label><input type="checkbox" id="q-vis" ${q.is_visible ? 'checked' : ''}> 可见（发布）</label></div>
                <div id="form-error" class="error" style="display:none;"></div>
                <button type="submit" class="btn-primary" style="width:auto;padding:8px 24px;">保存题目信息</button>
            </form>
        </section>

        <section class="admin-section">
            <h3>标程代码</h3>
            <div id="ref-stale-warning" class="admin-warning" style="display:none;">标程已修改，期望输出可能过期，请重新「编译运行并校验」。</div>
            <div id="ref-code-editor" style="height:280px;border-radius:8px;overflow:hidden;"></div>
            <button id="gen-outputs-btn" class="btn-secondary" style="margin-top:12px;">编译运行，生成期望输出并校验</button>
            <div id="gen-result" style="margin-top:10px;display:none;"></div>
        </section>

        <section class="admin-section">
            <h3>测试用例管理</h3>
            <div id="testcase-list"></div>
            <h4>添加测试用例</h4>
            <p class="admin-hint">可连续添加多条；序号从 0 开始自动递增。</p>
            <form id="tc-form">
                <div class="form-group"><label>输入数据</label><textarea id="tc-input" rows="3" required></textarea></div>
                <div class="form-group"><label>期望输出</label><textarea id="tc-output" rows="3" required></textarea></div>
                <button type="submit" class="btn-secondary">添加测试用例</button>
            </form>
        </section>
    </div>`;

    $('#q-diff').value = q.difficulty || '简单';
    bindMarkdownPreview('q-desc', 'q-desc-preview');
    const refEditor = initAdminAce('ref-code-editor', savedReferenceCode);

    function collectQuestionData() {
        return {
            title: $('#q-title').value.trim(),
            description: $('#q-desc').value.trim(),
            difficulty: $('#q-diff').value,
            input_format: $('#q-ifmt').value.trim(),
            output_format: $('#q-ofmt').value.trim(),
            sample_input: $('#q-sin').value.trim(),
            sample_output: $('#q-sout').value.trim(),
            time_limit: parseFloat($('#q-tl').value) || 1,
            memory_limit: parseInt($('#q-ml').value) || 256,
            is_visible: $('#q-vis').checked,
            reference_code: refEditor.getValue()
        };
    }

    function updateStaleWarning() {
        const stale = refEditor.getValue() !== savedReferenceCode;
        $('#ref-stale-warning').style.display = stale ? 'block' : 'none';
        if (stale) outputsVerified = false;
    }
    refEditor.session.on('change', updateStaleWarning);

    function renderTestCases(tcs) {
        currentTestCases = tcs;
        let html = '<table class="data-table"><thead><tr><th>#</th><th>输入</th><th>期望输出</th><th>顺序</th><th>操作</th></tr></thead><tbody>';
        if (tcs.length === 0) {
            html += '<tr><td colspan="5">暂无测试用例</td></tr>';
        } else {
            tcs.forEach((tc, idx) => {
                html += `<tr id="tc-row-${tc.id}">
                    <td>${tc.order_index != null ? tc.order_index : idx}</td>
                    <td class="tc-cell"><pre class="tc-preview" id="tc-input-preview-${tc.id}">${escapeHtml(tc.input_data.substring(0, 100))}${tc.input_data.length > 100 ? '...' : ''}</pre>
                        <button type="button" class="btn-sm tc-expand-btn" data-title="输入 #${tc.order_index != null ? tc.order_index : idx}" data-content-id="tc-input-full-${tc.id}">展开</button>
                        <textarea id="tc-input-full-${tc.id}" style="display:none;">${escapeHtml(tc.input_data)}</textarea>
                        <textarea id="tc-input-edit-${tc.id}" class="tc-edit-input" style="display:none;width:100%;min-height:60px;font-family:monospace;font-size:0.82em;">${escapeHtml(tc.input_data)}</textarea></td>
                    <td class="tc-cell"><pre class="tc-preview" id="tc-output-preview-${tc.id}">${escapeHtml(tc.expected_output.substring(0, 100))}${tc.expected_output.length > 100 ? '...' : ''}</pre>
                        <button type="button" class="btn-sm tc-expand-btn" data-title="期望输出 #${tc.order_index != null ? tc.order_index : idx}" data-content-id="tc-output-full-${tc.id}">展开</button>
                        <textarea id="tc-output-full-${tc.id}" style="display:none;">${escapeHtml(tc.expected_output)}</textarea>
                        <textarea id="tc-output-edit-${tc.id}" class="tc-edit-input" style="display:none;width:100%;min-height:60px;font-family:monospace;font-size:0.82em;">${escapeHtml(tc.expected_output)}</textarea></td>
                    <td><span id="tc-order-view-${tc.id}">${tc.order_index}</span>
                        <input type="number" id="tc-order-edit-${tc.id}" value="${tc.order_index}" min="0" style="display:none;width:60px;"></td>
                    <td>
                        <button class="btn-sm edit-tc-btn" data-id="${tc.id}">编辑</button>
                        <button class="btn-sm save-tc-btn" data-id="${tc.id}" style="display:none;">保存</button>
                        <button class="btn-sm cancel-tc-btn" data-id="${tc.id}" style="display:none;">取消</button>
                        <button class="btn-sm btn-danger delete-tc-btn" data-id="${tc.id}">删除</button>
                    </td>
                </tr>`;
            });
        }
        html += '</tbody></table>';
        $('#testcase-list').innerHTML = html;

        $$('.tc-expand-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const hidden = document.getElementById(this.dataset.contentId);
                showTcExpandModal(this.dataset.title, hidden ? hidden.value : '');
            });
        });
        $$('.edit-tc-btn').forEach(btn => btn.addEventListener('click', function() { toggleEditMode(this.dataset.id, true); }));
        $$('.cancel-tc-btn').forEach(btn => btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const tc = currentTestCases.find(t => t.id == id);
            if (tc) {
                $(`#tc-input-edit-${id}`).value = tc.input_data;
                $(`#tc-output-edit-${id}`).value = tc.expected_output;
                $(`#tc-order-edit-${id}`).value = tc.order_index;
            }
            toggleEditMode(id, false);
        }));
        $$('.save-tc-btn').forEach(btn => btn.addEventListener('click', async function() {
            const id = this.dataset.id;
            try {
                await API.updateTestCase(qid, id, {
                    input_data: $(`#tc-input-edit-${id}`).value,
                    expected_output: $(`#tc-output-edit-${id}`).value,
                    order_index: parseInt($(`#tc-order-edit-${id}`).value) || 0
                });
                renderTestCases(await API.getTestCases(qid));
            } catch (e) { showToast('保存失败: ' + e.message, 'error'); }
        }));
        $$('.delete-tc-btn').forEach(btn => btn.addEventListener('click', async function() {
            if (!(await showConfirm('确定删除此测试用例？', { danger: true }))) return;
            try {
                await API.deleteTestCase(qid, this.dataset.id);
                renderTestCases(await API.getTestCases(qid));
            } catch (e) { showToast('删除失败: ' + e.message, 'error'); }
        }));
    }

    function toggleEditMode(id, editing) {
        $(`#tc-input-preview-${id}`).style.display = editing ? 'none' : '';
        $(`#tc-input-edit-${id}`).style.display = editing ? '' : 'none';
        $(`#tc-output-preview-${id}`).style.display = editing ? 'none' : '';
        $(`#tc-output-edit-${id}`).style.display = editing ? '' : 'none';
        $(`#tc-order-view-${id}`).style.display = editing ? 'none' : '';
        $(`#tc-order-edit-${id}`).style.display = editing ? '' : 'none';
        const row = $(`#tc-row-${id}`);
        if (row) row.querySelectorAll('.tc-expand-btn').forEach(b => b.style.display = editing ? 'none' : '');
        $(`.edit-tc-btn[data-id="${id}"]`).style.display = editing ? 'none' : '';
        $(`.save-tc-btn[data-id="${id}"]`).style.display = editing ? '' : 'none';
        $(`.cancel-tc-btn[data-id="${id}"]`).style.display = editing ? '' : 'none';
    }

    renderTestCases(testCases);

    $('#preview-problem-btn').addEventListener('click', () => window.open('#/problems/' + qid, '_blank'));

    $('#gen-outputs-btn').addEventListener('click', async function() {
        const code = refEditor.getValue().trim();
        if (!code) { showToast('请先填写标程代码', 'error'); return; }
        if (!currentTestCases.length) { showToast('请先添加测试用例', 'error'); return; }

        let allInputs = currentTestCases.map(tc => tc.input_data).join('|||');
        const genResult = $('#gen-result');
        genResult.style.display = '';
        genResult.textContent = '编译运行中...';
        genResult.style.color = '#d4af37';
        this.disabled = true;

        try {
            const saveData = collectQuestionData();
            if (saveData.is_visible && !currentTestCases.length) saveData.is_visible = false;
            await API.updateQuestion(qid, saveData);
            savedReferenceCode = code;
            updateStaleWarning();

            const result = await API.generateOutputs(code, allInputs);
            this.disabled = false;

            if (result.compile_error) {
                genResult.textContent = '编译错误: ' + result.compile_error;
                genResult.style.color = '#ff6b6d';
                return;
            }

            if (!result.outputs || result.outputs.length !== currentTestCases.length) {
                genResult.textContent = '输出数量与测试用例不匹配';
                genResult.style.color = '#ff6b6d';
                return;
            }

            let allAc = true;
            for (let i = 0; i < currentTestCases.length; i++) {
                const tc = currentTestCases[i];
                const status = (result.statuses && result.statuses[i]) || 'AC';
                if (status !== 'AC') allAc = false;
                await API.updateTestCase(qid, tc.id, {
                    input_data: tc.input_data,
                    expected_output: result.outputs[i],
                    order_index: tc.order_index
                });
            }

            outputsVerified = allAc;
            renderTestCases(await API.getTestCases(qid));
            genResult.textContent = allAc
                ? '已生成 ' + result.outputs.length + ' 组期望输出，校验全部 AC。'
                : '已生成输出，但部分用例校验未通过，请检查标程。';
            genResult.style.color = allAc ? '#52c41a' : '#ff6b6d';
        } catch (e) {
            this.disabled = false;
            genResult.textContent = '生成失败: ' + e.message;
            genResult.style.color = '#ff6b6d';
        }
    });

    $('#question-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = $('#form-error');
        errorEl.style.display = 'none';
        const data = collectQuestionData();
        if (!data.title || !data.description || !data.difficulty) {
            errorEl.textContent = '标题、描述、难度为必填';
            errorEl.style.display = '';
            return;
        }
        if (data.is_visible && (currentTestCases.length === 0 || !data.reference_code.trim())) {
            errorEl.textContent = '发布需要至少一个测试用例和已保存的标程代码';
            errorEl.style.display = '';
            return;
        }
        try {
            await API.updateQuestion(qid, data);
            savedReferenceCode = data.reference_code;
            updateStaleWarning();
            showToast('题目信息已保存', 'success');
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = '';
        }
    });

    $('#tc-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input_data = $('#tc-input').value.trim();
        const expected_output = $('#tc-output').value.trim();
        if (!input_data || !expected_output) { showToast('请填写输入和期望输出', 'error'); return; }
        try {
            await API.createTestCase(qid, { input_data, expected_output });
            renderTestCases(await API.getTestCases(qid));
            $('#tc-input').value = '';
            $('#tc-output').value = '';
            $('#tc-input').focus();
            showToast('测试用例已添加，可继续添加下一条', 'success');
        } catch (err) {
            showToast('添加失败: ' + err.message, 'error');
        }
    });
}
