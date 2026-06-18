let messagesCurrentConv = null;
let messagesPollTimer = null;
let messagesCurrentPage = 1;
let msgContextMenu = null;

function buildMessageRowHtml(m) {
    if (m.is_recalled) {
        const text = m.is_me ? '你撤回了一条消息' : '对方撤回了一条消息';
        return '<div class="msg-row msg-row-recalled ' + (m.is_me ? 'msg-row-me' : 'msg-row-peer') + '" data-msg-id="' + m.id + '">' +
            '<div class="msg-bubble-recalled">' + escapeHtml(text) + '</div></div>';
    }
    const cls = m.is_me ? 'msg-bubble-me' : 'msg-bubble-peer';
    let html = '<div class="msg-row ' + (m.is_me ? 'msg-row-me' : 'msg-row-peer') + '" data-msg-id="' + m.id + '"';
    if (m.can_recall) html += ' data-can-recall="1"';
    html += '>';
    if (!m.is_me) {
        html += '<img src="' + escapeHtml(m.avatar_url || '') + '" class="msg-avatar" onerror="this.style.display=\'none\'">';
    }
    html += '<div class="' + cls + '"><div class="msg-meta">' + escapeHtml(m.username) + ' &middot; ' + escapeHtml(m.created_at) + '</div>';
    html += '<div class="msg-content">' + renderMarkdown(m.content) + '</div></div>';
    if (m.is_me) {
        html += '<img src="' + escapeHtml(m.avatar_url || '') + '" class="msg-avatar" onerror="this.style.display=\'none\'">';
    }
    html += '</div>';
    return html;
}

function hideMsgContextMenu() {
    if (msgContextMenu) {
        msgContextMenu.remove();
        msgContextMenu = null;
    }
}

function showMsgContextMenu(x, y, msgId) {
    hideMsgContextMenu();
    msgContextMenu = document.createElement('div');
    msgContextMenu.className = 'msg-context-menu';
    msgContextMenu.innerHTML = '<button type="button" class="msg-context-item" data-action="recall">撤回</button>';
    msgContextMenu.style.left = x + 'px';
    msgContextMenu.style.top = y + 'px';
    document.body.appendChild(msgContextMenu);
    msgContextMenu.querySelector('[data-action="recall"]').onclick = async function() {
        hideMsgContextMenu();
        try {
            await API.recallMessage(msgId);
            showToast('消息已撤回', 'success');
            await renderConversationMessages(messagesCurrentConv, true);
            await loadConversations();
        } catch(e) {
            showToast('撤回失败: ' + e.message, 'error');
        }
    };
}

function bindMessageContextMenus(container) {
    if (!container) return;
    container.querySelectorAll('.msg-row[data-can-recall="1"]').forEach(function(row) {
        row.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            showMsgContextMenu(e.clientX, e.clientY, parseInt(row.dataset.msgId, 10));
        });
    });
}

document.addEventListener('click', hideMsgContextMenu);
document.addEventListener('scroll', hideMsgContextMenu, true);

