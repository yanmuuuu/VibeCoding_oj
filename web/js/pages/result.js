async function renderResult(main) {
    await App.ensureAuth();
    const subId = main.dataset.submissionId;
    let polling = null;
    let questionId = null;

    function getStatusColor(status) {
        const colors = {
            'AC': '#4caf50', 'WA': '#f44336', 'TLE': '#ff9800',
            'MLE': '#ff5722', 'RE': '#9c27b0', 'CE': '#9e9e9e',
            'PENDING': '#607d8b', 'COMPILING': '#607d8b', 'RUNNING': '#607d8b', 'SE': '#795548'
        };
        return colors[status] || '#607d8b';
    }

    function render(data) {
        questionId = data.question_id;
        const status = data.status;
        const detail = data.detail_json ? (typeof data.detail_json === 'string' ? JSON.parse(data.detail_json) : data.detail_json) : [];

        let blocksHtml = '';
        if (detail.length > 0) {
            detail.forEach((tc, i) => {
                const color = getStatusColor(tc.status);
                const selected = i === 0 ? ' selected' : '';
                const arrow = i === 0 ? ' ▶' : '';
                blocksHtml += `<div class="test-block${selected}" style="background-color:${color}" data-idx="${i}">
                    <span class="block-status">${tc.status}${arrow}</span>
                    <span class="block-num">#${tc.index || (i+1)}</span>
                </div>`;
            });
        }

        main.innerHTML = `
            <div class="result-page">
                <div class="result-header">
                    <a href="#/problems/${data.question_id}" class="back-link">← 返回题目</a>
                    <span>提交 #${data.id}</span>
                    <span>${escapeHtml(data.title)}</span>
                    <span>${formatDate(data.created_at)}</span>
                </div>
                <div class="result-summary">
                    <div>状态: <span style="color:${getStatusColor(status)};font-weight:bold;">${status}</span></div>
                    <div>通过: ${data.passed_count}/${data.total_count}</div>
                    <div>耗时: ${data.total_time}ms | 内存: ${data.total_memory}KB</div>
                </div>
                <div class="result-actions">
                    <a href="#/problems/${data.question_id}" class="btn-primary btn-retry">再试一次</a>
                </div>
                <div class="test-blocks" id="test-blocks">${blocksHtml}</div>
                <div class="test-detail" id="test-detail"></div>
                <div class="code-section">
                    <h4 class="code-toggle" id="code-toggle">▼ 提交代码</h4>
                    <pre id="code-content" style="display:none;">${escapeHtml(data.code)}</pre>
                </div>
            </div>`;

        $$('.test-block').forEach(block => {
            block.addEventListener('click', function() {
                const idx = parseInt(this.dataset.idx);
                $$('.test-block').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                showDetail(idx);
            });
        });

        $('#code-toggle').addEventListener('click', () => {
            const codeEl = $('#code-content');
            const toggle = $('#code-toggle');
            if (codeEl.style.display === 'none') {
                codeEl.style.display = '';
                toggle.textContent = '▲ 提交代码';
            } else {
                codeEl.style.display = 'none';
                toggle.textContent = '▼ 提交代码';
            }
        });

        function showDetail(idx) {
            if (idx < 0 || idx >= detail.length) return;
            const tc = detail[idx];
            const detailEl = $('#test-detail');

            const statusText = {
                'AC': '通过', 'WA': '答案错误', 'TLE': '超时', 'MLE': '内存超限',
                'RE': '运行错误', 'CE': '编译错误', 'SE': '系统错误',
                'PENDING': '等待中', 'COMPILING': '编译中', 'RUNNING': '运行中'
            };
            const statusDesc = statusText[tc.status] || tc.status;

            detailEl.innerHTML = `
                <div class="detail-box detail-box-animate">
                    <h4>测试点 #${tc.index || (idx+1)} (已选中)</h4>
                    <div>状态: <span style="color:${getStatusColor(tc.status)}">${tc.status} - ${statusDesc}</span> | 耗时: ${tc.time_ms}ms | 内存: ${tc.memory_kb}KB</div>
                </div>`;
        }

        if (detail.length > 0) showDetail(0);

        if (status !== 'PENDING' && status !== 'COMPILING' && status !== 'RUNNING') {
            if (polling) clearInterval(polling);
        }
    }

    try {
        const data = await API.getSubmission(subId);
        render(data);
        if (data.status === 'PENDING' || data.status === 'COMPILING' || data.status === 'RUNNING') {
            polling = setInterval(async () => {
                try {
                    const data = await API.getSubmission(subId);
                    render(data);
                } catch(e) {
                    if (polling) clearInterval(polling);
                }
            }, 2000);
        }
    } catch(e) {
        main.innerHTML = `<div class="error-page"><h2>错误</h2><p>${escapeHtml(e.message)}</p><a href="#/problems">返回题目列表</a></div>`;
    }
}
