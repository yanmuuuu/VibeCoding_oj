function initProblemCommentsTab(container, qid) {
    if (container.dataset.initialized === '1') return;
    container.dataset.initialized = '1';
    renderProblemCommentListView(container, qid);
}

function renderProblemCommentListView(container, qid) {
    container.innerHTML =
        '<div class="problem-comments-panel">' +
            '<div class="discussions-header problem-comments-header">' +
                '<h3>题目讨论</h3>' +
                '<button type="button" class="btn-primary" id="new-problem-comment-btn" style="width:auto;padding:6px 18px;font-size:0.88em;">发帖</button>' +
            '</div>' +
            '<div id="new-problem-comment-form" style="display:none;">' +
                '<div class="comment-form">' +
                    '<textarea id="problem-comment-content" placeholder="支持 Markdown 语法..." rows="5"></textarea>' +
                    '<div class="discussion-form-actions">' +
                        '<button type="button" class="btn-primary" id="submit-problem-comment-btn" style="width:auto;padding:6px 18px;">提交</button>' +
                        '<button type="button" class="btn-secondary" id="cancel-problem-comment-btn">取消</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div id="problem-comments-list"></div>' +
            '<div id="problem-comments-loading" class="empty-hint-block">加载中...</div>' +
            '<div id="problem-comments-load-more" style="text-align:center;margin-top:12px;"></div>' +
        '</div>';

    var page = 1;

    async function loadPage() {
        var listEl = container.querySelector('#problem-comments-list');
        var loadingEl = container.querySelector('#problem-comments-loading');
        var moreEl = container.querySelector('#problem-comments-load-more');
        try {
            if (loadingEl) loadingEl.style.display = 'block';
            var comments = await API.getComments(qid, page);
            if (loadingEl) loadingEl.style.display = 'none';

            if (comments.length === 0 && page === 1) {
                listEl.innerHTML = '<div class="empty-hint-block">暂无讨论，快来发第一条帖子吧！</div>';
                if (moreEl) moreEl.innerHTML = '';
                return;
            }

            comments.forEach(function(c) {
                var preview = c.content.length > 100
                    ? c.content.slice(0, 100).replace(/\n/g, ' ') + '...'
                    : c.content.replace(/\n/g, ' ');
                var replyCount = (c.replies && c.replies.length) || 0;
                var avatar = el('img', {className: 'discussion-avatar', src: c.avatar_url || '', alt: ''});
                var username = el('span', {className: 'discussion-username', textContent: c.username});
                attachUserProfileNav(avatar, c.user_id, true);
                attachUserProfileNav(username, c.user_id, true);
                var card = el('div', {className: 'discussion-card'},
                    el('div', {className: 'discussion-card-header'},
                        avatar,
                        username,
                        el('span', {className: 'discussion-time', textContent: formatDate(c.created_at)})
                    ),
                    el('div', {className: 'discussion-card-preview', textContent: preview}),
                    el('div', {className: 'discussion-card-footer'},
                        el('span', {className: 'discussion-likes', innerHTML: '♥ ' + c.like_count}),
                        el('span', {className: 'discussion-replies', textContent: '💬 ' + replyCount + ' 条回复'})
                    )
                );
                card.addEventListener('click', function() {
                    renderProblemCommentDetailView(container, qid, c);
                });
                listEl.appendChild(card);
            });

            if (comments.length >= 20) {
                moreEl.innerHTML = '<button type="button" class="btn-secondary" id="problem-comments-more-btn">加载更多</button>';
                container.querySelector('#problem-comments-more-btn').addEventListener('click', function() {
                    page++;
                    this.remove();
                    loadPage();
                });
            } else {
                moreEl.innerHTML = '';
            }
        } catch(e) {
            if (loadingEl) loadingEl.style.display = 'none';
            listEl.innerHTML = '<div class="error">加载失败: ' + escapeHtml(e.message) + '</div>';
        }
    }

    loadPage();

    container.querySelector('#new-problem-comment-btn').addEventListener('click', function() {
        container.querySelector('#new-problem-comment-form').style.display = 'block';
        this.style.display = 'none';
    });

    container.querySelector('#cancel-problem-comment-btn').addEventListener('click', function() {
        container.querySelector('#new-problem-comment-form').style.display = 'none';
        container.querySelector('#new-problem-comment-btn').style.display = '';
        container.querySelector('#problem-comment-content').value = '';
    });

    container.querySelector('#submit-problem-comment-btn').addEventListener('click', async function() {
        var content = container.querySelector('#problem-comment-content').value.trim();
        if (!content) { showToast('内容不能为空', 'warning'); return; }
        var btn = this;
        try {
            btn.disabled = true;
            btn.textContent = '提交中...';
            var data = await API.createComment(qid, content);
            var comments = await API.getComments(qid, 1);
            var created = comments.find(function(c) { return c.id === data.id; }) || comments[0];
            if (created) {
                renderProblemCommentDetailView(container, qid, created);
            } else {
                renderProblemCommentListView(container, qid);
            }
            showToast('发帖成功', 'success');
        } catch(e) {
            showToast('发帖失败: ' + e.message, 'error');
            btn.disabled = false;
            btn.textContent = '提交';
        }
    });
}