async function renderMessages(main, opts) {
    opts = opts || {};
    await App.ensureAuth();

    stopMessagePolling();

    main.innerHTML = `
    <div class="page-header">
        <a href="#/problems" class="back-link">&larr; 返回题目列表</a>
        <h2>私信</h2>
    </div>
    <div class="messages-container">
        <div class="messages-sidebar">
            <div class="messages-search-box">
                <input type="text" id="msg-user-search" placeholder="搜索用户发起私信...">
                <div id="msg-search-results" class="msg-search-results" style="display:none;"></div>
            </div>
            <div id="msg-conv-list" class="msg-conv-list">加载中...</div>
        </div>
        <div class="messages-main" id="msg-main">
            <div class="msg-placeholder">选择一个会话开始聊天</div>
        </div>
    </div>`;

    await loadConversations();

    document.getElementById('msg-user-search').addEventListener('input', debounce(async function() {
        const q = this.value.trim();
        const results = document.getElementById('msg-search-results');
        if (!q) { results.style.display = 'none'; results.innerHTML = ''; return; }
        try {
            const users = await API.searchMessageUsers(q);
            if (users.length === 0) {
                results.innerHTML = '<div class="msg-search-empty">未找到用户</div>';
            } else {
                results.innerHTML = users.map(function(u) {
                    return '<div class="msg-search-item" data-user-id="' + u.id + '">' +
                        '<img src="' + escapeHtml(u.avatar_url || '') + '" class="user-avatar-small" onerror="this.style.display=\'none\'">' +
                        '<span>' + escapeHtml(u.username) + '</span></div>';
                }).join('');
            }
            results.style.display = '';
        } catch(e) { results.innerHTML = '<div class="msg-search-empty">搜索失败</div>'; results.style.display = ''; }
    }, 300));

    document.getElementById('msg-search-results').addEventListener('click', async function(e) {
        const item = e.target.closest('.msg-search-item');
        if (!item) return;
        const uid = parseInt(item.dataset.userId);
        document.getElementById('msg-user-search').value = '';
        this.style.display = 'none';
        try {
            const data = await API.createConversation(uid);
            await loadConversations();
            openConversation(data.id);
        } catch(e) { showToast('发起私信失败: ' + e.message, 'error'); }
    });

    startMessagePolling();

    if (opts.peerUserId && opts.peerUserId > 0 && (!App.user || opts.peerUserId !== App.user.id)) {
        try {
            const data = await API.createConversation(opts.peerUserId);
            await loadConversations();
            await openConversation(data.id);
        } catch(e) {
            showToast('发起私信失败: ' + e.message, 'error');
        }
    }
}

async function loadConversations() {
    const list = document.getElementById('msg-conv-list');
    try {
        const convs = await API.getConversations();
        if (convs.length === 0) {
            list.innerHTML = '<div class="msg-conv-empty">暂无会话<br>上方搜索框可搜索用户发起私信</div>';
        } else {
            list.innerHTML = convs.map(function(c) {
                const active = messagesCurrentConv === c.id ? ' active' : '';
                const unread = c.unread_count > 0 ? '<span class="msg-badge">' + c.unread_count + '</span>' : '';
                return '<div class="msg-conv-item' + active + '" data-conv-id="' + c.id + '">' +
                    '<img src="' + escapeHtml(c.peer_avatar || '') + '" class="msg-conv-avatar" onerror="this.style.display=\'none\'">' +
                    '<div class="msg-conv-info">' +
                    '<div class="msg-conv-name">' + escapeHtml(c.peer_username) + unread + '</div>' +
                    '<div class="msg-conv-preview">' + escapeHtml((c.last_msg || '').substring(0, 50)) + '</div>' +
                    '</div></div>';
            }).join('');
        }

        list.querySelectorAll('.msg-conv-item').forEach(function(item) {
            item.addEventListener('click', function() {
                const cid = parseInt(this.dataset.convId);
                openConversation(cid);
            });
        });
    } catch(e) {
        list.innerHTML = '<div class="msg-conv-empty">加载失败</div>';
    }
}

async function openConversation(convId) {
    messagesCurrentConv = convId;
    messagesCurrentPage = 1;
    document.getElementById('msg-main').innerHTML = '<div class="loading">加载中...</div>';

    const convItems = document.querySelectorAll('.msg-conv-item');
    convItems.forEach(function(item) {
        item.classList.toggle('active', parseInt(item.dataset.convId) === convId);
    });

    try {
        await API.markRead(convId);
        updateMessageBadge();
    } catch(e) {}

    await renderConversationMessages(convId, true);
}

