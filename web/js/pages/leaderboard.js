async function renderLeaderboard(main) {
    await App.ensureAuth();

    main.innerHTML = `
    <div class="page-header">
        <a href="#/problems" class="back-link">&larr; 返回题目列表</a>
        <h2>排行榜</h2>
        <p class="page-subtitle">积分规则：简单题1分 / 中等题2分 / 困难题3分，每道AC只计一次</p>
    </div>
    <div id="leaderboard-loading" class="loading">加载中...</div>
    <div id="leaderboard-content" style="display:none;">
        <div id="my-rank-card" class="my-rank-card"></div>
        <div class="table-wrap" id="leaderboard-table-wrap"></div>
    </div>`;

    try {
        const [lb, myRank] = await Promise.all([
            API.getLeaderboard(),
            API.getMyRank()
        ]);

        document.getElementById('leaderboard-loading').style.display = 'none';
        const content = document.getElementById('leaderboard-content');
        content.style.display = '';

        const rankLabel = myRank.rank != null ? ('第 ' + myRank.rank + ' 名') : '未上榜';
        const myCard = document.getElementById('my-rank-card');
        const myUser = App.user;
        myCard.innerHTML = `
        <div class="my-rank-info">
            <img src="${escapeHtml(myUser.avatar_url || '')}" class="my-rank-avatar" onerror="this.style.display='none'">
            <span class="my-rank-name">${escapeHtml(myUser.username)}</span>
            <span class="my-rank-label">${rankLabel}</span>
            <span class="my-rank-stats">
                <span class="stat-item">${myRank.points || 0} 分</span>
                <span class="stat-item">${myRank.ac_count || 0} AC</span>
                <span class="stat-item">${myRank.total_subs || 0} 提交</span>
            </span>
        </div>`;

        let html = '<table class="data-table leaderboard-table"><thead><tr><th>#</th><th>用户</th><th>积分</th><th>AC题数</th><th>总提交</th></tr></thead><tbody>';
        if (lb.length === 0) {
            html += '<tr><td colspan="5" class="empty-hint">暂无排名数据（有 AC 记录的用户将出现在此）</td></tr>';
        } else {
            lb.forEach(function(item) {
                const isMe = item.user_id === (App.user ? App.user.id : -1);
                html += '<tr class="' + (isMe ? 'highlight-row' : '') + '">';
                html += '<td class="rank-col">' + item.rank + '</td>';
                html += '<td><div class="user-cell user-profile-link" data-user-id="' + item.user_id + '" style="cursor:pointer;">';
                html += '<img src="' + escapeHtml(item.avatar_url || '') + '" class="user-avatar-small" onerror="this.style.display=\'none\'">';
                html += '<span>' + escapeHtml(item.username) + '</span></div></td>';
                html += '<td>' + item.points + '</td>';
                html += '<td>' + item.ac_count + '</td>';
                html += '<td>' + item.total_subs + '</td>';
                html += '</tr>';
            });
        }
        html += '</tbody></table>';
        document.getElementById('leaderboard-table-wrap').innerHTML = html;

        document.querySelectorAll('.leaderboard-table .user-cell[data-user-id]').forEach(function(cell) {
            attachUserProfileNav(cell, parseInt(cell.dataset.userId, 10), false);
        });

    } catch(e) {
        document.getElementById('leaderboard-loading').textContent = '加载失败: ' + e.message;
    }
}
