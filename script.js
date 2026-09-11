(() => {
  const SUPABASE_URL = "https://lvdplhnbkkmlcxeuqhdo.supabase.co";
  const SUPABASE_KEY = "sb_publishable_CoC8vHLwAQ3kGsXwWBlaoA_4LB5SzsK";

  const escapeHTML = (value) => {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  };

  const dateLabel = (value) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const navToggle = document.getElementById("nav-toggle");
    const navLinks = document.getElementById("nav-links");
    const postsContainer = document.getElementById("posts-feed");
    const modal = document.getElementById("promo-modal");
    const closeModal = document.getElementById("close-modal");

    // Observer para animações de reveal
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -35px 0px" }
    );

    // Alternância de tema claro/escuro
    const themeToggle = document.getElementById("theme-toggle");
    const themeIcon = themeToggle?.querySelector("i");
    const setTheme = (dark) => {
      document.body.classList.toggle("dark-mode", dark);
      themeIcon?.classList.toggle("fa-moon", !dark);
      themeIcon?.classList.toggle("fa-sun", dark);
      themeToggle?.setAttribute(
        "aria-label",
        dark ? "Ativar modo claro" : "Ativar modo escuro"
      );
    };

    const savedTheme = localStorage.getItem("sr-theme");
    if (savedTheme !== null) {
      setTheme(savedTheme === "dark");
    } else {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark);
    }

    themeToggle?.addEventListener("click", () => {
      const isDark = !document.body.classList.contains("dark-mode");
      setTheme(isDark);
      localStorage.setItem("sr-theme", isDark ? "dark" : "light");
    });

    // Menu Mobile
    navToggle?.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.querySelector("i").classList.toggle("fa-bars", !open);
      navToggle.querySelector("i").classList.toggle("fa-xmark", open);
    });

    navLinks?.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle?.setAttribute("aria-expanded", "false");
        navToggle?.querySelector("i")?.classList.replace("fa-xmark", "fa-bars");
      });
    });

    document
      .querySelectorAll(".reveal")
      .forEach((element) => revealObserver.observe(element));

    // Efeito de movimento 3D e luz interativa nos cards
    const applyCardEffects = (cards) => {
      cards.forEach((card) => {
        card.addEventListener("mousemove", (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty("--mouse-x", `${x}px`);
          card.style.setProperty("--mouse-y", `${y}px`);

          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -4;
          const rotateY = ((x - centerX) / centerX) * 4;
          card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-10px) scale(1.015)`;
        });

        card.addEventListener("mouseleave", () => {
          card.style.transform = "";
        });
      });
    };

    applyCardEffects(document.querySelectorAll(".solution-card"));

    // Modal de Anúncio / Promoção
    const closeAnnouncement = () => {
      modal?.classList.add("hidden");
      if (modal) {
        localStorage.setItem("sr_modal_closed_time", String(Date.now()));
      }
    };

    closeModal?.addEventListener("click", closeAnnouncement);
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) closeAnnouncement();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAnnouncement();
    });

    // Carregamento de Comunicados do Supabase
    if (!window.supabase || !postsContainer) return;
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
      const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!posts?.length) {
        postsContainer.innerHTML =
          '<p class="loading-text">Nenhuma atualização no momento.</p>';
        return;
      }

      postsContainer.innerHTML = posts
        .map((post) => {
          const promo = post.type === "promo";
          return `
            <article class="post-card ${promo ? "promo-card" : ""} reveal active">
              <span class="post-badge">
                <i class="fas ${promo ? "fa-tag" : "fa-bullhorn"}"></i>
                ${promo ? "PROMOÇÃO" : "AVISO OPERACIONAL"}
              </span>
              <h3 class="post-title">${escapeHTML(post.title)}</h3>
              <p class="post-content">${escapeHTML(post.content)}</p>
              <small class="post-date">${dateLabel(post.created_at)}</small>
            </article>
          `;
        })
        .join("");

      applyCardEffects(postsContainer.querySelectorAll(".post-card"));

      const lastClosed = Number(
        localStorage.getItem("sr_modal_closed_time") || 0
      );
      if (Date.now() - lastClosed > 86400000 && modal) {
        const latest = posts[0];
        document.getElementById("modal-badge").textContent =
          latest.type === "promo" ? "PROMOÇÃO" : "AVISO OPERACIONAL";
        document.getElementById("modal-title").textContent = latest.title;
        document.getElementById("modal-text").textContent = latest.content;

        const image = document.getElementById("modal-image");
        if (latest.image_url) {
          image.src = latest.image_url;
          image.alt = latest.title;
          image.classList.remove("hidden");
        }
        modal.classList.remove("hidden");
      }
    } catch (error) {
      postsContainer.innerHTML =
        '<p class="loading-text">As atualizações estarão disponíveis em breve.</p>';
      console.error("Erro ao carregar atualizações:", error);
    }
  });
})();
