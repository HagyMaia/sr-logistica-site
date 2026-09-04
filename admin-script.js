/**
 * SR Logística & Transporte - Painel Admin
 * Script corrigido (sem conflitos de JSX / Crases)
 */

// 1. CREDENCIAIS DO SUPABASE
// Insira as chaves do seu projeto Supabase:
const SUPABASE_URL = "https://lvdplhnbkkmlcxeuqhdo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CoC8vHLwAQ3kGsXwWBlaoA_4LB5SzsK";

const supabaseClient =
  typeof window !== "undefined" && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Estado
let currentView = "overview";
let currentTab = "pending";
let motoristasCache = [];
let postsCache = [];

// Inicialização ao carregar o documento
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupLoginForm();
  setupSecurityForm();
  setupPostsForm();
  checkSession();
});

// --- AUTENTICAÇÃO ---
async function checkSession() {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin();
  }
}

function showLogin() {
  const login = document.getElementById("login-container");
  const dash = document.getElementById("dashboard-container");
  if (login) login.classList.remove("hidden");
  if (dash) dash.classList.add("hidden");
}

function showDashboard() {
  const login = document.getElementById("login-container");
  const dash = document.getElementById("dashboard-container");
  if (login) login.classList.add("hidden");
  if (dash) dash.classList.remove("hidden");
  loadAllData();
}

function setupLoginForm() {
  const loginForm = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  const togglePass = document.getElementById("togglePassword");
  const passInput = document.getElementById("admin-password");

  if (togglePass && passInput) {
    togglePass.addEventListener("click", () => {
      const isPass = passInput.getAttribute("type") === "password";
      passInput.setAttribute("type", isPass ? "text" : "password");
      togglePass.innerHTML =
        '<i class="fas fa-' + (isPass ? "eye-slash" : "eye") + '"></i>';
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("admin-user");
      const email = emailInput ? emailInput.value.trim() : "";
      const password = passInput ? passInput.value : "";

      if (!email || !password) {
        if (feedback) {
          feedback.textContent = "Preencha o e-mail e a senha.";
          feedback.className = "feedback-msg error";
        }
        return;
      }

      if (feedback) {
        feedback.textContent = "Verificando credenciais...";
        feedback.className = "feedback-msg info";
      }

      try {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
        if (feedback) feedback.textContent = "";
        showDashboard();
      } catch (err) {
        if (feedback) {
          feedback.textContent = err.message || "Credenciais inválidas.";
          feedback.className = "feedback-msg error";
        }
      }
    });
  }

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      if (supabaseClient) await supabaseClient.auth.signOut();
      showLogin();
    });
  }
}

// --- NAVEGAÇÃO ---
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

  const tabs = document.querySelectorAll(".tabs .tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.getAttribute("data-status") || "pending";
      renderApprovals();
    });
  });

  const btnRefresh = document.getElementById("refresh-approvals");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      loadMotoristas();
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
      approvals: "Aprovações de Motoristas",
      drivers: "Motoristas Cadastrados",
      posts: "Comunicados",
      security: "Segurança",
    };
    titleElem.textContent = titles[viewId] || "Painel Admin";
  }
}

// --- CARREGAMENTO DE DADOS ---
async function loadAllData() {
  await Promise.all([loadMotoristas(), loadPosts()]);
}

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

// --- MÉTRICAS ---
function updateMetrics() {
  const pending = motoristasCache.filter(
    (m) => m.status === "Pendente" || m.vehicle_status === "Pendente",
  ).length;
  const approved = motoristasCache.filter(
    (m) => m.status === "Aprovado",
  ).length;

  const mPending = document.getElementById("metric-pending");
  const mApproved = document.getElementById("metric-approved");
  const nPending = document.getElementById("nav-pending-count");
  const pTab = document.getElementById("pending-tab-count");
  const aTab = document.getElementById("approved-tab-count");

  if (mPending) mPending.textContent = String(pending);
  if (mApproved) mApproved.textContent = String(approved);
  if (nPending) nPending.textContent = String(pending);
  if (pTab) pTab.textContent = String(pending);
  if (aTab) aTab.textContent = String(approved);
}

