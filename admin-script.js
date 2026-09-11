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
let passengerSearchQuery = "";
let passengerCompanyFilter = "";
let passengerBaseSearchQuery = "";

let motoristasCache = [];
let passageirosCache = [];
let postsCache = [];

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

// Inicialização ao carregar o DOM
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupLoginForm();
  setupSecurityForm();
  setupPostsForm();
  setupPassengerModal();
  setupPassengerFilters();
  checkSession();
});

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

  // Botões de atualização manual
  const btnRefreshDrivers = document.getElementById("refresh-approvals");
  if (btnRefreshDrivers) {
    btnRefreshDrivers.addEventListener("click", () => loadMotoristas());
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
      "passenger-approvals": "Aprovações de Passageiros",
      approvals: "Aprovações de Motoristas",
      passengers: "Passageiros Homologados",
      drivers: "Motoristas Cadastrados",
      posts: "Comunicados",
      security: "Segurança",
    };
    titleElem.textContent = titles[viewId] || "Painel Admin";
  }

  // Fecha o menu mobile ao navegar
  const sidebar = document.querySelector(".sidebar");
  if (sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
  }
}

// --- CARREGAMENTO CENTRAL ---
async function loadAllData() {
  await Promise.all([loadMotoristas(), loadPassageiros(), loadPosts()]);
}

// --- PASSAGEIROS: CARREGAMENTO & CACHE ---
async function loadPassageiros() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from("passageiros")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // Caso a tabela ainda não tenha sido criada no Supabase SQL Editor
      console.warn(
        "Aviso ao consultar tabela 'passageiros':",
        error.message,
        "(Utilizando armazenamento local de contingência)",
      );
      const localData = localStorage.getItem("sr_passageiros_cache");
      passageirosCache = localData ? JSON.parse(localData) : getInitialPassengersMock();
    } else {
      passageirosCache = data || [];
      localStorage.setItem(
        "sr_passageiros_cache",
        JSON.stringify(passageirosCache),
      );
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

// --- MOTORISTAS: CARREGAMENTO ---
async function loadMotoristas() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from("motoristas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    motoristasCache = data || [];
    updateMetrics();
    renderOverviewApprovals();
    renderApprovals();
    renderDrivers();
  } catch (err) {
    console.error("Erro ao buscar motoristas:", err);
  }
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

  // Atualiza contadores no DOM
  const mPending = document.getElementById("metric-pending");
  const mApproved = document.getElementById("metric-approved");
  const nDriverPending = document.getElementById("nav-pending-count");
  const pDriverTab = document.getElementById("pending-tab-count");
  const aDriverTab = document.getElementById("approved-tab-count");

  if (mPending) mPending.textContent = String(driversPending);
  if (mApproved) mApproved.textContent = String(driversApproved);
  if (nDriverPending) nDriverPending.textContent = String(driversPending);
  if (pDriverTab) pDriverTab.textContent = String(driversPending);
  if (aDriverTab) aDriverTab.textContent = String(driversApproved);

  const mPassPending = document.getElementById("metric-passenger-pending");
  const mPassApproved = document.getElementById("metric-passenger-approved");
  const nPassPending = document.getElementById("nav-passenger-pending-count");
  const pPassPendingTab = document.getElementById("passenger-pending-tab-count");
  const pPassApprovedTab = document.getElementById(
    "passenger-approved-tab-count",
  );
  const pPassRejectedTab = document.getElementById(
    "passenger-rejected-tab-count",
  );
  const pPassAllTab = document.getElementById("passenger-all-tab-count");

  if (mPassPending) mPassPending.textContent = String(passengersPending);
  if (mPassApproved) mPassApproved.textContent = String(passengersApproved);
  if (nPassPending) nPassPending.textContent = String(passengersPending);
  if (pPassPendingTab) pPassPendingTab.textContent = String(passengersPending);
  if (pPassApprovedTab) pPassApprovedTab.textContent = String(passengersApproved);
  if (pPassRejectedTab) pPassRejectedTab.textContent = String(passengersRejected);
  if (pPassAllTab) pPassAllTab.textContent = String(passageirosCache.length);
}

