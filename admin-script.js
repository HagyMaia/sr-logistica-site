/**
 * SR Logística & Transporte - Painel Admin
 * Gerenciamento completo de Motoristas, Passageiros e Comunicados
 */

// 1. OBTENÇÃO SEGURA DO CLIENTE SUPABASE
const SUPABASE_URL = window.SUPABASE_URL || "https://lvdplhnbkkmlcxeuqhdo.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_KEY || "sb_publishable_CoC8vHLwAQ3kGsXwWBlaoA_4LB5SzsK";

const supabaseClient =
  window.supabaseClient ||
  window._srSupabase ||
  (typeof window !== "undefined" && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
      })
    : null);

if (supabaseClient && typeof window !== "undefined") {
  window.supabaseClient = supabaseClient;
  window._srSupabase = supabaseClient;
}

// Estado Global
let currentView = "overview";
let currentDriverTab = "pending";
let currentPassengerTab = "pending";
let currentAlterationTab = "pending";
let passengerSearchQuery = "";
let passengerCompanyFilter = "";
let passengerBaseSearchQuery = "";
let alterationSearchQuery = "";
let alterationUserTypeFilter = "all";

let motoristasCache = [];
let passageirosCache = [];
let solicitacoesCache = [];
let empresasCache = [];
let postsCache = [];
let corridasCache = [];

// Filtros de Empresas Conveniadas
let companySearchQuery = "";
let companyStatusFilter = "all";

// Estado do Relatório de Corridas e Faturamento
let currentReportPeriod = "CURRENT_MONTH";
let currentReportPassenger = "ALL";
let currentReportStatus = "COMPLETED";
let customReportStart = "";
let customReportEnd = "";

// Monitor de mudança de autenticação em tempo real
if (supabaseClient && supabaseClient.auth) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      updateAdminUserUI(session.user);
      showDashboard();
    } else if (event === "SIGNED_OUT") {
      showLogin();
    }
  });
}

// Sincronização em tempo real via Supabase Realtime
function setupRealtimeSubscriptions() {
  if (!supabaseClient || typeof supabaseClient.channel !== "function") return;
  try {
    supabaseClient
      .channel("admin-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "passageiros" },
        () => {
          loadPassageiros();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          loadPassageiros();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "motoristas" },
        () => {
          loadMotoristas();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes_alteracao" },
        () => {
          loadSolicitacoes();
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("Aviso ao inicializar Realtime sync:", err);
  }
}

// Inicialização ao carregar o DOM
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupLoginForm();
  setupSecurityForm();
  setupPostsForm();
  setupDriverModal();
  setupPassengerModal();
  setupPassengerFilters();
  setupCompanyModal();
  setupCompanyFilters();
  setupReportsView();
  setupPhotoModal();
  setupAlterationFilters();
  setupAlterationSimModal();
  setupAlterationRejectModal();
  setupRealtimeSubscriptions();
  checkSession();
});

// --- GESTÃO E INSPEÇÃO DE FOTOS DE PERFIL (AVATARES) ---
let currentPhotoInspection = {
  id: null,
  type: null, // 'passenger' | 'driver'
  url: null,
  name: null,
  status: "Pendente"
};

function getAvatarUrl(item) {
  if (!item) return null;
  const url = (
    item.foto_url ||
    item.avatar_url ||
    item.avatar ||
    item.foto ||
    (item.user_metadata && (item.user_metadata.avatar_url || item.user_metadata.avatar || item.user_metadata.foto_url || item.user_metadata.picture)) ||
    null
  );
  if (typeof url === "string" && url.trim().length > 5) {
    return url.trim();
  }
  return null;
}

function renderAvatarHTML(item, type = "passenger") {
  const photoUrl = getAvatarUrl(item);
  const name =
    item.nome_social ||
    item.nome ||
    item.name ||
    (type === "driver" ? "Motorista" : "Passageiro");
  const initial = (name || "U").charAt(0).toUpperCase();
  const isDriver = type === "driver";
  const roleLabel = isDriver
    ? `Motorista (${item.categoria_tipo === "empresa" || item.categoria === "Empresa" ? "Frota Empresa" : "Particular"})`
    : `Passageiro (${item.empresa || "SR Convênio"})`;
  const photoStatus = item.foto_status || (photoUrl ? "Aprovada" : "Pendente");
  const itemId = item.id || "";

  // Escapar para uso em atributos inline onclick
  const safeName = String(name).replace(/'/g, "\\'");
  const safeRole = String(roleLabel).replace(/'/g, "\\'");
  const safeUrl = photoUrl ? String(photoUrl).replace(/'/g, "\\'") : "";
  const safeStatus = String(photoStatus).replace(/'/g, "\\'");

  if (photoUrl) {
    return `
      <div class="user-avatar-cell" onclick="openPhotoPreview('${itemId}', '${type}', '${safeName}', '${safeRole}', '${safeUrl}', '${safeStatus}')" title="Clique para inspecionar foto de perfil ampliada">
        <img src="${escapeHtml(photoUrl)}" class="avatar-img-thumb ${isDriver ? 'driver' : ''}" alt="${escapeHtml(name)}" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
        <div class="avatar-initials-thumb ${isDriver ? 'driver' : ''} hidden">${initial}</div>
        <div class="avatar-zoom-badge"><i class="fas fa-magnifying-glass"></i></div>
      </div>
    `;
  }

  return `
    <div class="user-avatar-cell" onclick="openPhotoPreview('${itemId}', '${type}', '${safeName}', '${safeRole}', '', '${safeStatus}')" title="Perfil sem foto carregada (iniciais)">
      <div class="avatar-initials-thumb ${isDriver ? 'driver' : ''}">${initial}</div>
      <div class="avatar-zoom-badge"><i class="fas fa-user"></i></div>
    </div>
  `;
}

window.openPhotoPreview = function (id, type, name, role, photoUrl, photoStatus) {
  const modal = document.getElementById("photo-preview-modal");
  if (!modal) return;

  currentPhotoInspection = {
    id: id,
    type: type,
    url: photoUrl || "",
    name: name || "Usuário",
    status: photoStatus || "Pendente"
  };

  const nameEl = document.getElementById("photo-preview-name");
  const roleEl = document.getElementById("photo-preview-role");
  const imgEl = document.getElementById("photo-preview-img");
  const placeholderEl = document.getElementById("photo-preview-placeholder");
  const statusBadge = document.getElementById("photo-preview-status-badge");

  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = role;

  if (photoUrl && photoUrl.trim() !== "") {
    if (imgEl) {
      imgEl.src = photoUrl;
      imgEl.classList.remove("hidden");
    }
    if (placeholderEl) placeholderEl.classList.add("hidden");
  } else {
    if (imgEl) imgEl.classList.add("hidden");
    if (placeholderEl) {
      placeholderEl.textContent = (name || "U").charAt(0).toUpperCase();
      placeholderEl.classList.remove("hidden");
    }
  }

  if (statusBadge) {
    const isApproved = photoStatus === "Aprovada";
    const isRejected = photoStatus === "Rejeitada";
    statusBadge.innerHTML = `
      <span class="photo-status-badge ${isApproved ? 'approved' : isRejected ? 'rejected' : 'pending'}">
        <i class="fas ${isApproved ? 'fa-check-circle' : isRejected ? 'fa-circle-xmark' : 'fa-clock'}"></i>
        ${isApproved ? 'Foto Homologada' : isRejected ? 'Foto Reprovada' : 'Foto em Análise / Aguardando Aprovação'}
      </span>
    `;
  }

  modal.classList.remove("hidden");
};

function setupPhotoModal() {
  const modal = document.getElementById("photo-preview-modal");
  const closeBtn = document.getElementById("close-photo-modal");
  const closeViewBtn = document.getElementById("btn-close-photo-view");
  const approveBtn = document.getElementById("btn-approve-photo");
  const rejectBtn = document.getElementById("btn-reject-photo");

  const closeModal = () => {
    if (modal) modal.classList.add("hidden");
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (closeViewBtn) closeViewBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (approveBtn) {
    approveBtn.addEventListener("click", async () => {
      if (!currentPhotoInspection.id) return;
      const { id, type } = currentPhotoInspection;
      try {
        if (type === "passenger") {
          const p = passageirosCache.find((item) => String(item.id) === String(id));
          if (p) {
            p.foto_status = "Aprovada";
            p.updated_at = new Date().toISOString();
          }
          localStorage.setItem("sr_passageiros_cache", JSON.stringify(passageirosCache));
          if (supabaseClient) {
            try {
              await supabaseClient
                .from("passageiros")
                .update({ foto_status: "Aprovada", updated_at: new Date().toISOString() })
                .eq("id", id);
            } catch (_) {}
            try {
              await supabaseClient
                .from("profiles")
                .update({ foto_status: "Aprovada", photo_status: "approved", updated_at: new Date().toISOString() })
                .eq("id", id);
            } catch (_) {}
          }
          renderOverviewApprovals();
          renderPassengerApprovals();
          renderPassengersBase();
        } else {
          const m = motoristasCache.find((item) => String(item.id) === String(id));
          if (m) {
            m.foto_status = "Aprovada";
            m.updated_at = new Date().toISOString();
          }
          localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
          if (supabaseClient) {
            await supabaseClient
              .from("motoristas")
              .update({ foto_status: "Aprovada", updated_at: new Date().toISOString() })
              .eq("id", id);
          }
          renderOverviewApprovals();
          renderApprovals();
          renderDrivers();
        }
        showNotification("Foto de perfil homologada com sucesso!", "success");
        closeModal();
      } catch (err) {
        showNotification("Erro ao homologar foto: " + err.message, "error");
      }
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener("click", async () => {
      if (!currentPhotoInspection.id) return;
      const { id, type } = currentPhotoInspection;
      const reason = prompt(
        "Informe o motivo da recusa da foto para o usuário:",
        "Foto fora do enquadramento ou ilegível. Por favor, reenvie uma foto nítida e centralizada do rosto."
      );
      if (reason === null) return;

      try {
        if (type === "passenger") {
          const p = passageirosCache.find((item) => String(item.id) === String(id));
          if (p) {
            p.foto_status = "Rejeitada";
            p.motivo_rejeicao = reason;
            p.updated_at = new Date().toISOString();
          }
          localStorage.setItem("sr_passageiros_cache", JSON.stringify(passageirosCache));
          if (supabaseClient) {
            try {
              await supabaseClient
                .from("passageiros")
                .update({ foto_status: "Rejeitada", motivo_rejeicao: reason, updated_at: new Date().toISOString() })
                .eq("id", id);
            } catch (_) {}
            try {
              await supabaseClient
                .from("profiles")
                .update({
                  foto_status: "Rejeitada",
                  photo_status: "rejected",
                  motivo_rejeicao: reason,
                  rejection_reason: reason,
                  updated_at: new Date().toISOString()
                })
                .eq("id", id);
            } catch (_) {}
          }
          renderOverviewApprovals();
          renderPassengerApprovals();
          renderPassengersBase();
        } else {
          const m = motoristasCache.find((item) => String(item.id) === String(id));
          if (m) {
            m.foto_status = "Rejeitada";
            m.motivo_rejeicao = reason;
            m.updated_at = new Date().toISOString();
          }
          localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
          if (supabaseClient) {
            await supabaseClient
              .from("motoristas")
              .update({ foto_status: "Rejeitada", motivo_rejeicao: reason, updated_at: new Date().toISOString() })
              .eq("id", id);
          }
          renderOverviewApprovals();
          renderApprovals();
          renderDrivers();
        }
        showNotification("Foto de perfil reprovada.", "warning");
        closeModal();
      } catch (err) {
        showNotification("Erro ao reprovar foto: " + err.message, "error");
      }
    });
  }
}

// --- AUTENTICAÇÃO ---
async function checkSession() {
  if (!supabaseClient || !supabaseClient.auth) {
    showLogin();
    return;
  }
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.warn("Aviso ao recuperar sessão:", error.message);
      showLogin();
      return;
    }
    if (data && data.session) {
      updateAdminUserUI(data.session.user);
      showDashboard();
    } else {
      showLogin();
    }
  } catch (err) {
    console.warn("Exceção na checagem de sessão:", err);
    showLogin();
  }
}

function updateAdminUserUI(user) {
  if (!user) return;
  const avatarElem = document.getElementById("admin-avatar");
  if (avatarElem) {
    const emailPrefix = (user.email || "SR").split("@")[0];
    avatarElem.textContent = emailPrefix.slice(0, 2).toUpperCase();
    avatarElem.title = user.email || "Administrador";
  }
}

function showLogin() {
  const login = document.getElementById("login-container");
  const dash = document.getElementById("dashboard-container");
  if (login) login.classList.remove("hidden");
  if (dash) dash.classList.add("hidden");
}

let isDataLoaded = false;
function showDashboard() {
  const login = document.getElementById("login-container");
  const dash = document.getElementById("dashboard-container");
  if (login) login.classList.add("hidden");
  if (dash) dash.classList.remove("hidden");

  const hash = (window.location.hash || "").replace("#", "");
  if (hash && document.getElementById("view-" + hash)) {
    switchView(hash);
  }

  if (!isDataLoaded) {
    isDataLoaded = true;
    loadAllData();
  }
}

function setupLoginForm() {
  const loginForm = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  const togglePass = document.getElementById("togglePassword");
  const passInput = document.getElementById("admin-password");
  const forgotPass = document.getElementById("forgot-password");

  if (togglePass && passInput) {
    togglePass.addEventListener("click", () => {
      const isPass = passInput.getAttribute("type") === "password";
      passInput.setAttribute("type", isPass ? "text" : "password");
      togglePass.innerHTML =
        '<i class="fas fa-' + (isPass ? "eye-slash" : "eye") + '"></i>';
    });
  }

  if (forgotPass) {
    forgotPass.addEventListener("click", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("admin-user");
      let email = emailInput ? emailInput.value.trim() : "";
      if (!email) {
        email = prompt("Digite seu e-mail corporativo para redefinir a senha:");
        if (!email) return;
      }
      try {
        if (feedback) {
          feedback.textContent = "Enviando e-mail de redefinição...";
          feedback.className = "feedback-msg info";
        }
        if (!supabaseClient || !supabaseClient.auth) {
          throw new Error("Cliente de autenticação não inicializado.");
        }
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
        if (error) throw error;
        if (feedback) {
          feedback.textContent = "Link de redefinição enviado para " + email + ". Verifique sua caixa de entrada.";
          feedback.className = "feedback-msg success";
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = "Erro ao solicitar redefinição: " + (err.message || "Tente novamente.");
          feedback.className = "feedback-msg error";
        }
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("admin-user");
      const email = emailInput ? emailInput.value.trim() : "";
      const password = passInput ? passInput.value : "";
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      if (!email || !password) {
        if (feedback) {
          feedback.textContent = "Preencha o e-mail e a senha.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      if (!supabaseClient || !supabaseClient.auth) {
        if (feedback) {
          feedback.textContent = "Erro de conexão com o Supabase. Tente recarregar a página.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
      }

      if (feedback) {
        feedback.textContent = "Verificando credenciais...";
        feedback.className = "feedback-msg info";
      }

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
        if (feedback) {
          feedback.textContent = "";
          feedback.className = "feedback-msg";
        }
        if (data && data.session) {
          updateAdminUserUI(data.session.user);
        }
        showDashboard();
      } catch (err) {
        console.error("Erro no login:", err);
        if (feedback) {
          const msg = err.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : (err.message || "Credenciais inválidas.");
          feedback.textContent = msg;
          feedback.className = "feedback-msg error";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
        }
      }
    });
  }

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        if (supabaseClient && supabaseClient.auth) {
          await supabaseClient.auth.signOut();
        }
      } catch (err) {
        console.warn("Erro ao deslogar:", err);
      }
      isDataLoaded = false;
      showLogin();
    });
  }
}

// --- NAVEGAÇÃO E VIEWS ---
function setupNavigation() {
  const sideLinks = document.querySelectorAll(
    ".side-link, .quick-action, a[data-view]",
  );
  sideLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const view = link.getAttribute("data-view");
      if (view) {
        e.preventDefault();
        switchView(view);
      }
    });
  });

  // Tabs de Motoristas
  const driverTabs = document.querySelectorAll(".tabs .tab[data-status]");
  driverTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      driverTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentDriverTab = tab.getAttribute("data-status") || "pending";
      renderApprovals();
    });
  });

  // Tabs de Passageiros
  const passengerTabs = document.querySelectorAll(
    ".tabs .tab[data-passenger-tab]",
  );
  passengerTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      passengerTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentPassengerTab = tab.getAttribute("data-passenger-tab") || "pending";
      renderPassengerApprovals();
    });
  });

  // Tabs de Alterações Cadastrais (NOVO)
  const alterationTabs = document.querySelectorAll(
    ".tabs .tab[data-alteration-tab]",
  );
  alterationTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      alterationTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentAlterationTab = tab.getAttribute("data-alteration-tab") || "pending";
      renderSolicitacoes();
    });
  });

  // Botões de atualização manual
  const btnRefreshAlterations = document.getElementById("refresh-alterations");
  if (btnRefreshAlterations) {
    btnRefreshAlterations.addEventListener("click", () => loadSolicitacoes());
  }

  const btnRefreshDrivers = document.getElementById("refresh-approvals");
  if (btnRefreshDrivers) {
    btnRefreshDrivers.addEventListener("click", () => loadMotoristas());
  }

  const btnRefreshDriversList = document.getElementById("refresh-drivers-list");
  if (btnRefreshDriversList) {
    btnRefreshDriversList.addEventListener("click", () => loadMotoristas());
  }

  const btnRefreshPassengers = document.getElementById(
    "refresh-passenger-approvals",
  );
  if (btnRefreshPassengers) {
    btnRefreshPassengers.addEventListener("click", () => loadPassageiros());
  }

  const btnRefreshPassList = document.getElementById("refresh-passengers-list");
  if (btnRefreshPassList) {
    btnRefreshPassList.addEventListener("click", () => loadPassageiros());
  }

  const btnRefreshCompanies = document.getElementById("refresh-companies-list");
  if (btnRefreshCompanies) {
    btnRefreshCompanies.addEventListener("click", () => loadEmpresas());
  }

  // Atalho do menu mobile
  const mobileMenuBtn = document.getElementById("mobile-menu");
  const sidebar = document.querySelector(".sidebar");
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
}

function switchView(viewId) {
  currentView = viewId;
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active-view"));
  document
    .querySelectorAll(".side-link")
    .forEach((l) => l.classList.remove("active"));

  const targetView = document.getElementById("view-" + viewId);
  const targetLink = document.querySelector(
    '.side-link[data-view="' + viewId + '"]',
  );

  if (targetView) targetView.classList.add("active-view");
  if (targetLink) targetLink.classList.add("active");

  const titleElem = document.getElementById("dashboard-title");
  if (titleElem) {
    const titles = {
      overview: "Visão Geral",
      alterations: "Solicitações de Alteração Cadastral",
      "passenger-approvals": "Aprovações de Passageiros",
      approvals: "Aprovações de Motoristas",
      passengers: "Passageiros Homologados",
      drivers: "Motoristas Cadastrados",
      companies: "Empresas Conveniadas & Corporativo",
      reports: "Relatórios de Corridas & Faturamento",
      posts: "Comunicados",
      security: "Segurança",
    };
    titleElem.textContent = titles[viewId] || "Painel Admin";
  }

  if (viewId === "alterations") {
    loadSolicitacoes();
  } else if (viewId === "reports") {
    loadCorridasReports();
  } else if (viewId === "companies") {
    loadEmpresas();
  }

  // Fecha o menu mobile ao navegar
  const sidebar = document.querySelector(".sidebar");
  if (sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
  }
}

// --- CARREGAMENTO CENTRAL ---
async function loadAllData() {
  await Promise.all([
    loadMotoristas(),
    loadPassageiros(),
    loadSolicitacoes(),
    loadEmpresas(),
    loadPosts(),
    loadCorridasReports(),
  ]);
}

// --- PASSAGEIROS: CARREGAMENTO & CACHE UNIFICADO ---
async function loadPassageiros() {
  if (!supabaseClient) return;
  try {
    // 1. Busca da tabela oficial 'passageiros'
    const { data: passData, error: passError } = await supabaseClient
      .from("passageiros")
      .select("*")
      .order("created_at", { ascending: false });

    if (passError) {
      console.warn("Aviso ao consultar tabela 'passageiros':", passError.message);
    }

    // 2. Busca também da tabela 'profiles' (onde cadastros do app e Next.js Auth são registrados)
    let profData = [];
    try {
      const { data: pData, error: profError } = await supabaseClient
        .from("profiles")
        .select("*");
      if (!profError && pData) {
        profData = pData.filter((p) => p.role !== "driver");
      }
    } catch (errP) {
      console.warn("Aviso ao consultar tabela 'profiles':", errP);
    }

    const passMap = new Map();

    // Indexa registros da tabela passageiros
    if (passData && Array.isArray(passData)) {
      passData.forEach((p) => {
        const key = String(p.id || p.email || ("pass_" + Math.random()));
        passMap.set(key, { ...p });
      });
    }

    // Mescla com a tabela profiles garantindo foto, status e metadados
    if (profData && Array.isArray(profData)) {
      profData.forEach((prof) => {
        const keyId = prof.id ? String(prof.id) : null;
        const keyEmail = prof.email ? String(prof.email).toLowerCase().trim() : null;

        let matchedKey = null;
        if (keyId && passMap.has(keyId)) {
          matchedKey = keyId;
        } else if (keyEmail) {
          for (const [k, v] of passMap.entries()) {
            if (v.email && String(v.email).toLowerCase().trim() === keyEmail) {
              matchedKey = k;
              break;
            }
          }
        }

        const resolvedAvatar =
          prof.avatar_url ||
          prof.foto_url ||
          prof.avatar ||
          prof.foto ||
          (prof.user_metadata && (prof.user_metadata.avatar_url || prof.user_metadata.avatar || prof.user_metadata.foto_url || prof.user_metadata.picture)) ||
          null;

        const resolvedFotoStatus =
          prof.foto_status ||
          (prof.photo_status === "approved"
            ? "Aprovada"
            : prof.photo_status === "rejected"
            ? "Rejeitada"
            : (resolvedAvatar ? "Pendente" : "Pendente"));

        if (matchedKey) {
          const existing = passMap.get(matchedKey);
          passMap.set(matchedKey, {
            ...existing,
            foto_url: existing.foto_url || resolvedAvatar || existing.avatar_url,
            avatar_url: existing.avatar_url || resolvedAvatar || existing.foto_url,
            foto: existing.foto || resolvedAvatar,
            avatar: existing.avatar || resolvedAvatar,
            foto_status: existing.foto_status || resolvedFotoStatus,
            motivo_rejeicao: existing.motivo_rejeicao || prof.motivo_rejeicao || prof.rejection_reason || null,
            nome: existing.nome || prof.name || prof.nome || "Passageiro",
            nome_social: existing.nome_social || (prof.name || prof.nome || "").split(" ")[0] || "Passageiro",
            nome_completo: existing.nome_completo || prof.name || prof.nome || "",
            telefone: existing.telefone || prof.phone || prof.telefone || "",
            empresa: existing.empresa || prof.company || prof.corporate_company || "Particular",
            setor: existing.setor || prof.department || "Operações",
            cpf: existing.cpf || "Não informado"
          });
        } else if (keyId || keyEmail) {
          const newKey = keyId || keyEmail;
          passMap.set(newKey, {
            id: prof.id || ("pass_" + Date.now()),
            nome: prof.name || prof.nome || (prof.email ? prof.email.split("@")[0] : "Passageiro"),
            nome_social: (prof.name || prof.nome || "").split(" ")[0] || "Passageiro",
            nome_completo: prof.name || prof.nome || "",
            telefone: prof.phone || prof.telefone || "",
            email: prof.email || "",
            empresa: prof.company || prof.corporate_company || "Particular",
            setor: prof.department || "Operações",
            matricula: "Padrão",
            turno: "Padrão",
            cpf: prof.cpf || "Não informado",
            foto_url: resolvedAvatar,
            avatar_url: resolvedAvatar,
            foto: resolvedAvatar,
            avatar: resolvedAvatar,
            foto_status: resolvedFotoStatus,
            motivo_rejeicao: prof.motivo_rejeicao || prof.rejection_reason || null,
            status: prof.status === "active" || prof.is_approved ? "Aprovado" : (prof.status === "blocked" ? "Reprovado" : "Pendente"),
            origem: "App Passageiro",
            created_at: prof.created_at || new Date().toISOString()
          });
        }
      });
    }

    if (passMap.size > 0) {
      passageirosCache = Array.from(passMap.values());
      localStorage.setItem("sr_passageiros_cache", JSON.stringify(passageirosCache));
    } else {
      const localData = localStorage.getItem("sr_passageiros_cache");
      passageirosCache = localData ? JSON.parse(localData) : getInitialPassengersMock();
    }
  } catch (err) {
    console.error("Erro ao carregar passageiros:", err);
    const localData = localStorage.getItem("sr_passageiros_cache");
    passageirosCache = localData ? JSON.parse(localData) : getInitialPassengersMock();
  }

  updateCompanyFilterOptions();
  updateMetrics();
  renderOverviewApprovals();
  renderPassengerApprovals();
  renderPassengersBase();
}

