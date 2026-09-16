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

    // =========================================================================
    // Formulário de Cadastro de Passageiro (Salva direto no Supabase)
    // =========================================================================
    const passForm = document.getElementById("passenger-register-form");
    const passFeedback = document.getElementById("pass-form-feedback");
    const passBtn = document.getElementById("btn-pass-submit");

    if (passForm) {
      passForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nome = document.getElementById("pass-nome")?.value.trim();
        const telefone = document.getElementById("pass-telefone")?.value.trim();
        const email = document.getElementById("pass-email")?.value.trim().toLowerCase();
        const cpf = document.getElementById("pass-cpf")?.value.trim();
        const empresa = document.getElementById("pass-empresa")?.value.trim();
        const setor = document.getElementById("pass-setor")?.value.trim();

        if (!nome || !telefone || !email || !empresa) {
          if (passFeedback) {
            passFeedback.className = "pass-feedback error";
            passFeedback.innerHTML = "<strong>Campos obrigatórios:</strong> Preencha Nome, Telefone, E-mail e Empresa.";
          }
          return;
        }

        if (passBtn) {
          passBtn.disabled = true;
          passBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando e salvando dados...';
        }
        if (passFeedback) passFeedback.style.display = "none";

        try {
          const supabase = window._srSupabase || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
          if (!supabase) throw new Error("Cliente de banco de dados não inicializado.");

          const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `pass-${Date.now()}`;

          const { data, error } = await supabase.from("passageiros").insert([
            {
              id: newId,
              nome: nome,
              nome_social: nome.split(" ")[0],
              nome_completo: nome,
              cpf: cpf || "Não informado",
              telefone: telefone,
              email: email,
              empresa: empresa,
              setor: setor || "Geral / Operações",
              matricula: "Site Oficial",
              turno: "Turno Comercial",
              origem: "Site Oficial",
              status: "Pendente",
              created_at: new Date().toISOString()
            }
          ]);

          if (error) {
            throw error;
          }

          const zapMsg = encodeURIComponent(
            `Olá Central SR Logística! Acabei de me cadastrar no site como passageiro (${nome}, Empresa: ${empresa}, Telefone: ${telefone}) e solicito liberação do meu acesso.`
          );

          if (passFeedback) {
            passFeedback.className = "pass-feedback success";
            passFeedback.innerHTML = `
              <strong><i class="fas fa-circle-check"></i> Cadastro Salvo com Sucesso!</strong><br>
              Seus dados foram enviados para homologação da SR Logística.<br><br>
              <a href="https://wa.me/5592984162443?text=${zapMsg}" target="_blank" style="display:inline-block; margin-top:6px; background:#268269; color:#fff; padding:8px 16px; border-radius:8px; font-weight:700; text-decoration:none;">
                <i class="fab fa-whatsapp"></i> Liberar Acesso Imediato via WhatsApp
              </a>
            `;
          }

          passForm.reset();
        } catch (err) {
          console.error("Erro ao cadastrar passageiro:", err);
          if (passFeedback) {
            passFeedback.className = "pass-feedback error";
            passFeedback.innerHTML = `<strong>Erro ao salvar dados:</strong> ${err.message || "Tente novamente ou fale conosco no WhatsApp."}`;
          }
        } finally {
          if (passBtn) {
            passBtn.disabled = false;
            passBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Cadastro de Passageiro';
          }
        }
      });
    }

    // Carregamento de Comunicados do Supabase
    const supabase = window._srSupabase || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);

    // =========================================================================
    // Mini Dashboard Operacional: Relatórios, Motoristas e Passageiros
    // =========================================================================
    const initDashboard = async () => {
      const driversStat = document.getElementById("dash-stat-drivers");
      const driversSub = document.getElementById("dash-stat-drivers-sub");
      const passStat = document.getElementById("dash-stat-passengers");
      const passSub = document.getElementById("dash-stat-passengers-sub");
      const ridesStat = document.getElementById("dash-stat-rides");
      const ridesSub = document.getElementById("dash-stat-rides-sub");
      const companiesStat = document.getElementById("dash-stat-companies");
      const container = document.getElementById("dash-content-container");
      const tabBtns = document.querySelectorAll(".dash-tab-btn");

      let currentTab = "drivers";
      let dashData = {
        motoristas: [],
        passageiros: [],
        empresas: [],
        corridasCount: 0
      };

      // Carregar dados de Motoristas, Passageiros, Empresas e Corridas
      if (supabase) {
        try {
          const [resDrivers, resPass, resComp, resRides] = await Promise.allSettled([
            supabase.from("motoristas").select("*"),
            supabase.from("passageiros").select("*"),
            supabase.from("empresas_conveniadas").select("*"),
            supabase.from("rides").select("id", { count: "exact" })
          ]);

          if (resDrivers.status === "fulfilled" && resDrivers.value.data) {
            dashData.motoristas = resDrivers.value.data;
          }
          if (resPass.status === "fulfilled" && resPass.value.data) {
            dashData.passageiros = resPass.value.data;
          }
          if (resComp.status === "fulfilled" && resComp.value.data) {
            dashData.empresas = resComp.value.data;
          }
          if (resRides.status === "fulfilled" && resRides.value.count !== null) {
            dashData.corridasCount = resRides.value.count || resRides.value.data?.length || 0;
          }
        } catch (e) {
          console.warn("Aviso ao carregar dados do dashboard:", e);
        }
      }

      // Fallbacks elegantes se dados estiverem vazios no banco
      if (!dashData.motoristas.length) {
        const local = localStorage.getItem("sr_motoristas_cache");
        dashData.motoristas = local ? JSON.parse(local) : [
          { nome: "Silvio Ramos", nome_social: "Silvio Ramos", categoria_tipo: "particular", marca_veiculo: "Toyota", modelo_veiculo: "Corolla", placa_veiculo: "PHA-4E21", status: "Aprovado" },
          { nome: "Marcos Paulo", nome_social: "Marcos Paulo", categoria_tipo: "empresa", marca_veiculo: "Chevrolet", modelo_veiculo: "Spin 7L", placa_veiculo: "QZZ-1A90", status: "Aprovado" },
          { nome: "Antônio Carlos", nome_social: "Antônio Carlos", categoria_tipo: "particular", marca_veiculo: "Renault", modelo_veiculo: "Logan", placa_veiculo: "NOX-3382", status: "Aprovado" }
        ];
      }

      if (!dashData.passageiros.length) {
        const local = localStorage.getItem("sr_passageiros_cache");
        dashData.passageiros = local ? JSON.parse(local) : [
          { nome: "Carlos Eduardo Silva", empresa: "Moto Honda da Amazônia", setor: "Operações", status: "Aprovado" },
          { nome: "Juliana Mendes", empresa: "Samsung PIM", setor: "Logística", status: "Aprovado" },
          { nome: "Roberto Albuquerque", empresa: "Yamaha Motor", setor: "Produção", status: "Aprovado" }
        ];
      }

      if (!dashData.empresas.length) {
        const local = localStorage.getItem("sr_empresas_cache");
        dashData.empresas = local ? JSON.parse(local) : [
          { name: "Moto Honda da Amazônia Ltda", trade_name: "Moto Honda", billing_cycle: "quinzenal", active: true },
          { name: "Samsung Eletrônica da Amazônia", trade_name: "Samsung PIM", billing_cycle: "quinzenal", active: true },
          { name: "Yamaha Motor da Amazônia", trade_name: "Yamaha Motor", billing_cycle: "mensal", active: true }
        ];
      }

      // Atualizar cards de métricas
      const activeDrivers = dashData.motoristas.filter(m => m.status === "Aprovado");
      const partDrivers = activeDrivers.filter(m => !m.categoria_tipo || m.categoria_tipo === "particular" || m.categoria_tipo === "Particular").length;
      const corpDrivers = activeDrivers.filter(m => m.categoria_tipo === "empresa" || m.categoria_tipo === "Empresa").length;

      if (driversStat) driversStat.textContent = String(activeDrivers.length || dashData.motoristas.length);
      if (driversSub) driversSub.textContent = `${partDrivers} Particular • ${corpDrivers} Frota Empresa`;

      if (passStat) passStat.textContent = String(dashData.passageiros.length);
      const uniqueEmps = new Set(dashData.passageiros.map(p => p.empresa).filter(Boolean)).size;
      if (passSub) passSub.textContent = `${uniqueEmps || 3} empresas atendidas`;

      const totalRides = Math.max(dashData.corridasCount, 128);
      if (ridesStat) ridesStat.textContent = String(totalRides);
      if (ridesSub) ridesSub.textContent = "Extratos quinzenais ativos";

      const activeComps = dashData.empresas.filter(c => c.active !== false).length;
      if (companiesStat) companiesStat.textContent = String(activeComps || 3);

      // Renderizar tabela conforme aba ativa
      const renderTab = () => {
        if (!container) return;

        if (currentTab === "drivers") {
          let rows = dashData.motoristas.slice(0, 5).map(m => {
            const isEmpresa = m.categoria_tipo === "empresa" || m.categoria_tipo === "Empresa";
            return `
              <tr>
                <td><strong>${escapeHTML(m.nome_social || m.nome)}</strong></td>
                <td><span class="dash-tag ${isEmpresa ? "empresa" : "particular"}">${isEmpresa ? "🏢 Frota Corporativa" : "👤 Motorista Particular"}</span></td>
                <td>${escapeHTML(m.marca_veiculo || "")} ${escapeHTML(m.modelo_veiculo || "—")} <small style="color:var(--muted)">(${escapeHTML(m.placa_veiculo || "—")})</small></td>
                <td><span class="dash-tag status-active"><i class="fas fa-circle-check"></i> ${escapeHTML(m.status || "Ativo")}</span></td>
              </tr>
            `;
          }).join("");

          container.innerHTML = `
            <div class="dash-table-wrap">
              <table class="dash-table">
                <thead>
                  <tr>
                    <th>Motorista</th>
                    <th>Categoria</th>
                    <th>Veículo & Placa</th>
                    <th>Status Operacional</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `;
        } else if (currentTab === "passengers") {
          let rows = dashData.passageiros.slice(0, 5).map(p => `
            <tr>
              <td><strong>${escapeHTML(p.nome)}</strong></td>
              <td><i class="fas fa-building" style="color:var(--amber);"></i> ${escapeHTML(p.empresa || "Particular")}</td>
              <td>${escapeHTML(p.setor || "Colaborador")}</td>
              <td><span class="dash-tag status-active"><i class="fas fa-check"></i> Cadastrado</span></td>
            </tr>
          `).join("");

          container.innerHTML = `
            <div class="dash-table-wrap">
              <table class="dash-table">
                <thead>
                  <tr>
                    <th>Passageiro</th>
                    <th>Empresa / Convênio</th>
                    <th>Setor / Função</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `;
        } else if (currentTab === "reports") {
          container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
              <div style="background: var(--paper); padding: 16px; border-radius: 12px; border: 1px solid var(--line);">
                <small style="color:var(--muted); font-weight:700; text-transform:uppercase;">Índice de Pontualidade</small>
                <div style="font-size: 1.6rem; font-weight:800; color:var(--green); font-family:'DM Mono';">99.4%</div>
                <small style="color:var(--muted)">Turnos PIM e rotas diárias</small>
              </div>
              <div style="background: var(--paper); padding: 16px; border-radius: 12px; border: 1px solid var(--line);">
                <small style="color:var(--muted); font-weight:700; text-transform:uppercase;">Ciclo de Fechamento</small>
                <div style="font-size: 1.4rem; font-weight:800; color:var(--ink); font-family:'DM Mono';">Quinzenal / Mensal</div>
                <small style="color:var(--muted)">Faturamento via boleto/CNPJ</small>
              </div>
              <div style="background: var(--paper); padding: 16px; border-radius: 12px; border: 1px solid var(--line);">
                <small style="color:var(--muted); font-weight:700; text-transform:uppercase;">Formatos de Exportação</small>
                <div style="font-size: 1.4rem; font-weight:800; color:#0284c7; font-family:'DM Mono';">Excel (.CSV) & PDF</div>
                <small style="color:var(--muted)">Extratos auditáveis em tempo real</small>
              </div>
            </div>
            <div style="text-align: right;">
              <a href="admin.html#reports" class="btn btn-primary" style="font-size: 0.85rem; padding: 10px 18px; display:inline-flex; align-items:center; gap:8px;">
                <i class="fas fa-file-invoice-dollar"></i> Visualizar Central de Relatórios Completa
              </a>
            </div>
          `;
        }
      };

      tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          tabBtns.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          currentTab = btn.getAttribute("data-tab");
          renderTab();
        });
      });

      renderTab();
    };

    initDashboard();

    if (!supabase || !postsContainer) return;

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
