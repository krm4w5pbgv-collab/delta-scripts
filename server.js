require("dotenv").config();

const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const Database = require("better-sqlite3");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const required = ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_PIN", "SESSION_SECRET"];
for (const key of required) {
  if (!process.env[key] || process.env[key].startsWith("change_") ||
      (key === "SESSION_SECRET" && process.env[key].length < 32)) {
    console.error(`يرجى ضبط ${key} في ملف .env قبل تشغيل الموقع.`);
    process.exit(1);
  }
}

const app = express();
const isProd = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "catalog.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const SQLiteStore = SQLiteStoreFactory(session);
if (isProd) app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProd ? [] : null
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir, concurrentDB: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "delta_admin_session",
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 4
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "محاولات كثيرة. حاول بعد 15 دقيقة." }
});

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ error: "يجب تسجيل دخول الأدمن أولاً." });
}
function validScript(name, url) {
  if (typeof name !== "string" || typeof url !== "string") return false;
  if (!name.trim() || name.trim().length > 90 || url.trim().length > 2048) return false;
  try {
    const parsed = new URL(url.trim());
    return ["https:", "http:"].includes(parsed.protocol);
  } catch { return false; }
}

app.get("/api/scripts", (req, res) => {
  const rows = db.prepare("SELECT id, name, url FROM scripts ORDER BY id DESC").all();
  res.json(rows);
});

app.post("/api/login", loginLimiter, (req, res, next) => {
  const { username, password, pin } = req.body || {};
  const ok = safeEqual(username || "", process.env.ADMIN_USERNAME) &&
    safeEqual(password || "", process.env.ADMIN_PASSWORD) &&
    safeEqual(pin || "", process.env.ADMIN_PIN);
  if (!ok) return res.status(401).json({ error: "بيانات الدخول غير صحيحة." });
  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.isAdmin = true;
    req.session.save(err2 => {
      if (err2) return next(err2);
      res.json({ ok: true });
    });
  });
});

app.post("/api/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("delta_admin_session", { httpOnly: true, sameSite: "strict", secure: isProd });
    res.json({ ok: true });
  });
});

app.get("/api/admin/status", (req, res) => {
  res.json({ authenticated: req.session?.isAdmin === true });
});

app.post("/api/scripts", requireAdmin, (req, res) => {
  const { name, url } = req.body || {};
  if (!validScript(name, url)) return res.status(400).json({ error: "تحقق من الاسم والرابط. الروابط المقبولة تبدأ بـ http أو https." });
  const info = db.prepare("INSERT INTO scripts (name, url) VALUES (?, ?)").run(name.trim(), url.trim());
  res.status(201).json(db.prepare("SELECT id, name, url FROM scripts WHERE id = ?").get(info.lastInsertRowid));
});

app.put("/api/scripts/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, url } = req.body || {};
  if (!Number.isInteger(id) || id < 1 || !validScript(name, url))
    return res.status(400).json({ error: "البيانات غير صحيحة." });
  const result = db.prepare("UPDATE scripts SET name = ?, url = ? WHERE id = ?").run(name.trim(), url.trim(), id);
  if (!result.changes) return res.status(404).json({ error: "السكربت غير موجود." });
  res.json({ ok: true });
});

app.delete("/api/scripts/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "معرّف غير صحيح." });
  const result = db.prepare("DELETE FROM scripts WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "السكربت غير موجود." });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "حدث خطأ داخلي في الخادم." });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Delta Scripts يعمل على http://localhost:${port}`));