function getInitialPassengersMock() {
  return [];
}

function getInitialDriversMock() {
  return [
    {
      id: "drv-01",
      nome: "Silvio Ramos Martins",
      nome_social: "Silvio Ramos",
      nome_completo: "Silvio Ramos Martins",
      cpf: "123.456.789-00",
      telefone: "(92) 98416-2443",
      email: "srlogistica21@gmail.com",
      categoria_tipo: "particular",
      categoria: "Particular",
      recebe_voucher: true,
      recebe_particular: true,
      marca_veiculo: "Toyota",
      modelo_veiculo: "Corolla XEi",
      placa_veiculo: "PHA-4E21",
      cor_veiculo: "Prata",
      status: "Aprovado",
      vehicle_status: "Aprovado",
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: "drv-02",
      nome: "Marcos Paulo Souza",
      nome_social: "Marcos Paulo",
      nome_completo: "Marcos Paulo Souza",
      cpf: "987.654.321-11",
      telefone: "(92) 99123-4567",
      email: "marcos.transporte@gmail.com",
      categoria_tipo: "empresa",
      categoria: "Empresa",
      recebe_voucher: true,
      recebe_particular: false,
      marca_veiculo: "Chevrolet",
      modelo_veiculo: "Spin 7 Lugares",
      placa_veiculo: "QZZ-1A90",
      cor_veiculo: "Branco",
      status: "Aprovado",
      vehicle_status: "Aprovado",
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: "drv-03",
      nome: "Antônio Carlos Vieira",
      nome_social: "Antônio Carlos",
      nome_completo: "Antônio Carlos Vieira",
      cpf: "456.789.123-22",
      telefone: "(92) 98877-6655",
      email: "acarlos.log@outlook.com",
      categoria_tipo: "particular",
      categoria: "Particular",
      recebe_voucher: true,
      recebe_particular: true,
      marca_veiculo: "Renault",
      modelo_veiculo: "Logan Zen",
      placa_veiculo: "NOX-3382",
      cor_veiculo: "Cinza",
      status: "Aprovado",
      vehicle_status: "Aprovado",
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    }
  ];
}

// --- MOTORISTAS: CARREGAMENTO & CACHE RESILIENTE ---
async function loadMotoristas() {
  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("motoristas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Aviso ao buscar motoristas no Supabase:", error.message, "(utilizando armazenamento local)");
        const localData = localStorage.getItem("sr_motoristas_cache");
        motoristasCache = localData ? JSON.parse(localData) : getInitialDriversMock();
      } else if (data && data.length > 0) {
        // Normaliza campos de categoria e permissões de corrida
        motoristasCache = data.map((m) => {
          const isEmpresa = (m.categoria_tipo === "empresa" || m.categoria === "Empresa" || String(m.categoria_tipo).toLowerCase() === "empresa");
          return {
            ...m,
            categoria_tipo: isEmpresa ? "empresa" : "particular",
            categoria: isEmpresa ? "Empresa" : "Particular",
            recebe_voucher: true,
            recebe_particular: !isEmpresa
          };
        });
        localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
      } else {
        const localData = localStorage.getItem("sr_motoristas_cache");
        motoristasCache = localData ? JSON.parse(localData) : getInitialDriversMock();
        localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
      }
    } else {
      const localData = localStorage.getItem("sr_motoristas_cache");
      motoristasCache = localData ? JSON.parse(localData) : getInitialDriversMock();
    }
  } catch (err) {
    console.error("Erro ao carregar motoristas:", err);
    const localData = localStorage.getItem("sr_motoristas_cache");
    motoristasCache = localData ? JSON.parse(localData) : getInitialDriversMock();
  }

  updateMetrics();
  renderOverviewApprovals();
  renderApprovals();
  renderDrivers();
}

// --- MÉTRICAS GLOBAIS ---
function updateMetrics() {
  // Motoristas
  const driversPending = motoristasCache.filter(
    (m) => m.status === "Pendente" || m.vehicle_status === "Pendente",
  ).length;
  const driversApproved = motoristasCache.filter(
    (m) => m.status === "Aprovado",
  ).length;
  const driversRejected = motoristasCache.filter(
    (m) => m.status === "Reprovado",
  ).length;

  // Passageiros
  const passengersPending = passageirosCache.filter(
    (p) => p.status === "Pendente",
  ).length;
  const passengersApproved = passageirosCache.filter(
    (p) => p.status === "Aprovado",
  ).length;
  const passengersRejected = passageirosCache.filter(
    (p) => p.status === "Reprovado",
  ).length;

  // Alterações Cadastrais (NOVO)
  const alterationsPending = solicitacoesCache.filter(
    (s) => s.status === "Pendente",
  ).length;
  const alterationsApproved = solicitacoesCache.filter(
    (s) => s.status === "Aprovado",
  ).length;
  const alterationsRejected = solicitacoesCache.filter(
    (s) => s.status === "Rejeitado",
  ).length;

  // Atualiza contadores no DOM
  const mPending = document.getElementById("metric-pending");
  const mApproved = document.getElementById("metric-approved");
  const nDriverPending = document.getElementById("nav-pending-count");
  const pDriverTab = document.getElementById("pending-tab-count");
  const aDriverTab = document.getElementById("approved-tab-count");
  const rDriverTab = document.getElementById("rejected-tab-count");
  const allDriverTab = document.getElementById("all-driver-tab-count");

  if (mPending) mPending.textContent = String(driversPending);
  if (mApproved) mApproved.textContent = String(driversApproved);
  if (nDriverPending) nDriverPending.textContent = String(driversPending);
  if (pDriverTab) pDriverTab.textContent = String(driversPending);
  if (aDriverTab) aDriverTab.textContent = String(driversApproved);
  if (rDriverTab) rDriverTab.textContent = String(driversRejected);
  if (allDriverTab) allDriverTab.textContent = String(motoristasCache.length);

  const mPassPending = document.getElementById("metric-passenger-pending");
  const mPassApproved = document.getElementById("metric-passenger-approved");
  const nPassPending = document.getElementById("nav-passenger-pending-count");
  const pPassPendingTab = document.getElementById("passenger-pending-tab-count");
  const pPassApprovedTab = document.getElementById("passenger-approved-tab-count");
  const pPassRejectedTab = document.getElementById("passenger-rejected-tab-count");
  const pPassAllTab = document.getElementById("passenger-all-tab-count");

  if (mPassPending) mPassPending.textContent = String(passengersPending);
  if (mPassApproved) mPassApproved.textContent = String(passengersApproved);
  if (nPassPending) nPassPending.textContent = String(passengersPending);
  if (pPassPendingTab) pPassPendingTab.textContent = String(passengersPending);
  if (pPassApprovedTab) pPassApprovedTab.textContent = String(passengersApproved);
  if (pPassRejectedTab) pPassRejectedTab.textContent = String(passengersRejected);
  if (pPassAllTab) pPassAllTab.textContent = String(passageirosCache.length);

  const nAltPending = document.getElementById("nav-alteration-pending-count");
  const pAltPendingTab = document.getElementById("alteration-pending-tab-count");
  const pAltApprovedTab = document.getElementById("alteration-approved-tab-count");
  const pAltRejectedTab = document.getElementById("alteration-rejected-tab-count");
  const pAltAllTab = document.getElementById("alteration-all-tab-count");

  if (nAltPending) nAltPending.textContent = String(alterationsPending);
  if (pAltPendingTab) pAltPendingTab.textContent = String(alterationsPending);
  if (pAltApprovedTab) pAltApprovedTab.textContent = String(alterationsApproved);
  if (pAltRejectedTab) pAltRejectedTab.textContent = String(alterationsRejected);
  if (pAltAllTab) pAltAllTab.textContent = String(solicitacoesCache.length);
}

