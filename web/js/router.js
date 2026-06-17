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
        this.highlightNav(window.location.hash.slice(1) || '/');
        if (typeof window.refreshBackground === 'function') {
            window.refreshBackground();
        }
    },
    updateNav() {
        const navbar = $('#navbar');
        const navLinks = $('#nav-links');
        const navProblems = $('#nav-problems');
        const navAnnounce = $('#nav-announcements');
        const navAdmin = $('#nav-admin');
        const navUser = $('#nav-user');
        const navLogin = $('#nav-login');
        const navLogout = $('#nav-logout');

        navbar.style.display = 'flex';
        navLinks.style.display = 'flex';
        if (navAnnounce) navAnnounce.style.display = '';

        if (this.user) {
            if (navProblems) navProblems.style.display = '';
            if (navAdmin) navAdmin.style.display = this.user.is_admin ? '' : 'none';
            if (navUser) navUser.style.display = this.user.is_admin ? 'none' : '';
            if (navLogin) navLogin.style.display = 'none';
            if (navLogout) navLogout.style.display = '';
        } else {
            if (navProblems) navProblems.style.display = 'none';
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
        else if (hash === '/user') activeId = 'nav-user';
        else if (hash.indexOf('/admin') === 0) activeId = 'nav-admin';
        else if (hash === '/login' || hash === '/register') activeId = 'nav-login';
        ['nav-problems', 'nav-announcements', 'nav-user', 'nav-admin', 'nav-login'].forEach(function(id) {
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
        const hash = window.location.hash.slice(1) || '/';
        this.render(hash);
    },
    async render(hash) {
        const main = $('#content');
        main.classList.add('page-leaving');
        await new Promise(function(r) { setTimeout(r, 140); });
        main.classList.remove('page-leaving');
        main.innerHTML = '';
        this.highlightNav(hash);

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
            '/announcements': 'announcements',
            '/404': 'notFound',
        };

        let page = routes[hash];
        if (!page) {
            if (hash.startsWith('/problems/')) {
                page = 'problemDetail';
                const id = hash.split('/')[2];
                main.dataset.problemId = id;
            } else if (hash.startsWith('/result/')) {
                page = 'result';
                const id = hash.split('/')[2];
                main.dataset.submissionId = id;
            } else if (hash.startsWith('/admin/questions/')) {
                const parts = hash.split('/');
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
        deleteBgBtn.addEventListener('click', function() {
            if (!confirm('确定要删除你的自定义壁纸吗？删除后将恢复系统背景。')) return;
            deleteBgBtn.textContent = '...';
            deleteBgBtn.disabled = true;
            window.deleteCustomBackground().then(function() {
                deleteBgBtn.textContent = '删除';
                deleteBgBtn.disabled = false;
            }).catch(function(e) {
                alert('删除失败: ' + e.message);
                deleteBgBtn.textContent = '删除';
                deleteBgBtn.disabled = false;
            });
        });
    }

    var resetBgBtn = document.getElementById('reset-bg-btn');
    if (resetBgBtn) {
        resetBgBtn.addEventListener('click', function() {
            if (!confirm('确定要恢复默认背景设置吗？这将删除自定义壁纸并重置所有背景选项。')) return;
            resetBgBtn.textContent = '...';
            resetBgBtn.disabled = true;
            window.resetAllBackgrounds().then(function() {
                resetBgBtn.textContent = '恢复默认';
                resetBgBtn.disabled = false;
            }).catch(function(e) {
                alert('恢复失败: ' + e.message);
                resetBgBtn.textContent = '恢复默认';
                resetBgBtn.disabled = false;
            });
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
