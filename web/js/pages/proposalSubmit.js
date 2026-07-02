async function renderProposalSubmit(main) {
    await App.ensureAuth();
    if (App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>提示</h2><p>管理员请使用后台录题功能</p><a href="#/admin/questions">前往管理后台</a></div>';
        return;
    }

    const editId = main.dataset.proposalId;
    let existing = null;
    if (editId) {
        existing = await API.getUserProposal(editId);
        if (existing.status !== 'rejected') {
            main.innerHTML = '<div class="error-page"><h2>无法编辑</h2><p>仅未通过的录题可修改后重新提交</p><a href="#/proposals">返回我的录题</a></div>';
            return;
        }
    }

    main.innerHTML = `<div class="page-container" style="max-width:900px;">
        <a href="#/proposals" class="back-link">← 返回我的录题</a>
        <h2>${editId ? '修改并重新提交' : '提交录题'}</h2>
        <p class="admin-hint">填写题目基本信息，标程和测试用例由管理员审核时补充。最多同时有 3 条待审核。</p>
        <form id="proposal-form" class="admin-wizard-panel">
            <div class="form-group"><label>标题</label><input type="text" id="p-title" required></div>
            <div class="form-group"><label>难度</label>
                <select id="p-diff" required>
                    <option value="简单">简单</option>
                    <option value="中等">中等</option>
                    <option value="困难">困难</option>
                </select>
            </div>
            <div class="form-group"><label>描述（Markdown）</label>
                <div class="md-edit-row">
                    <textarea id="p-desc" rows="8" required></textarea>
                    <div id="p-desc-preview" class="md-preview-panel"></div>
                </div>
            </div>
            <div class="form-group"><label>输入格式</label><textarea id="p-ifmt" rows="2"></textarea></div>
            <div class="form-group"><label>输出格式</label><textarea id="p-ofmt" rows="2"></textarea></div>
            <div class="form-group"><label>样例输入</label><textarea id="p-sin" rows="3"></textarea></div>
            <div class="form-group"><label>样例输出</label><textarea id="p-sout" rows="3"></textarea></div>
            <div class="form-row">
                <div class="form-group"><label>时间限制(秒)</label><input type="number" id="p-tl" value="1" min="0.1" step="0.1"></div>
                <div class="form-group"><label>内存限制(MB)</label><input type="number" id="p-ml" value="256" min="1"></div>
            </div>
            <div id="proposal-error" class="error" style="display:none;"></div>
            <button type="submit" class="btn-primary" style="width:auto;padding:8px 22px;">${editId ? '重新提交审核' : '提交审核'}</button>
        </form>
    </div>`;

    if (existing) {
        $('#p-title').value = existing.title || '';
        $('#p-diff').value = existing.difficulty || '简单';
        $('#p-desc').value = existing.description || '';
        $('#p-ifmt').value = existing.input_format || '';
        $('#p-ofmt').value = existing.output_format || '';
        $('#p-sin').value = existing.sample_input || '';
        $('#p-sout').value = existing.sample_output || '';
        $('#p-tl').value = existing.time_limit || 1;
        $('#p-ml').value = existing.memory_limit || 256;
    }
    bindMarkdownPreview('p-desc', 'p-desc-preview');

    $('#proposal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#proposal-error');
        err.style.display = 'none';
        const data = {
            title: $('#p-title').value.trim(),
            description: $('#p-desc').value.trim(),
            difficulty: $('#p-diff').value,
            input_format: $('#p-ifmt').value.trim(),
            output_format: $('#p-ofmt').value.trim(),
            sample_input: $('#p-sin').value.trim(),
            sample_output: $('#p-sout').value.trim(),
            time_limit: parseFloat($('#p-tl').value) || 1,
            memory_limit: parseInt($('#p-ml').value) || 256
        };
        if (!data.title || !data.description) {
            err.textContent = '标题和描述为必填';
            err.style.display = '';
            return;
        }
        try {
            if (editId) await API.updateUserProposal(editId, data);
            else await API.createUserProposal(data);
            showToast(editId ? '已重新提交，等待审核' : '提交成功，等待审核', 'success');
            App.navigate('#/proposals');
        } catch (ex) {
            err.textContent = ex.message;
            err.style.display = '';
        }
    });
}