// --- VISÃO GERAL: SOLICITAÇÕES RECENTES UNIFICADAS ---
function renderOverviewApprovals() {
  const container = document.getElementById("recent-approvals");
  if (!container) return;

  const pendingAlterations = solicitacoesCache
    .filter((s) => s.status === "Pendente")
    .slice(0, 3);
  const pendingPassengers = passageirosCache
    .filter((p) => p.status === "Pendente")
    .slice(0, 3);
  const pendingDrivers = motoristasCache
    .filter((m) => m.status === "Pendente" || m.vehicle_status === "Pendente")
    .slice(0, 3);

  if (pendingAlterations.length === 0 && pendingPassengers.length === 0 && pendingDrivers.length === 0) {
    container.innerHTML =
      '<p class="loading-state"><i class="fas fa-check-circle" style="color:#268269;"></i> Nenhuma solicitação pendente no momento.</p>';
    return;
  }

  let html = "";

  // 1. Alterações Cadastrais Pendentes no topo com destaque
  pendingAlterations.forEach((s) => {
    const userTypeLabel = s.tipo_usuario === "motorista" ? "Motorista" : "Passageiro";
    const typeTag = s.tipo_alteracao === "empresa" ? "Empresa / Setor" :
                    s.tipo_alteracao === "foto" ? "Foto de Perfil" :
                    s.tipo_alteracao === "categoria" ? "Categoria" :
                    s.tipo_alteracao === "veiculo" ? "Veículo" : "Dados Cadastrais";

    html += `
      <div class="approval-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--line); background:#fffdfa;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="person-avatar" style="background:#ffedd5; color:#c2410c;">
            <i class="fas fa-file-pen"></i>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong>${escapeHtml(s.usuario_nome)}</strong>
              <span class="alteration-type-tag"><i class="fas fa-tag"></i> ${typeTag}</span>
              <span class="alteration-badge-pending"><i class="fas fa-clock"></i> Alteração em Análise</span>
            </div>
            <small style="color:var(--ink-soft);">${escapeHtml(userTypeLabel)} · ${s.justificativa ? escapeHtml(s.justificativa) : "Solicitação de atualização via app"}</small>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn btn-primary" style="padding:5px 10px; font-size:11px; min-height:28px; width:auto;" onclick="switchView('alterations')" title="Revisar Comparativo e Decidir">
            <i class="fas fa-eye"></i> Revisar
          </button>
          <button class="btn btn-secondary" style="padding:5px 10px; font-size:11px; min-height:28px; width:auto;" onclick="aprovarAlteracao('${s.id}')" title="Aprovar e atualizar dados oficiais">
            <i class="fas fa-check" style="color:var(--green);"></i>
          </button>
        </div>
      </div>
    `;
  });

  // Passageiros Pendentes no topo
  pendingPassengers.forEach((p) => {
    const name = p.nome_social || p.nome || "Passageiro";
    const subInfo =
      (p.empresa || "Empresa não inf.") +
      (p.setor ? " · " + p.setor : "") +
      (p.telefone ? " · " + p.telefone : "");
    const photoStatus = p.foto_status || "Pendente";

    html += `
      <div class="approval-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--line);">
        <div style="display:flex; align-items:center; gap:12px;">
          ${renderAvatarHTML(p, "passenger")}
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong>${escapeHtml(name)}</strong>
              <span class="tag-company">${escapeHtml(p.empresa || "Passageiro")}</span>
              <span class="photo-status-badge ${photoStatus === 'Aprovada' ? 'approved' : photoStatus === 'Rejeitada' ? 'rejected' : 'pending'}">
                <i class="fas fa-camera"></i> ${photoStatus === 'Aprovada' ? 'Foto OK' : photoStatus === 'Rejeitada' ? 'Foto Reprovada' : 'Foto Pendente'}
              </span>
            </div>
            <small style="color:var(--ink-soft);">${escapeHtml(subInfo)}</small>
            <div>
              <span class="voucher-status-tag locked"><i class="fas fa-clock"></i> Aguardando Liberação de Voucher (PIX Liberado)</span>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn btn-primary" style="padding:5px 10px; font-size:11px; min-height:28px; width:auto;" onclick="approvePassenger('${p.id}')" title="Aprovar passageiro e liberar Voucher Corporativo">
            <i class="fas fa-check"></i> Aprovar
          </button>
          <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:28px;" onclick="rejectPassenger('${p.id}')" title="Desativar / Reprovar">
            <i class="fas fa-ban" style="color:#be7b20;"></i>
          </button>
          <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:28px;" onclick="deletePassenger('${p.id}')" title="Excluir permanentemente">
            <i class="fas fa-trash-can" style="color:var(--red);"></i>
          </button>
        </div>
      </div>
    `;
  });

  // Motoristas Pendentes
  pendingDrivers.forEach((m) => {
    const displayName = m.nome_social || m.nome || "Motorista";
    const carInfo =
      (m.marca_veiculo || "") +
      " " +
      (m.modelo_veiculo || "") +
      " (" +
      (m.placa_veiculo || "—") +
      ")";
    const isEmpresa = m.categoria_tipo === "empresa" || m.categoria === "Empresa";
    const photoStatus = m.foto_status || "Pendente";

    html += `
      <div class="approval-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--line);">
        <div style="display:flex; align-items:center; gap:12px;">
          ${renderAvatarHTML(m, "driver")}
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong>${escapeHtml(displayName)}</strong>
              <span class="${isEmpresa ? 'tag-category-empresa' : 'tag-category-particular'}">
                <i class="fas ${isEmpresa ? 'fa-building' : 'fa-user'}"></i> ${isEmpresa ? 'Frota Empresa' : 'Particular'}
              </span>
              <span class="photo-status-badge ${photoStatus === 'Aprovada' ? 'approved' : photoStatus === 'Rejeitada' ? 'rejected' : 'pending'}">
                <i class="fas fa-camera"></i> ${photoStatus === 'Aprovada' ? 'Foto OK' : photoStatus === 'Rejeitada' ? 'Foto Reprovada' : 'Foto Pendente'}
              </span>
            </div>
            <small style="color:var(--ink-soft);">${escapeHtml(carInfo)}</small>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn btn-primary" style="padding:5px 10px; font-size:11px; min-height:28px; width:auto;" onclick="approveDriver('${m.id}')">
            <i class="fas fa-check"></i> Aprovar
          </button>
          <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:28px;" onclick="rejectDriver('${m.id}')" title="Desativar / Reprovar">
            <i class="fas fa-ban" style="color:#be7b20;"></i>
          </button>
          <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:28px;" onclick="deleteDriver('${m.id}')" title="Excluir permanentemente">
            <i class="fas fa-trash-can" style="color:var(--red);"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// --- ABA: SOLICITAÇÕES DE ALTERAÇÃO CADASTRAL (REGRA GERAL DO SISTEMA) ---
function setupAlterationFilters() {
  const searchInput = document.getElementById("search-alterations-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      alterationSearchQuery = e.target.value.toLowerCase().trim();
      renderSolicitacoes();
    });
  }

  const typeSelect = document.getElementById("filter-alterations-user-type");
  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      alterationUserTypeFilter = e.target.value;
      renderSolicitacoes();
    });
  }

  const btnOpenModal = document.getElementById("btn-open-alteration-modal");
  if (btnOpenModal) {
    btnOpenModal.addEventListener("click", () => openAlterationSimModal());
  }

  const quickBtnSim = document.getElementById("quick-btn-simulate-alteration");
  if (quickBtnSim) {
    quickBtnSim.addEventListener("click", () => openAlterationSimModal());
  }
}

async function loadSolicitacoes() {
  let loadedList = [];
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("solicitacoes_alteracao")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn(
          "Aviso ao buscar solicitacoes_alteracao no Supabase:",
          error.message,
          "(utilizando armazenamento local de contingência)"
        );
      } else if (data && Array.isArray(data)) {
        loadedList = data;
      }
    } catch (err) {
      console.error("Erro ao carregar solicitacoes_alteracao:", err);
    }
  }

  // Fallback / Enriquecimento com solicitações locais ou embutidas nos motoristas
  const localData = localStorage.getItem("sr_solicitacoes_cache");
  if (localData) {
    try {
      const parsedLocal = JSON.parse(localData);
      if (Array.isArray(parsedLocal)) {
        parsedLocal.forEach((locItem) => {
          if (!loadedList.some((l) => String(l.id) === String(locItem.id))) {
            loadedList.push(locItem);
          }
        });
      }
    } catch {}
  }

  // Verifica se há motoristas no cache com solicitação pendente
  if (Array.isArray(motoristasCache)) {
    motoristasCache.forEach((m) => {
      let pendingData = m.pending_personal_data;
      if (!pendingData && typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(`mobipro_pending_personal_${m.id}`);
          if (cached) pendingData = JSON.parse(cached);
        } catch {}
      }

      if (pendingData) {
        const solId = `sol_driver_${m.id}`;
        const alreadyExists = loadedList.some((s) => String(s.usuario_id) === String(m.id) && s.status === "Pendente");
        if (!alreadyExists) {
          loadedList.unshift({
            id: solId,
            tipo_usuario: "motorista",
            usuario_id: m.id,
            usuario_nome: pendingData.fullName || pendingData.displayName || m.nome_completo || m.nome || "Motorista SR",
            tipo_alteracao: "dados_cadastrais",
            dados_anteriores: {
              nome: m.nome || "",
              nome_social: m.nome_social || "",
              nome_completo: m.nome_completo || "",
              cpf: m.cpf || "—",
              cnh: m.cnh || "—",
              telefone: m.telefone || m.phone || "—",
              email: m.email || "",
            },
            dados_novos: {
              nome: pendingData.displayName || pendingData.fullName,
              nome_social: pendingData.displayName || pendingData.fullName,
              nome_completo: pendingData.fullName || pendingData.displayName,
              cpf: pendingData.cpf,
              cnh: pendingData.cnh,
              telefone: pendingData.phone,
              data_nascimento: pendingData.birthDate,
              email: pendingData.email || m.email,
            },
            justificativa: "Solicitação de alteração cadastral enviada pelo aplicativo do motorista",
            status: "Pendente",
            created_at: m.updated_at || new Date().toISOString()
          });
        }
      }
    });
  }

  solicitacoesCache = loadedList;
  localStorage.setItem("sr_solicitacoes_cache", JSON.stringify(solicitacoesCache));

  updateMetrics();
  renderOverviewApprovals();
  renderSolicitacoes();
}

function renderSolicitacoes() {
  const container = document.getElementById("alterations-container");
  if (!container) return;

  let list = solicitacoesCache.slice();

  // 1. Filtro de Abas
  if (currentAlterationTab === "pending") {
    list = list.filter((s) => s.status === "Pendente");
  } else if (currentAlterationTab === "approved") {
    list = list.filter((s) => s.status === "Aprovado");
  } else if (currentAlterationTab === "rejected") {
    list = list.filter((s) => s.status === "Rejeitado");
  }

  // 2. Filtro por tipo de usuário
  if (alterationUserTypeFilter !== "all") {
    list = list.filter((s) => s.tipo_usuario === alterationUserTypeFilter);
  }

  // 3. Filtro por busca textual
  if (alterationSearchQuery) {
    list = list.filter((s) => {
      const uName = (s.usuario_nome || "").toLowerCase();
      const just = (s.justificativa || "").toLowerCase();
      const tipoAlt = (s.tipo_alteracao || "").toLowerCase();
      const dadosAnt = JSON.stringify(s.dados_anteriores || {}).toLowerCase();
      const dadosNov = JSON.stringify(s.dados_novos || {}).toLowerCase();
      return (
        uName.includes(alterationSearchQuery) ||
        just.includes(alterationSearchQuery) ||
        tipoAlt.includes(alterationSearchQuery) ||
        dadosAnt.includes(alterationSearchQuery) ||
        dadosNov.includes(alterationSearchQuery)
      );
    });
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 20px; text-align:center;">
        <i class="fas fa-file-circle-check" style="font-size:32px; color:var(--green); margin-bottom:10px; display:block;"></i>
        <strong>Nenhuma solicitação de alteração cadastral encontrada.</strong>
        <p style="color:var(--ink-soft); margin:5px 0 0; font-size:12px;">Todas as solicitações de motoristas e passageiros foram processadas ou a fila está vazia.</p>
      </div>
    `;
    return;
  }

  let html = `
    <table class="approval-table">
      <thead>
        <tr>
          <th>Usuário & Perfil</th>
          <th>Tipo de Alteração & Justificativa</th>
          <th style="min-width:320px;">Comparativo: Dados Atuais vs Solicitados</th>
          <th>Status / Envio</th>
          <th style="text-align:right;">Decisão Administrativa</th>
        </tr>
      </thead>
      <tbody>
  `;

  list.forEach((s) => {
    const isPass = s.tipo_usuario === "passageiro";
    const userObj = isPass
      ? passageirosCache.find((p) => String(p.id) === String(s.usuario_id))
      : motoristasCache.find((m) => String(m.id) === String(s.usuario_id));

    const statusBadgeClass =
      s.status === "Aprovado"
        ? "approved"
        : s.status === "Rejeitado"
        ? "rejected"
        : "pending";

    const statusLabel =
      s.status === "Aprovado"
        ? "Homologado"
        : s.status === "Rejeitado"
        ? "Rejeitado"
        : "Aguardando Aprovação";

    const typeTagLabel =
      s.tipo_alteracao === "empresa" ? "Empresa / Setor" :
      s.tipo_alteracao === "foto" ? "Foto de Perfil" :
      s.tipo_alteracao === "categoria" ? "Categoria" :
      s.tipo_alteracao === "veiculo" ? "Veículo" :
      s.tipo_alteracao === "contato" ? "Contatos" : "Geral";

    const dateStr = s.created_at ? new Date(s.created_at).toLocaleString("pt-BR") : "—";
    const diffHTML = renderDiffHTML(s.dados_anteriores, s.dados_novos, s.tipo_alteracao);

    html += `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            ${userObj ? renderAvatarHTML(userObj, s.tipo_usuario === 'motorista' ? 'driver' : 'passenger') : `
              <div class="avatar-initials-thumb ${s.tipo_usuario === 'motorista' ? 'driver' : ''}">
                ${(s.usuario_nome || 'U').charAt(0).toUpperCase()}
              </div>
            `}
            <div>
              <strong style="display:block; font-size:12.5px;">${escapeHtml(s.usuario_nome)}</strong>
              <span class="tag-dept" style="font-size:9.5px;">${isPass ? '👤 Passageiro' : '🚗 Motorista'}</span>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span class="alteration-type-tag"><i class="fas fa-tag"></i> ${typeTagLabel}</span>
            <small style="color:var(--ink-soft); font-size:11px; line-height:1.35;">
              ${s.justificativa ? escapeHtml(s.justificativa) : 'Sem justificativa informada pelo usuário.'}
            </small>
          </div>
        </td>
        <td>
          ${diffHTML}
        </td>
        <td>
          <span class="status-badge ${statusBadgeClass}">${statusLabel}</span>
          <small style="color:var(--ink-soft); display:block; margin-top:4px; font-size:10px;">${dateStr}</small>
          ${s.analisado_por ? `<small style="color:var(--green); display:block; font-size:9px;">Por: ${escapeHtml(s.analisado_por)}</small>` : ''}
          ${s.motivo_rejeicao ? `<small style="color:var(--red); display:block; font-size:9px; font-weight:700;">Motivo: ${escapeHtml(s.motivo_rejeicao)}</small>` : ''}
        </td>
        <td style="text-align:right;">
          ${s.status === 'Pendente' ? `
            <div style="display:flex; gap:6px; justify-content:flex-end;">
              <button class="btn btn-primary" style="padding:6px 12px; font-size:11px; min-height:30px; width:auto;" onclick="aprovarAlteracao('${s.id}')" title="Aprovar e atualizar dados oficiais">
                <i class="fas fa-check"></i> Aprovar Oficial
              </button>
              <button class="btn btn-secondary" style="padding:6px 10px; font-size:11px; min-height:30px; width:auto; color:var(--red); border-color:var(--red);" onclick="abrirModalRejeicao('${s.id}')" title="Reprovar alteração">
                <i class="fas fa-ban"></i> Reprovar
              </button>
            </div>
          ` : `
            <span style="font-size:11px; color:var(--ink-soft); font-weight:700;">
              <i class="fas ${s.status === 'Aprovado' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> Processado
            </span>
          `}
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

function renderDiffHTML(oldData, newData, tipoAlt) {
  if (!oldData && !newData) return '<span style="color:var(--ink-soft);">Sem dados para comparar.</span>';
  const o = oldData || {};
  const n = newData || {};
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));
  if (keys.length === 0) return '<span style="color:var(--ink-soft);">Nenhum campo modificado.</span>';

  const labels = {
    nome: "Nome",
    nome_social: "Nome Social",
    nome_completo: "Nome Completo",
    empresa: "Empresa Conveniada",
    setor: "Setor / Área",
    matricula: "Matrícula",
    turno: "Turno de Trabalho",
    telefone: "Telefone / WhatsApp",
    email: "E-mail",
    cpf: "CPF",
    categoria: "Categoria",
    categoria_tipo: "Tipo de Categoria",
    marca_veiculo: "Marca do Veículo",
    modelo_veiculo: "Modelo",
    placa_veiculo: "Placa",
    cor_veiculo: "Cor",
    foto_url: "Foto de Perfil"
  };

  let rowsHtml = "";
  keys.forEach((k) => {
    const valOld = o[k] !== undefined && o[k] !== null ? String(o[k]) : "—";
    const valNew = n[k] !== undefined && n[k] !== null ? String(n[k]) : "—";
    const fieldName = labels[k] || k;

    if (k === "foto_url") {
      rowsHtml += `
        <div style="margin-bottom:6px;">
          <strong style="font-size:10px; color:var(--ink-soft); text-transform:uppercase;">${fieldName}:</strong>
          <div class="diff-box" style="margin-top:4px;">
            <div class="diff-col">
              <span class="diff-title"><i class="fas fa-image"></i> Atual Oficial</span>
              ${valOld !== "—" ? `<img src="${escapeHtml(valOld)}" alt="Foto atual" style="width:46px; height:46px; border-radius:50%; object-fit:cover; border:2px solid var(--line);">` : '<span class="diff-val-old">Sem foto</span>'}
            </div>
            <div class="diff-col">
              <span class="diff-title" style="color:var(--green);"><i class="fas fa-sparkles"></i> Nova Solicitada</span>
              ${valNew !== "—" ? `<img src="${escapeHtml(valNew)}" alt="Nova foto" style="width:46px; height:46px; border-radius:50%; object-fit:cover; border:2px solid var(--green);">` : '<span class="diff-val-new">Sem foto</span>'}
            </div>
          </div>
        </div>
      `;
    } else {
      rowsHtml += `
        <div style="margin-bottom:6px;">
          <strong style="font-size:10px; color:var(--ink-soft); text-transform:uppercase;">${fieldName}:</strong>
          <div class="diff-box" style="margin-top:2px;">
            <div class="diff-col">
              <span class="diff-title"><i class="fas fa-lock"></i> Atual Oficial</span>
              <div class="diff-val-old">${escapeHtml(valOld)}</div>
            </div>
            <div class="diff-col">
              <span class="diff-title" style="color:var(--green);"><i class="fas fa-pen"></i> Novo Solicitado</span>
              <div class="diff-val-new">${escapeHtml(valNew)}</div>
            </div>
          </div>
        </div>
      `;
    }
  });

// Helper de atualização resiliente para o Supabase
async function updateSupabaseTableResilient(tableName, recordId, payload) {
  if (!supabaseClient || !recordId) return false;
  let p = { ...payload };
  let attempts = 0;
  while (attempts < 20) {
    attempts++;
    const { error } = await supabaseClient.from(tableName).update(p).eq("id", recordId);
    if (!error) {
      console.log(`[Admin] Sucesso ao atualizar ${tableName} (${recordId})`);
      return true;
    }
    const colMatch = error.message.match(/Could not find the '([^']+)' column/i);
    if (colMatch && colMatch[1] && p[colMatch[1]] !== undefined) {
      console.warn(`[Admin] Coluna '${colMatch[1]}' não existe em ${tableName}. Removendo e tentando novamente...`);
      delete p[colMatch[1]];
    } else {
      console.warn(`[Admin] Aviso ao atualizar ${tableName} (${recordId}):`, error.message);
      break;
    }
  }
  return false;
}

// APROVAÇÃO OFICIAL DE ALTERAÇÃO CADASTRAL
async function aprovarAlteracao(solicitacaoId) {
  const item = solicitacoesCache.find((s) => String(s.id) === String(solicitacaoId));
  if (!item) return;

  if (!confirm(`Deseja homologar e aprovar a alteração cadastral para "${item.usuario_nome}"? Os dados oficiais serão atualizados imediatamente.`)) {
    return;
  }

  try {
    const novos = item.dados_novos || {};
    let adminEmail = "Administrador SR";
    if (supabaseClient && supabaseClient.auth) {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (sessionData && sessionData.session && sessionData.session.user) {
        adminEmail = sessionData.session.user.email || "Administrador SR";
      }
    }

    // 1. Normalização profunda dos dados novos
    const nomeNormalizado = novos.nome || novos.name || novos.fullName || novos.displayName || novos.nome_social || novos.nome_completo;
    const telefoneNormalizado = novos.telefone || novos.phone || novos.whatsapp || novos.celular;
    const cpfNormalizado = novos.cpf;
    const enderecoNormalizado = novos.endereco || novos.pickup_address || novos.address;
    const empresaNormalizada = novos.empresa || novos.company || novos.corporate_company || novos.razao_social;
    const setorNormalizado = novos.setor || novos.department;
    const matriculaNormalizada = novos.matricula || novos.employee_registration || novos.employee_id;
    const turnoNormalizado = novos.turno || novos.shift;
    const fotoNormalizada = novos.foto_url || novos.avatar_url || novos.foto || novos.avatar;

    // Atualiza cache local de usuários oficiais
    if (item.tipo_usuario === "passageiro") {
      const p = passageirosCache.find((u) => String(u.id) === String(item.usuario_id));
      if (p) {
        if (nomeNormalizado) { p.nome = nomeNormalizado; p.name = nomeNormalizado; }
        if (telefoneNormalizado) { p.telefone = telefoneNormalizado; p.phone = telefoneNormalizado; }
        if (cpfNormalizado) p.cpf = cpfNormalizado;
        if (enderecoNormalizado) { p.endereco = enderecoNormalizado; p.pickup_address = enderecoNormalizado; }
        if (empresaNormalizada) { p.empresa = empresaNormalizada; p.company = empresaNormalizada; }
        if (setorNormalizado) { p.setor = setorNormalizado; p.department = setorNormalizado; }
        if (matriculaNormalizada) { p.matricula = matriculaNormalizada; p.employee_registration = matriculaNormalizada; }
        if (turnoNormalizado) { p.turno = turnoNormalizado; p.shift = turnoNormalizado; }
        if (fotoNormalizada) { p.foto_url = fotoNormalizada; p.avatar_url = fotoNormalizada; p.foto_status = "Aprovada"; }
        p.solicitacao_pendente = false;
        p.updated_at = new Date().toISOString();
      }
      localStorage.setItem("sr_passageiros_cache", JSON.stringify(passageirosCache));
    } else {
      const m = motoristasCache.find((u) => String(u.id) === String(item.usuario_id));
      if (m) {
        if (nomeNormalizado) { m.nome = nomeNormalizado; m.nome_social = nomeNormalizado; m.name = nomeNormalizado; }
        if (telefoneNormalizado) { m.telefone = telefoneNormalizado; m.phone = telefoneNormalizado; }
        if (cpfNormalizado) m.cpf = cpfNormalizado;
        if (novos.marca_veiculo || novos.brand) m.marca_veiculo = novos.marca_veiculo || novos.brand;
        if (novos.modelo_veiculo || novos.model) m.modelo_veiculo = novos.modelo_veiculo || novos.model;
        if (novos.cor_veiculo || novos.color) m.cor_veiculo = novos.cor_veiculo || novos.color;
        if (novos.placa_veiculo || novos.plate) m.placa_veiculo = novos.placa_veiculo || novos.plate;
        if (novos.categoria_tipo || novos.categoria) {
          const isEmpresa = (novos.categoria_tipo === "empresa" || novos.categoria === "Empresa");
          m.categoria_tipo = isEmpresa ? "empresa" : "particular";
          m.categoria = isEmpresa ? "Empresa" : "Particular";
          m.recebe_voucher = true;
          m.recebe_particular = !isEmpresa;
        }
        if (fotoNormalizada) { m.foto_url = fotoNormalizada; m.avatar_url = fotoNormalizada; m.foto_status = "Aprovada"; }
        m.dados_pessoais_status = "Aprovado";
        m.solicitacao_pendente = false;
        m.updated_at = new Date().toISOString();
      }
      localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
    }

    // 2. Atualiza item no cache de solicitações
    item.status = "Aprovado";
    item.analisado_por = adminEmail;
    item.analisado_em = new Date().toISOString();
    item.updated_at = new Date().toISOString();
    localStorage.setItem("sr_solicitacoes_cache", JSON.stringify(solicitacoesCache));

    // 3. Atualiza no Supabase (Atualiza tabelas específicas e a tabela profiles)
    if (supabaseClient) {
      try {
        if (item.tipo_usuario === "passageiro") {
          // Payload para a tabela passageiros
          const passPayload = {
            nome: nomeNormalizado,
            nome_social: nomeNormalizado,
            nome_completo: nomeNormalizado,
            telefone: telefoneNormalizado,
            phone: telefoneNormalizado,
            cpf: cpfNormalizado,
            endereco: enderecoNormalizado,
            pickup_address: enderecoNormalizado,
            empresa: empresaNormalizada,
            company: empresaNormalizada,
            setor: setorNormalizado,
            department: setorNormalizado,
            matricula: matriculaNormalizada,
            employee_registration: matriculaNormalizada,
            turno: turnoNormalizado,
            shift: turnoNormalizado,
            solicitacao_pendente: false,
            updated_at: new Date().toISOString()
          };
          if (fotoNormalizada) {
            passPayload.foto_url = fotoNormalizada;
            passPayload.avatar_url = fotoNormalizada;
            passPayload.foto_status = "Aprovada";
          }
          Object.keys(passPayload).forEach((k) => passPayload[k] === undefined && delete passPayload[k]);
          await updateSupabaseTableResilient("passageiros", item.usuario_id, passPayload);

          // Payload para a tabela profiles
          const profPayload = {
            name: nomeNormalizado,
            nome: nomeNormalizado,
            full_name: nomeNormalizado,
            phone: telefoneNormalizado,
            telefone: telefoneNormalizado,
            cpf: cpfNormalizado,
            pickup_address: enderecoNormalizado,
            endereco: enderecoNormalizado,
            company: empresaNormalizada,
            empresa: empresaNormalizada,
            corporate_company: empresaNormalizada,
            department: setorNormalizado,
            setor: setorNormalizado,
            employee_registration: matriculaNormalizada,
            matricula: matriculaNormalizada,
            shift: turnoNormalizado,
            turno: turnoNormalizado,
            solicitacao_pendente: false,
            updated_at: new Date().toISOString()
          };
          if (fotoNormalizada) {
            profPayload.avatar_url = fotoNormalizada;
            profPayload.foto_url = fotoNormalizada;
            profPayload.foto_status = "Aprovada";
            profPayload.photo_status = "approved";
          }
          Object.keys(profPayload).forEach((k) => profPayload[k] === undefined && delete profPayload[k]);
          await updateSupabaseTableResilient("profiles", item.usuario_id, profPayload);

        } else {
          // Payload para a tabela motoristas
          const drvPayload = {
            nome: nomeNormalizado,
            nome_social: nomeNormalizado,
            nome_completo: nomeNormalizado,
            telefone: telefoneNormalizado,
            phone: telefoneNormalizado,
            cpf: cpfNormalizado,
            marca_veiculo: novos.marca_veiculo || novos.brand,
            modelo_veiculo: novos.modelo_veiculo || novos.model,
            cor_veiculo: novos.cor_veiculo || novos.color,
            placa_veiculo: novos.placa_veiculo || novos.plate,
            dados_pessoais_status: "Aprovado",
            pending_personal_data: null,
            solicitacao_pendente: false,
            updated_at: new Date().toISOString()
          };
          if (novos.categoria_tipo || novos.categoria) {
            const isEmpresa = (novos.categoria_tipo === "empresa" || novos.categoria === "Empresa");
            drvPayload.categoria_tipo = isEmpresa ? "empresa" : "particular";
            drvPayload.categoria = isEmpresa ? "Empresa" : "Particular";
            drvPayload.recebe_voucher = true;
            drvPayload.recebe_particular = !isEmpresa;
          }
          if (fotoNormalizada) {
            drvPayload.foto_url = fotoNormalizada;
            drvPayload.avatar_url = fotoNormalizada;
            drvPayload.foto_status = "Aprovada";
          }
          Object.keys(drvPayload).forEach((k) => drvPayload[k] === undefined && delete drvPayload[k]);
          await updateSupabaseTableResilient("motoristas", item.usuario_id, drvPayload);

          // Payload para a tabela profiles do motorista
          const profPayload = {
            name: nomeNormalizado,
            nome: nomeNormalizado,
            full_name: nomeNormalizado,
            phone: telefoneNormalizado,
            telefone: telefoneNormalizado,
            cpf: cpfNormalizado,
            solicitacao_pendente: false,
            updated_at: new Date().toISOString()
          };
          if (fotoNormalizada) {
            profPayload.avatar_url = fotoNormalizada;
            profPayload.foto_url = fotoNormalizada;
            profPayload.foto_status = "Aprovada";
            profPayload.photo_status = "approved";
          }
          Object.keys(profPayload).forEach((k) => profPayload[k] === undefined && delete profPayload[k]);
          await updateSupabaseTableResilient("profiles", item.usuario_id, profPayload);
        }

        // Atualiza o status em solicitacoes_alteracao no Supabase
        try {
          await supabaseClient.from("solicitacoes_alteracao").update({
            status: "Aprovado",
            analisado_por: adminEmail,
            analisado_em: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq("id", item.id);
        } catch {}

      } catch (dbErr) {
        console.warn("Aviso ao persistir aprovação no Supabase:", dbErr.message);
      }
    }

    showNotification(`Alteração de "${item.usuario_nome}" homologada com sucesso! Os dados oficiais foram atualizados.`, "success");
    updateMetrics();
    renderOverviewApprovals();
    renderSolicitacoes();
    renderPassengerApprovals();
    renderPassengersBase();
    renderApprovals();
    renderDrivers();
  } catch (err) {
    console.error("Erro ao aprovar alteração:", err);
    showNotification("Erro ao homologar alteração: " + err.message, "error");
  }
}

// REJEIÇÃO DE ALTERAÇÃO CADASTRAL
function abrirModalRejeicao(solicitacaoId) {
  const modal = document.getElementById("alteration-reject-modal");
  const idInput = document.getElementById("alt-reject-id");
  const reasonInput = document.getElementById("alt-reject-reason");
  const feedback = document.getElementById("alt-reject-feedback");

  if (idInput) idInput.value = solicitacaoId;
  if (reasonInput) reasonInput.value = "";
  if (feedback) {
    feedback.textContent = "";
    feedback.className = "feedback-msg";
  }
  if (modal) modal.classList.remove("hidden");
}

function setupAlterationRejectModal() {
  const modal = document.getElementById("alteration-reject-modal");
  const closeBtn = document.getElementById("close-alt-reject-modal");
  const cancelBtn = document.getElementById("btn-cancel-alt-reject");
  const form = document.getElementById("alt-reject-form");
  const feedback = document.getElementById("alt-reject-feedback");

  function fechar() {
    if (modal) modal.classList.add("hidden");
  }

  if (closeBtn) closeBtn.addEventListener("click", fechar);
  if (cancelBtn) cancelBtn.addEventListener("click", fechar);

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("alt-reject-id").value;
      const reason = document.getElementById("alt-reject-reason").value.trim();

      if (!reason) {
        if (feedback) {
          feedback.textContent = "Informe a justificativa da recusa.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      const item = solicitacoesCache.find((s) => String(s.id) === String(id));
      if (!item) return;

      try {
        let adminEmail = "Administrador SR";
        if (supabaseClient && supabaseClient.auth) {
          const { data: sessionData } = await supabaseClient.auth.getSession();
          if (sessionData && sessionData.session && sessionData.session.user) {
            adminEmail = sessionData.session.user.email || "Administrador SR";
          }
        }

        // Limpa flag de solicitação pendente no cache oficial
        if (item.tipo_usuario === "passageiro") {
          const p = passageirosCache.find((u) => String(u.id) === String(item.usuario_id));
          if (p) p.solicitacao_pendente = false;
          localStorage.setItem("sr_passageiros_cache", JSON.stringify(passageirosCache));
        } else {
          const m = motoristasCache.find((u) => String(u.id) === String(item.usuario_id));
          if (m) m.solicitacao_pendente = false;
          localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
        }

        item.status = "Rejeitado";
        item.motivo_rejeicao = reason;
        item.analisado_por = adminEmail;
        item.analisado_em = new Date().toISOString();
        item.updated_at = new Date().toISOString();
        localStorage.setItem("sr_solicitacoes_cache", JSON.stringify(solicitacoesCache));

        if (supabaseClient) {
          try {
            const { error: rpcErr } = await supabaseClient.rpc("rejeitar_solicitacao_alteracao", {
              p_solicitacao_id: item.id,
              p_motivo: reason,
              p_admin_info: adminEmail
            });

            if (rpcErr) {
              const targetTable = item.tipo_usuario === "passageiro" ? "passageiros" : "motoristas";
              await supabaseClient.from(targetTable).update({ solicitacao_pendente: false }).eq("id", item.usuario_id);
              await supabaseClient.from("solicitacoes_alteracao").update({
                status: "Rejeitado",
                motivo_rejeicao: reason,
                analisado_por: adminEmail,
                analisado_em: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }).eq("id", item.id);
            }
          } catch (dbErr) {
            console.warn("Aviso ao persistir rejeição no Supabase:", dbErr.message);
          }
        }

        showNotification(`Solicitação de alteração para "${item.usuario_nome}" foi reprovada. Dados oficiais mantidos.`, "warning");
        fechar();
        updateMetrics();
        renderOverviewApprovals();
        renderSolicitacoes();
        renderPassengersBase();
        renderDrivers();
      } catch (err) {
        console.error("Erro ao rejeitar alteração:", err);
        if (feedback) {
          feedback.textContent = "Erro ao rejeitar: " + err.message;
          feedback.className = "feedback-msg error";
        }
      }
    });
  }
}

// MODAL DE SIMULAÇÃO DE ALTERAÇÃO PELO APP
function openAlterationSimModal() {
  const modal = document.getElementById("alteration-sim-modal");
  const userTypeSelect = document.getElementById("alt-user-type");
  const userSelect = document.getElementById("alt-user-select");
  const altTypeSelect = document.getElementById("alt-type-select");
  const feedback = document.getElementById("alteration-sim-feedback");
  const justification = document.getElementById("alt-justification");

  if (feedback) {
    feedback.textContent = "";
    feedback.className = "feedback-msg";
  }
  if (justification) justification.value = "";

  populateSimUsersList();
  renderAlterationFieldInputs();

  if (modal) modal.classList.remove("hidden");
}

function populateSimUsersList() {
  const userTypeSelect = document.getElementById("alt-user-type");
  const userSelect = document.getElementById("alt-user-select");
  if (!userTypeSelect || !userSelect) return;

  const isPass = userTypeSelect.value === "passageiro";
  let html = '<option value="">Selecione um usuário...</option>';

  if (isPass) {
    passageirosCache.forEach((p) => {
      const name = p.nome_social || p.nome || "Passageiro";
      const emp = p.empresa || "Sem empresa";
      html += `<option value="${p.id}" data-type="passageiro">${escapeHtml(name)} (${escapeHtml(emp)})</option>`;
    });
  } else {
    motoristasCache.forEach((m) => {
      const name = m.nome_social || m.nome || "Motorista";
      const cat = m.categoria || (m.categoria_tipo === "empresa" ? "Empresa" : "Particular");
      html += `<option value="${m.id}" data-type="motorista">${escapeHtml(name)} [${cat}]</option>`;
    });
  }

  userSelect.innerHTML = html;
}

function renderAlterationFieldInputs() {
  const userTypeSelect = document.getElementById("alt-user-type");
  const userSelect = document.getElementById("alt-user-select");
  const altTypeSelect = document.getElementById("alt-type-select");
  const container = document.getElementById("alt-fields-container");

  if (!container || !userTypeSelect || !altTypeSelect) return;

  const isPass = userTypeSelect.value === "passageiro";
  const selectedUserId = userSelect ? userSelect.value : "";
  const altType = altTypeSelect.value;

  const currentUser = isPass
    ? passageirosCache.find((p) => String(p.id) === String(selectedUserId))
    : motoristasCache.find((m) => String(m.id) === String(selectedUserId));

  let html = "";

  if (altType === "empresa") {
    const curEmp = (currentUser && currentUser.empresa) || "Nenhuma";
    const curSet = (currentUser && currentUser.setor) || "Nenhum";
    const curMat = (currentUser && currentUser.matricula) || "Nenhuma";

    html = `
      <div style="font-size:11px; margin-bottom:10px; color:var(--ink-soft);">
        <strong>Dados Oficiais Atuais:</strong> Empresa: <em>${escapeHtml(curEmp)}</em> | Setor: <em>${escapeHtml(curSet)}</em> | Matrícula: <em>${escapeHtml(curMat)}</em>
      </div>
      <div class="form-group">
        <label for="alt-new-empresa">Nova Empresa Conveniada *</label>
        <select id="alt-new-empresa" required>
          <option value="">Selecione a nova empresa...</option>
          ${empresasCache.map((c) => `<option value="${escapeHtml(c.trade_name || c.name)}">${escapeHtml(c.trade_name || c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="alt-new-setor">Novo Setor / Área</label>
          <input type="text" id="alt-new-setor" placeholder="Ex: Engenharia / Logística">
        </div>
        <div class="form-group">
          <label for="alt-new-matricula">Nova Matrícula</label>
          <input type="text" id="alt-new-matricula" placeholder="Ex: MAT-12903">
        </div>
      </div>
    `;
  } else if (altType === "foto") {
    html = `
      <div class="form-group">
        <label for="alt-new-foto-url">URL da Nova Foto de Perfil *</label>
        <input type="url" id="alt-new-foto-url" placeholder="https://images.unsplash.com/..." required>
        <small style="color:var(--ink-soft); display:block; margin-top:4px;">No app móvel, o usuário captura a foto da câmera ou galeria.</small>
      </div>
    `;
  } else if (altType === "categoria") {
    const curCat = (currentUser && (currentUser.categoria || currentUser.categoria_tipo)) || "Particular";
    html = `
      <div style="font-size:11px; margin-bottom:10px; color:var(--ink-soft);">
        <strong>Categoria Atual:</strong> <em>${escapeHtml(curCat)}</em>
      </div>
      <div class="form-group">
        <label for="alt-new-categoria">Nova Categoria de Motorista *</label>
        <select id="alt-new-categoria" required>
          <option value="particular">Motorista Particular (Atende corridas corporativas via voucher + particulares)</option>
          <option value="empresa">Frota Empresa / Convênio Exclusivo (Apenas corridas corporativas via voucher)</option>
        </select>
      </div>
    `;
  } else if (altType === "veiculo") {
    const curV = currentUser ? `${currentUser.marca_veiculo || ''} ${currentUser.modelo_veiculo || ''} (${currentUser.placa_veiculo || 'Sem placa'})` : 'Nenhum';
    html = `
      <div style="font-size:11px; margin-bottom:10px; color:var(--ink-soft);">
        <strong>Veículo Atual:</strong> <em>${escapeHtml(curV)}</em>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="alt-new-marca">Marca do Veículo *</label>
          <input type="text" id="alt-new-marca" placeholder="Ex: Toyota" required>
        </div>
        <div class="form-group">
          <label for="alt-new-modelo">Modelo do Veículo *</label>
          <input type="text" id="alt-new-modelo" placeholder="Ex: Corolla Cross" required>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="alt-new-placa">Placa do Veículo *</label>
          <input type="text" id="alt-new-placa" placeholder="Ex: PHA-4E21" required>
        </div>
        <div class="form-group">
          <label for="alt-new-cor">Cor do Veículo *</label>
          <input type="text" id="alt-new-cor" placeholder="Ex: Prata" required>
        </div>
      </div>
    `;
  } else if (altType === "contato") {
    const curTel = (currentUser && currentUser.telefone) || "Não inf.";
    const curEmail = (currentUser && currentUser.email) || "Não inf.";
    html = `
      <div style="font-size:11px; margin-bottom:10px; color:var(--ink-soft);">
        <strong>Contatos Atuais:</strong> Telefone: <em>${escapeHtml(curTel)}</em> | E-mail: <em>${escapeHtml(curEmail)}</em>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="alt-new-telefone">Novo Telefone / WhatsApp</label>
          <input type="text" id="alt-new-telefone" placeholder="(92) 9XXXX-XXXX">
        </div>
        <div class="form-group">
          <label for="alt-new-email">Novo E-mail</label>
          <input type="email" id="alt-new-email" placeholder="usuario@email.com">
        </div>
      </div>
    `;
  } else {
    html = `
      <div class="form-group">
        <label for="alt-new-nome">Nome Completo / Social Solicitado</label>
        <input type="text" id="alt-new-nome" placeholder="Nome atualizado">
      </div>
    `;
  }

  container.innerHTML = html;
}

function setupAlterationSimModal() {
  const modal = document.getElementById("alteration-sim-modal");
  const closeBtn = document.getElementById("close-alteration-sim-modal");
  const cancelBtn = document.getElementById("btn-cancel-alt-modal");
  const userTypeSelect = document.getElementById("alt-user-type");
  const userSelect = document.getElementById("alt-user-select");
  const altTypeSelect = document.getElementById("alt-type-select");
  const form = document.getElementById("alteration-sim-form");
  const feedback = document.getElementById("alteration-sim-feedback");

  function fechar() {
    if (modal) modal.classList.add("hidden");
  }

  if (closeBtn) closeBtn.addEventListener("click", fechar);
  if (cancelBtn) cancelBtn.addEventListener("click", fechar);

  if (userTypeSelect) {
    userTypeSelect.addEventListener("change", () => {
      populateSimUsersList();
      renderAlterationFieldInputs();
    });
  }

  if (userSelect) {
    userSelect.addEventListener("change", () => {
      renderAlterationFieldInputs();
    });
  }

  if (altTypeSelect) {
    altTypeSelect.addEventListener("change", () => {
      renderAlterationFieldInputs();
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userType = userTypeSelect.value;
      const userId = userSelect.value;
      const altType = altTypeSelect.value;
      const just = document.getElementById("alt-justification").value.trim();

      if (!userId) {
        if (feedback) {
          feedback.textContent = "Selecione um usuário cadastrado.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      const currentUser = userType === "passageiro"
        ? passageirosCache.find((p) => String(p.id) === String(userId))
        : motoristasCache.find((m) => String(m.id) === String(userId));

      if (!currentUser) {
        if (feedback) {
          feedback.textContent = "Usuário não localizado no cache.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      const userName = currentUser.nome_social || currentUser.nome || (userType === "passageiro" ? "Passageiro" : "Motorista");

      // Monta dados_anteriores e dados_novos
      let dadosAnteriores = {};
      let dadosNovos = {};

      if (altType === "empresa") {
        const newEmp = document.getElementById("alt-new-empresa") ? document.getElementById("alt-new-empresa").value : "";
        const newSet = document.getElementById("alt-new-setor") ? document.getElementById("alt-new-setor").value : "";
        const newMat = document.getElementById("alt-new-matricula") ? document.getElementById("alt-new-matricula").value : "";

        if (!newEmp) {
          if (feedback) {
            feedback.textContent = "Selecione a nova empresa.";
            feedback.className = "feedback-msg error";
          }
          return;
        }

        dadosAnteriores = {
          empresa: currentUser.empresa || "",
          setor: currentUser.setor || "",
          matricula: currentUser.matricula || ""
        };
        dadosNovos = {
          empresa: newEmp,
          setor: newSet || currentUser.setor || "",
          matricula: newMat || currentUser.matricula || ""
        };
      } else if (altType === "foto") {
        const newFoto = document.getElementById("alt-new-foto-url") ? document.getElementById("alt-new-foto-url").value.trim() : "";
        if (!newFoto) {
          if (feedback) {
            feedback.textContent = "Informe a URL da nova foto.";
            feedback.className = "feedback-msg error";
          }
          return;
        }
        dadosAnteriores = { foto_url: currentUser.foto_url || currentUser.avatar_url || "" };
        dadosNovos = { foto_url: newFoto, avatar_url: newFoto };
      } else if (altType === "categoria") {
        const newCatVal = document.getElementById("alt-new-categoria") ? document.getElementById("alt-new-categoria").value : "particular";
        const isEmp = newCatVal === "empresa";
        dadosAnteriores = {
          categoria_tipo: currentUser.categoria_tipo || "particular",
          categoria: currentUser.categoria || "Particular"
        };
        dadosNovos = {
          categoria_tipo: isEmp ? "empresa" : "particular",
          categoria: isEmp ? "Empresa" : "Particular",
          recebe_voucher: true,
          recebe_particular: !isEmp
        };
      } else if (altType === "veiculo") {
        const newMarca = document.getElementById("alt-new-marca") ? document.getElementById("alt-new-marca").value.trim() : "";
        const newModelo = document.getElementById("alt-new-modelo") ? document.getElementById("alt-new-modelo").value.trim() : "";
        const newPlaca = document.getElementById("alt-new-placa") ? document.getElementById("alt-new-placa").value.trim().toUpperCase() : "";
        const newCor = document.getElementById("alt-new-cor") ? document.getElementById("alt-new-cor").value.trim() : "";

        if (!newMarca || !newModelo || !newPlaca) {
          if (feedback) {
            feedback.textContent = "Preencha os campos obrigatórios do veículo.";
            feedback.className = "feedback-msg error";
          }
          return;
        }

        dadosAnteriores = {
          marca_veiculo: currentUser.marca_veiculo || "",
          modelo_veiculo: currentUser.modelo_veiculo || "",
          placa_veiculo: currentUser.placa_veiculo || "",
          cor_veiculo: currentUser.cor_veiculo || ""
        };
        dadosNovos = {
          marca_veiculo: newMarca,
          modelo_veiculo: newModelo,
          placa_veiculo: newPlaca,
          cor_veiculo: newCor || currentUser.cor_veiculo || ""
        };
      } else if (altType === "contato") {
        const newTel = document.getElementById("alt-new-telefone") ? document.getElementById("alt-new-telefone").value.trim() : "";
        const newEmail = document.getElementById("alt-new-email") ? document.getElementById("alt-new-email").value.trim() : "";
        dadosAnteriores = {
          telefone: currentUser.telefone || "",
          email: currentUser.email || ""
        };
        dadosNovos = {
          telefone: newTel || currentUser.telefone || "",
          email: newEmail || currentUser.email || ""
        };
      } else {
        const newNome = document.getElementById("alt-new-nome") ? document.getElementById("alt-new-nome").value.trim() : "";
        dadosAnteriores = { nome: currentUser.nome || currentUser.nome_social || "" };
        dadosNovos = { nome: newNome || currentUser.nome || "" };
      }

      const novaSolicitacao = {
        id: "solic-" + Date.now(),
        tipo_usuario: userType,
        usuario_id: userId,
        usuario_nome: userName,
        tipo_alteracao: altType,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        justificativa: just || "Solicitação de atualização via aplicativo",
        status: "Pendente",
        created_at: new Date().toISOString()
      };

      // Marca flag no usuário no cache oficial
      currentUser.solicitacao_pendente = true;
      if (userType === "passageiro") {
        localStorage.setItem("sr_passageiros_cache", JSON.stringify(passageirosCache));
      } else {
        localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
      }

      solicitacoesCache.unshift(novaSolicitacao);
      localStorage.setItem("sr_solicitacoes_cache", JSON.stringify(solicitacoesCache));

      // Persiste no Supabase
      if (supabaseClient) {
        try {
          const insertPayload = {
            tipo_usuario: userType,
            usuario_id: userId,
            usuario_nome: userName,
            tipo_alteracao: altType,
            dados_anteriores: dadosAnteriores,
            dados_novos: dadosNovos,
            justificativa: just || "Solicitação de atualização via aplicativo",
            status: "Pendente"
          };
          await supabaseClient.from("solicitacoes_alteracao").insert([insertPayload]);
          const targetTable = userType === "passageiro" ? "passageiros" : "motoristas";
          await supabaseClient.from(targetTable).update({ solicitacao_pendente: true }).eq("id", userId);
        } catch (dbErr) {
          console.warn("Aviso ao inserir solicitacao no Supabase:", dbErr.message);
        }
      }

      showNotification(`Solicitação enviada com sucesso! Status: "Aguardando aprovação". Os dados oficiais permanecem inalterados até moderação.`, "info");
      fechar();
      updateMetrics();
      renderOverviewApprovals();
      renderSolicitacoes();
      renderPassengersBase();
      renderDrivers();
    });
  }
}

function getInitialSolicitacoesMock() {
  return [
    {
      id: "solic-01",
      tipo_usuario: "passageiro",
      usuario_id: "demo-pass-01",
      usuario_nome: "Ana Beatriz Costa",
      tipo_alteracao: "empresa",
      dados_anteriores: {
        empresa: "Samsung Eletrônica da Amazônia",
        setor: "Montagem / Produção",
        matricula: "SAM-8890"
      },
      dados_novos: {
        empresa: "Cal-Comp Indústria da Amazônia",
        setor: "Engenharia de Processos",
        matricula: "CC-10442"
      },
      justificativa: "Transferência de empresa no polo industrial com início de novo contrato.",
      status: "Pendente",
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    },
    {
      id: "solic-02",
      tipo_usuario: "motorista",
      usuario_id: "drv-01",
      usuario_nome: "Silvio Ramos Martins",
      tipo_alteracao: "veiculo",
      dados_anteriores: {
        marca_veiculo: "Toyota",
        modelo_veiculo: "Corolla XEi",
        placa_veiculo: "PHA-4E21",
        cor_veiculo: "Prata"
      },
      dados_novos: {
        marca_veiculo: "Toyota",
        modelo_veiculo: "Corolla Cross XRE",
        placa_veiculo: "SRL-9A88",
        cor_veiculo: "Branco Pérola"
      },
      justificativa: "Troca do veículo de atendimento operacional por modelo mais novo.",
      status: "Pendente",
      created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
    }
  ];
}

// --- ABA: APROVAÇÕES DE PASSAGEIROS ---
function setupPassengerFilters() {
  const searchInput = document.getElementById("search-passenger-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      passengerSearchQuery = e.target.value.toLowerCase().trim();
      renderPassengerApprovals();
    });
  }

  const companySelect = document.getElementById("filter-passenger-company");
  if (companySelect) {
    companySelect.addEventListener("change", (e) => {
      passengerCompanyFilter = e.target.value;
      renderPassengerApprovals();
    });
  }

  const searchBaseInput = document.getElementById(
    "search-passengers-base-input",
  );
  if (searchBaseInput) {
    searchBaseInput.addEventListener("input", (e) => {
      passengerBaseSearchQuery = e.target.value.toLowerCase().trim();
      renderPassengersBase();
    });
  }
}

function updateCompanyFilterOptions() {
  const select = document.getElementById("filter-passenger-company");
  if (!select) return;

  const currentSelected = select.value;
  const fromPass = passageirosCache.map((p) => p.empresa).filter((emp) => emp && emp.trim() !== "");
  const fromComp = empresasCache.map((c) => c.trade_name || c.name).filter((emp) => emp && emp.trim() !== "");
  const companies = Array.from(new Set([...fromPass, ...fromComp])).sort();

  let html = '<option value="">Todas as empresas</option>';
  companies.forEach((emp) => {
    html += `<option value="${escapeHtml(emp)}" ${currentSelected === emp ? "selected" : ""}>${escapeHtml(emp)}</option>`;
  });
  select.innerHTML = html;
}

function renderPassengerApprovals() {
  const container = document.getElementById("passenger-approvals-container");
  if (!container) return;

  let list = passageirosCache.slice();

  // Filtro por Aba
  if (currentPassengerTab === "pending") {
    list = list.filter((p) => p.status === "Pendente");
  } else if (currentPassengerTab === "approved") {
    list = list.filter((p) => p.status === "Aprovado");
  } else if (currentPassengerTab === "rejected") {
    list = list.filter((p) => p.status === "Reprovado");
  }

  // Filtro por Empresa
  if (passengerCompanyFilter) {
    list = list.filter((p) => p.empresa === passengerCompanyFilter);
  }

  // Filtro por Busca de Texto
  if (passengerSearchQuery) {
    list = list.filter((p) => {
      const full = [
        p.nome,
        p.nome_social,
        p.nome_completo,
        p.cpf,
        p.telefone,
        p.email,
        p.empresa,
        p.setor,
        p.matricula,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return full.includes(passengerSearchQuery);
    });
  }

  if (list.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p><i class="fas fa-users-slash" style="font-size:24px; color:#94a3b8; margin-bottom:8px; display:block;"></i>Nenhum cadastro de passageiro encontrado com os filtros selecionados.</p></div>';
    return;
  }

  let html = `
    <table class="approval-table" style="width:100%; border-collapse:collapse; text-align:left;">
      <thead>
        <tr>
          <th style="width:50px;">Foto</th>
          <th>Passageiro / Nome</th>
          <th>Contato & E-mail</th>
          <th>Empresa & Setor</th>
          <th>Turno / Matrícula</th>
          <th>Status do Voucher</th>
          <th>Status Geral</th>
          <th style="text-align:right;">Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  list.forEach((p) => {
    const isPending = p.status === "Pendente";
    const isApproved = p.status === "Aprovado";
    const photoStatus = p.foto_status || "Pendente";
    const dateFormatted = p.created_at
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(p.created_at))
      : "—";

    const cleanPhone = (p.telefone || "").replace(/\D/g, "");
    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

    html += `
      <tr style="border-bottom:1px solid var(--line); font-size:13px;">
        <td style="padding:12px 14px; text-align:center;">
          ${renderAvatarHTML(p, "passenger")}
        </td>
        <td style="padding:14px 16px;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong>${escapeHtml(p.nome_social || p.nome)}</strong>
            <span class="photo-status-badge ${photoStatus === 'Aprovada' ? 'approved' : photoStatus === 'Rejeitada' ? 'rejected' : 'pending'}">
              <i class="fas fa-camera"></i> ${photoStatus === 'Aprovada' ? 'Foto Aprovada' : photoStatus === 'Rejeitada' ? 'Foto Reprovada' : 'Foto em Análise'}
            </span>
            ${p.solicitacao_pendente ? `<span class="alteration-badge-pending" title="Solicitação de alteração cadastral em análise"><i class="fas fa-file-pen"></i> Alteração em Análise</span>` : ''}
          </div>
          <small style="color:var(--ink-soft); display:block;">${escapeHtml(p.nome_completo || p.nome || "")}</small>
          <small style="color:#788b90; display:block;">CPF: ${escapeHtml(p.cpf || "Não inf.")}</small>
        </td>
        <td style="padding:14px 16px;">
          ${
            waLink
              ? `<a href="${waLink}" target="_blank" style="color:var(--green); font-weight:700; text-decoration:none;"><i class="fab fa-whatsapp"></i> ${escapeHtml(p.telefone || "Sem fone")}</a>`
              : `<span>${escapeHtml(p.telefone || "Sem fone")}</span>`
          }
          <small style="color:var(--ink-soft); display:block;">${escapeHtml(p.email || "Sem e-mail")}</small>
        </td>
        <td style="padding:14px 16px;">
          <span class="tag-company">${escapeHtml(p.empresa || "SR")}</span>
          <small style="color:var(--ink-soft); display:block; margin-top:3px;">${escapeHtml(p.setor || "Geral")}</small>
        </td>
        <td style="padding:14px 16px;">
          <span class="tag-dept">${escapeHtml(p.matricula || p.turno || "Padrão")}</span>
          ${p.endereco ? `<small style="color:#788b90; display:block; margin-top:2px;" title="${escapeHtml(p.endereco)}"><i class="fas fa-location-dot"></i> ${escapeHtml(p.endereco.slice(0, 25))}${p.endereco.length > 25 ? "..." : ""}</small>` : ""}
        </td>
        <td style="padding:14px 16px;">
          ${
            isApproved
              ? `<span class="voucher-status-tag unlocked"><i class="fas fa-ticket"></i> Voucher Liberado (Padrão)</span>`
              : isPending
              ? `<span class="voucher-status-tag locked"><i class="fas fa-clock"></i> Em Análise (Apenas PIX)</span>`
              : `<span class="voucher-status-tag locked" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;"><i class="fas fa-ban"></i> Acesso Bloqueado</span>`
          }
        </td>
        <td style="padding:14px 16px;">
          <span class="status-badge ${isPending ? "pending" : isApproved ? "approved" : "rejected"}">
            ${escapeHtml(p.status)}
          </span>
          <small style="color:var(--ink-soft); display:block; font-size:10px; margin-top:3px;">${dateFormatted}</small>
        </td>
        <td style="padding:14px 16px; text-align:right; white-space:nowrap;">
          ${
            isPending
              ? `
              <button class="btn btn-primary" style="padding:5px 11px; font-size:11px; margin-right:4px; width:auto; min-height:30px;" onclick="approvePassenger('${p.id}')" title="Homologar e liberar Voucher Corporativo">
                <i class="fas fa-check"></i> Homologar
              </button>
              <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:30px; margin-right:4px;" onclick="rejectPassenger('${p.id}')" title="Reprovar">
                <i class="fas fa-ban"></i>
              </button>
              <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:30px;" onclick="deletePassenger('${p.id}')" title="Excluir cadastro permanentemente">
                <i class="fas fa-trash-can" style="color:var(--red);"></i>
              </button>
            `
              : `
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; min-height:28px; margin-right:4px;" onclick="deletePassenger('${p.id}')" title="Excluir cadastro permanentemente">
                <i class="fas fa-trash-can" style="color:var(--red);"></i> Excluir
              </button>
              ${
                !isApproved
                  ? `<button class="btn btn-primary" style="padding:4px 8px; font-size:11px; width:auto; min-height:28px;" onclick="approvePassenger('${p.id}')">Reativar & Liberar Voucher</button>`
                  : ""
              }
            `
          }
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

// --- ABA: PASSAGEIROS HOMOLOGADOS (BASE ATIVA) ---
function renderPassengersBase() {
  const container = document.getElementById("passengers-container");
  if (!container) return;

  let ativos = passageirosCache.filter((p) => p.status === "Aprovado");

  if (passengerBaseSearchQuery) {
    ativos = ativos.filter((p) => {
      const full = [p.nome, p.nome_social, p.cpf, p.telefone, p.empresa, p.setor, p.matricula]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return full.includes(passengerBaseSearchQuery);
    });
  }

  if (ativos.length === 0) {
    container.innerHTML =
      '<p class="loading-state">Nenhum passageiro homologado encontrado.</p>';
    return;
  }

  let html = "";
  ativos.forEach((p) => {
    const cleanPhone = (p.telefone || "").replace(/\D/g, "");
    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;
    const photoStatus = p.foto_status || "Aprovada";

    html += `
      <div class="driver-card" style="background:var(--white); border:1px solid var(--line); border-radius:var(--radius); padding:18px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          ${renderAvatarHTML(p, "passenger")}
          <div style="flex:1; min-width:0;">
            <strong style="font-size:14px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.nome_social || p.nome)}</strong>
            <small style="font-size:11px; color:var(--ink-soft);">${escapeHtml(p.nome_completo || "")}</small>
          </div>
          <span class="status-badge approved" style="margin-left:auto;">Homologado</span>
        </div>

        <div style="margin-bottom:10px; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
          <span class="voucher-status-tag unlocked"><i class="fas fa-ticket"></i> Voucher Corporativo Liberado</span>
          <span class="photo-status-badge ${photoStatus === 'Aprovada' ? 'approved' : photoStatus === 'Rejeitada' ? 'rejected' : 'pending'}">
            <i class="fas fa-camera"></i> ${photoStatus === 'Aprovada' ? 'Foto Aprovada' : photoStatus === 'Rejeitada' ? 'Foto Reprovada' : 'Foto Pendente'}
          </span>
          ${p.solicitacao_pendente ? `<span class="alteration-badge-pending" title="Solicitação de alteração cadastral em análise"><i class="fas fa-file-pen"></i> Alteração em Análise</span>` : ''}
        </div>

        <div style="border-top:1px solid var(--line); padding-top:12px; font-size:12px; color:var(--ink); line-height:1.7;">
          <div><i class="fas fa-building" style="width:18px; color:var(--green);"></i> <strong>${escapeHtml(p.empresa || "Empresa Geral")}</strong></div>
          <div><i class="fas fa-sitemap" style="width:18px; color:var(--green);"></i> Setor: ${escapeHtml(p.setor || "Operacional")}</div>
          <div><i class="fas fa-id-badge" style="width:18px; color:var(--green);"></i> Matrícula/Turno: <strong>${escapeHtml(p.matricula || p.turno || "Padrão")}</strong></div>
          <div>
            <i class="fab fa-whatsapp" style="width:18px; color:var(--green);"></i>
            ${waLink ? `<a href="${waLink}" target="_blank" style="color:var(--green); font-weight:700;">${escapeHtml(p.telefone || "Sem fone")}</a>` : escapeHtml(p.telefone || "Sem fone")}
          </div>
          ${p.email ? `<div><i class="fas fa-envelope" style="width:18px; color:var(--green);"></i> ${escapeHtml(p.email)}</div>` : ""}
          ${p.endereco ? `<div><i class="fas fa-location-dot" style="width:18px; color:var(--green);"></i> <small style="color:var(--ink-soft);">${escapeHtml(p.endereco)}</small></div>` : ""}
        </div>

        <div style="border-top:1px solid var(--line); margin-top:14px; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
          <small style="color:#788b90; font-size:10px;">Origem: ${escapeHtml(p.origem || "App Passageiro")}</small>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" style="padding:3px 8px; font-size:11px; min-height:26px;" onclick="rejectPassenger('${p.id}')" title="Suspender / Desativar acesso ao voucher">
              <i class="fas fa-ban" style="color:#be7b20;"></i> Suspender
            </button>
            <button class="btn btn-secondary" style="padding:3px 8px; font-size:11px; min-height:26px;" onclick="deletePassenger('${p.id}')" title="Excluir cadastro permanentemente">
              <i class="fas fa-trash-can" style="color:var(--red);"></i> Excluir
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// --- FUNÇÕES DE APROVAÇÃO & GESTÃO DE PASSAGEIROS ---
window.approvePassenger = async function (id) {
  if (!confirm("Deseja homologar o passageiro e liberar o acesso a Voucher Corporativo nas viagens?"))
    return;

  try {
    if (supabaseClient) {
      try {
        await supabaseClient
          .from("passageiros")
          .update({
            status: "Aprovado",
            foto_status: "Aprovada",
            voucher_habilitado: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", id);
      } catch (_) {}

      try {
        await supabaseClient
          .from("profiles")
          .update({
            status: "active",
            is_approved: true,
            approved: true,
            foto_status: "Aprovada",
            photo_status: "approved",
            voucher_habilitado: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", id);
      } catch (_) {}
    }

    // Atualiza cache local
    const item = passageirosCache.find((p) => String(p.id) === String(id));
    if (item) {
      item.status = "Aprovado";
      item.foto_status = "Aprovada";
      item.voucher_habilitado = true;
      item.updated_at = new Date().toISOString();
    }
    localStorage.setItem(
      "sr_passageiros_cache",
      JSON.stringify(passageirosCache),
    );

    showNotification("Passageiro homologado com sucesso! Acesso a Voucher Corporativo liberado.", "success");
    await loadPassageiros();
  } catch (err) {
    showNotification("Erro ao homologar passageiro: " + err.message, "error");
  }
};

window.rejectPassenger = async function (id) {
  const reason = prompt(
    "Informe o motivo da recusa (opcional):",
    "Dados da empresa/matrícula inconsistentes",
  );
  if (reason === null) return;

  try {
    if (supabaseClient) {
      try {
        await supabaseClient
          .from("passageiros")
          .update({
            status: "Reprovado",
            voucher_habilitado: false,
            motivo_rejeicao: reason,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      } catch (_) {}

      try {
        await supabaseClient
          .from("profiles")
          .update({
            status: "blocked",
            is_approved: false,
            approved: false,
            voucher_habilitado: false,
            motivo_rejeicao: reason,
            rejection_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      } catch (_) {}
    }

    // Atualiza cache local
    const item = passageirosCache.find((p) => String(p.id) === String(id));
    if (item) {
      item.status = "Reprovado";
      item.voucher_habilitado = false;
      item.motivo_rejeicao = reason;
      item.updated_at = new Date().toISOString();
    }
    localStorage.setItem(
      "sr_passageiros_cache",
      JSON.stringify(passageirosCache),
    );

    showNotification("Solicitação de passageiro reprovada.", "warning");
    await loadPassageiros();
  } catch (err) {
    showNotification("Erro ao reprovar passageiro: " + err.message, "error");
  }
};

window.deletePassenger = async function (id) {
  if (!confirm("Deseja realmente excluir este cadastro de passageiro permanentemente?")) return;

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("passageiros")
        .delete()
        .eq("id", id);
      if (error && error.code !== "PGRST205") throw error;
    }

    passageirosCache = passageirosCache.filter(
      (p) => String(p.id) !== String(id),
    );
    localStorage.setItem(
      "sr_passageiros_cache",
      JSON.stringify(passageirosCache),
    );

    showNotification("Passageiro excluído com sucesso.", "info");
    await loadPassageiros();
  } catch (err) {
    showNotification("Erro ao excluir passageiro: " + err.message, "error");
  }
};

// --- MODAL: SIMULAÇÃO / CADASTRO DE PASSAGEIRO ---
function setupPassengerModal() {
  const modal = document.getElementById("passenger-modal");
  const btnOpen = document.getElementById("btn-open-passenger-modal");
  const btnOpenBase = document.getElementById("btn-open-passenger-modal-base");
  const btnQuickSim = document.getElementById("quick-btn-simulate-passenger");
  const btnClose = document.getElementById("close-passenger-modal");
  const form = document.getElementById("passenger-sim-form");
  const feedback = document.getElementById("passenger-sim-feedback");
  const photoUrlInput = document.getElementById("pass-photo-url");
  const photoPreview = document.getElementById("pass-modal-avatar-preview");

  if (photoUrlInput && photoPreview) {
    photoUrlInput.addEventListener("input", (e) => {
      const url = e.target.value.trim();
      if (url) {
        photoPreview.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>'">`;
      } else {
        photoPreview.innerHTML = `<i class="fas fa-user"></i>`;
      }
    });
  }

  const openModal = () => {
    if (modal) modal.classList.remove("hidden");
    if (feedback) {
      feedback.textContent = "";
      feedback.className = "feedback-msg";
    }
    if (photoPreview) photoPreview.innerHTML = `<i class="fas fa-user"></i>`;
  };

  const closeModal = () => {
    if (modal) modal.classList.add("hidden");
  };

  if (btnOpen) btnOpen.addEventListener("click", openModal);
  if (btnOpenBase) btnOpenBase.addEventListener("click", openModal);
  if (btnQuickSim) btnQuickSim.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const photoUrl = document.getElementById("pass-photo-url")?.value.trim();
      const photoStatus = document.getElementById("pass-photo-status")?.value || (photoUrl ? "Aprovada" : "Pendente");
      const name = document.getElementById("pass-name")?.value.trim();
      const social = document.getElementById("pass-social")?.value.trim();
      const phone = document.getElementById("pass-phone")?.value.trim();
      const email = document.getElementById("pass-email")?.value.trim();
      const cpf = document.getElementById("pass-cpf")?.value.trim();
      const company = document.getElementById("pass-company")?.value.trim();
      const dept = document.getElementById("pass-dept")?.value.trim();
      const shift = document.getElementById("pass-shift")?.value.trim();
      const address = document.getElementById("pass-address")?.value.trim();

      if (!name || !phone || !company) {
        if (feedback) {
          feedback.textContent = "Preencha o Nome Completo, Telefone e Empresa.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      const newPassenger = {
        id: "pass-" + Date.now(),
        foto_url: photoUrl || null,
        avatar_url: photoUrl || null,
        foto_status: photoStatus,
        payment_preference: "VOUCHER",
        voucher_habilitado: false,
        nome: social || name,
        nome_social: social || name.split(" ")[0],
        nome_completo: name,
        cpf: cpf || "Não informado",
        telefone: phone,
        email: email || null,
        empresa: company,
        setor: dept || "Operações",
        matricula: shift || "Turno Padrão",
        turno: shift || "Turno Padrão",
        endereco: address || null,
        origem: "App Passageiro",
        status: "Pendente",
        created_at: new Date().toISOString(),
      };

      if (feedback) {
        feedback.textContent = "Enviando cadastro...";
        feedback.className = "feedback-msg info";
      }

      try {
        if (supabaseClient) {
          const { error } = await supabaseClient
            .from("passageiros")
            .insert([newPassenger]);
          if (error && error.code !== "PGRST205") throw error;
        }

        // Salva no cache local
        passageirosCache.unshift(newPassenger);
        localStorage.setItem(
          "sr_passageiros_cache",
          JSON.stringify(passageirosCache),
        );

        if (feedback) {
          feedback.textContent =
            "Cadastro enviado com sucesso! Solicitação aguardando aprovação na fila.";
          feedback.className = "feedback-msg success";
        }

        form.reset();
        await loadPassageiros();

        setTimeout(() => {
          closeModal();
          switchView("passenger-approvals");
        }, 1200);
      } catch (err) {
        if (feedback) {
          feedback.textContent = "Erro ao enviar cadastro: " + err.message;
          feedback.className = "feedback-msg error";
        }
      }
    });
  }
}

// --- REGRAS DE DISPATCH E ELEGIBILIDADE POR CATEGORIA ---
function isVoucherPayment(paymentMethod) {
  if (!paymentMethod) return true;
  const method = String(paymentMethod).toLowerCase();
  return (
    method.includes("voucher") ||
    method.includes("convenio") ||
    method.includes("convênio") ||
    method.includes("empresa") ||
    method.includes("corporativo") ||
    method.includes("fatur")
  );
}

function isDriverEligibleForRide(driver, ride) {
  if (!driver) return false;
  const isEmpresa = driver.categoria_tipo === "empresa" || driver.categoria === "Empresa";
  if (!isEmpresa) {
    // Motorista Particular: recebe OS DOIS (Voucher Corporativo e Corridas Particulares)
    return true;
  }
  // Motorista Frota Empresa: recebe APENAS corridas em Voucher
  const paymentMethod = typeof ride === "string" ? ride : (ride?.payment_method || "Voucher Corporativo");
  return isVoucherPayment(paymentMethod);
}

function getEligibleDriversForRide(ride) {
  return motoristasCache.filter(
    (m) => m.status === "Aprovado" && isDriverEligibleForRide(m, ride)
  );
}

// --- ABA: APROVAÇÕES DE MOTORISTAS ---
function renderApprovals() {
  const container = document.getElementById("approvals-container");
  if (!container) return;

  let list = [];
  if (currentDriverTab === "pending") {
    list = motoristasCache.filter(
      (m) => m.status === "Pendente" || m.vehicle_status === "Pendente",
    );
  } else if (currentDriverTab === "approved") {
    list = motoristasCache.filter((m) => m.status === "Aprovado");
  } else if (currentDriverTab === "rejected") {
    list = motoristasCache.filter((m) => m.status === "Reprovado");
  } else {
    // "all"
    list = [...motoristasCache];
  }

  if (list.length === 0) {
    container.innerHTML =
      '<p class="loading-state">Nenhum registro encontrado nesta aba de motoristas.</p>';
    return;
  }

    let html =
    '<table class="approval-table" style="width:100%; text-align:left; border-collapse:collapse;">';
  html +=
    '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.15); font-size:12px; color:#94a3b8;">';
  html += '<th style="padding:10px; width:50px;">Foto</th>';
  html += '<th style="padding:10px;">Como deseja ser chamado / Nome</th>';
  html += '<th style="padding:10px;">Contato</th>';
  html += '<th style="padding:10px;">Veículo & Placa</th>';
  html += '<th style="padding:10px;">Tipo Entrada</th>';
  html += '<th style="padding:10px;">Categoria & Regra de Corridas</th>';
  html += '<th style="padding:10px;">Status</th>';
  html += '<th style="padding:10px; text-align:right;">Ações</th>';
  html += "</tr></thead><tbody>";

  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const isVehicleChange =
      m.vehicle_status === "Pendente" && m.status === "Aprovado";
    const isPending =
      m.status === "Pendente" || m.vehicle_status === "Pendente";
    const isApproved = m.status === "Aprovado";
    const isEmpresa = m.categoria_tipo === "empresa" || m.categoria === "Empresa";
    const photoStatus = m.foto_status || "Pendente";

    html +=
      '<tr style="border-bottom:1px solid var(--line); font-size:13px;">';
    html +=
      '  <td style="padding:10px; text-align:center;">' +
      renderAvatarHTML(m, "driver") +
      '  </td>';
    html +=
      '  <td style="padding:10px;"><div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong>' +
      escapeHtml(m.nome_social || m.nome) +
      '</strong>' +
      '<span class="photo-status-badge ' + (photoStatus === 'Aprovada' ? 'approved' : photoStatus === 'Rejeitada' ? 'rejected' : 'pending') + '"><i class="fas fa-camera"></i> ' +
      (photoStatus === 'Aprovada' ? 'Foto OK' : photoStatus === 'Rejeitada' ? 'Foto Reprovada' : 'Foto Pendente') +
      '</span>' +
      (m.solicitacao_pendente ? '<span class="alteration-badge-pending" title="Solicitação de alteração cadastral em análise"><i class="fas fa-file-pen"></i> Alteração em Análise</span>' : '') +
      '</div><small style="color:var(--ink-soft);">' +
      escapeHtml(m.nome_completo || m.nome || "") +
      '</small><br><small style="color:#788b90">CPF: ' +
      escapeHtml(m.cpf || "—") +
      "</small></td>";
    html +=
      '  <td style="padding:10px;">' +
      escapeHtml(m.telefone || m.phone || "—") +
      '<br><small style="color:var(--ink-soft);">' +
      escapeHtml(m.email || "") +
      "</small></td>";
    html +=
      '  <td style="padding:10px;"><strong>' +
      escapeHtml(m.marca_veiculo || "") +
      " " +
      escapeHtml(m.modelo_veiculo || "") +
      '</strong><br><span style="background:var(--paper); padding: 2px 6px; border-radius: 4px; font-weight: bold; border:1px solid var(--line);">' +
      escapeHtml(m.placa_veiculo || "—") +
      '</span> <small style="color:var(--ink-soft);">' +
      escapeHtml(m.cor_veiculo || "") +
      "</small></td>";
    html +=
      '  <td style="padding:10px;">' +
      (isVehicleChange
        ? '<span style="color:#be7b20; font-weight:bold;">Troca de Carro</span>'
        : '<span style="color:var(--green); font-weight: bold;">Novo Cadastro</span>') +
      "</td>";
    html +=
      '  <td style="padding:10px; min-width:210px;">' +
      '    <select onchange="changeDriverCategory(\'' + m.id + '\', this.value)" style="width:100%; background:var(--paper); border:1px solid var(--line); border-radius:6px; font-size:11px; padding:5px 6px; font-weight:bold; color:var(--ink); cursor:pointer;">' +
      '      <option value="particular" ' + (!isEmpresa ? 'selected' : '') + '>👤 Particular (Voucher + Particular)</option>' +
      '      <option value="empresa" ' + (isEmpresa ? 'selected' : '') + '>🏢 Empresa (Apenas Voucher)</option>' +
      '    </select>' +
      '    <div class="driver-rule-badge ' + (isEmpresa ? 'empresa' : 'particular') + '">' +
      (isEmpresa
        ? '<i class="fas fa-building"></i> <strong>Apenas Voucher</strong> (Faturamento Corporativo)'
        : '<i class="fas fa-user-check"></i> <strong>Recebe os Dois</strong> (Voucher e Particulares)') +
      '    </div>' +
      '  </td>';
    html +=
      '  <td style="padding:10px;"><span class="status-badge ' +
      (isPending ? "pending" : isApproved ? "approved" : "rejected") +
      '">' +
      (isVehicleChange ? "Carro em Análise" : escapeHtml(m.status || "Pendente")) +
      "</span></td>";
    html += '  <td style="padding:10px; text-align:right; white-space:nowrap;">';

    html +=
      '    <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:30px; margin-right:4px;" onclick="openEditDriverModal(\'' +
      m.id +
      '\')" title="Editar dados do motorista"><i class="fas fa-pen-to-square"></i></button>';

    if (isPending) {
      html +=
        '    <button class="btn btn-primary" style="padding:5px 11px; font-size:11px; margin-right:4px; width:auto; min-height:30px;" onclick="approveDriver(\'' +
        m.id +
        '\')"><i class="fas fa-check"></i> Aprovar</button>';
      html +=
        '    <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:30px; margin-right:4px;" onclick="rejectDriver(\'' +
        m.id +
        '\')" title="Reprovar / Desativar"><i class="fas fa-ban" style="color:#be7b20;"></i> Desativar</button>';
      html +=
        '    <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:30px;" onclick="deleteDriver(\'' +
        m.id +
        '\')" title="Excluir cadastro permanentemente"><i class="fas fa-trash-can" style="color:var(--red);"></i> Excluir</button>';
    } else if (isApproved) {
      html +=
        '    <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; min-height:28px; margin-right:4px;" onclick="rejectDriver(\'' +
        m.id +
        '\')" title="Suspender / Desativar motorista"><i class="fas fa-ban" style="color:#be7b20;"></i> Desativar</button>';
      html +=
        '    <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; min-height:28px;" onclick="deleteDriver(\'' +
        m.id +
        '\')" title="Excluir motorista permanentemente"><i class="fas fa-trash-can" style="color:var(--red);"></i> Excluir</button>';
    } else {
      // Reprovado / Desativado
      html +=
        '    <button class="btn btn-primary" style="padding:4px 8px; font-size:11px; width:auto; min-height:28px; margin-right:4px;" onclick="approveDriver(\'' +
        m.id +
        '\')" title="Reativar e aprovar motorista"><i class="fas fa-rotate-left"></i> Reativar</button>';
      html +=
        '    <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; min-height:28px;" onclick="deleteDriver(\'' +
        m.id +
        '\')" title="Excluir motorista permanentemente"><i class="fas fa-trash-can" style="color:var(--red);"></i> Excluir</button>';
    }

    html += "  </td>";
    html += "</tr>";
  }

  html += "</tbody></table>";
  container.innerHTML = html;
}

// --- ABA: MOTORISTAS ATIVOS ---
function renderDrivers() {
  const container = document.getElementById("drivers-container");
  if (!container) return;

  const ativos = motoristasCache.filter((m) => m.status === "Aprovado");
  if (ativos.length === 0) {
    container.innerHTML =
      '<p class="loading-state">Nenhum motorista homologado no momento.</p>';
    return;
  }

  let html = "";
  for (let i = 0; i < ativos.length; i++) {
    const m = ativos[i];
    const isEmpresa = m.categoria_tipo === "empresa" || m.categoria === "Empresa";
    const photoStatus = m.foto_status || "Aprovada";

    html += `
      <div class="driver-card" style="background:var(--white); border:1px solid var(--line); border-radius:var(--radius); padding:18px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          ${renderAvatarHTML(m, "driver")}
          <div style="flex:1; min-width:0;">
            <strong style="font-size:14px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.nome_social || m.nome)}</strong>
            <small style="font-size:11px; color:var(--ink-soft);">${escapeHtml(m.nome_completo || "")}</small>
          </div>
          <span class="${isEmpresa ? 'tag-category-empresa' : 'tag-category-particular'}">
            <i class="fas ${isEmpresa ? 'fa-building' : 'fa-user'}"></i> ${isEmpresa ? 'Frota Empresa' : 'Particular'}
          </span>
        </div>

        <div style="margin-bottom:8px; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
          <span class="photo-status-badge ${photoStatus === 'Aprovada' ? 'approved' : photoStatus === 'Rejeitada' ? 'rejected' : 'pending'}">
            <i class="fas fa-camera"></i> ${photoStatus === 'Aprovada' ? 'Foto Aprovada' : photoStatus === 'Rejeitada' ? 'Foto Reprovada' : 'Foto Pendente'}
          </span>
          ${m.solicitacao_pendente ? `<span class="alteration-badge-pending" title="Solicitação de alteração cadastral em análise"><i class="fas fa-file-pen"></i> Alteração em Análise</span>` : ''}
        </div>

        <div class="driver-detail" style="font-size:12px; line-height:1.7;">
          <div><i class="fas fa-car" style="width:18px; color:var(--green);"></i> ${escapeHtml(m.marca_veiculo || "")} ${escapeHtml(m.modelo_veiculo || "Veículo não inf.")}</div>
          <div><i class="fas fa-id-card" style="width:18px; color:var(--green);"></i> Placa: <strong>${escapeHtml(m.placa_veiculo || "—")}</strong> (${escapeHtml(m.cor_veiculo || "Cor —")})</div>
          <div><i class="fas fa-phone" style="width:18px; color:var(--green);"></i> ${escapeHtml(m.telefone || m.phone || "Sem telefone")}</div>
          <div><i class="fas fa-location-dot" style="width:18px; color:var(--green);"></i> Manaus - AM</div>
        </div>

        <!-- Seletor de Categoria do Motorista e Regra de Despacho -->
        <div style="margin-top:10px; padding:10px; background:var(--paper); border-radius:8px; border:1px solid var(--line);">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <span style="font-size:11px; font-weight:bold; color:var(--ink-soft);"><i class="fas fa-tags" style="color:var(--amber);"></i> Categoria:</span>
            <select onchange="changeDriverCategory('${m.id}', this.value)" style="background:var(--white); border:1px solid var(--line); border-radius:6px; font-size:11px; padding:4px 6px; font-weight:bold; color:var(--ink); cursor:pointer;">
              <option value="particular" ${!isEmpresa ? 'selected' : ''}>👤 Motorista Particular</option>
              <option value="empresa" ${isEmpresa ? 'selected' : ''}>🏢 Frota Empresa / Convênio</option>
            </select>
          </div>
          <div class="driver-rule-badge ${isEmpresa ? 'empresa' : 'particular'}">
            ${isEmpresa
              ? '<i class="fas fa-building"></i> <strong>Apenas Voucher:</strong> Atende exclusivamente faturamento corporativo.'
              : '<i class="fas fa-user-check"></i> <strong>Recebe os Dois:</strong> Atende Voucher corporativo e corridas particulares.'}
          </div>
        </div>

        <div style="border-top:1px solid var(--line); margin-top:14px; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
          <small style="color:#788b90; font-size:10px;">Status: <strong style="color:var(--green);">Ativo</strong></small>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" style="padding:3px 8px; font-size:11px; min-height:26px;" onclick="openEditDriverModal('${m.id}')" title="Editar motorista">
              <i class="fas fa-pen-to-square"></i> Editar
            </button>
            <button class="btn btn-secondary" style="padding:3px 8px; font-size:11px; min-height:26px;" onclick="rejectDriver('${m.id}')" title="Suspender / Desativar motorista">
              <i class="fas fa-ban" style="color:#be7b20;"></i> Desativar
            </button>
            <button class="btn btn-secondary" style="padding:3px 8px; font-size:11px; min-height:26px;" onclick="deleteDriver('${m.id}')" title="Excluir motorista permanentemente">
              <i class="fas fa-trash-can" style="color:var(--red);"></i> Excluir
            </button>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// --- FUNÇÕES DE APROVAÇÃO E GESTÃO DE MOTORISTAS ---
window.changeDriverCategory = async function (driverId, newCategory) {
  try {
    const isEmpresa = newCategory === "empresa" || newCategory === "Empresa";
    const catTipo = isEmpresa ? "empresa" : "particular";
    const catLabel = isEmpresa ? "Frota Corporativa / Empresa" : "Motorista Particular";
    const ruleLabel = isEmpresa
      ? "Este motorista agora receberá APENAS corridas em Voucher corporativo."
      : "Este motorista agora receberá os DOIS tipos de corridas (Voucher e Particulares).";

    // 1. Atualiza cache em memória imediatamente
    const item = motoristasCache.find((m) => String(m.id) === String(driverId));
    if (item) {
      item.categoria_tipo = catTipo;
      item.categoria = isEmpresa ? "Empresa" : "Particular";
      item.recebe_voucher = true;
      item.recebe_particular = !isEmpresa;
      item.updated_at = new Date().toISOString();
    }
    // 2. Persistir no LocalStorage imediatamente
    localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));

    // 3. Atualizar no Supabase com resiliência de schema
    if (supabaseClient) {
      try {
        const { error: errFull } = await supabaseClient
          .from("motoristas")
          .update({
            categoria_tipo: catTipo,
            categoria: isEmpresa ? "Empresa" : "Particular",
            recebe_voucher: true,
            recebe_particular: !isEmpresa,
            updated_at: new Date().toISOString()
          })
          .eq("id", driverId);

        if (errFull) {
          console.warn("Tentando fallback de atualização de categoria:", errFull.message);
          const { error: errTipo } = await supabaseClient
            .from("motoristas")
            .update({ categoria_tipo: catTipo })
            .eq("id", driverId);

          if (errTipo) {
            await supabaseClient
              .from("motoristas")
              .update({ categoria: isEmpresa ? "Empresa" : "Particular" })
              .eq("id", driverId);
          }
        }
      } catch (dbErr) {
        console.warn("Aviso ao sincronizar categoria no Supabase (salvo localmente):", dbErr);
      }
    }

    showNotification(`Categoria salva: ${catLabel}! ${ruleLabel}`, "success");
    renderOverviewApprovals();
    renderApprovals();
    renderDrivers();
  } catch (err) {
    console.error("Erro ao alterar categoria do motorista:", err);
    showNotification("Erro ao alterar categoria do motorista: " + err.message, "error");
  }
};

window.approveDriver = async function (driverId) {
  if (!confirm("Deseja aprovar / reativar este motorista para a operação?")) return;
  try {
    const item = motoristasCache.find((m) => String(m.id) === String(driverId));
    if (item) {
      item.status = "Aprovado";
      item.vehicle_status = "Aprovado";
      item.foto_status = "Aprovada";
      item.updated_at = new Date().toISOString();
    }
    localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));

    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("motoristas")
        .update({
          status: "Aprovado",
          vehicle_status: "Aprovado",
          foto_status: "Aprovada",
          updated_at: new Date().toISOString()
        })
        .eq("id", driverId);

      if (error && error.code !== "PGRST205") console.warn("Supabase update status:", error);
    }

    showNotification("Motorista e foto homologados com sucesso!", "success");
    updateMetrics();
    renderOverviewApprovals();
    renderApprovals();
    renderDrivers();
  } catch (err) {
    showNotification("Erro ao aprovar motorista: " + err.message, "error");
  }
};

window.rejectDriver = async function (driverId) {
  if (!confirm("Deseja desativar / reprovar este motorista?")) return;
  try {
    const item = motoristasCache.find((m) => String(m.id) === String(driverId));
    if (item) {
      item.status = "Reprovado";
      item.vehicle_status = "Reprovado";
      item.updated_at = new Date().toISOString();
    }
    localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));

    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("motoristas")
        .update({ status: "Reprovado", vehicle_status: "Reprovado", updated_at: new Date().toISOString() })
        .eq("id", driverId);

      if (error && error.code !== "PGRST205") console.warn("Supabase update status:", error);
    }

    showNotification("Motorista desativado/reprovado com sucesso.", "warning");
    updateMetrics();
    renderOverviewApprovals();
    renderApprovals();
    renderDrivers();
  } catch (err) {
    showNotification("Erro ao desativar motorista: " + err.message, "error");
  }
};

window.deleteDriver = async function (driverId) {
  if (!confirm("Deseja realmente excluir este motorista permanentemente do sistema?")) return;
  try {
    motoristasCache = motoristasCache.filter(
      (m) => String(m.id) !== String(driverId),
    );
    localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));

    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("motoristas")
        .delete()
        .eq("id", driverId);

      if (error && error.code !== "PGRST205") console.warn("Supabase delete driver:", error);
    }

    showNotification("Motorista excluído com sucesso.", "info");
    updateMetrics();
    renderOverviewApprovals();
    renderApprovals();
    renderDrivers();
  } catch (err) {
    showNotification("Erro ao excluir motorista: " + err.message, "error");
  }
};

// --- MODAL DE CADASTRO / EDIÇÃO DE MOTORISTA ---
function setupDriverModal() {
  const modal = document.getElementById("driver-modal");
  const openBtn = document.getElementById("btn-open-driver-modal");
  const openBtnApprovals = document.getElementById("btn-open-driver-modal-approvals");
  const closeBtn = document.getElementById("close-driver-modal");
  const cancelBtn = document.getElementById("btn-cancel-driver-modal");
  const form = document.getElementById("driver-form");
  const feedback = document.getElementById("driver-feedback");
  const modalTitle = document.getElementById("driver-modal-title");
  const photoUrlInput = document.getElementById("driver-photo-url");
  const photoPreview = document.getElementById("driver-modal-avatar-preview");

  if (photoUrlInput && photoPreview) {
    photoUrlInput.addEventListener("input", (e) => {
      const url = e.target.value.trim();
      if (url) {
        photoPreview.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-id-card\\'></i>'">`;
      } else {
        photoPreview.innerHTML = `<i class="fas fa-id-card"></i>`;
      }
    });
  }

  const openModal = (driverData = null) => {
    if (!modal) return;
    if (feedback) {
      feedback.textContent = "";
      feedback.className = "feedback-msg";
    }

    if (driverData) {
      if (modalTitle) modalTitle.textContent = "Editar Motorista";
      const idInput = document.getElementById("driver-modal-id");
      if (idInput) idInput.value = driverData.id || "";
      const nameInput = document.getElementById("driver-name");
      if (nameInput) nameInput.value = driverData.nome_social || driverData.nome || "";
      const fullNameInput = document.getElementById("driver-full-name");
      if (fullNameInput) fullNameInput.value = driverData.nome_completo || driverData.nome || "";
      const phoneInput = document.getElementById("driver-phone");
      if (phoneInput) phoneInput.value = driverData.telefone || driverData.phone || "";
      const cpfInput = document.getElementById("driver-cpf");
      if (cpfInput) cpfInput.value = driverData.cpf || "";
      const catSelect = document.getElementById("driver-category-select");
      if (catSelect) catSelect.value = driverData.categoria_tipo || (driverData.categoria === "Empresa" ? "empresa" : "particular");
      const brandInput = document.getElementById("driver-car-brand");
      if (brandInput) brandInput.value = driverData.marca_veiculo || "";
      const modelInput = document.getElementById("driver-car-model");
      if (modelInput) modelInput.value = driverData.modelo_veiculo || "";
      const plateInput = document.getElementById("driver-car-plate");
      if (plateInput) plateInput.value = driverData.placa_veiculo || "";
      const colorInput = document.getElementById("driver-car-color");
      if (colorInput) colorInput.value = driverData.cor_veiculo || "";
      const statusSelect = document.getElementById("driver-status-select");
      if (statusSelect) statusSelect.value = driverData.status || "Aprovado";
      const emailInput = document.getElementById("driver-email");
      if (emailInput) emailInput.value = driverData.email || "";

      const photoUrl = driverData.foto_url || driverData.avatar_url || "";
      if (photoUrlInput) photoUrlInput.value = photoUrl;
      const photoStatusSelect = document.getElementById("driver-photo-status");
      if (photoStatusSelect) photoStatusSelect.value = driverData.foto_status || "Aprovada";
      if (photoPreview) {
        if (photoUrl) {
          photoPreview.innerHTML = `<img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-id-card\\'></i>'">`;
        } else {
          photoPreview.innerHTML = `<i class="fas fa-id-card"></i>`;
        }
      }
    } else {
      if (modalTitle) modalTitle.textContent = "Cadastrar Novo Motorista";
      if (form) form.reset();
      const idInput = document.getElementById("driver-modal-id");
      if (idInput) idInput.value = "";
      const catSelect = document.getElementById("driver-category-select");
      if (catSelect) catSelect.value = "particular";
      const statusSelect = document.getElementById("driver-status-select");
      if (statusSelect) statusSelect.value = "Aprovado";
      const photoStatusSelect = document.getElementById("driver-photo-status");
      if (photoStatusSelect) photoStatusSelect.value = "Aprovada";
      if (photoPreview) photoPreview.innerHTML = `<i class="fas fa-id-card"></i>`;
    }

    modal.classList.remove("hidden");
  };

  const closeModal = () => {
    if (modal) modal.classList.add("hidden");
  };

  if (openBtn) openBtn.addEventListener("click", () => openModal());
  if (openBtnApprovals) openBtnApprovals.addEventListener("click", () => openModal());
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const idInput = document.getElementById("driver-modal-id");
      const driverId = idInput ? idInput.value.trim() : "";
      const nomeSocial = (document.getElementById("driver-name")?.value || "").trim();
      const nomeCompleto = (document.getElementById("driver-full-name")?.value || "").trim();
      const telefone = (document.getElementById("driver-phone")?.value || "").trim();
      const cpf = (document.getElementById("driver-cpf")?.value || "").trim();
      const catTipo = document.getElementById("driver-category-select")?.value || "particular";
      const isEmpresa = catTipo === "empresa";
      const marca = (document.getElementById("driver-car-brand")?.value || "").trim();
      const modelo = (document.getElementById("driver-car-model")?.value || "").trim();
      const placa = (document.getElementById("driver-car-plate")?.value || "").trim().toUpperCase();
      const cor = (document.getElementById("driver-car-color")?.value || "").trim();
      const status = document.getElementById("driver-status-select")?.value || "Aprovado";
      const email = (document.getElementById("driver-email")?.value || "").trim();
      const photoUrl = (document.getElementById("driver-photo-url")?.value || "").trim();
      const photoStatus = document.getElementById("driver-photo-status")?.value || (photoUrl ? "Aprovada" : "Pendente");

      if (!nomeSocial || !telefone) {
        if (feedback) {
          feedback.textContent = "Por favor, preencha o nome e o telefone do motorista.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      const submitBtn = document.getElementById("btn-submit-driver");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      }

      try {
        const payload = {
          nome: nomeSocial,
          nome_social: nomeSocial,
          nome_completo: nomeCompleto || nomeSocial,
          telefone: telefone,
          cpf: cpf,
          foto_url: photoUrl || null,
          avatar_url: photoUrl || null,
          foto_status: photoStatus,
          categoria_tipo: catTipo,
          categoria: isEmpresa ? "Empresa" : "Particular",
          recebe_voucher: true,
          recebe_particular: !isEmpresa,
          marca_veiculo: marca,
          modelo_veiculo: modelo,
          placa_veiculo: placa,
          cor_veiculo: cor,
          status: status,
          vehicle_status: status === "Aprovado" ? "Aprovado" : "Pendente",
          email: email,
          updated_at: new Date().toISOString()
        };

        if (driverId) {
          // Atualizar motorista existente
          if (supabaseClient) {
            const { error } = await supabaseClient
              .from("motoristas")
              .update(payload)
              .eq("id", driverId);
            if (error && error.code !== "PGRST205") console.warn("Supabase update motorista:", error);
          }

          const idx = motoristasCache.findIndex((m) => String(m.id) === String(driverId));
          if (idx !== -1) {
            motoristasCache[idx] = { ...motoristasCache[idx], ...payload };
          }
          localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
          showNotification(`Motorista ${nomeSocial} atualizado com sucesso!`, "success");
        } else {
          // Inserir novo motorista
          let newId = "drv-" + Date.now();
          if (supabaseClient) {
            const { data, error } = await supabaseClient
              .from("motoristas")
              .insert([{ ...payload, created_at: new Date().toISOString() }])
              .select();
            if (!error && data && data[0]) {
              newId = data[0].id;
            }
          }

          const newDriverObj = {
            id: newId,
            ...payload,
            created_at: new Date().toISOString()
          };
          motoristasCache.unshift(newDriverObj);
          localStorage.setItem("sr_motoristas_cache", JSON.stringify(motoristasCache));
          showNotification(`Motorista ${nomeSocial} cadastrado com sucesso! Categoria: ${isEmpresa ? "Frota Empresa (Apenas Voucher)" : "Particular (Voucher + Particular)"}`, "success");
        }

        closeModal();
        updateMetrics();
        renderOverviewApprovals();
        renderApprovals();
        renderDrivers();
      } catch (err) {
        console.error("Erro ao salvar motorista:", err);
        if (feedback) {
          feedback.textContent = "Erro ao salvar motorista: " + err.message;
          feedback.className = "feedback-msg error";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Motorista';
        }
      }
    });
  }

  window.openEditDriverModal = function (driverId) {
    const driver = motoristasCache.find((m) => String(m.id) === String(driverId));
    if (driver) openModal(driver);
  };
}

