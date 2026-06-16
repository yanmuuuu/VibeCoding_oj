async function renderRegister(main) {
    main.innerHTML = `
        <div class="auth-container">
            <h1>VibeOJ</h1>
            <div class="auth-box">
                <div class="form-group">
                    <label>用户名</label>
                    <input type="text" id="reg-username" placeholder="用户名">
                </div>
                <div class="form-group">
                    <label>密码</label>
                    <input type="password" id="reg-password" placeholder="密码">
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
        if (!username || !password) {
            errorEl.textContent = '请输入用户名和密码';
            errorEl.style.display = '';
            return;
        }
        if (username.length > 64) {
            errorEl.textContent = '用户名过长';
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
