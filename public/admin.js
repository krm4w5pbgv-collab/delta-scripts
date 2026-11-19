
const list = document.getElementById("adminScripts");
const form = document.getElementById("scriptForm");
const idInput = document.getElementById("scriptId");
const nameInput = document.getElementById("scriptName");
const codeInput = document.getElementById("scriptCode");
const search = document.getElementById("adminSearch");
const errorBox = document.getElementById("adminError");

const settingsForm = document.getElementById("settingsForm");
const siteNameInput = document.getElementById("siteNameInput");
const siteLogoInput = document.getElementById("siteLogoInput");
const settingsMessage = document.getElementById("settingsMessage");
const logoPreview = document.getElementById("logoPreview");

const colorInputs = {
  background: document.getElementById("colorBackground"),
  card: document.getElementById("colorCard"),
  button: document.getElementById("colorButton"),
  text: document.getElementById("colorText"),
  topbar: document.getElementById("colorTopbar")
};

const colorsMessage = document.getElementById("colorsMessage");
const colorLivePreview = document.getElementById("colorLivePreview");
const saveColorsBtn = document.getElementById("saveColorsBtn");
const resetColorsBtn = document.getElementById("resetColorsBtn");

const DEFAULT_COLORS = {
  background: "#f6fbff",
  card: "#ffffff",
  button: "#78c8f4",
  text: "#172638",
  topbar: "#ffffff"
};

let scripts = [];
let currentColors = { ...DEFAULT_COLORS };

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    location.href = "/";
    throw new Error("انتهت الجلسة. سجّل الدخول مجدداً.");
  }

  if (!res.ok) throw new Error(data.error || "حدث خطأ.");

  return data;
}

function showLogo(element, url, fallback = "D") {
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

// تحديث معاينة الألوان
function previewColors(colors) {
  colorLivePreview.style.backgroundColor = colors.background;
  colorLivePreview.style.color = colors.text;

  const topbar = colorLivePreview.querySelector(".color-preview-topbar");
  const card = colorLivePreview.querySelector(".color-preview-card");
  const button = colorLivePreview.querySelector(".color-preview-button");

  topbar.style.backgroundColor = colors.topbar;
  topbar.style.color = colors.text;

  card.style.backgroundColor = colors.card;
  card.style.color = colors.text;

  button.style.backgroundColor = colors.button;
  button.style.color = colors.text;
}

// قراءة الألوان من أدوات الاختيار
function readColors() {
  return {
    background: colorInputs.background.value,
    card: colorInputs.card.value,
    button: colorInputs.button.value,
    text: colorInputs.text.value,
    topbar: colorInputs.topbar.value
  };
}

// عرض الألوان في أدوات الاختيار
function setColorInputs(colors) {
  for (const key of Object.keys(DEFAULT_COLORS)) {
    colorInputs[key].value = colors[key] || DEFAULT_COLORS[key];
  }

  currentColors = { ...colors };
  previewColors(currentColors);
}

// معاينة مباشرة عند تغيير أي لون
Object.values(colorInputs).forEach(input => {
  input.addEventListener("input", () => {
    previewColors(readColors());
    colorsMessage.textContent = "";
  });
});

async function loadSettings() {
  try {
    const settings = await api("/api/settings");

    siteNameInput.value = settings.siteName || "Delta Scripts";
    siteLogoInput.value = settings.logo || "";

    document.getElementById("adminSiteName").textContent =
      settings.siteName || "Delta Scripts";

    document.title =
      `لوحة التحكم | ${settings.siteName || "Delta Scripts"}`;

    showLogo(document.getElementById("adminLogo"), settings.logo, "D");
    showLogo(logoPreview, settings.logo, "D");

    setColorInputs({
      ...DEFAULT_COLORS,
      ...(settings.colors || {})
    });
  } catch (e) {
    settingsMessage.textContent = e.message;
  }
}

siteLogoInput.addEventListener("input", () => {
  const url = siteLogoInput.value.trim();

  if (url.startsWith("https://")) {
    showLogo(logoPreview, url, "D");
  } else {
    showLogo(logoPreview, "", "D");
  }
});

settingsForm.addEventListener("submit", async e => {
  e.preventDefault();

  settingsMessage.textContent = "جارٍ حفظ الإعدادات...";

  try {
    const settings = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        siteName: siteNameInput.value.trim(),
        logo: siteLogoInput.value.trim(),
        colors: readColors()
      })
    });

    document.getElementById("adminSiteName").textContent =
      settings.siteName;

    document.title = `لوحة التحكم | ${settings.siteName}`;

    showLogo(document.getElementById("adminLogo"), settings.logo, "D");
    showLogo(logoPreview, settings.logo, "D");

    if (settings.colors) {
      setColorInputs(settings.colors);
    }

    settingsMessage.textContent = "تم حفظ الإعدادات بنجاح ✓";
  } catch (e) {
    settingsMessage.textContent = e.message;
  }
});

// حفظ الألوان
saveColorsBtn.addEventListener("click", async () => {
  colorsMessage.textContent = "جارٍ حفظ الألوان...";

  try {
    await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        siteName: siteNameInput.value.trim(),
        logo: siteLogoInput.value.trim(),
        colors: readColors()
      })
    });

    currentColors = readColors();
    colorsMessage.textContent = "تم حفظ الألوان بنجاح ✓";
  } catch (e) {
    colorsMessage.textContent = e.message;
  }
});

// استعادة الألوان الافتراضية وحفظها
resetColorsBtn.addEventListener("click", async () => {
  const confirmed = confirm(
    "هل تريد استعادة الألوان الافتراضية للموقع؟"
  );

  if (!confirmed) return;

  colorsMessage.textContent = "جارٍ استعادة الألوان...";

  try {
    await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        siteName: siteNameInput.value.trim(),
        logo: siteLogoInput.value.trim(),
        colors: DEFAULT_COLORS
      })
    });

    setColorInputs(DEFAULT_COLORS);

    colorsMessage.textContent =
      "تمت استعادة الألوان الافتراضية وحفظها ✓";
  } catch (e) {
    colorsMessage.textContent = e.message;
  }
});

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

  document.getElementById("editorTitle").textContent =
    "إضافة سكربت جديد";

  document.getElementById("saveBtn").textContent =
    "إضافة السكربت";

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

    document.getElementById("editorTitle").textContent =
      "تعديل السكربت";

    document.getElementById("saveBtn").textContent =
      "حفظ التعديلات";

    document.getElementById("cancelEdit").classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (del) {
    const s = scripts.find(x => x.id === Number(del.dataset.delete));
    if (!s) return;

    if (!confirm(`هل تريد حذف "${s.name}"؟`)) return;

    try {
      await api(`/api/scripts/${s.id}`, {
        method: "DELETE"
      });

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

loadSettings();
load();