// --- GESTÃO DE EMPRESAS CONVENIADAS ---
async function loadEmpresas() {
  const defaultCompanies = [
    {
      id: "honda-01",
      name: "Moto Honda da Amazônia Ltda",
      trade_name: "Moto Honda",
      cnpj: "04.337.168/0001-48",
      contact_person: "Gerência de Transporte / RH",
      phone: "(92) 2123-4000",
      email: "transporte@honda.com.br",
      billing_cycle: "quinzenal",
      active: true,
      address: "Av. Torquato Tapajós, Flores, Manaus - AM"
    },
    {
      id: "samsung-02",
      name: "Samsung Eletrônica da Amazônia Ltda",
      trade_name: "Samsung PIM",
      cnpj: "00.280.273/0001-37",
      contact_person: "Setor de Logística Pessoal",
      phone: "(92) 4009-1000",
      email: "logistica@samsung.com.br",
      billing_cycle: "quinzenal",
      active: true,
      address: "Av. dos Oitis, Distrito Industrial II, Manaus - AM"
    },
    {
      id: "yamaha-03",
      name: "Yamaha Motor da Amazônia Ltda",
      trade_name: "Yamaha Motor",
      cnpj: "04.790.877/0001-38",
      contact_person: "Supervisão de Operações",
      phone: "(92) 2125-9000",
      email: "operacoes@yamaha-motor.com.br",
      billing_cycle: "mensal",
      active: true,
      address: "Estrada dos Franceses, Alvorada, Manaus - AM"
    }
  ];

  if (!supabaseClient) {
    const local = localStorage.getItem("sr_empresas_cache");
    empresasCache = local ? JSON.parse(local) : defaultCompanies;
    renderEmpresas();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("empresas_conveniadas")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("Aviso ao carregar empresas_conveniadas do Supabase:", error.message);
      const local = localStorage.getItem("sr_empresas_cache");
      empresasCache = local ? JSON.parse(local) : defaultCompanies;
    } else {
      empresasCache = (data && data.length > 0) ? data : defaultCompanies;
      localStorage.setItem("sr_empresas_cache", JSON.stringify(empresasCache));
    }
  } catch (err) {
    console.error("Erro ao consultar empresas conveniadas:", err);
    const local = localStorage.getItem("sr_empresas_cache");
    empresasCache = local ? JSON.parse(local) : defaultCompanies;
  }

  const navCount = document.getElementById("nav-companies-count");
  if (navCount) {
    navCount.textContent = String(empresasCache.filter(c => c.active !== false).length);
  }

  updateCompanyFilterOptions();
  renderEmpresas();
}

