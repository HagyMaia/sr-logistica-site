(() => {
    const SUPABASE_URL = 'https://lvdplhnbkkmlcxeuqhdo.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_CoC8vHLwAQ3kGsXwWBlaoA_4LB5SzsK';
    const APPLICATIONS_TABLE = 'driver_applications';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let applications = [];
    let activeStatus = 'pending';

    const ui = {
        loginContainer: document.getElementById('login-container'), dashboard: document.getElementById('dashboard-container'),
        loginForm: document.getElementById('login-form'), adminForm: document.getElementById('admin-form'), posts: document.getElementById('posts-container'),
        email: document.getElementById('admin-user'), loginPassword: document.getElementById('admin-password'), loginFeedback: document.getElementById('login-feedback'),
        passwordForm: document.getElementById('password-form'), passwordFeedback: document.getElementById('password-feedback'), globalFeedback: document.getElementById('global-feedback')
    };

    const escapeHTML = (value) => { const div = document.createElement('div'); div.textContent = value ?? ''; return div.innerHTML; };
    const displayName = (item) => item.full_name || item.name || item.driver_name || item.nome || 'Motorista sem nome';
    const displayEmail = (item) => item.email || item.email_address || item.email_usuario || 'E-mail não informado';
    const displayPhone = (item) => item.phone || item.telephone || item.whatsapp || item.telefone || 'Telefone não informado';
    const initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'MT';
    const dateLabel = (value) => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Data não informada';
    const showFeedback = (element, message, type = 'success') => { if (!element) return; element.textContent = message; element.className = `feedback-msg ${type}`; setTimeout(() => { element.textContent = ''; element.className = 'feedback-msg'; }, 5000); };
    const showGlobal = (message, type = 'success') => { ui.globalFeedback.textContent = message; ui.globalFeedback.style.color = type === 'error' ? 'var(--red)' : 'var(--green)'; setTimeout(() => { ui.globalFeedback.textContent = ''; }, 5000); };

    const toggleContainers = (loggedIn) => { ui.loginContainer.classList.toggle('hidden', loggedIn); ui.dashboard.classList.toggle('hidden', !loggedIn); if (loggedIn) loadDashboard(); };
    const setMetric = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    const statusOf = (item) => String(item.status || item.approval_status || 'pending').toLowerCase();

    const loadApplications = async () => {
        try {
            const { data, error } = await supabaseClient.from(APPLICATIONS_TABLE).select('*').order('created_at', { ascending: false });
            if (error) throw error;
            applications = data || [];
            renderApprovals(); renderRecent(); renderDrivers(); updateCounts();
        } catch (error) {
            applications = [];
            ['approvals-container', 'drivers-container', 'recent-approvals'].forEach(id => { const element = document.getElementById(id); if (element) element.innerHTML = `<p class="empty-state">A tabela de solicitações ainda não está disponível no Supabase.</p>`; });
            updateCounts();
        }
    };

    const updateCounts = () => {
        const pending = applications.filter(item => statusOf(item) === 'pending').length;
        const approved = applications.filter(item => statusOf(item) === 'approved').length;
        setMetric('metric-pending', pending); setMetric('metric-approved', approved); setMetric('pending-tab-count', pending); setMetric('approved-tab-count', approved); setMetric('nav-pending-count', pending);
    };

    const renderPerson = (item) => `<div class="driver-name"><span class="person-avatar">${escapeHTML(initials(displayName(item)))}</span><div><strong>${escapeHTML(displayName(item))}</strong><small>${escapeHTML(displayEmail(item))}</small></div></div>`;
    const renderRecent = () => {
        const target = document.getElementById('recent-approvals');
        const recent = applications.filter(item => statusOf(item) === 'pending').slice(0, 4);
        target.innerHTML = recent.length ? recent.map(item => `<div class="approval-row">${renderPerson(item)}<span class="status-badge pending">Pendente</span></div>`).join('') : '<p class="empty-state">Nenhuma solicitação pendente.</p>';
    };
    const renderApprovals = () => {
        const target = document.getElementById('approvals-container');
        const list = applications.filter(item => statusOf(item) === activeStatus);
        if (!list.length) { target.innerHTML = `<p class="empty-state">${activeStatus === 'pending' ? 'A fila está em dia.' : 'Nenhum motorista aprovado ainda.'}</p>`; return; }
        target.innerHTML = `<table class="approval-table"><thead><tr><th>Motorista</th><th>Contato</th><th>Cadastro</th><th>Status</th><th>Ações</th></tr></thead><tbody>${list.map(item => { const status = statusOf(item); return `<tr><td>${renderPerson(item)}</td><td>${escapeHTML(displayPhone(item))}</td><td>${dateLabel(item.created_at || item.submitted_at)}</td><td><span class="status-badge ${status}">${status === 'approved' ? 'Aprovado' : 'Pendente'}</span></td><td><div class="table-actions">${status === 'pending' ? `<button class="icon-btn approve" data-action="approve" data-id="${escapeHTML(item.id)}" aria-label="Aprovar motorista" title="Aprovar motorista"><i class="fas fa-check"></i></button><button class="icon-btn reject" data-action="reject" data-id="${escapeHTML(item.id)}" aria-label="Recusar motorista" title="Recusar motorista"><i class="fas fa-xmark"></i></button>` : '<span class="status-badge approved"><i class="fas fa-check"></i></span>'}</div></td></tr>`; }).join('')}</tbody></table>`;
    };
    const renderDrivers = () => {
        const target = document.getElementById('drivers-container');
        const list = applications.filter(item => ['approved', 'pending'].includes(statusOf(item)));
        target.innerHTML = list.length ? list.map(item => `<article class="driver-card">${renderPerson(item)}<div class="driver-detail"><i class="fas fa-phone"></i>${escapeHTML(displayPhone(item))}</div><span class="status-badge ${statusOf(item)}">${statusOf(item) === 'approved' ? 'Aprovado' : 'Em análise'}</span></article>`).join('') : '<p class="empty-state">Nenhum motorista cadastrado.</p>';
    };

    const updateApplicationStatus = async (id, status) => {
        const { error } = await supabaseClient.from(APPLICATIONS_TABLE).update({ status }).eq('id', id);
        if (error) { showGlobal(`Não foi possível atualizar a solicitação: ${error.message}`, 'error'); return; }
        showGlobal(status === 'approved' ? 'Motorista aprovado com sucesso.' : 'Solicitação recusada.'); await loadApplications();
    };

    const loadPosts = async () => {
        ui.posts.innerHTML = '<p class="loading-state">Carregando comunicados...</p>';
        try {
            const { data, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setMetric('metric-posts', data?.length || 0);
            ui.posts.innerHTML = data?.length ? data.map(item => `<article class="post-item"><div><strong>${escapeHTML(item.title)}</strong><small><i class="fas ${item.type === 'promo' ? 'fa-tag' : 'fa-bullhorn'}"></i> ${item.type === 'promo' ? 'Promoção' : 'Aviso'} ${item.image_url ? '· Com imagem' : ''}</small></div><button class="delete-btn" data-post-id="${escapeHTML(item.id)}"><i class="fas fa-trash"></i> Remover</button></article>`).join('') : '<p class="empty-state">Nenhum comunicado publicado.</p>';
        } catch (error) { ui.posts.innerHTML = '<p class="empty-state">Não foi possível carregar os comunicados.</p>'; setMetric('metric-posts', '--'); }
    };

    const addPost = async (event) => {
        event.preventDefault(); const type = document.getElementById('post-type').value; const title = document.getElementById('post-title').value.trim(); const content = document.getElementById('post-content').value.trim(); const imageInput = document.getElementById('post-image'); const button = document.getElementById('btn-add-post');
        if (!title || !content) return showFeedback(document.getElementById('post-feedback'), 'Preencha título e mensagem.', 'error');
        button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
        try {
            let imageUrl = null;
            if (imageInput.files.length) { const file = imageInput.files[0]; const path = `public/${crypto.randomUUID()}.${file.name.split('.').pop()}`; const upload = await supabaseClient.storage.from('post-images').upload(path, file); if (upload.error) throw upload.error; imageUrl = supabaseClient.storage.from('post-images').getPublicUrl(path).data.publicUrl; }
            const { error } = await supabaseClient.from('posts').insert([{ type, title, content, image_url: imageUrl }]); if (error) throw error;
            ui.adminForm.reset(); showFeedback(document.getElementById('post-feedback'), 'Comunicado publicado.'); await loadPosts();
        } catch (error) { showFeedback(document.getElementById('post-feedback'), error.message, 'error'); } finally { button.disabled = false; button.innerHTML = '<i class="fas fa-plus"></i> Publicar comunicado'; }
    };

    const changePassword = async (event) => { event.preventDefault(); const password = document.getElementById('new-password').value; const confirmPassword = document.getElementById('confirm-password').value; if (password.length < 6) return showFeedback(ui.passwordFeedback, 'A senha precisa ter pelo menos 6 caracteres.', 'error'); if (password !== confirmPassword) return showFeedback(ui.passwordFeedback, 'As senhas não coincidem.', 'error'); const { error } = await supabaseClient.auth.updateUser({ password }); if (error) return showFeedback(ui.passwordFeedback, error.message, 'error'); ui.passwordForm.reset(); showFeedback(ui.passwordFeedback, 'Senha atualizada com sucesso.'); };
    const handleLogin = async (event) => { event.preventDefault(); const button = ui.loginForm.querySelector('button[type="submit"]'); button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...'; const { error } = await supabaseClient.auth.signInWithPassword({ email: ui.email.value.trim(), password: ui.loginPassword.value }); if (error) showFeedback(ui.loginFeedback, 'E-mail ou senha inválidos.', 'error'); else { ui.loginForm.reset(); toggleContainers(true); } button.disabled = false; button.innerHTML = '<i class="fas fa-arrow-right"></i> Entrar no painel'; };
    const resetPassword = async (event) => { event.preventDefault(); if (!ui.email.value.trim()) return showFeedback(ui.loginFeedback, 'Digite seu e-mail corporativo.', 'error'); const { error } = await supabaseClient.auth.resetPasswordForEmail(ui.email.value.trim(), { redirectTo: `${window.location.origin}/admin.html` }); showFeedback(ui.loginFeedback, error ? 'Não foi possível enviar o e-mail.' : 'Instruções enviadas para seu e-mail.', error ? 'error' : 'success'); };
    const loadDashboard = async () => { await Promise.all([loadApplications(), loadPosts()]); };

    const activateView = (view) => { document.querySelectorAll('.view').forEach(item => item.classList.remove('active-view')); document.getElementById(`view-${view}`)?.classList.add('active-view'); document.querySelectorAll('.side-link').forEach(item => item.classList.toggle('active', item.dataset.view === view)); const title = document.querySelector(`[data-view="${view}"] span`)?.textContent || 'Visão geral'; document.getElementById('dashboard-title').textContent = title; document.querySelector('.sidebar')?.classList.remove('open'); };

    document.addEventListener('DOMContentLoaded', async () => {
        const { data: { session } } = await supabaseClient.auth.getSession(); toggleContainers(!!session);
        ui.loginForm.addEventListener('submit', handleLogin); ui.adminForm.addEventListener('submit', addPost); ui.passwordForm.addEventListener('submit', changePassword); document.getElementById('forgot-password').addEventListener('click', resetPassword);
        document.getElementById('togglePassword').addEventListener('click', () => { const input = ui.loginPassword; input.type = input.type === 'password' ? 'text' : 'password'; document.querySelector('#togglePassword i').classList.toggle('fa-eye-slash'); });
        document.getElementById('btn-logout').addEventListener('click', async () => { await supabaseClient.auth.signOut(); toggleContainers(false); }); document.getElementById('mobile-menu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
        document.querySelectorAll('[data-view]').forEach(item => item.addEventListener('click', event => { if (item.tagName === 'A') event.preventDefault(); activateView(item.dataset.view); }));
        document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => { activeStatus = tab.dataset.status; document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab)); renderApprovals(); }));
        document.getElementById('refresh-approvals').addEventListener('click', loadApplications);
        document.addEventListener('click', event => { const action = event.target.closest('[data-action]'); if (action) updateApplicationStatus(action.dataset.id, action.dataset.action === 'approve' ? 'approved' : 'rejected'); const deleteButton = event.target.closest('[data-post-id]'); if (deleteButton && confirm('Remover este comunicado?')) supabaseClient.from('posts').delete().eq('id', deleteButton.dataset.postId).then(loadPosts); });
    });
})();
