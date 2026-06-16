async function renderLogin(main) {
    main.innerHTML = `
        <div class="auth-container">
            <h1>VibeOJ</h1>
            <div class="auth-box">
                <div class="form-group">
                    <label>用户名</label>
                    <input type="text" id="login-username" placeholder="用户名（至少3个字符）" minlength="3">
                </div>
                <div class="form-group">
                    <label>密码</label>
                    <input type="password" id="login-password" placeholder="密码">
                </div>
                <div id="login-error" class="error" style="display:none;"></div>
                <button id="login-btn" class="btn-primary">登 录</button>
                <p class="auth-link">没有账号？<a href="#/register">去注册</a></p>
            </div>
        </div>`;

    $('#login-btn').addEventListener('click', async () => {
        const username = $('#login-username').value.trim();
        const password = $('#login-password').value;
        const errorEl = $('#login-error');
        if (!username || !password) {
            errorEl.textContent = '请输入用户名和密码';
            errorEl.style.display = '';
            return;
        }
        try {
            await API.login(username, password);
            await App.loadUser();
            App.navigate('#/problems');
        } catch(e) {
            errorEl.textContent = e.message;
            errorEl.style.display = '';
        }
    });

    $('#login-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('#login-btn').click();
    });
}