function renderProblemCommentDetailView(container, qid, comment) {
    container.innerHTML =
        '<div class="problem-comments-panel">' +
            '<button type="button" class="back-link problem-comment-back">← 返回讨论列表</button>' +
            '<div id="problem-comment-detail-content"></div>' +
        '</div>';

    container.querySelector('.problem-comment-back').addEventListener('click', function() {
        renderProblemCommentListView(container, qid);
    });

    buildProblemCommentDetail(container.querySelector('#problem-comment-detail-content'), qid, comment);
}

async function fetchProblemCommentById(qid, commentId) {
    var page = 1;
    while (page <= 50) {
        var comments = await API.getComments(qid, page);
        if (!comments.length) break;
        var found = comments.find(function(c) { return c.id === commentId; });
        if (found) return found;
        if (comments.length < 20) break;
        page++;
    }
    return null;
}

function buildProblemCommentDetail(detailContainer, qid, c) {
    var canDelete = App.user && (App.user.id === c.user_id || App.user.is_admin);
    detailContainer.innerHTML = '';

    var postAvatar = el('img', {className: 'discussion-avatar', src: c.avatar_url || '', alt: ''});
    var postUsername = el('span', {className: 'discussion-username', textContent: c.username});
    attachUserProfileNav(postAvatar, c.user_id, false);
    attachUserProfileNav(postUsername, c.user_id, false);

    var postCard = el('div', {className: 'discussion-detail-post'},
        el('div', {className: 'discussion-detail-header'},
            postAvatar,
            el('div',
                postUsername,
                el('span', {className: 'discussion-time', textContent: formatDate(c.created_at)})
            )
        ),
        el('div', {className: 'discussion-detail-body markdown-body', innerHTML: renderMarkdown(c.content)}),
        el('div', {className: 'discussion-detail-actions'},
            el('button', {className: 'btn-like' + (c.liked_by_me ? ' liked' : ''), innerHTML: '♥ ' + c.like_count,
                onclick: async function() {
                    try {
                        if (c.liked_by_me) await API.unlikeComment(qid, c.id);
                        else await API.likeComment(qid, c.id);
                        c.liked_by_me = !c.liked_by_me;
                        c.like_count += c.liked_by_me ? 1 : -1;
                        detailContainer.querySelector('.btn-like').innerHTML = '♥ ' + c.like_count;
                        detailContainer.querySelector('.btn-like').classList.toggle('liked', c.liked_by_me);
                    } catch(e) { showToast('操作失败', 'error'); }
                }
            }),
            el('button', {className: 'btn-reply-to', textContent: '回复楼主',
                onclick: function() {
                    replaceProblemCommentReplyForm(postCard, qid, c.id, null, c.username, detailContainer, c.id);
                }
            }),
            canDelete ? el('button', {className: 'btn-sm btn-delete-discussion', textContent: '删除',
                onclick: async function() {
                    if (!(await showConfirm('确定要删除这条帖子吗？', { danger: true }))) return;
                    try {
                        await API.deleteComment(qid, c.id);
                        showToast('已删除', 'success');
                        var tab = document.querySelector('[data-comments-tab]');
                        if (tab) renderProblemCommentListView(tab, qid);
                    } catch(e) { showToast('删除失败: ' + e.message, 'error'); }
                }
            }) : null
        )
    );
    detailContainer.appendChild(postCard);

    if (c.replies && c.replies.length > 0) {
        detailContainer.appendChild(el('h4', {
            textContent: c.replies.length + ' 条回复',
            style: 'margin:18px 0 10px;color:#c4c8d4;font-size:0.95em;'
        }));
        var repliesContainer = el('div', {className: 'discussion-replies'});
        renderProblemCommentReplies(repliesContainer, c.replies, qid, c.id, detailContainer);
        detailContainer.appendChild(repliesContainer);
    }
}