async function renderConversationMessages(convId, reset) {
    if (reset) messagesCurrentPage = 1;
    const main = document.getElementById('msg-main');
    try {
        const msgs = await API.getMessages(convId, messagesCurrentPage);
        msgs.reverse();

        const convItems = document.querySelectorAll('.msg-conv-item');
        let peerName = '';
        convItems.forEach(function(item) {
            if (parseInt(item.dataset.convId) === convId) {
                peerName = item.querySelector('.msg-conv-name').textContent.replace(/\d+$/, '').trim();
            }
        });

        let html = '<div class="msg-chat-header">' + escapeHtml(peerName) + '</div>';
        html += '<div class="msg-chat-body" id="msg-chat-body">';

        if (msgs.length === 0) {
            html += '<div class="msg-empty-hint">暂无消息，发送第一条消息吧</div>';
        } else {
            if (messagesCurrentPage > 1) {
                html += '<div class="msg-load-more"><button class="btn-secondary btn-sm" id="msg-load-more-btn">加载更多消息</button></div>';
            }
            msgs.forEach(function(m) {
                html += buildMessageRowHtml(m);
            });
        }
        html += '</div>';
        html += '<div class="msg-chat-input">';
        html += '<textarea id="msg-input-area" placeholder="输入消息... (支持 Markdown)"></textarea>';
        html += '<button id="msg-send-btn">发送</button>';
        html += '</div>';

        main.innerHTML = html;

        bindMessageContextMenus(document.getElementById('msg-chat-body'));

        const chatBody = document.getElementById('msg-chat-body');
        chatBody.scrollTop = chatBody.scrollHeight;

        const loadMoreBtn = document.getElementById('msg-load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', async function() {
                this.textContent = '加载中...';
                this.disabled = true;
                messagesCurrentPage++;
                const moreMsgs = await API.getMessages(convId, messagesCurrentPage);
                if (moreMsgs.length === 0) {
                    this.textContent = '没有更多消息';
                    return;
                }
                moreMsgs.reverse();
                let moreHtml = '';
                moreMsgs.forEach(function(m) {
                    moreHtml += buildMessageRowHtml(m);
                });
                this.insertAdjacentHTML('beforebegin', moreHtml);
                bindMessageContextMenus(document.getElementById('msg-chat-body'));
                if (moreMsgs.length < 50) {
                    this.textContent = '没有更多消息';
                    this.disabled = true;
                } else {
                    this.textContent = '加载更多消息';
                    this.disabled = false;
                }
            });
        }

        document.getElementById('msg-send-btn').addEventListener('click', sendMessage);
        document.getElementById('msg-input-area').addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

    } catch(e) {
        main.innerHTML = '<div class="msg-placeholder" style="color:var(--danger);">加载失败: ' + e.message + '</div>';
    }
}

async function sendMessage() {
    const input = document.getElementById('msg-input-area');
    if (!input || !input.value.trim()) return;
    const content = input.value.trim();
    const btn = document.getElementById('msg-send-btn');
    input.disabled = true;
    btn.disabled = true;
    btn.textContent = '发送中...';
    try {
        await API.sendMessage(messagesCurrentConv, content);
        input.value = '';
        await renderConversationMessages(messagesCurrentConv, true);
        await loadConversations();
    } catch(e) {
        showToast('发送失败: ' + e.message, 'error');
    } finally {
        input.disabled = false;
        btn.disabled = false;
        btn.textContent = '发送';
    }
}

function startMessagePolling() {
    stopMessagePolling();
    updateMessageBadge();
    messagesPollTimer = setInterval(async function() {
        try {
            updateMessageBadge();
            if (messagesCurrentConv) {
                await loadConversations();
            }
        } catch(e) {}
    }, 10000);
}

function stopMessagePolling() {
    if (messagesPollTimer) {
        clearInterval(messagesPollTimer);
        messagesPollTimer = null;
    }
}

async function updateMessageBadge() {
    const badge = document.getElementById('nav-msg-badge');
    if (!badge || !App.user) return;
    try {
        const data = await API.getUnreadCount();
        const count = data.count || 0;
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = count > 0 ? '' : 'none';
    } catch(e) {
        badge.style.display = 'none';
    }
}

window.updateMessageBadge = updateMessageBadge;

function debounce(fn, ms) {
    let timer;
    return function() {
        const ctx = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
}
