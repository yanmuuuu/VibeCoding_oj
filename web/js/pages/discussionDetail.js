async function renderDiscussionDetail(main) {
    await App.ensureAuth();
    const did = parseInt(main.dataset.discussionId);
    if (!did) { renderNotFound(main); return; }

    main.innerHTML = `<div class="page-container">
        <a href="#/discussions" class="back-link">← 返回讨论列表</a>
        <div id="discussion-detail-content"><div class="empty-hint-block">加载中...</div></div>
    </div>`;

    const container = $('#discussion-detail-content');

    try {
        const d = await API.getDiscussion(did);
        buildDiscussionDetail(container, d);
    } catch(e) {
        container.innerHTML = '<div class="error">加载失败: ' + escapeHtml(e.message) + '</div>';
    }
}

function buildDiscussionDetail(container, d) {
    const canDelete = App.user && (App.user.id === d.user_id || App.user.is_admin);

    container.innerHTML = '';

    const postCard = el('div', {className: 'discussion-detail-post'},
        el('div', {className: 'discussion-detail-header'},
            el('img', {className: 'discussion-avatar', src: d.avatar_url || '', alt: ''}),
            el('div',
                el('span', {className: 'discussion-username', textContent: d.username}),
                el('span', {className: 'discussion-time', textContent: formatDate(d.created_at)})
            )
        ),
        el('div', {className: 'discussion-detail-body markdown-body', innerHTML: renderMarkdown(d.content)}),
        el('div', {className: 'discussion-detail-actions'},
            el('button', {className: 'btn-like' + (d.liked_by_me ? ' liked' : ''), innerHTML: '♥ ' + d.like_count,
                onclick: async function() {
                    try {
                        const r = d.liked_by_me ? await API.unlikeDiscussion(d.id) : await API.likeDiscussion(d.id);
                        d.liked_by_me = !d.liked_by_me;
                        d.like_count += d.liked_by_me ? 1 : -1;
                        container.querySelector('.btn-like').innerHTML = '♥ ' + d.like_count;
                        container.querySelector('.btn-like').classList.toggle('liked', d.liked_by_me);
                    } catch(e) { showToast('操作失败', 'error'); }
                }
            }),
            el('button', {className: 'btn-reply-to', textContent: '回复楼主',
                onclick: function() {
                    replaceReplyForm(postCard, d.id, null, d.username);
                }
            }),
            canDelete ? el('button', {className: 'btn-sm btn-delete-discussion', textContent: '删除',
                onclick: async function() {
                    if (!(await showConfirm('确定要删除这条帖子吗？', { danger: true }))) return;
                    try { await API.deleteDiscussion(d.id); App.navigate('#/discussions'); }
                    catch(e) { showToast('删除失败: ' + e.message, 'error'); }
                }
            }) : null
        )
    );
    container.appendChild(postCard);

    if (d.replies && d.replies.length > 0) {
        const repliesTitle = el('h4', {textContent: d.replies.length + ' 条回复', style: 'margin:18px 0 10px;color:#c4c8d4;'});
        container.appendChild(repliesTitle);
        const repliesContainer = el('div', {className: 'discussion-replies'});
        renderReplies(repliesContainer, d.replies, d.id);
        container.appendChild(repliesContainer);
    }
}

function renderReplies(container, replies, discussionId) {
    replies.forEach(r => {
        const canDeleteReply = App.user && (App.user.id === r.user_id || App.user.is_admin);
        const indent = r.parent_reply_id ? 1 : 0;

        const replyEl = el('div', {className: 'discussion-reply' + (indent ? ' reply-indent' : '')},
            el('div', {className: 'discussion-reply-header'},
                el('img', {className: 'discussion-avatar-small', src: r.avatar_url || '', alt: ''}),
                el('span', {className: 'discussion-username', textContent: r.username}),
                el('span', {className: 'discussion-time', textContent: formatDate(r.created_at)})
            ),
            el('div', {className: 'markdown-body', innerHTML: renderMarkdown(r.content)}),
            el('div', {className: 'discussion-reply-actions'},
                el('button', {className: 'btn-like-sm' + (r.liked_by_me ? ' liked' : ''), innerHTML: '♥ ' + r.like_count,
                    onclick: async function() {
                        try {
                            const res = r.liked_by_me ? await API.unlikeDiscussionReply(discussionId, r.id) : await API.likeDiscussionReply(discussionId, r.id);
                            r.liked_by_me = !r.liked_by_me;
                            r.like_count += r.liked_by_me ? 1 : -1;
                            this.innerHTML = '♥ ' + r.like_count;
                            this.classList.toggle('liked', r.liked_by_me);
                        } catch(e) { showToast('操作失败', 'error'); }
                    }
                }),
                el('button', {className: 'btn-reply-to', textContent: '回复',
                    onclick: function() {
                        replaceReplyForm(replyEl, discussionId, r.parent_reply_id || r.id, r.username);
                    }
                }),
                canDeleteReply ? el('button', {className: 'btn-sm', textContent: '删除',
                    onclick: async function() {
                        if (!(await showConfirm('确定要删除这条回复吗？', { danger: true }))) return;
                        try {
                            await API.deleteDiscussionReply(discussionId, r.id);
                            const updated = await API.getDiscussion(discussionId);
                            const parentContainer = container.parentElement;
                            if (parentContainer) {
                                const detailContainer = parentContainer.querySelector('#discussion-detail-content');
                                if (detailContainer) buildDiscussionDetail(detailContainer, updated);
                            }
                        } catch(e) { showToast('删除失败: ' + e.message, 'error'); }
                    }
                }) : null
            )
        );
        container.appendChild(replyEl);
    });
}

function replaceReplyForm(afterEl, discussionId, parentReplyId, replyToUser) {
    var existing = document.querySelector('.inline-reply-form');
    if (existing) existing.remove();

    var form = el('div', {className: 'inline-reply-form'},
        el('textarea', {placeholder: parentReplyId ? ('回复 @' + replyToUser + '...') : ('回复楼主 @' + replyToUser + '... 支持 Markdown'), rows: 3}),
        el('div', {style: 'margin-top:6px;'},
            el('button', {className: 'btn-primary', textContent: '提交', style: 'width:auto;padding:4px 16px;font-size:0.82em;',
                onclick: async function() {
                    var content = form.querySelector('textarea').value.trim();
                    if (!content) { showToast('内容不能为空', 'warning'); return; }
                    try {
                        await API.createDiscussionReply(discussionId, content, parentReplyId);
                        var updated = await API.getDiscussion(discussionId);
                        var dc = document.querySelector('#discussion-detail-content');
                        if (dc) buildDiscussionDetail(dc, updated);
                    } catch(e) { showToast('回复失败: ' + e.message, 'error'); }
                }
            }),
            el('button', {className: 'btn-secondary', textContent: '取消', style: 'padding:4px 12px;font-size:0.82em;',
                onclick: function() { form.remove(); }
            })
        )
    );
    afterEl.insertAdjacentElement('afterend', form);
}
