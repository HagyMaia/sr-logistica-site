(() => {
    // Credenciais Corrigidas
    const SUPABASE_URL = 'https://lvdplhnbkkmlcxeuqhdo.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_CoC8vHLwAQ3kGsXwWBlaoA_4LB5SzsK';

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ui = {
        loginContainer: document.getElementById('login-container'),
        dashboardContainer: document.getElementById('dashboard-container'),
        loginForm: document.getElementById('login-form'),
        adminForm: document.getElementById('admin-form'),
        postsContainer: document.getElementById('posts-container'),
        btnLogout: document.getElementById('btn-logout'),
        togglePasswordBtn: document.getElementById('togglePassword'),
        passwordInput: document.getElementById('admin-password'),
        emailInput: document.getElementById('admin-user'),
        forgotPasswordLink: document.getElementById('forgot-password'),
        loginFeedback: document.getElementById('login-feedback'),
        postFeedback: document.getElementById('post-feedback')
    };

    const showFeedback = (element, message, type) => {
        element.textContent = message;
        element.className = `feedback-msg ${type}`;
        setTimeout(() => { element.textContent = ''; element.className = 'feedback-msg'; }, 5000);
    };

    const toggleContainers = (isLoggedIn) => {
        if (isLoggedIn) {
            ui.loginContainer.classList.add('hidden');
            ui.dashboardContainer.classList.remove('hidden');
            loadPosts();
        } else {
            ui.loginContainer.classList.remove('hidden');
            ui.dashboardContainer.classList.add('hidden');
        }
    };

    const loadPosts = async () => {
        ui.postsContainer.innerHTML = '<p class="empty-state">Carregando postagens...</p>';
        try {
            const { data, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) {
                ui.postsContainer.innerHTML = '<p class="empty-state">Nenhuma postagem cadastrada ainda.</p>';
                return;
            }
            ui.postsContainer.innerHTML = data.map(item => `
                <article class="post-item">
                    <div><strong>[${item.type === 'promo' ? 'Promoção' : 'Aviso'}]</strong> <span>${escapeHTML(item.title)}</span></div>
                    <button class="delete-btn" data-id="${item.id}" aria-label="Remover postagem"><i class="fas fa-trash"></i> Remover</button>
                </article>
            `).join('');

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => deletePost(e.currentTarget.dataset.id));
            });
        } catch (error) {
            ui.postsContainer.innerHTML = `<p class="empty-state" style="color:var(--danger-color)">Erro ao carregar postagens.</p>`;
        }
    };

    const deletePost = async (id) => {
        if (!confirm('Tem certeza que deseja remover esta postagem?')) return;
        try {
            const { error } = await supabaseClient.from('posts').delete().eq('id', id);
            if (error) throw error;
            loadPosts();
        } catch (error) { alert('Erro ao remover: ' + error.message); }
    };

    const addPost = async (e) => {
        e.preventDefault();
        const type = document.getElementById('post-type').value;
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();

        if (!title || !content) return showFeedback(ui.postFeedback, 'Preencha todos os campos.', 'error');

        const btnAdd = document.getElementById('btn-add-post');
        btnAdd.disabled = true;
        btnAdd.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adicionando...';

        try {
            const { error } = await supabaseClient.from('posts').insert([{ type, title, content }]);
            if (error) throw error;
            ui.adminForm.reset();
            showFeedback(ui.postFeedback, 'Postagem adicionada com sucesso!', 'success');
            loadPosts();
        } catch (error) { showFeedback(ui.postFeedback, 'Erro ao adicionar postagem.', 'error'); }
        finally { btnAdd.disabled = false; btnAdd.innerHTML = '<i class="fas fa-plus"></i> Adicionar Postagem'; }
    };

    const escapeHTML = (str) => { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; };

    const checkSession = async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        toggleContainers(!!session);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const email = ui.emailInput.value.trim();
        const password = ui.passwordInput.value;

        if (!email || !password) return showFeedback(ui.loginFeedback, 'Preencha e-mail e senha.', 'error');

        const btnSubmit = ui.loginForm.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            ui.loginForm.reset();
            toggleContainers(true);
        } catch (error) { showFeedback(ui.loginFeedback, 'Credenciais inválidas.', 'error'); }
        finally { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar'; }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        const email = ui.emailInput.value.trim();
        if (!email) {
            showFeedback(ui.loginFeedback, 'Digite seu e-mail no campo acima.', 'error');
            ui.emailInput.focus();
            return;
        }
        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/admin.html' });
            if (error) throw error;
            showFeedback(ui.loginFeedback, 'Instruções enviadas para o seu e-mail!', 'success');
        } catch (error) { showFeedback(ui.loginFeedback, 'Erro ao solicitar redefinição.', 'error'); }
    };

    const handleLogout = async () => {
        await supabaseClient.auth.signOut();
        toggleContainers(false);
    };

    document.addEventListener('DOMContentLoaded', () => {
        checkSession();
        if (ui.togglePasswordBtn && ui.passwordInput) {
            ui.togglePasswordBtn.addEventListener('click', () => {
                const isPassword = ui.passwordInput.type === 'password';
                ui.passwordInput.type = isPassword ? 'text' : 'password';
                const icon = ui.togglePasswordBtn.querySelector('i');
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            });
        }
        ui.loginForm.addEventListener('submit', handleLogin);
        ui.adminForm.addEventListener('submit', addPost);
        ui.btnLogout.addEventListener('click', handleLogout);
        ui.forgotPasswordLink.addEventListener('click', handleResetPassword);
    });
})();