function setupCompanyFilters() {
  const searchInput = document.getElementById("search-companies-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      companySearchQuery = e.target.value.toLowerCase().trim();
      renderEmpresas();
    });
  }

  const statusSelect = document.getElementById("filter-company-status");
  if (statusSelect) {
    statusSelect.addEventListener("change", (e) => {
      companyStatusFilter = e.target.value;
      renderEmpresas();
    });
  }
}

function renderEmpresas() {
  const container = document.getElementById("companies-container");
  if (!container) return;

  let list = empresasCache.slice();

  // Filtro de status
  if (companyStatusFilter === "active") {
    list = list.filter((c) => c.active !== false);
  } else if (companyStatusFilter === "inactive") {
    list = list.filter((c) => c.active === false);
  }

  // Filtro de busca
  if (companySearchQuery) {
    list = list.filter((c) => {
      const full = [
        c.name,
        c.trade_name,
        c.cnpj,
        c.contact_person,
        c.phone,
        c.email,
        c.address
      ].filter(Boolean).join(" ").toLowerCase();
      return full.includes(companySearchQuery);
    });
  }

  if (list.length === 0) {
    container.innerHTML =
      '<p class="loading-state">Nenhuma empresa conveniada encontrada com os filtros selecionados.</p>';
    return;
  }

  let html =
    '<table class="approval-table" style="width:100%; text-align:left; border-collapse:collapse;">';
  html +=
    '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.15); font-size:12px; color:#94a3b8;">';
  html += '<th style="padding:10px;">Empresa / Razão Social</th>';
  html += '<th style="padding:10px;">CNPJ</th>';
  html += '<th style="padding:10px;">Contato & Telefone</th>';
  html += '<th style="padding:10px;">E-mail Financeiro</th>';
  html += '<th style="padding:10px;">Ciclo Fechamento</th>';
  html += '<th style="padding:10px;">Status</th>';
  html += '<th style="padding:10px; text-align:right;">Ações</th>';
  html += "</tr></thead><tbody>";

  for (let i = 0; i < list.length; i++) {
    const comp = list[i];
    const isActive = comp.active !== false;

    html += '<tr style="border-bottom:1px solid var(--line); font-size:13px;">';
    html += '  <td style="padding:10px;">';
    html += '    <strong>' + escapeHtml(comp.name || comp.trade_name || "Sem razão social") + '</strong>';
    if (comp.trade_name && comp.trade_name !== comp.name) {
      html += '    <br><small style="color:var(--amber); font-weight:600;"><i class="fas fa-building"></i> ' + escapeHtml(comp.trade_name) + '</small>';
    }
    if (comp.address) {
      html += '    <br><small style="color:var(--ink-soft);"><i class="fas fa-location-dot"></i> ' + escapeHtml(comp.address) + '</small>';
    }
    html += '  </td>';
    html += '  <td style="padding:10px;"><span style="background:var(--paper); padding: 2px 6px; border-radius: 4px; font-weight: bold; border:1px solid var(--line); font-family:monospace;">' + escapeHtml(comp.cnpj || "—") + '</span></td>';
    html += '  <td style="padding:10px;">' + escapeHtml(comp.contact_person || "—") + '<br><small style="color:var(--green); font-weight:600;"><i class="fas fa-phone"></i> ' + escapeHtml(comp.phone || "—") + '</small></td>';
    html += '  <td style="padding:10px;"><small style="color:var(--ink-soft);">' + escapeHtml(comp.email || "—") + '</small></td>';
    html += '  <td style="padding:10px;"><span style="text-transform:capitalize; font-size:11px; font-weight:bold; color:var(--ink);">' + (comp.billing_cycle === 'quinzenal' ? '🗓️ Quinzenal' : comp.billing_cycle === 'semanal' ? '🗓️ Semanal' : '🗓️ Mensal') + '</span></td>';
    html += '  <td style="padding:10px;"><span class="status-badge ' + (isActive ? 'approved' : 'rejected') + '">' + (isActive ? 'Ativo' : 'Inativo') + '</span></td>';
    html += '  <td style="padding:10px; text-align:right; white-space:nowrap;">';
    html += '    <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; min-height:28px; margin-right:4px;" onclick="editCompany(\'' + comp.id + '\')" title="Editar empresa"><i class="fas fa-pen"></i> Editar</button>';
    html += '    <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; min-height:28px; margin-right:4px;" onclick="toggleCompanyStatus(\'' + comp.id + '\')" title="' + (isActive ? 'Desativar' : 'Ativar') + '">' + (isActive ? '<i class="fas fa-ban" style="color:#be7b20;"></i>' : '<i class="fas fa-check" style="color:var(--green);"></i>') + '</button>';
    html += '    <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; min-height:28px;" onclick="deleteCompany(\'' + comp.id + '\')" title="Excluir empresa"><i class="fas fa-trash-can" style="color:var(--red);"></i></button>';
    html += '  </td>';
    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

function setupCompanyModal() {
  const modal = document.getElementById("company-modal");
  const btnOpen = document.getElementById("btn-open-company-modal");
  const btnClose = document.getElementById("close-company-modal");
  const btnCancel = document.getElementById("btn-cancel-company-modal");
  const form = document.getElementById("company-form");
  const feedback = document.getElementById("company-feedback");

  const openModal = () => {
    if (modal) modal.classList.remove("hidden");
    if (feedback) {
      feedback.textContent = "";
      feedback.className = "feedback-msg";
    }
  };

  const closeModal = () => {
    if (modal) modal.classList.add("hidden");
    if (form) form.reset();
    const idInput = document.getElementById("company-id");
    if (idInput) idInput.value = "";
    const title = document.getElementById("company-modal-title");
    if (title) title.textContent = "Cadastrar Empresa Conveniada";
  };

  if (btnOpen) btnOpen.addEventListener("click", () => {
    closeModal();
    openModal();
  });
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("company-id").value.trim();
      const name = document.getElementById("company-name").value.trim();
      const trade_name = document.getElementById("company-trade-name").value.trim() || name;
      const cnpj = document.getElementById("company-cnpj").value.trim();
      const contact_person = document.getElementById("company-contact").value.trim();
      const phone = document.getElementById("company-phone").value.trim();
      const email = document.getElementById("company-email").value.trim();
      const billing_cycle = document.getElementById("company-billing-cycle").value;
      const active = document.getElementById("company-status").value === "active";
      const address = document.getElementById("company-address").value.trim();

      if (!name || !cnpj || !phone) {
        if (feedback) {
          feedback.textContent = "Por favor, preencha Razão Social, CNPJ e Telefone.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      const companyData = {
        name,
        trade_name,
        cnpj,
        contact_person,
        phone,
        email,
        billing_cycle,
        active,
        address,
        updated_at: new Date().toISOString()
      };

      try {
        if (id) {
          // Atualização
          if (supabaseClient) {
            const { error } = await supabaseClient
              .from("empresas_conveniadas")
              .update(companyData)
              .eq("id", id);
            if (error && error.code !== "PGRST205") throw error;
          }

          const idx = empresasCache.findIndex((c) => String(c.id) === String(id));
          if (idx >= 0) {
            empresasCache[idx] = { ...empresasCache[idx], ...companyData };
          }
          showNotification("Empresa parceira atualizada com sucesso!", "success");
        } else {
          // Inserção
          const newId = "comp-" + Date.now();
          const newCompany = { id: newId, created_at: new Date().toISOString(), ...companyData };

          if (supabaseClient) {
            const { error } = await supabaseClient
              .from("empresas_conveniadas")
              .insert([newCompany]);
            if (error && error.code !== "PGRST205") throw error;
          }

          empresasCache.unshift(newCompany);
          showNotification("Empresa parceira cadastrada com sucesso!", "success");
        }

        localStorage.setItem("sr_empresas_cache", JSON.stringify(empresasCache));
        closeModal();
        await loadEmpresas();
      } catch (err) {
        if (feedback) {
          feedback.textContent = "Erro ao salvar empresa: " + err.message;
          feedback.className = "feedback-msg error";
        }
      }
    });
  }
}

