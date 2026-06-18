const App = {
    user: null,
    currentPage: null,
    async init() {
        await this.loadUser();
        window.addEventListener('hashchange', () => this.route());
        this.route();
    },
    async loadUser() {
        try {
            this.user = await API.getUserProfile();
        } catch(e) {
            this.user = null;
        }
        this.updateNav();
        this.updateNavAvatar();
        this.highlightNav(window.location.hash.slice(1) || '/');
        if (typeof window.refreshBackground === 'function') {
            window.refreshBackground();
        }
    },
    updateNavAvatar() {
        var av = document.getElementById('nav-avatar');
        if (!av) return;
        if (this.user && this.user.avatar_url) {
            av.src = this.user.avatar_url;
            av.style.display = '';
        } else {
            av.style.display = 'none';
        }
        this.updateResetAvatarBtn();
    },
    updateResetAvatarBtn() {
        var row = document.getElementById('setting-reset-avatar');
        if (!row) return;
        if (this.user && this.user.avatar_url && this.user.avatar_url.indexOf('/avatars/user_') === 0) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    },
    updateNav() {
        const navbar = $('#navbar');
        const navLinks = $('#nav-links');
        const navProblems = $('#nav-problems');
        const navAnnounce = $('#nav-announcements');
        const navDiscussions = $('#nav-discussions');
        const navLeaderboard = $('#nav-leaderboard');
        const navMessages = $('#nav-messages');
        const navAdmin = $('#nav-admin');
        const navUser = $('#nav-user');
        const navLogin = $('#nav-login');
        const navLogout = $('#nav-logout');

        navbar.style.display = 'flex';
        navLinks.style.display = 'flex';
        if (navAnnounce) navAnnounce.style.display = '';

        if (this.user) {
            if (navProblems) navProblems.style.display = '';
            if (navLeaderboard) navLeaderboard.style.display = '';
            if (navDiscussions) navDiscussions.style.display = '';
            if (navMessages) navMessages.style.display = '';
            if (navAdmin) navAdmin.style.display = this.user.is_admin ? '' : 'none';
            if (navUser) navUser.style.display = this.user.is_admin ? 'none' : '';
            if (navLogin) navLogin.style.display = 'none';
            if (navLogout) navLogout.style.display = '';
            if (typeof updateMessageBadge === 'function') updateMessageBadge();
        } else {
            if (navProblems) navProblems.style.display = 'none';
            if (navLeaderboard) navLeaderboard.style.display = 'none';
            if (navDiscussions) navDiscussions.style.display = 'none';
            if (navMessages) navMessages.style.display = 'none';
            if (navAdmin) navAdmin.style.display = 'none';
            if (navUser) navUser.style.display = 'none';
            if (navLogin) navLogin.style.display = '';
            if (navLogout) navLogout.style.display = 'none';
        }
    },
    highlightNav(hash) {
        var activeId = null;
        if (hash === '/problems' || hash.indexOf('/problems/') === 0) activeId = 'nav-problems';
        else if (hash === '/announcements') activeId = 'nav-announcements';
        else if (hash === '/discussions' || hash.indexOf('/discussions/') === 0) activeId = 'nav-discussions';
        else if (hash === '/user') activeId = 'nav-user';
        else if (hash === '/leaderboard') activeId = 'nav-leaderboard';
        else if (hash === '/messages') activeId = 'nav-messages';
        else if (hash.indexOf('/admin') === 0) activeId = 'nav-admin';
        else if (hash === '/login' || hash === '/register') activeId = 'nav-login';
        ['nav-problems', 'nav-announcements', 'nav-discussions', 'nav-user', 'nav-admin', 'nav-login', 'nav-leaderboard', 'nav-messages'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('nav-active', id === activeId);
        });
    },
    async ensureAuth() {
        if (!this.user) {
            await this.loadUser();
        }
        if (!this.user) {
            this.navigate('#/login');
            throw new Error('Not authenticated');
        }
    },
    navigate(hash) {
        window.location.hash = hash;
    },
    route() {
        const raw = window.location.hash.slice(1) || '/';
        this.render(raw);
    },
    async render(rawHash) {
        const qIdx = rawHash.indexOf('?');
        const path = qIdx >= 0 ? rawHash.slice(0, qIdx) : rawHash;
        const queryStr = qIdx >= 0 ? rawHash.slice(qIdx + 1) : '';
        const params = new URLSearchParams(queryStr);

        const main = $('#content');
        main.classList.add('page-leaving');
        await new Promise(function(r) { setTimeout(r, 140); });
        main.classList.remove('page-leaving');
        main.innerHTML = '';
        this.highlightNav(path);

        const routes = {
            '/': 'login',
            '/login': 'login',
            '/register': 'register',
            '/problems': 'problems',
            '/user': 'userCenter',
            '/admin': 'admin',
            '/admin/stats': 'admin',
            '/admin/questions': 'admin',
            '/admin/users': 'admin',
            '/admin/announcements': 'admin',
            '/admin/discussions': 'admin',
            '/announcements': 'announcements',
            '/discussions': 'discussions',
            '/leaderboard': 'leaderboard',
            '/messages': 'messages',
            '/404': 'notFound',
        };

        let page = routes[path];
        if (!page) {
            if (path.startsWith('/problems/')) {
                page = 'problemDetail';
                const id = path.split('/')[2];
                main.dataset.problemId = id;
            } else if (path.startsWith('/result/')) {
                page = 'result';
                const id = path.split('/')[2];
                main.dataset.submissionId = id;
            } else if (path.startsWith('/discussions/')) {
                page = 'discussionDetail';
                const id = path.split('/')[2];
                main.dataset.discussionId = id;
            } else if (path.startsWith('/users/')) {
                page = 'userProfile';
                main.dataset.userId = path.split('/')[2];
            } else if (path.startsWith('/admin/questions/')) {
                const parts = path.split('/');
                const id = parts[3];
                if (id && id !== 'new' && !isNaN(id)) {
                    page = 'adminQuestionEdit';
                    main.dataset.questionId = id;
                } else {
                    page = 'admin';
                }
            } else {
                page = 'notFound';
            }
        }

        const peerUserId = params.get('user') ? parseInt(params.get('user'), 10) : null;

        try {
            if ((page === 'login' || page === 'register') && this.user) {
                this.navigate('#/problems');
                return;
            }
            switch (page) {
                case 'login': await renderLogin(main); break;
                case 'register': await renderRegister(main); break;
                case 'problems': await renderProblems(main); break;
                case 'problemDetail': await renderProblemDetail(main); break;
                case 'result': await renderResult(main); break;
                case 'userCenter': await renderUserCenter(main); break;
                case 'admin': await renderAdmin(main); break;
                case 'adminQuestionEdit': await renderAdminQuestionEdit(main); break;
                case 'announcements': await renderAnnouncements(main); break;
                case 'discussions': await renderDiscussions(main); break;
                case 'discussionDetail': await renderDiscussionDetail(main); break;
                case 'leaderboard': await renderLeaderboard(main); break;
                case 'messages': await renderMessages(main, { peerUserId: peerUserId }); break;
                case 'userProfile': await renderUserProfile(main); break;
                default: renderNotFound(main); break;
            }
        } catch(e) {
            if (e.message === 'Not authenticated') return;
            renderError(main, e.message);
        }
        main.classList.add('page-enter');
        requestAnimationFrame(function() {
            main.classList.remove('page-enter');
        });
        this.currentPage = page;
    }
};

