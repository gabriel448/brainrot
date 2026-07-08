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

const supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

MEMBERS.forEach((m) => (activeTab[m.id] = "ativas"));

renderSkeleton();
loadTasks();

// Sincronização em tempo real entre os integrantes
supabase
  .channel("tarefas")
  .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
  .subscribe();

// --- dados -----------------------------------------------------------------

async function loadTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    setStatus("erro ao carregar", "err");
    console.error(error);
    return;
  }
  tasks = data || [];
  setStatus("online", "ok");
  renderAll();
}

async function addTask(memberId, title) {
  const { error } = await supabase
    .from("tasks")
    .insert({ member_id: memberId, title, done: false });
  if (error) { console.error(error); alert("Não foi possível adicionar a tarefa."); }
  else loadTasks();
}

async function toggleTask(id, done) {
  const { error } = await supabase
    .from("tasks")
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) console.error(error);
  else loadTasks();
}

async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
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
      <form class="add">
        <input type="text" placeholder="Nova tarefa…" maxlength="200" />
        <button type="submit" title="Adicionar">+</button>
      </form>
      <ul class="list"></ul>`;
    boardsEl.appendChild(panel);

    panel.querySelectorAll(".tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeTab[m.id] = btn.dataset.tab;
        renderPanel(m);
      })
    );
    panel.querySelector(".add").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = e.target.querySelector("input");
      const title = input.value.trim();
      if (!title) return;
      input.value = "";
      addTask(m.id, title);
    });
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

function taskEl(t) {
  const li = document.createElement("li");
  li.className = "task" + (t.done ? " done" : "");
  li.innerHTML = `
    <input type="checkbox" ${t.done ? "checked" : ""} />
    <div class="body">
      <div class="title">${esc(t.title)}</div>
      <div class="date">Adicionada em ${fmtDate(t.created_at)}</div>
    </div>
    <button class="trash" title="Remover">🗑️</button>`;

  li.querySelector("input").addEventListener("change", (e) =>
    toggleTask(t.id, e.target.checked)
  );
  li.querySelector(".trash").addEventListener("click", () => {
    if (confirm("Remover esta tarefa?")) deleteTask(t.id);
  });
  return li;
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
