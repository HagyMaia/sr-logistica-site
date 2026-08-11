document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('i');

    // Check local storage for theme preference
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');

        let theme = 'light';
        if (document.body.classList.contains('dark-mode')) {
            theme = 'dark';
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }

        localStorage.setItem('theme', theme);
    });

    // 2. Dynamic Info Rendering (App Prep)
    const renderInfo = async () => {
        const container = document.getElementById('dynamic-content-container');
        if (!container) return;

        if (SUPABASE_URL === 'SUA_SUPABASE_PROJECT_URL_AQUI') {
            container.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-muted);">Mural em configuração (Aguardando chaves do Supabase).</p>';
            return;
        }

        try {
            const { data: infoData, error } = await supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!infoData || infoData.length === 0) {
                container.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-muted);">Nenhuma novidade no momento.</p>';
                return;
            }

            container.innerHTML = infoData.map(item => `
                <div class="service-card reveal">
                    <div class="service-icon"><i class="fas ${item.type === 'promo' ? 'fa-tag' : 'fa-bullhorn'}"></i></div>
                    <h3>${item.title}</h3>
                    <p>${item.content}</p>
                </div>
            `).join('');

            // Re-aplica animação aos novos elementos
            const newReveals = container.querySelectorAll('.reveal');
            newReveals.forEach(reveal => revealOnScroll.observe(reveal));

        } catch (error) {
            console.error('Erro ao buscar do Supabase:', error);
            container.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-muted);">Erro ao carregar informações.</p>';
        }
    };
    renderInfo();

    // 3. Scroll Reveal Animation using Intersection Observer
    const reveals = document.querySelectorAll('.reveal');

    const revealOptions = {
        threshold: 0.15, // Trigger when 15% of the element is visible
        rootMargin: "0px 0px -50px 0px"
    };

    const revealOnScroll = new IntersectionObserver(function (entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return;
            } else {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Stop observing once revealed
            }
        });
    }, revealOptions);

    reveals.forEach(reveal => {
        revealOnScroll.observe(reveal);
    });
});