document.addEventListener('click', async (e) => {
    if (e.target.id === 'nav-logout') {
        e.preventDefault();
        try { await API.logout(); } catch(_) {}
        App.user = null;
        App.updateNav();
        App.navigate('#/login');
    }
    if (e.target.id === 'nav-avatar') {
        e.preventDefault();
        App.navigate('#/user');
    }
});

function playSettingsToggleTrail(el, turningOn) {
    el.classList.remove('toggle-trail-fwd', 'toggle-trail-rev');
    void el.offsetWidth;
    el.classList.add(turningOn ? 'toggle-trail-fwd' : 'toggle-trail-rev');
    var cleanup = function() {
        el.classList.remove('toggle-trail-fwd', 'toggle-trail-rev');
        el.removeEventListener('animationend', cleanup);
    };
    el.addEventListener('animationend', cleanup);
}

function initSettings() {
    var panel = document.getElementById('settings-panel');
    var btn = document.getElementById('nav-settings-btn');
    var toggleEff = document.getElementById('toggle-effects');
    var toggleAc = document.getElementById('toggle-autocomplete');
    var uploadBtn = document.getElementById('upload-bg-btn');
    var uploadInput = document.getElementById('upload-bg-input');

    if (!panel || !btn) return;

    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', function(e) {
        if (!panel.contains(e.target) && e.target !== btn) {
            panel.style.display = 'none';
        }
    });

    var bgMode = localStorage.getItem('vibeoj_bg_mode');
    if (bgMode === null) bgMode = 'album';
    if (bgMode === 'album') {
        toggleEff.classList.add('on');
    } else {
        toggleEff.classList.remove('on');
    }

    toggleEff.addEventListener('click', function() {
        var on = !toggleEff.classList.contains('on');
        playSettingsToggleTrail(toggleEff, on);
        if (on) {
            toggleEff.classList.add('on');
        } else {
            toggleEff.classList.remove('on');
        }
        if (typeof window.toggleEffects === 'function') {
            window.toggleEffects(on);
        }
    });

    var toggleUseCustomBg = document.getElementById('toggle-use-custom-bg');
    var settingUseCustomBg = document.getElementById('setting-use-custom-bg');
    if (toggleUseCustomBg && settingUseCustomBg) {
        if (typeof window.refreshUseCustomBgUI === 'function') {
            window.refreshUseCustomBgUI();
        }
        toggleUseCustomBg.addEventListener('click', function() {
            var on = !toggleUseCustomBg.classList.contains('on');
            playSettingsToggleTrail(toggleUseCustomBg, on);
            if (on) {
                toggleUseCustomBg.classList.add('on');
            } else {
                toggleUseCustomBg.classList.remove('on');
            }
            if (typeof window.setUseCustomBg === 'function') {
                window.setUseCustomBg(on);
            }
        });
    }

    var deleteBgBtn = document.getElementById('delete-bg-btn');
    if (deleteBgBtn) {
        deleteBgBtn.addEventListener('click', async function() {
            if (!(await showConfirm('确定要删除你的自定义壁纸吗？删除后将恢复系统背景。', { danger: true }))) return;
            deleteBgBtn.textContent = '...';
            deleteBgBtn.disabled = true;
            try {
                await window.deleteCustomBackground();
            } catch (e) {
                await showAlert('删除失败: ' + e.message);
            } finally {
                deleteBgBtn.textContent = '删除';
                deleteBgBtn.disabled = false;
            }
        });
    }

    var resetBgBtn = document.getElementById('reset-bg-btn');
    if (resetBgBtn) {
        resetBgBtn.addEventListener('click', async function() {
            if (!(await showConfirm('确定要恢复默认背景设置吗？这将删除自定义壁纸并重置所有背景选项。', { danger: true }))) return;
            resetBgBtn.textContent = '...';
            resetBgBtn.disabled = true;
            try {
                await window.resetAllBackgrounds();
            } catch (e) {
                await showAlert('恢复失败: ' + e.message);
            } finally {
                resetBgBtn.textContent = '恢复默认';
                resetBgBtn.disabled = false;
            }
        });
    }

    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', function() {
            uploadInput.click();
        });
        uploadInput.addEventListener('change', function() {
            if (uploadInput.files && uploadInput.files[0]) {
                var file = uploadInput.files[0];
                uploadInput.value = '';
                if (typeof window.showCropModal === 'function' && typeof window.uploadBackground === 'function') {
                    window.showCropModal(file).then(function(croppedFile) {
                        var origText = uploadBtn.textContent;
                        uploadBtn.textContent = '上传中...';
                        uploadBtn.disabled = true;
                        return window.uploadBackground(croppedFile).then(function() {
                            uploadBtn.textContent = origText;
                            uploadBtn.disabled = false;
                            showToast('背景上传成功', 'success');
                        });
                    }).catch(function(e) {
                        if (e.message !== '用户取消') {
                            showToast('操作失败: ' + e.message, 'error');
                        }
                    });
                }
            }
        });
    }

    var uploadAvatarBtn = document.getElementById('upload-avatar-btn');
    var uploadAvatarInput = document.getElementById('upload-avatar-input');
    if (uploadAvatarBtn && uploadAvatarInput) {
        uploadAvatarBtn.addEventListener('click', function() {
            if (!App.user) { App.navigate('#/login'); return; }
            uploadAvatarInput.click();
        });
        uploadAvatarInput.addEventListener('change', function() {
            if (uploadAvatarInput.files && uploadAvatarInput.files[0]) {
                var file = uploadAvatarInput.files[0];
                uploadAvatarInput.value = '';
                if (typeof window.showAvatarCropModal === 'function' && typeof window.uploadAvatarFile === 'function') {
                    window.showAvatarCropModal(file).then(function(croppedFile) {
                        var origText = uploadAvatarBtn.textContent;
                        uploadAvatarBtn.textContent = '上传中...';
                        uploadAvatarBtn.disabled = true;
                        return window.uploadAvatarFile(croppedFile).then(function() {
                            uploadAvatarBtn.textContent = origText;
                            uploadAvatarBtn.disabled = false;
                            showToast('头像上传成功', 'success');
                        });
                    }).catch(function(e) {
                        if (e.message !== '用户取消') {
                            showToast('操作失败: ' + e.message, 'error');
                        }
                        uploadAvatarBtn.textContent = '选择图片';
                        uploadAvatarBtn.disabled = false;
                    });
                }
            }
        });
    }

    var resetAvatarBtn = document.getElementById('reset-avatar-btn');
    if (resetAvatarBtn) {
        resetAvatarBtn.addEventListener('click', async function() {
            if (!(await showConfirm('确定要恢复默认头像吗？', { danger: true }))) return;
            try {
                resetAvatarBtn.textContent = '...';
                resetAvatarBtn.disabled = true;
                var data = await API.deleteAvatar();
                if (App.user) App.user.avatar_url = data.url;
                App.updateNavAvatar();
                showToast('已恢复默认头像', 'success');
            } catch (e) {
                showToast('恢复失败: ' + e.message, 'error');
            } finally {
                resetAvatarBtn.textContent = '恢复默认头像';
                resetAvatarBtn.disabled = false;
            }
        });
    }

    var blurSlider = document.getElementById('blur-slider');
    var blurLabel = document.getElementById('blur-value-label');
    if (blurSlider && blurLabel) {
        var savedBlur = localStorage.getItem('vibeoj_bg_blur');
        if (savedBlur !== null) {
            blurSlider.value = parseInt(savedBlur) || 0;
            blurLabel.textContent = blurSlider.value + 'px';
        }
        blurSlider.addEventListener('input', function() {
            blurLabel.textContent = blurSlider.value + 'px';
        });
        blurSlider.addEventListener('change', function() {
            var px = parseInt(blurSlider.value);
            localStorage.setItem('vibeoj_bg_blur', px);
            if (typeof window.setBackgroundBlur === 'function') {
                window.setBackgroundBlur(px);
            }
        });
    }

    var acEnabled = localStorage.getItem('autocomplete_enabled');
    if (acEnabled === null) acEnabled = 'true';
    if (acEnabled === 'true') {
        toggleAc.classList.add('on');
    } else {
        toggleAc.classList.remove('on');
    }

    toggleAc.addEventListener('click', function() {
        var on = !toggleAc.classList.contains('on');
        playSettingsToggleTrail(toggleAc, on);
        if (on) {
            toggleAc.classList.add('on');
        } else {
            toggleAc.classList.remove('on');
        }
        localStorage.setItem('autocomplete_enabled', on);
        if (typeof window.setAutocompleteEnabled === 'function') {
            window.setAutocompleteEnabled(on);
        }
    });
}

window.addEventListener('DOMContentLoaded', function() {
    App.init();
    initSettings();
});
