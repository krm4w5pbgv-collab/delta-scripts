const grid = document.getElementById("scriptsGrid");
const searchInput = document.getElementById("searchInput");
const count = document.getElementById("resultCount");
const modal = document.getElementById("loginModal");
let scripts = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function render() {
  const q = searchInput.value.trim().toLocaleLowerCase("ar");
  const filtered = scripts.filter(s => s.name.toLocaleLowerCase("ar").includes(q));
  count.textContent = `${filtered.length} سكربت`;
  grid.innerHTML = filtered.length ? filtered.map(s => `
    <article class="script-card">
      <div class="script-icon">D</div>
      <div class="script-info"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.url)}</p></div>
      <button class="copy-btn" data-copy="${escapeHtml(s.url)}">نسخ الرابط</button>
    </article>`).join("") : `<div class="empty-state">${q ? "لا توجد نتائج مطابقة لبحثك." : "لا توجد سكربتات مضافة حالياً."}</div>`;
}
async function loadScripts() {
  try {
    const res = await fetch("/api/scripts");
    scripts = await res.json();
    render();
  } catch { grid.innerHTML = '<div class="empty-state">تعذّر تحميل المكتبة. حاول تحديث الصفحة.</div>'; }
}
grid.addEventListener("click", async e => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    btn.textContent = "تم النسخ ✓";
    setTimeout(() => btn.textContent = "نسخ الرابط", 1500);
  } catch { btn.textContent = "تعذّر النسخ"; }
});
searchInput.addEventListener("input", render);
document.getElementById("adminOpen").addEventListener("click", () => modal.classList.remove("hidden"));
document.getElementById("loginClose").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const error = document.getElementById("loginError");
  error.textContent = "";
  const res = await fetch("/api/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
    username:form.get("username"), password:form.get("password"), pin:form.get("pin")
  })});
  const data = await res.json();
  if (!res.ok) { error.textContent = data.error || "تعذّر تسجيل الدخول."; return; }
  location.href = "/admin.html";
});
loadScripts();