function renderProblemCommentReplies(container, replies, qid, commentId, detailContainer) {
    replies.forEach(function(r) {
        var canDeleteReply = App.user && (App.user.id === r.user_id || App.user.is_admin);
        var indent = r.parent_reply_id ? 1 : 0;

        var replyAvatar = el('img', {className: 'discussion-avatar-small', src: r.avatar_url || '', alt: ''});
        var replyUsername = el('span', {className: 'discussion-username', textContent: r.username});
        attachUserProfileNav(replyAvatar, r.user_id, false);
        attachUserProfileNav(replyUsername, r.user_id, false);

        var replyEl = el('div', {className: 'discussion-reply' + (indent ? ' reply-indent' : '')},
            el('div', {className: 'discussion-reply-header'},
                replyAvatar,
                replyUsername,
                el('span', {className: 'discussion-time', textContent: formatDate(r.created_at)})
            ),
            el('div', {className: 'markdown-body', innerHTML: renderMarkdown(r.content)}),
            el('div', {className: 'discussion-reply-actions'},
                el('button', {className: 'btn-like-sm' + (r.liked_by_me ? ' liked' : ''), innerHTML: '♥ ' + r.like_count,
                    onclick: async function() {
                        try {
                            if (r.liked_by_me) await API.unlikeCommentReply(qid, commentId, r.id);
                            else await API.likeCommentReply(qid, commentId, r.id);
                            r.liked_by_me = !r.liked_by_me;
                            r.like_count += r.liked_by_me ? 1 : -1;
                            this.innerHTML = '♥ ' + r.like_count;
                            this.classList.toggle('liked', r.liked_by_me);
                        } catch(e) { showToast('操作失败', 'error'); }
                    }
                }),
                el('button', {className: 'btn-reply-to', textContent: '回复',
                    onclick: function() {
                        replaceProblemCommentReplyForm(replyEl, qid, commentId, r.parent_reply_id || r.id, r.username, detailContainer, commentId);
                    }
                }),
                canDeleteReply ? el('button', {className: 'btn-sm', textContent: '删除',
                    onclick: async function() {
                        if (!(await showConfirm('确定要删除这条回复吗？', { danger: true }))) return;
                        try {
                            await API.deleteCommentReply(qid, commentId, r.id);
                            var updated = await fetchProblemCommentById(qid, commentId);
                            if (updated) buildProblemCommentDetail(detailContainer, qid, updated);
                        } catch(e) { showToast('删除失败: ' + e.message, 'error'); }
                    }
                }) : null
            )
        );
        container.appendChild(replyEl);
    });
}

function replaceProblemCommentReplyForm(afterEl, qid, commentId, parentReplyId, replyToUser, detailContainer, rootCommentId) {
    var existing = document.querySelector('.inline-reply-form');
    if (existing) existing.remove();

    var form = el('div', {className: 'inline-reply-form'},
        el('textarea', {
            placeholder: parentReplyId
                ? ('回复 @' + replyToUser + '...')
                : ('回复楼主 @' + replyToUser + '... 支持 Markdown'),
            rows: 3
        }),
        el('div', {style: 'margin-top:6px;'},
            el('button', {className: 'btn-primary', textContent: '提交', style: 'width:auto;padding:4px 16px;font-size:0.82em;',
                onclick: async function() {
                    var content = form.querySelector('textarea').value.trim();
                    if (!content) { showToast('内容不能为空', 'warning'); return; }
                    try {
                        await API.createCommentReply(qid, commentId, content, parentReplyId || null);
                        var updated = await fetchProblemCommentById(qid, rootCommentId);
                        if (updated) buildProblemCommentDetail(detailContainer, qid, updated);
                    } catch(e) { showToast('回复失败: ' + e.message, 'error'); }
                }
            }),
            el('button', {className: 'btn-secondary', textContent: '取消', style: 'padding:4px 12px;font-size:0.82em;',
                onclick: function() { form.remove(); }
            })
        )
    );
    afterEl.insertAdjacentElement('afterend', form);
    form.querySelector('textarea').focus();
}
