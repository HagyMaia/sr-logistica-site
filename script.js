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
    const renderInfo = () => {
        const container = document.getElementById('dynamic-content-container');
        if (!container) return;
        
        const infoData = JSON.parse(localStorage.getItem('sr_info_data')) || [];
        
        if (infoData.length === 0) {
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
    };
    renderInfo();

    // 3. Scroll Reveal Animation using Intersection Observer
    const reveals = document.querySelectorAll('.reveal');

    const revealOptions = {
        threshold: 0.15, // Trigger when 15% of the element is visible
        rootMargin: "0px 0px -50px 0px" 
    };

    const revealOnScroll = new IntersectionObserver(function(entries, observer) {
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
