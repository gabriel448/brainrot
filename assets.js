// ============================================================
//  Assets 3D — gerenciamento dos modelos do jogo
// ============================================================

const STATUSES = ["Não iniciado", "Fazendo", "Revisão", "Pronto"];
const PRIORITIES = ["Alta", "Média", "Baixa"];
const STATUS_COLORS = {
  "Não iniciado": "#6b7280",
  "Fazendo": "#3b82f6",
  "Revisão": "#eab308",
  "Pronto": "#22c55e",
};
const PRIORITY_COLORS = { "Alta": "#ef4444", "Média": "#f59e0b", "Baixa": "#6b7280" };

const TRASH_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

const statusEl = document.getElementById("status");
const listEl = document.getElementById("asset-list");
const fArea = document.getElementById("f-area");
const fStatus = document.getElementById("f-status");
const fPriority = document.getElementById("f-priority");
const overlay = document.getElementById("overlay");
const modal = document.getElementById("modal");

let assets = [];
const filters = { area: "", status: "", priority: "" };

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
  db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
} catch (e) {
  setStatus("credenciais inválidas: " + e.message, "err");
  throw e;
}

document.getElementById("new-asset").addEventListener("click", () => openAssetModal(null));
loadAssets();

db.channel("assets-rt")
  .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, () => loadAssets())
  .subscribe();

// --- dados -----------------------------------------------------------------

async function loadAssets() {
  try {
    const { data, error } = await db
      .from("assets")
      .select("*")
      .order("area", { ascending: true })
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      const hint = /assets.* does not exist|not exist/i.test(error.message || "")
        ? "tabela 'assets' não existe — rode o schema.sql no Supabase"
        : (error.message || "erro ao carregar");
      setStatus(hint, "err");
      return;
    }
    assets = data || [];
    setStatus("online", "ok");
    renderFilters();
    render();
  } catch (e) {
    console.error("Falha ao conectar no Supabase:", e);
    setStatus("falha de conexão — veja o console (F12)", "err");
  }
}

async function createAsset(payload) {
  const { error } = await db.from("assets").insert(payload);
  if (error) { console.error(error); alert("Erro ao criar: " + error.message); return; }
  closeModal();
  loadAssets();
}

async function saveAsset(id, payload) {
  payload.updated_at = new Date().toISOString();
  const { error } = await db.from("assets").update(payload).eq("id", id);
  if (error) { console.error(error); alert("Erro ao salvar: " + error.message); return; }
  closeModal();
  loadAssets();
}

async function deleteAsset(id) {
  const { error } = await db.from("assets").delete().eq("id", id);
  if (error) { console.error(error); alert("Erro ao excluir: " + error.message); return; }
  closeModal();
  loadAssets();
}

// --- filtros ---------------------------------------------------------------

function renderFilters() {
  const areas = [...new Set(assets.map((a) => a.area).filter(Boolean))].sort();
  fArea.innerHTML =
    `<option value="">Todas</option>` +
    areas.map((a) => `<option value="${esc(a)}"${a === filters.area ? " selected" : ""}>${esc(a)}</option>`).join("");
  fArea.onchange = () => { filters.area = fArea.value; render(); };

  fStatus.innerHTML =
    chip("", "Todos", !filters.status) +
    STATUSES.map((s) => chip(s, s, filters.status === s, STATUS_COLORS[s])).join("");
  fPriority.innerHTML =
    chip("", "Todas", !filters.priority) +
    PRIORITIES.map((p) => chip(p, p, filters.priority === p, PRIORITY_COLORS[p])).join("");

  fStatus.querySelectorAll(".chip").forEach((c) =>
    (c.onclick = () => { filters.status = c.dataset.value; renderFilters(); render(); })
  );
  fPriority.querySelectorAll(".chip").forEach((c) =>
    (c.onclick = () => { filters.priority = c.dataset.value; renderFilters(); render(); })
  );
}

function chip(value, label, active, color) {
  let style = "";
  if (active) {
    const bg = color || "#6b7280";
    const txt = bg === "#eab308" || bg === "#f59e0b" ? "#1a1d27" : "#fff";
    style = `style="background:${bg};color:${txt}"`;
  }
  return `<button class="chip${active ? " active" : ""}" data-value="${esc(value)}" ${style}>${esc(label)}</button>`;
}