window.editCompany = function (companyId) {
  const comp = empresasCache.find((c) => String(c.id) === String(companyId));
  if (!comp) return;

  const modal = document.getElementById("company-modal");
  const title = document.getElementById("company-modal-title");
  if (title) title.textContent = "Editar Empresa Conveniada";

  document.getElementById("company-id").value = comp.id;
  document.getElementById("company-name").value = comp.name || "";
  document.getElementById("company-trade-name").value = comp.trade_name || "";
  document.getElementById("company-cnpj").value = comp.cnpj || "";
  document.getElementById("company-contact").value = comp.contact_person || "";
  document.getElementById("company-phone").value = comp.phone || "";
  document.getElementById("company-email").value = comp.email || "";
  document.getElementById("company-billing-cycle").value = comp.billing_cycle || "quinzenal";
  document.getElementById("company-status").value = comp.active !== false ? "active" : "inactive";
  document.getElementById("company-address").value = comp.address || "";

  if (modal) modal.classList.remove("hidden");
};

window.toggleCompanyStatus = async function (companyId) {
  const comp = empresasCache.find((c) => String(c.id) === String(companyId));
  if (!comp) return;

  const newStatus = comp.active === false ? true : false;
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("empresas_conveniadas")
        .update({ active: newStatus, updated_at: new Date().toISOString() })
        .eq("id", companyId);
      if (error && error.code !== "PGRST205") throw error;
    }

    comp.active = newStatus;
    localStorage.setItem("sr_empresas_cache", JSON.stringify(empresasCache));
    showNotification(`Status da empresa ${comp.name} alterado para: ${newStatus ? 'Ativo' : 'Inativo'}`, "info");
    renderEmpresas();
  } catch (err) {
    showNotification("Erro ao alternar status da empresa: " + err.message, "error");
  }
};

