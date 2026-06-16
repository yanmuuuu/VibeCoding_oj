async function renderProblemDetail(main) {
    await App.ensureAuth();
    const id = main.dataset.problemId;
    const p = await API.getProblem(id);
    const testCases = await API.getTestCases(id).catch(() => []);

    const testCasesHtml = testCases.length > 0 ? `
        <div class="test-cases-preview">
            <h4>测试样例</h4>
            ${testCases.map((tc, i) => `
                <div class="test-case-item">
                    <div><strong>样例 ${i+1}:</strong></div>
                    <div>输入: <pre>${escapeHtml(tc.input_data)}</pre></div>
                    <div>输出: <pre>${escapeHtml(tc.expected_output)}</pre></div>
                </div>
            `).join('')}
        </div>` : '';

    main.innerHTML = `
        <div class="problem-detail">
            <div class="problem-header">
                <a href="#/problems" class="back-link">← 返回题目列表</a>
                <h2>${escapeHtml(p.title)}</h2>
                <div></div>
            </div>
            <div class="problem-layout">
                <div class="problem-left">
                    <div class="section">
                        <h3>题目描述</h3>
                        <div>${escapeHtml(p.description).replace(/\\n/g, '<br>')}</div>
                    </div>
                    ${p.input_format ? `<div class="section"><h3>输入格式</h3><div>${escapeHtml(p.input_format)}</div></div>` : ''}
                    ${p.output_format ? `<div class="section"><h3>输出格式</h3><div>${escapeHtml(p.output_format)}</div></div>` : ''}
                    <div class="section">
                        <h3>样例</h3>
                        ${p.sample_input ? `<div><strong>输入:</strong><pre>${escapeHtml(p.sample_input)}</pre></div>` : ''}
                        ${p.sample_output ? `<div><strong>输出:</strong><pre>${escapeHtml(p.sample_output)}</pre></div>` : ''}
                    </div>
                    <div class="section">
                        <span class="limit-badge">${p.time_limit}s</span>
                        <span class="limit-badge">${p.memory_limit}MB</span>
                    </div>
                </div>
                <div class="problem-right">
                    <div class="editor-wrapper">
                        <h3>代码编辑器 (C++)</h3>
                        <textarea id="code-editor" placeholder="#include &lt;iostream&gt;
using namespace std;
int main() {
    // 在这里编写你的代码
    return 0;
}"></textarea>
                        <div class="editor-actions">
                            <button id="submit-btn" class="btn-primary">提交代码</button>
                            <span style="font-size:0.82em;color:#8c8c8c;">Ctrl+Enter 提交</span>
                        </div>
                    </div>
                    ${testCasesHtml}
                </div>
            </div>
        </div>`;

    const submitBtn = $('#submit-btn');
    const codeEditor = $('#code-editor');

    async function handleSubmit() {
        const code = codeEditor.value.trim();
        if (!code) { alert('请输入代码'); return; }
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';
            const result = await API.submit(parseInt(id), code);
            App.navigate('#/result/' + result.submission_id);
        } catch(e) {
            alert('提交失败: ' + e.message);
            submitBtn.disabled = false;
            submitBtn.textContent = '提交代码';
        }
    }

    submitBtn.addEventListener('click', handleSubmit);

    codeEditor.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') handleSubmit();
    });
}