// --- VISÃO GERAL: SOLICITAÇÕES RECENTES ---
function renderOverviewApprovals() {
  const container = document.getElementById("recent-approvals");
  if (!container) return;

  const pendentes = motoristasCache
    .filter((m) => m.status === "Pendente" || m.vehicle_status === "Pendente")
    .slice(0, 4);

  if (pendentes.length === 0) {
    container.innerHTML =
      '<p class="loading-state"><i class="fas fa-check-circle" style="color:#10b981"></i> Nenhuma aprovação pendente no momento.</p>';
    return;
  }

  let html = "";
  for (let i = 0; i < pendentes.length; i++) {
    const m = pendentes[i];
    const displayName = m.nome_social || m.nome || "Motorista";
    const carInfo =
      (m.marca_veiculo || "") +
      " " +
      (m.modelo_veiculo || "") +
      " (" +
      (m.placa_veiculo || "—") +
      ")";

    html +=
      '<div class="approval-card-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid rgba(255, 255, 255, 0.08);">';
    html += "  <div>";
    html += "    <strong>" + displayName + "</strong>";
    html += '    <br><small style="color:#94a3b8">' + carInfo + "</small>";
    html += "  </div>";
    html += '  <div style="display:flex; gap:8px;">';
    html +=
      '    <button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="approveDriver(\'' +
      m.id +
      '\')"><i class="fas fa-check"></i> Aprovar</button>';
    html +=
      '    <button class="btn btn-secondary" style="padding:6px 10px; font-size:12px;" onclick="rejectDriver(\'' +
      m.id +
      '\')"><i class="fas fa-xmark"></i></button>';
    html += "  </div>";
    html += "</div>";
  }

  container.innerHTML = html;
}

