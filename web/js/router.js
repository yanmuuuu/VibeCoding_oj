const App = {
    user: null,
    currentPage: null,
    init() {
        this.loadUser();
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
    },
    updateNav() {
        const navbar = $('#navbar');
        const navAdmin = $('#nav-admin');
        if (this.user) {
            navbar.style.display = 'flex';
            if (navAdmin) navAdmin.style.display = this.user.is_admin ? '' : 'none';
        } else {
            navbar.style.display = 'none';
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

window.addEventListener('DOMContentLoaded', () => App.init());
