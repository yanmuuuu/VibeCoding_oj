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
            <div class="problem-layout" id="problem-layout">
                <div class="problem-left" id="problem-left">
                    <div class="problem-tabs" id="problem-tabs">
                        <button class="problem-tab active" data-tab="desc">题目描述</button>
                        <button class="problem-tab" data-tab="comments">讨论</button>
                    </div>
                    <div id="problem-desc-tab" class="problem-tab-content">
                    <div class="section">
                        <h3>题目描述</h3>
                        <div>${escapeHtml(p.description).replace(/\\n/g, '<br>')}</div>
                    </div>
                    ${p.input_format ? `<div class="section"><h3>输入格式</h3><div>${escapeHtml(p.input_format)}</div></div>` : ''}
                    ${p.output_format ? `<div class="section"><h3>输出格式</h3><div>${escapeHtml(p.output_format)}</div></div>` : ''}
                    <div class="section">
                        <h3>样例</h3>
                        ${p.sample_input ? `<div><strong>输入:</strong><pre class="sample-pre">${escapeHtml(p.sample_input)}</pre></div>` : ''}
                        ${p.sample_output ? `<div><strong>输出:</strong><pre class="sample-pre">${escapeHtml(p.sample_output)}</pre></div>` : ''}
                    </div>
                    <div class="section">
                        <span class="limit-badge">${p.time_limit}s</span>
                        <span class="limit-badge">${p.memory_limit}MB</span>
                    </div>
                    </div>
                    <div id="problem-comments-tab" class="problem-tab-content" data-comments-tab style="display:none;"></div>
                </div>
                <div class="layout-resizer" id="layout-resizer" title="拖动调节左右宽度"></div>
                <div class="problem-right" id="problem-right">
                    <div class="editor-wrapper">
                        <div class="editor-toolbar">
                            <h3>代码编辑器 (C++)</h3>
                            <select id="editor-theme" class="editor-theme-select" title="编辑器主题">
                                <option value="ace/theme/chrome">浅色 Chrome</option>
                                <option value="ace/theme/tomorrow">浅色 Tomorrow</option>
                                <option value="ace/theme/monokai">深色 Monokai</option>
                                <option value="ace/theme/one_dark">深色 One Dark</option>
                            </select>
                        </div>
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

    var commentsTabInited = false;
    $('#problem-tabs').addEventListener('click', function(e) {
        if (!e.target.classList.contains('problem-tab')) return;
        var tab = e.target.dataset.tab;
        $('#problem-tabs').querySelectorAll('.problem-tab').forEach(function(t) { t.classList.toggle('active', t === e.target); });
        $('#problem-desc-tab').style.display = tab === 'desc' ? '' : 'none';
        $('#problem-comments-tab').style.display = tab === 'comments' ? '' : 'none';
        if (tab === 'comments' && !commentsTabInited) {
            commentsTabInited = true;
            initProblemCommentsTab(document.getElementById('problem-comments-tab'), parseInt(id, 10));
        }
        if (tab === 'comments') {
            setTimeout(function() { if (window._aceEditor) window._aceEditor.resize(); }, 50);
        }
    });

    const layout = $('#problem-layout');
    const leftPanel = $('#problem-left');
    const rightPanel = $('#problem-right');
    const resizer = $('#layout-resizer');
    let splitRatio = parseFloat(localStorage.getItem('miooj_split_ratio'));
    if (isNaN(splitRatio)) splitRatio = 0.5;

    function applySplit(ratio) {
        splitRatio = Math.max(0.28, Math.min(0.72, ratio));
        leftPanel.style.flex = '0 0 ' + (splitRatio * 100) + '%';
        rightPanel.style.flex = '1 1 auto';
        localStorage.setItem('miooj_split_ratio', splitRatio);
    }
    applySplit(splitRatio);

    let dragging = false;
    resizer.addEventListener('mousedown', function(e) {
        dragging = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        const rect = layout.getBoundingClientRect();
        applySplit((e.clientX - rect.left) / rect.width);
    });
    document.addEventListener('mouseup', function() {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });

    const editor = ace.edit('code-editor');
    const themeKey = 'miooj_editor_theme';
    const savedTheme = localStorage.getItem(themeKey) || 'ace/theme/chrome';
    editor.setTheme(savedTheme);
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

    const themeSelect = $('#editor-theme');
    themeSelect.value = savedTheme;
    themeSelect.addEventListener('change', function() {
        editor.setTheme(themeSelect.value);
        localStorage.setItem(themeKey, themeSelect.value);
    });

    const storageKey = codeDraftStorageKey(id);
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
        if (!code) { showToast('请输入代码', 'warning'); return; }
        try {
            submitBtn.disabled = true;
            submitBtn.classList.add('btn-loading');
            submitBtn.textContent = '提交中...';
            localStorage.setItem(storageKey, code);
            const result = await API.submit(parseInt(id), code);
            showToast('提交成功，正在跳转结果页…', 'success', 1800);
            App.navigate('#/result/' + result.submission_id);
        } catch(e) {
            showToast('提交失败: ' + e.message, 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn-loading');
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
                        showToast('已加载通过代码', 'success');
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

    setTimeout(function() { editor.resize(); }, 100);
}
