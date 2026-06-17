async function loadAnnouncements(content) {
    const announcements = await API.getAdminAnnouncements();

    let rows = '';
    if (announcements && announcements.length > 0) {
        announcements.forEach(a => {
            const pinned = a.is_pinned ? '<span class="badge badge-gold">置顶</span>' : '';
            rows += `<tr>
                <td>${a.id} ${pinned}</td>
                <td>${escapeHtml(a.title)}</td>
                <td>${formatDate(a.created_at)}</td>
                <td>
                    <button class="btn-sm edit-announce" data-id="${a.id}" data-title="${escapeHtml(a.title)}" data-content="${escapeHtml(a.content)}" data-pinned="${a.is_pinned}">编辑</button>
                    <button class="btn-sm btn-danger delete-announce" data-id="${a.id}">删除</button>
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="4">暂无公告</td></tr>';
    }

    content.innerHTML = `<h3>发布公告</h3>
        <form id="announce-form">
            <div class="form-group"><label>标题</label><input type="text" id="a-title" required></div>
            <div class="form-group"><label>内容</label><textarea id="a-content" rows="4" required></textarea></div>
            <div class="form-group"><label><input type="checkbox" id="a-pinned"> 置顶</label></div>
            <button type="submit" class="btn-primary" style="width:auto;padding:8px 22px;">发布</button>
            <input type="hidden" id="a-edit-id" value="">
        </form>
        <h3>公告列表</h3>
        <table class="data-table">
            <thead><tr><th>#</th><th>标题</th><th>发布时间</th><th>操作</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

    // Create/Edit form
    $('#announce-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const editId = $('#a-edit-id').value;
        const data = {
            title: $('#a-title').value.trim(),
            content: $('#a-content').value.trim(),
            is_pinned: $('#a-pinned').checked
        };
        if (!data.title || !data.content) { await showAlert('标题和内容不能为空'); return; }
        try {
            if (editId) {
                await API.updateAnnouncement(editId, data);
            } else {
                await API.createAnnouncement(data);
            }
            $('#a-title').value = '';
            $('#a-content').value = '';
            $('#a-pinned').checked = false;
            $('#a-edit-id').value = '';
            this.querySelector('button[type="submit"]').textContent = '发布';
            loadAnnouncements(content);
        } catch(e) {
            await showAlert('操作失败: ' + e.message);
        }
    });

    // Edit announcement
    $$('.edit-announce').forEach(btn => {
        btn.addEventListener('click', function() {
            $('#a-edit-id').value = this.dataset.id;
            $('#a-title').value = this.dataset.title;
            $('#a-content').value = this.dataset.content;
            $('#a-pinned').checked = this.dataset.pinned === 'true';
            $$('#announce-form button[type="submit"]').forEach(b => b.textContent = '保存修改');
            $('#a-title').focus();
        });
    });

    // Delete announcement
    $$('.delete-announce').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (!(await showConfirm('确定删除此公告？', { danger: true }))) return;
            try {
                await API.deleteAnnouncement(this.dataset.id);
                loadAnnouncements(content);
            } catch(e) {
                await showAlert('删除失败: ' + e.message);
            }
        });
    });
}
