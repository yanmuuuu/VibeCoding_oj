async function renderUserProfile(main) {
    await App.ensureAuth();

    const uid = parseInt(main.dataset.userId, 10);
    if (!uid || isNaN(uid)) {
        renderNotFound(main);
        return;
    }

    if (App.user && App.user.id === uid) {
        App.navigate('#/user');
        return;
    }

    main.innerHTML = `
    <div class="page-header">
        <a href="javascript:history.back()" class="back-link">&larr; 返回</a>
        <h2>用户主页</h2>
    </div>
    <div id="user-profile-loading" class="loading">加载中...</div>
    <div id="user-profile-content" style="display:none;"></div>`;

    try {
        const profile = await API.getPublicUserProfile(uid);
        document.getElementById('user-profile-loading').style.display = 'none';
        const box = document.getElementById('user-profile-content');
        box.style.display = '';

        const rankText = profile.rank != null ? ('第 ' + profile.rank + ' 名') : '未上榜';
        box.innerHTML = `
        <div class="public-profile-card">
            <img class="public-profile-avatar" src="${escapeHtml(profile.avatar_url || '')}" alt="" onerror="this.style.display='none'">
            <h3 class="public-profile-name">${escapeHtml(profile.username)}</h3>
            <div class="public-profile-stats">
                <div class="public-stat"><span class="public-stat-num">${rankText}</span><span class="public-stat-label">排行榜</span></div>
                <div class="public-stat"><span class="public-stat-num">${profile.points || 0}</span><span class="public-stat-label">积分</span></div>
                <div class="public-stat"><span class="public-stat-num">${profile.ac_count || 0}</span><span class="public-stat-label">AC 题数</span></div>
                <div class="public-stat"><span class="public-stat-num">${profile.total_subs || 0}</span><span class="public-stat-label">总提交</span></div>
            </div>
            <p class="public-profile-hint">此处仅展示公开统计信息，不包含提交详情等隐私数据。</p>
            <button type="button" class="btn-primary public-profile-pm" id="profile-pm-btn" style="width:auto;padding:10px 28px;">发私信</button>
        </div>`;

        document.getElementById('profile-pm-btn').addEventListener('click', function() {
            startPrivateMessage(profile.id);
        });
    } catch(e) {
        document.getElementById('user-profile-loading').textContent = '加载失败: ' + e.message;
    }
}

function startPrivateMessage(userId) {
    if (!userId || (App.user && App.user.id === userId)) return;
    App.navigate('#/messages?user=' + userId);
}

window.startPrivateMessage = startPrivateMessage;
