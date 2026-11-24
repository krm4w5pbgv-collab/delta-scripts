const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined });
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "30kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "change-this-session-secret-before-deploy",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, friend_hash TEXT NOT NULL,
    access_hash TEXT NOT NULL, is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  const adminName = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  const adminFriend = process.env.ADMIN_FRIEND_WORD;
  const adminCode = process.env.ADMIN_ACCESS_CODE;
  if (adminName && adminPass && adminFriend && adminCode) {
    const exists = await pool.query("SELECT id FROM users WHERE username=$1", [adminName]);
    if (!exists.rowCount) {
      const hashes = await Promise.all([adminPass, adminFriend, adminCode].map(v => bcrypt.hash(v, 12)));
      await pool.query("INSERT INTO users(username,password_hash,friend_hash,access_hash,is_admin) VALUES($1,$2,$3,$4,TRUE)", [adminName, ...hashes]);
      console.log("MOXB owner account created.");
    }
  }
}
const clean = v => typeof v === "string" ? v.trim() : "";
function requireAuth(req,res,next){ if(!req.session.user) return res.status(401).json({error:"سجّل الدخول أولاً"}); next(); }
function requireAdmin(req,res,next){ if(!req.session.user?.isAdmin) return res.status(403).json({error:"هذه الصفحة للأونر فقط"}); next(); }

app.post("/api/login", async (req,res) => {
  try {
    const {username,password,friendWord,accessCode}=req.body || {};
    if (![username,password,friendWord,accessCode].every(v=>clean(v))) return res.status(400).json({error:"أكمل الخانات الأربع"});
    const q=await pool.query("SELECT * FROM users WHERE username=$1",[clean(username)]);
    const u=q.rows[0];
    if(!u) return res.status(401).json({error:"بيانات الدخول غير صحيحة"});
    const ok=await Promise.all([bcrypt.compare(password,u.password_hash),bcrypt.compare(friendWord,u.friend_hash),bcrypt.compare(accessCode,u.access_hash)]);
    if(!ok.every(Boolean)) return res.status(401).json({error:"بيانات الدخول غير صحيحة"});
    req.session.user={id:u.id,username:u.username,isAdmin:u.is_admin};
    res.json({ok:true,user:req.session.user});
  } catch(e){ console.error(e); res.status(500).json({error:"حدث خطأ في الخادم"}); }
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",requireAuth,(req,res)=>res.json({user:req.session.user}));
app.get("/api/users",requireAuth,requireAdmin,async(req,res)=>{
  const q=await pool.query("SELECT id,username,is_admin,created_at FROM users ORDER BY id");
  res.json({users:q.rows});
});
app.post("/api/users",requireAuth,requireAdmin,async(req,res)=>{
  try {
    const {username,password,friendWord,accessCode}=req.body||{};
    if(![username,password,friendWord,accessCode].every(v=>clean(v))) return res.status(400).json({error:"أكمل جميع البيانات"});
    if(clean(username).length<3 || clean(password).length<8) return res.status(400).json({error:"اسم المستخدم 3 أحرف على الأقل وكلمة المرور 8 أحرف على الأقل"});
    const hashes=await Promise.all([password,friendWord,accessCode].map(v=>bcrypt.hash(v,12)));
    await pool.query("INSERT INTO users(username,password_hash,friend_hash,access_hash) VALUES($1,$2,$3,$4)",[clean(username),...hashes]);
    res.json({ok:true});
  } catch(e){ if(e.code==="23505") return res.status(409).json({error:"اسم المستخدم مستخدم"}); console.error(e); res.status(500).json({error:"تعذر إنشاء الحساب"}); }
});
app.delete("/api/users/:id",requireAuth,requireAdmin,async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:"رقم حساب غير صالح"});
  await pool.query("DELETE FROM users WHERE id=$1 AND is_admin=FALSE",[id]);
  res.json({ok:true});
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
init().then(()=>app.listen(PORT,()=>console.log(`MOXB running on ${PORT}`))).catch(e=>{console.error(e);process.exit(1);});
