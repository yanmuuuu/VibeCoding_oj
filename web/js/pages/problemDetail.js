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
                <h2>${escapeHtml(p.title)} ${difficultyBadge(p.difficulty)}</h2>
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
                        <div id="code-editor">#include &lt;iostream&gt;
using namespace std;
int main() {
    
    return 0;
}</div>
                        <div class="editor-actions">
                            <button id="submit-btn" class="btn-primary">提交代码</button>
                            <button id="load-ac-btn" class="btn-ac-load">加载已通过代码</button>
                            <button id="undo-ac-btn" class="btn-undo" style="display:none;" title="撤销到加载前的代码">↩ 撤销</button>
                            <label class="autocomplete-toggle" title="切换代码自动补全">
                                <input type="checkbox" id="autocomplete-check" checked>
                                <span>自动补全</span>
                            </label>
                            <span class="shortcut-hint">Ctrl+Enter 提交</span>
                        </div>
                    </div>
                    <div id="ac-codes-modal" class="ac-codes-modal" style="display:none;">
                        <div class="ac-codes-backdrop"></div>
                        <div class="ac-codes-dropdown">
                            <div class="ac-codes-header">
                                <span>已通过的提交记录</span>
                                <button class="ac-codes-close">&times;</button>
                            </div>
                            <div class="ac-codes-list" id="ac-codes-list">
                                <div class="ac-codes-loading">加载中...</div>
                            </div>
                        </div>
                    </div>
                    ${testCasesHtml}
                </div>
            </div>
        </div>`;

    const editor = ace.edit('code-editor');
    editor.setTheme('ace/theme/chrome');
    editor.session.setMode('ace/mode/c_cpp');
    editor.setOptions({
        fontSize: '14px',
        tabSize: 4,
        useSoftTabs: true,
        showPrintMargin: false,
        highlightActiveLine: true,
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true
    });
    editor.renderer.setScrollMargin(8, 8, 0, 0);
    editor.session.setUseWrapMode(false);

    const storageKey = 'code_' + id;
    let saveTimeout = null;
    let preAcCode = null;

    const savedCode = localStorage.getItem(storageKey);
    if (savedCode) {
        editor.setValue(savedCode, -1);
    }

    editor.session.on('change', () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            localStorage.setItem(storageKey, editor.getValue());
        }, 500);
    });

    const autocompleteCheck = $('#autocomplete-check');
    const acPrefKey = 'autocomplete_enabled';
    const savedAcPref = localStorage.getItem(acPrefKey);
    if (savedAcPref !== null) {
        const enabled = savedAcPref === 'true';
        autocompleteCheck.checked = enabled;
        editor.setOptions({
            enableBasicAutocompletion: enabled,
            enableLiveAutocompletion: enabled
        });
    }

    function syncAcToggleUI(enabled) {
        autocompleteCheck.checked = enabled;
        var toggle = document.getElementById('toggle-autocomplete');
        if (toggle) {
            if (enabled) toggle.classList.add('on');
            else toggle.classList.remove('on');
        }
    }

    autocompleteCheck.addEventListener('change', () => {
        const enabled = autocompleteCheck.checked;
        localStorage.setItem(acPrefKey, enabled);
        editor.setOptions({
            enableBasicAutocompletion: enabled,
            enableLiveAutocompletion: enabled
        });
        syncAcToggleUI(enabled);
    });

    window.setAutocompleteEnabled = function(enabled) {
        editor.setOptions({
            enableBasicAutocompletion: enabled,
            enableLiveAutocompletion: enabled
        });
        syncAcToggleUI(enabled);
    };
    window._aceEditor = editor;

    const submitBtn = $('#submit-btn');

    async function handleSubmit() {
        const code = editor.getValue().trim();
        if (!code) { alert('请输入代码'); return; }
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';
            localStorage.setItem(storageKey, code);
            const result = await API.submit(parseInt(id), code);
            App.navigate('#/result/' + result.submission_id);
        } catch(e) {
            alert('提交失败: ' + e.message);
            submitBtn.disabled = false;
            submitBtn.textContent = '提交代码';
        }
    }

    submitBtn.addEventListener('click', handleSubmit);

    const loadAcBtn = $('#load-ac-btn');
    const undoAcBtn = $('#undo-ac-btn');
    const acModal = $('#ac-codes-modal');
    const acBackdrop = acModal.querySelector('.ac-codes-backdrop');
    const acClose = acModal.querySelector('.ac-codes-close');
    const acList = $('#ac-codes-list');

    function closeModal() {
        acModal.style.display = 'none';
    }

    acBackdrop.addEventListener('click', closeModal);
    acClose.addEventListener('click', closeModal);

    loadAcBtn.addEventListener('click', async () => {
        loadAcBtn.disabled = true;
        loadAcBtn.textContent = '加载中...';
        acList.innerHTML = '<div class="ac-codes-loading">加载中...</div>';
        acModal.style.display = 'block';
        try {
            const codes = await API.getAcceptedCodes(parseInt(id));
            if (codes.length === 0) {
                acList.innerHTML = '<div class="ac-codes-empty">该题目暂无已通过的提交</div>';
            } else {
                acList.innerHTML = codes.map((s, i) => `
                    <div class="ac-code-item" data-index="${i}">
                        <div class="ac-code-meta">
                            <span class="ac-code-id">#${s.id}</span>
                            <span class="ac-code-date">${formatDate(s.created_at)}</span>
                            <span class="ac-code-perf">${s.total_time}ms / ${s.total_memory}KB</span>
                        </div>
                        <span class="ac-code-arrow">→</span>
                    </div>
                `).join('');
                acList.querySelectorAll('.ac-code-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const idx = parseInt(item.dataset.index);
                        preAcCode = editor.getValue();
                        editor.setValue(codes[idx].code, -1);
                        editor.clearSelection();
                        undoAcBtn.style.display = 'inline-block';
                        closeModal();
                    });
                });
            }
        } catch(e) {
            acList.innerHTML = '<div class="ac-codes-empty">加载失败: ' + escapeHtml(e.message) + '</div>';
        }
        loadAcBtn.disabled = false;
        loadAcBtn.textContent = '加载已通过代码';
    });

    undoAcBtn.addEventListener('click', () => {
        if (preAcCode !== null) {
            editor.setValue(preAcCode, -1);
            editor.clearSelection();
            preAcCode = null;
            undoAcBtn.style.display = 'none';
        }
    });

    editor.commands.addCommand({
        name: 'submit',
        bindKey: {win: 'Ctrl-Enter', mac: 'Command-Enter'},
        exec: handleSubmit
    });
}
