// ============================================================
//  Quadro de Tarefas — lógica
// ============================================================

const statusEl = document.getElementById("status");
const boardsEl = document.getElementById("boards");

// Qual aba está aberta em cada painel: "ativas" | "concluidas"
const activeTab = {};
// Cache local das tarefas
let tasks = [];

// --- inicialização ---------------------------------------------------------

if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  setStatus("faltam credenciais (rode: npm run build)", "err");
}

if (!window.supabase) {
  setStatus("Supabase JS não carregou (sem internet?)", "err");
  throw new Error("supabase-js CDN não carregou");
}

let db;
try {
  db = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
} catch (e) {
  setStatus("credenciais inválidas: " + e.message, "err");
  throw e;
}

MEMBERS.forEach((m) => (activeTab[m.id] = "ativas"));

initWhoami();
renderSkeleton();
loadTasks();

// Sincronização em tempo real entre os integrantes
db
  .channel("tarefas")
  .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
  .subscribe();

// --- dados -----------------------------------------------------------------

async function loadTasks() {
  try {
    const { data, error } = await db
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      // Erro vindo do banco (ex.: tabela não existe → rode o schema.sql)
      console.error(error);
      const hint = /relation .*tasks.* does not exist|not exist/i.test(error.message || "")
        ? "tabela não existe — rode o schema.sql no Supabase"
        : (error.message || "erro ao carregar");
      setStatus(hint, "err");
      return;
    }
    tasks = data || [];
    setStatus("online", "ok");
    renderAll();
  } catch (e) {
    // Falha de rede (URL errada, projeto pausado, sem internet, CORS…)
    console.error("Falha ao conectar no Supabase:", e);
    setStatus("falha de conexão — veja o console (F12)", "err");
  }
}

async function addTask(memberId, title, description, assignedBy) {
  const { error } = await db
    .from("tasks")
    .insert({ member_id: memberId, title, description, assigned_by: assignedBy, done: false });
  if (error) { console.error(error); alert("Não foi possível adicionar a tarefa."); }
  else loadTasks();
}

async function toggleTask(id, done) {
  const { error } = await db
    .from("tasks")
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) console.error(error);
  else loadTasks();
}

async function deleteTask(id) {
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) console.error(error);
  else loadTasks();
}

// --- renderização ----------------------------------------------------------

function renderSkeleton() {
  boardsEl.innerHTML = "";
  MEMBERS.forEach((m) => {
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.style.setProperty("--accent", m.color);
    panel.dataset.member = m.id;
    panel.innerHTML = `
      <div class="panel-head">
        <div class="name">${esc(m.name)}</div>
        <div class="role">${esc(m.role)}</div>
      </div>
      <div class="tabs">
        <button class="tab" data-tab="ativas">Ativas <span class="count"></span></button>
        <button class="tab" data-tab="concluidas">Concluídas <span class="count"></span></button>
      </div>
      <button class="add-btn" type="button">＋ Nova tarefa</button>
      <ul class="list"></ul>`;
    boardsEl.appendChild(panel);

    panel.querySelectorAll(".tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeTab[m.id] = btn.dataset.tab;
        renderPanel(m);
      })
    );
    panel.querySelector(".add-btn").addEventListener("click", () =>
      requireIdentity(() => openAddModal(m))
    );
  });
}

function renderAll() {
  MEMBERS.forEach(renderPanel);
}

function renderPanel(m) {
  const panel = boardsEl.querySelector(`[data-member="${m.id}"]`);
  if (!panel) return;

  const mine = tasks.filter((t) => t.member_id === m.id);
  const ativas = mine.filter((t) => !t.done);
  const concluidas = mine.filter((t) => t.done);

  // contadores + aba ativa
  const tabButtons = panel.querySelectorAll(".tab");
  tabButtons[0].querySelector(".count").textContent = `(${ativas.length})`;
  tabButtons[1].querySelector(".count").textContent = `(${concluidas.length})`;
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === activeTab[m.id]));

  const list = activeTab[m.id] === "ativas" ? ativas : concluidas;
  const ul = panel.querySelector(".list");
  ul.innerHTML = "";

  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = activeTab[m.id] === "ativas" ? "Nenhuma tarefa por aqui 🎉" : "Nada concluído ainda.";
    ul.appendChild(li);
    return;
  }

  list.forEach((t) => ul.appendChild(taskEl(t)));
}

const TRASH_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

function taskEl(t) {
  const li = document.createElement("li");
  li.className = "task" + (t.done ? " done" : "");
  li.innerHTML = `
    <button class="check ${t.done ? "checked" : ""}" role="checkbox" aria-checked="${t.done}" title="${t.done ? "Reabrir" : "Concluir"}"></button>
    <div class="body" title="Ver detalhes">
      <div class="title">${esc(t.title)}</div>
    </div>
    <button class="trash" title="Remover">${TRASH_SVG}</button>`;

  li.querySelector(".check").addEventListener("click", () => toggleTask(t.id, !t.done));
  li.querySelector(".body").addEventListener("click", () => openDetailModal(t));
  li.querySelector(".trash").addEventListener("click", () => {
    if (confirm("Remover esta tarefa?")) deleteTask(t.id);
  });
  return li;
}