// --- ABA: APROVAÇÕES ---
function renderApprovals() {
  const container = document.getElementById("approvals-container");
  if (!container) return;

  const list =
    currentTab === "pending"
      ? motoristasCache.filter(
          (m) => m.status === "Pendente" || m.vehicle_status === "Pendente",
        )
      : motoristasCache.filter((m) => m.status === "Aprovado");

  if (list.length === 0) {
    container.innerHTML =
      '<p class="loading-state">Nenhum registro encontrado nesta aba.</p>';
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
      '<tr style="border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px;">';
    html +=
      '  <td style="padding:10px;"><strong>' +
      (m.nome_social || m.nome) +
      '</strong><br><small style="color:#94a3b8">' +
      (m.nome_completo || m.nome || "") +
      '</small><br><small style="color:#64748b">CPF: ' +
      (m.cpf || "—") +
      "</small></td>";
    html +=
      '  <td style="padding:10px;">' +
      (m.telefone || "—") +
      '<br><small style="color:#94a3b8">' +
      (m.email || "") +
      "</small></td>";
    html +=
      '  <td style="padding:10px;"><strong>' +
      (m.marca_veiculo || "") +
      " " +
      (m.modelo_veiculo || "") +
      '</strong><br><span style="background:rgba(255,255,255, 0.1); padding: 2px 6px; border-radius: 4px; font-weight: bold;">' +
      (m.placa_veiculo || "—") +
      '</span> <small style="color:#94a3b8">' +
      (m.cor_veiculo || "") +
      "</small></td>";
    html +=
      '  <td style="padding:10px;">' +
      (isVehicleChange
        ? '<span style="color:#f59e0b; font-weight:bold;">Troca de Carro</span>'
        : '<span style="color:#38bdf8; font-weight: bold;">Novo Cadastro</span>') +
      "</td>";
    html +=
      '  <td style="padding:10px;"><span style="padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold; background:' +
      (isPending
        ? "rgba(245, 158, 11, 0.2); color: #fbbf24;"
        : "rgba(16, 185, 129, 0.2); color:#34d399;") +
      '">' +
      (isVehicleChange ? "Carro em Análise" : m.status) +
      "</span></td>";
    html += '  <td style="padding:10px; text-align:right;">';

    if (isPending) {
      html +=
        '    <button class="btn btn-primary" style="padding:4px 10px; font-size:12px; margin-right:5px;" onclick="approveDriver(\'' +
        m.id +
        '\')"><i class="fas fa-check"></i> Aprovar</button>';
      html +=
        '    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="rejectDriver(\'' +
        m.id +
        '\')"><i class="fas fa-ban"></i></button>';
    } else {
      html +=
        '    <span style="color:#10b981; font-weight:bold; font-size:12px;"><i class="fas fa-circle-check"></i> Homologado</span>';
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

    html +=
      '<div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:16px; margin-bottom:12px;">';
    html +=
      '  <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">';
    html +=
      '    <div style="width:40px; height:40px; border-radius:10px; background:rgba(56,189,248,0.2); color:#38bdf8; display:flex; align-items:center; justify-content: center; font-weight: bold;">' +
      initial +
      "</div>";
    html += "    <div>";
    html +=
      '      <strong style="font-size:15px;">' +
      (m.nome_social || m.nome) +
      "</strong>";
    html +=
      '      <div style="font-size:12px; color:#94a3b8;">' +
      (m.nome_completo || "") +
      "</div>";
    html += "    </div>";
    html += "  </div>";
    html += '  <div style="font-size:13px; color:#cbd5e1; line-height:1.6;">';
    html +=
      '    <div><i class="fas fa-car" style="width:18px; color:#38bdf8;"></i> ' +
      (m.marca_veiculo || "") +
      " " +
      (m.modelo_veiculo || "Veículo não inf.") +
      "</div>";
    html +=
      '    <div><i class="fas fa-id-card" style="width:18px; color:#38bdf8;"></i> Placa: <strong>' +
      (m.placa_veiculo || "—") +
      "</strong> (" +
      (m.cor_veiculo || "Cor —") +
      ")</div>";
    html +=
      '    <div><i class="fas fa-phone" style="width:18px; color:#38bdf8;"></i> ' +
      (m.telefone || "Sem telefone") +
      "</div>";
    html +=
      '    <div><i class="fas fa-location-dot" style="width:18px; color:#38bdf8;"></i> Manaus - AM</div>';
    html += "  </div>";
    html += "</div>";
  }

  container.innerHTML = html;
}

// --- FUNÇÕES DE APROVAÇÃO ---
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
  if (!confirm("Deseja recusar esta solicitação?")) return;
  try {
    const { error } = await supabaseClient
      .from("motoristas")
      .update({ status: "Reprovado", vehicle_status: "Reprovado" })
      .eq("id", driverId);

    if (error) throw error;
    showNotification("Solicitação reprovada.", "warning");
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
        const { error } = await supabaseClient.from("comunicados").insert([
          {
            categoria: type,
            titulo: title,
            conteudo: content,
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
      .from("comunicados")
      .select("*")
      .order("created_at", { ascending: false });

    postsCache = data || [];
    const metricElem = document.getElementById("metric-posts");
    if (metricElem) metricElem.textContent = String(postsCache.length);

    const container = document.getElementById("posts-container");
    if (container) {
      if (postsCache.length === 0) {
        container.innerHTML =
          '<p style="color:#94a3b8;">Nenhum comunicado cadastrado.</p>';
      } else {
        let html = "";
        for (let i = 0; i < postsCache.length; i++) {
          const p = postsCache[i];
          html +=
            '<div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; margin-bottom:10px;">';
          html +=
            '  <span style="font-size:11px; font-weight:bold; color:#38bdf8;">' +
            (p.categoria === "promo" ? "PROMOÇÃO" : "AVISO") +
            "</span>";
          html += '  <h4 style="margin:4px 0 6px 0;">' + p.titulo + "</h4>";
          html +=
            '  <p style="font-size:13px; color:#cbd5e1; margin:0;">' +
            p.conteudo +
            "</p>";
          html += "</div>";
        }
        container.innerHTML = html;
      }
    }
  } catch (err) {
    // Tabela opcional
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

// --- NOTIFICAÇÃO ---
function showNotification(msg, type) {
  const elem = document.getElementById("global-feedback");
  if (elem) {
    elem.textContent = msg;
    elem.className = "global-feedback active " + (type || "info");
    setTimeout(() => {
      elem.className = "global-feedback";
    }, 4000);
  }
}