window.deleteCompany = async function (companyId) {
  if (!confirm("Deseja realmente remover esta empresa parceira do cadastro?")) return;
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("empresas_conveniadas")
        .delete()
        .eq("id", companyId);
      if (error && error.code !== "PGRST205") throw error;
    }

    empresasCache = empresasCache.filter((c) => String(c.id) !== String(companyId));
    localStorage.setItem("sr_empresas_cache", JSON.stringify(empresasCache));
    showNotification("Empresa parceira excluída com sucesso.", "info");
    await loadEmpresas();
  } catch (err) {
    showNotification("Erro ao excluir empresa: " + err.message, "error");
  }
};

// --- COMUNICADOS ---
function setupPostsForm() {
  const form = document.getElementById("admin-form");
  const feedback = document.getElementById("post-feedback");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const typeElem = document.getElementById("post-type");
      const titleElem = document.getElementById("post-title");
      const contentElem = document.getElementById("post-content");

      const type = typeElem ? typeElem.value : "info";
      const title = titleElem ? titleElem.value.trim() : "";
      const content = contentElem ? contentElem.value.trim() : "";

      if (!title || !content) {
        if (feedback) {
          feedback.textContent = "Preencha o título e a mensagem.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      try {
        const { error } = await supabaseClient.from("posts").insert([
          {
            type: type,
            title: title,
            content: content,
            created_at: new Date().toISOString(),
          },
        ]);

        if (error) throw error;
        if (feedback) {
          feedback.textContent = "Publicado com sucesso!";
          feedback.className = "feedback-msg success";
        }
        form.reset();
        loadPosts();
      } catch (err) {
        if (feedback) {
          feedback.textContent = "Erro: " + err.message;
          feedback.className = "feedback-msg error";
        }
      }
    });
  }
}

async function loadPosts() {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    postsCache = data || [];
    const container = document.getElementById("posts-container");
    if (container) {
      if (postsCache.length === 0) {
        container.innerHTML =
          '<p style="color:var(--ink-soft);">Nenhum comunicado cadastrado.</p>';
      } else {
        let html = "";
        for (let i = 0; i < postsCache.length; i++) {
          const p = postsCache[i];
          const isPromo = p.type === "promo" || p.categoria === "promo";
          html += `
            <div class="post-item">
              <div>
                <span class="status-badge ${isPromo ? "pending" : "approved"}">${isPromo ? "PROMOÇÃO" : "AVISO"}</span>
                <strong style="margin-top:4px; display:block;">${escapeHtml(p.title || p.titulo || "")}</strong>
                <p style="font-size:12px; color:var(--ink-soft); margin:4px 0 0;">${escapeHtml(p.content || p.conteudo || "")}</p>
              </div>
            </div>
          `;
        }
        container.innerHTML = html;
      }
    }
  } catch (err) {
    // Comunicados opcional
  }
}

// --- SEGURANÇA (ALTERAR SENHA) ---
function setupSecurityForm() {
  const form = document.getElementById("password-form");
  const feedback = document.getElementById("password-feedback");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nPass = document.getElementById("new-password");
      const cPass = document.getElementById("confirm-password");

      const newPass = nPass ? nPass.value : "";
      const confirmPass = cPass ? cPass.value : "";

      if (newPass !== confirmPass) {
        if (feedback) {
          feedback.textContent = "As senhas não coincidem.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      try {
        const { error } = await supabaseClient.auth.updateUser({
          password: newPass,
        });
        if (error) throw error;
        if (feedback) {
          feedback.textContent = "Senha alterada com sucesso!";
          feedback.className = "feedback-msg success";
        }
        form.reset();
      } catch (err) {
        if (feedback) {
          feedback.textContent = err.message || "Erro ao atualizar senha.";
          feedback.className = "feedback-msg error";
        }
      }
    });
  }
}

// --- FEEDBACK / NOTIFICAÇÃO ---
function showNotification(msg, type) {
  const elem = document.getElementById("global-feedback");
  if (elem) {
    elem.textContent = msg;
    elem.className = "global-feedback active " + (type || "info");
    setTimeout(() => {
      elem.className = "global-feedback";
    }, 4500);
  }
}

// --- SANITIZAÇÃO DE TEXTO ---
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let activeModalRideId = null;

// --- ABA: RELATÓRIOS DE CORRIDAS E FATURAMENTO CONSOLIDADO ---
function setupReportsView() {
  // Tabs de Período
  const periodTabs = document.querySelectorAll("#reports-period-tabs .tab, #report-period-tabs .tab");
  periodTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      periodTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentReportPeriod = tab.getAttribute("data-period") || "CURRENT_MONTH";

      const startWrap = document.getElementById("custom-date-start-wrap");
      const endWrap = document.getElementById("custom-date-end-wrap");
      if (currentReportPeriod === "CUSTOM") {
        if (startWrap) startWrap.classList.remove("hidden");
        if (endWrap) endWrap.classList.remove("hidden");
      } else {
        if (startWrap) startWrap.classList.add("hidden");
        if (endWrap) endWrap.classList.add("hidden");
      }

      renderReportsView();
    });
  });

  // Filtro por Passageiro
  const passFilter = document.getElementById("report-filter-passenger");
  if (passFilter) {
    passFilter.addEventListener("change", (e) => {
      currentReportPassenger = e.target.value;
      renderReportsView();
    });
  }

  // Filtro por Status
  const statusFilter = document.getElementById("report-filter-status");
  if (statusFilter) {
    statusFilter.addEventListener("change", (e) => {
      currentReportStatus = e.target.value;
      renderReportsView();
    });
  }

  // Datas personalizadas
  const startInput = document.getElementById("report-custom-start");
  if (startInput) {
    startInput.addEventListener("change", (e) => {
      customReportStart = e.target.value;
      renderReportsView();
    });
  }

  const endInput = document.getElementById("report-custom-end");
  if (endInput) {
    endInput.addEventListener("change", (e) => {
      customReportEnd = e.target.value;
      renderReportsView();
    });
  }

  // Botões de Ação
  const btnRefresh = document.getElementById("refresh-reports");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => loadCorridasReports());
  }

  const btnExportPDF = document.getElementById("btn-export-pdf-report");
  if (btnExportPDF) {
    btnExportPDF.addEventListener("click", () => exportReportsPDF());
  }

  const btnExportCSV = document.getElementById("btn-export-csv-report");
  if (btnExportCSV) {
    btnExportCSV.addEventListener("click", () => exportReportsCSV());
  }

  // Modal de Detalhes da Corrida
  const closeBtn = document.getElementById("close-ride-detail-modal");
  if (closeBtn) closeBtn.addEventListener("click", () => closeRideDetailsModal());

  const modalCloseBtn = document.getElementById("btn-close-ride-modal");
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", () => closeRideDetailsModal());

  const modalOverlay = document.getElementById("ride-detail-modal");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeRideDetailsModal();
    });
  }

  const btnPrintSingle = document.getElementById("btn-print-single-ride");
  if (btnPrintSingle) {
    btnPrintSingle.addEventListener("click", () => {
      if (activeModalRideId) printSingleRideVoucher(activeModalRideId);
    });
  }
}

async function loadCorridasReports() {
  const tbody = document.getElementById("reports-table-body");
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="11" class="loading-state"><i class="fas fa-spinner fa-spin"></i> Carregando viagens detalhadas...</td></tr>';
  }

  if (!supabaseClient) {
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty-state">Supabase não conectado.</td></tr>';
    }
    return;
  }

  try {
    const { data: ridesData, error } = await supabaseClient
      .from("rides")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar tabela 'rides':", error.message);
    }

    const raw = ridesData || [];

    // Mapeamento enriquecido de motoristas
    const driverMap = {};
    motoristasCache.forEach((m) => {
      const vehicleDesc = [
        m.marca_veiculo,
        m.modelo_veiculo,
        m.cor_veiculo ? `(${m.cor_veiculo})` : "",
        m.placa_veiculo ? `• Placa: ${m.placa_veiculo}` : ""
      ].filter(Boolean).join(" ");

      driverMap[m.id] = {
        name: m.nome_social || m.nome || m.nome_completo || "Motorista SR",
        phone: m.telefone || m.whatsapp || "",
        vehicle: vehicleDesc || "Veículo SR Padrão",
        plate: m.placa_veiculo || "—",
        model: m.modelo_veiculo || "",
      };
    });

    // Mapeamento enriquecido de passageiros
    const passMap = {};
    passageirosCache.forEach((p) => {
      passMap[p.id] = {
        name: p.nome_social || p.nome || p.nome_completo || "Passageiro",
        company: p.empresa || p.company || p.empresa_cliente || "SR Convênio",
        phone: p.telefone || p.whatsapp || "",
        email: p.email || "",
        sector: p.setor || p.departamento || "",
        shift: p.turno || "",
      };
    });

    corridasCache = raw.map((r) => {
      const pInfo = passMap[r.passenger_id] || {};
      const dInfo = driverMap[r.driver_id] || {};

      const passengerName = r.passenger_name || pInfo.name || (r.passenger_id ? `Passageiro (${String(r.passenger_id).slice(0, 6)})` : "Passageiro SR");
      const company = r.company || pInfo.company || "Convênio SR";
      const passengerPhone = r.passenger_phone || pInfo.phone || "";
      const passengerEmail = r.passenger_email || pInfo.email || "";
      const passengerSector = r.passenger_sector || pInfo.sector || "";

      const driverName = r.driver_name || dInfo.name || (r.driver_id ? `Motorista (${String(r.driver_id).slice(0, 6)})` : "Motorista SR");
      const driverPhone = r.driver_phone || dInfo.phone || "";
      const driverVehicle = r.driver_vehicle || dInfo.vehicle || (dInfo.plate ? `Veículo Placa ${dInfo.plate}` : "Veículo Cadastrado");

      return {
        id: r.id,
        code: `#SR-${String(r.id).replace(/-/g, "").slice(0, 6).toUpperCase()}`,
        created_at: r.created_at || new Date().toISOString(),
        pickup_address: r.pickup_address || (r.pickup_lat ? `Lat: ${r.pickup_lat}, Lng: ${r.pickup_lng}` : "Manaus / AM"),
        pickup_lat: r.pickup_lat || null,
        pickup_lng: r.pickup_lng || null,
        dropoff_address: r.dropoff_address || (r.dropoff_lat ? `Lat: ${r.dropoff_lat}, Lng: ${r.dropoff_lng}` : "Manaus / AM"),
        dropoff_lat: r.dropoff_lat || null,
        dropoff_lng: r.dropoff_lng || null,
        fare_amount: Number(r.fare_amount) || 0,
        distance_km: Number(r.distance_km) || 0,
        duration_min: Number(r.duration_min || r.duration_minutes || r.estimated_duration) || 0,
        status: String(r.status || "COMPLETED").toUpperCase(),
        payment_method: r.payment_method || "Voucher Corporativo",
        passenger_id: r.passenger_id,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        passenger_email: passengerEmail,
        passenger_sector: passengerSector,
        company: company,
        driver_id: r.driver_id,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_vehicle: driverVehicle,
        cancellation_reason: r.cancellation_reason || r.cancel_reason || r.reason || "",
        notes: r.notes || r.observacoes || "",
      };
    });

    populateReportPassengerOptions();
    renderReportsView();
  } catch (err) {
    console.error("Erro ao carregar relatório de corridas:", err);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty-state">Erro ao carregar relatório de corridas.</td></tr>';
    }
  }
}

function populateReportPassengerOptions() {
  const select = document.getElementById("report-filter-passenger");
  if (!select) return;

  const currentVal = select.value;
  const passengersSet = new Map();

  corridasCache.forEach((r) => {
    const key = r.passenger_id || r.passenger_name;
    if (key && !passengersSet.has(key)) {
      passengersSet.set(key, {
        id: key,
        label: `${r.passenger_name} (${r.company})`,
      });
    }
  });

  let optionsHtml = '<option value="ALL">Todos os Passageiros / Empresas</option>';
  passengersSet.forEach((item) => {
    optionsHtml += `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`;
  });

  select.innerHTML = optionsHtml;
  if (currentVal && passengersSet.has(currentVal)) {
    select.value = currentVal;
  }
}

function getFilteredReportRides() {
  return corridasCache.filter((ride) => {
    // 1. Filtro por Passageiro
    if (currentReportPassenger !== "ALL") {
      const matchId = ride.passenger_id === currentReportPassenger;
      const matchName = ride.passenger_name === currentReportPassenger;
      if (!matchId && !matchName) return false;
    }

    // 2. Filtro por Status
    const isComp = ["COMPLETED", "FINISHED", "FINALIZADA", "CONCLUIDA", "PAID"].includes(ride.status);
    const isCanc = ["CANCELLED", "CANCELED", "CANCELADA", "REJECTED"].includes(ride.status);

    if (currentReportStatus === "COMPLETED" && !isComp) return false;
    if (currentReportStatus === "CANCELLED" && !isCanc) return false;

    // 3. Filtro por Período
    if (currentReportPeriod === "ALL") return true;

    const rideDate = new Date(ride.created_at);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    if (currentReportPeriod === "CURRENT_MONTH") {
      return rideDate.getFullYear() === curYear && rideDate.getMonth() === curMonth;
    }

    if (currentReportPeriod === "LAST_MONTH") {
      const lastMonthDate = new Date(curYear, curMonth - 1, 1);
      return (
        rideDate.getFullYear() === lastMonthDate.getFullYear() &&
        rideDate.getMonth() === lastMonthDate.getMonth()
      );
    }

    if (currentReportPeriod === "Q1") {
      return (
        rideDate.getFullYear() === curYear &&
        rideDate.getMonth() === curMonth &&
        rideDate.getDate() >= 1 &&
        rideDate.getDate() <= 15
      );
    }

    if (currentReportPeriod === "Q2") {
      return (
        rideDate.getFullYear() === curYear &&
        rideDate.getMonth() === curMonth &&
        rideDate.getDate() >= 16
      );
    }

    if (currentReportPeriod === "CUSTOM") {
      if (!customReportStart && !customReportEnd) return true;
      const start = customReportStart ? new Date(customReportStart + "T00:00:00") : new Date(0);
      const end = customReportEnd ? new Date(customReportEnd + "T23:59:59") : new Date(8640000000000000);
      return rideDate >= start && rideDate <= end;
    }

    return true;
  });
}

function getReportPeriodLabel() {
  const now = new Date();
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const curMonth = monthNames[now.getMonth()];
  const curYear = now.getFullYear();

  switch (currentReportPeriod) {
    case "Q1":
      return `1ª Quinzena de ${curMonth}/${curYear} (01 a 15)`;
    case "Q2":
      return `2ª Quinzena de ${curMonth}/${curYear} (16 ao fim)`;
    case "CURRENT_MONTH":
      return `Mês de ${curMonth}/${curYear}`;
    case "LAST_MONTH": {
      const lastM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const lastY = now.getMonth() === 0 ? curYear - 1 : curYear;
      return `Mês de ${monthNames[lastM]}/${lastY}`;
    }
    case "CUSTOM":
      return customReportStart && customReportEnd
        ? `De ${customReportStart.split("-").reverse().join("/")} até ${customReportEnd.split("-").reverse().join("/")}`
        : "Período Personalizado";
    default:
      return "Histórico Geral (Todas as Viagens)";
  }
}

function filterBySinglePassenger(passengerId) {
  currentReportPassenger = passengerId;
  const select = document.getElementById("report-filter-passenger");
  if (select) select.value = passengerId;
  renderReportsView();
}

function openRideDetailsModal(rideId) {
  const ride = corridasCache.find((r) => String(r.id) === String(rideId));
  if (!ride) return;

  activeModalRideId = ride.id;

  const modal = document.getElementById("ride-detail-modal");
  const codeElem = document.getElementById("ride-detail-code");
  const dateElem = document.getElementById("ride-detail-date");
  const badgeElem = document.getElementById("ride-detail-status-badge");
  const bodyElem = document.getElementById("ride-detail-body");

  if (!modal || !bodyElem) return;

  const isComp = ["COMPLETED", "FINISHED", "FINALIZADA", "CONCLUIDA", "PAID"].includes(ride.status);
  const isCanc = ["CANCELLED", "CANCELED", "CANCELADA", "REJECTED"].includes(ride.status);
  const statusClass = isComp ? "approved" : isCanc ? "rejected" : "pending";
  const statusText = isComp ? "FINALIZADA" : isCanc ? "CANCELADA" : "EM ANDAMENTO";

  if (codeElem) codeElem.textContent = ride.code;
  if (dateElem) dateElem.textContent = `Solicitada em: ${new Date(ride.created_at).toLocaleString("pt-BR")}`;
  if (badgeElem) {
    badgeElem.className = `status-badge ${statusClass}`;
    badgeElem.textContent = statusText;
  }

  const mapsPickupUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ride.pickup_address)}`;
  const mapsDropoffUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ride.dropoff_address)}`;

  const cleanPhone = (ride.passenger_phone || "").replace(/\D/g, "");
  const cleanDriverPhone = (ride.driver_phone || "").replace(/\D/g, "");

  bodyElem.innerHTML = `
    <!-- Card Passageiro & Empresa -->
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; margin-bottom:12px;">
      <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#64748b; margin-bottom:6px; letter-spacing:0.04em;">
        <i class="fas fa-user" style="color:var(--green); margin-right:4px;"></i> Dados do Passageiro & Empresa
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">
        <div>
          <div style="font-size:11px; color:#64748b;">Nome Completo:</div>
          <strong style="font-size:13px; color:#0f172a;">${escapeHtml(ride.passenger_name)}</strong>
        </div>
        <div>
          <div style="font-size:11px; color:#64748b;">Empresa Cliente / Convênio:</div>
          <span class="tag-company" style="font-size:11.5px;">${escapeHtml(ride.company)}</span>
        </div>
        ${ride.passenger_sector ? `
          <div>
            <div style="font-size:11px; color:#64748b;">Setor / Turno:</div>
            <strong style="font-size:12px; color:#0f172a;">${escapeHtml(ride.passenger_sector)}</strong>
          </div>
        ` : ""}
        ${ride.passenger_phone ? `
          <div>
            <div style="font-size:11px; color:#64748b;">Contato / WhatsApp:</div>
            <a href="https://wa.me/55${cleanPhone}" target="_blank" style="font-size:12px; font-weight:bold; color:var(--green); text-decoration:none;">
              <i class="fab fa-whatsapp"></i> ${escapeHtml(ride.passenger_phone)}
            </a>
          </div>
        ` : ""}
      </div>
    </div>

    <!-- Card Motorista & Veículo -->
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; margin-bottom:12px;">
      <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#64748b; margin-bottom:6px; letter-spacing:0.04em;">
        <i class="fas fa-car" style="color:var(--amber); margin-right:4px;"></i> Motorista & Veículo Designado
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">
        <div>
          <div style="font-size:11px; color:#64748b;">Motorista:</div>
          <strong style="font-size:13px; color:#0f172a;">${escapeHtml(ride.driver_name)}</strong>
        </div>
        <div>
          <div style="font-size:11px; color:#64748b;">Veículo & Placa:</div>
          <strong style="font-size:12px; color:#0f172a;">${escapeHtml(ride.driver_vehicle)}</strong>
        </div>
        ${ride.driver_phone ? `
          <div>
            <div style="font-size:11px; color:#64748b;">WhatsApp Motorista:</div>
            <a href="https://wa.me/55${cleanDriverPhone}" target="_blank" style="font-size:12px; font-weight:bold; color:var(--green); text-decoration:none;">
              <i class="fab fa-whatsapp"></i> ${escapeHtml(ride.driver_phone)}
            </a>
          </div>
        ` : ""}
      </div>
    </div>

    <!-- Card Trajeto Completo -->
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; margin-bottom:12px;">
      <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#64748b; margin-bottom:8px; letter-spacing:0.04em;">
        <i class="fas fa-route" style="color:#0284c7; margin-right:4px;"></i> Trajeto Completo da Corrida
      </div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; align-items:flex-start; gap:8px;">
          <div style="color:var(--green); font-size:14px; margin-top:2px;"><i class="fas fa-circle-dot"></i></div>
          <div style="flex:1;">
            <div style="font-size:10.5px; font-weight:bold; color:var(--green); text-transform:uppercase;">Origem (Local de Embarque)</div>
            <div style="font-size:12.5px; font-weight:600; color:#0f172a; margin-top:1px;">${escapeHtml(ride.pickup_address)}</div>
            <a href="${mapsPickupUrl}" target="_blank" style="display:inline-block; margin-top:3px; font-size:11px; color:#0284c7; text-decoration:none;">
              <i class="fas fa-arrow-up-right-from-square"></i> Ver no Google Maps
            </a>
          </div>
        </div>

        <div style="border-left: 2px dashed #cbd5e1; margin-left: 6px; height: 12px;"></div>

        <div style="display:flex; align-items:flex-start; gap:8px;">
          <div style="color:var(--amber); font-size:14px; margin-top:2px;"><i class="fas fa-location-dot"></i></div>
          <div style="flex:1;">
            <div style="font-size:10.5px; font-weight:bold; color:var(--amber); text-transform:uppercase;">Destino (Local de Desembarque)</div>
            <div style="font-size:12.5px; font-weight:600; color:#0f172a; margin-top:1px;">${escapeHtml(ride.dropoff_address)}</div>
            <a href="${mapsDropoffUrl}" target="_blank" style="display:inline-block; margin-top:3px; font-size:11px; color:#0284c7; text-decoration:none;">
              <i class="fas fa-arrow-up-right-from-square"></i> Ver no Google Maps
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Card Métricas Financeiras & Operacionais -->
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:12px;">
      <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:10px; border-radius:8px; text-align:center;">
        <div style="font-size:10px; color:#64748b; font-weight:bold; text-transform:uppercase;">Distância</div>
        <div style="font-size:15px; font-weight:900; color:#0f172a; font-family:'DM Mono', monospace;">
          ${ride.distance_km ? `${ride.distance_km.toFixed(1)} km` : "-"}
        </div>
      </div>
      <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:10px; border-radius:8px; text-align:center;">
        <div style="font-size:10px; color:#64748b; font-weight:bold; text-transform:uppercase;">Forma Pagamento</div>
        <div style="font-size:12px; font-weight:700; color:#0f172a; margin-top:2px;">
          ${escapeHtml(ride.payment_method)}
        </div>
      </div>
      <div style="background:#0f172a; border:1px solid #0f172a; padding:10px; border-radius:8px; text-align:center; color:#fff;">
        <div style="font-size:10px; color:#94a3b8; font-weight:bold; text-transform:uppercase;">Valor Total</div>
        <div style="font-size:15px; font-weight:900; color:#38bdf8; font-family:'DM Mono', monospace;">
          R$ ${ride.fare_amount.toFixed(2).replace(".", ",")}
        </div>
      </div>
    </div>

    <!-- Regra de Categoria do Motorista para esta corrida -->
    ${isVoucherPayment(ride.payment_method) ? `
      <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:10px 14px; margin-bottom:12px; font-size:12px; color:#0369a1;">
        <i class="fas fa-circle-check" style="color:#0284c7; margin-right:4px;"></i> <strong>Regra de Categoria (Voucher):</strong> Esta corrida é faturada em voucher corporativo. Elegível tanto para motoristas de <strong>Frota Empresa</strong> quanto <strong>Motoristas Particulares</strong>.
      </div>
    ` : `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; margin-bottom:12px; font-size:12px; color:#92400e;">
        <i class="fas fa-circle-info" style="color:#d97706; margin-right:4px;"></i> <strong>Regra de Categoria (Particular):</strong> Corrida particular direta. Apenas motoristas da categoria <strong>Particular</strong> são elegíveis para receber este tipo de corrida.
      </div>
    `}

    ${ride.cancellation_reason ? `
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 14px; margin-bottom:8px; font-size:12px; color:#991b1b;">
        <strong><i class="fas fa-triangle-exclamation"></i> Motivo do Cancelamento:</strong> ${escapeHtml(ride.cancellation_reason)}
      </div>
    ` : ""}

    ${ride.notes ? `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; font-size:12px; color:#475569;">
        <strong><i class="fas fa-note-sticky"></i> Observações da Viagem:</strong> ${escapeHtml(ride.notes)}
      </div>
    ` : ""}
  `;

  modal.classList.remove("hidden");
}