// --- VISÃO GERAL: SOLICITAÇÕES RECENTES UNIFICADAS ---
function renderOverviewApprovals() {
  const container = document.getElementById("recent-approvals");
  if (!container) return;

  const pendingPassengers = passageirosCache
    .filter((p) => p.status === "Pendente")
    .slice(0, 3);
  const pendingDrivers = motoristasCache
    .filter((m) => m.status === "Pendente" || m.vehicle_status === "Pendente")
    .slice(0, 3);

  if (pendingPassengers.length === 0 && pendingDrivers.length === 0) {
    container.innerHTML =
      '<p class="loading-state"><i class="fas fa-check-circle" style="color:#268269;"></i> Nenhuma solicitação pendente no momento.</p>';
    return;
  }

  let html = "";

  // Passageiros Pendentes no topo
  pendingPassengers.forEach((p) => {
    const name = p.nome_social || p.nome || "Passageiro";
    const subInfo =
      (p.empresa || "Empresa não inf.") +
      (p.setor ? " · " + p.setor : "") +
      (p.telefone ? " · " + p.telefone : "");

    html += `
      <div class="approval-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--line);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="person-avatar" style="background:var(--green-soft); color:var(--green);">
            <i class="fas fa-user"></i>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <strong>${escapeHtml(name)}</strong>
              <span class="tag-company">${escapeHtml(p.empresa || "Passageiro")}</span>
            </div>
            <small style="color:var(--ink-soft);">${escapeHtml(subInfo)}</small>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary" style="padding:6px 12px; font-size:11px; min-height:30px; width:auto;" onclick="approvePassenger('${p.id}')">
            <i class="fas fa-check"></i> Aprovar
          </button>
          <button class="btn btn-secondary" style="padding:6px 10px; font-size:11px; min-height:30px;" onclick="rejectPassenger('${p.id}')" title="Reprovar">
            <i class="fas fa-xmark"></i>
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

    html += `
      <div class="approval-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--line);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="person-avatar">
            <i class="fas fa-id-card"></i>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <strong>${escapeHtml(displayName)}</strong>
              <span class="tag-dept">Motorista</span>
            </div>
            <small style="color:var(--ink-soft);">${escapeHtml(carInfo)}</small>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary" style="padding:6px 12px; font-size:11px; min-height:30px; width:auto;" onclick="approveDriver('${m.id}')">
            <i class="fas fa-check"></i> Aprovar
          </button>
          <button class="btn btn-secondary" style="padding:6px 10px; font-size:11px; min-height:30px;" onclick="rejectDriver('${m.id}')" title="Reprovar">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
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
  const companies = Array.from(
    new Set(
      passageirosCache
        .map((p) => p.empresa)
        .filter((emp) => emp && emp.trim() !== ""),
    ),
  ).sort();

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
          <th>Passageiro / Nome</th>
          <th>Contato & E-mail</th>
          <th>Empresa & Setor</th>
          <th>Turno / Matrícula</th>
          <th>Origem & Data</th>
          <th>Status</th>
          <th style="text-align:right;">Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  list.forEach((p) => {
    const isPending = p.status === "Pendente";
    const isApproved = p.status === "Aprovado";
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
        <td style="padding:14px 16px;">
          <strong>${escapeHtml(p.nome_social || p.nome)}</strong>
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
          <span style="font-size:11px; font-weight:600; color:#475569;"><i class="fas fa-mobile-screen"></i> ${escapeHtml(p.origem || "App")}</span>
          <small style="color:var(--ink-soft); display:block;">${dateFormatted}</small>
        </td>
        <td style="padding:14px 16px;">
          <span class="status-badge ${isPending ? "pending" : isApproved ? "approved" : "rejected"}">
            ${escapeHtml(p.status)}
          </span>
        </td>
        <td style="padding:14px 16px; text-align:right; white-space:nowrap;">
          ${
            isPending
              ? `
              <button class="btn btn-primary" style="padding:5px 11px; font-size:11px; margin-right:4px; width:auto; min-height:30px;" onclick="approvePassenger('${p.id}')">
                <i class="fas fa-check"></i> Aprovar
              </button>
              <button class="btn btn-secondary" style="padding:5px 8px; font-size:11px; min-height:30px;" onclick="rejectPassenger('${p.id}')" title="Reprovar">
                <i class="fas fa-ban"></i>
              </button>
            `
              : `
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; min-height:28px; margin-right:4px;" onclick="deletePassenger('${p.id}')" title="Remover registro">
                <i class="fas fa-trash-can" style="color:var(--red);"></i>
              </button>
              ${
                !isApproved
                  ? `<button class="btn btn-primary" style="padding:4px 8px; font-size:11px; width:auto; min-height:28px;" onclick="approvePassenger('${p.id}')">Reativar</button>`
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
    const initial = (p.nome_social || p.nome || "P").charAt(0).toUpperCase();
    const cleanPhone = (p.telefone || "").replace(/\D/g, "");
    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

    html += `
      <div class="driver-card" style="background:var(--white); border:1px solid var(--line); border-radius:var(--radius); padding:18px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="width:42px; height:42px; border-radius:10px; background:var(--green-soft); color:var(--green); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px;">
            ${initial}
          </div>
          <div>
            <strong style="font-size:14px; display:block;">${escapeHtml(p.nome_social || p.nome)}</strong>
            <small style="font-size:11px; color:var(--ink-soft);">${escapeHtml(p.nome_completo || "")}</small>
          </div>
          <span class="status-badge approved" style="margin-left:auto;">Ativo</span>
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
          <button class="btn btn-secondary" style="padding:3px 8px; font-size:11px; min-height:26px;" onclick="rejectPassenger('${p.id}')" title="Suspender / Desativar acesso">
            <i class="fas fa-ban" style="color:var(--red);"></i> Desativar
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// --- FUNÇÕES DE APROVAÇÃO & GESTÃO DE PASSAGEIROS ---
window.approvePassenger = async function (id) {
  if (!confirm("Deseja homologar e aprovar o acesso deste passageiro às rotas?"))
    return;

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("passageiros")
        .update({ status: "Aprovado", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error && error.code !== "PGRST205") throw error;
    }

    // Atualiza cache local
    const item = passageirosCache.find((p) => String(p.id) === String(id));
    if (item) item.status = "Aprovado";
    localStorage.setItem(
      "sr_passageiros_cache",
      JSON.stringify(passageirosCache),
    );

    showNotification("Passageiro aprovado com sucesso!", "success");
    await loadPassageiros();
  } catch (err) {
    showNotification("Erro ao aprovar passageiro: " + err.message, "error");
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
      const { error } = await supabaseClient
        .from("passageiros")
        .update({
          status: "Reprovado",
          motivo_rejeicao: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error && error.code !== "PGRST205") throw error;
    }

    // Atualiza cache local
    const item = passageirosCache.find((p) => String(p.id) === String(id));
    if (item) {
      item.status = "Reprovado";
      item.motivo_rejeicao = reason;
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
  if (!confirm("Deseja realmente remover este registro de passageiro?")) return;

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

    showNotification("Registro removido.", "info");
    await loadPassageiros();
  } catch (err) {
    showNotification("Erro ao remover: " + err.message, "error");
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

  const openModal = () => {
    if (modal) modal.classList.remove("hidden");
    if (feedback) {
      feedback.textContent = "";
      feedback.className = "feedback-msg";
    }
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

// --- ABA: APROVAÇÕES DE MOTORISTAS ---
function renderApprovals() {
  const container = document.getElementById("approvals-container");
  if (!container) return;

  const list =
    currentDriverTab === "pending"
      ? motoristasCache.filter(
          (m) => m.status === "Pendente" || m.vehicle_status === "Pendente",
        )
      : motoristasCache.filter((m) => m.status === "Aprovado");

  if (list.length === 0) {
    container.innerHTML =
      '<p class="loading-state">Nenhum registro encontrado nesta aba de motoristas.</p>';
    return;
  }

  let html =
    '<table class="approval-table" style="width:100%; text-align:left; border-collapse:collapse;">';
  html +=
    '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.15); font-size:12px; color:#94a3b8;">';
  html += '<th style="padding:10px;">Como deseja ser chamado / Nome</th>';
  html += '<th style="padding:10px;">Contato</th>';
  html += '<th style="padding:10px;">Veículo & Placa</th>';
  html += '<th style="padding:10px;">Tipo</th>';
  html += '<th style="padding:10px;">Status</th>';
  html += '<th style="padding:10px; text-align:right;">Ações</th>';
  html += "</tr></thead><tbody>";

  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    const isVehicleChange =
      m.vehicle_status === "Pendente" && m.status === "Aprovado";
    const isPending =
      m.status === "Pendente" || m.vehicle_status === "Pendente";

    html +=
      '<tr style="border-bottom:1px solid var(--line); font-size:13px;">';
    html +=
      '  <td style="padding:10px;"><strong>' +
      escapeHtml(m.nome_social || m.nome) +
      '</strong><br><small style="color:var(--ink-soft);">' +
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
      '  <td style="padding:10px;"><span class="status-badge ' +
      (isPending ? "pending" : "approved") +
      '">' +
      (isVehicleChange ? "Carro em Análise" : escapeHtml(m.status)) +
      "</span></td>";
    html += '  <td style="padding:10px; text-align:right;">';

    if (isPending) {
      html +=
        '    <button class="btn btn-primary" style="padding:4px 10px; font-size:12px; margin-right:5px; width:auto; min-height:30px;" onclick="approveDriver(\'' +
        m.id +
        '\')"><i class="fas fa-check"></i> Aprovar</button>';
      html +=
        '    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; min-height:30px;" onclick="rejectDriver(\'' +
        m.id +
        '\')"><i class="fas fa-ban"></i></button>';
    } else {
      html +=
        '    <span style="color:var(--green); font-weight:bold; font-size:12px;"><i class="fas fa-circle-check"></i> Homologado</span>';
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
    const initial = (m.nome_social || m.nome || "M").charAt(0).toUpperCase();

    html += `
      <div class="driver-card">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="width:40px; height:40px; border-radius:10px; background:var(--amber-soft); color:#925c0a; display:flex; align-items:center; justify-content:center; font-weight:bold;">
            ${initial}
          </div>
          <div>
            <strong style="font-size:14px; display:block;">${escapeHtml(m.nome_social || m.nome)}</strong>
            <small style="font-size:11px; color:var(--ink-soft);">${escapeHtml(m.nome_completo || "")}</small>
          </div>
          <span class="status-badge approved" style="margin-left:auto;">Ativo</span>
        </div>
        <div class="driver-detail" style="font-size:12px; line-height:1.7;">
          <div><i class="fas fa-car" style="width:18px; color:var(--green);"></i> ${escapeHtml(m.marca_veiculo || "")} ${escapeHtml(m.modelo_veiculo || "Veículo não inf.")}</div>
          <div><i class="fas fa-id-card" style="width:18px; color:var(--green);"></i> Placa: <strong>${escapeHtml(m.placa_veiculo || "—")}</strong> (${escapeHtml(m.cor_veiculo || "Cor —")})</div>
          <div><i class="fas fa-phone" style="width:18px; color:var(--green);"></i> ${escapeHtml(m.telefone || m.phone || "Sem telefone")}</div>
          <div><i class="fas fa-location-dot" style="width:18px; color:var(--green);"></i> Manaus - AM</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// --- FUNÇÕES DE APROVAÇÃO DE MOTORISTAS ---
window.approveDriver = async function (driverId) {
  if (!confirm("Deseja aprovar este motorista / veículo?")) return;
  try {
    const { error } = await supabaseClient
      .from("motoristas")
      .update({ status: "Aprovado", vehicle_status: "Aprovado" })
      .eq("id", driverId);

    if (error) throw error;
    showNotification("Motorista aprovado com sucesso!", "success");
    await loadMotoristas();
  } catch (err) {
    showNotification("Erro ao aprovar: " + err.message, "error");
  }
};

window.rejectDriver = async function (driverId) {
  if (!confirm("Deseja recusar esta solicitação de motorista?")) return;
  try {
    const { error } = await supabaseClient
      .from("motoristas")
      .update({ status: "Reprovado", vehicle_status: "Reprovado" })
      .eq("id", driverId);

    if (error) throw error;
    showNotification("Solicitação de motorista reprovada.", "warning");
    await loadMotoristas();
  } catch (err) {
    showNotification("Erro ao reprovar: " + err.message, "error");
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