// --- renderização da lista -------------------------------------------------

function render() {
  if (assets.length === 0) {
    listEl.innerHTML = `<div class="assets-empty">Nenhum asset ainda. Clique em “＋ Novo Asset” para começar.</div>`;
    return;
  }

  const visible = assets.filter(
    (a) =>
      (!filters.area || (a.area || "Sem área") === filters.area) &&
      (!filters.status || a.status === filters.status) &&
      (!filters.priority || a.priority === filters.priority)
  );

  if (visible.length === 0) {
    listEl.innerHTML = `<div class="assets-empty">Nenhum asset com esses filtros.</div>`;
    return;
  }

  const byArea = groupBy(visible, (a) => a.area || "Sem área");
  listEl.innerHTML = Object.keys(byArea)
    .sort()
    .map((areaName) => {
      // progresso considera TODOS os assets da área (ignora filtros de status/prioridade)
      const full = assets.filter((a) => (a.area || "Sem área") === areaName);
      const done = full.filter((a) => a.status === "Pronto").length;
      const pct = full.length ? Math.round((done / full.length) * 100) : 0;

      const byCat = groupBy(byArea[areaName], (a) => a.category || "Sem categoria");
      const cats = Object.keys(byCat)
        .sort()
        .map(
          (cat) => `
        <div class="cat-head">${esc(cat)}</div>
        <div class="asset-grid">${byCat[cat].map(cardHtml).join("")}</div>`
        )
        .join("");

      return `
        <section class="area-section">
          <div class="area-head">
            <div class="area-title">${esc(areaName)}</div>
            <div class="area-progress">
              <div class="progress-label"><b>${done}</b>/${full.length} prontos</div>
              <div class="progress-bar"><i style="width:${pct}%"></i></div>
            </div>
          </div>
          ${cats}
        </section>`;
    })
    .join("");

  listEl.querySelectorAll(".asset-card").forEach((el) =>
    el.addEventListener("click", () => {
      const a = assets.find((x) => x.id === el.dataset.id);
      if (a) openAssetModal(a);
    })
  );
}

function cardHtml(a) {
  const sColor = STATUS_COLORS[a.status] || "#6b7280";
  const pColor = PRIORITY_COLORS[a.priority] || "#6b7280";
  return `
    <div class="asset-card" data-id="${a.id}">
      <span class="a-name">${esc(a.name)}</span>
      <span class="a-badges">
        <span class="badge" style="${badgeStyle(sColor)}">${esc(a.status)}</span>
        <span class="badge" style="${badgeStyle(pColor)}">${esc(a.priority)}</span>
      </span>
    </div>`;
}

function badgeStyle(color) {
  const dark = color === "#eab308" || color === "#f59e0b";
  return `background:${color};color:${dark ? "#1a1d27" : "#fff"}`;
}

// --- modal de asset (criar/editar) -----------------------------------------