function closeRideDetailsModal() {
  const modal = document.getElementById("ride-detail-modal");
  if (modal) modal.classList.add("hidden");
  activeModalRideId = null;
}

function printSingleRideVoucher(rideId) {
  const ride = corridasCache.find((r) => String(r.id) === String(rideId));
  if (!ride) return;

  const printWindow = window.open("", "_blank", "width=850,height=700");
  if (!printWindow) {
    alert("Por favor, permita pop-ups para imprimir o comprovante da corrida.");
    return;
  }

  const dateStr = new Date(ride.created_at).toLocaleString("pt-BR");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Comprovante de Corrida - ${ride.code}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
        .title { font-size: 18px; font-weight: 900; }
        .subtitle { font-size: 11px; color: #64748b; }
        .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; margin-bottom: 15px; }
        .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; }
        .value-box { background: #0f172a; color: #fff; padding: 12px; border-radius: 8px; text-align: center; margin-top: 15px; }
        .signatures { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; font-size: 11px; color: #475569; }
        .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-weight: 600; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">SR LOGÍSTICA & TRANSPORTE CORPORATIVO</div>
          <div class="subtitle">Comprovante Individual de Prestação de Serviço de Transporte</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 900;">${ride.code}</div>
          <div style="font-size: 11px; color: #64748b;">${dateStr}</div>
        </div>
      </div>

      <div class="box">
        <div class="box-title">1. Dados do Passageiro & Empresa</div>
        <div class="grid">
          <div><strong>Passageiro:</strong> ${escapeHtml(ride.passenger_name)}</div>
          <div><strong>Empresa:</strong> ${escapeHtml(ride.company)}</div>
          ${ride.passenger_phone ? `<div><strong>Contato:</strong> ${escapeHtml(ride.passenger_phone)}</div>` : ""}
          ${ride.passenger_sector ? `<div><strong>Setor:</strong> ${escapeHtml(ride.passenger_sector)}</div>` : ""}
        </div>
      </div>

      <div class="box">
        <div class="box-title">2. Motorista & Veículo Designado</div>
        <div class="grid">
          <div><strong>Motorista:</strong> ${escapeHtml(ride.driver_name)}</div>
          <div><strong>Veículo / Placa:</strong> ${escapeHtml(ride.driver_vehicle)}</div>
        </div>
      </div>

      <div class="box">
        <div class="box-title">3. Trajeto Percorrido</div>
        <div style="font-size: 12px; line-height: 1.6;">
          <div><strong style="color: #15803d;">● Embarque (Origem):</strong> ${escapeHtml(ride.pickup_address)}</div>
          <div style="margin-top: 6px;"><strong style="color: #b45309;">● Desembarque (Destino):</strong> ${escapeHtml(ride.dropoff_address)}</div>
        </div>
      </div>

      <div class="box">
        <div class="box-title">4. Métricas & Faturamento</div>
        <div class="grid">
          <div><strong>Distância Percorrida:</strong> ${ride.distance_km ? `${ride.distance_km.toFixed(1)} km` : "-"}</div>
          <div><strong>Forma de Pagamento:</strong> ${escapeHtml(ride.payment_method)}</div>
          <div><strong>Status da Corrida:</strong> ${ride.status}</div>
          <div><strong>Valor da Viagem:</strong> R$ ${ride.fare_amount.toFixed(2).replace(".", ",")}</div>
        </div>
      </div>

      <div class="signatures">
        <div><div class="sig-line">Assinatura do Passageiro</div></div>
        <div><div class="sig-line">Motorista / SR Logística</div></div>
      </div>

      <div class="footer">
        SR Logística e Transporte Ltda • CNPJ 52.967.828/0001-17 • Manaus - AM
      </div>

      <script>
        window.onload = function() { setTimeout(function() { window.print(); }, 300); }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function renderReportsView() {
  const filtered = getFilteredReportRides();
  const periodLabel = getReportPeriodLabel();

  // Atualiza label do período
  const periodBadge = document.getElementById("report-period-badge");
  if (periodBadge) periodBadge.textContent = periodLabel;

  // Cálculos Consolidados Gerais
  const completed = filtered.filter((r) =>
    ["COMPLETED", "FINISHED", "FINALIZADA", "CONCLUIDA", "PAID"].includes(r.status)
  );
  const totalFare = completed.reduce((acc, r) => acc + r.fare_amount, 0);
  const totalKm = filtered.reduce((acc, r) => acc + (r.distance_km || 0), 0);
  const avgFare = completed.length > 0 ? totalFare / completed.length : 0;

  // Atualiza os KPIs no DOM
  const kpiFare = document.getElementById("kpi-report-fare");
  const kpiFareNote = document.getElementById("kpi-report-fare-note");
  const kpiRides = document.getElementById("kpi-report-rides");
  const kpiRidesNote = document.getElementById("kpi-report-rides-note");
  const kpiKm = document.getElementById("kpi-report-km");
  const kpiAvg = document.getElementById("kpi-report-avg");

  if (kpiFare) kpiFare.textContent = "R$ " + totalFare.toFixed(2).replace(".", ",");
  if (kpiFareNote) kpiFareNote.textContent = `${completed.length} corridas faturadas`;
  if (kpiRides) kpiRides.textContent = String(filtered.length);
  if (kpiRidesNote) kpiRidesNote.textContent = `${filtered.length - completed.length} cancelamentos/pendentes`;
  if (kpiKm) kpiKm.innerHTML = `${totalKm.toFixed(1)} <small style="font-size:14px;">km</small>`;
  if (kpiAvg) kpiAvg.textContent = "R$ " + avgFare.toFixed(2).replace(".", ",");

  // ----------------------------------------------------
  // 1. Resumo Consolidado Agrupado por Passageiro
  // ----------------------------------------------------
  const passSummaryBody = document.getElementById("report-passenger-summary-body");
  if (passSummaryBody) {
    const pMap = new Map();

    // Agrupa todas as corridas do período atual por passageiro
    filtered.forEach((r) => {
      const key = r.passenger_id || r.passenger_name;
      if (!pMap.has(key)) {
        pMap.set(key, {
          id: key,
          name: r.passenger_name,
          company: r.company,
          ridesTotal: 0,
          completedCount: 0,
          totalKm: 0,
          totalFare: 0,
        });
      }
      const item = pMap.get(key);
      item.ridesTotal += 1;
      item.totalKm += (r.distance_km || 0);
      if (["COMPLETED", "FINISHED", "FINALIZADA", "CONCLUIDA", "PAID"].includes(r.status)) {
        item.completedCount += 1;
        item.totalFare += r.fare_amount;
      }
    });

    if (pMap.size === 0) {
      passSummaryBody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum passageiro com corridas no período.</td></tr>';
    } else {
      let sumHtml = "";
      pMap.forEach((item) => {
        const isSelected = currentReportPassenger === item.id;
        sumHtml += `
          <tr style="${isSelected ? "background: #f0fdf4;" : ""}">
            <td>
              <strong style="font-size:12px;">${escapeHtml(item.name)}</strong>
              ${isSelected ? '<span class="status-badge approved" style="margin-left:6px; font-size:8px;">SELECIONADO</span>' : ""}
            </td>
            <td><span class="tag-company">${escapeHtml(item.company)}</span></td>
            <td style="text-align:center; font-family:'DM Mono', monospace; font-weight:700;">${item.completedCount} <small style="color:var(--ink-soft); font-weight:normal;">(${item.ridesTotal} tot)</small></td>
            <td style="text-align:center; font-family:'DM Mono', monospace;">${item.totalKm.toFixed(1)} km</td>
            <td style="text-align:right; font-family:'DM Mono', monospace; font-weight:800; color:var(--green);">
              R$ ${item.totalFare.toFixed(2).replace(".", ",")}
            </td>
            <td style="text-align:center;">
              ${isSelected 
                ? `<button type="button" class="btn btn-secondary" onclick="filterBySinglePassenger('ALL')" style="min-height:28px; padding:0 8px; font-size:10px;">Ver Todos</button>`
                : `<button type="button" class="btn btn-secondary" onclick="filterBySinglePassenger('${escapeHtml(item.id)}')" style="min-height:28px; padding:0 8px; font-size:10px;"><i class="fas fa-filter"></i> Filtrar</button>`
              }
            </td>
          </tr>
        `;
      });
      passSummaryBody.innerHTML = sumHtml;
    }
  }

  // ----------------------------------------------------
  // 2. Renderiza Tabela Detalhada com Todas as Informações
  // ----------------------------------------------------
  const tbody = document.getElementById("reports-table-body");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">Nenhuma corrida encontrada para os filtros selecionados.</td></tr>';
    return;
  }

  let html = "";
  filtered.forEach((r, idx) => {
    const isComp = ["COMPLETED", "FINISHED", "FINALIZADA", "CONCLUIDA", "PAID"].includes(r.status);
    const isCanc = ["CANCELLED", "CANCELED", "CANCELADA", "REJECTED"].includes(r.status);
    const statusClass = isComp ? "approved" : isCanc ? "rejected" : "pending";
    const statusText = isComp ? "FINALIZADA" : isCanc ? "CANCELADA" : "EM ANDAMENTO";

    const dateStr = new Date(r.created_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    html += `
      <tr>
        <td style="text-align:center; font-family:'DM Mono', monospace; font-weight:bold; color:var(--ink-soft);">${idx + 1}</td>
        
        <!-- Cód. & Data -->
        <td>
          <div style="font-family:'DM Mono', monospace; font-weight:700; color:var(--ink); font-size:11.5px;">${r.code}</div>
          <small style="color:var(--ink-soft); font-size:10px;">${dateStr}</small>
        </td>

        <!-- Passageiro & Empresa -->
        <td>
          <strong style="font-size:12px; display:block;">${escapeHtml(r.passenger_name)}</strong>
          <span class="tag-company" style="font-size:10px; margin-top:2px;">${escapeHtml(r.company)}</span>
          ${r.passenger_phone ? `<div style="font-size:10px; color:var(--ink-soft); margin-top:2px;"><i class="fas fa-phone"></i> ${escapeHtml(r.passenger_phone)}</div>` : ""}
        </td>

        <!-- Origem (Embarque) -->
        <td style="font-size:11.5px; max-width:220px;" title="${escapeHtml(r.pickup_address)}">
          <div style="display:flex; align-items:flex-start; gap:4px;">
            <span style="color:var(--green); font-size:12px; margin-top:1px;"><i class="fas fa-circle-dot"></i></span>
            <span style="overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
              ${escapeHtml(r.pickup_address)}
            </span>
          </div>
        </td>

        <!-- Destino (Desembarque) -->
        <td style="font-size:11.5px; max-width:220px;" title="${escapeHtml(r.dropoff_address)}">
          <div style="display:flex; align-items:flex-start; gap:4px;">
            <span style="color:var(--amber); font-size:12px; margin-top:1px;"><i class="fas fa-location-dot"></i></span>
            <span style="overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
              ${escapeHtml(r.dropoff_address)}
            </span>
          </div>
        </td>

        <!-- Motorista & Veículo -->
        <td>
          <strong style="font-size:11.5px; display:block;">${escapeHtml(r.driver_name)}</strong>
          <small style="color:var(--ink-soft); font-size:10px; display:block;">${escapeHtml(r.driver_vehicle)}</small>
        </td>

        <!-- Km / Duração -->
        <td style="text-align:center;">
          <div style="font-family:'DM Mono', monospace; font-size:11px; font-weight:700;">${r.distance_km ? `${r.distance_km.toFixed(1)} km` : "-"}</div>
          ${r.duration_min ? `<small style="font-size:10px; color:var(--ink-soft);">${r.duration_min} min</small>` : ""}
        </td>

        <!-- Pagamento -->
        <td style="text-align:center; font-size:10.5px; color:#475569;">
          <span style="background:#f1f5f9; padding:3px 6px; border-radius:4px; font-weight:600;">
            ${escapeHtml(r.payment_method)}
          </span>
        </td>

        <!-- Status -->
        <td style="text-align:center;">
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>

        <!-- Valor -->
        <td style="text-align:right; font-family:'DM Mono', monospace; font-weight:800; font-size:12.5px; color:var(--ink);">
          R$ ${r.fare_amount.toFixed(2).replace(".", ",")}
        </td>

        <!-- Ação / Ver Ficha -->
        <td style="text-align:center;">
          <button type="button" class="btn btn-secondary" onclick="openRideDetailsModal('${escapeHtml(r.id)}')" style="min-height:28px; padding:0 8px; font-size:11px;" title="Ver ficha completa da corrida">
            <i class="fas fa-eye"></i> Ver
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function exportReportsPDF() {
  const filtered = getFilteredReportRides();
  if (filtered.length === 0) {
    alert("Não há viagens no filtro selecionado para gerar o relatório.");
    return;
  }

  const periodLabel = getReportPeriodLabel();
  const emissionDate = new Date().toLocaleString("pt-BR");

  const completed = filtered.filter((r) =>
    ["COMPLETED", "FINISHED", "FINALIZADA", "CONCLUIDA", "PAID"].includes(r.status)
  );
  const totalFare = completed.reduce((acc, r) => acc + r.fare_amount, 0);
  const totalKm = filtered.reduce((acc, r) => acc + (r.distance_km || 0), 0);

  const selectedPassElem = document.getElementById("report-filter-passenger");
  const isAllPassengers = currentReportPassenger === "ALL";
  const passengerFilterLabel = selectedPassElem && selectedPassElem.options[selectedPassElem.selectedIndex]
    ? selectedPassElem.options[selectedPassElem.selectedIndex].text
    : "Todos os Passageiros";

  // Consolidação por Passageiro para o PDF
  const pMap = new Map();
  filtered.forEach((r) => {
    const key = r.passenger_id || r.passenger_name;
    if (!pMap.has(key)) {
      pMap.set(key, {
        id: key,
        name: r.passenger_name,
        company: r.company,
        ridesTotal: 0,
        completedCount: 0,
        totalKm: 0,
        totalFare: 0,
      });
    }
    const item = pMap.get(key);
    item.ridesTotal += 1;
    item.totalKm += (r.distance_km || 0);
    if (["COMPLETED", "FINISHED", "FINALIZADA", "CONCLUIDA", "PAID"].includes(r.status)) {
      item.completedCount += 1;
      item.totalFare += r.fare_amount;
    }
  });

  let passengerSummaryTableHtml = "";
  if (isAllPassengers && pMap.size > 0) {
    let pRows = "";
    pMap.forEach((item) => {
      pRows += `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 8px;"><strong>${escapeHtml(item.name)}</strong></td>
          <td style="padding: 6px 8px; color: #64748b;">${escapeHtml(item.company)}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${item.completedCount} / ${item.ridesTotal}</td>
          <td style="padding: 6px 8px; text-align: center;">${item.totalKm.toFixed(1)} km</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #0f172a;">R$ ${item.totalFare.toFixed(2).replace(".", ",")}</td>
        </tr>
      `;
    });

    passengerSummaryTableHtml = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">
          ● Resumo Consolidado de Fechamento por Passageiro & Empresa
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr style="background: #e2e8f0;">
              <th style="padding: 6px 8px; text-align: left; font-size: 10px;">Passageiro</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 10px;">Empresa Convênio</th>
              <th style="padding: 6px 8px; text-align: center; font-size: 10px;">Corridas Feitas</th>
              <th style="padding: 6px 8px; text-align: center; font-size: 10px;">Km Rodados</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 10px;">Subtotal (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${pRows}
          </tbody>
        </table>
      </div>
    `;
  }

  const rowsHtml = filtered.map((r, idx) => {
    const isComp = ["COMPLETED", "FINISHED", "FINALIZADA", "CONCLUIDA", "PAID"].includes(r.status);
    const isCanc = ["CANCELLED", "CANCELED", "CANCELADA", "REJECTED"].includes(r.status);
    const statusColor = isComp ? "#268269" : isCanc ? "#c4554b" : "#e5a83b";
    const statusLabel = isComp ? "Finalizada" : isCanc ? "Cancelada" : "Em Rota";

    const dateStr = new Date(r.created_at).toLocaleString("pt-BR");

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10.5px;">
        <td style="padding: 6px 5px; text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
        <td style="padding: 6px 5px; white-space: nowrap; color: #334155;"><strong>${r.code}</strong><br><small>${dateStr}</small></td>
        <td style="padding: 6px 5px;"><strong>${escapeHtml(r.passenger_name)}</strong><br><small style="color:#64748b;">${escapeHtml(r.company)}</small></td>
        <td style="padding: 6px 5px; max-width: 170px;"><span style="color:#15803d; font-weight:bold;">● </span>${escapeHtml(r.pickup_address)}</td>
        <td style="padding: 6px 5px; max-width: 170px;"><span style="color:#b45309; font-weight:bold;">● </span>${escapeHtml(r.dropoff_address)}</td>
        <td style="padding: 6px 5px;"><strong>${escapeHtml(r.driver_name)}</strong><br><small style="color:#64748b;">${escapeHtml(r.driver_vehicle)}</small></td>
        <td style="padding: 6px 5px; text-align: center;">${r.distance_km ? `${r.distance_km.toFixed(1)} km` : "-"}</td>
        <td style="padding: 6px 5px; text-align: center; font-size: 9.5px;">${escapeHtml(r.payment_method)}</td>
        <td style="padding: 6px 5px; text-align: center;">
          <span style="display: inline-block; padding: 2px 5px; border-radius: 4px; font-weight: 700; font-size: 9.5px; background: ${statusColor}18; color: ${statusColor};">
            ${statusLabel}
          </span>
        </td>
        <td style="padding: 6px 5px; text-align: right; font-weight: bold; color: #0f172a;">R$ ${r.fare_amount.toFixed(2).replace(".", ",")}</td>
      </tr>
    `;
  }).join("");

  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) {
    alert("Por favor, permita pop-ups no navegador para gerar o PDF.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Faturamento Consolidado - SR Logística</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 15px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
        .title { font-size: 20px; font-weight: 900; color: #0f172a; }
        .subtitle { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px; }
        .doc-badge { background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; text-align: right; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
        .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; text-align: center; border-radius: 8px; }
        .box .val { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px; }
        .box .lbl { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .box.highlight { background: #0f172a; color: #fff; }
        .box.highlight .val { color: #38bdf8; }
        .box.highlight .lbl { color: #94a3b8; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; text-align: left; padding: 8px 5px; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
        .signatures { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; text-align: center; font-size: 11px; color: #475569; }
        .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-weight: 600; }
        .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">SR LOGÍSTICA & TRANSPORTE CORPORATIVO</div>
          <div class="subtitle">Extrato Oficial de Fechamento de Faturamento e Corridas</div>
        </div>
        <div class="doc-badge">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Período do Fechamento</div>
          <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${periodLabel}</div>
          <div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px;">Emissão: ${emissionDate}</div>
        </div>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 14px; margin-bottom:14px; font-size:11.5px;">
        <strong>Escopo do Relatório:</strong> ${escapeHtml(passengerFilterLabel)} (${pMap.size} passageiro(s) atendido(s))
      </div>

      <div class="grid">
        <div class="box">
          <div class="lbl">Viagens no Período</div>
          <div class="val">${filtered.length}</div>
        </div>
        <div class="box">
          <div class="lbl">Corridas Concluídas</div>
          <div class="val" style="color:#268269;">${completed.length}</div>
        </div>
        <div class="box">
          <div class="lbl">Quilometragem Total</div>
          <div class="val">${totalKm.toFixed(1)} km</div>
        </div>
        <div class="box highlight">
          <div class="lbl">Faturamento Bruto Total</div>
          <div class="val">R$ ${totalFare.toFixed(2).replace(".", ",")}</div>
        </div>
      </div>

      ${passengerSummaryTableHtml}

      <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">
        ● Detalhamento Individual de Cada Corrida Realizada
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:25px; text-align:center;">#</th>
            <th>Cód. / Data</th>
            <th>Passageiro / Empresa</th>
            <th>Origem (Embarque)</th>
            <th>Destino (Desembarque)</th>
            <th>Motorista & Veículo</th>
            <th style="text-align:center;">Km</th>
            <th style="text-align:center;">Pagamento</th>
            <th style="text-align:center;">Status</th>
            <th style="text-align:right;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="signatures">
        <div><div class="sig-line">SR Logística & Transporte - Gestão Operacional</div></div>
        <div><div class="sig-line">Aprovação da Empresa Contratante / Financeiro</div></div>
      </div>

      <div class="footer">
        SR Logística e Transporte Ltda • CNPJ 52.967.828/0001-17 • Manaus - AM • Plataforma de Gestão Corporativa
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 350);
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function exportReportsCSV() {
  const filtered = getFilteredReportRides();
  if (filtered.length === 0) {
    alert("Não há dados no período selecionado para exportar.");
    return;
  }

  const headers = [
    "Codigo_Corrida",
    "Data_Hora",
    "Passageiro",
    "Empresa",
    "Telefone_Passageiro",
    "Endereco_Origem",
    "Endereco_Destino",
    "Motorista",
    "Veiculo_Placa",
    "Distancia_KM",
    "Duracao_Min",
    "Forma_Pagamento",
    "Status",
    "Valor_R$",
  ];

  const rows = filtered.map((r) => [
    `"${r.code}"`,
    `"${new Date(r.created_at).toLocaleString("pt-BR")}"`,
    `"${(r.passenger_name || "").replace(/"/g, '""')}"`,
    `"${(r.company || "").replace(/"/g, '""')}"`,
    `"${(r.passenger_phone || "").replace(/"/g, '""')}"`,
    `"${(r.pickup_address || "").replace(/"/g, '""')}"`,
    `"${(r.dropoff_address || "").replace(/"/g, '""')}"`,
    `"${(r.driver_name || "").replace(/"/g, '""')}"`,
    `"${(r.driver_vehicle || "").replace(/"/g, '""')}"`,
    `"${r.distance_km ? r.distance_km.toFixed(1) : 0}"`,
    `"${r.duration_min || 0}"`,
    `"${r.payment_method || "Voucher"}"`,
    `"${r.status}"`,
    `"${r.fare_amount.toFixed(2).replace(".", ",")}"`,
  ]);

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio_corridas_completo_sr_${currentReportPeriod.toLowerCase()}_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