// --- "quem é você" ---------------------------------------------------------

function initWhoami() {
  updateWhoamiButton();
  document.getElementById("whoami-btn").addEventListener("click", () => openIdentifyModal());
}

function getCurrentUser() {
  return localStorage.getItem("currentUser") || "";
}

function setCurrentUser(id) {
  localStorage.setItem("currentUser", id);
  updateWhoamiButton();
}

function updateWhoamiButton() {
  const m = memberById(getCurrentUser());
  document.getElementById("whoami-name").textContent = m ? m.name : "identifique-se";
}

// Garante que o usuário se identificou; se não, abre o modal e só então segue.
function requireIdentity(next) {
  if (getCurrentUser()) next();
  else openIdentifyModal(next);
}

function openIdentifyModal(next) {
  showModal(`
    <div class="modal-head" style="background:linear-gradient(90deg,#ef4444,#3b82f6,#22c55e,#a855f7)">
      <div>
        <div class="modal-eyebrow">Identifique-se</div>
        <div class="modal-title">Quem é você?</div>
      </div>
      <button class="modal-close" aria-label="Fechar">✕</button>
    </div>
    <div class="modal-body">
      <p class="identify-hint">Escolha seu nome. Ele será usado para registrar quem atribuiu cada tarefa.</p>
      <div class="identify-grid">
        ${MEMBERS.map((m) => `
          <button class="identify-btn" data-id="${m.id}" style="--accent:${m.color}">
            <span class="dot" style="background:${m.color}"></span>${esc(m.name)}
          </button>`).join("")}
      </div>
    </div>`);

  modal.querySelectorAll(".identify-btn").forEach((b) =>
    b.addEventListener("click", () => {
      setCurrentUser(b.dataset.id);
      closeModal();
      if (next) next();
    })
  );
}

// --- modais ----------------------------------------------------------------

const overlay = document.getElementById("overlay");
const modal = document.getElementById("modal");

function showModal(html) {
  modal.innerHTML = html;
  overlay.classList.remove("hidden");
  modal.querySelectorAll("[data-close], .modal-close").forEach((b) =>
    b.addEventListener("click", closeModal)
  );
  const first = modal.querySelector("input, textarea");
  if (first) first.focus();
}

function closeModal() {
  overlay.classList.add("hidden");
  modal.innerHTML = "";
}

overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function openAddModal(member) {
  showModal(`
    <div class="modal-head" style="background:${member.color}">
      <div>
        <div class="modal-eyebrow">Nova tarefa para</div>
        <div class="modal-title">${esc(member.name)}</div>
      </div>
      <button class="modal-close" aria-label="Fechar">✕</button>
    </div>
    <form class="modal-body" id="add-form">
      <label class="field">Título
        <input type="text" id="f-title" maxlength="200" required />
      </label>
      <label class="field">Descrição
        <textarea id="f-desc" rows="4" maxlength="2000" placeholder="Detalhes da tarefa (opcional)"></textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn" style="background:${member.color}">Adicionar</button>
      </div>
    </form>`);

  document.getElementById("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const who = getCurrentUser();
    if (!who) { openIdentifyModal(() => openAddModal(member)); return; }
    const title = document.getElementById("f-title").value.trim();
    if (!title) return;
    const desc = document.getElementById("f-desc").value.trim();
    addTask(member.id, title, desc, who);
    closeModal();
  });
}

function openDetailModal(t) {
  const assignee = memberById(t.member_id);
  const assigner = memberById(t.assigned_by);
  const color = assignee ? assignee.color : "#6b7280";

  showModal(`
    <div class="modal-head" style="background:${color}">
      <div>
        <div class="modal-eyebrow">Tarefa de ${esc(assignee ? assignee.name : "?")}</div>
        <div class="modal-title">${esc(t.title)}</div>
      </div>
      <button class="modal-close" aria-label="Fechar">✕</button>
    </div>
    <div class="modal-body">
      <dl class="detail-meta">
        <div><dt>Atribuída para</dt><dd>${esc(assignee ? assignee.name : "?")}</dd></div>
        <div><dt>Atribuída por</dt><dd>${esc(assigner ? assigner.name : (t.assigned_by || "—"))}</dd></div>
        <div><dt>Adicionada em</dt><dd>${fmtDate(t.created_at)}</dd></div>
      </dl>
      <div class="field-label">Descrição</div>
      <div class="detail-desc-box">${t.description ? esc(t.description) : "<em>Sem descrição.</em>"}</div>
      <div class="modal-actions">
        <button type="button" class="btn danger" id="d-del">${TRASH_SVG} Remover</button>
        <button type="button" class="btn ghost" data-close>Fechar</button>
      </div>
    </div>`);

  document.getElementById("d-del").addEventListener("click", () => {
    if (confirm("Remover esta tarefa?")) { deleteTask(t.id); closeModal(); }
  });
}

function memberById(id) {
  return MEMBERS.find((m) => m.id === id) || null;
}

// --- utilitários -----------------------------------------------------------

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
