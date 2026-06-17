async function loadUsers(content) {
    const page = parseInt(content.dataset.userPage || '1');
    const search = content.dataset.userSearch || '';

    const data = await API.getAdminUsers(page, search);

    let rows = '';
    if (data.users && data.users.length > 0) {
        data.users.forEach(u => {
            const adminBadge = u.is_admin ? '<span class="badge badge-gold">管理员</span>' : '<span class="badge">用户</span>';
            const banBadge = u.is_banned ? '<span class="badge badge-red">已封禁</span>' : '';
            const toggleText = u.is_admin ? '取消管理' : '设为管理';
            const banText = u.is_banned ? '解封' : '封禁';
            rows += `<tr>
                <td>${u.id}</td>
                <td>${escapeHtml(u.username)} ${banBadge}</td>
                <td>${adminBadge}</td>
                <td>${formatDate(u.created_at)}</td>
                <td class="user-actions-cell">
                    <button class="btn-sm toggle-admin" data-id="${u.id}" data-admin="${u.is_admin}">${toggleText}</button>
                    <button class="btn-sm toggle-ban" data-id="${u.id}" data-banned="${u.is_banned}">${banText}</button>
                    <button class="btn-sm reset-pwd" data-id="${u.id}">重置密码</button>
                    <button class="btn-sm btn-danger delete-user" data-id="${u.id}">删除</button>
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="5">暂无用户</td></tr>';
    }

    content.innerHTML = `<div class="admin-search">
        <input type="text" id="user-search" placeholder="搜索用户名..." value="${escapeHtml(search)}" style="width:260px;padding:8px 12px;margin-bottom:14px;">
        <button class="btn-secondary" id="user-search-btn" style="margin-left:6px;">搜索</button>
    </div>
    <table class="data-table">
        <thead><tr><th>#</th><th>用户名</th><th>身份</th><th>注册时间</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="pagination" style="margin-top:14px;"></div>`;

    const totalPages = Math.ceil(data.total / 20);
    if (totalPages > 1) {
        let pagesHtml = '';
        for (let i = 1; i <= totalPages; i++) {
            const active = i === page ? ' class="page-active"' : '';
            pagesHtml += `<button class="btn-sm page-btn" data-page="${i}"${active}>${i}</button>`;
        }
        content.querySelector('.pagination').innerHTML = pagesHtml;
        content.querySelectorAll('.page-btn').forEach(b => {
            b.addEventListener('click', function() {
                content.dataset.userPage = this.dataset.page;
                loadUsers(content);
            });
        });
    }

    $('#user-search').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            content.dataset.userSearch = this.value.trim();
            content.dataset.userPage = '1';
            loadUsers(content);
        }
    });
    $('#user-search-btn').addEventListener('click', function() {
        content.dataset.userSearch = $('#user-search').value.trim();
        content.dataset.userPage = '1';
        loadUsers(content);
    });

    $$('.toggle-admin').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.dataset.id;
            const setAdmin = this.dataset.admin === 'true' ? false : true;
            const msg = setAdmin ? '确定要提升此用户为管理员吗？' : '确定要取消此用户的管理员权限吗？';
            if (!(await showConfirm(msg))) return;
            try {
                await API.toggleUserAdmin(id, setAdmin);
                loadUsers(content);
            } catch(e) {
                showToast('操作失败: ' + e.message, 'error');
            }
        });
    });

    $$('.toggle-ban').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.dataset.id;
            const banned = this.dataset.banned !== 'true';
            const msg = banned ? '确定封禁此用户？将立即踢下线且无法登录。' : '确定解封此用户？';
            if (!(await showConfirm(msg, { danger: banned }))) return;
            try {
                await API.banUser(id, banned);
                showToast(banned ? '用户已封禁' : '用户已解封', 'success');
                loadUsers(content);
            } catch(e) {
                showToast('操作失败: ' + e.message, 'error');
            }
        });
    });

    $$('.reset-pwd').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.dataset.id;
            const password = await showPrompt('请输入新密码（至少 8 位）：', {
                inputType: 'password',
                inputPlaceholder: '至少 8 位'
            });
            if (!password) return;
            if (password.length < 8) { showToast('密码至少 8 位', 'error'); return; }
            if (!(await showConfirm('确定重置该用户密码？将清除其所有登录会话。', { danger: true }))) return;
            try {
                await API.resetUserPassword(id, password);
                showToast('密码已重置', 'success');
            } catch(e) {
                showToast('重置失败: ' + e.message, 'error');
            }
        });
    });

    $$('.delete-user').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (!(await showConfirm('确定要删除此用户吗？此操作不可恢复！', { danger: true }))) return;
            try {
                await API.deleteUser(this.dataset.id);
                loadUsers(content);
            } catch(e) {
                showToast('删除失败: ' + e.message, 'error');
            }
        });
    });
}
