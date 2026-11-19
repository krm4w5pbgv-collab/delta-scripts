
const list = document.getElementById("adminScripts");
const form = document.getElementById("scriptForm");
const idInput = document.getElementById("scriptId");
const nameInput = document.getElementById("scriptName");
const codeInput = document.getElementById("scriptCode");
const search = document.getElementById("adminSearch");
const errorBox = document.getElementById("adminError");

let scripts = [];

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    location.href = "/";
    throw new Error("انتهت الجلسة. سجّل الدخول مجدداً.");
  }

  if (!res.ok) throw new Error(data.error || "حدث خطأ.");
  return data;
}

function updateStats() {
  const total = scripts.length;

  const totalCode = scripts.reduce((sum, s) => {
    return sum + String(s.code ?? s.url ?? "").length;
  }, 0);

  const latest = scripts[0]?.name || "لا يوجد";

  document.getElementById("statsTotal").textContent = total;
  document.getElementById("statsCode").textContent =
    totalCode.toLocaleString("ar-SA");
  document.getElementById("statsLatest").textContent = latest;
}

async function load() {
  try {
    scripts = await api("/api/scripts");
    updateStats();
    render();
  } catch (e) {
    errorBox.textContent = e.message;
  }
}

function render() {
  const q = search.value.trim().toLocaleLowerCase("ar");
  const rows = scripts.filter(s =>
    String(s.name ?? "").toLocaleLowerCase("ar").includes(q)
  );

  document.getElementById("adminCount").textContent =
    `${scripts.length} سكربت`;

  list.innerHTML = rows.length ? rows.map(s => `
    <div class="admin-row">
      <div class="script-icon">D</div>
      <div class="script-info">
        <h3>${esc(s.name)}</h3>
        <p>كود السكربت محفوظ</p>
      </div>
      <div class="row-actions">
        <button class="small-btn" data-edit="${s.id}">تعديل</button>
        <button class="small-btn delete" data-delete="${s.id}">حذف</button>
      </div>
    </div>
  `).join("") : '<div class="empty-state">لا توجد سكربتات مطابقة.</div>';
}

function resetForm() {
  form.reset();
  idInput.value = "";
  document.getElementById("editorTitle").textContent = "إضافة سكربت جديد";
  document.getElementById("saveBtn").textContent = "إضافة السكربت";
  document.getElementById("cancelEdit").classList.add("hidden");
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  errorBox.textContent = "";

  const body = {
    name: nameInput.value,
    code: codeInput.value
  };

  try {
    if (idInput.value) {
      await api(`/api/scripts/${idInput.value}`, {
        method: "PUT",
        body: JSON.stringify(body)
      });
    } else {
      await api("/api/scripts", {
        method: "POST",
        body: JSON.stringify(body)
      });
    }

    resetForm();
    await load();
  } catch (err) {
    errorBox.textContent = err.message;
  }
});

list.addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");

  if (edit) {
    const s = scripts.find(x => x.id === Number(edit.dataset.edit));
    if (!s) return;

    idInput.value = s.id;
    nameInput.value = s.name;
    codeInput.value = s.code ?? s.url ?? "";

    document.getElementById("editorTitle").textContent = "تعديل السكربت";
    document.getElementById("saveBtn").textContent = "حفظ التعديلات";
    document.getElementById("cancelEdit").classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (del) {
    const s = scripts.find(x => x.id === Number(del.dataset.delete));
    if (!s) return;

    if (!confirm(`هل تريد حذف "${s.name}"؟`)) return;

    try {
      await api(`/api/scripts/${s.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      errorBox.textContent = err.message;
    }
  }
});

document.getElementById("cancelEdit").addEventListener("click", resetForm);
search.addEventListener("input", render);

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
    location.href = "/";
  } catch (e) {
    errorBox.textContent = e.message;
  }
});

api("/api/admin/status")
  .then(s => {
    if (!s.authenticated) location.href = "/";
  })
  .catch(() => location.href = "/");

load();
