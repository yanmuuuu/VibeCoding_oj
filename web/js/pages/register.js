async function renderRegister(main) {
    main.innerHTML = `
        <div class="auth-container">
            <h1>VibeOJ</h1>
            <div class="auth-box">
                <div class="form-group">
                    <label>用户名（至少3个字符）</label>
                    <input type="text" id="reg-username" placeholder="用户名" minlength="3" maxlength="64">
                </div>
                <div class="form-group">
                    <label>密码（至少8位，含至少两种字符类型）</label>
                    <input type="password" id="reg-password" placeholder="密码" minlength="8">
                </div>
                <div id="reg-hint" style="font-size:0.78em;color:#8c8c8c;margin-bottom:12px;line-height:1.6;">
                    密码要求：≥8位，至少包含以下两种类型：<br>
                    数字 0-9 · 小写字母 a-z · 大写字母 A-Z · 特殊符号 _- .@!#$%^&*+=~
                </div>
                <div id="reg-error" class="error" style="display:none;"></div>
                <button id="reg-btn" class="btn-primary">注 册</button>
                <p class="auth-link">已有账号？<a href="#/login">去登录</a></p>
            </div>
        </div>`;

    $('#reg-btn').addEventListener('click', async () => {
        const username = $('#reg-username').value.trim();
        const password = $('#reg-password').value;
        const errorEl = $('#reg-error');
        errorEl.style.display = 'none';

        if (username.length < 3) {
            errorEl.textContent = '用户名至少3个字符';
            errorEl.style.display = '';
            return;
        }
        if (username.length > 64) {
            errorEl.textContent = '用户名过长（最多64个字符）';
            errorEl.style.display = '';
            return;
        }
        if (password.length < 8) {
            errorEl.textContent = '密码至少8位';
            errorEl.style.display = '';
            return;
        }
        try {
            await API.register(username, password);
            await API.login(username, password);
            await App.loadUser();
            App.navigate('#/problems');
        } catch(e) {
            errorEl.textContent = e.message;
            errorEl.style.display = '';
        }
    });

    $('#reg-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('#reg-btn').click();
    });
}
