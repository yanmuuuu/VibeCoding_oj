async function renderAdminQuestions(main) {
    await App.ensureAuth();
    if (!App.user.is_admin) {
        main.innerHTML = '<div class="error-page"><h2>403</h2><p>无权限访问</p></div>';
        return;
    }
    main.innerHTML = `<div class="page-container">
        <a href="#/admin" class="back-link">← 返回管理后台</a>
        <h2>新建题目</h2>
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
        </form>
    </div>`;

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
            App.navigate('#/admin');
        } catch(err) {
            errorEl.textContent = err.message;
            errorEl.style.display = '';
        }
    });
}