function openAssetModal(asset) {
  const isEdit = !!asset;
  const a = asset || {
    name: "", area: filters.area || "", category: "", priority: "Média",
    status: "Não iniciado", asset_id: "", assigned_to: "", notes: "",
  };
  const headColor = isEdit ? (STATUS_COLORS[a.status] || "#6b7280") : "#6b7280";

  const areaOpts = [...new Set(assets.map((x) => x.area).filter(Boolean))];
  const catOpts = [...new Set(assets.map((x) => x.category).filter(Boolean))];
  const customAssignee = a.assigned_to && !MEMBERS.some((m) => m.name === a.assigned_to);

  showModal(`
    <div class="modal-head" style="background:${headColor}">
      <div>
        <div class="modal-eyebrow">${isEdit ? "Editar asset" : "Novo asset"}</div>
        <div class="modal-title">${isEdit ? esc(a.name) : "Preencha os dados"}</div>
      </div>
      <button class="modal-close" aria-label="Fechar">✕</button>
    </div>
    <form class="modal-body" id="asset-form">
      <label class="field">Nome
        <input id="af-name" type="text" maxlength="120" required value="${esc(a.name)}" />
      </label>
      <div class="form-row">
        <label class="field">Área
          <input id="af-area" list="dl-area" maxlength="80" value="${esc(a.area || "")}" placeholder="Ex: Área 1 - Madeira" />
        </label>
        <label class="field">Categoria
          <input id="af-category" list="dl-cat" maxlength="80" value="${esc(a.category || "")}" placeholder="Ex: Base/Cenário" />
        </label>
      </div>
      <div class="form-row">
        <label class="field">Prioridade
          <select id="af-priority">${optionList(PRIORITIES, a.priority)}</select>
        </label>
        <label class="field">Status
          <select id="af-status">${optionList(STATUSES, a.status)}</select>
        </label>
      </div>
      <div class="form-row">
        <label class="field">Asset ID (Roblox)
          <input id="af-assetid" type="text" maxlength="60" placeholder="rbxassetid" value="${esc(a.asset_id || "")}" />
        </label>
        <label class="field">Responsável
          <select id="af-assigned">
            <option value="">—</option>
            ${MEMBERS.map((m) => `<option value="${esc(m.name)}"${a.assigned_to === m.name ? " selected" : ""}>${esc(m.name)}</option>`).join("")}
            ${customAssignee ? `<option value="${esc(a.assigned_to)}" selected>${esc(a.assigned_to)}</option>` : ""}
          </select>
        </label>
      </div>
      <label class="field">Notas
        <textarea id="af-notes" rows="3" maxlength="1000" placeholder="Observações (opcional)">${esc(a.notes || "")}</textarea>
      </label>
      <datalist id="dl-area">${areaOpts.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>
      <datalist id="dl-cat">${catOpts.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>
      <div class="modal-actions">
        ${isEdit ? `<button type="button" class="btn danger" id="af-del">${TRASH_SVG} Excluir</button>` : ""}
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn" style="background:#22c55e">${isEdit ? "Salvar" : "Criar"}</button>
      </div>
    </form>`);

  document.getElementById("asset-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      name: val("af-name").trim(),
      area: val("af-area").trim() || null,
      category: val("af-category").trim() || null,
      priority: val("af-priority"),
      status: val("af-status"),
      asset_id: val("af-assetid").trim() || null,
      assigned_to: val("af-assigned") || null,
      notes: val("af-notes").trim() || null,
    };
    if (!payload.name) return;
    if (isEdit) saveAsset(a.id, payload);
    else createAsset(payload);
  });

  if (isEdit) {
    document.getElementById("af-del").addEventListener("click", () =>
      openConfirmModal({
        title: "Excluir asset?",
        message: `O asset <b>"${esc(a.name)}"</b> será excluído permanentemente.`,
        confirmLabel: "Excluir",
        onConfirm: () => deleteAsset(a.id),
        onCancel: () => openAssetModal(a),
      })
    );
  }
}

// --- modal genérico + confirmação ------------------------------------------

function showModal(html) {
  modal.innerHTML = html;
  overlay.classList.remove("hidden");
  modal.querySelectorAll("[data-close], .modal-close").forEach((b) => b.addEventListener("click", closeModal));
  const first = modal.querySelector("input, textarea, select");
  if (first) first.focus();
}

function closeModal() {
  overlay.classList.add("hidden");
  modal.innerHTML = "";
}

overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function openConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  showModal(`
    <div class="modal-head" style="background:#ef4444">
      <div>
        <div class="modal-eyebrow">Confirmação</div>
        <div class="modal-title">${esc(title)}</div>
      </div>
      <button class="modal-close" aria-label="Fechar">✕</button>
    </div>
    <div class="modal-body">
      <p class="confirm-msg">${message}</p>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="c-cancel">Cancelar</button>
        <button type="button" class="btn solid-danger" id="c-ok">${esc(confirmLabel || "Confirmar")}</button>
      </div>
    </div>`);
  document.getElementById("c-cancel").addEventListener("click", () => { if (onCancel) onCancel(); else closeModal(); });
  document.getElementById("c-ok").addEventListener("click", () => { closeModal(); onConfirm(); });
}

// --- utilitários -----------------------------------------------------------

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

function optionList(options, selected) {
  return options.map((o) => `<option${o === selected ? " selected" : ""}>${esc(o)}</option>`).join("");
}

function val(id) {
  return document.getElementById(id).value;
}

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
