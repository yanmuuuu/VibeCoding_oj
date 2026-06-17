async function renderAdminQuestionEdit(main) {
    await App.ensureAuth();
    if (!App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>403</h2><p>无权限访问</p></div>';
        return;
    }
    const qid = main.dataset.questionId;
    const q = await API.getAdminQuestion(qid);
    const testCases = await API.getTestCases(qid);

    main.innerHTML = `<div class="page-container" style="max-width:1000px;">
        <a href="#/admin/questions" class="back-link">← 返回题目管理</a>
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

        <h3>参考标程（自动生成期望输出）</h3>
        <div class="form-group">
            <label>标程 C++ 代码</label>
            <textarea id="ref-code" rows="6" style="font-family:monospace;font-size:0.85em;" placeholder="粘贴 C++ 标程代码，点击下方按钮自动编译运行生成每组输入的期望输出..."></textarea>
        </div>
        <button id="gen-outputs-btn" class="btn-secondary" style="margin-bottom:16px;">编译运行，生成期望输出</button>
        <div id="gen-result" style="margin-bottom:12px;display:none;"></div>

        <h3>测试用例管理</h3>
        <div id="testcase-list"></div>
        <h4>添加测试用例</h4>
        <form id="tc-form">
            <div class="form-group"><label>输入数据</label><textarea id="tc-input" rows="3" required></textarea></div>
            <div class="form-group"><label>期望输出</label><textarea id="tc-output" rows="3" required></textarea></div>
            <div class="form-group"><label>顺序</label><input type="number" id="tc-order" value="0" min="0"></div>
            <button type="submit" class="btn-secondary">添加</button>
        </form>
    </div>`;

    let currentTestCases = testCases;

    function renderTestCases(tcs) {
        currentTestCases = tcs;
        let html = '<table class="data-table"><thead><tr><th>#</th><th>输入</th><th>期望输出</th><th>顺序</th><th>操作</th></tr></thead><tbody>';
        if (tcs.length === 0) {
            html += '<tr><td colspan="5">暂无测试用例</td></tr>';
        } else {
            tcs.forEach(tc => {
                html += `<tr id="tc-row-${tc.id}">
                    <td>${tc.id}</td>
                    <td class="tc-cell"><pre class="tc-preview" id="tc-input-preview-${tc.id}">${escapeHtml(tc.input_data.substring(0, 100))}${tc.input_data.length > 100 ? '...' : ''}</pre>
                        <textarea id="tc-input-edit-${tc.id}" class="tc-edit-input" style="display:none;width:100%;min-height:60px;font-family:monospace;font-size:0.82em;">${escapeHtml(tc.input_data)}</textarea></td>
                    <td class="tc-cell"><pre class="tc-preview" id="tc-output-preview-${tc.id}">${escapeHtml(tc.expected_output.substring(0, 100))}${tc.expected_output.length > 100 ? '...' : ''}</pre>
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

        // Edit button
        $$('.edit-tc-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                toggleEditMode(id, true);
            });
        });

        // Cancel button
        $$('.cancel-tc-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const tc = currentTestCases.find(t => t.id == id);
                if (tc) {
                    $(`#tc-input-edit-${id}`).value = tc.input_data;
                    $(`#tc-output-edit-${id}`).value = tc.expected_output;
                    $(`#tc-order-edit-${id}`).value = tc.order_index;
                }
                toggleEditMode(id, false);
            });
        });

        // Save button
        $$('.save-tc-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.dataset.id;
                const data = {
                    input_data: $(`#tc-input-edit-${id}`).value,
                    expected_output: $(`#tc-output-edit-${id}`).value,
                    order_index: parseInt($(`#tc-order-edit-${id}`).value) || 0
                };
                try {
                    await API.updateTestCase(qid, id, data);
                    // Refresh
                    const updated = await API.getTestCases(qid);
                    renderTestCases(updated);
                } catch(e) {
                    alert('保存失败: ' + e.message);
                }
            });
        });

        // Delete button
        $$('.delete-tc-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                if (!confirm('确定删除此测试用例？')) return;
                try {
                    await API.deleteTestCase(qid, this.dataset.id);
                    const updated = await API.getTestCases(qid);
                    renderTestCases(updated);
                } catch(e) {
                    alert('删除失败: ' + e.message);
                }
            });
        });
    }

    function toggleEditMode(id, editing) {
        $(`#tc-input-preview-${id}`).style.display = editing ? 'none' : '';
        $(`#tc-input-edit-${id}`).style.display = editing ? '' : 'none';
        $(`#tc-output-preview-${id}`).style.display = editing ? 'none' : '';
        $(`#tc-output-edit-${id}`).style.display = editing ? '' : 'none';
        $(`#tc-order-view-${id}`).style.display = editing ? 'none' : '';
        $(`#tc-order-edit-${id}`).style.display = editing ? '' : 'none';
        $(`.edit-tc-btn[data-id="${id}"]`).style.display = editing ? 'none' : '';
        $(`.save-tc-btn[data-id="${id}"]`).style.display = editing ? '' : 'none';
        $(`.cancel-tc-btn[data-id="${id}"]`).style.display = editing ? '' : 'none';
    }

    renderTestCases(testCases);

    // Reference code generation
    $('#gen-outputs-btn').addEventListener('click', async function() {
        const code = $('#ref-code').value.trim();
        if (!code) { alert('请先粘贴标程代码'); return; }

        // Collect all test case inputs
        let allInputs = '';
        currentTestCases.forEach(tc => {
            if (allInputs) allInputs += '|||';
            allInputs += tc.input_data;
        });
        if (!allInputs) { alert('请先添加测试用例的输入数据'); return; }

        const genResult = $('#gen-result');
        genResult.style.display = '';
        genResult.textContent = '编译运行中...';
        genResult.style.color = '#fdbb2d';
        $('#gen-outputs-btn').disabled = true;

        try {
            const result = await API.generateOutputs(code, allInputs);
            $('#gen-outputs-btn').disabled = false;

            if (result.compile_error) {
                genResult.textContent = '编译错误: ' + result.compile_error;
                genResult.style.color = '#ff6b6d';
                return;
            }

            if (result.outputs && result.outputs.length === currentTestCases.length) {
                // Auto-fill expected outputs
                for (let i = 0; i < currentTestCases.length; i++) {
                    const tc = currentTestCases[i];
                    const newOutput = result.outputs[i];
                    // Update via API
                    try {
                        await API.updateTestCase(qid, tc.id, {
                            input_data: tc.input_data,
                            expected_output: newOutput,
                            order_index: tc.order_index
                        });
                    } catch(e) {
                        console.error('Failed to update test case ' + tc.id, e);
                    }
                }
                genResult.textContent = '成功生成 ' + result.outputs.length + ' 组期望输出并已自动填充！';
                genResult.style.color = '#52c41a';
                // Refresh test cases
                const updated = await API.getTestCases(qid);
                renderTestCases(updated);
            } else {
                genResult.textContent = '生成完成，但输出数量 (' + (result.outputs ? result.outputs.length : 0) + ') 与测试用例数 (' + currentTestCases.length + ') 不匹配';
                genResult.style.color = '#ff6b6d';
            }
        } catch(e) {
            $('#gen-outputs-btn').disabled = false;
            genResult.textContent = '生成失败: ' + e.message;
            genResult.style.color = '#ff6b6d';
        }
    });

    // Save question form
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
            window.location.hash = '#/admin/questions';
        } catch(err) {
            errorEl.textContent = err.message;
            errorEl.style.display = '';
        }
    });

    // Add test case form
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
