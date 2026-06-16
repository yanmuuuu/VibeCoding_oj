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
        if (typeof window.refreshBackground === 'function') {
            window.refreshBackground();
        }
    },
    updateNav() {
        const navbar = $('#navbar');
        const navLinks = $('#nav-links');
        const navAdmin = $('#nav-admin');
        if (this.user) {
            navbar.style.display = 'flex';
            navLinks.style.display = 'flex';
            if (navAdmin) navAdmin.style.display = this.user.is_admin ? '' : 'none';
        } else {
            navbar.style.display = 'flex';
            navLinks.style.display = 'none';
        }
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
        main.innerHTML = '';

        const routes = {
            '/': 'login',
            '/login': 'login',
            '/register': 'register',
            '/problems': 'problems',
            '/user': 'userCenter',
            '/admin': 'admin',
            '/admin/questions': 'adminQuestions',
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
            } else if (hash.startsWith('/admin/questions/') && hash.split('/').length === 4) {
                page = 'adminQuestionEdit';
                const id = hash.split('/')[3];
                main.dataset.questionId = id;
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
                case 'adminQuestions': await renderAdminQuestions(main); break;
                case 'adminQuestionEdit': await renderAdminQuestionEdit(main); break;
                default: renderNotFound(main); break;
            }
        } catch(e) {
            if (e.message === 'Not authenticated') return;
            renderError(main, e.message);
        }
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
            if (typeof window.setUseCustomBg === 'function') {
                window.setUseCustomBg(on);
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
                            alert('背景上传成功');
                        });
                    }).catch(function(e) {
                        if (e.message !== '用户取消') {
                            alert('操作失败: ' + e.message);
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
