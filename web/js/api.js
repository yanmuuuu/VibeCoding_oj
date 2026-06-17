const API = {
    async request(method, path, body) {
        const opts = { method, credentials: 'same-origin' };
        if (body) {
            opts.headers = { 'Content-Type': 'application/json' };
            opts.body = JSON.stringify(body);
        }
        const resp = await fetch(path, opts);
        const data = await resp.json();
        if (resp.status === 401) {
            App.user = null;
            App.navigate('#/login');
            throw new Error('Not authenticated');
        }
        if (!resp.ok) throw new Error(data.error || 'Request failed');
        return data;
    },
    get(path) { return this.request('GET', path); },
    post(path, body) { return this.request('POST', path, body); },
    put(path, body) { return this.request('PUT', path, body); },
    del(path) { return this.request('DELETE', path); },

    register(username, password) { return this.post('/api/register', {username, password}); },
    login(username, password) { return this.post('/api/login', {username, password}); },
    logout() { return this.post('/api/logout'); },
    getProblems() { return this.get('/api/problems'); },
    getProblem(id) { return this.get('/api/problems/' + id); },
    submit(question_id, code) { return this.post('/api/submit', {question_id, code}); },
    getSubmission(id) { return this.get('/api/submissions/' + id); },
    getUserProfile() { return this.get('/api/user/profile'); },
    getUserSubmissions(page) { return this.get('/api/user/submissions?page=' + (page||1)); },
    getAcceptedCode(qid) { return this.get('/api/user/ac-code/' + qid); },
    getAcceptedCodes(qid) { return this.get('/api/user/ac-codes/' + qid); },
    getAdminQuestions() { return this.get('/api/admin/questions'); },
    getAdminQuestion(id) { return this.get('/api/admin/questions/' + id); },
    createQuestion(data) { return this.post('/api/admin/questions', data); },
    updateQuestion(id, data) { return this.put('/api/admin/questions/' + id, data); },
    deleteQuestion(id) { return this.del('/api/admin/questions/' + id); },
    getTestCases(qid) { return this.get('/api/admin/questions/' + qid + '/testcases'); },
    createTestCase(qid, data) { return this.post('/api/admin/questions/' + qid + '/testcases', data); },
    updateTestCase(qid, tid, data) { return this.put('/api/admin/questions/' + qid + '/testcases/' + tid, data); },
    deleteTestCase(qid, tid) { return this.del('/api/admin/questions/' + qid + '/testcases/' + tid); },
    getBackgrounds() { return this.get('/api/backgrounds'); },
    deleteBackground() { return this.post('/api/backgrounds/delete'); },
    getAdminStats() { return this.get('/api/admin/stats'); },
    batchQuestions(action, ids) { return this.post('/api/admin/questions/batch', {action, ids: ids.join(',')}); },
    generateOutputs(code, input_data) { return this.post('/api/admin/reference/generate', {code, input_data}); },
    getAdminUsers(page, search) { return this.get('/api/admin/users?page=' + (page||1) + (search ? '&search=' + encodeURIComponent(search) : '')); },
    deleteUser(id) { return this.del('/api/admin/users/' + id); },
    toggleUserAdmin(id, is_admin) { return this.put('/api/admin/users/' + id + '/admin', {is_admin}); },
    getAnnouncements() { return this.get('/api/announcements'); },
    getAdminAnnouncements() { return this.get('/api/admin/announcements'); },
    createAnnouncement(data) { return this.post('/api/admin/announcements', data); },
    updateAnnouncement(id, data) { return this.put('/api/admin/announcements/' + id, data); },
    deleteAnnouncement(id) { return this.del('/api/admin/announcements/' + id); },
    uploadAvatar(formData) {
        return fetch('/api/user/avatar/upload', { method: 'POST', credentials: 'same-origin', body: formData })
            .then(r => r.json().then(d => { if (!r.ok) throw new Error(d.error || '上传失败'); return d; }));
    },
    deleteAvatar() { return this.del('/api/user/avatar'); },
    getDiscussions(page) { return this.get('/api/discussions?page=' + (page||1)); },
    getDiscussion(id) { return this.get('/api/discussions/' + id); },
    createDiscussion(content) { return this.post('/api/discussions', {content}); },
    deleteDiscussion(id) { return this.del('/api/discussions/' + id); },
    likeDiscussion(id) { return this.post('/api/discussions/' + id + '/like'); },
    unlikeDiscussion(id) { return this.del('/api/discussions/' + id + '/like'); },
    createDiscussionReply(id, content, parentReplyId) {
        return this.post('/api/discussions/' + id + '/replies', parentReplyId ? {content, parent_reply_id: String(parentReplyId)} : {content});
    },
    deleteDiscussionReply(did, rid) { return this.del('/api/discussions/' + did + '/replies/' + rid); },
    likeDiscussionReply(did, rid) { return this.post('/api/discussions/' + did + '/replies/' + rid + '/like'); },
    unlikeDiscussionReply(did, rid) { return this.del('/api/discussions/' + did + '/replies/' + rid + '/like'); },
    getComments(qid, page) { return this.get('/api/problems/' + qid + '/comments?page=' + (page||1)); },
    createComment(qid, content) { return this.post('/api/problems/' + qid + '/comments', {content}); },
    deleteComment(qid, cid) { return this.del('/api/problems/' + qid + '/comments/' + cid); },
    likeComment(qid, cid) { return this.post('/api/problems/' + qid + '/comments/' + cid + '/like'); },
    unlikeComment(qid, cid) { return this.del('/api/problems/' + qid + '/comments/' + cid + '/like'); },
    createCommentReply(qid, cid, content, parentReplyId) {
        return this.post('/api/problems/' + qid + '/comments/' + cid + '/replies', parentReplyId ? {content, parent_reply_id: String(parentReplyId)} : {content});
    },
    deleteCommentReply(qid, cid, rid) { return this.del('/api/problems/' + qid + '/comments/' + cid + '/replies/' + rid); },
    likeCommentReply(qid, cid, rid) { return this.post('/api/problems/' + qid + '/comments/' + cid + '/replies/' + rid + '/like'); },
    unlikeCommentReply(qid, cid, rid) { return this.del('/api/problems/' + qid + '/comments/' + cid + '/replies/' + rid + '/like'); },
};
