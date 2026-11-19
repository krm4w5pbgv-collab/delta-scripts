
const grid = document.getElementById("scriptsGrid");
const searchInput = document.getElementById("searchInput");
const count = document.getElementById("resultCount");
const modal = document.getElementById("loginModal");

let scripts = [];

const DEFAULT_COLORS = {
  background: "#f6fbff",
  card: "#ffffff",
  button: "#78c8f4",
  text: "#172638",
  topbar: "#ffffff"
};

function applyTheme(colors = {}) {
  const root = document.documentElement;
  const c = { ...DEFAULT_COLORS, ...colors };

  root.style.setProperty("--bg", c.background);
  root.style.setProperty("--white", c.card);
  root.style.setProperty("--blue", c.button);
  root.style.setProperty("--ink", c.text);
  root.style.setProperty("--topbar-color", c.topbar);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function showLogo(element, url, fallback = "D") {
  if (!element) return;

  element.replaceChildren();

  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "شعار الموقع";
    img.onerror = () => {
      element.textContent = fallback;
    };
    element.appendChild(img);
  } else {
    element.textContent = fallback;
  }
}

async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("فشل تحميل الإعدادات");

    const settings = await res.json();

    // تطبيق ألوان الموقع المحفوظة
    applyTheme(settings.colors);

    const siteName = settings.siteName || "Delta Scripts";

    const brandName = document.getElementById("siteName");
    if (brandName) brandName.textContent = siteName;

    const brandLogo = document.getElementById("siteLogo");
    showLogo(brandLogo, settings.logo, "D");

    document.title = siteName;
  } catch (error) {
    applyTheme(DEFAULT_COLORS);
    console.error("تعذّر تحميل إعدادات الموقع:", error);
  }
}

function render() {
  const q = searchInput.value.trim().toLocaleLowerCase("ar");

  const filtered = scripts.filter(s =>
    String(s.name ?? "").toLocaleLowerCase("ar").includes(q)
  );

  count.textContent = `${filtered.length} سكربت`;

  grid.innerHTML = filtered.length ? filtered.map(s => `
    <article class="script-card">
      <div class="script-icon">D</div>
      <div class="script-info">
        <h3>${escapeHtml(s.name)}</h3>
        <p>كود سكربت جاهز للنسخ</p>
      </div>
      <button class="copy-btn" data-id="${escapeHtml(s.id)}">نسخ الكود</button>
    </article>
  `).join("") : `
    <div class="empty-state">
      ${q ? "لا توجد نتائج مطابقة لبحثك." : "لا توجد سكربتات مضافة حالياً."}
    </div>
  `;
}

async function loadScripts() {
  try {
    const res = await fetch("/api/scripts");
    if (!res.ok) throw new Error("فشل التحميل");

    scripts = await res.json();
    render();
  } catch {
    grid.innerHTML = '<div class="empty-state">تعذّر تحميل المكتبة. حاول تحديث الصفحة.</div>';
  }
}

grid.addEventListener("click", async e => {
  const btn = e.target.closest("[data-id]");
  if (!btn) return;

  const script = scripts.find(s => String(s.id) === btn.dataset.id);
  const code = script?.code ?? script?.url;

  if (!code) {
    btn.textContent = "الكود غير موجود";
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
    btn.textContent = "تم النسخ ✓";
    setTimeout(() => btn.textContent = "نسخ الكود", 1500);
  } catch {
    btn.textContent = "تعذّر النسخ";
  }
});

searchInput.addEventListener("input", render);

document.getElementById("adminOpen").addEventListener("click", () => {
  modal.classList.remove("hidden");
});

document.getElementById("loginClose").addEventListener("click", () => {
  modal.classList.add("hidden");
});

modal.addEventListener("click", e => {
  if (e.target === modal) modal.classList.add("hidden");
});

document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = new FormData(e.currentTarget);
  const error = document.getElementById("loginError");
  error.textContent = "";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
        pin: form.get("pin")
      })
    });

    const data = await res.json();

    if (!res.ok) {
      error.textContent = data.error || "تعذّر تسجيل الدخول.";
      return;
    }

    location.href = "/admin.html";
  } catch {
    error.textContent = "تعذّر الاتصال بالخادم.";
  }
});

loadSettings();
loadScripts();
